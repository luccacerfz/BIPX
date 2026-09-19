// Isolated candidate: not imported by production until Environment/VFX/Combat agree.
const bindings = new WeakMap();
export const ENVIRONMENT_CUTAWAY_PATCH_VERSION = 'environment-cutaway-depth-v1';

function replaceChunk(source, chunk, replacement) {
  if (source.split(chunk).length !== 2) throw new Error(`Cutaway requires exactly one ${chunk}`);
  return source.replace(chunk, replacement);
}

export function patchEnvironmentCutawayShader(shader, uniforms, { threatLimit = 10, skillAreaLimit = 4 } = {}) {
  if (!Number.isInteger(threatLimit) || threatLimit < 1 || !Number.isInteger(skillAreaLimit) || skillAreaLimit < 1)
    throw new Error('Cutaway limits must be positive integers');
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
            uniform int uCanopySkillAreaCount;`);
  shader.fragmentShader = replaceChunk(shader.fragmentShader, '#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            vec3 focusRay = uCanopyFocus - cameraPosition;
            float alongRay = dot(vCanopyWorld - cameraPosition, focusRay) / max(dot(focusRay, focusRay), .01);
            vec3 nearestRay = cameraPosition + clamp(alongRay, 0., 1.) * focusRay;
            float corridor = 1. - smoothstep(2.5, 4.2, distance(vCanopyWorld, nearestRay));
            float heightMask = smoothstep(1.6, 2.8, vCanopyWorld.y);
            float visibilityMask = corridor * step(.01, alongRay) * step(alongRay, .98);
            for (int i = 0; i < ${threatLimit}; i++) {
              if (i >= uCanopyThreatCount) break;
              vec3 threatRay = uCanopyThreats[i].xyz - cameraPosition;
              float threatAlong = dot(vCanopyWorld - cameraPosition, threatRay) / max(dot(threatRay, threatRay), .01);
              vec3 nearestThreatRay = cameraPosition + clamp(threatAlong, 0., 1.) * threatRay;
              float threatCorridor = 1. - smoothstep(uCanopyThreats[i].w, uCanopyThreats[i].w + .8, distance(vCanopyWorld, nearestThreatRay));
              visibilityMask = max(visibilityMask, threatCorridor * step(.01, threatAlong) * step(threatAlong, .99));
            }
            float skillVisibility = 0.;
            for (int i = 0; i < ${skillAreaLimit}; i++) {
              if (i >= uCanopySkillAreaCount) break;
              vec3 areaRay = uCanopySkillAreas[i].xyz - cameraPosition;
              float areaAlong = dot(vCanopyWorld - cameraPosition, areaRay) / max(dot(areaRay, areaRay), .01);
              vec3 nearestAreaRay = cameraPosition + clamp(areaAlong, 0., 1.) * areaRay;
              float areaCorridor = 1. - smoothstep(uCanopySkillAreas[i].w, uCanopySkillAreas[i].w + .65, distance(vCanopyWorld, nearestAreaRay));
              skillVisibility = max(skillVisibility, areaCorridor * step(.01, areaAlong) * step(areaAlong, .99));
            }
            // Preserve the base silhouette/contact of walls while revealing the active floor area.
            float cutaway = max(visibilityMask * heightMask, skillVisibility * smoothstep(.7, 1.4, vCanopyWorld.y)) * uCanopyCutaway;
            float screenNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
            if (screenNoise < cutaway * .94) discard;`);
}

function install(material, binding, kind) {
  const existing = bindings.get(material);
  if (existing) {
    if (existing.uniforms !== binding.uniforms || existing.threatLimit !== binding.threatLimit || existing.skillAreaLimit !== binding.skillAreaLimit)
      throw new Error('Material already has a different cutaway binding');
    return material;
  }
  const prior = material.onBeforeCompile;
  const priorKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    prior.call(this, shader, renderer); // Retain this material's own hook only.
    patchEnvironmentCutawayShader(shader, binding.uniforms, binding);
  };
  material.customProgramCacheKey = () => `${priorKey}:${ENVIRONMENT_CUTAWAY_PATCH_VERSION}:${kind}:${binding.threatLimit}:${binding.skillAreaLimit}`;
  bindings.set(material, binding);
  material.needsUpdate = true;
  return material;
}

export function installEnvironmentCutaway(colorMaterial, uniforms, { threatLimit = 10, skillAreaLimit = 4 } = {}) {
  return install(colorMaterial, { uniforms, threatLimit, skillAreaLimit }, 'color');
}

/** Attach only cutaway to an existing depth material; do not copy the color hook. */
export function shareEnvironmentCutawayDepth(colorMaterial, depthMaterial) {
  const binding = bindings.get(colorMaterial);
  if (!binding) return false; // Unmarked actors/props retain ordinary opaque depth.
  if (!depthMaterial.isMeshDepthMaterial) throw new Error('Expected MeshDepthMaterial');
  install(depthMaterial, binding, 'depth');
  return true;
}
