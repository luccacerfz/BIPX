/** Presentation of the legacy arsenal: relic infusions of the basic attack and the three automatic weapons.
 * Events come from src/combat/arsenal.mjs — produced locally in solo, by the server in multiplayer. Shapes and colours
 * follow the legacy build (cone flame, axe ring, katana arc, bolts, seals, bone/ice blasts, orbiting orb, guardian blade)
 * and are drawn through bounded pools. No damage, targets, timers, lights or camera motion live here.
 */
const QUALITY = Object.freeze({
  high: { glyphs: 96, bodies: 24, trails: true, chain: 7, sparks: 1 },
  medium: { glyphs: 64, bodies: 16, trails: true, chain: 5, sparks: .6 },
  low: { glyphs: 36, bodies: 10, trails: false, chain: 3, sparks: .3 },
});
const ACTORS = 4, AURA_SLOTS = ACTORS, GROUND = .085, BODY_HEIGHT = 1.12, TAU = Math.PI * 2;
const RING = 0, FAN = 1, LANE = 2, RUNE = 3, CRACK = 4, ARC = 5, AURA = 6;
const RELIC_COLORS = Object.freeze({ flamethrower: 0xff7a28, axe: 0x7fd7ff, katana: 0x8ffcff, crossbow: 0xffd36d, talisman: 0xd978ff,
  thunderstaff: 0xfff45c, boneCannon: 0xe7e0c7, frostNova: 0x7edcff });
const AUTO_COLORS = Object.freeze({ guardianBlade: [0x8ffcff, 0x5dc7ff], orbitOrb: [0xd978ff, 0xff8a2a], sealRain: [0xffd36d, 0xffd76a], sealRitual: [0xff8a2a, 0xff8a2a] });
const BODY_KINDS = ['bolt', 'blade', 'axe', 'seal', 'shell', 'orb'];
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const valid = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);

