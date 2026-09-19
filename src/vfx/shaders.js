/**
 * VFX adapted from SamuraiThirdPersonTemplateThreeJS, MIT.
 * Copyright (c) 2026 mohamedachrefelouafi. See SAMURAI-LICENSE.txt.
 * The blackbody function is retained; ring/seal and analytic particle ideas
 * are adapted to BIPX's flat arena, instancing budget and Three.js r164.
 */
export const thermalGLSL = /* glsl */ `
vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 12000.0) * 0.01;
  vec3 c;
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = 0.3900816 * log(t) - 0.6318414;
    c.b = t <= 19.0 ? 0.0 : 0.5432068 * log(t - 10.0) - 1.1962540;
  } else {
    c.r = 1.2929362 * pow(t - 60.0, -0.1332047);
    c.g = 1.1298909 * pow(t - 60.0, -0.0755148);
    c.b = 1.0;
  }
  c = clamp(c, 0.0, 1.0);
  return c * c * (0.6 + 0.4 * c);
}
`;

export const noiseGLSL = /* glsl */ `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise2(vec2 p) {
  vec2 cell = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
    mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + 1.0), f.x), f.y);
}
float band(float value, float center, float width) {
  return 1.0 - smoothstep(width, width + 0.016, abs(value - center));
}
`;

export const particleVertex = /* glsl */ `
uniform float uTime;
uniform float uMotion;
attribute vec3 aOrigin;
attribute vec3 aVelocity;
attribute vec3 aColor;
attribute vec4 aParams;
attribute vec4 aDynamics;
varying vec2 vUv;
varying vec3 vColor;
varying float vLife;
varying float vKind;
varying float vSeed;
varying float vAlive;
void main() {
  float age = uTime - aParams.x;
  float life = max(aParams.y, 0.001);
  float t = clamp(age / life, 0.0, 1.0);
  vAlive = step(0.0, age) * (1.0 - step(life, age));
  vLife = t; vKind = aParams.w; vColor = aColor;
  vSeed = aDynamics.w; vUv = position.xy;
  float drag = max(aDynamics.x, 0.05);
  float decay = exp(-drag * max(age, 0.0));
  float travel = (1.0 - decay) / drag;
  vec3 acceleration = vec3(0.0, aDynamics.y, 0.0);
  vec3 center = aOrigin + (aVelocity * travel + acceleration * (max(age, 0.0) - travel) / drag) * uMotion;
  if (vKind > 1.5 && vKind < 4.5) center.y = max(center.y, 0.06);
  vec3 velocity = (aVelocity * decay + acceleration * travel) * uMotion;
  vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
  vec2 viewVelocity = (modelViewMatrix * vec4(velocity, 0.0)).xy;
  float speed = length(viewVelocity);
  vec2 axis = speed > 0.001 ? viewVelocity / speed : vec2(0.0, 1.0);
  float angle = aDynamics.z * age + vSeed;
  vec2 corner = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * position.xy;
  float size = aParams.z;
  if (vKind < 1.5) {
    size *= mix(1.0, 0.28, t);
    float stretch = min(4.0, 1.0 + speed * 0.09);
    corner = vec2(-axis.y, axis.x) * position.x + axis * position.y * stretch;
  } else if (vKind < 3.5) {
    size *= mix(0.5, 1.8, t);
  } else if (vKind > 5.5) {
    size *= mix(0.7, 1.4, t);
    corner.y *= 1.7;
  }
  viewCenter.xy += corner * size * vAlive;
  gl_Position = projectionMatrix * viewCenter;
}
`;

