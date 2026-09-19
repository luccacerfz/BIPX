import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { moduleUrl, sourceHashes } from './class-skill-vfx-support.mjs';
const THREE = await import(await moduleUrl('vendor/three/three.module.js'));
const { createClassSkillVfx, CLASS_SKILL_VFX } = await import(await moduleUrl('src/vfx/class-skill-vfx.js'));
const { createCombatVfx } = await import(await moduleUrl('src/vfx/combat-vfx.js'));
const { createElementalVfx } = await import(await moduleUrl('src/vfx/elemental-vfx.js'));
const checks = [], sources = await sourceHashes();
const check = (name, run) => { run(); checks.push({ name, pass: true }); };
const make = (quality = 'high', reducedMotion = false) => {
  const scene = new THREE.Scene();
  return { scene, vfx: createClassSkillVfx({ THREE, scene, quality, reducedMotion }) };
};
const origin = { x: 3, y: 1.5, z: -2 }, target = { x: 5, y: .7, z: -1 }, direction = { x: 2, y: -.8, z: 1 };
const request = (skillId, phase, extra = {}) => ({ skillId, phase, origin, target, direction, castId: skillId, ...extra });
const { scene, vfx } = make();
const meshes = () => { const list = []; scene.traverse(n => { if (n.isMesh) list.push(n); }); return list; };
check('Six skills produce cast and contact in actual finite instance buffers', () => {
  assert.equal(Object.keys(CLASS_SKILL_VFX).length, 6);
  for (const id of Object.keys(CLASS_SKILL_VFX)) for (const phase of ['cast', 'impact']) assert.equal(vfx.emit(request(id, phase)), true);
  vfx.update(0);
  for (const mesh of meshes()) for (const attr of Object.values(mesh.geometry.attributes)) for (const n of attr.array) assert.ok(Number.isFinite(n));
  const stats = vfx.getStats(); assert.ok(stats.combat.drawCalls > 0); assert.ok(stats.elemental.drawCalls > 0);
  for (const n of Object.values(stats.elemental.events)) assert.ok(Number.isFinite(n));
});
check('Malformed contacts, unknown skill/phase and missing travel IDs emit nothing', () => {
  const before = vfx.getStats().elemental.emitted + vfx.getStats().combat.totalEmitted;
  for (const payload of [null, {}, request('constructor', 'cast'), request('dwarf_arcane_shot', 'unknown'),
    request('dwarf_arcane_shot', 'impact', { target: null }), request('dwarf_arcane_shot', 'impact', { target: { x: 0, y: Infinity, z: 0 } }),
    request('dwarf_arcane_shot', 'travel', { castId: null }), request('dwarf_arcane_shot', 'cast', { direction: { x: NaN, z: 0 } })]) assert.equal(vfx.emit(payload), false);
  assert.equal(vfx.getStats().elemental.emitted + vfx.getStats().combat.totalEmitted, before);
});
check('Retransmission deduplication retains all six distinct piercing contacts', () => {
  vfx.reset(); const id = 'dwarf_arcane_shot';
  assert.equal(vfx.emit(request(id, 'cast')), true); assert.equal(vfx.emit(request(id, 'cast')), false);
  for (let i = 0; i < 6; i++) {
    assert.equal(vfx.emit(request(id, 'impact', { contactId: `enemy${i}` })), true);
    assert.equal(vfx.emit(request(id, 'impact', { contactId: `enemy${i}` })), false);
  }
});
check('Arcane surface and directional lightning terminate at real supplied contact', () => {
  vfx.reset(); vfx.emit(request('dwarf_arcane_shot', 'impact')); vfx.update(0);
  const surface = scene.getObjectByName('ElementalImpactSurfaces').geometry.attributes;
  assert.ok(Math.abs(surface.aOrigin.getX(0) - target.x) < 1e-6);
  assert.ok(Math.abs(surface.aOrigin.getY(0) - target.y) < 1e-6);
  assert.equal(surface.aOrigin.getZ(0), target.z); assert.equal(surface.aLook.getX(0), 3);
  vfx.reset(); vfx.emit(request('warrior_thunder_judgment', 'impact')); vfx.update(0);
  const beam = meshes().find(m => m.geometry.attributes.aVelocity && m.material.vertexShader.includes('vec4 start = modelViewMatrix'));
  assert.ok(beam);
  const endpoints = beam.geometry.attributes.aVelocity;
  let contacts = 0;
  for (let i = 0; i < beam.geometry.instanceCount; i++) if (Math.hypot(endpoints.getX(i)-target.x, endpoints.getY(i)-target.y, endpoints.getZ(i)-target.z) < 1e-5) contacts++;
  assert.equal(contacts, 2, 'both the descending strike and the directed branch end at contact');
});
check('Nova ground contact and full radius survive low quality and reduced motion', () => {
  for (const quality of ['high', 'medium', 'low']) for (const reduced of [false, true]) {
    vfx.setQuality(quality); vfx.setReducedMotion(reduced);
    vfx.emit(request('warrior_frost_nova', 'impact', { radius: 5.6, groundY: 2.35 })); vfx.update(0);
    const a = scene.getObjectByName('ElementalImpactSurfaces').geometry.attributes;
    assert.equal(a.aLook.getX(0), 4); assert.ok(Math.abs(a.aOrigin.getY(0) - 2.35) < 1e-6);
    assert.ok(Math.abs(a.aParams.getZ(0) - 5.6) < 1e-6);
    assert.ok(vfx.getStats().elemental.activeCrystals > 0);
  }
});
const cadence = [];
check('Fire and arcane trails follow distance consistently at 30/60/144 Hz', () => {
  for (const id of ['dwarf_incendiary_burst', 'dwarf_arcane_shot']) for (const fps of [30, 60, 144]) {
    const f = make();
    for (let i = 0; i < fps; i++) f.vfx.emit(request(id, 'travel', { origin: { x: i/fps*8, y: 1, z: 0 }, target: { x: (i+1)/fps*8, y: 1, z: 0 } }));
    const s = f.vfx.getStats(); cadence.push({ id, fps, fireSamples: s.fireTrailSamples, elementalEmitted: s.elemental.emitted, distance: s.pathDistance }); f.vfx.dispose();
  }
  for (const id of ['dwarf_incendiary_burst', 'dwarf_arcane_shot']) {
    const rows = cadence.filter(c => c.id === id);
    assert.equal(new Set(rows.map(c => c.fireSamples + c.elementalEmitted)).size, 1, JSON.stringify(rows));
    for (const row of rows) assert.ok(Math.abs(row.distance - 8) < 1e-7);
  }
});
check('Stationary calls, teleports, discontinuous snapshots and reduced trails do not paint false paths', () => {
  vfx.setQuality('high'); vfx.setReducedMotion(false);
  const id = 'dwarf_incendiary_burst';
  assert.equal(vfx.emit(request(id, 'travel', { target: origin })), false);
  assert.equal(vfx.emit(request(id, 'travel', { target: { x: 100, y: 1, z: 0 } })), false);
  assert.equal(vfx.emit(request(id, 'travel')), false);
  vfx.setReducedMotion(true); assert.equal(vfx.emit(request(id, 'travel')), false);
});
check('Pause freezes uniforms and records; simulation expiry clears casts and all draws', () => {
  vfx.setReducedMotion(false); vfx.emit(request('warrior_frost_nova', 'impact')); vfx.update(.1);
  const stats = vfx.getStats(); for (let i = 0; i < 50; i++) vfx.update(0);
  assert.deepEqual(vfx.getStats(), stats);
  for (let i = 0; i < 81; i++) vfx.update(.1);
  assert.equal(vfx.getStats().activeCasts, 0); assert.equal(vfx.getStats().combat.drawCalls + vfx.getStats().elemental.drawCalls, 0);
});
check('2000 casts, quality switches and repeated resets cannot allocate new meshes or buffers', () => {
  const originalMeshes = meshes(), arrays = originalMeshes.flatMap(m => Object.values(m.geometry.attributes).map(a => a.array));
  for (let i = 0; i < 2000; i++) vfx.emit(request('warrior_frost_nova', 'impact', { castId: i }));
  vfx.update(0); assert.equal(vfx.getStats().activeCasts, 64); assert.ok(vfx.getStats().overwritten > 0);
  vfx.setQuality('low'); vfx.update(0); assert.ok(vfx.getStats().activeCasts <= 20);
  assert.ok(vfx.getStats().elemental.activeCrystals <= 24); assert.ok(vfx.getStats().elemental.activeSurfaces <= 8);
  vfx.setQuality('high'); assert.ok(vfx.getStats().activeCasts <= 20);
  vfx.reset(); vfx.reset(); assert.equal(vfx.getStats().activeCasts, 0);
  assert.deepEqual(meshes(), originalMeshes);
  const after = meshes().flatMap(m => Object.values(m.geometry.attributes).map(a => a.array));
  for (let i = 0; i < arrays.length; i++) assert.equal(arrays[i], after[i]);
});
check('Borrowed pools add no scene objects and never advance, reset, configure or dispose them', () => {
  const s = new THREE.Scene(), c = createCombatVfx({ THREE, scene: s, ambient: false }), e = createElementalVfx({ THREE, scene: s });
  const children = s.children.slice(), f = createClassSkillVfx({ THREE, scene: s, combatVfx: c, elementalVfx: e });
  e.emit('toxicImpact', target); e.update(.1); const original = e.getStats();
  f.update(.1); f.reset(); f.setQuality('low'); f.setReducedMotion(true); f.dispose(); f.dispose();
  assert.deepEqual(s.children, children); assert.deepEqual(e.getStats(), original); assert.equal(c.getStats().disposed, false);
  c.dispose(); e.dispose();
});
check('Owned disposal releases actual geometries/materials once and rejects further writes', () => {
  let g = 0, m = 0;
  const geometries = new Set(meshes().map(o => o.geometry)), materials = new Set(meshes().map(o => o.material));
  for (const geometry of geometries) geometry.addEventListener('dispose', () => g++);
  for (const material of materials) material.addEventListener('dispose', () => m++);
  vfx.dispose(); vfx.dispose(); assert.equal(scene.children.length, 0); assert.equal(g, geometries.size); assert.equal(m, materials.size);
  assert.equal(vfx.emit(request('dwarf_arcane_shot', 'impact')), false);
});
assert.deepEqual(await sourceHashes(), sources);
const out = `output/qa/class-skill-vfx-${new Date().toISOString().replace(/[:.]/g, '-')}-cpu.json`;
await fs.mkdir('output/qa', { recursive: true });
await fs.writeFile(out, JSON.stringify({ passed: true, scope: 'CPU buffer/contact/lifecycle; not rendered gameplay', sourceChanged: false, sources, checks, cadence }, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, checks: checks.length, out, cadence }));
