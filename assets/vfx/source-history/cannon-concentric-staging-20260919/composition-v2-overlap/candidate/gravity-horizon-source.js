// Exact GLSL extracted from pinned originals; see provenance.json and LICENSE-MIT.txt.
import {noiseGLSL} from './gravity-noise.glsl.js';
import {commonGLSL} from './gravity-common.glsl.js';
export const BILLBOARD_VERTEX = /* glsl */ `
  uniform float uSize;      // half-width of the quad, metres
  uniform float uNudge;     // metres toward the camera — see below
  uniform float uHorizon;   // radius of the shadow, metres

  varying vec2  vLocal;     // -1..1 across the quad
  varying float vScreenR;   // that radius as a fraction of the screen's width

  void main() {
    // PlaneGeometry(1, 1) spans -0.5..0.5, so this is the unit square doubled.
    vLocal = position.xy * 2.0;

    // How big the hole actually is on screen, right now. The lens needs this
    // because its deflection has to be a fraction of the hole's *apparent*
    // size rather than a fixed slice of the frame: expressed in screen widths
    // it is invisible from across the arena and folds the image into concentric
    // mirrored rings when the camera walks up to it, which is not a subtle
    // failure — it looks like a target painted over the shot.
    vec4 centre = projectionMatrix * (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0));
    vec4 offset = projectionMatrix * (modelViewMatrix * vec4(uHorizon, 0.0, 0.0, 1.0));
    // NDC x spans two units across the frame, so the halving puts this in
    // fractions of the screen's width — the same units the post pass adds in.
    vScreenR = abs(offset.x / max(abs(offset.w), 1e-4) - centre.x / max(abs(centre.w), 1e-4)) * 0.5;

    // Camera facing: the quad's own basis is thrown away and its corners are
    // laid out in view space around the object's origin. Its local x and y are
    // therefore screen x and y, which is what lets the fragment stage read
    // vLocal as a screen direction.
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * (uSize * 2.0);
    // Pulled forward to the *near surface* of the sphere it stands for, rather
    // than left at its centre. View space looks down -Z, so this is +Z. It is
    // the more correct depth — the shadow is a silhouette, and a silhouette is
    // at the limb, not at the middle — and it is what makes a body being drawn
    // into the hole actually go *behind* it instead of z-fighting through the
    // one surface in the frame that has to stay solid black.
    mv.z += uNudge;
    gl_Position = projectionMatrix * mv;
  }
`;
export const HORIZON_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;          // half-width of the quad, metres
  uniform float uHorizon;       // radius of the shadow, metres
  uniform float uRingWidth;     // thickness of the photon ring, in horizon radii
  uniform float uRingGlow;
  uniform float uBeam;          // how hard one side of the ring is beamed
  uniform float uBeamPhase;     // which side, radians
  uniform float uHalo;          // brightness of the lensed accretion light
  uniform float uHaloFalloff;
  uniform float uWind;          // differential winding of the halo filaments
  uniform float uSpin;          // revolutions/second the whole thing turns
  uniform float uFilament;      // how far the halo is torn into strands
  uniform float uFilamentScale;
  uniform float uChurn;         // the flare envelope, 0..1
  uniform float uSeed;
  uniform float uFade;
  uniform float uOpacity;
  uniform vec3  uColorPhoton;
  uniform vec3  uColorHalo;
  uniform vec3  uColorCool;
  uniform float uGlobalGlow;

  varying vec2 vLocal;

  ${noiseGLSL}

  #define TAU 6.28318530718

  void main() {
    float len = length(vLocal);
    if (len > 1.0) discard;

    // Everything below is measured in horizon radii, so every threshold in here
    // is a shape rather than a distance and the whole disc rescales for free.
    float scale = uSize / max(uHorizon, 1e-3);
    float r = len * scale;
    float ang = atan(vLocal.y, vLocal.x);

    // One pixel, in those same units. Every band in here is floored at it, or
    // the ring aliases into a dashed circle the moment the camera pulls back.
    float px = max(fwidth(r), 1e-4);

    /* ---- the shadow ---------------------------------------------------- */
    float shadow = 1.0 - smoothstep(1.0 - px, 1.0 + px, r);

    /* ---- which side is coming toward us -------------------------------- */
    // Relativistic beaming, near enough: the approaching limb is brighter, the
    // receding one dimmer. The cheapest detail there is that says this is
    // turning rather than sitting there.
    float toward = cos(ang - uBeamPhase);
    float beam = 1.0 + uBeam * toward;

    /* ---- the photon ring ----------------------------------------------- */
    // Sat right on the shadow's edge and floored at a pixel. Energy is kept as
    // the band widens (the uRingWidth / width term), so pulling the camera back
    // dims the ring rather than turning it into a fat bright donut.
    float width = max(uRingWidth, px * 1.1);
    float d = (r - 1.0 - width * 0.65) / width;
    float ring = exp(-d * d * 2.2) * (uRingWidth / width);
    // A second, much fainter ring outside it: light that went round twice. It
    // is nearly subliminal, and it is what stops the first ring reading as a
    // drawn outline.
    float d2 = (r - 1.0 - width * 3.4) / (width * 1.6);
    ring += exp(-d2 * d2 * 2.0) * 0.16 * (uRingWidth / width);

    /* ---- the lensed halo ------------------------------------------------ */
    // Wound at a differential rate: the strands nearest the hole overtake the
    // ones outside them, which is what an orbit does and what a spinning
    // texture does not.
    float turn = uTime * uSpin * TAU + uWind / (0.25 + r * 0.85);
    vec2 wound = rot2(turn) * vLocal;
    float strands = ridged(vec3(wound * uFilamentScale, uTime * 0.25 + uSeed), 4);
    strands = mix(1.0, smoothstep(0.25, 0.95, strands), uFilament);

    // Falls off outward from the ring, and is cut dead inside the shadow —
    // there is nothing in there to be lit.
    float halo = exp(-(r - 1.0) * uHaloFalloff) * smoothstep(1.0 - px, 1.0 + px * 2.0, r);
    halo *= strands;

    /* ---- put it together ------------------------------------------------ */
    float flare = 1.0 + uChurn * 0.55;
    vec3 color = uColorPhoton * ring * uRingGlow * beam * flare;
    // The halo cools with distance: hot gold at the ring, violet out at the
    // reach — the palette of the reference sheet, read radially.
    vec3 haloTint = mix(uColorHalo, uColorCool, smoothstep(1.0, scale * 0.75, r));
    color += haloTint * halo * uHalo * beam * flare;
    color *= uGlobalGlow * uFade;

    // The disc is opaque; outside it the glow carries its own coverage, so it
    // adds to the frame instead of veiling it.
    float glow = ring * uRingGlow + halo * uHalo;
    float alpha = clamp(shadow + glow * 0.3 * uFade, 0.0, 1.0) * uOpacity;
    if (alpha < 0.002) discard;

    // Premultiplied: inside the shadow the colour is zero and the alpha is one,
    // so the frame behind it is replaced by *nothing*. Straight alpha would
    // leave a dark grey disc, and a grey black hole is not a black hole.
    gl_FragColor = vec4(color * (1.0 - shadow), alpha);
  }
