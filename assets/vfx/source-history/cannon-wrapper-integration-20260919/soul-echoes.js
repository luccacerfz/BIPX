/**
 * Two pooled visual echoes of BIPX's current rigid or skinned avatar. Inspired by Samurai
 * ShadowCharacter's shared silhouette, emergence and dissolving exit (MIT).
 * These are presentation only: target selection and damage remain in main.js.
 */
export function createSoulEchoes(THREE, parent) {
  let source = null, disposed = false;
  const inverse = new THREE.Matrix4(), transform = new THREE.Matrix4(), normalTransform = new THREE.Matrix3();
  const frame = new THREE.Matrix4(), bindInverse = new THREE.Matrix4(), skin = new THREE.Matrix4();
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), morph = new THREE.Vector3();
  const basePosition = new THREE.Vector3(), baseNormal = new THREE.Vector3();
  const worldPosition = new THREE.Vector3(), worldScale = new THREE.Vector3(), unitScale = new THREE.Vector3(1, 1, 1);
  const worldRotation = new THREE.Quaternion(), weights = new THREE.Vector4(), joints = new THREE.Vector4();
  const entries = [];
  const slots = [];
  const stats = { sourceMeshes: 0, skinnedMeshes: 0, vertices: 0, triangles: 0, captures: 0, lastCaptureMs: 0 };
  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vLocal;
    void main() {
      vLocal = position;
      vec4 view = modelViewMatrix * vec4(position, 1.0);
      vView = -view.xyz; vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * view;
    }
  `;
  const fragmentShader = /* glsl */ `
    uniform float uAge;
    uniform vec3 uColor;
    varying vec3 vNormal;
    varying vec3 vView;
    varying vec3 vLocal;
    float hash(vec3 p) {
      p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    void main() {
      float opening = smoothstep(0.0, 0.23, uAge);
      float closing = smoothstep(0.65, 1.0, uAge);
      float grain = hash(floor(vLocal * 32.0));
      if (grain < closing || vLocal.y > opening * 3.7) discard;
      float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
      float edge = (1.0 - smoothstep(0.0, 0.07, abs(grain - closing))) * step(0.01, closing);
      float alpha = (0.16 + rim * 0.56 + edge * 0.3) * opening * (1.0 - closing);
      gl_FragColor = vec4(uColor * (0.26 + rim * 1.6 + edge), alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  function clearSource() {
    for (const slot of slots) {
      slot.mesh.removeFromParent(); slot.mesh.material.dispose(); slot.mesh.geometry.dispose();
    }
    slots.length = 0; entries.length = 0;
    stats.sourceMeshes = 0; stats.skinnedMeshes = 0; stats.vertices = 0; stats.triangles = 0;
  }

  function setSource(object) {
    if (disposed || object === source) return;
    clearSource(); source = object;
    if (!object) return;
    let vertexCount = 0;
    const mergedIndices = [];
    object.traverse(node => {
      if (!node.isMesh || node.userData.isFireVolume || !node.geometry?.attributes?.position) return;
      const position = node.geometry.attributes.position, index = node.geometry.index;
      const count = index ? index.count : position.count;
      const start = Math.max(0, node.geometry.drawRange.start);
      const end = Math.min(count, start + node.geometry.drawRange.count);
      // Retain unique vertices, so skinning cost follows vertex count rather
      // than triangle corners. Geometry is owned separately by each echo.
      for (let i = start; i + 2 < end; i += 3) for (let corner = 0; corner < 3; corner++)
        mergedIndices.push(vertexCount + (index ? index.getX(i + corner) : i + corner));
      entries.push({ node, offset: vertexCount,
        bones: node.isSkinnedMesh ? node.skeleton.bones.map(() => new THREE.Matrix4()) : null });
      vertexCount += position.count;
      stats.sourceMeshes++; if (node.isSkinnedMesh) stats.skinnedMeshes++;
    });
    if (!vertexCount || !mergedIndices.length) return;
    stats.vertices = vertexCount; stats.triangles = mergedIndices.length / 3;
    for (let i = 0; i < 2; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setIndex(mergedIndices);
      const material = new THREE.ShaderMaterial({
        uniforms: { uAge: { value: 0 }, uColor: { value: new THREE.Color(0x9fbadc) } },
        vertexShader, fragmentShader, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.name = `VFX_SoulEcho${i}`;
      mesh.raycast = () => {}; mesh.renderOrder = 2; parent.add(mesh);
      slots.push({ mesh, life: 0, age: 0, x: 0, z: 0, dx: 0, dz: 0 });
    }
  }

  function capture(slot) {
    const started = performance.now();
    // Matrix caches may be refreshed; no local bone transforms, bone inverse
    // matrices, skeleton palette, animation state or source geometry is edited.
    source.updateWorldMatrix(true, true);
    source.matrixWorld.decompose(worldPosition, worldRotation, worldScale);
    // Remove translation/heading but retain world scale in the baked vertices.
    // Aldric's root converts imported units to a 2.4 m actor.
    inverse.copy(frame.compose(worldPosition, worldRotation, unitScale)).invert();
    const geometry = slot.mesh.geometry;
    const positions = geometry.attributes.position, normals = geometry.attributes.normal;
    for (const entry of entries) {
      const node = entry.node, attributes = node.geometry.attributes;
      transform.multiplyMatrices(inverse, node.matrixWorld); normalTransform.getNormalMatrix(transform);
      if (entry.bones) {
        // Match Three r164's attached/detached bind contract without changing
        // the live SkinnedMesh.bindMatrixInverse or Skeleton.boneMatrices.
        bindInverse.copy(node.bindMode === THREE.DetachedBindMode ? node.bindMatrix : node.matrixWorld).invert();
        for (let i = 0; i < entry.bones.length; i++) {
          node.skeleton.bones[i].updateWorldMatrix(true, false);
          entry.bones[i].multiplyMatrices(bindInverse, node.skeleton.bones[i].matrixWorld)
            .multiply(node.skeleton.boneInverses[i]).multiply(node.bindMatrix);
        }
      }
      let visible = true;
      for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
        if (!ancestor.visible) { visible = false; break; }
        if (ancestor === source) break;
      }
      const morphPositions = node.geometry.morphAttributes.position;
      const morphNormals = node.geometry.morphAttributes.normal;
      const influences = node.morphTargetInfluences;
      const relative = node.geometry.morphTargetsRelative;
      for (let i = 0; i < attributes.position.count; i++) {
        const outputIndex = entry.offset + i;
        if (!visible) { positions.setXYZ(outputIndex, 0, 0, 0); normals.setXYZ(outputIndex, 0, 1, 0); continue; }
        point.fromBufferAttribute(attributes.position, i); basePosition.copy(point);
        if (attributes.normal) normal.fromBufferAttribute(attributes.normal, i);
        else normal.set(0, 1, 0);
        baseNormal.copy(normal);
        if (influences) for (let j = 0; j < influences.length; j++) {
          const weight = influences[j];
          if (!weight) continue;
          if (morphPositions?.[j]) {
            morph.fromBufferAttribute(morphPositions[j], i);
            if (!relative) morph.sub(basePosition);
            point.addScaledVector(morph, weight);
          }
          if (morphNormals?.[j]) {
            morph.fromBufferAttribute(morphNormals[j], i);
            if (!relative) morph.sub(baseNormal);
            normal.addScaledVector(morph, weight);
          }
        }
        if (entry.bones && attributes.skinIndex && attributes.skinWeight) {
          joints.fromBufferAttribute(attributes.skinIndex, i); weights.fromBufferAttribute(attributes.skinWeight, i);
          const elements = skin.elements;
          elements.fill(0);
          for (let influence = 0; influence < 4; influence++) {
            const weight = weights.getComponent(influence);
            if (!weight) continue;
            const bone = entry.bones[joints.getComponent(influence)];
            if (!bone) continue;
            for (let component = 0; component < 16; component++) elements[component] += bone.elements[component] * weight;
          }
          point.applyMatrix4(skin);
          // skinnormal_vertex multiplies the blended skin matrix with w=0,
          // then normalMatrix. Translation must never affect a normal.
          const x = normal.x, y = normal.y, z = normal.z;
          normal.set(elements[0] * x + elements[4] * y + elements[8] * z,
            elements[1] * x + elements[5] * y + elements[9] * z,
            elements[2] * x + elements[6] * y + elements[10] * z);
        }
        point.applyMatrix4(transform); normal.applyMatrix3(normalTransform).normalize();
        positions.setXYZ(outputIndex, point.x, point.y, point.z);
        normals.setXYZ(outputIndex, normal.x, normal.y, normal.z);
      }
    }
    positions.needsUpdate = true; normals.needsUpdate = true;
    geometry.computeBoundingSphere();
    slot.mesh.quaternion.copy(worldRotation);
    stats.captures++; stats.lastCaptureMs = performance.now() - started;
  }

  function summon(position, options = {}, quality = 'high', reducedMotion = false) {
    if (disposed || !slots.length || !position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return false;
    const allowed = quality === 'low' ? 1 : 2;
    let slot = slots.slice(0, allowed).find(item => !item.mesh.visible);
    if (!slot) slot = slots[0];
    capture(slot);
    slot.life = Math.min(1.5, Math.max(0.3, options.duration ?? 0.85)); slot.age = 0;
    slot.x = position.x; slot.z = position.z;
    const direction = options.direction ?? { x: 0, z: -1 };
    const length = Math.hypot(direction.x, direction.z) || 1;
    slot.dx = direction.x / length * (reducedMotion ? 0.15 : 2.1);
    slot.dz = direction.z / length * (reducedMotion ? 0.15 : 2.1);
    slot.mesh.position.set(position.x, position.y ?? 0, position.z);
    slot.mesh.material.uniforms.uColor.value.set(options.color ?? 0x98b8e1);
    slot.mesh.material.uniforms.uAge.value = 0;
    slot.mesh.visible = true;
    return true;
  }

  return {
    setSource, summon,
    update(dt, quality = 'high') {
      for (let index = 0; index < slots.length; index++) {
        const slot = slots[index];
        if (quality === 'low' && index > 0) { slot.mesh.visible = false; continue; }
        if (!slot.mesh.visible) continue;
        slot.age += dt;
        const t = Math.min(1, slot.age / slot.life);
        slot.mesh.material.uniforms.uAge.value = t;
        const emerge = 1 - Math.pow(1 - Math.min(1, t * 1.8), 3);
        slot.mesh.position.x = slot.x + slot.dx * emerge;
        slot.mesh.position.z = slot.z + slot.dz * emerge;
        if (t >= 1) slot.mesh.visible = false;
      }
    },
    reset() { for (const slot of slots) slot.mesh.visible = false; },
    get count() { return slots.filter(slot => slot.mesh.visible).length; },
    get stats() { return { ...stats }; },
    dispose() { if (!disposed) { clearSource(); source = null; disposed = true; } },
  };
}
