import { particleVertex, particleFragment, glyphVertex, glyphFragment, thermalGLSL } from './shaders.js';
import { createWeaponFireVolume } from './weapon-fire.js';
import { createLeafAtmosphere } from './leaves.js';
import { createTargetMarkers } from './target-markers.js';
import { createSoulEchoes } from './soul-echoes.js';
import { VFX_PALETTE } from './palette.js';
import { HERO_PROFILES } from '../combat/hero-power.mjs';

/**
 * Bounded, renderer-independent combat effects for Three.js r164.
 * Samurai reference and retained MIT notice: ./SAMURAI-LICENSE.txt.
 * No gameplay damage, camera motion, lights or unbounded per-effect meshes.
 */
const QUALITY = {
  high: { particles: 960, clouds: 160, glyphs: 64, beams: 160, density: 1, ambient: 1 },
  medium: { particles: 576, clouds: 96, glyphs: 40, beams: 96, density: 0.64, ambient: 0.6 },
  low: { particles: 224, clouds: 40, glyphs: 20, beams: 48, density: 0.32, ambient: 0.28 },
};
const PALETTE = {
  impact: 0xffd7a1, blood: 0x922238, muzzle: 0xffe7b0, slash: VFX_PALETTE.aldric.steel,
  fire: 0xfff1cf, ember: 0xffe8c8, frost: VFX_PALETTE.lyra.frost, lightning: 0xc1beff,
  shockwave: 0xeeb478, dust: 0x8d9aa7, smoke: 0x627b92, heal: VFX_PALETTE.heal,
  levelUp: 0xf0dba1, death: 0x88afbb, teleport: 0xb294ff, ambient: 0x79bcb9,
  seal: 0xb7a1f7, target: 0xfe887c, judgement: 0xd5b6ff, bladeStorm: 0xabe5f4,
  shadow: 0x7a76a6, finisher: VFX_PALETTE.aldric.ember, arc: VFX_PALETTE.aldric.steel, light: VFX_PALETTE.aldric.ember,
  reach: VFX_PALETTE.aldric.ember,
};
// Glyph kinds of shaders.js.
const SHOCK = 0, SEAL = 1, BLADE = 2, FLASH = 3, REACH = 4, SOLID_RING = 5, LIGHT = 6;
// The basic strike of the melee hero: the blade arc is drawn at the radius the caller passes, the ground wedge at the
// authoritative cone (src/combat/hero-power.mjs) unless the caller supplies `reach` / `arc` itself (e.g. with +Área).
const HERO_MELEE = HERO_PROFILES.warrior.basic;
const TAU = Math.PI * 2;
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const validPosition = value => value && Number.isFinite(value.x) && Number.isFinite(value.z);

const beamVertex = /* glsl */ `
uniform float uTime;
attribute vec3 aOrigin;
attribute vec3 aVelocity;
attribute vec3 aColor;
attribute vec4 aParams;
attribute vec4 aDynamics;
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;
void main() {
  float age = uTime - aParams.x;
  float t = clamp(age / max(aParams.y, 0.001), 0.0, 1.0);
  vFade = step(0.0, age) * (1.0 - step(aParams.y, age)) * (1.0 - t);
  vec4 start = modelViewMatrix * vec4(aOrigin, 1.0);
  vec4 end = modelViewMatrix * vec4(aVelocity, 1.0);
  vec2 dir = end.xy - start.xy;
  dir = length(dir) > 0.001 ? normalize(dir) : vec2(0.0, 1.0);
  vec4 p = mix(start, end, position.y * 0.5 + 0.5);
  p.xy += vec2(-dir.y, dir.x) * position.x * aParams.z * vFade;
  vUv = position.xy; vColor = aColor;
  gl_Position = projectionMatrix * p;
}`;
const beamFragment = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
varying float vFade;
void main() {
  float core = exp(-vUv.x * vUv.x * 25.0);
  float aura = exp(-vUv.x * vUv.x * 4.0) * 0.4;
  float alpha = (core + aura) * vFade;
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.65) * 1.7, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * @param {{THREE: object, scene: object, quality?: string,
 * reducedMotion?: boolean, ambient?: boolean, seed?: number}} options
 */
