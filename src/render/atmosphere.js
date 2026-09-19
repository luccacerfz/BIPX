// Analytic height fog adapted from SamuraiThirdPersonTemplateThreeJS, MIT.
// Copyright (c) 2026 mohamedachrefelouafi. See ../vfx/SAMURAI-LICENSE.txt.
export function createWorldAtmosphere({ THREE, moon }) {
  const patched = new WeakSet();
  const uniforms = {
    uHazeColor: { value: new THREE.Color(0x203d46) },
    uHazeSunColor: { value: new THREE.Color(0x647d89) },
    uHazeSunDir: { value: moon.position.clone().normalize() },
    uHazeDensity: { value: .006 }, uHazeStart: { value: 20 },
    uHazeGround: { value: .045 }, uHazeBase: { value: .3 },
    uHazeFalloff: { value: 3.5 }, uHazeInscatter: { value: .35 },
    uHazeSunPower: { value: 5 }, uHazeMax: { value: .82 },
  };
  let materialCount = 0;
  function patch(material) {
    if (!material?.isMeshStandardMaterial || patched.has(material)) return;
    patched.add(material); materialCount++;
    const prior = material.onBeforeCompile;
    const priorKey = material.customProgramCacheKey.bind(material);
    const key = priorKey();
    material.fog = false;
    material.onBeforeCompile = function(shader, renderer) {
      prior.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAtmoWorld;')
        .replace('#include <fog_vertex>', `#include <fog_vertex>
          vec4 atmospherePosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            atmospherePosition = instanceMatrix * atmospherePosition;
          #endif
          vAtmoWorld = (modelMatrix * atmospherePosition).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAtmoWorld;\n' + atmosphereGLSL)
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb = applyAtmosphere(gl_FragColor.rgb, vAtmoWorld);');
    };
    material.customProgramCacheKey = () => key + ':bipx-height-fog-v1';
    material.needsUpdate = true;
  }
  return {
    patchObject(root) {
      root.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) patch(material);
      });
    },
    update() { uniforms.uHazeSunDir.value.copy(moon.position).normalize(); },
    getStats() { return { type: 'analytic-height-fog', patchedMaterials: materialCount, extraPasses: 0 }; },
  };
}

const atmosphereGLSL = /* glsl */ `
#ifndef ATMOSPHERE_INCLUDED
#define ATMOSPHERE_INCLUDED

uniform vec3  uHazeColor;
uniform vec3  uHazeSunColor;
uniform vec3  uHazeSunDir;    // world direction *toward* the sun
uniform float uHazeDensity;   // 1/m of the layer that is everywhere
uniform float uHazeStart;     // metres of clear air in front of the lens
uniform float uHazeGround;    // extra 1/m at the floor of the mist
uniform float uHazeBase;      // world Y that mist sits on
uniform float uHazeFalloff;   // metres it takes to thin by 1/e
uniform float uHazeInscatter; // how far the haze goes toward the sun's colour
uniform float uHazeSunPower;  // how tight that lobe is
uniform float uHazeMax;       // ceiling, so the far field never goes fully flat

/**
 * The colour of the air along a view ray, and how much of it there is.
 *
 * @param color    what the surface radiates
 * @param worldPos where that surface is
 */
vec3 applyAtmosphere(vec3 color, vec3 worldPos) {
  vec3 toEye = cameraPosition - worldPos;
  float dist = length(toEye);
  float travel = max(dist - uHazeStart, 0.0);
  if (travel <= 0.0) return color;

  // The layer that is everywhere: plain Beer-Lambert in distance.
  float optical = uHazeDensity * travel;

  // The mist on the floor. Density is exp(-(y - base) / falloff), and the
  // integral of that along a straight segment has a closed form — which is the
  // whole reason the profile is an exponential and not something prettier.
  // Clamped because the exponentials below are evaluated on both ends of the
  // ray and a camera under the base height would otherwise overflow one.
  if (uHazeGround > 0.0) {
    float a = clamp((cameraPosition.y - uHazeBase) / uHazeFalloff, -4.0, 24.0);
    float b = clamp((worldPos.y - uHazeBase) / uHazeFalloff, -4.0, 24.0);
    float da = a - b;
    // As the two ends converge the quotient goes 0/0; the midpoint value is its
    // limit, and switching over well before the cancellation bites keeps the
    // horizon from stitching itself with a seam of noise.
    float layer = abs(da) > 1e-3 ? (exp(-b) - exp(-a)) / da : exp(-0.5 * (a + b));
    optical += uHazeGround * travel * clamp(layer, 0.0, 8.0);
  }

  float amount = clamp(1.0 - exp(-optical), 0.0, 1.0) * uHazeMax;
  if (amount <= 0.0) return color;

  // Looking down the beam, the air is bright and the sun's own colour; across
  // it, the same air is flat and cool. One dot product, and it is most of the
  // difference between haze and a grey wash.
  vec3 view = -toEye / max(dist, 1e-4);
  float sun = clamp(dot(view, uHazeSunDir), 0.0, 1.0);
  vec3 haze = mix(uHazeColor, uHazeSunColor, pow(sun, uHazeSunPower) * uHazeInscatter);

  return mix(color, haze, amount);
}

#endif
`;
