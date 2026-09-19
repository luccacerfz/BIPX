/** Bounded elemental presentation adapted from HandCast and Linear.
 * Copyright (c) 2026 mohamedachrefelouafi; MIT in ELEMENTAL-LICENSE.txt.
 * No damage, targets, weapons, actor state, camera effects or wall-clock reads.
 */
import { createElementalCrystalGeometry } from './elemental-geometry.js';
import { crystalVertex, crystalFragment, surfaceVertex, surfaceFragment, ribbonVertex, ribbonFragment } from './elemental-shaders.js';
import { createThreatMarkers } from './threat-markers.js';
import { VFX_PALETTE } from './palette.js';

export const ELEMENTAL_SOURCES = Object.freeze({
  handcast: '3431252f7ad88059681d4b9b6484cb7483f7d0d6',
  linear: '8c377c886ac2c68b26bc65c8f3507905818b974a',
});
const QUALITY = Object.freeze({
  high: { crystals: 96, surfaces: 24, ribbons: 112, density: 1, spacing: .62 },
  medium: { crystals: 64, surfaces: 16, ribbons: 72, density: .72, spacing: .8 },
  low: { crystals: 24, surfaces: 8, ribbons: 28, density: .4, spacing: 1.15 },
});
// Family defaults follow palette ownership: glacial/arcane belong to Lyra, void/toxic are only ever cast by enemies.
const COLORS = Object.freeze({ glacial: VFX_PALETTE.lyra.frost, void: VFX_PALETTE.hostile.threat, toxic: VFX_PALETTE.hostile.threat, arcane: VFX_PALETTE.lyra.gravity });
const EMISSIONS = new Set(['glacialCast', 'glacialImpact', 'glacialNova', 'voidCast', 'voidImpact', 'toxicCast', 'toxicImpact', 'arcaneCast', 'arcaneImpact', 'flameCast', 'flameImpact']);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && (p.y == null || Number.isFinite(p.y));

