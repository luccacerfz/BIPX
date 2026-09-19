import { thermalGLSL, noiseGLSL } from './shaders.js';

/**
 * Small-volume weapon fire, adapted from Samurai's VolumetricFireMaterial.
 * MIT copyright (c) 2026 mohamedachrefelouafi, see SAMURAI-LICENSE.txt.
 * BIPX's blade is a box: its exact analytic SDF replaces the source's baked
 * triangle distance texture. This is a raymarched volume, not a flame sprite.
 */
export function createWeaponFireVolume(THREE, blade) {
  blade.geometry.computeBoundingBox();
  const bounds = blade.geometry.boundingBox;
  const center = bounds.getCenter(new THREE.Vector3());
  const half = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const margin = 0.23;
  const hull = half.clone().addScalar(margin);
  const geometry = new THREE.BoxGeometry(hull.x * 2, hull.y * 2, hull.z * 2);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.FrontSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uTime: { value: 0 }, uHalf: { value: half }, uHull: { value: hull },
      uEye: { value: new THREE.Vector3() }, uFlow: { value: new THREE.Vector3(0, 1, 0) },
      uSteps: { value: 24 }, uIntensity: { value: 0.55 },
      uClipFromLocal: { value: new THREE.Matrix4() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uSteps;
      uniform float uIntensity;
      uniform vec3 uHalf;
      uniform vec3 uHull;
      uniform vec3 uEye;
      uniform vec3 uFlow;
      uniform mat4 uClipFromLocal;
      varying vec3 vLocal;
      ${noiseGLSL}
      ${thermalGLSL}
      float steelDistance(vec3 p) {
        vec3 q = abs(p) - uHalf;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
      }
      void main() {
        vec3 direction = normalize(vLocal - uEye);
        vec3 safeDir = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), direction)) * max(abs(direction), vec3(0.00001));
        vec3 ta = (-uHull - uEye) / safeDir;
        vec3 tb = (uHull - uEye) / safeDir;
        vec3 nearBounds = min(ta, tb), farBounds = max(ta, tb);
        float enter = max(max(nearBounds.x, nearBounds.y), nearBounds.z);
        float leave = min(min(farBounds.x, farBounds.y), farBounds.z);
        enter = max(enter, 0.0);
        if (leave <= enter) discard;
        float stride = (leave - enter) / uSteps;
        float t = enter + stride * 0.5;
        float transmittance = 1.0;
        float front = leave;
        vec3 light = vec3(0.0);
        for (int i = 0; i < 28; i++) {
          if (float(i) >= uSteps || transmittance < 0.015) break;
          vec3 p = uEye + direction * t;
          float steel = steelDistance(p);
          // Gas just above the steel samples back against its buoyant flow.
          float plume = steelDistance(p - uFlow * 0.1);
          float distanceToFire = min(steel, plume + 0.035);
          vec3 drift = p * 12.0 - uFlow * uTime * 2.7;
          float turbulence = noise2(drift.xy + drift.z * 0.41);
          turbulence += noise2(drift.yz * 1.83 + 8.4) * 0.35;
          float width = 0.065 + turbulence * 0.075;
          float density = (1.0 - smoothstep(0.0, width, distanceToFire)) * step(0.0, steel);
          float heat = 1.0 - clamp(distanceToFire / max(width, 0.001), 0.0, 1.0);
          float temperature = mix(1350.0, 3100.0, heat);
          float absorption = 1.0 - exp(-density * stride * 15.0);
          if (absorption > 0.015 && front == leave) front = t;
          light += blackbody(temperature) * pow(temperature / 2200.0, 3.4) * absorption * transmittance * uIntensity;
          transmittance *= 1.0 - absorption;
          t += stride;
        }
        float alpha = 1.0 - transmittance;
        if (alpha < 0.006) discard;
        // Test the flame's visible front against the body, not its empty hull.
        vec4 frontClip = uClipFromLocal * vec4(uEye + direction * front, 1.0);
        gl_FragDepth = clamp(frontClip.z / frontClip.w * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(light, alpha * 0.8);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const volume = new THREE.Mesh(geometry, material);
  volume.name = 'VFX_VolumetricBladeFire';
  volume.position.copy(center);
  volume.frustumCulled = false;
  volume.renderOrder = 5;
  volume.raycast = () => {};
  volume.userData.isFireVolume = true;
  const inverse = new THREE.Matrix4(), worldUp = new THREE.Vector3(0, 1, 0);
  const worldPosition = new THREE.Vector3(), previousPosition = new THREE.Vector3();
  const flow = new THREE.Vector3();
  let first = true, visible = true, disposed = false;
  blade.add(volume);
  volume.onBeforeRender = (_renderer, _scene, camera) => {
    inverse.copy(volume.matrixWorld).invert();
    material.uniforms.uEye.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
    material.uniforms.uClipFromLocal.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(volume.matrixWorld);
    const eye = material.uniforms.uEye.value;
    const inside = Math.abs(eye.x) < hull.x && Math.abs(eye.y) < hull.y && Math.abs(eye.z) < hull.z;
    const side = inside ? THREE.BackSide : THREE.FrontSide;
    if (material.side !== side) { material.side = side; material.needsUpdate = true; }
  };
  return {
    update(time, dt, quality, reducedMotion, intensity) {
      if (disposed) return;
      visible = quality !== 'low' && !reducedMotion && blade.visible;
      volume.visible = visible;
      if (!visible) { first = true; return; }
      volume.updateWorldMatrix(true, false);
      worldPosition.setFromMatrixPosition(volume.matrixWorld);
      flow.copy(worldUp).multiplyScalar(1.3);
      if (!first && dt > 0) {
        // A moving blade pulls the plume behind itself instead of carrying a
        // rigid orange sleeve through the scene.
        flow.addScaledVector(previousPosition.sub(worldPosition), 0.06 / dt);
      }
      first = false;
      previousPosition.copy(worldPosition);
      inverse.copy(volume.matrixWorld).invert();
      material.uniforms.uFlow.value.copy(flow).normalize().transformDirection(inverse);
      material.uniforms.uTime.value = time;
      material.uniforms.uSteps.value = quality === 'high' ? 28 : 16;
      material.uniforms.uIntensity.value = intensity;
    },
    get visible() { return visible && !disposed; },
    dispose() {
      if (disposed) return;
      volume.removeFromParent(); geometry.dispose(); material.dispose(); disposed = true;
    },
  };
}
