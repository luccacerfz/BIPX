/** Threat signature of every hostile projectile: a spiked, counter-rotating crimson halo with a white-hot core and a
 * dark wine rim, plus a ground reticle under the body. Shape, motion and value carry the warning, so it survives
 * colour-vision deficiency and a screen full of friendly light. One instanced draw, fixed slots, no per-frame allocation.
 * Presentation only: positions come from the caller every frame; a marker that stops being refreshed fades out by itself.
 */
import { VFX_PALETTE } from './palette.js';

const CAPACITY = 32, STALE = .09, TAU = Math.PI * 2;
const vertexShader = /* glsl */ `
uniform float uTime; uniform float uMotion;
attribute vec3 aOrigin; attribute vec4 aState;
varying vec2 vUv; varying vec4 vState;
void main() {
  vUv = position.xy; vState = aState;
  if (aState.x <= 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 center;
  if (aState.y > 0.5) {
    // Ground reticle: flat, under the body.
    center = modelViewMatrix * vec4(vec3(aOrigin.x, 0.07, aOrigin.z) + vec3(position.x, 0.0, position.y) * aState.w, 1.0);
  } else {
    center = modelViewMatrix * vec4(aOrigin, 1.0);
    center.xy += position.xy * aState.w * (1.0 + 0.06 * sin(uTime * 11.0 + aState.z) * uMotion);
  }
  gl_Position = projectionMatrix * center;
}`;
const fragmentShader = /* glsl */ `
uniform float uTime; uniform float uMotion; uniform vec3 uThreat; uniform vec3 uHot; uniform vec3 uDeep;
varying vec2 vUv; varying vec4 vState;
float star(vec2 p, float turn, float points, float sharp) {
  float a = atan(p.y, p.x) + turn, r = length(p);
  float spike = pow(abs(cos(a * points * 0.5)), sharp);
  return 1.0 - smoothstep(0.0, 0.02, r - mix(0.2, 0.98, spike));
}
void main() {
  float r = length(vUv), fade = vState.x, glow = 0.0, dark = 0.0, hot = 0.0;
  if (r > 1.0) discard;
  if (vState.y > 0.5) {
    float turn = atan(vUv.y, vUv.x) - uTime * 1.7 * uMotion + vState.z;
    float notch = step(0.2, fract(turn / ${TAU.toFixed(8)} * 4.0));
    float ring = (1.0 - smoothstep(0.02, 0.075, abs(r - 0.84))) * notch;
    float cross = (1.0 - smoothstep(0.0, 0.05, min(abs(vUv.x), abs(vUv.y)))) * (1.0 - smoothstep(0.2, 0.34, r));
    dark = (1.0 - smoothstep(0.55, 1.0, r)) * 0.42;
    glow = ring * 0.9 + cross * 0.55 + (1.0 - smoothstep(0.0, 0.9, r)) * 0.1;
  } else {
    float spin = uTime * 2.6 * uMotion + vState.z;
    float outer = star(vUv, spin, 4.0, 9.0), inner = star(vUv * 1.55, -spin * 1.4 + 0.785, 4.0, 5.0);
    dark = (1.0 - smoothstep(0.3, 0.78, r)) * 0.6;
    glow = outer * 0.75 + inner * 0.6 + exp(-r * r * 7.0) * 0.8;
    hot = exp(-r * r * 38.0) + inner * exp(-r * r * 9.0) * 0.5;
  }
  vec3 light = (uThreat * glow * 2.1 + uHot * hot * 2.6) * fade;
  float cover = clamp(dark * fade, 0.0, 0.7);
  if (cover < 0.004 && max(light.r, max(light.g, light.b)) < 0.004) discard;
  // Premultiplied output: the rim darkens what is behind it, the light is added on top.
  gl_FragColor = vec4(uDeep * cover * 0.35 + light, cover);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createThreatMarkers(THREE, parent) {
  const slotCount = CAPACITY, instances = slotCount * 2;
  const origins = new Float32Array(instances * 3), states = new Float32Array(instances * 4);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const originAttribute = new THREE.InstancedBufferAttribute(origins, 3).setUsage(THREE.DynamicDrawUsage);
  const stateAttribute = new THREE.InstancedBufferAttribute(states, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aOrigin', originAttribute); geometry.setAttribute('aState', stateAttribute);
  geometry.instanceCount = instances;
  const material = new THREE.ShaderMaterial({ name: 'HostileThreatMarkers', vertexShader, fragmentShader,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 }, uThreat: { value: new THREE.Color(VFX_PALETTE.hostile.threat) },
      uHot: { value: new THREE.Color(VFX_PALETTE.hostile.hot) }, uDeep: { value: new THREE.Color(VFX_PALETTE.hostile.deep) } },
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'VFX_HostileThreatMarkers'; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 6; mesh.raycast = () => {};
  parent.add(mesh);
  const slots = Array.from({ length: slotCount }, (_, index) => ({ index, key: null, seen: -1, fade: 0, x: 0, y: 0, z: 0, size: 1, seed: index * 1.37 }));
  let lookup = new WeakMap(), clock = 0, active = 0, tracked = 0, dropped = 0, disposed = false, limit = slotCount;
  function claim(key) {
    let free = null, stalest = null;
    for (let i = 0; i < limit; i++) { const slot = slots[i]; if (slot.key === null && slot.fade < .01) { free = slot; break; } if (clock - slot.seen > STALE && (!stalest || slot.seen < stalest.seen)) stalest = slot; }
    const slot = free || stalest; if (!slot) { dropped++; return null; }
    if (slot.key) lookup.delete(slot.key);
    slot.key = key; slot.fade = 0; lookup.set(key, slot); return slot;
  }
  /** Call once per frame for every live hostile projectile. `key` is any stable object owned by the caller. */
  function track(key, position, radius = .42) {
    if (disposed || !key || typeof key !== 'object' || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const slot = lookup.get(key) || claim(key); if (!slot) return false;
    slot.x = position.x; slot.y = Number.isFinite(position.y) ? position.y : 1.3; slot.z = position.z;
    slot.size = Math.max(.75, Math.min(2.4, (Number.isFinite(radius) ? radius : .42) * 2.6)); slot.seen = clock; tracked++;
    return true;
  }
  function update(dt, reducedMotion = false) {
    if (disposed) return;
    clock += dt; active = 0;
    // A slow frame must not read as "the caller stopped refreshing": the window follows the frame time.
    const rise = 1 - Math.exp(-dt * 30), fall = 1 - Math.exp(-dt * 22), stale = Math.max(STALE, dt * 2.5);
    for (let i = 0; i < slotCount; i++) {
      const slot = slots[i], live = slot.key !== null && clock - slot.seen <= stale && i < limit;
      slot.fade += ((live ? 1 : 0) - slot.fade) * (live ? rise : fall);
      if (!live && slot.key !== null && slot.fade < .01) { lookup.delete(slot.key); slot.key = null; slot.fade = 0; }
      const halo = i * 2, ground = halo + 1, shown = slot.fade >= .01 ? slot.fade : 0;
      if (shown) active++;
      origins[halo * 3] = origins[ground * 3] = slot.x; origins[halo * 3 + 1] = slot.y; origins[ground * 3 + 1] = 0; origins[halo * 3 + 2] = origins[ground * 3 + 2] = slot.z;
      states[halo * 4] = shown; states[halo * 4 + 1] = 0; states[halo * 4 + 2] = slot.seed; states[halo * 4 + 3] = slot.size;
      states[ground * 4] = shown; states[ground * 4 + 1] = 1; states[ground * 4 + 2] = slot.seed; states[ground * 4 + 3] = Math.max(.7, slot.size * .62);
    }
    if (active > 0 || mesh.visible) { originAttribute.needsUpdate = true; stateAttribute.needsUpdate = true; }
    mesh.visible = active > 0;
    material.uniforms.uTime.value = clock; material.uniforms.uMotion.value = reducedMotion ? 0 : 1;
  }
  function reset() {
    if (disposed) return;
    for (const slot of slots) { slot.key = null; slot.fade = 0; slot.seen = -1; }
    lookup = new WeakMap(); states.fill(0); stateAttribute.needsUpdate = true; active = 0; mesh.visible = false;
  }
  return { track, update, reset,
    setLimit(value) { limit = Math.max(8, Math.min(slotCount, Math.floor(value) || slotCount)); },
    getStats: () => ({ active, capacity: limit, tracked, dropped, drawCalls: mesh.visible ? 1 : 0 }),
    dispose() { if (disposed) return; reset(); mesh.removeFromParent(); geometry.dispose(); material.dispose(); disposed = true; } };
}
