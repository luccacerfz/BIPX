import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, evidenceDir } from './quality-browser.mjs';
import { createAudioTestServer } from './audio-test-server.mjs';

// Native Web Audio output in a CPU-only document; this is explicitly NOT gameplay.
const server = await createAudioTestServer();
const fingerprints = () => {
  const files = ['src/audio/sample-bank.js', 'src/audio/skill-sounds.js', 'tools/audio-arpg-verify.mjs', 'assets/audio/manifest.json', 'assets/audio/processed/manifest.json'];
  for (const base of ['assets/audio', 'assets/audio/processed']) {
    const manifest = JSON.parse(fs.readFileSync(`${base}/manifest.json`));
    files.push(...Object.values(manifest.cues).map(cue => `${base}/${cue.file}`));
  }
  return Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
};
const before = fingerprints();
const browser = await chromium.launch({ ...browserLaunchOptions, args: ['--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(server.url);
  const result = await page.evaluate(async () => {
    const { createSampleBank } = await import('/src/audio/sample-bank.js');
    const { SKILL_SOUND_PROFILES, SKILL_SOUND_IDS, SKILL_SOUND_PHASES } = await import('/src/audio/skill-sounds.js');
    const checks = [];
    function check(condition, message) { if (!condition) throw new Error(message); checks.push(message); }
    function analyse(buffer, start = 0, end = buffer.duration) {
      let peak = 0, energy = 0, count = 0, onset = null;
      const channelRms = [];
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        let channelEnergy = 0, channelCount = 0;
        for (let i = Math.floor(start * buffer.sampleRate); i < Math.min(samples.length, end * buffer.sampleRate); i++) {
          const value = samples[i]; peak = Math.max(peak, Math.abs(value)); energy += value * value; count++;
          channelEnergy += value * value; channelCount++;
          if (Math.abs(value) > .0001) onset = Math.min(onset ?? Infinity, i / buffer.sampleRate - start);
        }
        channelRms.push(Math.sqrt(channelEnergy / Math.max(1, channelCount)));
      }
      return { peak, rms: Math.sqrt(energy / Math.max(1, count)), channelRms, onsetSeconds: onset };
    }
    // Fix random variation only in this fixture, making spatial comparisons exact.
    Math.random = () => .5;
    async function isolated(id, phase, options = {}) {
      const context = new OfflineAudioContext(2, 48000 * 2, 48000);
      const bank = createSampleBank(context, context.destination);
      bank.update({ playing: true }); // No ambience buffer is loaded at this instant.
      await bank.load;
      check(bank.getState().loaded && bank.getState().loadedCues.length === 28, 'All 28 provider derivatives decoded');
      const recognised = bank.playSkillSound(id, phase, { castId: 'isolated', ...options });
      const measurement = analyse(await context.startRendering());
      const state = bank.getState(); bank.dispose();
      return { recognised, measurement, state };
    }
    const phases = [];
    for (const id of SKILL_SOUND_IDS) for (const phase of SKILL_SOUND_PHASES) {
      const result = await isolated(id, phase);
      check(result.recognised, `${id}/${phase} recognised`);
      if (SKILL_SOUND_PROFILES[id][phase]) {
        check(result.measurement.peak > .0002 && result.measurement.peak < 1, `${id}/${phase} non-silent unclipped native signal`);
        check(result.measurement.onsetSeconds < .06, `${id}/${phase} starts within 60ms`);
      } else check(result.measurement.peak === 0, `${id}/${phase} phase intentionally silent`);
      phases.push({ id, phase, measurement: result.measurement });
    }
    const left = await isolated('dwarf_gravity_shot', 'impact', { pan: -.85 });
    const right = await isolated('dwarf_gravity_shot', 'impact', { pan: .85 });
    const far = await isolated('dwarf_gravity_shot', 'impact', { distance: 20 });
    const near = phases.find(cue => cue.id === 'dwarf_gravity_shot' && cue.phase === 'impact');
    check(left.measurement.channelRms[0] > 2 * left.measurement.channelRms[1], 'Skill left pan renders left');
    check(right.measurement.channelRms[1] > 2 * right.measurement.channelRms[0], 'Skill right pan renders right');
    const distanceRatio = far.measurement.rms / near.measurement.rms;
    check(Math.abs(distanceRatio - 1 / 2.2) < .001, 'Skill distance attenuation matches world units');
    const guardContext = new OfflineAudioContext(2, 48000, 48000);
    const guard = createSampleBank(guardContext, guardContext.destination);
    guard.update({ playing: true });
    guard.playSkillSound(SKILL_SOUND_IDS[0], 'cast', { castId: 'during-load' });
    await guard.load;
    check(guard.getState().played === 0 && guard.getState().skillSuppressed.loading === 1, 'Loading drops cues instead of delayed replay');
    guard.playSkillSound(SKILL_SOUND_IDS[0], 'cast', { castId: 'during-load' });
    check(guard.getState().played === 0, 'Previously dropped cast is not replayed on readiness');
    check(!guard.playSkillSound('unknown', 'cast') && !guard.playSkillSound(SKILL_SOUND_IDS[0], 'unknown'), 'Unknown IDs and phases return false');
    guard.playSkillSound(SKILL_SOUND_IDS[0], 'cast', { castId: 'old', ageMs: 181 });
    guard.playSkillSound(SKILL_SOUND_IDS[0], 'ready', { local: false });
    guard.playSkillSound(SKILL_SOUND_IDS[0], 'resourcefail', { local: false });
    check(guard.getState().played === 0, 'Stale events and remote private feedback stay silent');
    guard.update({ muted: true });
    guard.playSkillSound(SKILL_SOUND_IDS[1], 'impact');
    guard.update({ muted: false, paused: true });
    guard.playSkillSound(SKILL_SOUND_IDS[1], 'impact');
    guard.update({ paused: false });
    check(guard.getState().played === 0, 'Muted/paused skill events do not queue');
    for (let i = 0; i < 100; i++) guard.playSkillSound(SKILL_SOUND_IDS[1], 'impact', { castId: 'aoe', contactId: i });
    check(guard.getState().played === 1, '100 AOE contacts emit a single impact per cast');
    guard.reset();
    check(guard.getState().activeVoices === 0 && guard.getState().recentSkillEvents === 0, 'Reset releases voices and dedup IDs');
    for (const id of SKILL_SOUND_IDS) guard.playSkillSound(id, 'ready', { castId: id });
    check(guard.getState().playedByCue.skillReady === 1, 'Ready cues share one global cooldown across skills');
    for (let i = 0; i < 100; i++) guard.playSkillSound(SKILL_SOUND_IDS[i % 6], 'resourcefail', { castId: `fail${i}` });
    check(guard.getState().playedByCue.skillResourceFail === 1, 'Resource failure spam shares global cooldown');
    const guards = guard.getState();
    guard.dispose(); guard.dispose();
    check(guard.getState().activeVoices === 0 && guard.getState().retiringVoices === 0 && !guard.getState().ambienceActive, 'Dispose is idempotent and releases bank');
    await guardContext.startRendering();

    const context = new OfflineAudioContext(2, 48000 * 30, 48000);
    const sourceEvents = [];
    const nativeSource = context.createBufferSource.bind(context);
    context.createBufferSource = () => {
      const source = nativeSource(), entry = { start: Infinity, stop: Infinity, loop: false };
      const nativeStart = source.start.bind(source), nativeStop = source.stop.bind(source);
      source.start = (at = 0, ...args) => { entry.start = at; entry.loop = source.loop; sourceEvents.push(entry); return nativeStart(at, ...args); };
      source.stop = at => { entry.stop = at; return nativeStop(at); };
      return source;
    };
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 8;
    compressor.attack.value = .006; compressor.release.value = .18; compressor.connect(context.destination);
    const bank = createSampleBank(context, compressor);
    await bank.load;
    const timeline = [], jobs = [], snapshots = [];
    const schedule = (at, label, action) => jobs.push(context.suspend(at).then(() => {
      bank.update({ playing: true, paused: false, muted: false });
      action(); timeline.push({ time: context.currentTime, label }); snapshots.push(bank.getState());
      return context.resume();
    }));
    const impactTimes = [.40, .40, .55, .70, .70, .85];
    const releaseTimes = [.35, .18, .28, .28, .24, .40];
    for (let i = 0; i < 6; i++) {
      const start = .10 + i * 3, id = SKILL_SOUND_IDS[i], castId = `sequence-${i}`;
      schedule(start, `${id}:cast`, () => bank.playSkillSound(id, 'cast', { castId }));
      schedule(start + releaseTimes[i], `${id}:release`, () => bank.playSkillSound(id, 'release', { castId }));
      if (i === 0 || i === 5) {
        schedule(start + 1, `${id}:sustain`, () => bank.playSkillSound(id, 'sustain', { castId, remaining: 1.5 }));
        schedule(start + 2.6, `${id}:end`, () => bank.playSkillSound(id, 'end', { castId }));
      }
      schedule(start + impactTimes[i], `${id}:impact`, () => bank.playSkillSound(id, 'impact', { castId }));
      schedule(start + 1.4, `${id}:ready`, () => bank.playSkillSound(id, 'ready', { castId }));
      schedule(start + 2, `${id}:resourcefail`, () => bank.playSkillSound(id, 'resourcefail', { castId }));
    }
    schedule(18.80, 'persistent gravity under horde stress', () => bank.playSkillSound('dwarf_gravity_shot', 'sustain', { castId: 'stress-field-1', remaining: 4.1 }));
    schedule(18.87, 'persistent buff under horde stress', () => bank.playSkillSound('warrior_war_cry', 'sustain', { castId: 'stress-buff', remaining: 4.1 }));
    schedule(18.94, 'second persistent gravity under horde stress', () => bank.playSkillSound('dwarf_gravity_shot', 'sustain', { castId: 'stress-field-2', remaining: 4.1, distance: 10 }));
    for (let i = 0; i < 20; i++) schedule(19 + i * .12, `synthetic horde stress ${i}`, () => {
      for (const id of ['pistol', 'katana', 'hit', 'kill', 'explosion', 'flamethrower']) bank.play(id);
      for (const id of SKILL_SOUND_IDS) for (const phase of ['cast', 'release', 'impact']) bank.playSkillSound(id, phase, { castId: `${i}-${id}` });
      if (i === 5) bank.play('bossSpawn');
    });
    schedule(23, 'pause: true quiet gap', () => bank.update({ paused: true }));
    // Resume a suspended mix to ensure silenced attacks do not reappear.
    schedule(25, 'resume then muted', () => bank.update({ muted: true }));
    schedule(27, 'dispose and final quiet gap', () => bank.dispose());
    const rendered = await context.startRendering(); await Promise.all(jobs);
    const measurement = analyse(rendered), paused = analyse(rendered, 24.5, 25), muted = analyse(rendered, 26.5, 27), disposed = analyse(rendered, 28, 30);
    check(measurement.peak > .01 && measurement.peak < .99, 'Six-skill timeline plus horde output has headroom');
    check(paused.peak < .001 && muted.peak < .001 && disposed.peak === 0, 'Pause, mute and dispose produce measured quiet gaps');
    const probes = sourceEvents.filter(event => Number.isFinite(event.stop)).flatMap(event => [event.start, event.stop]).filter(Number.isFinite);
    const physicalPeak = Math.max(...probes.map(time => sourceEvents.filter(event => Number.isFinite(event.stop) && event.start <= time && event.stop > time).length));
    check(physicalPeak <= 16, 'Physical SFX overlap including release tails never exceeds 16');
    check(snapshots.some(snapshot => snapshot.stolenVoices > 0) && snapshots.some(snapshot => Object.keys(snapshot.suppressedByCue).length > 0), 'Horde stresses stealing and suppression');
    check(snapshots.some(snapshot => snapshot.ducking), 'Local casts/boss exercise ducking');
    const pcm = new Float32Array(rendered.length * 2);
    for (let frame = 0; frame < rendered.length; frame++) { pcm[frame * 2] = rendered.getChannelData(0)[frame]; pcm[frame * 2 + 1] = rendered.getChannelData(1)[frame]; }
    const bytes = new Uint8Array(pcm.buffer);
    let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return { checks, phases, spatial: { left: left.measurement, right: right.measurement, distanceRatio }, guards,
      sequence: { measurement, paused, muted, disposed, physicalPeak, timeline, snapshots, sampleRate: rendered.sampleRate, pcmBase64: btoa(binary) } };
  });
  const pcm = Buffer.from(result.sequence.pcmBase64, 'base64'); delete result.sequence.pcmBase64;
  const wav = Buffer.alloc(44 + pcm.length / 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(192000, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let offset = 0; offset < pcm.length; offset += 4) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm.readFloatLE(offset))) * 32767), 44 + offset / 2);
  fs.writeFileSync(path.join(evidenceDir, 'arpg-skill-sequence-fixture.wav'), wav);
  assert.deepEqual(errors, []);
  assert.deepEqual(fingerprints(), before, 'Audio sources changed during capture');
  const report = { ok: true, kind: 'Native OfflineAudioContext rendering in GPU-disabled Chromium; synthetic timeline, NOT gameplay',
    browser: browser.version(), sourceChanged: false, sourceHashes: before, perceptualListening: 'pending; no listening-capable tool in this session',
    physicalDevice: 'pending', wav: 'arpg-skill-sequence-fixture.wav', wavSha256: crypto.createHash('sha256').update(wav).digest('hex'), ...result };
  fs.writeFileSync(path.join(evidenceDir, 'arpg-audio.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, checks: result.checks.length, evidenceDir, physicalPeak: result.sequence.physicalPeak, signalPeak: result.sequence.measurement.peak }));
} finally { await browser.close(); await server.close(); }
