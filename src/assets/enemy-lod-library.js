import { loadGlb } from './load-glb.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const defaultBaseUrl = new URL('../../assets/models/enemy-lods/', import.meta.url);
const definitions = {
  orcPeon: { file: 'orcPeon.glb', sourceHeight: 0.8419968676945803, height: 2.5 },
  zombie: { file: 'zombie.glb', sourceHeight: 0.8998414929978074, height: 2.55 },
  brute: { file: 'brute.glb', sourceHeight: 0.983186649826362, height: 3.3 },
  lich: { file: 'lich.glb', sourceHeight: 0.9914485824883439, height: 2.8 },
};

/** Static geometry only: no bones, AnimationMixer, or per-actor Object3D clone. */
export async function loadEnemyLodLibrary({ THREE, baseUrl = defaultBaseUrl } = {}) {
  if (!THREE) throw new TypeError('loadEnemyLodLibrary requires THREE');
  const entries = new Map();
  const ownedMaterials = new Set(), ownedTextures = new Set();
  let disposed = false;
  for (const [id, definition] of Object.entries(definitions)) {
    const gltf = await loadGlb(new URL(definition.file, baseUrl).href);
    if (gltf.animations.length) throw new Error(`${id}: static LOD unexpectedly contains animations`);
    const parts = [], materials = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object => {
      if (object.isBone || object.isSkinnedMesh) throw new Error(`${id}: static LOD unexpectedly contains a skeleton`);
      if (!object.isMesh) return;
      if (Array.isArray(object.material)) throw new Error(`${id}: expected one material per GLTF primitive`);
      const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
      for (const attribute of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) geometry.deleteAttribute(attribute);
      const flattened = geometry.index ? geometry.toNonIndexed() : geometry;
      flattened.clearGroups();
      parts.push(flattened); materials.push(object.material); ownedMaterials.add(object.material);
      for (const value of Object.values(object.material)) if (value?.isTexture) ownedTextures.add(value);
      if (flattened !== geometry) geometry.dispose();
      object.geometry.dispose();
    });
    const geometry = mergeGeometries(parts, true);
    for (const part of parts) part.dispose();
    if (!geometry) throw new Error(`${id}: incompatible static primitives`);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const bounds = geometry.boundingBox, size = bounds.getSize(new THREE.Vector3());
    if (Math.abs(size.y - 1) > .002 || Math.abs(bounds.min.y) > .002) throw new Error(`${id}: LOD must be one unit tall and grounded at y=0`);
    const material = materials.length === 1 ? materials[0] : materials;
    entries.set(id, {
      geometry, material, materials,
      height: 1, sourceHeight: definition.sourceHeight, recommendedHeight: definition.height, forward: new THREE.Vector3(0, 0, -1),
      stats: { id, triangles: geometry.getAttribute('position').count / 3, vertices: geometry.getAttribute('position').count, materialGroups: materials.length, height: size.y, minY: bounds.min.y, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } },
    });
  }
  return {
    ids: [...entries.keys()],
    get(id) {
      if (disposed) throw new Error('Enemy LOD library has been disposed');
      const entry = entries.get(id);
      if (!entry) throw new RangeError(`Unknown enemy LOD: ${id}`);
      return entry;
    },
    createInstancedMesh(id, capacity) {
      const entry = this.get(id);
      const mesh = new THREE.InstancedMesh(entry.geometry, entry.material, capacity);
      mesh.name = `EnemyLOD:${id}`; mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = false; mesh.receiveShadow = false;
      // Horde transforms move every frame; a cached instance sphere goes stale.
      mesh.frustumCulled = false;
      return mesh;
    },
    getStats() { return { loaded: !disposed, skeletons: 0, mixers: 0, entries: [...entries.values()].map(entry => entry.stats) }; },
    // Caller owns/detaches/disposes its InstancedMeshes before disposing the library.
    dispose() {
      if (disposed) return; disposed = true;
      for (const entry of entries.values()) entry.geometry.dispose();
      for (const material of ownedMaterials) material.dispose();
      for (const texture of ownedTextures) texture.dispose();
      entries.clear(); ownedMaterials.clear(); ownedTextures.clear();
    },
  };
}
