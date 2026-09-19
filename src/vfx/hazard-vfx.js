/**
 * BIPX hazard presentation for Three.js r164.
 * Owns no gameplay clock, damage, spawn policy, camera motion or lights.
 * Persistent warnings use a dedicated bounded instance buffer; decorative
 * impacts reuse createCombatVfx and its existing quality/reduced-motion budget.
 */
import { VFX_PALETTE } from './palette.js';

// Colour ownership (palette.js): a hazard is an enemy area, so every warning and every impact is drawn in the hostile
// threat colour. The symbol, the dark underlay and the countdown track tell the hazards apart — never the hue.
const THREAT = VFX_PALETTE.hostile.threat;
export const HAZARD_VISUALS = Object.freeze({
  graveSpikes: Object.freeze({ symbol: 0, color: THREAT, effect: null }),
  profaneCircle: Object.freeze({ symbol: 1, color: THREAT, effect: 'judgement' }),
  crackedLightning: Object.freeze({ symbol: 2, color: THREAT, effect: 'lightning' }),
  hazardFrost: Object.freeze({ symbol: 3, color: THREAT, effect: 'frost', candidate: true }),
  spectralBlades: Object.freeze({ symbol: 4, color: THREAT, effect: 'bladeStorm', candidate: true }),
});

const vertexShader = /* glsl */ `
attribute vec3 aOrigin;
attribute vec3 aColor;
attribute vec4 aParams;
attribute float aSpent;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vParams;
varying float vSpent;
void main() {
  vUv = position.xy; vColor = aColor; vParams = aParams; vSpent = aSpent;
  // radius is the damage radius, without pulsation or expansion.
  vec3 world = aOrigin + vec3(position.x * aParams.x, 0.0, position.y * aParams.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform float uDetail;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vParams;
varying float vSpent;
const float TAU = 6.28318530718;
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 d = b-a;
  return length(p-a-d*clamp(dot(p-a,d)/max(dot(d,d),0.00001),0.0,1.0));
}
float iconDistance(vec2 p, float kind) {
  float d = 10.0;
  if (kind < 0.5) {
    // Three grave stakes: no reliance on hue.
    for(int i=0;i<3;i++) {
      float x=(float(i)-1.0)*0.22;
      d=min(d,segmentDistance(p,vec2(x,-0.2),vec2(x,0.19)));
      d=min(d,segmentDistance(p,vec2(x-0.075,0.09),vec2(x,0.21)));
      d=min(d,segmentDistance(p,vec2(x+0.075,0.09),vec2(x,0.21)));
    }
  } else if (kind < 1.5) {
    // Profane seal: triangle and descending axis.
    d=min(segmentDistance(p,vec2(0.0,0.35),vec2(-0.3,-0.2)),
          segmentDistance(p,vec2(-0.3,-0.2),vec2(0.3,-0.2)));
    d=min(d,segmentDistance(p,vec2(0.3,-0.2),vec2(0.0,0.35)));
    d=min(d,segmentDistance(p,vec2(0.0,0.12),vec2(0.0,-0.35)));
  } else if (kind < 2.5) {
    // Lightning: a continuous zigzag.
    d=segmentDistance(p,vec2(0.14,0.36),vec2(-0.17,0.02));
    d=min(d,segmentDistance(p,vec2(-0.17,0.02),vec2(0.17,0.02)));
    d=min(d,segmentDistance(p,vec2(0.17,0.02),vec2(-0.14,-0.36)));
  } else if (kind < 3.5) {
    // Frost: six spokes and forks, including on low quality.
    for(int i=0;i<6;i++) {
      float a=float(i)*TAU/6.0;
      vec2 axis=vec2(cos(a),sin(a)), side=vec2(-axis.y,axis.x);
      d=min(d,segmentDistance(p,vec2(0.0),axis*0.36));
      d=min(d,segmentDistance(p,axis*0.2,axis*0.29+side*0.09));
      d=min(d,segmentDistance(p,axis*0.2,axis*0.29-side*0.09));
    }
  } else {
    // Spectral blades: three swords with explicit crossguards and points.
    for(int i=0;i<3;i++) {
      float x=(float(i)-1.0)*0.24;
      d=min(d,segmentDistance(p,vec2(x,-0.34),vec2(x,0.33)));
      d=min(d,segmentDistance(p,vec2(x-0.085,-0.14),vec2(x+0.085,-0.14)));
      d=min(d,segmentDistance(p,vec2(x-0.06,0.23),vec2(x,0.34)));
      d=min(d,segmentDistance(p,vec2(x+0.06,0.23),vec2(x,0.34)));
    }
  }
  return d;
}
void main() {
  float r=length(vUv);
  if(r>1.0 || vParams.w<=0.0) discard;
  float progress=clamp(vParams.y,0.0,1.0);
  float aa=clamp(fwidth(r)*1.3,0.0015,0.014);
  // Both dark underlay and bright boundary are INSIDE the actual radius.
  float outline=smoothstep(0.92-aa,0.92+aa,r);
  float boundary=smoothstep(0.973-aa,0.973+aa,r);
  float angle=fract(atan(vUv.x,-vUv.y)/TAU+1.0);
  float track=smoothstep(0.835-aa,0.835+aa,r)*(1.0-smoothstep(0.875-aa,0.875+aa,r));
  float countdown=track*step(angle,progress)*(1.0-vSpent);
  float d=iconDistance(vUv,vParams.z);
  float icon=1.0-smoothstep(0.012,0.027,d);
  float iconShadow=1.0-smoothstep(0.032,0.050,d);
  float hatching=step(0.89,fract((vUv.x+vUv.y)*12.0))*uDetail*step(r,0.76)*0.04;
  float fill=(0.055+progress*0.055+hatching)*(1.0-vSpent);
  float dark=max(outline*0.78,iconShadow*0.76);
  float light=max(boundary*0.94,max(countdown*0.92,icon*0.95));
  vec3 color=mix(vColor*0.33,vec3(0.012,0.018,0.024),dark);
  color=mix(color,mix(vColor,vec3(1.0),0.50),light);
  // After a one-shot impact, fade to a neutral spent sign, never an active zone.
  color=mix(color,vec3(0.48,0.53,0.57),vSpent*0.78);
  float alpha=max(fill,max(dark,light))*vParams.w;
  if(alpha<0.005) discard;
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const validId = id => (typeof id === 'string' && id.length > 0) ||
  (typeof id === 'number' && Number.isFinite(id)) || (id !== null && typeof id === 'object');
const QUALITY = Object.freeze({ high: 1, medium: 0.6, low: 0 });

/**
 * upsert accepts simulation/authority snapshots; it never predicts an impact.
 * impact(id) must be called exactly at the gameplay impact event. Repeated
 * calls are suppressed for that live id. Late attach with triggered:true is
 * already spent and does NOT replay an old strike. remove(id) ends ownership.
 * Caller IDs must be unique per live hazard (local trap object is suitable).
 */
export function createHazardVfx({ THREE, scene, vfx, capacity = 8, quality = 'high',
  reducedMotion = false, enableCandidates = false } = {}) {
  if (!THREE?.InstancedBufferGeometry || !scene?.add) throw new TypeError('Hazard VFX needs THREE and scene.');
  const limit = clamp(Math.floor(Number.isFinite(capacity) ? capacity : 8), 1, 32);
  const slots = Array.from({ length: limit }, () => ({ id: null, type: null, occupied: false,
    position: { x: 0, y: 0, z: 0 }, radius: 0, elapsed: 0, telegraph: 1, duration: 1,
    color: 0xffffff, triggered: false, fired: false, impactElapsed: null }));
  const origin = new Float32Array(limit * 3), colors = new Float32Array(limit * 3);
  const params = new Float32Array(limit * 4), spent = new Float32Array(limit);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]), 3));
  geometry.setIndex([0,1,2,0,2,3]);
  const attributes = [
    ['aOrigin',origin,3], ['aColor',colors,3], ['aParams',params,4], ['aSpent',spent,1],
  ].map(([name,array,size]) => {
    const attribute = new THREE.InstancedBufferAttribute(array,size).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name,attribute); return attribute;
  });
  const material = new THREE.ShaderMaterial({
    uniforms: { uDetail: { value: 1 } }, vertexShader, fragmentShader,
    extensions: { derivatives: true }, transparent: true, depthTest: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.NormalBlending, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = 'HazardWarnings'; mesh.frustumCulled = false; mesh.renderOrder = 3;
  mesh.visible = false; mesh.raycast = () => {}; scene.add(mesh);
  geometry.instanceCount = limit;
  const color = new THREE.Color();
  let currentQuality = 'high', motionReduced = Boolean(reducedMotion), disposed = false;
  let rejected = 0, overflow = 0, impacts = 0, suppressed = 0;
  const lookup = id => slots.findIndex(slot => slot.occupied && slot.id === id);
  function write(index) {
    const slot = slots[index], p = index * 4, o = index * 3;
    if (!slot.occupied) { params[p+3] = 0; return; }
    origin[o] = slot.position.x; origin[o+1] = slot.position.y + 0.055; origin[o+2] = slot.position.z;
    color.set(slot.color); colors[o] = color.r; colors[o+1] = color.g; colors[o+2] = color.b;
    params[p] = slot.radius; params[p+1] = clamp(slot.elapsed / slot.telegraph,0,1);
    params[p+2] = HAZARD_VISUALS[slot.type].symbol;
    const after = slot.impactElapsed === null ? 0 : Math.max(0,slot.elapsed-slot.impactElapsed);
    params[p+3] = slot.triggered ? Math.max(0,1-after/0.24)*0.65 : 1;
    spent[index] = slot.triggered ? 1 : 0;
  }
  function flush() {
    for (const attribute of attributes) attribute.needsUpdate = true;
    mesh.visible = slots.some((slot,index) => slot.occupied && params[index*4+3] > 0);
  }
  function upsert(snapshot) {
    if (disposed) return false;
    const { id, type, position, radius, elapsed, telegraph, duration } = snapshot ?? {};
    const profile = Object.prototype.hasOwnProperty.call(HAZARD_VISUALS,type) ? HAZARD_VISUALS[type] : null;
    if (!validId(id) || !profile || (profile.candidate && !enableCandidates) ||
      !position || ![position.x,position.z,radius,elapsed,telegraph,duration].every(Number.isFinite) ||
      (position.y !== undefined && !Number.isFinite(position.y)) || radius <= 0 || radius > 18 ||
      elapsed < 0 || telegraph <= 0 || duration < telegraph ||
      (snapshot.triggered && elapsed + 1e-7 < telegraph)) { rejected++; return false; }
    let index = lookup(id), existing = index >= 0;
    if (existing && (slots[index].type !== type || slots[index].radius !== radius ||
      slots[index].position.x !== position.x || slots[index].position.z !== position.z ||
      slots[index].position.y !== (position.y ?? 0) ||
      slots[index].telegraph !== telegraph || slots[index].duration !== duration)) {
      // A live warning cannot silently move, resize, or change its countdown.
      rejected++; return false;
    }
    if (!existing) {
      index = slots.findIndex(slot => !slot.occupied);
      if (index < 0) { overflow++; return false; } // caller must retain fallback
    }
    const slot = slots[index];
    if (!existing) {
      slot.id = id; slot.occupied = true; slot.type = type; slot.radius = radius;
      slot.position.x = position.x; slot.position.y = position.y ?? 0; slot.position.z = position.z;
      slot.telegraph = telegraph; slot.duration = duration; slot.elapsed = 0;
      slot.triggered = false; slot.fired = false; slot.impactElapsed = null;
      slot.color = profile.color; // the caller's table colour is ignored on purpose: threats have one owner
    }
    slot.elapsed = Math.max(slot.elapsed,elapsed); // delayed packet never rewinds
    if (snapshot.triggered && !slot.triggered) {
      slot.triggered = true; slot.fired = true;
      slot.impactElapsed = telegraph; // already spent: never replay on late join
    }
    write(index); flush(); return true;
  }
  function impact(id) {
    if (disposed) return false;
    const index = lookup(id);
    if (index < 0) { rejected++; return false; }
    const slot = slots[index], profile = HAZARD_VISUALS[slot.type];
    if (slot.fired) { suppressed++; return false; }
    // Calling before the gameplay windup completes cannot prematurely flash.
    if (slot.elapsed + 1e-7 < slot.telegraph) { rejected++; return false; }
    slot.triggered = true; slot.fired = true; slot.impactElapsed = slot.elapsed;
    write(index); flush();
    if (!profile.effect) return false; // grave spikes retain their old impact
    const options = { color: slot.color, radius: slot.radius,
      intensity: (currentQuality === 'high' ? 0.7 : 0.5) * (motionReduced ? 0.65 : 1) };
    if (profile.effect === 'lightning') {
      options.target = { x: slot.position.x, y: slot.position.y + 4.8, z: slot.position.z };
    }
    const emitted = vfx?.emit(profile.effect,slot.position,options) === true;
    if (emitted) impacts++;
    return emitted;
  }
  function remove(id) {
    if (disposed) return false;
    const index = lookup(id); if (index < 0) return false;
    const slot = slots[index]; slot.id = null; slot.occupied = false; slot.type = null;
    write(index); flush(); return true;
  }
  function reset() {
    if (disposed) return;
    for (const slot of slots) { slot.id = null; slot.occupied = false; slot.type = null; }
    params.fill(0); spent.fill(0); flush();
  }
  function setQuality(value) {
    if (disposed) return;
    currentQuality = Object.prototype.hasOwnProperty.call(QUALITY,value) ? value : 'medium';
    material.uniforms.uDetail.value = motionReduced ? 0 : QUALITY[currentQuality];
  }
  function setReducedMotion(value) { motionReduced = Boolean(value); setQuality(currentQuality); }
  function getStats() {
    return { capacity: limit, active: slots.filter(slot => slot.occupied).length,
      visible: slots.filter((slot,index) => slot.occupied && params[index*4+3] > 0).length,
      drawCalls: mesh.visible ? 1 : 0, quality: currentQuality, reducedMotion: motionReduced,
      enableCandidates, rejected, overflow, impacts, suppressed, disposed,
      snapshots: slots.filter(slot => slot.occupied).map(slot => ({
        id: typeof slot.id === 'object' ? '[local object]' : slot.id, type: slot.type,
        position: { ...slot.position }, radius: slot.radius, elapsed: slot.elapsed,
        phase: clamp(slot.elapsed/slot.telegraph,0,1), triggered: slot.triggered,
      })) };
  }
  function dispose() {
    if (disposed) return;
    reset(); mesh.removeFromParent(); geometry.dispose(); material.dispose(); disposed = true;
  }
  setQuality(quality);
  return { upsert, impact, remove, reset, setQuality, setReducedMotion, getStats, dispose };
}