`;
export const NEBULA_VERTEX = /* glsl */ `
  varying vec3 vWorld;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
export const NEBULA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3  uCentre;       // world, the middle of the hole
  uniform float uRadius;       // how far the gas reaches, metres
  uniform float uHole;         // the shadow's radius, metres — what eats the gas
  uniform float uSteps;
  uniform float uDensity;
  uniform float uAbsorb;
  uniform float uEmissive;
  uniform float uScale;
  uniform float uDetail;
  uniform float uFilament;
  uniform float uThreshold;
  uniform float uCavity;       // the clear eye around the hole, x radius
  uniform float uEdge;         // where the outer wall starts to soften
  uniform float uFlatten;      // <1 squashes the cloud into a disc
  uniform float uArms;
  uniform float uArmSharp;
  uniform float uArmWeight;
  uniform float uWind;         // differential winding — the spiral
  uniform float uTwist;        // extra turn with height
  uniform float uSpin;         // revolutions/second of the whole field
  uniform float uRise;
  uniform float uSpikes;
  uniform float uSpikeSharp;
  uniform float uSpikeReach;
  uniform float uSpikeGlow;
  uniform float uHeatFalloff;
  uniform float uBeam;         // doppler beaming
  uniform float uChurn;        // the flare envelope, 0..1
  uniform float uDrain;        // 0..1, the cloud being pulled into the hole
  uniform float uSeed;
  uniform float uFade;
  uniform float uOpacity;
  uniform vec3  uColorEdge;
  uniform vec3  uColorBody;
  uniform vec3  uColorHot;
  uniform vec3  uColorCore;

  uniform vec2  uResolution;
  uniform sampler2D uSceneDepth;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uGlobalGlow;

  varying vec3 vWorld;

  ${noiseGLSL}
  ${commonGLSL}

  #define MAX_STEPS 72
  #define TAU 6.28318530718
  // The proxy is a polyhedron and the field can wander a little past uRadius, so
  // the analytic bound is generous. Cheap: empty span costs one profile test.
  #define REACH_MARGIN 1.14

  /**
   * Where this point sits in the cloud.
   *
   * rn — distance from the middle in *oblate* units, 1 at the outer wall
   * bearing — its angle in the frame the gas is turning in, which is what makes
   *   a plain angular ripple come out as a spiral
   * up — how far off the disc plane it is, 0..1
   */
  float shellProfile(vec3 q, out float rn, out float bearing, out float up) {
    float squash = max(uFlatten, 0.05);
    vec3 qf = vec3(q.x, q.y / squash, q.z);
    rn = length(qf) / max(uRadius, 1e-3);
    // The *true* distance as well, because the eye below has to be a sphere
    // even though the envelope is a disc.
    float sphereN = length(q) / max(uRadius, 1e-3);
    up = clamp(abs(q.y) / max(uRadius * squash, 1e-3), 0.0, 1.0);

    // Draining pulls the outer wall in toward the eye rather than fading the
    // cloud where it hangs: the gas goes *down the hole*, it does not evaporate.
    float outer = mix(1.0, uCavity * 1.3, uDrain);
    float wall = 1.0 - smoothstep(outer * uEdge, outer, rn);
    // The eye, and it is the one part of this shape that is a **sphere** rather
    // than a disc. Two things force that, and both of them are about the one
    // surface in the frame that has to stay solid black.
    //
    // Measured in the oblate metric, the void is squashed to uFlatten of its
    // width — so directly above and below the hole the gas comes in to within
    // half a metre of it, and every ray that grazes the top or the bottom of the
    // shadow picks some of it up. The march stops at the sphere, so that gas can
    // only ever be drawn *in front of* the shadow, and it is doppler-beamed like
    // all the rest of it, so it lights one side and leaves the other black. What
    // that draws is a bright vertical bar straight down the middle of the hole,
    // which reads as a rendering fault rather than as anything physical.
    //
    // The inner edge is also floored strictly outside the shadow whatever the
    // editor is set to, and the ramp out of it is *long*, because a short one
    // draws a hard circle around the hole and the whole thing reads as a target
    // painted on the sky.
    float holeN = uHole / max(uRadius, 1e-3);
    float inner = max(uCavity * 0.55, holeN * 1.25);
    float eye = smoothstep(inner, max(uCavity * 1.15, inner + 0.06), sphereN);

    // The shear that makes the arms spiral. Note the constant under uWind: it
    // is what stops the winding rate blowing up toward the middle. Drop it and
    // the arms wrap several times inside the inner third of the cloud, which
    // resolves on screen as *concentric rings* — a vinyl record, not a galaxy.
    float turn = uTime * uSpin * TAU + uWind / (0.45 + rn * 1.2)
               + uTwist * (q.y / max(uRadius, 1e-3));
    bearing = atan(q.z, q.x) - turn;

    return wall * eye;
  }

  /** Density, heat and orbital direction at a world point. */
  void sampleGas(vec3 p, out float d, out float heat, out vec3 orbit) {
    d = 0.0;
    heat = 0.0;
    orbit = vec3(0.0, 0.0, 1.0);

    vec3 q = p - uCentre;
    float rn, bearing, up;
    float shell = shellProfile(q, rn, bearing, up);
    if (shell <= 0.002) return;

    // How far this parcel is from the rotation axis, 0 on it.
    //
    // **Every angular term below is singular there** — the bearing, the arms,
    // the spears and the orbital direction are all built on atan(q.z, q.x),
    // which is undefined on the axis and swings through a full turn in the
    // millimetres either side of it. Left alone, all three alias into a
    // dead-straight bright column standing on the hole, which is the single
    // most artificial thing this ability can draw: it is exactly vertical, it
    // is exactly centred, and it cuts through the one surface in the frame
    // that has to stay solid black. Every one of them is faded out here
    // instead, and each fade is also simply true — a parcel on the axis is not
    // in an arm, is not on a ray, and is not going round anything.
    float axis = smoothstep(0.0, 0.22, length(q.xz) / max(uRadius, 1e-3));

    // The sampling frame turns with the gas, so the structure is carried round
    // rather than the cloud sliding through a field pinned to the world. It has
    // to be the *same* turn the arms were measured in, twist included, or the
    // clouds and the arms wind at different rates and neither reads.
    float turn = uTime * uSpin * TAU + uWind / (0.45 + rn * 1.2)
               + uTwist * (q.y / max(uRadius, 1e-3));
    vec2 xz = rot2(turn) * q.xz;

    vec3 np = vec3(xz * uScale, q.y * uScale * 1.35 - uTime * uRise + uSeed);
    float cloud = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      cloud += amp * snoise(np);
      np = np * 2.11 + vec3(17.3, 5.9, 23.7);
      amp *= 0.5;
    }
    cloud = cloud * 0.5 + 0.5;

    // Ridged detail. Gas thrown out of something is filament and void, never a
    // uniform haze, and this is the octave that carries the violence.
    float fil = 1.0 - abs(snoise(vec3(xz, q.y * 0.7) * uScale * uDetail + uSeed * 3.0));
    float n = mix(cloud, fil, uFilament);

    // The arms, gating the density. Evaluated in the rotating frame, so the
    // radial shear in that frame bends them into spirals.
    //
    // Toward the axis the gate is faded to the value it *averages*, not to 1.
    // Fading it to 1 is the obvious thing and it is wrong: the gate is at most
    // 1, so an axis exempted from it sits permanently at the arms' peak while
    // everything around it oscillates — which draws a pale column standing on
    // the hole. Fading to the mean makes the axis unremarkable, which is the
    // whole point of a fade whose only job is to remove a singularity.
    float armGate = pow(0.5 + 0.5 * cos(bearing * uArms), uArmSharp);
    float armMean = 1.0 / (1.0 + uArmSharp);
    float arms = mix(armMean, armGate, axis);
    n *= mix(1.0, arms, uArmWeight);

    // Carved rather than faded: below the threshold there is simply no gas.
    float carved = smoothstep(uThreshold, 1.0, n);

    /* ---- the golden spears ---- */
    // Measured on the *unwound* bearing, and that is the whole trick. The arms
    // above are wound by a rate that varies with radius, which is what curls
    // them into spirals; a spear that followed the same frame would curl with
    // them and stop being a spear. Turned slowly and rigidly instead, these
    // stay straight, and straight is what makes them read as ejecta seen
    // end-on rather than as more swirl.
    float raw = atan(q.z, q.x) - uTime * uSpin * TAU * 0.35 + uSeed;
    float ray = pow(abs(cos(raw * uSpikes * 0.5)), uSpikeSharp);
    ray *= 1.0 - smoothstep(uSpikeReach * 0.25, uSpikeReach, rn);
    // Strongest in the disc plane, because they are thrown along the equator.
    ray *= (1.0 - up * 0.8) * axis;

    // The spears are *gas*, not a tint on it: they thicken the cloud where they
    // run, which is what stops them reading as a lens flare pasted over it.
    d = (carved + ray * uSpikeGlow * 0.8) * shell * uDensity * (1.0 + uChurn * 0.5);

    /* ---- how hot it is ---- */
    // Radius sets the ceiling; *density* decides how much of it this parcel
    // gets. The density term is the important half: without it every wisp near
    // the middle is gold and the whole cloud comes out as one cream disc. With
    // it the gold lives in the dense cores and the thin gas stays violet, which
    // is the reference sheet's entire colour structure.
    float radial = pow(1.0 - clamp(rn, 0.0, 1.0), uHeatFalloff);
    heat = radial * (0.18 + 0.82 * clamp(carved * 1.6, 0.0, 1.0));
    heat = clamp(heat + ray * uSpikeGlow, 0.0, 2.0);

    // Which way this parcel is travelling: a circular orbit about the vertical.
    //
    // Faded out around the axis on a much wider radius than everything else,
    // and for a different reason. The others are singular *at* the axis; this
    // one **flips sign across** it, and most of the light on any ray comes from
    // the dense gas nearest the hole — so the flip happens over the angular
    // width of that small region and the beaming draws a hard vertical edge
    // splitting the blast in half rather than the soft left-bright/right-dim
    // gradient it is supposed to. Confining it to the thin outer gas, where the
    // two limbs are genuinely separated on screen, gives the read without the
    // seam.
    float beamFade = smoothstep(0.15, 0.62, length(q.xz) / max(uRadius, 1e-3));
    orbit = normalize(vec3(-q.z, 0.0, q.x) + vec3(1e-5)) * beamFade;
  }

  /**
   * The ray's entry and exit through a sphere. Returns false when it misses, and
   * is correct with the camera inside.
   */
  bool sphereSpan(vec3 ro, vec3 rd, vec3 ce, float rad, out float t0, out float t1) {
    vec3 oc = ro - ce;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - rad * rad;
    float disc = b * b - c;
    if (disc < 0.0) return false;
    float s = sqrt(disc);
    t0 = -b - s;
    t1 = -b + s;
    return t1 > 0.0;
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - cameraPosition);

    float ta, tb;
    if (!sphereSpan(ro, rd, uCentre, uRadius * REACH_MARGIN, ta, tb)) discard;
    float t0 = max(ta, 0.0);
    float t1 = tb;

    /* ---- the hole eats whatever is behind it ---- */
    // Analytic rather than a depth test, because the horizon is a transparent
    // billboard with no depth of its own. Stopping the march at the shadow is
    // what makes gas pass in *front* of the hole and vanish behind it.
    float h0, h1;
    if (sphereSpan(ro, rd, uCentre, uHole, h0, h1)) {
      if (h0 <= 0.0) discard;   // the camera is inside the horizon
      t1 = min(t1, h0);
    }

    /* ---- and the opaque scene clips it like anything else ---- */
    // Third row of the view matrix is the camera's basis Z in world space; the
    // prepass stores a *view* depth, so it has to be divided by the cosine
    // between the ray and that axis to become a distance along this ray.
    vec3 camFwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    float packed = unpackRGBAToDepth(texture2D(uSceneDepth, screenUV));
    float sceneViewZ = perspectiveDepthToViewZ(packed, uCameraNear, uCameraFar);
    float sceneT = (-sceneViewZ) / max(dot(rd, camFwd), 1e-4);
    t1 = min(t1, sceneT);
    if (t1 <= t0) discard;

    float steps = clamp(uSteps, 6.0, float(MAX_STEPS));
    float dt = (t1 - t0) / steps;
    // Jittered start. Without it the march bands into visible shells, and that
    // banding is the single most obvious tell that a volume is stepped.
    float jitter = hash13(vec3(gl_FragCoord.xy, uTime * 60.0));
    float t = t0 + dt * jitter;

    vec3 acc = vec3(0.0);
    float trans = 1.0;

    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= steps || trans < 0.012) break;

      vec3 p = ro + rd * t;
      float d, heat;
      vec3 orbit;
      sampleGas(p, d, heat, orbit);

      if (d > 0.002) {
        // Doppler beaming: the limb sweeping toward the camera is brighter than
        // the limb sweeping away. It is the term that says *fast*.
        float beam = 1.0 + uBeam * dot(orbit, -rd);

        vec3 col = mix(uColorEdge, uColorBody, smoothstep(0.0, 0.30, heat));
        col = mix(col, uColorHot, smoothstep(0.38, 0.88, heat));
        // White is reserved for the very hottest cores. Widen this and the
        // middle of the blast blows out into a cream disc with no hue left in
        // it to correct.
        col = mix(col, uColorCore, smoothstep(1.0, 1.75, heat));

        // The floor matters as much as the peak: at a lower one the coldest gas
        // contributes almost nothing but still carries its alpha, so the outer
        // cloud stops being violet and becomes a ring of black smoke around the
        // blast — occlusion with no light in it.
        float emit = uEmissive * (0.32 + heat * heat * 2.4) * max(beam, 0.05);

        float a = 1.0 - exp(-d * uAbsorb * dt);
        acc += col * emit * a * trans;
        trans *= 1.0 - a;
      }

      t += dt;
    }

    float alpha = (1.0 - trans) * uFade * uOpacity;
    if (alpha < 0.004) discard;

    acc *= uGlobalGlow * uFade;
    // Premultiplied: acc is already weighted by its own alpha, so thick gas
    // occludes the stage while thin gas adds to it. A purely additive volume
    // could never veil the character standing in the blast.
    gl_FragColor = vec4(acc, alpha);
  }
