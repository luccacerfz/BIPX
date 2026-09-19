import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
// package.json predates ESM; load the exact vendor and candidate with data URLs.
const sourceUrl = async file => `data:text/javascript;base64,${Buffer.from(await readFile(file, 'utf8')).toString('base64')}`;
const THREE = await import(await sourceUrl('vendor/three/three.module.js'));
let shaders = await readFile('src/vfx/elemental-shaders.js', 'utf8');
shaders = shaders.replace("'./elemental-source-glsl.js'", JSON.stringify(await sourceUrl('src/vfx/elemental-source-glsl.js')));
let module = await readFile('src/vfx/elemental-vfx.js', 'utf8');
module = module.replace("'./elemental-shaders.js'", JSON.stringify(`data:text/javascript;base64,${Buffer.from(shaders).toString('base64')}`))
  .replace("'./elemental-geometry.js'", JSON.stringify(await sourceUrl('src/vfx/elemental-geometry.js')));
const { createElementalVfx } = await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
const checks = [];
function check(name, f) { f(); checks.push({ name, pass: true }); }
function make(quality = 'high') { const scene = new THREE.Scene(); return { scene, vfx: createElementalVfx({ THREE, scene, quality }) }; }
const { scene, vfx } = make();
const at = new THREE.Vector3(2, 1.3, -2), dir = new THREE.Vector3(0, 0, 1);
check('Source-derived crystal topology is finite, outward and nondegenerate', () => {
  const geo = scene.children[0].children[0].geometry;
  const pos = geo.attributes.position, norm = geo.attributes.normal, bary = geo.attributes.aBary;
  assert.equal(pos.count % 3, 0); assert.ok(pos.count >= 180);
  for (const attr of Object.values(geo.attributes)) for (const n of attr.array) assert.ok(Number.isFinite(n));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), expected = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(b, a).cross(c.sub(a)); assert.ok(n.lengthSq() > 1e-10);
    expected.fromBufferAttribute(norm, i); assert.ok(n.normalize().dot(expected) > .9999);
    for (let j = 0; j < 3; j++) assert.equal(bary.getX(i + j) + bary.getY(i + j) + bary.getZ(i + j), 1);
  }
});
check('All six actual event families write fixed finite buffers', () => {
  for (const family of ['glacial', 'void', 'toxic']) for (const phase of ['Cast', 'Impact']) assert.equal(vfx.emit(family + phase, at, { direction: dir }), true);
  vfx.update(0);
  const stats = vfx.getStats(); assert.ok(stats.activeCrystals > 0); assert.ok(stats.activeSurfaces > 0);
  for (const mesh of scene.children[0].children) for (const attr of Object.values(mesh.geometry.attributes)) for (const n of attr.array) assert.ok(Number.isFinite(n));
});
check('Pause retains exact buffers and time; invalid input does not emit', () => {
  const before = scene.children[0].children.map(m => Object.values(m.geometry.attributes).map(a => Array.from(a.array)));
  const stats = vfx.getStats(); for (let i = 0; i < 25; i++) vfx.update(0);
  assert.equal(vfx.getStats().time, stats.time);
  assert.deepEqual(scene.children[0].children.map(m => Object.values(m.geometry.attributes).map(a => Array.from(a.array))), before);
  assert.equal(vfx.emit('glacialImpact', { x: NaN, z: 0 }), false);
  assert.equal(vfx.emitTrail('void', at, at, { key: {} }), false);
  assert.equal(vfx.getStats().emitted, stats.emitted);
});
const cadence = [];
check('Actual distance, not FPS, determines trail sample count', () => {
  for (const fps of [30, 60, 144]) {
    const a = make(), key = {}, from = new THREE.Vector3(), to = new THREE.Vector3();
    for (let i = 0; i < fps * 2; i++) {
      from.set(i / fps * 8, 1.4, 0); to.set((i + 1) / fps * 8, 1.4, 0);
      a.vfx.emitTrail('void', from, to, { key }); a.vfx.update(1 / fps);
    }
    cadence.push({ fps, emitted: a.vfx.getStats().emitted, distance: a.vfx.getStats().trailDistance }); a.vfx.dispose();
  }
  assert.equal(new Set(cadence.map(c => c.emitted)).size, 1);
  for (const c of cadence) assert.ok(Math.abs(c.distance - 16) < 1e-8);
});
check('Overload, downshift, upshift and repeated reset preserve budgets/resources', () => {
  const arrays = scene.children[0].children.flatMap(m => Object.values(m.geometry.attributes).map(a => a.array));
  for (let i = 0; i < 1000; i++) vfx.emit('glacialImpact', at);
  vfx.update(0); assert.ok(vfx.getStats().overwritten > 0); assert.ok(vfx.getStats().activeCrystals <= 96);
  vfx.setQuality('low'); vfx.update(0); assert.ok(vfx.getStats().activeCrystals <= 24); assert.ok(vfx.getStats().activeSurfaces <= 8);
  vfx.setQuality('high'); vfx.update(0); assert.ok(vfx.getStats().activeCrystals <= 24, 'upshift must not resurrect old slots');
  const current = scene.children[0].children.flatMap(m => Object.values(m.geometry.attributes).map(a => a.array));
  for (let i = 0; i < arrays.length; i++) assert.equal(current[i], arrays[i], 'quality changes must not replace buffers');
  vfx.reset(); vfx.reset(); vfx.update(0); assert.equal(vfx.getStats().drawCalls, 0);
});
check('Reduced motion clears moving effects, retains short essential contact and expires', () => {
  vfx.emit('voidImpact', at); vfx.setReducedMotion(true); assert.equal(vfx.getStats().drawCalls, 0);
  vfx.emit('glacialImpact', at); vfx.update(0); assert.ok(vfx.getStats().activeCrystals > 0);
  assert.equal(scene.children[0].children[0].material.uniforms.uMotion.value, 0);
  for (let i = 0; i < 20; i++) vfx.update(.1);
  assert.equal(vfx.getStats().drawCalls, 0);
});
check('Disposal removes all owned objects and disposes resources exactly once', () => {
  let g = 0, m = 0;
  for (const mesh of scene.children[0].children) { mesh.geometry.addEventListener('dispose', () => g++); mesh.material.addEventListener('dispose', () => m++); }
  vfx.dispose(); vfx.dispose(); assert.equal(scene.children.length, 0); assert.equal(g, 3); assert.equal(m, 3);
  assert.equal(vfx.emit('glacialImpact', at), false); vfx.update(1); assert.equal(vfx.getStats().disposed, true);
});
const sourceHashes = Object.fromEntries(await Promise.all(['src/vfx/elemental-vfx.js', 'src/vfx/elemental-shaders.js', 'src/vfx/elemental-source-glsl.js', 'src/vfx/elemental-geometry.js', 'vendor/three/three.module.js'].map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')])));
const result = { sourceHashes, label: 'CPU geometry/lifecycle/cadence only; no GPU or gameplay score', pass: true, checks, cadence, stats: vfx.getStats() };
await mkdir('output/qa', { recursive: true }); await writeFile('output/qa/elemental-vfx-cpu.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
