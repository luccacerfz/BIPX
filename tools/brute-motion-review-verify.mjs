// Bounded structural/pose audit. No browser, runtime writes, or artistic score.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {copyBruteAttack, describeBruteAttack} from '../output/brute-motion-v4/attack-profile-adapter.mjs';
import {getMeleeTiming} from '../src/combat/melee-timing.mjs';
const base = 'output/brute-motion-v4';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
function glb(file) {
  const bytes = fs.readFileSync(file), length = bytes.readUInt32LE(12);
  return {json: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length), bytes};
}
function values(g, index) {
  const a = g.json.accessors[index], b = g.json.bufferViews[a.bufferView];
  assert.equal(a.componentType, 5126);
  const width = {SCALAR: 1, VEC3: 3, VEC4: 4}[a.type];
  const start = (b.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({length: a.count * width}, (_, i) => g.bin.readFloatLE(start + i * 4));
}
const provenance = read(`${base}/provenance.json`), baseline = glb(`${base}/source/brute-baseline.glb`);
const report = {at: new Date().toISOString(), scope: 'CPU staging only; no artistic/native/authority approval', checks: [], candidates: []};
function check(name, run) {run(); report.checks.push({name, passed: true});}
for (const [i, name] of ['swipe', 'frontal'].entries()) {
  const g = glb(`${base}/${name}/brute.glb`), profile = read(`${base}/attack-profiles.json`)[i];
  check(`${name}: source geometry, skin, binds, hierarchy, textures and four clips`, () => {
    for (const key of ['nodes', 'skins', 'meshes', 'materials', 'images', 'textures', 'samplers']) assert.deepEqual(g.json[key], baseline.json[key]);
    for (const j of [0, 1, 2, 4]) assert.deepEqual(g.json.animations[j], baseline.json.animations[j]);
    assert(g.bin.subarray(0, baseline.bin.length).equals(baseline.bin));
    assert.equal(hash(g.bytes), profile.artifactSha256);
  });
  const tracks = g.json.animations[3].channels.map(c => {
    const s = g.json.animations[3].samplers[c.sampler], node = g.json.nodes[c.target.node];
    const type = c.target.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    return new type(`${node.name}.${c.target.path === 'rotation' ? 'quaternion' : 'position'}`, values(g, s.input), values(g, s.output));
  });
  const clip = new THREE.AnimationClip('Attack', profile.sourceDuration, tracks);
  check(`${name}: finite normalized transforms and both leg chains animated`, () => {
    for (const track of tracks) {
      assert([...track.times, ...track.values].every(Number.isFinite));
      if (!track.name.endsWith('.quaternion')) continue;
      for (let j = 0; j < track.values.length; j += 4) assert(Math.abs(Math.hypot(...track.values.slice(j, j + 4)) - 1) < 1e-6);
    }
    for (const side of ['L', 'R']) for (const part of ['Thigh', 'Calf', 'Foot']) {
      const track = tracks.find(t => t.name === `${side}_${part}.quaternion`);
      assert(track && Array.from(track.values).some((x, j) => Math.abs(x - track.values[j % 4]) > .01));
    }
  });
  check(`${name}: complete pose variation and independent full-take adapter`, () => {
    const poses = read(`${base}/${name}/cpu-poses.json`).poses;
    assert(new Set(poses.map(p => hash(JSON.stringify(p.positions)))).size >= 5);
    const source = {animations: [null, null, null, clip], scene: {userData: g.json.scenes[0].extras}};
    const copied = copyBruteAttack(source, profile);
    assert.notEqual(copied, clip); assert.equal(copied.duration, profile.sourceDuration);
    copied.tracks[0].values[0] += .25; assert.notEqual(copied.tracks[0].values[0], clip.tracks[0].values[0]);
    assert.throws(() => copyBruteAttack(source, {...profile, id: 'walker'}));
  });
  report.candidates.push({name, sha256: hash(g.bytes), timing: describeBruteAttack(profile), poses: 7});
}
check('Brute authority remains immediate, visual duration fits caller cadence', () => {
  assert.equal(getMeleeTiming('brute'), null);
  for (const c of report.candidates) {
    assert.equal(c.timing.duration, .55);
    assert(c.timing.duration < .62 && c.timing.proposedImpactAt > 0);
    assert.equal(c.timing.synchronizedWithCurrentAuthority, false);
  }
});
check('All registered originals, Lich delivery and historical sources preserved', () => {
  for (const [file, expected] of Object.entries({...provenance.preservedHashes, ...provenance.historicalSources})) assert.equal(hash(fs.readFileSync(file)), expected, file);
  for (const source of provenance.inventory) assert.equal(hash(fs.readFileSync(source.path)), source.sha256, source.path);
});
report.passed = true;
report.preservedCount = Object.keys(provenance.preservedHashes).length + Object.keys(provenance.historicalSources).length + provenance.inventory.length;
fs.writeFileSync(`${base}/cpu-verification-${report.at.replace(/[:.]/g, '-')}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
