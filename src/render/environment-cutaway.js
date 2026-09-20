import { ENVIRONMENT_ACTOR_LIMIT } from './environment-actor-focus.js';
// CPU-only v2: perspective-scaled aperture with a foliage-shaped rim, cedar only.
const bindings = new WeakMap();
export const ENVIRONMENT_CUTAWAY_PATCH_VERSION = 'environment-cutaway-party-aperture-v3';

function replaceChunk(source, chunk, replacement) {
  if (source.split(chunk).length !== 2) throw new Error(`Cutaway requires exactly one ${chunk}`);
  return source.replace(chunk, replacement);
}

export function patchEnvironmentCutawayShader(shader, uniforms, { threatLimit = 10, skillAreaLimit = 4, transition = 'legacy' } = {}) {
  if (!Number.isInteger(threatLimit) || threatLimit < 1 || !Number.isInteger(skillAreaLimit) || skillAreaLimit < 1)
    throw new Error('Cutaway limits must be positive integers');
  if (transition !== 'legacy' && transition !== 'canopy-lobed-aperture') throw new Error('Unknown cutaway transition');
  const canopyAperture = transition === 'canopy-lobed-aperture';
  Object.assign(shader.uniforms, uniforms); // Same uniform objects, not copied values.
  shader.vertexShader = replaceChunk(shader.vertexShader, '#include <common>', '#include <common>\nvarying vec3 vCanopyWorld;');
  // Both MeshStandardMaterial and MeshDepthMaterial contain project_vertex.
  // transformed already includes morph, skinning and displacement at this point.
  shader.vertexShader = replaceChunk(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
    vec4 canopyPosition = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      canopyPosition = batchingMatrix * canopyPosition;
    #endif
    #ifdef USE_INSTANCING
      canopyPosition = instanceMatrix * canopyPosition;
    #endif
    vCanopyWorld = (modelMatrix * canopyPosition).xyz;`);
  shader.fragmentShader = replaceChunk(shader.fragmentShader, '#include <common>', `#include <common>
            varying vec3 vCanopyWorld;
            uniform vec3 uCanopyFocus;
            uniform float uCanopyCutaway;
            uniform vec4 uCanopyThreats[${threatLimit}];
            uniform int uCanopyThreatCount;
            uniform vec4 uCanopySkillAreas[${skillAreaLimit}];
            uniform int uCanopySkillAreaCount;
            ${canopyAperture ? `uniform vec4 uCanopyActors[${ENVIRONMENT_ACTOR_LIMIT}];
            uniform float uCanopyActorStrengths[${ENVIRONMENT_ACTOR_LIMIT}];` : ''}`);
  shader.fragmentShader = replaceChunk(shader.fragmentShader, '#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            vec3 focusRay = uCanopyFocus - cameraPosition;
            float alongRay = dot(vCanopyWorld - cameraPosition, focusRay) / max(dot(focusRay, focusRay), .01);
            vec3 nearestRay = cameraPosition + clamp(alongRay, 0., 1.) * focusRay;
            float corridor = 1. - smoothstep(${canopyAperture ? '2.5 * max(alongRay, .02), 4.2 * max(alongRay, .02)' : '2.5, 4.2'}, distance(vCanopyWorld, nearestRay));
            float heightMask = smoothstep(${canopyAperture ? '.35, 1.15' : '1.6, 2.8'}, vCanopyWorld.y);
            float visibilityMask = corridor * step(.01, alongRay) * step(alongRay, .98);
            for (int i = 0; i < ${threatLimit}; i++) {
              if (i >= uCanopyThreatCount) break;
              vec3 threatRay = uCanopyThreats[i].xyz - cameraPosition;
              float threatAlong = dot(vCanopyWorld - cameraPosition, threatRay) / max(dot(threatRay, threatRay), .01);
              vec3 nearestThreatRay = cameraPosition + clamp(threatAlong, 0., 1.) * threatRay;
              float threatCorridor = 1. - smoothstep(${canopyAperture ? 'uCanopyThreats[i].w * max(threatAlong, .02), (uCanopyThreats[i].w + .8) * max(threatAlong, .02)' : 'uCanopyThreats[i].w, uCanopyThreats[i].w + .8'}, distance(vCanopyWorld, nearestThreatRay));
              visibilityMask = max(visibilityMask, threatCorridor * step(.01, threatAlong) * step(threatAlong, .99));
            }
            ${canopyAperture ? `// Party openings affect cedar color and scene depth, never shadow materials.
            for (int i = 0; i < ${ENVIRONMENT_ACTOR_LIMIT}; i++) {
              if (uCanopyActorStrengths[i] <= 0.) continue;
              vec3 actorRay = uCanopyActors[i].xyz - cameraPosition;
              float actorAlong = dot(vCanopyWorld - cameraPosition, actorRay) / max(dot(actorRay, actorRay), .01);
              vec3 nearestActorRay = cameraPosition + clamp(actorAlong, 0., 1.) * actorRay;
              float actorCorridor = 1. - smoothstep(uCanopyActors[i].w * max(actorAlong, .02), (uCanopyActors[i].w + .8) * max(actorAlong, .02), distance(vCanopyWorld, nearestActorRay));
              visibilityMask = max(visibilityMask, actorCorridor * uCanopyActorStrengths[i] * step(.01, actorAlong) * step(actorAlong, .99));
            }` : ''}
            float skillVisibility = 0.;
            for (int i = 0; i < ${skillAreaLimit}; i++) {
              if (i >= uCanopySkillAreaCount) break;
              vec3 areaRay = uCanopySkillAreas[i].xyz - cameraPosition;
              float areaAlong = dot(vCanopyWorld - cameraPosition, areaRay) / max(dot(areaRay, areaRay), .01);
              vec3 nearestAreaRay = cameraPosition + clamp(areaAlong, 0., 1.) * areaRay;
              float areaCorridor = 1. - smoothstep(${canopyAperture ? 'uCanopySkillAreas[i].w * max(areaAlong, .02), (uCanopySkillAreas[i].w + .65) * max(areaAlong, .02)' : 'uCanopySkillAreas[i].w, uCanopySkillAreas[i].w + .65'}, distance(vCanopyWorld, nearestAreaRay));
              skillVisibility = max(skillVisibility, areaCorridor * step(.01, areaAlong) * step(areaAlong, .99));
            }
            // Preserve the base silhouette/contact of walls while revealing the active floor area.
            float cutaway = max(visibilityMask * heightMask, skillVisibility * ${canopyAperture ? 'heightMask' : 'smoothstep(.7, 1.4, vCanopyWorld.y)'}) * uCanopyCutaway;
            float screenNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
            ${canopyAperture ? `// Continuous world-space lobes shape only the rim; no time or screen-pixel noise in its shape.
            // Radius scales with camera-to-target depth: the foreground aperture is not oversized.
            float foliageLobes = sin(dot(vCanopyWorld.xz, vec2(3.1, 1.7)))
              * sin(dot(vCanopyWorld.xz, vec2(-1.9, 2.8)) + vCanopyWorld.y * .65);
            float contourEdge = .12 + .08 * foliageLobes;
            float contourDistance = cutaway - contourEdge;
            float contourFeather = clamp(fwidth(contourDistance) * .75, .0001, .035);
            float contourCoverage = smoothstep(-contourFeather, contourFeather, contourDistance);
            if (screenNoise < contourCoverage) discard;` : 'if (screenNoise < cutaway * .94) discard;'}`);
}

