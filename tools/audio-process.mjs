import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Reproducible derivatives only. Provider originals and their manifest stay untouched.
const directory = path.resolve('assets/audio');
const output = path.join(directory, 'processed');
const source = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
const rate = 44100;
const channels = 2;
fs.mkdirSync(output, { recursive: true });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const db = (value) => Number((20 * Math.log10(Math.max(value, 1e-12))).toFixed(3));
const round = (value) => Number(value.toFixed(6));
function ffmpeg(args, input) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  return result.stdout;
}
function decode(file, filter) {
  const bytes = ffmpeg(['-i', file, ...(filter ? ['-af', filter] : []), '-ar', `${rate}`, '-ac', `${channels}`, '-f', 'f32le', 'pipe:1']);
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
function measure(samples) {
  let peak = 0, energy = 0, railSamples = 0;
  const windows = [];
  const windowSamples = Math.round(rate * .01) * channels;
  for (let start = 0; start < samples.length; start += windowSamples) {
    let sum = 0;
    const end = Math.min(start + windowSamples, samples.length);
    for (let i = start; i < end; i++) {
      const value = samples[i];
      peak = Math.max(peak, Math.abs(value));
      sum += value * value;
      if (Math.abs(value) >= .999) railSamples++;
    }
    energy += sum;
    windows.push({ start, end, rms: Math.sqrt(sum / (end - start)) });
  }
  const maximumWindow = Math.max(...windows.map(window => window.rms));
  const active = windows.filter(window => window.rms > maximumWindow * .0316228);
  const activeCount = active.reduce((sum, window) => sum + window.end - window.start, 0);
  const activeEnergy = active.reduce((sum, window) => sum + window.rms ** 2 * (window.end - window.start), 0);
  let jump = 0;
  for (let channel = 0; channel < channels; channel++) jump = Math.max(jump, Math.abs(samples[channel] - samples[samples.length - channels + channel]));
  return {
    durationSeconds: round(samples.length / channels / rate), peakDbFS: db(peak), rmsDbFS: db(Math.sqrt(energy / samples.length)),
    activeRmsDbFS: db(Math.sqrt(activeEnergy / Math.max(activeCount, 1))), railSamples,
    loopBoundaryJumpDbFS: db(jump), firstActiveSeconds: round((active[0]?.start ?? 0) / channels / rate),
    lastActiveSeconds: round((active.at(-1)?.end ?? samples.length) / channels / rate),
  };
}
function fadeEdges(samples, attackSeconds, releaseSeconds) {
  const frames = samples.length / channels;
  const attack = Math.round(attackSeconds * rate), release = Math.round(releaseSeconds * rate);
  for (let frame = 0; frame < frames; frame++) {
    const gain = Math.min(1, frame / Math.max(attack, 1), (frames - 1 - frame) / Math.max(release, 1));
    for (let channel = 0; channel < channels; channel++) samples[frame * channels + channel] *= gain;
  }
}
function wrapCrossfade(samples, seconds) {
  const overlap = Math.round(seconds * rate) * channels;
  const wrapped = new Float32Array(samples.length - overlap);
  wrapped.set(samples.subarray(overlap, samples.length - overlap));
  const start = samples.length - overlap * 2;
  for (let frame = 0; frame < overlap / channels; frame++) {
    // Equal-gain avoids a 3 dB swell for correlated wind beds.
    const blend = .5 - .5 * Math.cos(Math.PI * frame / (overlap / channels - 1));
    for (let channel = 0; channel < channels; channel++) {
      const index = frame * channels + channel;
      wrapped[start + index] = samples[samples.length - overlap + index] * (1 - blend) + samples[index] * blend;
    }
  }
  // Two milliseconds suppress codec boundary residuals without an audible long fade.
  fadeEdges(wrapped, .002, .002);
  return wrapped;
}
const manifest = {
  provider: source.provider, model: source.model, sourceManifestSha256: hash(fs.readFileSync(path.join(directory, 'manifest.json'))),
  processing: { version: 1, command: 'node tools/audio-process.mjs', sampleRate: rate, channels, highpassHz: 35,
    normalization: 'active 10 ms RMS, capped by sample peak; no destructive limiting', sfxTargetActiveRmsDbFS: -16,
    sfxPeakCeilingDbFS: -3, ambienceTargetActiveRmsDbFS: -24, ambiencePeakCeilingDbFS: -8,
    ambienceCrossfadeSeconds: .6, codec: 'libmp3lame 192 kbps with encoder-delay metadata' },
  cues: {},
};
for (const [id, cue] of Object.entries(source.cues)) {
  const originalFile = path.join(directory, cue.file);
  const originalBytes = fs.readFileSync(originalFile);
  if (hash(originalBytes) !== cue.sha256) throw new Error(`${id}: provider provenance hash mismatch`);
  const originalMeasurement = measure(decode(originalFile));
  let samples = decode(originalFile, 'highpass=f=35');
  const filtered = measure(samples);
  let trimmedStartSeconds = 0, trimmedEndSeconds = 0;
  if (cue.loop) samples = wrapCrossfade(samples, .6);
  else {
    const start = Math.max(0, Math.floor((filtered.firstActiveSeconds - .008) * rate)) * channels;
    const end = Math.min(samples.length, Math.ceil((filtered.lastActiveSeconds + .07) * rate) * channels);
    trimmedStartSeconds = round(start / channels / rate);
    trimmedEndSeconds = round((samples.length - end) / channels / rate);
    samples = samples.slice(start, end);
    fadeEdges(samples, .001, .016);
  }
  const prepared = measure(samples);
  const target = cue.loop ? -24 : -16;
  const ceiling = cue.loop ? -8 : -3;
  const gainDb = Math.min(target - prepared.activeRmsDbFS, ceiling - prepared.peakDbFS, 24);
  const gain = 10 ** (gainDb / 20);
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  const pcm = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const encode = (file, codec) => ffmpeg(['-y', '-f', 'f32le', '-ar', `${rate}`, '-ac', `${channels}`, '-i', 'pipe:0', '-map_metadata', '-1', ...codec, path.join(output, file)], pcm);
  const mp3 = `${id}.mp3`;
  encode(mp3, ['-c:a', 'libmp3lame', '-b:a', '192k']);
  const file = mp3;
  const measurement = measure(decode(path.join(output, file)));
  // These are signal safety/packaging checks, not a perceptual quality score.
  if (measurement.peakDbFS > -1 || measurement.railSamples !== 0) throw new Error(`${id}: encoded peak headroom failed`);
  if (measurement.activeRmsDbFS < -32) throw new Error(`${id}: encoded active signal is too quiet`);
  if (cue.loop && measurement.loopBoundaryJumpDbFS > -50) throw new Error(`${id}: encoded loop discontinuity`);
  const bytes = fs.readFileSync(path.join(output, file));
  manifest.cues[id] = {
    file,
    loop: cue.loop, sourceFile: `../${cue.file}`, sourceSha256: cue.sha256, sha256: hash(bytes), bytes: bytes.length,
    gainDb: round(gainDb), trimmedStartSeconds, trimmedEndSeconds, originalMeasurement, measurement,
  };
  console.log(`${id}: ${originalMeasurement.activeRmsDbFS} -> ${measurement.activeRmsDbFS} dBFS active RMS; peak ${measurement.peakDbFS} dBFS; gain ${gainDb.toFixed(2)} dB`);
}
fs.writeFileSync(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Processed ${Object.keys(manifest.cues).length} cues; raw provider originals preserved.`);