export const particleFragment = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
varying float vLife;
varying float vKind;
varying float vSeed;
varying float vAlive;
${noiseGLSL}
${thermalGLSL}
void main() {
  if (vAlive < 0.5) discard;
  float r = length(vUv);
  if (r > 1.0) discard;
  float fade = (1.0 - smoothstep(0.35, 1.0, vLife));
  float alpha = (1.0 - smoothstep(0.1, 1.0, r)) * fade;
  vec3 color = vColor;
  if (vKind < 1.5) {
    float core = exp(-r * r * 12.0);
    alpha = (core + exp(-r * r * 3.5) * 0.22) * fade;
    if (vKind > 0.5) color *= blackbody(mix(3000.0, 1300.0, vLife)) * 2.6;
    else color = mix(color, vec3(1.0), core * 0.48) * 1.7;
  } else if (vKind < 3.5) {
    float cloud = noise2(vUv * 3.8 + vSeed + uTime * 0.05);
    alpha *= smoothstep(0.0, 0.13, vLife) * (0.26 + cloud * 0.52);
    color *= 0.62 + 0.38 * (vUv.y * 0.5 + 0.5);
    if (vKind < 2.5) alpha *= 0.38;
  } else if (vKind < 4.5) {
    alpha = (1.0 - smoothstep(0.32, 0.94, r)) * fade * 0.84;
  } else if (vKind < 5.5) {
    alpha *= smoothstep(0.0, 0.15, vLife) * 0.5;
    color *= 0.9;
  } else {
    float curl = noise2(vec2(vUv.x * 3.0 + vSeed, vUv.y * 3.0 - uTime * 2.3));
    float flame = clamp((1.0 - r) * 1.4 - curl * 0.6, 0.0, 1.0);
    alpha = flame * fade * smoothstep(0.0, 0.09, vLife);
    color *= blackbody(1200.0 + flame * 1900.0) * 3.3;
  }
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const glyphVertex = /* glsl */ `
uniform float uTime;
attribute vec3 aOrigin;
attribute vec3 aColor;
attribute vec4 aParams;
attribute vec4 aShape;
varying vec2 vUv;
varying vec3 vColor;
varying float vAge;
varying float vKind;
varying float vSeed;
varying float vAlive;
varying float vForm;
varying float vRadius;
void main() {
  float age = uTime - aParams.x;
  vAge = clamp(age / max(aParams.y, 0.001), 0.0, 1.0);
  vAlive = step(0.0, age) * (1.0 - step(aParams.y, age));
  vUv = position.xy;
  vColor = aColor; vKind = aParams.w; vSeed = aShape.w; vForm = aShape.z; vRadius = max(aParams.z, 0.05);
  float angle = aShape.x;
  vec2 p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * position.xy * aParams.z * vAlive;
  vec3 world = aOrigin + vec3(p.x, p.y * sin(aShape.y), p.y * cos(aShape.y));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
}
`;

export const glyphFragment = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform vec3 uEmber;
varying vec2 vUv;
varying vec3 vColor;
varying float vAge;
varying float vKind;
varying float vSeed;
varying float vAlive;
varying float vForm;
varying float vRadius;
${noiseGLSL}
const float TAU = 6.28318530718;
float gauss(float d, float width) { float q = d / width; return exp(-q * q); }
void main() {
  if (vAlive < 0.5) discard;
  float r = length(vUv);
  if (r > 1.0) discard;
  float turn = fract(atan(vUv.y, vUv.x) / TAU + 0.5);
  float t = vAge;
  float fade = 1.0 - smoothstep(0.45, 1.0, t);
  float light = 0.0, heat = 0.0;
  vec3 color = vColor;
  if (vKind < 0.5) {
    // ShockRing: the decelerating front exposes cracks in its wake. The band never gets thinner than 12 cm of world.
    float front = 1.0 - (1.0 - t) * (1.0 - t);
    float ring = band(r, front, max(mix(0.025, 0.009, front), 0.06 / vRadius));
    float wake = smoothstep(front - 0.16, front, r) * step(r, front) * 0.13;
    float cell = turn * 11.0 + vSeed;
    float index = floor(cell);
    float len = mix(0.3, 0.9, hash21(vec2(index, vSeed)));
    float wobble = (noise2(vec2(r * 5.0, index * 3.7 + vSeed)) - 0.5) * 0.3;
    float split = abs(fract(cell) - 0.5 + wobble);
    float crack = (1.0 - smoothstep(0.008, 0.028, split * max(r, 0.08)));
    crack *= (1.0 - smoothstep(front - 0.12, front, r)) * step(0.05, r) * step(r, len);
    light = ((ring + wake) / (0.6 + front) + crack * 0.45) * pow(1.0 - t, 1.2);
  } else if (vKind < 1.5) {
    // SummonSeal: counter-rotating scales and deterministic runic strokes.
    float spin = uTime * 0.04 * uMotion;
    float drawn = 1.0 - smoothstep(clamp(t * 5.0, 0.0, 1.1) - 0.025, clamp(t * 5.0, 0.0, 1.1), turn);
    float ticks = 1.0 - smoothstep(0.025, 0.08, abs(fract(turn * 48.0 + spin) - 0.5));
    float cell = fract(turn * 12.0 - spin * 0.6);
    float rune = band(cell, 0.5, 0.025) + band(r, 0.74, 0.009) * step(0.29, cell) * step(cell, 0.72);
    rune += band(cell + (r - 0.72) * 3.0, 0.5, 0.02) * step(0.72, r);
    rune *= step(0.66, r) * step(r, 0.8);
    float triangle = r * cos(mod(atan(vUv.y, vUv.x) + spin * 2.0 + 1.0472, 2.0944) - 1.0472);
    light = band(r, 0.94, 0.006) + band(r, 0.87, 0.004) * 0.4;
    light += ticks * step(0.87, r) * step(r, 0.95) * 0.8 + rune * 0.6;
    light += band(triangle, 0.25, 0.006) * step(r, 0.53) * 0.6 + band(r, 0.59, 0.004) * 0.6;
    light = light * drawn * fade * 0.85;
  } else if (vKind < 2.5) {
    // Blade arc. |vForm| is the half-angle of the swing around local +X and its sign the sweep direction; a value
    // above PI draws the full turn of the combo finisher. The wake is hollow towards the wielder and never exceeds
    // ~0.3 alpha, so the silhouette behind it keeps reading; only the thin leading edge and the tip line are hot.
    // +10 on the magnitude marks an owner-coloured arc (relics, companions): its wake keeps the tint instead of Aldric's ember.
    float raw = abs(vForm), owned = step(8.0, raw), halfArc = raw - owned * 10.0, side = vForm < 0.0 ? -1.0 : 1.0, full = step(3.2, halfArc);
    float ang = atan(vUv.y, vUv.x) * side;
    float inside = mix(1.0 - smoothstep(halfArc - 0.05, halfArc + 0.02, abs(ang)), 1.0, full);
    float sweep = 1.0 - pow(1.0 - clamp(t / mix(0.66, 0.5, full), 0.0, 1.0), 1.5);
    float lead = mix(-halfArc - 0.12, halfArc + 0.12, sweep);
    float behind = lead - ang;
    float wake = step(0.0, behind) * exp(-behind * mix(1.25, 0.45, full));
    float edge = gauss(behind, mix(0.075, 0.11, full));
    float tipWidth = max(mix(0.03, 0.05, full), 0.05 / vRadius);
    float tip = gauss(r - 0.9, tipWidth);
    float body = smoothstep(0.5, 0.9, r) * (1.0 - smoothstep(0.9, 0.9 + tipWidth * 1.6, r));
    float hold = 1.0 - smoothstep(mix(0.55, 0.62, full), 1.0, t);
    heat = inside * edge * (tip + body * 0.5) * hold;
    light = inside * (tip * wake * 0.75 + body * body * wake * mix(0.2, 0.3, full)) * hold + heat * 0.85;
    color = mix(mix(uEmber, vColor * 0.85, owned), vColor, clamp(tip * 0.7 + edge, 0.0, 1.0));
  } else if (vKind < 3.5) {
    float angle = atan(vUv.y, vUv.x);
    float spikes = pow(abs(cos(angle * 3.0)), 20.0);
    light = (exp(-r * r * 18.0) + spikes * exp(-r * 4.0) * 0.28) * fade;
  } else if (vKind < 4.5) {
    // Honest reach of a melee cone on the ground: a quiet wedge whose wave runs out to the authoritative range.
    float halfArc = abs(vForm), ang = atan(vUv.y, vUv.x);
    float inside = 1.0 - smoothstep(halfArc - 0.035, halfArc + 0.015, abs(ang));
    float front = mix(0.4, 0.985, 1.0 - pow(1.0 - clamp(t / 0.5, 0.0, 1.0), 2.6));
    float wave = gauss(r - front, max(0.022, 0.07 / vRadius));
    float rim = gauss(r - 0.985, max(0.01, 0.04 / vRadius)) * smoothstep(0.25, 0.55, t);
    // On the dark cemetery ground even 5 % of additive ember reads as a solid decal: the fill stays under 2 %.
    float fill = (1.0 - smoothstep(front - 0.03, front, r)) * smoothstep(0.1, 0.3, r) * 0.016;
    float flank = gauss(abs(ang) - halfArc + 0.035, 0.018) * smoothstep(0.14, 0.3, r) * (1.0 - smoothstep(front - 0.06, front, r)) * 0.09;
    light = inside * (wave * 0.3 + rim * 0.14 + fill + flank) * (1.0 - smoothstep(0.55, 1.0, t));
  } else if (vKind < 5.5) {
    // Finisher shock: a solid band (not a line) that stops exactly on the authoritative radius, light behind the front.
    float grow = 1.0 - pow(1.0 - clamp(t / 0.36, 0.0, 1.0), 3.0);
    grow = mix(1.0, grow, step(0.5, uMotion));
    float front = mix(0.1, 0.972, grow), bandWidth = max(0.028, 0.125 / vRadius);
    float solid = 1.0 - smoothstep(bandWidth * 0.55, bandWidth, abs(r - front));
    float core = gauss(r - front, bandWidth * 0.3);
    float wake = smoothstep(front - 0.35, front, r) * step(r, front) * 0.07 * (1.0 - t);
    float split = abs(fract(turn * 9.0 + vSeed) - 0.5 + (noise2(vec2(r * 4.0, floor(turn * 9.0 + vSeed) * 3.7)) - 0.5) * 0.35);
    float crack = (1.0 - smoothstep(0.006, 0.026, split * max(r, 0.08))) * step(0.12, r) * step(r, front - bandWidth) * 0.5;
    float hold = 1.0 - smoothstep(0.42, 1.0, t);
    heat = core * hold;
    light = (solid * 0.62 + core * 0.7 + wake + crack * (1.0 - t)) * hold;
    color = mix(vColor, uEmber, 0.5);
  } else {
    // Fake light on the ground: a soft disc in the colour of whatever just flashed above it. vForm is its strength.
    float pool = exp(-r * r * 3.4) * (1.0 - smoothstep(0.75, 1.0, r));
    light = pool * clamp(vForm, 0.0, 1.0) * pow(1.0 - t, 1.6);
  }
  if (light < 0.003) discard;
  color = mix(color, vec3(1.0), clamp(heat, 0.0, 1.0) * 0.72) * (1.0 + clamp(heat, 0.0, 1.0) * 1.5);
  gl_FragColor = vec4(color * 1.5, light);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
