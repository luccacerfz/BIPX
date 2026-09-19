import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, evidenceDir, attachQualityTelemetry, waitForRuntimeAssets } from './quality-browser.mjs';

const baseUrl = await suiteUrl('/?offline=1');
const browser = await chromium.launch(browserLaunchOptions);
const expected = {
  warrior: ['warrior_war_cry', 'warrior_cleaving_dash', 'warrior_shield_charge'],
  dwarf: ['dwarf_explosive_cannon', 'dwarf_frost_shot', 'dwarf_gravity_shot'],
};
const audioHashes = () => {
  const manifest = JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json'));
  return Object.fromEntries(['src/audio/sample-bank.js', 'src/audio/skill-sounds.js', 'assets/audio/processed/manifest.json',
    ...Object.values(manifest.cues).map(cue => `assets/audio/processed/${cue.file}`)].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
};
const before = audioHashes(), results = [];
try {
  for (const classId of Object.keys(expected)) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage(), telemetry = attachQualityTelemetry(page, `arpg-audio-gameplay-${classId}`);
    let details = {};
    try {
      await page.addInitScript(() => {
        const NativeContext = window.AudioContext;
        window.AudioContext = class extends NativeContext {
          createDynamicsCompressor() {
            const compressor = super.createDynamicsCompressor();
            window.__sfxCapture = { context: this, compressor, chunks: [], timeline: [] };
            return compressor;
          }
        };
      });
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${classId}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      await page.waitForFunction(() => window.__zombieNightDebug.getAudioState().samples?.loaded);
      const unlocked = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
      assert(unlocked.unlocked && unlocked.contextState === 'running', 'Pointer gesture must unlock AudioContext');
      assert.equal(unlocked.samples.loadedCues.length, Object.keys(JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json')).cues).length);
      await page.evaluate(() => {
        const capture = window.__sfxCapture;
        capture.tap = capture.context.createScriptProcessor(2048, 2, 2);
        capture.sink = capture.context.createGain(); capture.sink.gain.value = 0;
        capture.compressor.connect(capture.tap); capture.tap.connect(capture.sink); capture.sink.connect(capture.context.destination);
        capture.tap.onaudioprocess = event => {
          const left = event.inputBuffer.getChannelData(0), right = event.inputBuffer.getChannelData(1), chunk = new Float32Array(left.length * 2);
          for (let i = 0; i < left.length; i++) { chunk[i * 2] = left[i]; chunk[i * 2 + 1] = right[i]; }
          capture.chunks.push(chunk);
        };
      });
      await page.locator('#player-name').fill(`QA SFX ${classId}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      const currentIds = await page.evaluate(() => window.__zombieNightDebug.getArpgState().skills.map(skill => skill.id));
      assert.deepEqual(currentIds, expected[classId], 'Gameplay still uses a different skill contract; this verifier requires v2');
      await page.locator('[data-arpg-slot="0"][data-state="ready"]').waitFor({ state: 'visible' });
      await page.mouse.move(830, 355);
      const observedEvents = [];
      for (let slot = 0; slot < 3; slot++) {
        await page.evaluate(slot => window.__sfxCapture.timeline.push({ event: `native key ${slot + 1}`, at: window.__sfxCapture.context.currentTime }), slot);
        await page.keyboard.press(String(slot + 1));
        await page.waitForFunction(id => window.__zombieNightDebug.getAudioState().samples.skillPlayedByPhase[`${id}:cast`] >= 1, expected[classId][slot]);
        await page.waitForTimeout(slot === 2 ? 1500 : 1050);
        observedEvents.push(...await page.evaluate(() => window.__zombieNightDebug.getSkillEvents()));
      }
      await page.keyboard.press('3'); // Genuine refused input while still cooling down.
      await page.waitForTimeout(200);
      await page.mouse.down(); await page.keyboard.down('d');
      await page.waitForTimeout(2000); await page.keyboard.up('d');
      await page.keyboard.down('w'); await page.waitForTimeout(2000); await page.keyboard.up('w');
      await page.mouse.up();
      const skills = await page.evaluate(() => ({ audio: window.__zombieNightDebug.getAudioState(), state: window.__zombieNightDebug.getState(), events: window.__zombieNightDebug.getSkillEvents() }));
      observedEvents.push(...skills.events);
      skills.observedImpactCoverage = {};
      for (const id of expected[classId]) {
        assert(skills.audio.samples.skillPlayedByPhase[`${id}:cast`] >= 1, `${id} cast missing`);
        const confirmedImpact = observedEvents.some(event => event.skillId === id && event.phase === 'impact');
        if (confirmedImpact) assert(skills.audio.samples.skillPlayedByPhase[`${id}:impact`] >= 1, `${id} confirmed impact missing its sound`);
        skills.observedImpactCoverage[id] = confirmedImpact ? 'confirmed impact and sound' : 'no impact observed in this natural run; native signal fixture only';
        assert(skills.audio.samples.skillPlayedByPhase[`${id}:release`] >= 1, `${id} execution/release missing`);
      }
      assert(skills.audio.samples.playedByCue[classId === 'warrior' ? 'katana' : 'pistol'] > 0, 'Natural basic attack audio missing');
      assert(skills.audio.samples.playedByCue.skillReady > 0, 'Cooldown transition ready cue missing');
      assert(skills.audio.samples.playedByCue.skillResourceFail > 0, 'Natural refused skill input produced no unavailable cue');
      await telemetry.capture('six-skill-contract');
      await page.locator('#pause-button').click();
      await page.waitForTimeout(1800);
      const paused = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
      assert(paused.samples.ambienceGain < .003);
      await page.locator('#sound-toggle').uncheck();
      await page.waitForTimeout(650);
      const capture = await page.evaluate(() => {
        const capture = window.__sfxCapture;
        capture.tap.onaudioprocess = null; capture.tap.disconnect(); capture.sink.disconnect();
        const pcm = new Float32Array(capture.chunks.reduce((count, chunk) => count + chunk.length, 0));
        let offset = 0; for (const chunk of capture.chunks) { pcm.set(chunk, offset); offset += chunk.length; }
        let binary = ''; const bytes = new Uint8Array(pcm.buffer);
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return { pcmBase64: btoa(binary), rate: capture.context.sampleRate, timeline: capture.timeline, state: window.__zombieNightDebug.getAudioState() };
      });
      const pcm = Buffer.from(capture.pcmBase64, 'base64'); delete capture.pcmBase64;
      const wav = Buffer.alloc(44 + pcm.length / 2); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(capture.rate, 24);
      wav.writeUInt32LE(capture.rate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
      let peak = 0, mutedTailPeak = 0;
      for (let i = 0; i < pcm.length; i += 4) {
        const value = pcm.readFloatLE(i); peak = Math.max(peak, Math.abs(value));
        if (i >= pcm.length - capture.rate * 8 * .25) mutedTailPeak = Math.max(mutedTailPeak, Math.abs(value));
        wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i / 2);
      }
      const file = `arpg-gameplay-${classId}.wav`; fs.writeFileSync(path.join(evidenceDir, file), wav);
      assert(peak > .01 && peak < .99, 'Captured gameplay signal must be audible and unclipped');
      assert(mutedTailPeak < .001 && capture.state.muted, 'Mute must silence actual output');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForRuntimeAssets(page, telemetry);
      const persisted = await page.evaluate(() => window.__zombieNightDebug.getAudioState().muted);
      assert(persisted, 'Mute must persist after reload');
      details = { classId, unlocked, skills, paused, output: { file, peak, mutedTailPeak, durationSeconds: pcm.length / 8 / capture.rate, sha256: crypto.createHash('sha256').update(wav).digest('hex') },
        timeline: capture.timeline, persisted, sourceAudioHashes: before, audioChangedDuringRun: JSON.stringify(before) !== JSON.stringify(audioHashes()),
        scope: 'Natural UI selection and pointer/keyboard gameplay. No gameplay-state mutation, no debug sound trigger. Read-only debug observation plus silent final-compressor capture tap.',
        perceptualListening: 'pending; captured output is not a listening claim', physicalDevice: 'pending' };
      assert(!details.audioChangedDuringRun, 'Audio changed during gameplay capture');
      telemetry.assertClean();
    } catch (error) { telemetry.fail(error); process.exitCode = 1; }
    finally {
      await telemetry.save(details); results.push({ classId, status: telemetry.report.assertions, sourceChanged: telemetry.report.sourceChangedDuringRun, failure: telemetry.report.failure });
      await context.close();
    }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ evidenceDir, results }, null, 2));