export function createElementalVfx({ THREE, scene, quality = 'medium', reducedMotion = false } = {}) {
  if (!THREE || !scene?.add) throw new TypeError('createElementalVfx requires THREE and scene');
  const group = new THREE.Group(); group.name = 'ElementalVfx'; scene.add(group);
  let disposed = false, time = 0, currentQuality = QUALITY[quality] ? quality : 'medium';
  let reduced = Boolean(reducedMotion), config = QUALITY[currentQuality], trailState = new WeakMap();
  let emitted = 0, overwritten = 0, rejected = 0, serial = 1, trailDistance = 0;
  const counts = Object.fromEntries([...EMISSIONS, 'glacialTrail', 'voidTrail', 'toxicTrail', 'arcaneTrail'].map(k => [k, 0]));
  const color = new THREE.Color(), direction = new THREE.Vector3(), quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(1, 0, 0), point = new THREE.Vector3(), fromPoint = new THREE.Vector3();
  const clockUniform = { value: 0 }, motionUniform = { value: reduced ? 0 : 1 };
  const hash = n => { const a = Math.sin(n * 127.1) * 43758.5453123; return a - Math.floor(a); };

  function makePool(name, base, capacity, layout, vertexShader, fragmentShader, additive = false) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    for (const [key, attribute] of Object.entries(base.attributes)) geometry.setAttribute(key, attribute);
    // Buffers are transferred into the instanced geometry; base was never rendered.
    const arrays = {}, attributes = {};
    for (const [key, size] of Object.entries(layout)) {
      arrays[key] = new Float32Array(capacity * size);
      attributes[key] = new THREE.InstancedBufferAttribute(arrays[key], size).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(key, attributes[key]);
    }
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({ name, vertexShader, fragmentShader,
      uniforms: { uTime: clockUniform, uMotion: motionUniform }, transparent: true,
      depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3;
    group.add(mesh);
    return { geometry, material, mesh, arrays, attributes, layout, capacity, limit: capacity, head: 0, written: 0, active: 0, dirty: false };
  }
  const crystalGeometry = createElementalCrystalGeometry(THREE);
  const crystals = makePool('ElementalGlacialFacets', crystalGeometry, QUALITY.high.crystals,
    { aOrigin: 3, aVelocity: 3, aParams: 4, aLook: 4, aQuaternion: 4 }, crystalVertex, crystalFragment);
  const plane = new THREE.PlaneGeometry(2, 2);
  const surfaces = makePool('ElementalImpactSurfaces', plane, QUALITY.high.surfaces,
    { aOrigin: 3, aParams: 4, aLook: 4, aColor: 3 }, surfaceVertex, surfaceFragment);
  const ribbonBase = new THREE.BufferGeometry(), segments = 16;
  const positions = new Float32Array((segments + 1) * 6), indices = [];
  for (let i = 0; i <= segments; i++) {
    positions.set([i / segments, -1, 0, i / segments, 1, 0], i * 6);
    if (i < segments) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  ribbonBase.setAttribute('position', new THREE.BufferAttribute(positions, 3)); ribbonBase.setIndex(indices);
  const ribbons = makePool('ElementalHelicalRibbons', ribbonBase, QUALITY.high.ribbons,
    { aOrigin: 3, aEnd: 3, aParams: 4, aLook: 4, aColor: 3 }, ribbonVertex, ribbonFragment, true);
  const pools = [crystals, surfaces, ribbons];
  const bytes = pools.reduce((sum, p) => sum + Object.values(p.arrays).reduce((n, a) => n + a.byteLength, 0), 0);
  // Hostile projectiles refresh their threat marker through elemental-projectiles.js, whatever their element.
  const threats = createThreatMarkers(THREE, group);
  const THREAT_LIMIT = { high: 32, medium: 24, low: 16 };

  function slot(pool) {
    const index = pool.head; pool.head = (pool.head + 1) % pool.limit;
    const birth = pool.arrays.aParams[index * 4], life = pool.arrays.aParams[index * 4 + 1];
    if (life > 0 && time < birth + life) overwritten++;
    pool.written = Math.max(pool.written, index + 1); pool.dirty = true; emitted++;
    return index;
  }
  function write3(a, i, x, y, z) { const n = i * 3; a[n] = x; a[n + 1] = y; a[n + 2] = z; }
  function write4(a, i, x, y, z, w) { const n = i * 4; a[n] = x; a[n + 1] = y; a[n + 2] = z; a[n + 3] = w; }
  function tint(pool, i, value) {
    color.set(value); write3(pool.arrays.aColor, i, color.r, color.g, color.b);
  }
  function surface(kind, at, radius, life, seed, tintValue, billboard = false, intensity = 1) {
    const i = slot(surfaces), a = surfaces.arrays;
    write3(a.aOrigin, i, at.x, finite(at.y, .075), at.z);
    write4(a.aParams, i, time, life, radius, 0);
    write4(a.aLook, i, kind, billboard ? 1 : 0, seed, clamp(intensity, .15, 1));
    tint(surfaces, i, tintValue);
  }
  function crystal(at, dx, dy, dz, vx, vy, vz, length, width, life, seed, shatter, groundY) {
    const i = slot(crystals), a = crystals.arrays;
    direction.set(dx, dy, dz).normalize(); quaternion.setFromUnitVectors(axis, direction);
    write3(a.aOrigin, i, at.x, finite(at.y, 1.3), at.z); write3(a.aVelocity, i, vx, vy, vz);
    write4(a.aParams, i, time, life, length, width);
    write4(a.aLook, i, seed, shatter, groundY, 0);
    write4(a.aQuaternion, i, quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }

  function emit(kind, at, options = {}) {
    if (disposed || !EMISSIONS.has(kind) || !valid(at)) { rejected++; return false; }
    const family = kind.startsWith('glacial') ? 'glacial' : kind.startsWith('void') ? 'void' : kind.startsWith('arcane') ? 'arcane' : kind.startsWith('flame') ? 'fire' : 'toxic';
    const impact = kind.endsWith('Impact'), seed = serial++ * 7.13;
    const radius = clamp(finite(options.radius, impact ? 1.25 : .62), .12, 4.5);
    const intensity = clamp(finite(options.intensity, 1), .15, 1.5);
    const groundY = finite(options.groundY, .075), tintValue = options.color ?? COLORS[family];
    const dx = finite(options.direction?.x, 0), dz = finite(options.direction?.z, 1);
    if (kind === 'glacialNova') {
      // The outer reach stays at the caller's radius in every quality/motion mode.
      // Sparse edge crystals leave the central actor and targets visible.
      const reach = clamp(finite(options.radius, 3.8), .12, 18);
      point.set(at.x, groundY, at.z);
      // `surface: false` keeps only the rim crystals, for callers that draw their own front on the same radius.
      if (options.surface !== false) surface(4, point, reach, reduced ? .44 : .7, seed, tintValue, false, intensity);
      const n = currentQuality === 'low' || reduced ? 6 : currentQuality === 'medium' ? 9 : 12;
      for (let j = 0; j < n; j++) {
        const theta = j / n * Math.PI * 2 + seed;
        point.set(at.x + Math.cos(theta) * reach * .78, groundY + .27, at.z + Math.sin(theta) * reach * .78);
        crystal(point, Math.cos(theta) * .35, 1, Math.sin(theta) * .35,
          Math.cos(theta) * .25, .35, Math.sin(theta) * .25,
          .65 + hash(j + seed) * .45, .12, reduced ? .38 : .65, seed + j * 3.7, j % 3 === 0 ? 1 : 0, groundY);
      }
    } else if (family === 'glacial') {
      // Distinct solid crystal silhouettes; appearance never changes gameplay.
      const n = Math.max(2, Math.round((impact ? 8 : 3) * config.density * (reduced ? .5 : 1)));
      for (let j = 0; j < n; j++) {
        const theta = j / n * Math.PI * 2 + seed;
        const radial = impact ? .8 + hash(seed + j) * 1.7 : .3;
        const vx = impact ? Math.cos(theta) * radial : dx * .9;
        const vz = impact ? Math.sin(theta) * radial : dz * .9;
        const rise = impact ? .7 + hash(seed + j + 2) * 1.8 : .3;
        crystal(at, Math.cos(theta) * .65, .65 + hash(j + seed), Math.sin(theta) * .65,
          vx, rise, vz, radius * (.52 + hash(j + seed + 3) * .50), radius * .11,
          reduced ? .36 : impact ? .7 : .42, seed + j * 3.7, impact && j === 0 ? 1 : 0, groundY);
      }
      point.set(at.x, groundY, at.z);
      surface(0, point, radius * (impact ? 1.05 : .72), impact ? .7 : .35, seed, tintValue, false, intensity);
      // A face-on lattice at contact reads even when the ground is occluded.
      if (impact && !reduced) surface(0, at, radius * .56, .37, seed + 9, tintValue, true, .7);
    } else if (family === 'fire') {
      surface(5, at, radius, reduced ? .3 : impact ? .56 : .38, seed, tintValue ?? 0xff8838, true, intensity);
    } else if (family === 'arcane') {
      // Open runes, not the enemies' opaque singularity core.
      surface(3, at, radius, reduced ? .26 : impact ? .42 : .30, seed, tintValue, true, intensity);
    } else if (family === 'void') {
      surface(1, at, radius * (impact ? .86 : .72), reduced ? .28 : impact ? .48 : .30, seed, tintValue, true, intensity);
    } else {
      // Short-lived stain at actual contact. Not a persistent damage puddle.
      point.set(at.x, groundY, at.z);
      surface(2, point, radius * (impact ? .8 : .36), impact ? .72 : .25, seed, tintValue, false, intensity);
      if (impact) {
        // Airborne residue at confirmed contact survives a raised floor occluder.
        // It remains depth-tested and hollow, so the actor is not covered by a disc.
        point.set(at.x, finite(at.y, 1.3) + .14, at.z);
        surface(2, point, radius * .48, reduced ? .22 : .30, seed + 17, tintValue, true, intensity * .85);
      }
    }
    counts[kind]++; return true;
  }

  function ribbon(kind, from, to, radius, seed, tintValue) {
    const strands = reduced ? 1 : currentQuality === 'low' ? 1 : 2;
    for (let j = 0; j < strands; j++) {
      const i = slot(ribbons), a = ribbons.arrays;
      write3(a.aOrigin, i, from.x, finite(from.y, 1.3), from.z);
      write3(a.aEnd, i, to.x, finite(to.y, 1.3), to.z);
      write4(a.aParams, i, time, reduced ? .16 : kind === 'glacial' ? .42 : .35, radius * .13, radius * .15);
      write4(a.aLook, i, seed + j * 3.14, .16 + hash(seed + j) * .18, reduced ? .45 : 1, 0);
      tint(ribbons, i, tintValue);
    }
  }

  /** key: projectile object enables distance cadence across successive frames.
   * Trail samples record the real swept path; stationary calls never emit.
   * Teleports (>8m per call) clear continuity instead of drawing a false path.
   */
  function emitTrail(kind, from, to, options = {}) {
    if (disposed || !Object.hasOwn(COLORS, kind) || !valid(from) || !valid(to)) { rejected++; return false; }
    const dx = to.x - from.x, dy = finite(to.y, 1.3) - finite(from.y, 1.3), dz = to.z - from.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 1e-6) return false;
    const key = options.key && (typeof options.key === 'object' || typeof options.key === 'function') ? options.key : null;
    if (distance > 8) { if (key) trailState.delete(key); return false; }
    const radius = clamp(finite(options.radius, .52), .1, 1.4), tintValue = options.color ?? COLORS[kind];
    const spacing = config.spacing * (reduced ? 1.8 : 1);
    let state = key ? trailState.get(key) : null;
    if (!state || state.kind !== kind) {
      state = { kind, debt: 0, x: from.x, y: finite(from.y, 1.3), z: from.z, seed: serial++ * 1.71 };
      if (key) trailState.set(key, state);
    }
    let advance = spacing - state.debt, wrote = false;
    let samples = 0;
    for (; advance <= distance + 1e-7 && samples < 12; advance += spacing, samples++) {
      const t = clamp(advance / distance, 0, 1);
      fromPoint.set(state.x, state.y, state.z);
      point.set(from.x + dx * t, finite(from.y, 1.3) + dy * t, from.z + dz * t);
      ribbon(kind, fromPoint, point, radius, state.seed, tintValue);
      if (kind === 'glacial' && !reduced && hash(state.seed) > .62) {
        crystal(point, dx, dy + .1, dz, 0, .22, 0, radius * .5, radius * .07, .34, state.seed, 0, .055);
      }
      state.x = point.x; state.y = point.y; state.z = point.z; state.seed += 3.1;
      wrote = true;
    }
    // Match the endpoint tolerance above: modulo can retain spacing-epsilon and
    // emit the very same boundary twice on the following frame.
    const total = state.debt + distance;
    state.debt = Math.max(0, total - Math.floor((total + 1e-7) / spacing) * spacing);
    trailDistance += distance;
    if (wrote) counts[`${kind}Trail`]++;
    return wrote;
  }

  function update(dt) {
    if (disposed) return;
    const step = clamp(finite(dt, 0), 0, .15);
    time += step; clockUniform.value = time; threats.update(step, reduced);
    for (const p of pools) {
      if (p.dirty) {
        for (const attr of Object.values(p.attributes)) attr.needsUpdate = true;
        p.geometry.instanceCount = p.written; p.dirty = false;
      }
      p.active = 0;
      for (let i = 0; i < p.written; i++) {
        const birth = p.arrays.aParams[i * 4], life = p.arrays.aParams[i * 4 + 1];
        if (life > 0 && time < birth + life) p.active++;
      }
      p.mesh.visible = p.active > 0;
    }
  }
  function reset() {
    if (disposed) return;
    time = 0; clockUniform.value = 0; trailState = new WeakMap(); threats.reset();
    for (const p of pools) {
      p.head = 0; p.written = 0; p.active = 0; p.arrays.aParams.fill(0); p.dirty = true;
      p.geometry.instanceCount = 0; p.mesh.visible = false;
    }
  }
  function setQuality(value) {
    if (disposed) return;
    currentQuality = QUALITY[value] ? value : 'medium'; config = QUALITY[currentQuality]; threats.setLimit(THREAT_LIMIT[currentQuality]);
    for (const [i, key] of ['crystals', 'surfaces', 'ribbons'].entries()) {
      const p = pools[i]; p.limit = config[key]; p.head %= p.limit;
      p.written = Math.min(p.written, p.limit); p.dirty = true;
      p.geometry.instanceCount = p.written;
      // Slots above the new limit must not resurrect on a later upshift.
      p.arrays.aParams.fill(0, p.limit * 4);
    }
  }
  function setReducedMotion(value) {
    if (disposed) return;
    reduced = Boolean(value); motionUniform.value = reduced ? 0 : 1; reset();
  }
  function getStats() {
    return { quality: currentQuality, reducedMotion: reduced, disposed, time,
      activeCrystals: crystals.active, activeSurfaces: surfaces.active, activeRibbons: ribbons.active,
      capacities: { crystals: config.crystals, surfaces: config.surfaces, ribbons: config.ribbons },
      allocatedBytes: bytes, drawCalls: pools.filter(p => p.mesh.visible).length + threats.getStats().drawCalls, threat: threats.getStats(),
      emitted, overwritten, rejected, trailDistance, events: { ...counts }, sourceCommits: { ...ELEMENTAL_SOURCES } };
  }
  function dispose() {
    if (disposed) return;
    reset(); threats.dispose(); group.removeFromParent();
    for (const p of pools) { p.geometry.dispose(); p.material.dispose(); }
    disposed = true;
  }
  setQuality(currentQuality);
  /** trackThreat(key, position, radius): refresh the threat marker of one live hostile projectile; call it every frame. */
  return { emit, emitTrail, update, setQuality, setReducedMotion, reset, getStats, dispose,
    trackThreat: (key, position, radius) => !disposed && threats.track(key, position, radius) };
}
