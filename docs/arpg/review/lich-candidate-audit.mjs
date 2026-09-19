// Read-only asset/loader compatibility audit; does not install the staged GLB.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));
const paths = {
  baseline: '/tmp/bipx-caster-motion/source/lich-baseline.glb',
  candidate: '/tmp/bipx-caster-motion/lich/artifacts/monster-gesture.glb',
  runtime: 'assets/models/monsters/lich.glb',
  loader: 'src/assets/monster-library.js',
  client: 'src/main.js', server: 'server.mjs',
};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fingerprint = () => Object.fromEntries(Object.entries(paths).map(([name, file]) => [name, sha(fs.readFileSync(file))]));
const before = fingerprint(), startedAt = new Date().toISOString();
function readGlb(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.toString('ascii', 0, 4), 'glTF');
  assert.equal(data.readUInt32LE(4), 2); assert.equal(data.readUInt32LE(8), data.length);
  let json, bin;
  for (let offset = 12; offset < data.length;) {
    const size = data.readUInt32LE(offset), type = data.readUInt32LE(offset + 4);
    const chunk = data.subarray(offset + 8, offset + 8 + size);
    assert.equal(chunk.length, size);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8').trim());
    if (type === 0x004e4942) bin = chunk;
    offset += 8 + size;
  }
  assert(json && bin); return { json, bin, data };
}
const baseline = readGlb(paths.baseline), candidate = readGlb(paths.candidate), runtime = readGlb(paths.runtime);
function duration(glb, animation) {
  let maximum = 0;
  for (const sampler of animation.samplers) {
    const accessor = glb.json.accessors[sampler.input], view = glb.json.bufferViews[accessor.bufferView];
    assert.equal(accessor.componentType, 5126); assert.equal(accessor.type, 'SCALAR');
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0), stride = view.byteStride || 4;
    for (let i = 0; i < accessor.count; i++) maximum = Math.max(maximum, glb.bin.readFloatLE(offset + i * stride));
  }
  return maximum;
}
const immutableSections = Object.fromEntries(['nodes', 'skins', 'meshes', 'materials', 'images', 'textures', 'samplers']
  .map(name => [name, JSON.stringify(baseline.json[name]) === JSON.stringify(candidate.json[name])]));
const originalByteLength = baseline.json.buffers[0].byteLength;
const unchangedBinaryPrefix = baseline.bin.subarray(0, originalByteLength).equals(candidate.bin.subarray(0, originalByteLength));
const candidateAttack = candidate.json.animations[3], attackDuration = duration(candidate, candidateAttack);
const source = fs.readFileSync(paths.loader, 'utf8');
const start = source.indexOf('function sliceClip('), end = source.indexOf('// Clip copies belong', start);
assert(start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(source.slice(start, end) + '\nglobalThis.slice = sliceClip;', context);
let naiveWalkerCropFailure;
try { context.slice(null, { duration: attackDuration }, 1 / 3, 5 / 3); }
catch (error) { naiveWalkerCropFailure = { name: error.name, message: error.message }; }
const after = fingerprint();
const report = {
  startedAt, finishedAt: new Date().toISOString(), before, after,
  sourceStable: JSON.stringify(before) === JSON.stringify(after), accepted: false,
  scope: 'Binary/metadata compatibility only. The exact loader crop guard is reproduced with the staged duration; no runtime installation, animation playback, damage or network proof.',
  runtimeStillBaseline: runtime.data.equals(baseline.data), immutableSections, unchangedBinaryPrefix,
  candidateAttack: { name: candidateAttack.name, duration: attackDuration, channels: candidateAttack.channels.length },
  runtimeAttackDuration: duration(runtime, runtime.json.animations[3]),
  candidateSceneExtras: candidate.json.scenes[candidate.json.scene || 0].extras,
  naiveWalkerCropFailure,
  recommendation: 'Keep the entire Lich cast clip under a separate explicit profile. Do not merely rename bipxPrototypeMotion to bipxMotion: the generic retargeted Attack branch currently applies the Walker 1/3..5/3 crop.',
};
const output = `output/qa/arpg-root-review/${startedAt.replace(/[:.]/g, '-')}-lich-compatibility.json`;
fs.mkdirSync('output/qa/arpg-root-review', { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, ...report }));
