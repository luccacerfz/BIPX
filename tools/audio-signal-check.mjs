import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, browserLaunchOptions, evidenceDir } from './quality-browser.mjs';
import { createAudioTestServer } from './audio-test-server.mjs';

// Actual Web Audio rendering in a document without the game's GPU scene. This is a fixture, not gameplay.
const server = process.argv[2] ? null : await createAudioTestServer();
const baseUrl = process.argv[2] || server.url;
const browser = await chromium.launch({ ...browserLaunchOptions, args: ['--disable-gpu'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const files = ['src/audio/sample-bank.js', 'src/audio/skill-sounds.js', 'assets/audio/processed/manifest.json',
  ...Object.values(JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json')).cues).map(cue => `assets/audio/processed/${cue.file}`)];
const fingerprints = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const initial = fingerprints();
try {
  await page.goto(`${baseUrl}/assets/audio/processed/manifest.json`);
  const result = await page.evaluate(async () => {
    const base = document.createElement('base'); base.href = '/'; document.head.prepend(base);
    const { createSampleBank } = await import('/src/audio/sample-bank.js');
    const analyse = (buffer) => {
      let peak = 0;
      const rms = [];
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        let sum = 0;
        for (const value of samples) { peak = Math.max(peak, Math.abs(value)); sum += value * value; }
        rms.push(Math.sqrt(sum / samples.length));
      }
      return { peak, rms, duration: buffer.duration };
    };
    async function isolated(options) {
      const context = new OfflineAudioContext(2, 48000, 48000);
      const bank = createSampleBank(context, context.destination);
      await bank.load;
      bank.play('pistol', options);
      const rendered = await context.startRendering();
      const measurement = analyse(rendered);
      bank.dispose();
      return measurement;
    }
    const spatial = {
      left: await isolated({ pan: -.85 }), right: await isolated({ pan: .85 }),
      near: await isolated({ distance: 0 }), far: await isolated({ distance: 20 }),
    };
    const context = new OfflineAudioContext(2, 48000 * 2, 48000);
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18; compressor.knee.value = 18; compressor.ratio.value = 8;
    compressor.attack.value = .006; compressor.release.value = .18;
    compressor.connect(context.destination);
    const bank = createSampleBank(context, compressor);
    await bank.load;
    bank.update({ playing: true, paused: false, muted: false });
    const steps = [];
    const jobs = [];
    for (let time = .05; time <= 1.75; time += .1) {
      jobs.push(context.suspend(time).then(() => {
        bank.update({ playing: true, paused: false, muted: false });
        for (const id of ['pistol', 'katana', 'hit', 'kill', 'flamethrower', 'thunderstaff', 'frostNova', 'talisman', 'explosion', 'levelUp', 'uiSelect']) bank.play(id, { priority: 1 });
        if (time > .2 && time < .3) bank.play('bossSpawn', { priority: 4 });
        steps.push(bank.getState());
        return context.resume();
      }));
    }
    const rendered = await context.startRendering();
    await Promise.all(jobs);
    const stress = { measurement: analyse(rendered), state: bank.getState(), steps };
    bank.dispose();
    return { spatial, stress };
  });
  const { spatial, stress } = result;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  assert(spatial.left.rms[0] > spatial.left.rms[1] * 2, 'Left pan did not render predominantly left');
  assert(spatial.right.rms[1] > spatial.right.rms[0] * 2, 'Right pan did not render predominantly right');
  const distanceRatio = Math.hypot(...spatial.far.rms) / Math.hypot(...spatial.near.rms);
  assert(Math.abs(distanceRatio - 1 / 2.2) < .04, 'Distance attenuation does not match the mix contract');
  assert(stress.state.peakVoices <= stress.state.maxVoices && stress.state.peakVoices >= 12, 'Voice stress missed the cap or exceeded it');
  assert(stress.state.stolenVoices > 0 && Object.keys(stress.state.suppressedByCue).length > 0, 'Stress did not exercise voice stealing and cooldowns');
  assert(stress.state.playedByCue.bossSpawn >= 1, 'Critical boss cue was lost under load');
  assert(stress.measurement.peak > .01 && stress.measurement.peak < 1, 'Stress output is silent or clips');
  assert(stress.state.errors.length === 0 && errors.length === 0, 'Web Audio fixture reported an error');
  assert(JSON.stringify(initial) === JSON.stringify(fingerprints()), 'Audio candidate changed during signal verification');
  fs.writeFileSync(path.join(evidenceDir, 'audio-signal.json'), `${JSON.stringify({ ok: true, browser: browser.version(), syntheticFixture: true, kind: 'actual OfflineAudioContext rendered signal', sourceHashes: initial, distanceRatio, ...result }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, evidenceDir, peakVoices: stress.state.peakVoices, outputPeak: stress.measurement.peak, distanceRatio }));
} finally { await browser.close(); await server?.close(); }
