/** Presentation of the legacy arsenal: relic infusions of the basic attack and the three automatic weapons.
 * Events come from src/combat/arsenal.mjs — produced locally in solo, by the server in multiplayer.
 * Dialect (same as the class skills): a hot additive core, a soft body with volume (flame/mist/shard sprites and
 * luminous ribbons from the shared combat pools), a quiet honest mark on the ground and a pool of fake light under
 * every flash. Ground marks always end on the authoritative radius / range / half-angle carried by the event.
 * Colours come from palette.js. Automatic weapons are passives and run at about half the intensity of a relic.
 * Everything is pooled and bounded; nothing is allocated per frame. No damage, targets, timers, scene lights or
 * camera motion live here.
 */
import { VFX_PALETTE } from './palette.js';

const QUALITY = Object.freeze({
  high: { glyphs: 96, bodies: 24, trails: true, chain: 7, sparks: 1, light: 1 },
  medium: { glyphs: 64, bodies: 16, trails: true, chain: 5, sparks: .6, light: .8 },
  low: { glyphs: 36, bodies: 10, trails: false, chain: 3, sparks: .3, light: 0 },
});
const ACTORS = 4, PERSISTENT = ACTORS * 2, GROUND = .085, BODY_HEIGHT = 1.12, TAU = Math.PI * 2;
const RING = 0, FAN = 1, LANE = 2, RUNE = 3, CRACK = 4, BAND = 5, AURA = 6, LIGHT = 7;
const RELIC_COLORS = VFX_PALETTE.relic, AUTO_COLORS = VFX_PALETTE.auto;
const PASSIVE = .5; // automatic weapons whisper next to what the player actively did
const BODY_KINDS = ['bolt', 'blade', 'axe', 'seal', 'shell', 'orb'];
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const valid = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
// Constant particle tables for combatVfx.spray (speeds are tuned for a 7.5 m cone / 5 m blast and scaled per event).
const SPRAY = Object.freeze({
  // The jet is born along the whole cone and drifts forward: start + travel never passes the range (5.2 + 6.5·0.35 = 7.5 m).
  flameJet: { count: 20, min: 5, farBias: true, spread: .6, start: [.8, 5.2], height: .5, speed: [2.5, 6.5], rise: [.4, 2.4], life: [.3, .5], size: [.26, .46], sizeByStart: 1, gravity: 1.2, drag: 1.5 },
  flameCore: { count: 4, min: 2, spread: .18, start: [.6, 1.1], height: .2, speed: [5, 9], rise: [.2, .8], life: [.12, .2], size: [.32, .48], gravity: .5, drag: 1 },
  flameEmbers: { count: 9, min: 2, spread: .7, start: [1, 3], height: .6, speed: [4, 8], rise: [1, 3.6], life: [.6, 1.1], size: [.03, .055], gravity: .6, drag: 1.5 },
  windStreaks: { count: 14, min: 4, ring: true, start: [2.2, 4], height: .9, speed: [.4, 1.6], rise: [.3, 1.6], life: [.2, .34], size: [.035, .06], gravity: -1, drag: 1 },
  dustRing: { count: 9, min: 3, ring: true, start: [1.6, 3.4], height: .05, speed: [1.6, 3], rise: [.3, .7], life: [.4, .7], size: [.22, .36], gravity: -.3, drag: 2.2 },
  boneShards: { count: 22, min: 6, ring: true, start: [.3, 1.6], height: .3, speed: [2, 5.2], rise: [3.5, 8], life: [.5, .85], size: [.09, .17], gravity: -16, drag: .7 },
  frostShards: { count: 22, min: 6, ring: true, start: [1, 3.2], height: .4, speed: [4, 9.5], rise: [.8, 3], life: [.4, .75], size: [.05, .1], gravity: -6, drag: 1.9 },
  frostMist: { count: 12, min: 3, ring: true, start: [2, 5.4], height: .1, speed: [1.5, 3.4], rise: [.2, .6], life: [.7, 1.1], size: [.5, .85], gravity: .05, drag: 1.6 },
  nodeSparks: { count: 6, min: 2, ring: true, start: [.05, .3], height: .5, speed: [2.5, 6], rise: [1, 3.5], life: [.18, .34], size: [.035, .06], gravity: -9, drag: 1.6 },
  sealEmbers: { count: 12, min: 3, ring: true, start: [.2, 2], height: .2, speed: [.6, 2.4], rise: [2.2, 5], life: [.5, .9], size: [.035, .06], gravity: .4, drag: 1.3 },
  gainMotes: { count: 16, min: 4, ring: true, start: [.5, 1.3], height: .2, speed: [.2, .9], rise: [2, 4.2], life: [.6, 1], size: [.035, .055], gravity: .4, drag: 1.1 },
});