function install(material, binding, kind) {
  const existing = bindings.get(material);
  if (existing) {
    if (existing.uniforms !== binding.uniforms || existing.threatLimit !== binding.threatLimit || existing.skillAreaLimit !== binding.skillAreaLimit || existing.transition !== binding.transition)
      throw new Error('Material already has a different cutaway binding');
    return material;
  }
  const prior = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    prior.call(this, shader, renderer); // Retain this material's own hook only.
    patchEnvironmentCutawayShader(shader, binding.uniforms, binding);
  };
  material.customProgramCacheKey = () => `${priorKey}:${ENVIRONMENT_CUTAWAY_PATCH_VERSION}:${kind}:${binding.threatLimit}:${binding.skillAreaLimit}:${binding.transition}`;
  bindings.set(material, binding);
  material.needsUpdate = true;
  return material;
}

export function installEnvironmentCutaway(colorMaterial, uniforms, { threatLimit = 10, skillAreaLimit = 4, transition = 'legacy' } = {}) {
  if (transition !== 'legacy' && transition !== 'canopy-lobed-aperture') throw new Error('Unknown cutaway transition');
  return install(colorMaterial, { uniforms, threatLimit, skillAreaLimit, transition }, 'color');
}

/** Attach only cutaway to an existing depth material; do not copy the color hook. */
export function shareEnvironmentCutawayDepth(colorMaterial, depthMaterial) {
  const binding = bindings.get(colorMaterial);
  if (!binding) return false; // Unmarked actors/props retain ordinary opaque depth.
  if (!depthMaterial.isMeshDepthMaterial) throw new Error('Expected MeshDepthMaterial');
  install(depthMaterial, binding, 'depth');
  return true;
}

/** Stable, side-effect-free identity for depth warmup deduplication. */
export function getEnvironmentCutawayDepthWarmupIdentity(colorMaterial) {
  const binding = bindings.get(colorMaterial);
  if (!binding) return '';
  return [ENVIRONMENT_CUTAWAY_PATCH_VERSION, 'depth', binding.threatLimit,
    binding.skillAreaLimit, binding.transition].join(':');
}
