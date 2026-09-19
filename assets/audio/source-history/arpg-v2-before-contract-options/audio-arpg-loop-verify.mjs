import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, evidenceDir } from './quality-browser.mjs';
import { createAudioTestServer } from './audio-test-server.mjs';
const manifest = JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json'));
const files = ['src/audio/sample-bank.js', 'src/audio/skill-sounds.js', 'tools/audio-arpg-loop-verify.mjs', 'assets/audio/processed/manifest.json', ...Object.values(manifest.cues).map(c => `assets/audio/processed/${c.file}`)];
const fingerprint = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before = fingerprint(), server = await createAudioTestServer();
const browser = await chromium.launch({ ...browserLaunchOptions, args: ['--disable-gpu'] });
const page = await browser.newPage(); const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(server.url);
  const result = await page.evaluate(async () => {
    const { createSampleBank } = await import('/src/audio/sample-bank.js');
    const context = new OfflineAudioContext(2, 48000 * 5, 48000);
    const bank = createSampleBank(context, context.destination);
    bank.update({ playing: true }); await bank.load;
    const checks = [], snapshots = [], jobs = [];
    const check = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
    const gravity = 'dwarf_gravity_shot', buff = 'warrior_war_cry';
    const schedule = (time, action) => jobs.push(context.suspend(time).then(async () => {
      await action(); snapshots.push({ at: context.currentTime, ...bank.getState() }); await context.resume();
    }));
    check(bank.playSkillSound('dwarf_arcane_shot', 'cast') === false, 'Historical v1 IDs no longer activate skills');
    schedule(.05, () => bank.playSkillSound(gravity, 'sustain', { castId: 'loop', remaining: 1, pan: -.8 }));
    schedule(.15, () => {
      bank.playSkillSound(gravity, 'sustain', { castId: 'loop', remaining: .9, pan: .8, distance: 10 });
      check(bank.getState().playedByCue.skillGravityLoop === 1 && bank.getState().loopRefreshes === 1, 'Refresh updates single persistent voice without restart');
    });
    schedule(.25, () => {
      bank.update({ muted: true });
      bank.playSkillSound(gravity, 'end', { castId: 'loop', ageMs: 5000 });
      check(bank.getState().activeSkillLoops.length === 0, 'Stale end still closes a muted loop');
    });
    schedule(.35, () => {
      bank.update({ muted: false });
      bank.playSkillSound(gravity, 'sustain', { castId: 'loop', remaining: 5 });
      check(bank.getState().activeSkillLoops.length === 0 && bank.getState().skillSuppressed.ended === 1, 'Late sustain cannot resurrect an ended field');
    });
    schedule(.45, () => bank.playSkillSound(buff, 'sustain', { castId: 'auto', remaining: .3 }));
    schedule(.9, () => check(bank.getState().activeSkillLoops.length === 0, 'Loop auto-expires even without an end packet'));
    schedule(1.0, () => bank.playSkillSound(gravity, 'sustain', { castId: 'cancel', remaining: 3 }));
    schedule(1.1, () => {
      bank.playSkillSound(gravity, 'cancel', { castId: 'cancel' });
      check(bank.getState().activeSkillLoops.length === 0 && !bank.getState().playedByCue.skillGravityCollapse, 'Cancel ends field silently');
    });
    schedule(1.3, () => bank.playSkillSound(buff, 'sustain', { castId: 'paused', remaining: 3 }));
    schedule(1.4, () => {
      bank.update({ paused: true });
      check(bank.getState().activeSkillLoops.length === 0, 'Pause clears persistent voices');
    });
    schedule(1.6, () => {
      bank.update({ paused: false });
      check(bank.getState().activeSkillLoops.length === 0, 'Unpause alone does not replay a loop');
      bank.playSkillSound(buff, 'sustain', { castId: 'paused', remaining: .3 });
      check(bank.getState().activeSkillLoops.length === 1, 'Authoritative remaining snapshot can restore an active aura');
    });
    schedule(2.0, () => bank.playSkillSound(gravity, 'sustain', { castId: 'budget1', remaining: 1.5 }));
    schedule(2.1, () => bank.playSkillSound(gravity, 'sustain', { castId: 'budget2', remaining: 1.5 }));
    schedule(2.2, () => bank.playSkillSound(buff, 'sustain', { castId: 'budget3', remaining: 1.5 }));
    schedule(2.3, () => {
      bank.playSkillSound(buff, 'sustain', { castId: 'budget4', remaining: 1.5 });
      check(bank.getState().activeSkillLoops.length === 3 && bank.getState().skillSuppressed.loopBudget === 1, 'Persistent voice budget caps three fields/auras');
    });
    schedule(2.5, () => {
      bank.reset();
      check(bank.getState().activeSkillLoops.length === 0 && bank.getState().activeVoices === 0, 'Death/run reset clears all loops and voices');
    });
    schedule(2.7, () => {
      bank.playSkillSound(gravity, 'sustain', { castId: 'zero', remaining: 0 });
      check(bank.getState().activeSkillLoops.length === 0, 'Expired snapshot cannot start a field');
      bank.playSkillSound(gravity, 'sustain', { remaining: 2 });
      check(bank.getState().activeSkillLoops.length === 0 && bank.getState().skillSuppressed.missingCastId === 1, 'Persistent voices require a stable cast identity');
    });
    schedule(2.9, () => bank.playSkillSound(gravity, 'sustain', { castId: 'naturalEnd', remaining: 2 }));
    schedule(3.1, () => {
      bank.playSkillSound(gravity, 'end', { castId: 'naturalEnd' });
      bank.playSkillSound(gravity, 'end', { castId: 'naturalEnd' });
      check(bank.getState().activeSkillLoops.length === 0 && bank.getState().playedByCue.skillGravityCollapse === 1, 'Natural field end closes loop and emits one collapse only');
    });
    schedule(4, () => { bank.dispose(); bank.dispose(); check(bank.getState().activeVoices === 0, 'Dispose is idempotent with persistent voices'); });
    const rendered = await context.startRendering(); await Promise.all(jobs);
    let peak = 0, quietPeak = 0;
    for (let channel = 0; channel < 2; channel++) for (let i = 0; i < rendered.length; i++) {
      const value = Math.abs(rendered.getChannelData(channel)[i]); peak = Math.max(peak, value);
      if (i >= 4.1 * rendered.sampleRate) quietPeak = Math.max(quietPeak, value);
    }
    check(peak > .001 && peak < .99 && quietPeak === 0, 'Native loop output is non-silent, unclipped and ends in exact silence');
    return { checks, snapshots, measurement: { peak, quietPeak, durationSeconds: rendered.duration } };
  });
  assert.deepEqual(errors, []); assert.deepEqual(fingerprint(), before);
  fs.writeFileSync(path.join(evidenceDir, 'arpg-loop-lifecycle.json'), `${JSON.stringify({ ok: true, syntheticFixture: true, nativeAudio: true, sourceChanged: false, sourceHashes: before, browser: browser.version(), ...result }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, evidenceDir, checks: result.checks.length, ...result.measurement }));
} finally { await browser.close(); await server.close(); }