`;

// ARPG adaptation: retain opaque upper silhouettes even when a field is in front.
// Depth is the actual color-scene prepass. This is height-based geometry protection,
// not an actor-ID mask; low props/ground retain the original black horizon.
const silhouetteGLSL = /* glsl */ `
  uniform mat4 uInverseViewProjection;
  uniform float uGroundY;
  uniform float uDepthReady;
  float gravitySilhouetteFade(vec2 screenUV, float packedDepth) {
    if (uDepthReady < .5 || packedDepth >= .99999) return 1.;
    vec4 world = uInverseViewProjection * vec4(screenUV * 2. - 1., packedDepth * 2. - 1., 1.);
    float height = world.y / world.w - uGroundY;
    return 1. - .96 * smoothstep(.95, 1.6, height);
  }
`;
// Local optical coverage sharing: only coincident screen-space Horizon apertures.
// Keeps each opaque black core, and single-field color is an exact early return.
const overlapGLSL = /* glsl */ `
  uniform int uOverlapCount;
  uniform int uOverlapIndex;
  uniform vec4 uOverlapAperture[8];
  uniform float uOverlapFade[8];
  vec4 gravityOverlapCoverage(vec4 rgba, vec2 uv) {
    if (uOverlapCount <= 1 || rgba.a < .00001) return rgba;
    float layers = 1.;
    for (int i = 0; i < 8; i++) {
      if (i >= uOverlapCount) break;
      if (i == uOverlapIndex) continue;
      vec4 aperture = uOverlapAperture[i];
      float r = length((uv - aperture.xy) / max(aperture.zw, vec2(.000001)));
      layers += (1. - smoothstep(.7, 1., r)) * uOverlapFade[i];
    }
    if (layers <= 1.00001 || rgba.a >= 1.) return rgba;
    float coverage = 1. - pow(1. - rgba.a, 1. / layers);
    return rgba * (coverage / rgba.a);
  }
`;
export const GRAVITY_HORIZON_FRAGMENT = HORIZON_FRAGMENT
  .replace('void main() {', `#include <packing>
    uniform sampler2D uSceneDepth; uniform vec2 uResolution;
    ${silhouetteGLSL}
    ${overlapGLSL}
    void main() {`)
  .replace('gl_FragColor = vec4(color * (1.0 - shadow), alpha);',
    `vec2 uv = gl_FragCoord.xy / uResolution;
    float sceneDepth = uDepthReady > .5 ? unpackRGBAToDepth(texture2D(uSceneDepth, uv)) : 1.;
    float protect = gravitySilhouetteFade(uv, sceneDepth);
    gl_FragColor = gravityOverlapCoverage(vec4(color * (1.0 - shadow), alpha) * protect, uv);`);
export const GRAVITY_NEBULA_FRAGMENT = NEBULA_FRAGMENT
  .replace('void main() {', `${silhouetteGLSL}\nvoid main() {`)
  .replace('gl_FragColor = vec4(acc, alpha);',
    'gl_FragColor = vec4(acc, alpha) * gravitySilhouetteFade(screenUV, packed);');