export function createCombatVfx({ THREE, scene, quality = 'high', reducedMotion = false, ambient = true, seed = 72917 }) {
  if (!THREE?.InstancedBufferGeometry || !scene?.add) throw new TypeError('Combat VFX needs THREE and a scene.');
  let currentQuality = QUALITY[quality] ? quality : 'medium';
  let config = QUALITY[currentQuality];
  let motionReduced = Boolean(reducedMotion);
  let ambientEnabled = Boolean(ambient);
  let clock = 0, ambientDebt = 0, disposed = false;
  let totalEmitted = 0, overwritten = 0, rejected = 0;
  let randomState = seed >>> 0 || 1;
  const eventCounts = Object.fromEntries(Object.keys(PALETTE).map(key => [key, 0]));
  const color = new THREE.Color();
  const samplePoint = new THREE.Vector3(), groundPoint = { x: 0, y: 0, z: 0 };
  const sampleNormal = new THREE.Vector3();
  const edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3();
  const vertexA = new THREE.Vector3(), vertexB = new THREE.Vector3(), vertexC = new THREE.Vector3();
  const emitters = new Set();
  const group = new THREE.Group();
  group.name = 'SamuraiCombatVFX';
  scene.add(group);
  const leaves = createLeafAtmosphere(THREE, group);
  const markers = createTargetMarkers(THREE, group);
  const souls = createSoulEchoes(THREE, group);
  leaves.setEnabled(ambientEnabled);

  function random() {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  }

  function makePool(name, capacity, vertexShader, fragmentShader, normalBlend = false, glyph = false) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const specs = glyph ? { aOrigin: 3, aColor: 3, aParams: 4, aShape: 4 } :
      { aOrigin: 3, aVelocity: 3, aColor: 3, aParams: 4, aDynamics: 4 };
    const arrays = {}, attributes = {};
    for (const [name, size] of Object.entries(specs)) {
      arrays[name] = new Float32Array(capacity * size);
      attributes[name] = new THREE.InstancedBufferAttribute(arrays[name], size).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, attributes[name]);
    }
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uMotion: { value: motionReduced ? 0.22 : 1 } },
      vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: true,
      blending: normalBlend ? THREE.NormalBlending : THREE.AdditiveBlending,
      side: THREE.DoubleSide, toneMapped: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = normalBlend ? 2 : glyph ? 3 : 4;
    mesh.raycast = () => {};
    group.add(mesh);
    geometry.instanceCount = 0;
    return { geometry, material, mesh, arrays, attributes, capacity, limit: capacity, head: 0, written: 0, dirty: false, active: 0 };
  }

  const sparks = makePool('VFX_EmbersAndSparks', QUALITY.high.particles, particleVertex, particleFragment);
  const clouds = makePool('VFX_SmokeAndDust', QUALITY.high.clouds, particleVertex, particleFragment, true);
  const glyphs = makePool('VFX_ShockSealsAndTrails', QUALITY.high.glyphs, glyphVertex, glyphFragment, false, true);
  const beams = makePool('VFX_LightningRibbons', QUALITY.high.beams, beamVertex, beamFragment);
  const pools = [sparks, clouds, glyphs, beams];
  glyphs.material.uniforms.uEmber = { value: new THREE.Color(VFX_PALETTE.aldric.ember) };
  let swingSerial = 0;
  const lastFinisher = { clock: -1, x: 0, z: 0 };

  function claim(pool, life) {
    const i = pool.head;
    const params = pool.arrays.aParams;
    if (params[i * 4 + 1] > 0 && params[i * 4] + params[i * 4 + 1] > clock) overwritten++;
    pool.head = (i + 1) % pool.limit;
    pool.written = Math.min(pool.written + 1, pool.limit);
    pool.dirty = true;
    params[i * 4] = clock;
    params[i * 4 + 1] = Math.max(0.025, life);
    totalEmitted++;
    return i;
  }

  function writeColor(pool, i, tint) {
    color.set(tint);
    const a = pool.arrays.aColor, o = i * 3;
    a[o] = color.r; a[o + 1] = color.g; a[o + 2] = color.b;
  }

  function particle(pool, x, y, z, vx, vy, vz, tint, life, size, kind, gravity = -4, drag = 1.2) {
    const i = claim(pool, motionReduced ? Math.min(life, 1.2) : life);
    const a = pool.arrays, v = i * 3, p = i * 4;
    a.aOrigin[v] = x; a.aOrigin[v + 1] = y; a.aOrigin[v + 2] = z;
    a.aVelocity[v] = vx; a.aVelocity[v + 1] = vy; a.aVelocity[v + 2] = vz;
    writeColor(pool, i, tint);
    a.aParams[p + 2] = size * (motionReduced ? 0.8 : 1); a.aParams[p + 3] = kind;
    a.aDynamics[p] = drag; a.aDynamics[p + 1] = gravity;
    a.aDynamics[p + 2] = (random() - 0.5) * 2; a.aDynamics[p + 3] = random() * 100;
  }

  function glyph(kind, position, tint, radius, life, angle = 0, tilt = 0, form = 1) {
    const i = claim(glyphs, life), a = glyphs.arrays, v = i * 3, p = i * 4;
    a.aOrigin[v] = position.x; a.aOrigin[v + 1] = Math.max(0.045, finite(position.y, 0.045)); a.aOrigin[v + 2] = position.z;
    writeColor(glyphs, i, tint);
    a.aParams[p + 2] = radius; a.aParams[p + 3] = kind;
    a.aShape[p] = angle; a.aShape[p + 1] = tilt;
    a.aShape[p + 2] = form; a.aShape[p + 3] = random() * 30;
  }
  /** Fake light: an additive pool on the ground under a flash. No scene light, no shader recompilation. */
  function groundLight(x, z, tint, radius, life, strength = .5) {
    if (currentQuality === 'low' && strength < .45) return;
    groundPoint.x = x; groundPoint.y = 0.05; groundPoint.z = z;
    glyph(LIGHT, groundPoint, tint, radius, motionReduced ? Math.min(life, .22) : life, 0, 0, clamp(strength, .05, 1));
  }
  /** Sparks thrown along an arc of `radius` around `position`, tangent to the sweep. */
  function arcSparks(position, yaw, half, radius, tint, amount, side = 1) {
    const count = Math.max(1, Math.round(amount * config.density * (motionReduced ? 0.35 : 1)));
    for (let i = 0; i < count; i++) {
      const angle = yaw + (random() * 2 - 1) * Math.min(half, Math.PI), cos = Math.cos(angle), sin = Math.sin(angle), speed = 2.5 + random() * 4;
      particle(sparks, position.x + cos * radius, finite(position.y, 1.2) + (random() - 0.5) * 0.25, position.z + sin * radius,
        (-sin * side * 0.75 + cos * 0.5) * speed, 0.6 + random() * 1.6, (cos * side * 0.75 + sin * 0.5) * speed,
        tint, 0.22 + random() * 0.2, 0.035 + random() * 0.03, random() < 0.5 ? 1 : 0, -6, 2.4);
    }
  }

  function beam(x, y, z, ex, ey, ez, tint, life = 0.22, width = 0.065) {
    const i = claim(beams, life), a = beams.arrays, v = i * 3, p = i * 4;
    a.aOrigin[v] = x; a.aOrigin[v + 1] = y; a.aOrigin[v + 2] = z;
    a.aVelocity[v] = ex; a.aVelocity[v + 1] = ey; a.aVelocity[v + 2] = ez;
    writeColor(beams, i, tint);
    a.aParams[p + 2] = width; a.aParams[p + 3] = 0;
  }

  const between = pair => pair[0] + random() * (pair[1] - pair[0]);
  /** Directed particles for callers that own a shape (flame jets, shard rings, mist fronts). `spec` is a constant table
   * { count, min, ring, spread, start: [a, b], height, speed: [a, b], rise: [a, b], life: [a, b], size: [a, b], gravity, drag };
   * nothing is allocated here and the pools, density and reduced-motion rules of this module still bound the result. */
  function spray(kind, x, y, z, dx, dz, spec, tint, scale = 1, speedScale = 1, spread = spec?.spread ?? 0.5) {
    const pool = kind === 'mist' || kind === 'dust' ? clouds : sparks;
    const shaderKind = kind === 'flame' ? 6 : kind === 'ember' ? 1 : kind === 'mist' ? 2 : kind === 'dust' ? 3 : 0;
    if (disposed || !spec || !Number.isFinite(x + y + z + dx + dz)) { rejected++; return 0; }
    const count = Math.max(spec.min ?? 1, Math.round(spec.count * clamp(finite(scale, 1), 0, 2) * config.density * (motionReduced ? 0.35 : 1)));
    const yaw = Math.atan2(dz, dx);
    for (let i = 0; i < count; i++) {
      const angle = spec.ring ? (i + random()) / count * TAU : yaw + (random() * 2 - 1) * spread;
      // `farBias` fills a widening shape evenly: area grows with distance, so more samples are born far away.
      const cos = Math.cos(angle), sin = Math.sin(angle), far = spec.farBias ? Math.sqrt(random()) : random(), start = (spec.start[0] + far * (spec.start[1] - spec.start[0])) * speedScale, speed = between(spec.speed) * speedScale;
      // `sizeByStart` lets a jet widen with distance: what spawns far along the shape is larger.
      particle(pool, x + cos * start, y + (random() - 0.5) * (spec.height ?? 0.2), z + sin * start, cos * speed, between(spec.rise), sin * speed,
        tint, between(spec.life), between(spec.size) * (1 + (spec.sizeByStart ?? 0) * far), shaderKind, spec.gravity ?? -4, spec.drag ?? 1.4);
    }
    return count;
  }

  function burst(position, tint, amount, spec = {}) {
    const count = Math.max(1, Math.round(amount * config.density * (motionReduced ? 0.35 : 1)));
    const speed = spec.speed ?? 4;
    for (let i = 0; i < count; i++) {
      const angle = random() * TAU, spread = (0.25 + random() * 0.75) * speed;
      const radial = (spec.radius ?? 0.12) * Math.sqrt(random());
      particle(spec.pool ?? sparks,
        position.x + Math.cos(angle) * radial, finite(position.y, 0.6) + random() * 0.18,
        position.z + Math.sin(angle) * radial,
        Math.cos(angle) * spread + (spec.dx ?? 0),
        (spec.rise ?? 2) * (0.3 + random()), Math.sin(angle) * spread + (spec.dz ?? 0),
        tint, (spec.life ?? 0.65) * (0.6 + random() * 0.7),
        (spec.size ?? 0.07) * (0.6 + random() * 0.7), spec.kind ?? 0,
        spec.gravity ?? -5, spec.drag ?? 1.7);
    }
  }

  function emit(type, position, options = {}) {
    if (disposed || !validPosition(position) || !(type in PALETTE)) { rejected++; return false; }
    eventCounts[type]++;
    const tint = options.color ?? PALETTE[type];
    const intensity = clamp(finite(options.intensity, 1), 0.1, 3);
    const radius = clamp(finite(options.radius, 2), 0.1, 18);
    const direction = options.direction;
    const yaw = direction ? Math.atan2(direction.z ?? 0, direction.x ?? 0) : finite(options.angle, random() * TAU);
    switch (type) {
      case 'impact':
        burst(position, tint, 18 * intensity, { speed: 4.5, rise: 3, life: 0.43 });
        glyph(3, position, tint, 0.68 * intensity, 0.17, yaw, Math.PI / 2);
        break;
      case 'blood':
        burst(position, tint, 11 * intensity, { pool: clouds, kind: 4, speed: 3.2, rise: 1.8, size: 0.075, life: 0.42, gravity: -9 });
        break;
      case 'muzzle':
        burst(position, tint, 8 * intensity, { speed: 1.6, rise: 0.5, life: 0.14, size: 0.085, gravity: 0,
          dx: (direction?.x ?? 0) * 5, dz: (direction?.z ?? 0) * 5 });
        glyph(3, position, tint, 0.5, 0.1, yaw, Math.PI / 2);
        break;
      case 'slash': {
        // The melee hero's basic strike. Colour is class-owned (steel edge, ember wake): legacy callers pass the table
        // colour of the relic that shares the weapon id, which would hand Aldric's swing to another owner.
        // The full turn of a finisher already carries this swing: do not stack a second arc and a 138° wedge on it.
        if (clock - lastFinisher.clock <= 0.034 && Math.hypot(position.x - lastFinisher.x, position.z - lastFinisher.z) < 2) break;
        const half = clamp(finite(options.arc, HERO_MELEE.arc), 0.2, 3.1), side = swingSerial++ % 2 ? -1 : 1;
        const life = motionReduced ? 0.12 : 0.16, steel = VFX_PALETTE.aldric.steel;
        glyph(BLADE, position, steel, radius, life, -yaw, 0, half * side);
        const reach = clamp(finite(options.reach, HERO_MELEE.range), radius, 18);
        groundPoint.x = position.x - (direction ? finite(direction.x, 0) * 0.35 : 0); groundPoint.y = 0.06;
        groundPoint.z = position.z - (direction ? finite(direction.z, 0) * 0.35 : 0);
        glyph(REACH, groundPoint, VFX_PALETTE.aldric.ember, reach, motionReduced ? 0.14 : 0.2, -yaw, 0, half);
        groundLight(groundPoint.x + Math.cos(yaw) * radius * 0.6, groundPoint.z + Math.sin(yaw) * radius * 0.6, VFX_PALETTE.aldric.ember, radius * 1.15, 0.18, 0.12 * intensity);
        arcSparks(position, yaw, half * 0.8, radius * 0.9, VFX_PALETTE.aldric.spark, 7 * intensity, side);
        break;
      }
      case 'arc': {
        // Coloured blade arc for relics and companions: same thin language, owner colour, caller-defined span.
        const half = clamp(finite(options.arc, 1.1), 0.2, 3.3), side = options.mirror ? -1 : 1;
        glyph(BLADE, position, tint, radius, clamp(finite(options.life, 0.2), 0.08, 0.5), -yaw, 0, (half + 10) * side);
        if (options.sparks !== false) arcSparks(position, yaw, Math.min(half, Math.PI) * 0.8, radius * 0.9, tint, 6 * intensity, side);
        break;
      }
      case 'light':
        groundLight(position.x, position.z, tint, radius, clamp(finite(options.life, 0.25), 0.05, 1.2), 0.5 * intensity);
        break;
      case 'reach':
        // Quiet ground wedge of an authoritative cone: `radius` is the real range and `arc` the real half-angle.
        groundPoint.x = position.x; groundPoint.y = 0.06; groundPoint.z = position.z;
        glyph(REACH, groundPoint, tint, radius, clamp(finite(options.life, 0.2), 0.08, 0.6), -yaw, 0, clamp(finite(options.arc, HERO_MELEE.arc), 0.1, 3.1));
        break;
      case 'finisher': {
        // Third hit of the combo: a full heavy turn of the blade, a SOLID shock band that stops on the authoritative
        // radius, light on the ground, a ring of embers and a longer hold (0.46 s against the 0.16 s of a plain hit).
        const hold = motionReduced ? 0.28 : 0.46, ember = VFX_PALETTE.aldric.ember, side = swingSerial++ % 2 ? -1 : 1;
        lastFinisher.clock = clock; lastFinisher.x = position.x; lastFinisher.z = position.z;
        groundPoint.x = position.x; groundPoint.y = 0.058; groundPoint.z = position.z;
        glyph(SOLID_RING, groundPoint, ember, radius, hold, random() * TAU, 0, 1);
        groundLight(position.x, position.z, ember, radius * 0.9, hold * 0.55, 0.34);
        samplePoint.set(position.x, finite(options.height, 1.25), position.z);
        glyph(BLADE, samplePoint, VFX_PALETTE.aldric.steel, Math.min(radius * 0.58, 3.4), motionReduced ? 0.2 : 0.3, -yaw, 0, 3.3 * side);
        glyph(FLASH, samplePoint, 0xfff1d6, 1.5, 0.12, 0, Math.PI / 2);
        const embers = Math.max(6, Math.round(40 * intensity * config.density * (motionReduced ? 0.35 : 1)));
        for (let i = 0; i < embers; i++) {
          const angle = i / embers * TAU + random() * 0.3, cos = Math.cos(angle), sin = Math.sin(angle), start = 0.8 + random() * 0.8, speed = (radius - start) / 0.34 * (0.55 + random() * 0.5);
          particle(sparks, position.x + cos * start, 0.25 + random() * 0.9, position.z + sin * start, cos * speed, 1.5 + random() * 3.2, sin * speed,
            i % 3 ? VFX_PALETTE.aldric.spark : ember, 0.45 + random() * 0.4, 0.07 + random() * 0.06, 1, -7, 2.6);
        }
        const puffs = Math.max(3, Math.round(10 * config.density * (motionReduced ? 0.35 : 1)));
        for (let i = 0; i < puffs; i++) {
          const angle = i / puffs * TAU + random(), cos = Math.cos(angle), sin = Math.sin(angle), reach = radius * (0.5 + random() * 0.4);
          particle(clouds, position.x + cos * reach, 0.15, position.z + sin * reach, cos * 2.8, 0.35 + random() * 0.4, sin * 2.8, 0x4f4a42, 0.45 + random() * 0.25, 0.24 + random() * 0.16, 3, -0.3, 2.2);
        }
        break;
      }
      case 'fire':
        burst(position, tint, 12 * intensity, { kind: 6, speed: 0.55, rise: 1.9, life: 0.65, size: 0.25, gravity: 0.8, radius: radius * 0.22 });
        burst(position, 0xfff6e5, 8 * intensity, { kind: 1, speed: 1.1, rise: 2.8, life: 1.2, size: 0.035, gravity: 0.8 });
        break;
      case 'ember':
        burst(position, tint, 5 * intensity, { kind: 1, speed: 0.9, rise: 1.7, life: 1.15, size: 0.035, gravity: 0.6 });
        break;
      case 'frost':
        burst(position, tint, 24 * intensity, { speed: 4, rise: 1.4, life: 0.8, size: 0.09, gravity: -2 });
        burst(position, tint, 5 * intensity, { pool: clouds, kind: 2, speed: 0.5, rise: 0.7, life: 1, size: 0.7, gravity: 0.05 });
        glyph(0, { x: position.x, y: 0.055, z: position.z }, tint, radius, 0.55);
        break;
      case 'lightning': {
        // A ribbon with body: jagged hot core, a wide soft sheath along the true line and short forks.
        const target = validPosition(options.target) ? options.target : { x: position.x, y: finite(position.y, 0) + 6, z: position.z };
        const segments = motionReduced ? 4 : currentQuality === 'low' ? 5 : 8, life = motionReduced ? 0.12 : 0.24;
        let x = position.x, y = finite(position.y, 1), z = position.z;
        const dx = target.x - x, dy = finite(target.y, 1) - y, dz = target.z - z;
        const sway = Math.min(0.7, Math.hypot(dx, dy, dz) * 0.085);
        if (currentQuality !== 'low') beam(x, y, z, target.x, finite(target.y, 1), target.z, tint, life * 0.8, 0.42 * intensity);
        for (let i = 1; i <= segments; i++) {
          const t = i / segments, jitter = Math.sin(t * Math.PI) * sway;
          const ex = position.x + dx * t + (random() - 0.5) * jitter;
          const ey = finite(position.y, 1) + dy * t + (random() - 0.5) * jitter;
          const ez = position.z + dz * t + (random() - 0.5) * jitter;
          beam(x, y, z, ex, ey, ez, tint, life, 0.15 * intensity);
          if (i % 3 === 0 && !motionReduced) beam(ex, ey, ez, ex + (random() - 0.5) * 1.4, ey - 0.3 + random() * 0.6, ez + (random() - 0.5) * 1.4, tint, 0.15, 0.06 * intensity);
          x = ex; y = ey; z = ez;
        }
        burst(position, tint, 10 * intensity, { speed: 3, life: 0.3, gravity: 0 });
        break;
      }
      case 'shockwave':
        glyph(0, { x: position.x, y: finite(options.groundY, 0.055), z: position.z }, tint, radius, 0.65);
        burst(position, PALETTE.dust, 10 * intensity, { pool: clouds, kind: 3, speed: 3.2, rise: 0.9, size: 0.3, life: 0.6, radius: radius * 0.2 });
        break;
      case 'dust':
        burst(position, tint, 7 * intensity, { pool: clouds, kind: 3, speed: 1, rise: 0.45, size: 0.22, life: 0.7, gravity: -0.3 });
        break;
      case 'smoke':
        burst(position, tint, 5 * intensity, { pool: clouds, kind: 2, speed: 0.4, rise: 0.8, size: 0.65, life: 1.65, gravity: 0.15 });
        break;
      case 'heal':
      case 'levelUp':
        glyph(1, { x: position.x, y: 0.07, z: position.z }, tint, type === 'levelUp' ? 2.5 : 1.45, 1.1);
        burst(position, tint, type === 'levelUp' ? 48 : 18, { speed: 1.6, rise: 4, life: 1.15, size: 0.055, gravity: 0.4, radius: 0.7 });
        break;
      case 'death':
        burst(position, tint, 22 * intensity, { speed: 2.8, rise: 2, life: 0.9, size: 0.045, gravity: 0.1 });
        burst(position, 0x334154, 6, { pool: clouds, kind: 2, speed: 1.4, rise: 0.7, size: 0.44, life: 0.85, gravity: 0 });
        break;
      case 'teleport':
      case 'shadow':
        glyph(1, { x: position.x, y: 0.065, z: position.z }, tint, radius, 0.85);
        burst(position, tint, 30 * intensity, { speed: 2, rise: 3.5, life: 0.9, size: 0.06, gravity: 0.3, radius: 0.45 });
        if (type === 'shadow') burst(position, 0x34324b, 10, { pool: clouds, kind: 2, speed: 0.6, rise: 1.2, size: 0.4, life: 0.9, gravity: 0 });
        break;
      case 'seal':
      case 'target':
        glyph(1, { x: position.x, y: finite(position.y, 0.07), z: position.z }, tint, radius, clamp(finite(options.life, 1.3), 0.1, 5));
        break;
      case 'judgement':
        glyph(1, { x: position.x, y: finite(position.y, 0) + 3.8, z: position.z }, tint, radius * 0.7, 0.95);
        beam(position.x, 0.1, position.z, position.x, finite(position.y, 0) + 3.8, position.z, tint, 0.55, 0.3);
        emit('shockwave', position, { color: tint, radius, intensity });
        burst(position, tint, 40 * intensity, { kind: 1, speed: 5, rise: 5, life: 1, size: 0.06, gravity: -5 });
        break;
      case 'bladeStorm':
        glyph(1, { x: position.x, y: 0.08, z: position.z }, tint, radius, 0.7);
        for (let i = 0; i < Math.round(7 * config.density); i++) {
          const angle = i / 7 * TAU;
          const x = position.x + Math.cos(angle) * radius * 0.65, z = position.z + Math.sin(angle) * radius * 0.65;
          beam(x, 3.6, z, x - Math.cos(angle) * 0.7, 0.3, z - Math.sin(angle) * 0.7, tint, 0.4 + i * 0.03, 0.07);
        }
        burst(position, tint, 24 * intensity, { speed: 3.5, rise: 2.5, life: 0.7 });
        break;
      case 'ambient':
        burst(position, tint, 3, { kind: 5, speed: 0.15, rise: 0.15, life: 4, size: 0.028, gravity: 0 });
        break;
    }
    return true;
  }

  function updatePool(pool) {
    pool.material.uniforms.uTime.value = clock;
    if (pool.dirty) {
      for (const attribute of Object.values(pool.attributes)) attribute.needsUpdate = true;
      pool.geometry.instanceCount = pool.written;
      pool.dirty = false;
    }
    let active = 0;
    const params = pool.arrays.aParams;
    for (let i = 0; i < pool.written; i++) if (params[i * 4 + 1] > 0 && clock < params[i * 4] + params[i * 4 + 1]) active++;
    pool.active = active;
    pool.mesh.visible = active > 0;
  }

  /** dt is simulation time: pass 0 while paused. No wall clock is sampled. */
  function update(dt, { playerPosition } = {}) {
    if (disposed) return;
    const step = clamp(finite(dt, 0), 0, 0.15);
    clock += step;
    if (ambientEnabled && !motionReduced && validPosition(playerPosition)) {
      ambientDebt += step * config.ambient;
      if (ambientDebt >= 0.11) {
        ambientDebt %= 0.11;
        const angle = random() * TAU, radius = 3 + random() * 20;
        particle(sparks, playerPosition.x + Math.cos(angle) * radius, 0.25 + random() * 4,
          playerPosition.z + Math.sin(angle) * radius, 0.1, 0.06, -0.04, 0x7dafa6, 5 + random() * 3, 0.022, 5, 0, 0.1);
        if (random() < 0.15) particle(clouds, playerPosition.x + Math.cos(angle) * radius,
          0.22, playerPosition.z + Math.sin(angle) * radius, 0.2, 0.015, -0.1,
          0x597380, 7, 1.5 + random(), 2, 0, 0.1);
      }
    }
    for (const emitter of emitters) emitter.update(step);
    for (const pool of pools) updatePool(pool);
    leaves.update(clock, step, playerPosition, currentQuality, motionReduced);
    markers.update(clock, step, motionReduced);
    souls.update(step, currentQuality);
  }

  function setQuality(value) {
    if (disposed) return;
    currentQuality = QUALITY[value] ? value : 'medium';
    config = QUALITY[currentQuality];
    [sparks.limit, clouds.limit, glyphs.limit, beams.limit] = [config.particles, config.clouds, config.glyphs, config.beams];
    for (const pool of pools) {
      pool.head %= pool.limit;
      pool.written = Math.min(pool.written, pool.limit);
      pool.dirty = true;
    }
  }

  function setReducedMotion(value) {
    motionReduced = Boolean(value);
    for (const pool of pools) pool.material.uniforms.uMotion.value = motionReduced ? 0.22 : 1;
    reset();
  }

  function reset() {
    if (disposed) return;
    clock = 0; ambientDebt = 0; lastFinisher.clock = -1;
    leaves.reset(); markers.reset(); souls.reset();
    for (const pool of pools) {
      pool.head = 0; pool.written = 0; pool.active = 0;
      pool.arrays.aParams.fill(0); pool.dirty = true;
      pool.geometry.instanceCount = 0; pool.mesh.visible = false;
    }
  }

  /** Sample a real weapon surface; clone heat materials so the body stays unchanged. */
  function attachWeapon(mesh, { intensity = 0.6, rate = 18 } = {}) {
    if (disposed || emitters.size >= 4 || !mesh?.geometry?.attributes?.position) return { dispose() {} };
    const geometry = mesh.geometry, positions = geometry.attributes.position, indices = geometry.index;
    const triangleCount = Math.floor((indices ? indices.count : positions.count) / 3);
    const cumulative = new Float32Array(triangleCount);
    let area = 0, debt = 0;
    const vertexIndex = index => indices ? indices.getX(index) : index;
    for (let i = 0; i < triangleCount; i++) {
      vertexA.fromBufferAttribute(positions, vertexIndex(i * 3));
      vertexB.fromBufferAttribute(positions, vertexIndex(i * 3 + 1));
      vertexC.fromBufferAttribute(positions, vertexIndex(i * 3 + 2));
      edgeA.subVectors(vertexB, vertexA); edgeB.subVectors(vertexC, vertexA);
      area += sampleNormal.crossVectors(edgeA, edgeB).length() * 0.5;
      cumulative[i] = area;
    }
    if (area <= 0) return { dispose() {} };
    const original = mesh.material;
    // The analytic distance is exact for BIPX's box blade. Other mesh shapes
    // keep triangle-sampled flames; do not pretend their bounding box is steel.
    const volume = geometry.type === 'BoxGeometry' ? createWeaponFireVolume(THREE, mesh) : null;
    const originals = Array.isArray(original) ? original : [original];
    const heatTime = { value: 0 }, heatAmount = { value: clamp(intensity, 0, 2) };
    const clones = originals.map(material => {
      const clone = material.clone();
      if (clone.isMeshStandardMaterial || clone.isMeshPhongMaterial) {
        clone.onBeforeCompile = shader => {
          shader.uniforms.uVfxHeatTime = heatTime;
          shader.uniforms.uVfxHeatAmount = heatAmount;
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
            `#include <common>\nuniform float uVfxHeatTime; uniform float uVfxHeatAmount;\n${thermalGLSL}`);
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>\nfloat vfxEdge = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);\nfloat vfxHeat = 0.85 + 0.15 * sin(uVfxHeatTime * 2.1 + vViewPosition.y * 5.0);\ntotalEmissiveRadiance += blackbody(2200.0 + vfxEdge * 700.0) * (0.35 + vfxEdge) * vfxHeat * uVfxHeatAmount;`);
        };
        clone.customProgramCacheKey = () => 'bipx-samurai-weapon-heat-v1';
      }
      return clone;
    });
    mesh.material = Array.isArray(original) ? clones : clones[0];
    let detached = false;
    const emitter = {
      update(dt) {
        heatTime.value = clock;
        heatAmount.value = motionReduced ? intensity * 0.45 : intensity;
        volume?.update(clock, dt, currentQuality, motionReduced, intensity);
        debt += dt * rate * config.density * (motionReduced ? 0.2 : 1);
        const count = Math.min(6, Math.floor(debt));
        debt -= count;
        if (!count || !mesh.visible) return;
        mesh.updateWorldMatrix(true, false);
        for (let i = 0; i < count; i++) {
          const pick = random() * area;
          let lo = 0, hi = triangleCount - 1;
          while (lo < hi) { const middle = (lo + hi) >> 1; if (cumulative[middle] < pick) lo = middle + 1; else hi = middle; }
          vertexA.fromBufferAttribute(positions, vertexIndex(lo * 3));
          vertexB.fromBufferAttribute(positions, vertexIndex(lo * 3 + 1));
          vertexC.fromBufferAttribute(positions, vertexIndex(lo * 3 + 2));
          const s = Math.sqrt(random()), t = random();
          samplePoint.copy(vertexA).multiplyScalar(1 - s).addScaledVector(vertexB, s * (1 - t)).addScaledVector(vertexC, s * t).applyMatrix4(mesh.matrixWorld);
          edgeA.subVectors(vertexB, vertexA); edgeB.subVectors(vertexC, vertexA);
          sampleNormal.crossVectors(edgeA, edgeB).normalize().transformDirection(mesh.matrixWorld);
          particle(sparks, samplePoint.x, samplePoint.y, samplePoint.z, sampleNormal.x * 0.3,
            0.6 + random() * 0.6, sampleNormal.z * 0.3, 0xffead2, 0.65, 0.095, 6, 0.6, 1.4);
          particle(sparks, samplePoint.x, samplePoint.y, samplePoint.z, sampleNormal.x * 0.5,
            1.2 + random(), sampleNormal.z * 0.5, 0xffedda, 0.8, 0.018, 1, 0.4, 1.1);
        }
      },
      dispose() {
        if (detached) return;
        detached = true;
        if (mesh.material === clones[0] || (Array.isArray(mesh.material) && mesh.material === clones)) mesh.material = original;
        for (const clone of clones) clone.dispose();
        volume?.dispose();
        emitters.delete(emitter);
      },
      get hasVolume() { return volume?.visible ?? false; },
    };
    emitters.add(emitter);
    return emitter;
  }

  /** A distance-bounded trail; caller supplies actual world-space endpoints. */
  function emitTrail(from, to, type = 'ember', options = {}) {
    if (disposed || !validPosition(from) || !validPosition(to)) return false;
    const distance = Math.hypot(to.x - from.x, finite(to.y, 0) - finite(from.y, 0), to.z - from.z);
    const count = clamp(Math.ceil(distance * 3 * config.density), 1, 12);
    const tint = options.color ?? PALETTE[type] ?? PALETTE.ember;
    // 'fire' and 'ember' cool through the blackbody ramp; any other type ('glow') keeps the owner's colour.
    const size = clamp(finite(options.size, type === 'fire' ? 0.11 : 0.035), 0.01, 0.4), life = clamp(finite(options.life, 0.35), 0.05, 1.2);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      particle(sparks, from.x + (to.x - from.x) * t, finite(from.y, 0) + (finite(to.y, 0) - finite(from.y, 0)) * t,
        from.z + (to.z - from.z) * t, 0, 0.4, 0, tint, life, size,
        type === 'fire' ? 6 : type === 'ember' ? 1 : 0, 0.2, 1);
    }
    return true;
  }

  function getStats() {
    return {
      quality: currentQuality, reducedMotion: motionReduced, disposed, time: clock,
      activeParticles: sparks.active + clouds.active, activeGlyphs: glyphs.active, activeBeamSegments: beams.active,
      particleCapacity: config.particles + config.clouds, glyphCapacity: config.glyphs,
      beamCapacity: config.beams, drawCalls: pools.filter(pool => pool.mesh.visible).length + Array.from(emitters).filter(emitter => emitter.hasVolume).length + (leaves.visible ? 1 : 0) + (markers.count ? 2 : 0) + souls.count,
      leaves: leaves.count, targetMarkers: markers.count, soulEchoes: souls.count, soulPoseBake: souls.stats,
      totalEmitted, overwritten, rejected, attachedWeapons: emitters.size, events: { ...eventCounts },
      sourceCommit: '496862cda55bfba3be6d02eec5aee3ca808a31a3',
    };
  }

  function dispose() {
    if (disposed) return;
    reset();
    for (const emitter of Array.from(emitters)) emitter.dispose();
    leaves.dispose(); markers.dispose(); souls.dispose();
    group.removeFromParent();
    for (const pool of pools) { pool.geometry.dispose(); pool.material.dispose(); }
    disposed = true;
  }

  setQuality(currentQuality);
  /** One straight luminous ribbon between two points (light columns, lances). Same bounded beam pool as lightning. */
  function emitBeam(from, to, tint, width = 0.2, life = 0.2) {
    if (disposed || !validPosition(from) || !validPosition(to)) { rejected++; return false; }
    beam(from.x, finite(from.y, 1), from.z, to.x, finite(to.y, 1), to.z, tint, motionReduced ? Math.min(life, 0.14) : life, clamp(finite(width, 0.2), 0.02, 1.2));
    return true;
  }

  return { emit, emitTrail, emitBeam, spray, update, setQuality, setReducedMotion, reset, getStats, dispose, attachWeapon,
    setTargets: targets => markers.setTargets(targets),
    setSoulSource: mesh => souls.setSource(mesh),
    summonEcho: (position, options) => souls.summon(position, options, currentQuality, motionReduced),
    setAmbient(value) { ambientEnabled = Boolean(value); leaves.setEnabled(value); } };
}
