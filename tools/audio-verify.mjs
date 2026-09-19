import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, browserLaunchOptions, attachQualityTelemetry, evidenceDir, waitForRuntimeAssets } from './quality-browser.mjs';

const baseUrl = await suiteUrl('/?offline=1');
const browser = await chromium.launch(browserLaunchOptions);
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const telemetry = attachQualityTelemetry(page, 'audio-runtime');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const hashes = () => Object.fromEntries(['src/audio/sample-bank.js', 'src/audio/skill-sounds.js', 'assets/audio/processed/manifest.json', ...fs.readdirSync('assets/audio/processed').filter(file => file.endsWith('.mp3')).map(file => `assets/audio/processed/${file}`)]
  .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const startedHashes = hashes();
let details = {};
try {
  // Observe the existing final compressor without changing the production audio signal.
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    window.AudioContext = class ObservedAudioContext extends NativeContext {
      createDynamicsCompressor() {
        const compressor = super.createDynamicsCompressor();
        const analyser = super.createAnalyser(); analyser.fftSize = 2048;
        compressor.connect(analyser);
        window.__audioObservation = { context: this, analyser, pcm: [], peaks: [], timeline: [] };
        return compressor;
      }
    };
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitForRuntimeAssets(page, telemetry);
  await page.locator('#open-login-button').click();
  await page.locator('label[for="character-dwarf"]').click();
  await waitForRuntimeAssets(page, telemetry);
  await page.waitForFunction(() => window.__zombieNightDebug.getAudioState().samples?.loaded);
  const unlocked = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
  assert(unlocked.unlocked && unlocked.contextState === 'running', 'Genuine pointer gesture did not unlock audio');
  const expectedCues = Object.keys(JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json')).cues);
  assert(expectedCues.every(id => unlocked.samples.loadedCues.includes(id)) && unlocked.samples.processed, 'Processed bank did not decode every manifest cue');
  assert(unlocked.samples.errors.length === 0 && unlocked.samples.fallbackReasons.length === 0, 'Audio load/decode used a fallback or failed');
  await page.evaluate(() => {
    const observation = window.__audioObservation;
    // Test-only PCM tap avoids container/codec loss. Production does not use ScriptProcessor.
    observation.tap = observation.context.createScriptProcessor(2048, 2, 2);
    const silentSink = observation.context.createGain(); silentSink.gain.value = 0;
    observation.analyser.connect(observation.tap); observation.tap.connect(silentSink); silentSink.connect(observation.context.destination);
    observation.tap.onaudioprocess = event => {
      const left = event.inputBuffer.getChannelData(0), right = event.inputBuffer.getChannelData(1);
      const interleaved = new Float32Array(left.length * 2);
      for (let frame = 0; frame < left.length; frame++) { interleaved[frame * 2] = left[frame]; interleaved[frame * 2 + 1] = right[frame]; }
      observation.pcm.push(interleaved);
    };
    const data = new Float32Array(observation.analyser.fftSize);
    observation.timer = setInterval(() => {
      observation.analyser.getFloatTimeDomainData(data);
      let peak = 0, sum = 0;
      for (const value of data) { peak = Math.max(peak, Math.abs(value)); sum += value * value; }
      observation.peaks.push({ time: observation.context.currentTime, peak, rms: Math.sqrt(sum / data.length) });
    }, 20);
    observation.timeline.push({ event: 'capture start before separately labelled cue audition', at: observation.context.currentTime });
  });
  // Separate artificial cue audition from genuine combat; no debug playback is claimed as gameplay.
  telemetry.markFixture();
  const cueResults = [];
  const manifest = JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json', 'utf8'));
  for (const id of Object.keys(manifest.cues).filter(id => id !== 'nightAmbience')) {
    await page.evaluate(id => {
      window.__audioObservation.timeline.push({ event: `debug cue audition: ${id}`, at: window.__audioObservation.context.currentTime });
      window.__zombieNightDebug.playTestSound(id);
      // Exercise a live combat bus during ducking; idle AudioParam values are not a rendered signal measurement.
      if (id === 'bossSpawn') window.__zombieNightDebug.playTestSound('pistol');
    }, id);
    await page.waitForTimeout(id === 'bossSpawn' ? 450 : 150);
    const state = await page.evaluate(() => window.__zombieNightDebug.getAudioState().samples);
    assert(state.playedByCue[id] > 0, `${id}: runtime voice was never started`);
    if (id === 'bossSpawn') assert(state.ducking && state.combatGain < .6, `Boss priority did not duck combat: ${JSON.stringify(state)}`);
    cueResults.push({ id, plays: state.playedByCue[id], activeVoices: state.activeVoices, ducking: state.ducking });
    await page.waitForTimeout(Math.max(180, manifest.cues[id].measurement.durationSeconds * 1000 - 150));
  }
  const pistolBefore = await page.evaluate(() => window.__zombieNightDebug.getAudioState().samples.playedByCue.pistol);
  await page.evaluate(() => window.__audioObservation.timeline.push({ event: 'natural login and pointer/keyboard combat', at: window.__audioObservation.context.currentTime }));
  await page.locator('#player-name').fill('QA Audio');
  await page.locator('#play-button').click();
  await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
  await page.mouse.move(850, 400);
  await page.mouse.down();
  await page.keyboard.down('w');
  await page.waitForTimeout(3500);
  await page.mouse.up(); await page.keyboard.up('w');
  const natural = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
  assert(natural.samples.playedByCue.pistol > pistolBefore, 'Natural pointer combat did not play a provider pistol cue');
  assert(natural.samples.ambienceActive && natural.samples.playedByCue.nightAmbience === 1, 'Ambience loop did not start');
  await page.locator('#pause-button').click();
  await page.waitForTimeout(1700);
  const paused = await page.evaluate(() => window.__zombieNightDebug.getAudioState().samples);
  assert(paused.ambienceGain < .003, 'Pause did not fade the ambience');
  await page.locator('#sound-toggle').uncheck();
  await page.waitForTimeout(500);
  const muted = await page.evaluate(() => ({ state: window.__zombieNightDebug.getAudioState(), tail: window.__audioObservation.peaks.slice(-10) }));
  assert(muted.state.muted && muted.tail.every(frame => frame.peak < .001), 'Mute did not silence actual rendered output');
  const captured = await page.evaluate(() => {
    const observation = window.__audioObservation;
    clearInterval(observation.timer);
    observation.tap.disconnect(); observation.tap.onaudioprocess = null;
    const pcm = new Float32Array(observation.pcm.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0; for (const chunk of observation.pcm) { pcm.set(chunk, offset); offset += chunk.length; }
    const bytes = new Uint8Array(pcm.buffer);
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    return { pcmBase64: btoa(binary), sampleRate: observation.context.sampleRate, peaks: observation.peaks, timeline: observation.timeline };
  });
  const pcm = Buffer.from(captured.pcmBase64, 'base64');
  const wave = Buffer.alloc(44 + pcm.length / 2);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(2, 22);
  wave.writeUInt32LE(captured.sampleRate, 24); wave.writeUInt32LE(captured.sampleRate * 4, 28);
  wave.writeUInt16LE(4, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
  let capturedPeak = 0;
  for (let offset = 0; offset < pcm.length; offset += 4) {
    const value = pcm.readFloatLE(offset); capturedPeak = Math.max(capturedPeak, Math.abs(value));
    wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + offset / 2);
  }
  fs.writeFileSync(path.join(evidenceDir, 'audio-runtime-output.wav'), wave);
  assert(capturedPeak > .01 && capturedPeak < .99, 'Full PCM capture is silent or reaches clipping range');
  const maxPeak = Math.max(...captured.peaks.map(frame => frame.peak));
  assert(maxPeak > .01 && maxPeak < .99, 'Captured output is silent or reaches clipping range');
  const decoded = await page.evaluate(async () => {
    const manifest = await (await fetch('./assets/audio/processed/manifest.json')).json();
    const metrics = {};
    for (const [id, cue] of Object.entries(manifest.cues)) {
      const buffer = await window.__audioObservation.context.decodeAudioData(await (await fetch(`./assets/audio/processed/${cue.file}`)).arrayBuffer());
      let peak = 0, jump = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const samples = buffer.getChannelData(channel);
        for (const value of samples) peak = Math.max(peak, Math.abs(value));
        jump = Math.max(jump, Math.abs(samples[0] - samples.at(-1)));
      }
      metrics[id] = { duration: buffer.duration, sampleRate: buffer.sampleRate, peakDbFS: 20 * Math.log10(Math.max(peak, 1e-12)), loopJumpDbFS: 20 * Math.log10(Math.max(jump, 1e-12)) };
    }
    return metrics;
  });
  assert(decoded.nightAmbience.loopJumpDbFS < -50, 'Chrome decoded ambience boundary exceeds signal threshold');
  assert(Object.values(decoded).every(cue => cue.peakDbFS < -1), 'Chrome decoded a clipped processed cue');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForRuntimeAssets(page, telemetry);
  const persisted = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
  assert(persisted.muted, 'Mute preference did not persist');
  details = { unlocked, naturalCombat: natural, debugCueAudition: cueResults, paused, muted: muted.state, persisted,
    output: { file: 'audio-runtime-output.wav', capture: 'Actual final compressor PCM; test-only silent tap', durationSeconds: pcm.length / 8 / captured.sampleRate,
      capturedPeakDbFS: 20 * Math.log10(capturedPeak), maximumObservedPeakDbFS: 20 * Math.log10(maxPeak), observations: captured.peaks, timeline: captured.timeline },
    decoded, audioHashes: startedHashes, audioChangedDuringRun: JSON.stringify(startedHashes) !== JSON.stringify(hashes()),
    scope: 'Natural gesture unlock; separately labelled debug cue audition; then natural login/pistol combat and mute/pause. Actual audio graph capture. No perceptual listening claim.',
    perceptualListening: 'pending', hardwareListening: 'pending' };
  assert(!details.audioChangedDuringRun, 'Audio candidate changed during verification');
  telemetry.assertClean();
} catch (error) {
  telemetry.fail(error); process.exitCode = 1;
} finally {
  await telemetry.save(details);
  console.log(JSON.stringify({ status: telemetry.report.assertions, failure: telemetry.report.failure, evidenceDir }, null, 2));
  await browser.close();
}
