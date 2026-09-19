// Executes the literal staging viewer with a no-op renderer and deterministic RAF.
// This is a CPU fixture test, never native playback evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../src/assets/vendor/GLTFLoader.js';
import {copyBruteAttack} from '../output/brute-motion-v4/attack-profile-adapter.mjs';
globalThis.ProgressEvent ??= class ProgressEvent extends Event {};
const base = 'output/brute-motion-v4';
function stripImages(bytes) {
  const length = bytes.readUInt32LE(12), j = JSON.parse(bytes.subarray(20, 20 + length));
  const bin = bytes.subarray(28 + length);
  for (const m of j.materials || []) {
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
    if (m.pbrMetallicRoughness) {delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture;}
  }
  delete j.images; delete j.textures; delete j.samplers;
  let text = Buffer.from(JSON.stringify(j)); text = Buffer.concat([text, Buffer.alloc((-text.length) & 3, 32)]);
  const head = Buffer.alloc(20), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + text.length + bin.length, 8); head.writeUInt32LE(text.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4);
  const b = Buffer.concat([head, text, bh, bin]); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
class Loader {async loadAsync(url) {return new GLTFLoader().parseAsync(stripImages(fs.readFileSync(`.${url}`)), '');}}
class Renderer {setSize(){} setPixelRatio(){} render(){} domElement = {};}
let now = 0, next, id = 0;
const window = {}, document = {body: {append(){}}, querySelector() {return {textContent: ''};}};
const html = fs.readFileSync('tools/brute-motion-review.html', 'utf8');
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/mg, '');
const setup = new (Object.getPrototypeOf(async function(){}).constructor)(
  'THREE', 'GLTFLoader', 'copyBruteAttack', 'window', 'document', 'fetch', 'innerWidth', 'innerHeight', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', source);
await setup({...THREE, WebGLRenderer: Renderer}, Loader, copyBruteAttack, window, document,
  async url => ({json: async () => JSON.parse(fs.readFileSync(`.${url}`))}), 1440, 900,
  {now: () => now}, fn => {next = fn; return ++id;}, () => {next = null;});
const results = [];
for (const timing of ['caller', 'source']) {
  window.bruteReview.play(timing); const bounds = [];
  for (let i = 0; window.bruteReview.playing && i < 250; i++) {
    now += 1000 / 60; const tick = next; next = null; tick(now);
    bounds.push(window.bruteReview.snapshot(true)[0]);
  }
  assert(!window.bruteReview.playing);
  const frames = window.bruteReview.frames;
  const attack = frames.filter(f => f.actors[0].mode === 'Attack');
  const recovery = frames.find(f => f.actors[0].mode === 'recovery');
  const duration = timing === 'caller' ? .55 : 2.5;
  assert(attack.length > 20); assert(recovery.time >= duration && recovery.time <= duration + 1 / 60 + 1e-9);
  assert(frames.every(f => Math.abs(f.wallTime - f.time - .3) < 1e-9));
  assert(bounds.every(b => [b.minY, ...b.size, ...b.hand, ...b.head].every(Number.isFinite)));
  const floorGate = bounds.every(b => Math.abs(b.minY) < .012);
  results.push({timing, floorGate, floorToleranceMeters: .012, frameCount: frames.length, firstAttackTime: attack[0].time,
    firstRecoveryTime: recovery.time, minY: Math.min(...bounds.map(b => b.minY)),
    maxMinY: Math.max(...bounds.map(b => b.minY)), first: bounds[0], last: bounds.at(-1), frames, bounds});
}
const report = {at: new Date().toISOString(), scope: 'CPU execution of viewer/mixer; fake renderer/deterministic RAF; NOT native playback', timingAndFinitePassed: true, floorGatePassed: results.every(r => r.floorGate), results};
fs.writeFileSync(`${base}/playback-cpu-${report.at.replace(/[:.]/g, '-')}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({...report, results: results.map(({frames,bounds,...r}) => r)}, null, 2));
