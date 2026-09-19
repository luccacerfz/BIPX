/** Instanced aim/lock diamonds adapted from Samurai TargetMarkers (MIT). */
export function createTargetMarkers(THREE, parent) {
  const capacity = 16;
  const origins = new Float32Array(capacity * 3), states = new Float32Array(capacity * 2);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const originAttribute = new THREE.InstancedBufferAttribute(origins, 3).setUsage(THREE.DynamicDrawUsage);
  const stateAttribute = new THREE.InstancedBufferAttribute(states, 2).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aOrigin', originAttribute); geometry.setAttribute('aState', stateAttribute);
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 }, uGround: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uMotion;
      uniform float uGround;
      attribute vec3 aOrigin;
      attribute vec2 aState;
      varying vec2 vUv;
      varying vec2 vState;
      void main() {
        vUv = position.xy; vState = aState;
        vec4 center;
        if (uGround > 0.5) {
          vec3 world = vec3(aOrigin.x, 0.055, aOrigin.z) + vec3(position.x, 0.0, position.y) * (0.78 + aState.y * 0.1);
          center = modelViewMatrix * vec4(world, 1.0);
        } else {
          center = modelViewMatrix * vec4(aOrigin + vec3(0.0, 2.9, 0.0), 1.0);
          float size = 0.19 * (1.0 + aState.y * 0.17);
          center.xy += position.xy * size;
          center.y += sin(uTime * 2.4) * 0.04 * uMotion;
        }
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec2 vState;
      uniform float uGround;
      void main() {
        float diamond = abs(vUv.x) + abs(vUv.y);
        float rim = 1.0 - smoothstep(0.075, 0.13, abs(diamond - 0.8));
        float fill = (1.0 - smoothstep(0.15, 0.6, diamond)) * vState.y;
        float alpha = (rim + fill * 0.6) * vState.x;
        if (uGround > 0.5) {
          float r = length(vUv);
          float ring = 1.0 - smoothstep(0.01, 0.03, abs(r - 0.83));
          float turn = atan(vUv.y, vUv.x) / 6.2831853;
          float segments = step(0.16, fract(turn * 8.0));
          alpha = ring * segments * vState.x * 0.5;
        }
        if (alpha < 0.003) discard;
        vec3 color = mix(vec3(0.42, 0.7, 0.76), vec3(1.0, 0.66, 0.32), vState.y);
        gl_FragColor = vec4(color * 1.4, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'VFX_TargetLockDiamonds'; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 8;
  mesh.raycast = () => {};
  parent.add(mesh);
  const ringMaterial = material.clone();
  ringMaterial.uniforms.uGround.value = 1;
  ringMaterial.depthTest = true;
  const ringMesh = new THREE.Mesh(geometry, ringMaterial);
  ringMesh.name = 'VFX_TargetGroundRings'; ringMesh.frustumCulled = false;
  ringMesh.visible = false; ringMesh.renderOrder = 3; ringMesh.raycast = () => {};
  parent.add(ringMesh);
  const slots = Array.from({ length: capacity }, () => ({ id: null, target: null, fade: 0, lock: 0 }));
  let disposed = false;
  return {
    setTargets(targets = []) {
      if (disposed) return;
      for (const slot of slots) slot.target = null;
      for (let i = 0; i < Math.min(targets.length, capacity); i++) {
        const target = targets[i];
        if (!target?.position || !Number.isFinite(target.position.x) || !Number.isFinite(target.position.z)) continue;
        const id = target.id ?? i;
        const slot = slots.find(item => item.id === id) ?? slots.find(item => !item.target && item.fade < 0.01) ?? slots.find(item => !item.target);
        if (slot) { slot.id = id; slot.target = target; }
      }
    },
    update(time, dt, reducedMotion) {
      if (disposed) return;
      let count = 0;
      const blend = 1 - Math.exp(-dt * 16);
      for (const slot of slots) {
        slot.fade += ((slot.target ? 1 : 0) - slot.fade) * blend;
        slot.lock += ((slot.target?.locked ? 1 : 0) - slot.lock) * blend;
        if (slot.target) {
          slot.x = slot.target.position.x; slot.y = slot.target.position.y ?? 0; slot.z = slot.target.position.z;
        }
        if (slot.fade < 0.01) continue;
        origins[count * 3] = slot.x; origins[count * 3 + 1] = slot.y; origins[count * 3 + 2] = slot.z;
        states[count * 2] = slot.fade; states[count * 2 + 1] = slot.lock;
        count++;
      }
      originAttribute.needsUpdate = true; stateAttribute.needsUpdate = true;
      geometry.instanceCount = count; mesh.visible = count > 0;
      ringMesh.visible = count > 0;
      material.uniforms.uTime.value = time; material.uniforms.uMotion.value = reducedMotion ? 0 : 1;
      ringMaterial.uniforms.uTime.value = time; ringMaterial.uniforms.uMotion.value = reducedMotion ? 0 : 1;
    },
    reset() { for (const slot of slots) { slot.target = null; slot.id = null; slot.fade = 0; slot.lock = 0; } geometry.instanceCount = 0; mesh.visible = false; ringMesh.visible = false; },
    get count() { return disposed ? 0 : geometry.instanceCount; },
    dispose() { if (!disposed) { mesh.removeFromParent(); ringMesh.removeFromParent(); geometry.dispose(); material.dispose(); ringMaterial.dispose(); disposed = true; } },
  };
}