const glyphVertex = /* glsl */ `
uniform float uTime;
attribute vec3 aOrigin; attribute vec4 aParams; attribute vec4 aShape; attribute vec3 aColor;
varying vec2 vUv; varying vec4 vShape; varying vec3 vColor; varying float vKind; varying float vT;
void main() {
  float age = uTime - aParams.x, life = max(aParams.y, .001);
  vT = (age < 0. || age > life) ? -1. : clamp(age / life, 0., 1.);
  vKind = aParams.w; vShape = aShape; vColor = aColor;
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
varying vec2 vUv; varying vec4 vShape; varying vec3 vColor; varying float vKind; varying float vT;
float band(float r, float center, float width) { float d = (r - center) / width; return exp(-d * d); }
void main() {
  if (vT < 0.) discard;
  float t = vT, fade = 1. - t, r = length(vUv), angle = atan(vUv.y, vUv.x), alpha = 0.;
  if (vKind < .5) {
    float front = mix(.22, .96, 1. - pow(1. - t, 2.4));
    alpha = band(r, front, .04 + .03 * t) * fade + band(r, front, .17) * .22 * fade + smoothstep(front, 0., r) * .07 * fade;
  } else if (vKind < 1.5) {
    float edge = smoothstep(vShape.y, vShape.y - .14, abs(angle)), reach = mix(.3, 1., 1. - pow(1. - t, 3.));
    float body = smoothstep(reach, reach - .3, r) * smoothstep(.03, .16, r);
    float flow = .5 + .5 * sin(angle * 21. + vShape.z) * sin(r * 13. - t * 9. * uMotion + vShape.z * 2.);
    alpha = edge * (body * (.35 + .65 * flow) * .8 + band(r, reach, .045) * .75) * fade;
  } else if (vKind < 2.5) {
    float across = abs(vUv.y), head = mix(.18, 1., 1. - pow(1. - t, 3.));
    float along = smoothstep(head, head - .07, vUv.x) * smoothstep(0., .05, vUv.x);
    alpha = (exp(-across * across * 20.) + exp(-across * across * 3.) * .32) * along * fade;
    alpha += band(vUv.x, head, .028) * exp(-across * across * 5.) * fade;
  } else if (vKind < 3.5) {
    float turn = angle + t * 1.5 * uMotion + vShape.z;
    float appear = smoothstep(0., .12, t) * (1. - smoothstep(.72, 1., t));
    alpha = (band(r, .9, .032) + band(r, .62, .02) * .7 + band(r, .76, .065) * step(.5, sin(turn * 9.)) * .8
      + band(r, .3, .03) * step(0., sin(turn * 3.)) * .6) * appear;
  } else if (vKind < 4.5) {
    float cracks = pow(abs(sin(angle * 5. + vShape.z) * sin(angle * 9. - vShape.z * 1.7)), 6.), grow = 1. - pow(1. - t, 3.);
    alpha = smoothstep(grow, grow - .5, r) * (.16 + cracks * .9) * fade * fade + band(r, grow * .98, .04) * fade;
  } else if (vKind < 5.5) {
    float sweep = mix(-vShape.y, vShape.y, 1. - pow(1. - t, 2.6));
    float edge = smoothstep(vShape.y, vShape.y - .1, abs(angle)), tail = smoothstep(sweep - 1.2, sweep, angle) * step(angle, sweep + .05);
    alpha = (band(r, .86, .055) * 1.4 + band(r, .86, .2) * .3) * edge * tail * fade;
  } else {
    float turn = angle + uTime * .9 * uMotion;
    alpha = band(r, .9, .03) * .8 + band(r, .74, .05) * step(.35, sin(turn * 7.)) * .55 + smoothstep(.9, .2, r) * .05;
  }
  alpha *= vShape.w;
  if (alpha < .004) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.), clamp(alpha - .6, 0., .55)) * 1.55, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createArsenalVfx({ THREE, scene, combatVfx = null, elementalVfx = null, quality = 'medium', reducedMotion = false } = {}) {
  if (!THREE?.InstancedBufferGeometry || !scene?.add) throw new TypeError('createArsenalVfx requires THREE and scene');
  const group = new THREE.Group(); group.name = 'ArsenalVfx'; group.userData.excludeFromSceneDepth = true; scene.add(group);
  let level = QUALITY[quality] ? quality : 'medium', config = QUALITY[level], reduced = Boolean(reducedMotion);
  let clock = 0, disposed = false, emitted = 0, overwritten = 0, rejected = 0, serial = 1;
  const counts = { relic: 0, projectile: 0, auto: 0, state: 0 };
  const color = new THREE.Color(), point = new THREE.Vector3();

  // ---- ground glyph pool: one instanced draw for rings, fans, lanes, runes, cracks, arcs and hero auras ----
  const capacity = QUALITY.high.glyphs + AURA_SLOTS, geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const arrays = { aOrigin: new Float32Array(capacity * 3), aParams: new Float32Array(capacity * 4), aShape: new Float32Array(capacity * 4), aColor: new Float32Array(capacity * 3) };
  const attributes = {};
  for (const [name, array] of Object.entries(arrays)) {
    attributes[name] = new THREE.InstancedBufferAttribute(array, name === 'aOrigin' || name === 'aColor' ? 3 : 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attributes[name]);
  }
  geometry.instanceCount = capacity;
  const glyphMaterial = new THREE.ShaderMaterial({ name: 'ArsenalGroundGlyphs', vertexShader: glyphVertex, fragmentShader: glyphFragment,
    uniforms: { uTime: { value: 0 }, uMotion: { value: reduced ? 0 : 1 } }, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: true });
  const glyphMesh = new THREE.Mesh(geometry, glyphMaterial);
  glyphMesh.name = 'ArsenalGroundGlyphs'; glyphMesh.frustumCulled = false; glyphMesh.visible = false; glyphMesh.renderOrder = 3; glyphMesh.raycast = () => {};
  group.add(glyphMesh);
  let head = 0, dirty = false, activeGlyphs = 0;
  function writeGlyph(index, kind, x, z, size, life, yaw, shape, tint, intensity) {
    const o = index * 3, p = index * 4;
    arrays.aOrigin[o] = x; arrays.aOrigin[o + 1] = GROUND + (index % 7) * .004; arrays.aOrigin[o + 2] = z;
    arrays.aParams[p] = clock; arrays.aParams[p + 1] = life; arrays.aParams[p + 2] = size; arrays.aParams[p + 3] = kind;
    arrays.aShape[p] = yaw; arrays.aShape[p + 1] = shape; arrays.aShape[p + 2] = (serial++ * 2.399) % 40; arrays.aShape[p + 3] = intensity;
    color.set(tint); arrays.aColor[o] = color.r; arrays.aColor[o + 1] = color.g; arrays.aColor[o + 2] = color.b;
    dirty = true;
  }
  function glyph(kind, x, z, size, life, tint, { yaw = 0, shape = 0, intensity = 1 } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !(size > 0)) { rejected++; return; }
    const index = AURA_SLOTS + head, p = index * 4;
    if (arrays.aParams[p + 1] > 0 && clock < arrays.aParams[p] + arrays.aParams[p + 1]) overwritten++;
    head = (head + 1) % config.glyphs; emitted++;
    writeGlyph(index, kind, x, z, size, Math.max(.05, reduced ? Math.min(life, .45) : life), yaw, shape, tint, clamp(intensity, .1, 1.6));
  }

  // ---- relic bodies in flight: pooled meshes; transforms only ----
  const bodyGroup = new THREE.Group(); bodyGroup.name = 'ArsenalRelicBodies'; group.add(bodyGroup);
  const shapes = {
    bolt: new THREE.ConeGeometry(.1, 1.25, 6), blade: new THREE.OctahedronGeometry(.5, 0), seal: new THREE.RingGeometry(.2, .42, 6),
    shell: new THREE.IcosahedronGeometry(.34, 0), orb: new THREE.IcosahedronGeometry(.55, 1), halo: new THREE.TorusGeometry(.78, .035, 6, 28),
    haft: new THREE.BoxGeometry(.09, .09, 1.15), head: new THREE.BoxGeometry(.62, .07, .46),
  };
  shapes.bolt.rotateX(Math.PI / 2); shapes.blade.scale(1.25, .09, .34); shapes.seal.rotateX(-Math.PI / 2); shapes.halo.rotateX(Math.PI / 2); shapes.head.translate(.3, 0, .36);
  const glow = tint => new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: .95, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
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
    const key = {};
    return { index, root, parts, material, id: null, kind: 'bolt', relic: '', x: 0, z: 0, vx: 0, vz: 0, age: 0, life: 0, born: 0, trail: new THREE.Vector3(),
      ribbon: { key, radius: .5 }, ember: { color: 0xffffff } };
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
  const orbCore = new THREE.SphereGeometry(.3, 14, 10), orbRing = new THREE.TorusGeometry(.5, .03, 6, 28), bladeEdge = new THREE.BoxGeometry(.1, 1.05, .03), bladeGuard = new THREE.BoxGeometry(.36, .06, .08);
  orbRing.rotateX(Math.PI / 2); bladeEdge.translate(0, -.42, 0);
  const actors = Array.from({ length: ACTORS }, (_, index) => {
    const orbMaterial = glow(AUTO_COLORS.orbitOrb[0]), bladeMaterial = glow(AUTO_COLORS.guardianBlade[0]);
    const orb = new THREE.Group(); orb.add(new THREE.Mesh(orbCore, orbMaterial), new THREE.Mesh(orbRing, orbMaterial));
    const blade = new THREE.Group(); blade.add(new THREE.Mesh(bladeEdge, bladeMaterial), new THREE.Mesh(bladeGuard, bladeMaterial));
    orb.visible = blade.visible = false; companionGroup.add(orb, blade);
    return { index, id: null, seen: -1, x: 0, z: 0, relic: null, orbLevel: 0, orbEvolved: false, bladeLevel: 0, bladeEvolved: false, area: 1,
      angle: index * 1.7, orbit: index * .9, dash: 0, tx: 0, tz: 0, orb, blade, orbMaterial, bladeMaterial, trail: new THREE.Vector3(), trailDebt: 0, ember: { color: orbMaterial.color } };
  });
  function actorFor(id, create) {
    let free = null;
    for (const actor of actors) { if (actor.id === id) return actor; if (actor.id === null && !free) free = actor; }
    if (!create || !free) return null;
    free.id = id; free.dash = 0; free.trailDebt = 0; return free;
  }
  function releaseActor(actor) {
    actor.id = null; actor.relic = null; actor.orb.visible = actor.blade.visible = false; arrays.aParams[actor.index * 4 + 1] = 0; dirty = true;
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

  // ---- shared bursts ----
  const sparks = (type, at, options) => combatVfx?.emit(type, at, options);
  function blast(x, z, radius, tint, { crack = false, dust = true } = {}) {
    glyph(RING, x, z, radius, .5, tint);
    if (crack) glyph(CRACK, x, z, radius * .8, .7, tint, { intensity: .9 });
    point.set(x, .4, z);
    if (dust) sparks('shockwave', point, { color: tint, radius, intensity: .7 * config.sparks });
  }
  function relicEvent(event, local) {
    const tint = RELIC_COLORS[event.relic] ?? 0xffe2a8, yaw = Math.atan2(finite(event.dz, 0), finite(event.dx, 1));
    if (event.shape === 'cone') {
      if (event.phantom) {
        glyph(ARC, event.x, event.z, event.range, .3, tint, { yaw, shape: event.halfAngle, intensity: 1.3 });
        glyph(FAN, event.x, event.z, event.range, .22, tint, { yaw, shape: event.halfAngle, intensity: .35 });
        point.set(event.x + event.dx * 1.4, 1.2, event.z + event.dz * 1.4);
        sparks('slash', point, { color: tint, radius: event.range * .55, direction: { x: event.dx, z: event.dz }, tilt: .2 });
        if (local) { point.set(event.x, 0, event.z); combatVfx?.summonEcho?.(point, { direction: { x: event.dx, y: 0, z: event.dz }, color: tint, duration: .5 }); }
        return;
      }
      glyph(FAN, event.x, event.z, event.range, .38, tint, { yaw, shape: event.halfAngle, intensity: 1.1 });
      glyph(FAN, event.x, event.z, event.range * .62, .3, 0xffe3a1, { yaw, shape: event.halfAngle * .7, intensity: .7 });
      const puffs = reduced ? 1 : level === 'low' ? 2 : 3;
      for (let i = 1; i <= puffs; i++) {
        const reach = event.range * i / (puffs + .6);
        point.set(event.x + event.dx * reach, 1, event.z + event.dz * reach);
        sparks('fire', point, { color: 0xfff1cf, radius: 1 + reach * .22, intensity: .55 * config.sparks });
        if (i === puffs) elementalVfx?.emit('flameCast', point, { radius: 1.1, intensity: .7, direction: { x: event.dx, z: event.dz } });
      }
    } else if (event.shape === 'radius') {
      if (event.nova) {
        glyph(RING, event.x, event.z, event.radius, .7, tint, { intensity: 1.2 });
        glyph(CRACK, event.x, event.z, event.radius * .9, .8, 0xd7f6ff, { intensity: .55 });
        point.set(event.x, .2, event.z);
        elementalVfx?.emit('glacialNova', point, { radius: event.radius, intensity: 1 });
        sparks('frost', point, { color: tint, radius: Math.min(event.radius, 6), intensity: .8 * config.sparks });
      } else {
        glyph(RING, event.x, event.z, event.radius, .36, tint, { intensity: 1.1 });
        glyph(ARC, event.x, event.z, event.radius * .92, .3, 0xe9fbff, { yaw: event.echo ? Math.PI : 0, shape: Math.PI, intensity: 1.2 });
        point.set(event.x, .9, event.z);
        sparks('slash', point, { color: tint, radius: event.radius * .55, tilt: .05, intensity: .7 });
        if (!event.echo) { point.y = .1; sparks('dust', point, { intensity: .8 * config.sparks }); }
      }
    } else if (event.shape === 'line') {
      glyph(LANE, event.x, event.z, event.length, .3, tint, { yaw, shape: event.halfWidth * 1.15, intensity: 1.2 });
      point.set(event.x + event.dx * 1.2, 1.15, event.z + event.dz * 1.2);
      sparks('muzzle', point, { color: tint, direction: { x: event.dx, z: event.dz }, intensity: .8 });
      point.set(event.x + event.dx * event.length, 1, event.z + event.dz * event.length);
      sparks('impact', point, { color: tint, intensity: .6 * config.sparks });
    } else if (event.shape === 'seal') {
      for (const mark of event.points || []) {
        if (!valid(mark)) continue;
        if (event.phase === 'mark') glyph(RUNE, mark.x, mark.z, 1.15, finite(event.delay, .55) + .12, tint, { intensity: 1.1 });
        else {
          blast(mark.x, mark.z, event.radius, tint, { dust: false });
          point.set(mark.x, 1.1, mark.z);
          elementalVfx?.emit('arcaneImpact', point, { radius: Math.min(2.2, event.radius * .6), intensity: .9, color: tint });
          sparks('seal', point.set(mark.x, .1, mark.z), { color: tint, radius: event.radius * .7, life: .5 });
        }
      }
    } else if (event.shape === 'chain') {
      const points = event.points || [], links = Math.min(points.length - 1, config.chain);
      for (let i = 0; i < links; i++) {
        const a = points[i], b = points[i + 1]; if (!valid(a) || !valid(b)) continue;
        point.set(a.x, i === 0 ? 1.35 : 1.05, a.z);
        sparks('lightning', point, { color: tint, target: { x: b.x, y: 1.05, z: b.z }, intensity: i === 0 ? 1 : .75 });
        glyph(RING, b.x, b.z, .9, .28, tint, { intensity: .8 });
      }
    } else if (event.shape === 'point') {
      if (event.phase === 'windup') glyph(RUNE, event.x, event.z, event.radius * .55, finite(event.delay, .12) + .2, tint, { intensity: .7 });
      else { blast(event.x, event.z, event.radius, tint, { crack: true }); point.set(event.x, .6, event.z); sparks('impact', point, { color: tint, intensity: 1.2 * config.sparks }); sparks('smoke', point, { intensity: .5, radius: 1.6 }); }
    } else if (event.shape === 'charge') {
      glyph(RING, event.x, event.z, 1.1 + event.step * .7, .4, tint, { intensity: .45 + event.step * .2 });
    } else rejected++;
  }
  function bodyImpact(event, tint) {
    const kind = event.body;
    point.set(event.x, BODY_HEIGHT, event.z);
    if (event.radius > 0) {
      blast(event.x, event.z, event.radius, tint, { crack: kind === 'shell' });
      if (kind === 'orb') { elementalVfx?.emit('glacialNova', point.set(event.x, .2, event.z), { radius: event.radius, intensity: .9 }); sparks('frost', point, { color: tint, radius: Math.min(5, event.radius), intensity: .7 * config.sparks }); }
      else if (kind === 'seal') { elementalVfx?.emit('arcaneImpact', point, { radius: Math.min(2.4, event.radius * .55), intensity: 1, color: tint }); sparks('seal', point.set(event.x, .1, event.z), { color: tint, radius: event.radius * .7, life: .5 }); }
      else { sparks('impact', point, { color: tint, intensity: 1.1 * config.sparks }); sparks('smoke', point, { intensity: .5, radius: 1.8 }); }
    } else if (kind === 'blade' || kind === 'axe') sparks('slash', point, { color: tint, radius: 1.3, intensity: .7 });
    else sparks('impact', point, { color: tint, intensity: .6 * config.sparks });
  }
  function projectileEvent(event) {
    const tint = RELIC_COLORS[event.relic] ?? 0xffe2a8;
    if (event.phase === 'spawn') {
      const body = claimBody(), kind = BODY_KINDS.includes(event.body) ? event.body : 'bolt';
      Object.assign(body, { id: event.id, kind, relic: event.relic, x: event.x, z: event.z, vx: finite(event.vx, 0), vz: finite(event.vz, 0), age: 0, life: finite(event.life, 1), born: clock });
      body.material.color.set(tint); body.ember.color = tint; body.parts[kind].visible = true; body.root.visible = true;
      body.root.scale.setScalar(kind === 'orb' ? 1 : kind === 'axe' ? 1.45 : clamp(finite(event.radius, .3) / .3, 1, 1.6) * 1.3);
      body.root.position.set(event.x, BODY_HEIGHT, event.z); body.trail.copy(body.root.position);
      point.set(event.x, BODY_HEIGHT, event.z);
      sparks('muzzle', point, { color: tint, direction: { x: body.vx, z: body.vz }, intensity: .5 });
      return;
    }
    const body = findBody(event.id);
    if (event.phase === 'move') {
      if (!body) return;
      const error = Math.hypot(event.x - body.x, event.z - body.z), blend = error > 1.5 ? 1 : .5;
      body.x += (event.x - body.x) * blend; body.z += (event.z - body.z) * blend; body.vx = finite(event.vx, body.vx); body.vz = finite(event.vz, body.vz);
      if (event.bounce) { point.set(event.x, BODY_HEIGHT, event.z); sparks('slash', point, { color: tint, radius: 1.1, intensity: .6 }); }
      return;
    }
    if (event.phase === 'impact') bodyImpact(event, tint);
    if (body) releaseBody(body);
  }
  function autoEvent(event) {
    const tints = AUTO_COLORS[event.weapon]; if (!tints) { rejected++; return; }
    const tint = tints[event.evolved ? 1 : 0];
    if (event.weapon === 'guardianBlade') {
      const dx = event.tx - event.x, dz = event.tz - event.z, length = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dz, dx);
      glyph(LANE, event.x, event.z, length, .22, tint, { yaw, shape: .38, intensity: 1 });
      glyph(ARC, event.tx, event.tz, 1.9, .26, tint, { yaw, shape: 1.2, intensity: 1.3 });
      point.set(event.tx, 1.1, event.tz);
      sparks('slash', point, { color: tint, radius: 2, direction: { x: dx / length, z: dz / length }, tilt: .3, intensity: .8 });
      if (event.evolved) sparks('bladeStorm', point.set(event.tx, 0, event.tz), { color: 0xbdebf2, radius: 3.2, intensity: .7 * config.sparks });
      const actor = actorFor(event.ownerId, false);
      if (actor) { actor.dash = .42; actor.tx = event.tx; actor.tz = event.tz; }
    } else if (event.weapon === 'orbitOrb') {
      glyph(RING, event.x, event.z, event.radius * 1.15, .28, tint, { intensity: 1 });
      point.set(event.x, 1, event.z);
      sparks('impact', point, { color: tint, intensity: .45 * config.sparks });
      if (event.evolved) sparks('fire', point, { color: 0xffd9a8, radius: event.radius, intensity: .5 * config.sparks });
      const actor = actorFor(event.ownerId, false);
      if (actor && actor.orbLevel) actor.angle = Math.atan2(event.z - actor.z, event.x - actor.x);
    } else if (event.weapon === 'sealRain') {
      for (const mark of event.points || []) {
        if (!valid(mark)) continue;
        glyph(RUNE, mark.x, mark.z, event.radius * .9, .6, tint, { intensity: 1 });
        glyph(RING, mark.x, mark.z, event.radius, .5, tint, { intensity: 1 });
        sparks('judgement', point.set(mark.x, 0, mark.z), { color: event.evolved ? 0xfff0b8 : 0xe4c9fc, radius: event.radius, intensity: .75 * config.sparks });
      }
    } else {
      blast(event.x, event.z, event.radius, tint, { dust: false });
      sparks('seal', point.set(event.x, .1, event.z), { color: tint, radius: event.radius * .8, life: .6 });
      elementalVfx?.emit('arcaneImpact', point.set(event.x, 1, event.z), { radius: 1.6, intensity: .8, color: tint });
    }
  }
  function stateEvent(event) {
    const tint = RELIC_COLORS[event.relic] ?? 0xe4bf78;
    if (event.phase === 'gain') {
      glyph(RING, event.x, event.z, 3.4, .6, tint, { intensity: 1.2 }); glyph(RUNE, event.x, event.z, 1.9, 1.1, tint, { intensity: 1.1 });
      sparks('levelUp', point.set(event.x, .1, event.z), { color: tint, radius: 2.2 });
    } else {
      glyph(RUNE, event.x, event.z, 1.5, .7, tint, { intensity: .5 });
      sparks('smoke', point.set(event.x, .8, event.z), { intensity: .4, radius: 1.2 });
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
    else if (kind === 'auto') autoEvent(options.ownerId === undefined ? event : { ...event, ownerId: options.ownerId });
    else if (kind === 'state') stateEvent(event);
    else { rejected++; return false; }
    counts[kind]++; return true;
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
      if (config.trails && !reduced && body.trail.distanceToSquared(root.position) > .2) {
        if (body.kind === 'orb') elementalVfx?.emitTrail('glacial', body.trail, root.position, body.ribbon);
        else if (body.kind === 'seal') elementalVfx?.emitTrail('arcane', body.trail, root.position, body.ribbon);
        else combatVfx?.emitTrail(body.trail, root.position, 'ember', body.ember);
        body.trail.copy(root.position);
      }
    }
    bodyGroup.visible = liveBodies > 0;
    let liveCompanions = 0;
    for (const actor of actors) {
      if (actor.id === null) continue;
      if (clock - actor.seen > .5) { releaseActor(actor); continue; }
      const aura = actor.index * 4;
      if (actor.relic) {
        const fresh = !(arrays.aParams[aura + 1] > 0);
        writeGlyph(actor.index, AURA, actor.x, actor.z, 1.45, 1e9, 0, 0, RELIC_COLORS[actor.relic], reduced ? .55 : .8);
        if (fresh) arrays.aParams[aura] = clock;
      } else if (arrays.aParams[aura + 1] > 0) { arrays.aParams[aura + 1] = 0; dirty = true; }
      actor.orb.visible = actor.orbLevel > 0; actor.blade.visible = actor.bladeLevel > 0;
      if (actor.orbLevel) {
        liveCompanions++;
        actor.angle = (actor.angle + 3.4 * step) % TAU;
        const orbit = 3.4 * actor.area * (actor.orbEvolved ? 1.12 : 1);
        actor.orbMaterial.color.set(AUTO_COLORS.orbitOrb[actor.orbEvolved ? 1 : 0]);
        actor.orb.position.set(actor.x + Math.cos(actor.angle) * orbit, .95 + (reduced ? 0 : Math.sin(clock * 3 + actor.index) * .12), actor.z + Math.sin(actor.angle) * orbit);
        actor.orb.scale.setScalar(actor.orbEvolved ? 1.3 : 1); if (!reduced) actor.orb.rotation.y = clock * 2.2;
        actor.trailDebt -= step;
        if (config.trails && !reduced && actor.trailDebt <= 0) { actor.trailDebt = .07; if (actor.trail.distanceToSquared(actor.orb.position) < 9) combatVfx?.emitTrail(actor.trail, actor.orb.position, 'ember', actor.ember); actor.trail.copy(actor.orb.position); }
      }
      if (actor.bladeLevel) {
        liveCompanions++;
        actor.orbit = (actor.orbit + (reduced ? 0 : .8 * step)) % TAU;
        actor.bladeMaterial.color.set(AUTO_COLORS.guardianBlade[actor.bladeEvolved ? 1 : 0]);
        const homeX = actor.x + Math.cos(actor.orbit) * 1.15, homeZ = actor.z + Math.sin(actor.orbit) * 1.15, homeY = 2.75 + (reduced ? 0 : Math.sin(clock * 2.4 + actor.index) * .1);
        actor.dash = Math.max(0, actor.dash - step);
        // .42 s strike: fly out, hold on the target, fly home.
        const phase = actor.dash > 0 ? 1 - actor.dash / .42 : 1, reach = phase < .3 ? phase / .3 : phase < .5 ? 1 : Math.max(0, 1 - (phase - .5) / .5);
        actor.blade.position.set(homeX + (actor.tx - homeX) * reach, homeY + (1.5 - homeY) * reach, homeZ + (actor.tz - homeZ) * reach);
        actor.blade.rotation.set(reach * 1.1, reduced ? 0 : clock * 1.2 + reach * 6, 0);
        actor.blade.scale.setScalar(actor.bladeEvolved ? 1.35 : 1.1);
      }
    }
    companionGroup.visible = liveCompanions > 0;
    if (dirty) { for (const attribute of Object.values(attributes)) attribute.needsUpdate = true; dirty = false; }
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
    arrays.aParams.fill(0, (AURA_SLOTS + config.glyphs) * 4); dirty = true;
    for (let i = config.bodies; i < bodies.length; i++) if (bodies[i].id !== null) releaseBody(bodies[i]);
  }
  function setReducedMotion(value) { if (disposed) return; reduced = Boolean(value); glyphMaterial.uniforms.uMotion.value = reduced ? 0 : 1; }
  function getStats() {
    return { quality: level, reducedMotion: reduced, disposed, time: clock, activeGlyphs, glyphCapacity: config.glyphs,
      activeBodies: bodies.filter(body => body.id !== null).map(body => ({ id: body.id, kind: body.kind, relic: body.relic, x: body.x, z: body.z })),
      bodyCapacity: config.bodies, actors: actors.filter(actor => actor.id !== null).map(actor => ({ id: actor.id, relic: actor.relic, orb: actor.orb.visible, blade: actor.blade.visible, dash: actor.dash })),
      drawCalls: (glyphMesh.visible ? 1 : 0) + bodies.filter(body => body.id !== null).length + actors.reduce((n, actor) => n + (actor.orb.visible ? 2 : 0) + (actor.blade.visible ? 2 : 0), 0),
      emitted, overwritten, rejected, events: { ...counts } };
  }
  function dispose() {
    if (disposed) return;
    reset(); group.removeFromParent(); geometry.dispose(); glyphMaterial.dispose();
    for (const shape of Object.values(shapes)) shape.dispose();
    for (const body of bodies) body.material.dispose();
    for (const shape of [orbCore, orbRing, bladeEdge, bladeGuard]) shape.dispose();
    for (const actor of actors) { actor.orbMaterial.dispose(); actor.bladeMaterial.dispose(); }
    disposed = true;
  }
  setQuality(level);
  return { emit, syncActor, update, reset, setQuality, setReducedMotion, getStats, dispose };
}