const glyphVertex = /* glsl */ `
uniform float uTime;
attribute vec3 aOrigin; attribute vec4 aParams; attribute vec4 aShape; attribute vec3 aColor;
varying vec2 vUv; varying vec4 vShape; varying vec3 vColor; varying float vKind; varying float vT; varying float vSize;
void main() {
  float age = uTime - aParams.x, life = max(aParams.y, .001);
  vT = (age < 0. || age > life) ? -1. : clamp(age / life, 0., 1.);
  vKind = aParams.w; vShape = aShape; vColor = aColor; vSize = max(aParams.z, .05);
  float lane = step(1.5, vKind) * step(vKind, 2.5);
  vec2 quad = position.xy;
  vec2 local = mix(quad * aParams.z, vec2((quad.x * .5 + .5) * aParams.z, quad.y * aShape.y), lane);
  vUv = mix(quad, vec2(quad.x * .5 + .5, quad.y), lane);
  float c = cos(aShape.x), s = sin(aShape.x);
  vec3 world = aOrigin + vec3(local.x * c - local.y * s, 0., local.x * s + local.y * c);
  gl_Position = vT < 0. ? vec4(2., 2., 2., 1.) : projectionMatrix * modelViewMatrix * vec4(world, 1.);
}`;
const glyphFragment = /* glsl */ `
uniform float uTime; uniform float uMotion;
varying vec2 vUv; varying vec4 vShape; varying vec3 vColor; varying float vKind; varying float vT; varying float vSize;
float band(float r, float center, float width) { float d = (r - center) / width; return exp(-d * d); }
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y); }
void main() {
  if (vT < 0.) discard;
  float t = vT, fade = 1. - t, r = length(vUv), angle = atan(vUv.y, vUv.x), alpha = 0., hot = 0.;
  if (vKind < .5) {
    // Quiet honest ring: the front stops on the authoritative radius. Never thinner than ~11 cm of world.
    float front = mix(.22, .972, 1. - pow(1. - t, 2.4)), width = max(.02, .055 / vSize);
    alpha = (band(r, front, width) * .5 + band(r, front, width * 4.) * .07) * fade;
  } else if (vKind < 1.5) {
    // Heat on the ground under a cone: soft, turbulent, no fan outline. A short tick marks the real range.
    float edge = 1. - smoothstep(vShape.y - .24, vShape.y + .02, abs(angle));
    float reach = mix(.35, 1., 1. - pow(1. - t, 3.));
    float along = smoothstep(.02, .22, r) * (1. - smoothstep(reach - .4, reach, r));
    float flow = noise(vec2(r * 7. - t * 6. * uMotion + vShape.z, angle * 5.));
    float tick = band(r, .985, max(.008, .035 / vSize)) * (1. - smoothstep(.2, .6, t)) * (1. - smoothstep(vShape.y - .04, vShape.y + .01, abs(angle)));
    alpha = edge * along * (.5 + .5 * flow) * .15 * fade + tick * .26;
  } else if (vKind < 2.5) {
    // Thrust lane: hot core line, soft sheath, a head that runs to the wall-clipped length.
    float across = abs(vUv.y), head = mix(.18, 1., 1. - pow(1. - t, 3.));
    float along = (1. - smoothstep(head - .07, head, vUv.x)) * smoothstep(0., .05, vUv.x);
    hot = exp(-across * across * 70.) * along * fade;
    alpha = (exp(-across * across * 26.) * .6 + exp(-across * across * 3.) * .09) * along * fade + band(vUv.x, head, .02) * exp(-across * across * 5.) * fade * .5;
  } else if (vKind < 3.5) {
    // Quiet reticle for friendly wind-ups and marks.
    float turn = angle + t * 1.5 * uMotion + vShape.z, width = max(.018, .04 / vSize);
    float appear = smoothstep(0., .12, t) * (1. - smoothstep(.72, 1., t));
    alpha = (band(r, .9, width) * .42 + band(r, .72, width * 1.5) * step(.45, sin(turn * 8.)) * .3 + exp(-r * r * 9.) * .1) * appear;
  } else if (vKind < 4.5) {
    float cracks = pow(abs(sin(angle * 5. + vShape.z) * sin(angle * 9. - vShape.z * 1.7)), 6.), grow = 1. - pow(1. - t, 3.);
    alpha = (1. - smoothstep(grow - .5, grow, r)) * (.03 + cracks * .7) * fade * fade;
  } else if (vKind < 5.5) {
    // Solid shock band: a body, not a line, and it stops exactly on the authoritative radius.
    float grow = 1. - pow(1. - clamp(t / .4, 0., 1.), 3.); grow = mix(1., grow, uMotion);
    // The front is torn by noise on its inner side only, so its outer edge still ends on the radius.
    float tear = noise(vec2(angle * 5. + vShape.z, t * 3.)), width = max(.024, .12 / vSize) * (.7 + .6 * tear);
    float front = mix(.12, .995 - width, grow);
    float solid = 1. - smoothstep(width * .55, width, abs(r - front));
    float core = band(r, front + width * .35, width * .28), hold = 1. - smoothstep(.45, 1., t);
    float wake = smoothstep(front - .3, front, r) * step(r, front) * .05 * (1. - t);
    hot = core * hold * (.6 + .4 * tear);
    alpha = (solid * (.3 + .25 * tear) + core * .55 + wake) * hold;
  } else if (vKind < 6.5) {
    // Infusion: a breathing pool of relic light under the hero instead of a saturated rune circle.
    float breathe = .82 + .18 * sin(uTime * 2.2 * uMotion + vShape.z);
    alpha = exp(-r * r * 3.2) * (1. - smoothstep(.7, 1., r)) * .13 * breathe + band(r, .66, .024) * .05;
  } else {
    // Fake light: what just flashed above the ground lights it for a moment.
    alpha = exp(-r * r * 3.4) * (1. - smoothstep(.75, 1., r)) * pow(1. - t, 1.5);
  }
  alpha *= vShape.w;
  if (alpha < .004) discard;
  hot = clamp(hot, 0., 1.);
  gl_FragColor = vec4(mix(vColor, vec3(1.), hot * .7) * (1.45 + hot * 1.4), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createArsenalVfx({ THREE, scene, combatVfx = null, elementalVfx = null, quality = 'medium', reducedMotion = false } = {}) {
  if (!THREE?.InstancedBufferGeometry || !scene?.add) throw new TypeError('createArsenalVfx requires THREE and scene');
  const group = new THREE.Group(); group.name = 'ArsenalVfx'; group.userData.excludeFromSceneDepth = true; scene.add(group);
  let level = QUALITY[quality] ? quality : 'medium', config = QUALITY[level], reduced = Boolean(reducedMotion);
  let clock = 0, disposed = false, emitted = 0, overwritten = 0, rejected = 0, serial = 1, lights = 0, sprayed = 0;
  const counts = { relic: 0, projectile: 0, auto: 0, state: 0 };
  const color = new THREE.Color(), point = new THREE.Vector3(), pointB = new THREE.Vector3();
  const scratchTarget = { x: 0, y: 0, z: 0 }, scratchDirection = { x: 0, z: 0 }, scratchArc = { color: 0, radius: 1, direction: scratchDirection, arc: 1, life: .2, mirror: false, sparks: true, intensity: 1 };
  const novaRim = { radius: 1, intensity: .8, surface: false }, NOVA_RIM = radius => { novaRim.radius = radius; return novaRim; };
  const scratchLightning = { color: 0, target: scratchTarget, intensity: 1 }, scratchBurst = { color: 0, intensity: 1, radius: 1 }, scratchTrail = { color: 0, size: .05, life: .25 };

  // ---- ground pool: one instanced draw for rings, heat fans, lanes, reticles, cracks, shock bands, auras and light ----
  const capacity = QUALITY.high.glyphs + PERSISTENT, geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const arrays = { aOrigin: new Float32Array(capacity * 3), aParams: new Float32Array(capacity * 4), aShape: new Float32Array(capacity * 4), aColor: new Float32Array(capacity * 3) };
  const attributes = {};
  for (const [name, array] of Object.entries(arrays)) {
    attributes[name] = new THREE.InstancedBufferAttribute(array, name === 'aOrigin' || name === 'aColor' ? 3 : 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attributes[name]);
  }
  const attributeList = Object.values(attributes);
  geometry.instanceCount = capacity;
  const glyphMaterial = new THREE.ShaderMaterial({ name: 'ArsenalGroundGlyphs', vertexShader: glyphVertex, fragmentShader: glyphFragment,
    uniforms: { uTime: { value: 0 }, uMotion: { value: reduced ? 0 : 1 } }, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: true });
  const glyphMesh = new THREE.Mesh(geometry, glyphMaterial);
  glyphMesh.name = 'ArsenalGroundGlyphs'; glyphMesh.frustumCulled = false; glyphMesh.visible = false; glyphMesh.renderOrder = 3; glyphMesh.raycast = () => {};
  group.add(glyphMesh);
  let head = 0, dirty = false, activeGlyphs = 0;
  function writeGlyph(index, kind, x, z, size, life, yaw, shape, tint, intensity, keepBirth = false) {
    const o = index * 3, p = index * 4;
    arrays.aOrigin[o] = x; arrays.aOrigin[o + 1] = GROUND + (index % 7) * .004; arrays.aOrigin[o + 2] = z;
    if (!keepBirth) arrays.aParams[p] = clock;
    arrays.aParams[p + 1] = life; arrays.aParams[p + 2] = size; arrays.aParams[p + 3] = kind;
    arrays.aShape[p] = yaw; arrays.aShape[p + 1] = shape; if (!keepBirth) arrays.aShape[p + 2] = (serial++ * 2.399) % 40; arrays.aShape[p + 3] = intensity;
    color.set(tint); arrays.aColor[o] = color.r; arrays.aColor[o + 1] = color.g; arrays.aColor[o + 2] = color.b;
    dirty = true;
  }
  function glyph(kind, x, z, size, life, tint, yaw = 0, shape = 0, intensity = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !(size > 0)) { rejected++; return; }
    const index = PERSISTENT + head, p = index * 4;
    if (arrays.aParams[p + 1] > 0 && clock < arrays.aParams[p] + arrays.aParams[p + 1]) overwritten++;
    head = (head + 1) % config.glyphs; emitted++;
    writeGlyph(index, kind, x, z, size, Math.max(.05, reduced ? Math.min(life, .45) : life), yaw, shape, tint, clamp(intensity, .04, 1.6));
  }
  /** Fake light on the ground. Skipped on low quality, where the honest mark alone carries the effect. */
  function light(x, z, radius, tint, strength, life = .26) {
    if (!(config.light > 0)) return;
    lights++; glyph(LIGHT, x, z, radius, life, tint, 0, 0, strength * config.light);
  }
  /** Persistent slot (aura / orb light): written in place every frame, born once. */
  function persist(slot, kind, x, z, size, tint, intensity) {
    const p = slot * 4, fresh = !(arrays.aParams[p + 1] > 0);
    writeGlyph(slot, kind, x, z, size, 1e9, 0, 0, tint, intensity, !fresh);
  }
  function clearPersistent(slot) { const p = slot * 4; if (arrays.aParams[p + 1] > 0) { arrays.aParams[p + 1] = 0; dirty = true; } }

  // ---- relic bodies in flight: pooled meshes; transforms only ----
  const bodyGroup = new THREE.Group(); bodyGroup.name = 'ArsenalRelicBodies'; group.add(bodyGroup);
  const shapes = {
    bolt: new THREE.ConeGeometry(.1, 1.25, 6), blade: new THREE.OctahedronGeometry(.5, 0), seal: new THREE.RingGeometry(.2, .42, 6),
    shell: new THREE.IcosahedronGeometry(.34, 0), orb: new THREE.IcosahedronGeometry(.55, 1), halo: new THREE.TorusGeometry(.78, .035, 6, 28),
    haft: new THREE.BoxGeometry(.09, .09, 1.15), head: new THREE.BoxGeometry(.62, .07, .46),
  };
  shapes.bolt.rotateX(Math.PI / 2); shapes.blade.scale(1.25, .09, .34); shapes.seal.rotateX(-Math.PI / 2); shapes.halo.rotateX(Math.PI / 2); shapes.head.translate(.3, 0, .36);
  const glow = (tint, opacity = .95) => new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  /** HDR tint: the scene target is half-float, so a gain above 1 feeds the bloom instead of clipping. */
  const tintGlow = (material, tint, gain) => { material.color.set(tint).multiplyScalar(gain); };
  const bodies = Array.from({ length: QUALITY.high.bodies }, (_, index) => {
    const material = glow(0xffffff), root = new THREE.Group(), parts = {};
    for (const kind of BODY_KINDS) {
      const part = kind === 'axe' ? new THREE.Group() : new THREE.Mesh(shapes[kind], material);
      if (kind === 'axe') part.add(new THREE.Mesh(shapes.haft, material), new THREE.Mesh(shapes.head, material));
      // A spinning rim keeps thin whirling bodies readable from the raised camera.
      if (kind === 'orb' || kind === 'axe' || kind === 'blade') { const rim = new THREE.Mesh(shapes.halo, material); if (kind === 'blade') rim.scale.setScalar(.62); part.add(rim); }
      part.visible = false; parts[kind] = part; root.add(part);
    }
    root.visible = false; bodyGroup.add(root);
    return { index, root, parts, material, id: null, kind: 'bolt', relic: '', tint: 0xffffff, x: 0, z: 0, vx: 0, vz: 0, age: 0, life: 0, born: 0, lit: 0, trail: new THREE.Vector3(), ribbon: { key: {}, radius: .5 } };
  });
  function releaseBody(body) { body.id = null; body.root.visible = false; body.parts[body.kind].visible = false; body.ribbon.key = {}; }
  function findBody(id) { for (const body of bodies) if (body.id === id) return body; return null; }
  function claimBody() {
    let oldest = bodies[0];
    for (let i = 0; i < config.bodies; i++) { if (bodies[i].id === null) return bodies[i]; if (bodies[i].born < oldest.born) oldest = bodies[i]; }
    overwritten++; releaseBody(oldest); return oldest;
  }

  // ---- companions: orbiting orb and guardian blade of each visible hero ----
  const companionGroup = new THREE.Group(); companionGroup.name = 'ArsenalCompanions'; group.add(companionGroup);
  const orbCore = new THREE.SphereGeometry(.26, 14, 10), orbRing = new THREE.TorusGeometry(.46, .028, 6, 28), bladeEdge = new THREE.BoxGeometry(.1, 1.05, .03), bladeGuard = new THREE.BoxGeometry(.36, .06, .08);
  orbRing.rotateX(Math.PI / 2); bladeEdge.translate(0, -.42, 0);
  const actors = Array.from({ length: ACTORS }, (_, index) => {
    // Core + soft shell give the companions a body; the shell is the same geometry, larger and faint.
    const orbMaterial = glow(AUTO_COLORS.orbitOrb[0]), orbShell = glow(AUTO_COLORS.orbitOrb[0], .16), bladeMaterial = glow(AUTO_COLORS.guardianBlade[0]), bladeShell = glow(AUTO_COLORS.guardianBlade[0], .14);
    const orb = new THREE.Group(), shell = new THREE.Mesh(orbCore, orbShell); shell.scale.setScalar(2.1);
    orb.add(new THREE.Mesh(orbCore, orbMaterial), shell, new THREE.Mesh(orbRing, orbMaterial));
    const blade = new THREE.Group(), sheath = new THREE.Mesh(bladeEdge, bladeShell); sheath.scale.set(2.6, 1.06, 5);
    blade.add(new THREE.Mesh(bladeEdge, bladeMaterial), sheath, new THREE.Mesh(bladeGuard, bladeMaterial));
    orb.visible = blade.visible = false; companionGroup.add(orb, blade);
    return { index, id: null, seen: -1, x: 0, z: 0, relic: null, orbLevel: 0, orbEvolved: false, bladeLevel: 0, bladeEvolved: false, area: 1,
      angle: index * 1.7, orbit: index * .9, dash: 0, tx: 0, tz: 0, orb, blade, orbMaterial, orbShell, bladeMaterial, bladeShell, trail: new THREE.Vector3(), bladeTrail: new THREE.Vector3(), trailDebt: 0 };
  });
  function actorFor(id, create) {
    let free = null;
    for (const actor of actors) { if (actor.id === id) return actor; if (actor.id === null && !free) free = actor; }
    if (!create || !free) return null;
    free.id = id; free.dash = 0; free.trailDebt = 0; return free;
  }
  function releaseActor(actor) {
    actor.id = null; actor.relic = null; actor.orb.visible = actor.blade.visible = false; clearPersistent(actor.index * 2); clearPersistent(actor.index * 2 + 1);
  }
  /** Called every frame for each living hero on screen. `loadout` is the trusted { weaponId: { level, evolved } } mirror. */
  function syncActor(id, position, relic, loadout, areaMultiplier = 1) {
    if (disposed || !valid(position)) return;
    const actor = actorFor(id, true); if (!actor) return;
    actor.seen = clock; actor.x = position.x; actor.z = position.z; actor.area = Math.sqrt(clamp(finite(areaMultiplier, 1), 1, 2.25));
    actor.relic = Object.hasOwn(RELIC_COLORS, relic) ? relic : null;
    actor.orbLevel = loadout?.orbitOrb?.level > 0 ? 1 : 0; actor.orbEvolved = Boolean(loadout?.orbitOrb?.evolved);
    actor.bladeLevel = loadout?.guardianBlade?.level > 0 ? 1 : 0; actor.bladeEvolved = Boolean(loadout?.guardianBlade?.evolved);
  }

  // ---- shared pieces (all of them reuse scratch objects) ----
  function spray(kind, spec, x, y, z, dx, dz, tint, scale = 1, speedScale = 1, spread) {
    sprayed += combatVfx?.spray?.(kind, x, y, z, dx, dz, spec, tint, scale * config.sparks, speedScale, spread) || 0;
  }
  function bladeArc(x, y, z, dx, dz, radius, arc, tint, life, mirror, intensity = 1) {
    scratchDirection.x = dx; scratchDirection.z = dz;
    scratchArc.color = tint; scratchArc.radius = radius; scratchArc.arc = arc; scratchArc.life = life; scratchArc.mirror = mirror; scratchArc.intensity = intensity * config.sparks; scratchArc.sparks = level !== 'low';
    combatVfx?.emit('arc', point.set(x, y, z), scratchArc);
  }
  function bolt(ax, ay, az, bx, by, bz, tint, intensity) {
    scratchTarget.x = bx; scratchTarget.y = by; scratchTarget.z = bz; scratchLightning.color = tint; scratchLightning.intensity = intensity;
    combatVfx?.emit('lightning', point.set(ax, ay, az), scratchLightning);
  }
  function puff(type, x, y, z, tint, intensity, radius = 1) {
    scratchBurst.color = tint; scratchBurst.intensity = intensity; scratchBurst.radius = radius;
    combatVfx?.emit(type, point.set(x, y, z), scratchBurst);
  }
  /** A blast that ends on `radius`: solid band, cracks, light and the caller's own debris. */
  function shock(x, z, radius, tint, intensity = 1, crack = false) {
    glyph(BAND, x, z, radius, .46, tint, 0, 0, intensity);
    if (crack) glyph(CRACK, x, z, radius * .8, .8, tint, 0, 0, .7 * intensity);
    light(x, z, radius * .85, tint, (radius > 6 ? .26 : .36) * intensity, .3);
  }

  function relicEvent(event, local) {
    const tint = RELIC_COLORS[event.relic] ?? VFX_PALETTE.aldric.ember, dx = finite(event.dx, 1), dz = finite(event.dz, 0), yaw = Math.atan2(dz, dx);
    if (event.shape === 'cone') {
      if (event.phantom) {
        // Corte Fantasma: a spectral echo of the swing, thin and hollow like the swing itself, on the echo's own reach.
        bladeArc(event.x + dx * .35, 1.25, event.z + dz * .35, dx, dz, event.range * .62, event.halfAngle, tint, .22, true);
        scratchDirection.x = dx; scratchDirection.z = dz; scratchArc.color = tint; scratchArc.radius = event.range; scratchArc.arc = event.halfAngle; scratchArc.life = .24;
        combatVfx?.emit('reach', point.set(event.x, 0, event.z), scratchArc);
        light(event.x + dx * event.range * .45, event.z + dz * event.range * .45, event.range * .5, tint, .2, .22);
        if (local) { point.set(event.x, 0, event.z); combatVfx?.summonEcho?.(point, { direction: { x: dx, y: 0, z: dz }, color: tint, duration: .5 }); }
        return;
      }
      // Flame: a jet of burning volume along the real cone, heat on the ground, no fan outline.
      const reach = event.range / 7.5, fire = VFX_PALETTE.lyra.fire;
      glyph(FAN, event.x, event.z, event.range, .42, fire, yaw, event.halfAngle, 1);
      light(event.x + dx * event.range * .42, event.z + dz * event.range * .42, event.range * .55, fire, .34, .34);
      spray('flame', SPRAY.flameJet, event.x, 1.05, event.z, dx, dz, 0xfff1cf, 1, reach, event.halfAngle * .82);
      spray('flame', SPRAY.flameCore, event.x, 1.1, event.z, dx, dz, 0xfffbe8, 1, reach, Math.min(.2, event.halfAngle * .4));
      if (!reduced) spray('ember', SPRAY.flameEmbers, event.x, 1, event.z, dx, dz, 0xfff6e5, 1, reach, event.halfAngle * .9);
    } else if (event.shape === 'radius') {
      if (event.nova) {
        // Nova Glacial: a solid front of frost that stops on the real radius, shards and mist behind it, crystals at the rim.
        shock(event.x, event.z, event.radius, tint, 1.1);
        glyph(CRACK, event.x, event.z, event.radius * .92, 1, 0xd7f6ff, 0, 0, .4);
        elementalVfx?.emit('glacialNova', point.set(event.x, .2, event.z), NOVA_RIM(event.radius));
        spray('spark', SPRAY.frostShards, event.x, .7, event.z, 1, 0, 0xd9f6ff, 1, event.radius / 7.2);
        if (!reduced) spray('mist', SPRAY.frostMist, event.x, .5, event.z, 1, 0, 0xa9dcef, 1, event.radius / 7.2);
      } else {
        // Redemoinho do Machado: two thin counter-turning blade arcs, never a filled ring over the hero.
        const echo = Boolean(event.echo);
        bladeArc(event.x, echo ? 1.55 : 1.05, event.z, echo ? -1 : 1, 0, event.radius * (echo ? .8 : .94), 3.3, tint, echo ? .24 : .28, echo, echo ? .7 : 1);
        glyph(RING, event.x, event.z, event.radius, .3, tint, 0, 0, echo ? .45 : .8);
        light(event.x, event.z, event.radius * .8, tint, echo ? .14 : .26, .24);
        if (!reduced) spray('spark', SPRAY.windStreaks, event.x, 1.1, event.z, 1, 0, 0xeaf4ff, echo ? .6 : 1, event.radius / 4.4);
        if (!echo) spray('dust', SPRAY.dustRing, event.x, .15, event.z, 1, 0, 0x4f4a42, 1, event.radius / 4.4);
      }
    } else if (event.shape === 'line') {
      glyph(LANE, event.x, event.z, event.length, .26, tint, yaw, event.halfWidth, 1);
      combatVfx?.emitBeam?.(point.set(event.x + dx * .8, 1.15, event.z + dz * .8), pointB.set(event.x + dx * event.length, 1.15, event.z + dz * event.length), tint, .17, .16);
      light(event.x + dx * event.length * .35, event.z + dz * event.length * .35, Math.min(4, event.length * .4), tint, .24, .2);
      puff('muzzle', event.x + dx * 1.2, 1.15, event.z + dz * 1.2, tint, .8);
      puff('impact', event.x + dx * event.length, 1, event.z + dz * event.length, tint, .6 * config.sparks);
    } else if (event.shape === 'seal') {
      for (const mark of event.points || []) {
        if (!valid(mark)) continue;
        if (event.phase === 'mark') { glyph(RUNE, mark.x, mark.z, 1.05, finite(event.delay, .55) + .12, tint, 0, 0, .8); light(mark.x, mark.z, 1.2, tint, .14, finite(event.delay, .55)); }
        else {
          shock(mark.x, mark.z, event.radius, tint, .85);
          elementalVfx?.emit('arcaneImpact', point.set(mark.x, 1.1, mark.z), { radius: Math.min(2.2, event.radius * .6), intensity: .8, color: tint });
          spray('ember', SPRAY.sealEmbers, mark.x, .4, mark.z, 1, 0, tint, .8, event.radius / 3.2);
        }
      }
    } else if (event.shape === 'chain') {
      // Raio: a ribbon with a hot core and a sheath, a flash of light and sparks on every body it jumps to.
      const points = event.points || [], links = Math.min(points.length - 1, config.chain);
      for (let i = 0; i < links; i++) {
        const a = points[i], b = points[i + 1]; if (!valid(a) || !valid(b)) continue;
        bolt(a.x, i === 0 ? 1.35 : 1.05, a.z, b.x, 1.05, b.z, tint, i === 0 ? 1.1 : .85);
        light(b.x, b.z, 1.9, tint, i === 0 ? .32 : .22, .18);
        spray('spark', SPRAY.nodeSparks, b.x, 1, b.z, 1, 0, 0xfffbd0, 1);
        glyph(RING, b.x, b.z, .9, .22, tint, 0, 0, .5);
      }
    } else if (event.shape === 'point') {
      if (event.phase === 'windup') glyph(RUNE, event.x, event.z, event.radius * .45, finite(event.delay, .12) + .16, tint, 0, 0, .5);
      else {
        // Impacto Ósseo: the ground takes the blow — solid band to the real radius, fractures, bone shards, dust.
        shock(event.x, event.z, event.radius, tint, 1, true);
        spray('spark', SPRAY.boneShards, event.x, .4, event.z, 1, 0, 0xf4eeda, 1, event.radius / 5);
        spray('dust', SPRAY.dustRing, event.x, .15, event.z, 1, 0, 0x57524a, 1.2, event.radius / 4.4);
        puff('impact', event.x, .6, event.z, tint, .9 * config.sparks);
      }
    } else if (event.shape === 'charge') {
      glyph(RING, event.x, event.z, 1.1 + event.step * .7, .34, tint, 0, 0, .3 + event.step * .12);
      light(event.x, event.z, 1.6 + event.step * .5, tint, .1 + event.step * .06, .3);
    } else rejected++;
  }
  function bodyImpact(event, tint) {
    const kind = event.body;
    if (event.radius > 0) {
      shock(event.x, event.z, event.radius, tint, kind === 'shell' ? 1 : .9, kind === 'shell');
      if (kind === 'orb') {
        elementalVfx?.emit('glacialNova', point.set(event.x, .2, event.z), NOVA_RIM(event.radius));
        spray('spark', SPRAY.frostShards, event.x, .8, event.z, 1, 0, 0xd9f6ff, .8, event.radius / 7.2);
        if (!reduced) spray('mist', SPRAY.frostMist, event.x, .5, event.z, 1, 0, 0xa9dcef, .7, event.radius / 7.2);
      } else if (kind === 'seal') {
        elementalVfx?.emit('arcaneImpact', point.set(event.x, BODY_HEIGHT, event.z), { radius: Math.min(2.4, event.radius * .55), intensity: .9, color: tint });
        spray('ember', SPRAY.sealEmbers, event.x, .4, event.z, 1, 0, tint, 1, event.radius / 3.2);
      } else {
        spray('spark', SPRAY.boneShards, event.x, .4, event.z, 1, 0, 0xf4eeda, 1, event.radius / 5);
        spray('dust', SPRAY.dustRing, event.x, .15, event.z, 1, 0, 0x57524a, 1, event.radius / 4.4);
      }
    } else if (kind === 'blade' || kind === 'axe') { bladeArc(event.x, BODY_HEIGHT, event.z, 1, 0, 1.3, 1.4, tint, .16, false, .7); light(event.x, event.z, 1.4, tint, .2, .16); }
    else { puff('impact', event.x, BODY_HEIGHT, event.z, tint, .6 * config.sparks); light(event.x, event.z, 1.3, tint, .22, .16); }
  }
  function projectileEvent(event) {
    const tint = RELIC_COLORS[event.relic] ?? VFX_PALETTE.aldric.ember;
    if (event.phase === 'spawn') {
      const body = claimBody(), kind = BODY_KINDS.includes(event.body) ? event.body : 'bolt';
      body.id = event.id; body.kind = kind; body.relic = event.relic; body.tint = tint; body.x = event.x; body.z = event.z; body.vx = finite(event.vx, 0); body.vz = finite(event.vz, 0);
      body.age = 0; body.life = finite(event.life, 1); body.born = clock; body.lit = 0;
      tintGlow(body.material, tint, 1.9); body.parts[kind].visible = true; body.root.visible = true;
      body.root.scale.setScalar(kind === 'orb' ? 1 : kind === 'axe' ? 1.45 : clamp(finite(event.radius, .3) / .3, 1, 1.6) * 1.3);
      body.root.position.set(event.x, BODY_HEIGHT, event.z); body.trail.copy(body.root.position);
      puff('muzzle', event.x, BODY_HEIGHT, event.z, tint, .5);
      light(event.x, event.z, 1.5, tint, .2, .14);
      return;
    }
    const body = findBody(event.id);
    if (event.phase === 'move') {
      if (!body) return;
      const error = Math.hypot(event.x - body.x, event.z - body.z), blend = error > 1.5 ? 1 : .5;
      body.x += (event.x - body.x) * blend; body.z += (event.z - body.z) * blend; body.vx = finite(event.vx, body.vx); body.vz = finite(event.vz, body.vz);
      if (event.bounce) { bladeArc(event.x, BODY_HEIGHT, event.z, body.vx, body.vz, 1.1, 1.3, tint, .14, false, .6); light(event.x, event.z, 1.2, tint, .2, .14); }
      return;
    }
    if (event.phase === 'impact') bodyImpact(event, tint);
    if (body) releaseBody(body);
  }
  function autoEvent(event, ownerId) {
    const tints = AUTO_COLORS[event.weapon]; if (!tints) { rejected++; return; }
    const tint = tints[event.evolved ? 1 : 0];
    if (event.weapon === 'guardianBlade') {
      // No screen-long laser: the blade itself flies (update), the strike is a small crescent and a flash on the victim.
      const dx = event.tx - event.x, dz = event.tz - event.z, length = Math.hypot(dx, dz) || 1, ux = dx / length, uz = dz / length;
      bladeArc(event.tx, 1.1, event.tz, ux, uz, 1.7, 1.25, tint, .18, false, PASSIVE);
      light(event.tx, event.tz, 1.7, tint, .3 * PASSIVE + .1, .18);
      spray('spark', SPRAY.nodeSparks, event.tx, 1.1, event.tz, ux, uz, 0xeaffff, PASSIVE);
      if (event.evolved) {
        // Lâmina Eclipse: the lance is the real cone (9.2 m, ±0.2 rad) from the hero through the victim.
        const range = 9.2, half = .2;
        glyph(FAN, event.x, event.z, range, .26, tint, Math.atan2(uz, ux), half, 1);
        combatVfx?.emitBeam?.(point.set(event.x + ux * .9, 1.2, event.z + uz * .9), pointB.set(event.x + ux * range, 1.2, event.z + uz * range), tint, .24, .16);
      }
      const actor = actorFor(ownerId, false);
      if (actor) { actor.dash = .42; actor.tx = event.tx; actor.tz = event.tz; actor.bladeTrail.copy(actor.blade.position); }
    } else if (event.weapon === 'orbitOrb') {
      glyph(RING, event.x, event.z, event.radius, .24, tint, 0, 0, PASSIVE);
      light(event.x, event.z, event.radius * 1.3, tint, .24, .2);
      spray(event.evolved ? 'ember' : 'spark', SPRAY.nodeSparks, event.x, 1, event.z, 1, 0, event.evolved ? 0xfff0d8 : tint, PASSIVE + .2);
      const actor = actorFor(ownerId, false);
      if (actor && actor.orbLevel) actor.angle = Math.atan2(event.z - actor.z, event.x - actor.x);
    } else if (event.weapon === 'sealRain') {
      // Chuva de Selos: a column of light lands the seal, a soft golden burst fills the real radius, the rune is brief and faint.
      for (const mark of event.points || []) {
        if (!valid(mark)) continue;
        combatVfx?.emitBeam?.(point.set(mark.x, 6.5, mark.z), pointB.set(mark.x, .15, mark.z), tint, .3, .2);
        glyph(BAND, mark.x, mark.z, event.radius, .4, tint, 0, 0, .7);
        glyph(RUNE, mark.x, mark.z, event.radius * .55, .22, tint, 0, 0, .25);
        light(mark.x, mark.z, event.radius * .95, tint, .4, .34);
        spray('ember', SPRAY.sealEmbers, mark.x, .3, mark.z, 1, 0, tint, PASSIVE + .25, event.radius / 3.2);
      }
    } else {
      // Ritual de Selos: every fifth automatic attack, same language as the rain it extends.
      glyph(BAND, event.x, event.z, event.radius, .44, tint, 0, 0, .75);
      light(event.x, event.z, event.radius * .9, tint, .36, .32);
      elementalVfx?.emit('arcaneImpact', point.set(event.x, 1, event.z), { radius: 1.6, intensity: .7, color: tint });
      spray('ember', SPRAY.sealEmbers, event.x, .3, event.z, 1, 0, tint, .8, event.radius / 3.2);
    }
  }
  function stateEvent(event) {
    const tint = RELIC_COLORS[event.relic] ?? VFX_PALETTE.aldric.ember;
    if (event.phase === 'gain') {
      glyph(RING, event.x, event.z, 2.6, .5, tint, 0, 0, .8); light(event.x, event.z, 2.6, tint, .4, .5);
      spray('spark', SPRAY.gainMotes, event.x, .3, event.z, 1, 0, tint, 1);
    } else {
      glyph(RUNE, event.x, event.z, 1.3, .5, tint, 0, 0, .3);
      puff('smoke', event.x, .8, event.z, 0x627b92, .35, 1.2);
    }
  }
  /** `options.ownerId` selects the companion to animate; `options.local` enables effects that read the local hero pose. */
  function emit(event, options = {}) {
    if (disposed || !event || typeof event !== 'object') { rejected++; return false; }
    const kind = event.kind;
    if (kind !== 'projectile' && !valid(event) && !Array.isArray(event.points)) { rejected++; return false; }
    if (kind === 'projectile' && !valid(event)) { rejected++; return false; }
    if (kind === 'relic') relicEvent(event, Boolean(options.local));
    else if (kind === 'projectile') projectileEvent(event);
    else if (kind === 'auto') autoEvent(event, options.ownerId === undefined ? event.ownerId : options.ownerId);
    else if (kind === 'state') stateEvent(event);
    else { rejected++; return false; }
    counts[kind]++; return true;
  }

  function trail(from, to, tint, size, life) {
    scratchTrail.color = tint; scratchTrail.size = size; scratchTrail.life = life;
    combatVfx?.emitTrail(from, to, 'glow', scratchTrail);
  }
  function update(dt) {
    if (disposed) return;
    const step = clamp(finite(dt, 0), 0, .15); clock += step; glyphMaterial.uniforms.uTime.value = clock;
    let liveBodies = 0;
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i]; if (body.id === null) continue;
      body.age += step;
      if (body.age > body.life + .3) { releaseBody(body); continue; }
      liveBodies++;
      body.x += body.vx * step; body.z += body.vz * step;
      const root = body.root; root.position.set(body.x, BODY_HEIGHT + (body.kind === 'seal' ? .25 : 0), body.z);
      const spin = reduced ? 0 : clock * (body.kind === 'axe' ? 17 : body.kind === 'blade' ? 24 : body.kind === 'seal' ? 5 : 2.5);
      root.rotation.y = body.kind === 'bolt' || reduced ? Math.atan2(body.vx, body.vz) : spin;
      if (body.kind === 'orb' && !reduced) root.rotation.x = clock * 1.7;
      if (config.trails && !reduced && step > 0 && body.trail.distanceToSquared(root.position) > .2) {
        if (body.kind === 'orb') elementalVfx?.emitTrail('glacial', body.trail, root.position, body.ribbon);
        else if (body.kind === 'seal') elementalVfx?.emitTrail('arcane', body.trail, root.position, body.ribbon);
        else trail(body.trail, root.position, body.tint, body.kind === 'shell' ? .07 : .05, .24);
        body.trail.copy(root.position);
        // Slow heavy bodies carry their own light across the ground.
        if ((body.kind === 'orb' || body.kind === 'shell' || body.kind === 'axe') && clock - body.lit > .09) { body.lit = clock; light(body.x, body.z, 1.7, body.tint, .2, .2); }
      }
    }
    bodyGroup.visible = liveBodies > 0;
    let liveCompanions = 0;
    for (const actor of actors) {
      if (actor.id === null) continue;
      if (clock - actor.seen > .5) { releaseActor(actor); continue; }
      const auraSlot = actor.index * 2, orbSlot = auraSlot + 1;
      if (actor.relic) persist(auraSlot, AURA, actor.x, actor.z, 1.5, RELIC_COLORS[actor.relic], reduced ? .6 : .85); else clearPersistent(auraSlot);
      actor.orb.visible = actor.orbLevel > 0; actor.blade.visible = actor.bladeLevel > 0;
      if (actor.orbLevel) {
        liveCompanions++;
        actor.angle = (actor.angle + 3.4 * step) % TAU;
        const orbit = 3.4 * actor.area * (actor.orbEvolved ? 1.12 : 1), tint = AUTO_COLORS.orbitOrb[actor.orbEvolved ? 1 : 0];
        tintGlow(actor.orbMaterial, tint, 1.7); actor.orbShell.color.set(tint);
        actor.orb.position.set(actor.x + Math.cos(actor.angle) * orbit, .95 + (reduced ? 0 : Math.sin(clock * 3 + actor.index) * .12), actor.z + Math.sin(actor.angle) * orbit);
        actor.orb.scale.setScalar(actor.orbEvolved ? 1.3 : 1); if (!reduced) actor.orb.rotation.y = clock * 2.2;
        // The orb lights the ground it flies over: that pool is what gives it a place in the world.
        if (config.light > 0) persist(orbSlot, LIGHT, actor.orb.position.x, actor.orb.position.z, actor.orbEvolved ? 2.1 : 1.7, tint, .26 * config.light); else clearPersistent(orbSlot);
        actor.trailDebt -= step;
        if (config.trails && !reduced && step > 0 && actor.trailDebt <= 0) {
          actor.trailDebt = .05;
          if (actor.trail.distanceToSquared(actor.orb.position) < 9) { if (actor.orbEvolved) combatVfx?.emitTrail(actor.trail, actor.orb.position, 'ember'); else trail(actor.trail, actor.orb.position, tint, .05, .3); }
          actor.trail.copy(actor.orb.position);
        }
      } else clearPersistent(orbSlot);
      if (actor.bladeLevel) {
        liveCompanions++;
        actor.orbit = (actor.orbit + (reduced ? 0 : .8 * step)) % TAU;
        const tint = AUTO_COLORS.guardianBlade[actor.bladeEvolved ? 1 : 0];
        tintGlow(actor.bladeMaterial, tint, 1.8); actor.bladeShell.color.set(tint);
        const homeX = actor.x + Math.cos(actor.orbit) * 1.15, homeZ = actor.z + Math.sin(actor.orbit) * 1.15, homeY = 2.75 + (reduced ? 0 : Math.sin(clock * 2.4 + actor.index) * .1);
        actor.dash = Math.max(0, actor.dash - step);
        // .42 s strike: fly out, hold on the target, fly home.
        const phase = actor.dash > 0 ? 1 - actor.dash / .42 : 1, reach = phase < .3 ? phase / .3 : phase < .5 ? 1 : Math.max(0, 1 - (phase - .5) / .5);
        actor.blade.position.set(homeX + (actor.tx - homeX) * reach, homeY + (1.5 - homeY) * reach, homeZ + (actor.tz - homeZ) * reach);
        actor.blade.rotation.set(reach * 1.1, reduced ? 0 : clock * 1.2 + reach * 6, 0);
        actor.blade.scale.setScalar(actor.bladeEvolved ? 1.35 : 1.1);
        // A two-metre wake on the last stretch before the victim; never a line across the screen.
        if (actor.dash > 0 && phase < .34 && config.trails && !reduced && Math.hypot(actor.blade.position.x - actor.tx, actor.blade.position.z - actor.tz) < 3.4) trail(actor.bladeTrail, actor.blade.position, tint, .06, .2);
        actor.bladeTrail.copy(actor.blade.position);
      }
    }
    companionGroup.visible = liveCompanions > 0;
    if (dirty) { for (let i = 0; i < attributeList.length; i++) attributeList[i].needsUpdate = true; dirty = false; }
    activeGlyphs = 0;
    for (let i = 0; i < capacity; i++) { const p = i * 4; if (arrays.aParams[p + 1] > 0 && clock < arrays.aParams[p] + arrays.aParams[p + 1]) activeGlyphs++; }
    glyphMesh.visible = activeGlyphs > 0;
  }
  function reset() {
    if (disposed) return;
    clock = 0; head = 0; arrays.aParams.fill(0); dirty = true; activeGlyphs = 0; glyphMesh.visible = false; glyphMaterial.uniforms.uTime.value = 0;
    for (const body of bodies) if (body.id !== null) releaseBody(body);
    for (const actor of actors) if (actor.id !== null) releaseActor(actor);
    bodyGroup.visible = companionGroup.visible = false;
  }
  function setQuality(value) {
    if (disposed) return;
    level = QUALITY[value] ? value : 'medium'; config = QUALITY[level]; head %= config.glyphs;
    arrays.aParams.fill(0, (PERSISTENT + config.glyphs) * 4); dirty = true;
    for (let i = config.bodies; i < bodies.length; i++) if (bodies[i].id !== null) releaseBody(bodies[i]);
  }
  function setReducedMotion(value) { if (disposed) return; reduced = Boolean(value); glyphMaterial.uniforms.uMotion.value = reduced ? 0 : 1; }
  function getStats() {
    return { quality: level, reducedMotion: reduced, disposed, time: clock, activeGlyphs, glyphCapacity: config.glyphs,
      activeBodies: bodies.filter(body => body.id !== null).map(body => ({ id: body.id, kind: body.kind, relic: body.relic, x: body.x, z: body.z })),
      bodyCapacity: config.bodies, actors: actors.filter(actor => actor.id !== null).map(actor => ({ id: actor.id, relic: actor.relic, orb: actor.orb.visible, blade: actor.blade.visible, dash: actor.dash })),
      drawCalls: (glyphMesh.visible ? 1 : 0) + bodies.filter(body => body.id !== null).length + actors.reduce((n, actor) => n + (actor.orb.visible ? 3 : 0) + (actor.blade.visible ? 3 : 0), 0),
      layers: { groundLights: lights, sprayedParticles: sprayed, persistentSlots: PERSISTENT },
      emitted, overwritten, rejected, events: { ...counts } };
  }
  function dispose() {
    if (disposed) return;
    reset(); group.removeFromParent(); geometry.dispose(); glyphMaterial.dispose();
    for (const shape of Object.values(shapes)) shape.dispose();
    for (const body of bodies) body.material.dispose();
    for (const shape of [orbCore, orbRing, bladeEdge, bladeGuard]) shape.dispose();
    for (const actor of actors) { actor.orbMaterial.dispose(); actor.orbShell.dispose(); actor.bladeMaterial.dispose(); actor.bladeShell.dispose(); }
    disposed = true;
  }
  setQuality(level);
  return { emit, syncActor, update, reset, setQuality, setReducedMotion, getStats, dispose };
}
