/**
 * Leaf litter, airborne drift and near-body scatter adapted to a flat arena
 * from Samurai's LeafLitter/LeafDrift (MIT, see SAMURAI-LICENSE.txt).
 * Procedural leaf silhouettes replace the reference texture assets.
 */
export function createLeafAtmosphere(THREE, parent) {
  const capacity = 520;
  const origins = new Float32Array(capacity * 3);
  const seeds = new Float32Array(capacity);
  let randomState = 4619;
  function random() {
    randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  }
  for (let i = 0; i < capacity; i++) {
    origins[i * 3] = (random() - 0.5) * 90;
    origins[i * 3 + 1] = i < 80 ? 0.7 + random() * 4.3 : 0.026;
    origins[i * 3 + 2] = (random() - 0.5) * 90;
    seeds[i] = random() * 100;
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origins, 3));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uBody: { value: new THREE.Vector3() },
      uVelocity: { value: new THREE.Vector3() }, uMotion: { value: 1 },
    },
    side: THREE.DoubleSide, transparent: false, depthWrite: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBody;
      uniform vec3 uVelocity;
      uniform float uMotion;
      attribute vec3 aOrigin;
      attribute float aSeed;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vUv = position.xy;
        bool airborne = aOrigin.y > 0.5;
        float time = uTime * uMotion;
        vec3 center = aOrigin;
        float angle = aSeed * 2.0;
        float pitch = 1.53;
        if (airborne) {
          center.x = mod(aOrigin.x + 45.0 + time * 0.4, 90.0) - 45.0;
          center.z += sin(time * 0.2 + aSeed) * 1.5;
          center.y += sin(time * 0.55 + aSeed) * 0.6;
          angle += time * 0.32;
          pitch = sin(time * 0.6 + aSeed) * 1.2;
        } else {
          vec2 offset = center.xz - uBody.xz;
          float nearBody = 1.0 - smoothstep(0.1, 2.0, length(offset));
          float speed = min(length(uVelocity.xz), 7.0);
          float scatter = nearBody * speed * 0.16 * uMotion;
          center.xz += normalize(offset + vec2(0.001)) * scatter;
          center.y += scatter * (0.2 + abs(sin(time * 2.4 + aSeed)) * 0.65);
          angle += scatter * sin(aSeed);
          pitch += scatter;
        }
        float size = 0.085 + fract(aSeed) * 0.11;
        vec2 leaf = position.xy * vec2(size * 0.48, size);
        vec3 p = vec3(leaf.x, leaf.y * cos(pitch), leaf.y * sin(pitch));
        p.xz = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p.xz;
        vec3 world = center + p;
        float variant = fract(aSeed * 13.37);
        vColor = mix(vec3(0.12, 0.19, 0.16), vec3(0.34, 0.19, 0.075), variant);
        vColor *= airborne ? 1.4 : 0.8;
        vec4 view = modelViewMatrix * vec4(world, 1.0);
        vFade = 1.0 - smoothstep(35.0, 75.0, -view.z);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        float width = pow(max(0.0, 1.0 - vUv.y * vUv.y), 0.7);
        width *= 0.88 + 0.12 * sin(vUv.y * 24.0);
        if (abs(vUv.x) > width || vFade < 0.05) discard;
        float vein = exp(-abs(vUv.x) * 30.0) * 0.18;
        float ribs = pow(abs(cos((vUv.y - abs(vUv.x) * 0.55) * 23.0)), 12.0) * 0.1;
        vec3 color = vColor * (0.78 + vUv.x * 0.2 + vein + ribs) * vFade;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'VFX_LeafLitterAndDrift';
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  parent.add(mesh);
  const previous = new THREE.Vector3();
  let initialized = false, enabled = true, disposed = false;
  return {
    update(time, dt, position, quality, reducedMotion) {
      if (disposed) return;
      geometry.instanceCount = quality === 'low' ? 160 : quality === 'medium' ? 320 : 520;
      material.uniforms.uTime.value = time;
      material.uniforms.uMotion.value = reducedMotion ? 0 : 1;
      mesh.visible = enabled;
      if (position) {
        material.uniforms.uBody.value.copy(position);
        if (initialized && dt > 0) material.uniforms.uVelocity.value.subVectors(position, previous).divideScalar(dt);
        else material.uniforms.uVelocity.value.set(0, 0, 0);
        previous.copy(position); initialized = true;
      }
    },
    setEnabled(value) { enabled = Boolean(value); mesh.visible = enabled; },
    reset() { initialized = false; },
    get visible() { return mesh.visible && !disposed; },
    get count() { return mesh.visible && !disposed ? geometry.instanceCount : 0; },
    dispose() { if (!disposed) { mesh.removeFromParent(); geometry.dispose(); material.dispose(); disposed = true; } },
  };
}
