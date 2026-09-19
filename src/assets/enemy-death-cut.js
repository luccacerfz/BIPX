import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';
import { prepareDeathCut } from './death-cut-preparation.js';

// Geometry is the stable ownership boundary. Mesh UUIDs are per-instance and
// must never defeat reuse of immutable topology across shared asset instances.
const topologyCache = new WeakMap();
const compactHash = text => { let hash = 1469598103934665603n; for (let i = 0; i < text.length; i++) { hash ^= BigInt(text.charCodeAt(i)); hash = BigInt.asUintN(64, hash * 1099511628211n); } return hash.toString(16); };

// Convex support in the tipping plane: exact minima for all sampled vertices,
// with O(hull) work per frame instead of re-skinning thousands of vertices.
function supportHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = [];
  for (const point of sorted) {
    const previous = unique.at(-1);
    if (!previous || Math.abs(point.x - previous.x) > 1e-6 || Math.abs(point.y - previous.y) > 1e-6) unique.push(point);
  }
  const cross = (a, b, c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half = values => {
    const hull = [];
    for (const p of values) {
      while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), p) <= 0) hull.pop();
      hull.push(p);
    }
    return hull;
  };
  if (unique.length < 3) return unique;
  return [...half(unique).slice(0,-1), ...half([...unique].reverse()).slice(0,-1)];
}

// Split triangle ownership at the shoulder using the real skin weights. Arms,
// hands and held props stay whole with the torso even below the waist plane.
function getTopology(mesh, source) {
  const geometry = mesh.geometry;
  let variants = topologyCache.get(geometry);
  if (!variants) { variants = new Map(); topologyCache.set(geometry, variants); }
  const armName = /arm|hand|shoulder|clavicle|finger|thumb|index|pinky/i;
  let held = false;
  for (let at = mesh.parent; at && at !== source.parent; at = at.parent)
    if (at.isBone && armName.test(at.name)) held = true;
  const skeleton = mesh.isSkinnedMesh ? mesh.skeleton : null;
  const skeletonKey = skeleton ? skeleton.bones.map((bone, index) => `${index}:${bone.name}:${skeleton.boneInverses[index]?.elements.join(',')}`).join(';') : 'static';
  // bindMatrixInverse is updated from matrixWorld for AttachedBindMode rigs;
  // it is pose/instance state and must travel in the private death payload,
  // never invalidate the immutable geometry/topology registration.
  const bindKey = mesh.isSkinnedMesh ? mesh.bindMatrix.elements.join(',') : 'static';
  const groupsKey = geometry.groups.map(group => `${group.start}:${group.count}:${group.materialIndex}`).join(';');
  const signature = `${geometry.uuid}:${compactHash(`${geometry.index?.uuid || 'nonindexed'}|${groupsKey}|${skeletonKey}|${bindKey}|held:${held}`)}`;
  let topology = variants.get(signature);
  if (topology) return topology;
  const skin = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
  const influence = held ? null : new Float32Array(geometry.attributes.position.count);
  if (influence && mesh.isSkinnedMesh && skin && weights) {
    const armBones = new Set(mesh.skeleton.bones.map((bone, index) => armName.test(bone.name || '') ? index : -1));
    for (let i = 0; i < influence.length; i++) for (let c = 0; c < 4; c++)
      if (armBones.has(skin.getComponent(i, c))) influence[i] += weights.getComponent(i, c);
  }
  const index = geometry.index, count = index ? index.count : geometry.attributes.position.count;
  const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
  const faceIndices = new Uint32Array(Math.floor(count / 3) * 3), materialIndex = new Uint16Array(Math.floor(count / 3));
  let faceAt = 0;
  for (const group of groups) for (let i = group.start; i + 2 < Math.min(count, group.start + group.count); i += 3) {
    faceIndices[faceAt * 3] = index ? index.getX(i) : i;
    faceIndices[faceAt * 3 + 1] = index ? index.getX(i + 1) : i + 1;
    faceIndices[faceAt * 3 + 2] = index ? index.getX(i + 2) : i + 2;
    materialIndex[faceAt++] = group.materialIndex;
  }
  const positions = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    positions[i * 3] = geometry.attributes.position.getX(i);
    positions[i * 3 + 1] = geometry.attributes.position.getY(i);
    positions[i * 3 + 2] = geometry.attributes.position.getZ(i);
  }
  const skinIndices = skin ? new Uint16Array(geometry.attributes.position.count * 4) : null;
  const skinWeights = weights ? new Float32Array(geometry.attributes.position.count * 4) : null;
  if (skinIndices && skinWeights) for (let i = 0; i < geometry.attributes.position.count; i++) for (let c = 0; c < 4; c++) {
    skinIndices[i * 4 + c] = skin.getComponent(i, c);
    skinWeights[i * 4 + c] = weights.getComponent(i, c);
  }
  topology = { key: signature, groups, index, count, held, influence, faceIndices, materialIndex,
    positions, skinIndices, skinWeights,
    bindMatrix: mesh.isSkinnedMesh ? Float32Array.from(mesh.bindMatrix.elements) : null,
    skinned: Boolean(mesh.isSkinnedMesh && skeleton) };
  variants.set(signature, topology);
  return topology;
}

function torsoRegions(THREE, source, cutY, poseCache) {
  const regions = new Map();
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry, topology = getTopology(mesh, source);
    const pose = poseCache.get(mesh.uuid);
    const { faces, held, influence } = topology;
    const vertices = pose.vertices;
    for (const face of faces) face.carry = false;
    // Decide per connected patch below the waist, not per triangle: a varying
    // skin-weight threshold must not tear a partial contour through a bulky arm.
    const parents = faces.map((_,i) => i), shared = new Map();
    const find = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    faces.forEach((face,i) => {
      for (const v of face.indices) {
        const p = vertices[v]; if (p.y >= cutY) continue;
        const key = `${Math.round(p.x*100000)},${Math.round(p.y*100000)},${Math.round(p.z*100000)}`;
        if (shared.has(key)) parents[find(i)] = find(shared.get(key)); else shared.set(key,i);
      }
    });
    const weightsByPatch = new Map();
    faces.forEach((face,i) => {
      const id = find(i), total = weightsByPatch.get(id) || {weight:0,count:0};
      for (const v of face.indices) if (vertices[v].y < cutY) { total.weight += held ? 1 : (influence?.[v] || 0); total.count++; }
      weightsByPatch.set(id,total);
    });
    faces.forEach((face,i) => { const total = weightsByPatch.get(find(i)); face.carry = total.count > 0 && total.weight/total.count > .35; });
    regions.set(mesh.uuid, faces);
  });
  return regions;
}

// Intersect only torso/leg triangles with the waist plane; carried arms stay whole.
// Quantized shared endpoints weld UV seams without changing the live mesh.
function cutSurface(THREE, source, cutY, center, axis, maxRepairGap, regions, poseCache) {
  const points = [[], []], nodes = new Map(), edges = new Map();
  const supportSeen = new WeakMap();
  const key = p => `${Math.round(p.x * 2000)},${Math.round(p.z * 2000)}`;
  const addPoint = (point, sign, mesh = null, index = -1) => {
    if (mesh && index >= 0) {
      let seen = supportSeen.get(mesh);
      if (!seen) { seen = new Uint8Array(mesh.geometry.attributes.position.count); supportSeen.set(mesh, seen); }
      const mask = sign > 0 ? 1 : 2;
      if (seen[index] & mask) return;
      seen[index] |= mask;
    }
    points[sign > 0 ? 0 : 1].push({ x: axis.z * (point.x-center.x) - axis.x * (point.z-center.z), y: point.y-center.y });
  };
  const addSegment = (a, b) => {
    const ka = key(a), kb = key(b);
    if (ka === kb) return;
    for (const [k, p] of [[ka,a],[kb,b]]) if (!nodes.has(k)) nodes.set(k, { point: p.clone(), edges: [] });
    const id = [ka,kb].sort().join('|');
    if (edges.has(id)) return;
    const edge = { a: ka, b: kb, used: false };
    edges.set(id, edge); nodes.get(ka).edges.push(edge); nodes.get(kb).edges.push(edge);
    for (const p of [a,b]) { addPoint(p, 1); addPoint(p, -1); }
  };
  source.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible) return;
    const vertices = poseCache.get(mesh.uuid).vertices;
    for (const face of regions.get(mesh.uuid)) {
      const triangle = face.indices.map(i => vertices[i]);
      for (let vertex = 0; vertex < 3; vertex++) {
        const p = triangle[vertex], index = face.indices[vertex];
        if (face.carry || p.y >= cutY - 1e-8) addPoint(p, 1, mesh, index);
        if (!face.carry && p.y <= cutY + 1e-8) addPoint(p, -1, mesh, index);
      }
      if (face.carry) continue;
      const hits = [];
      for (let e = 0; e < 3; e++) {
        const a = triangle[e], b = triangle[(e+1)%3], da = a.y-cutY, db = b.y-cutY;
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) hits.push(a.clone().lerp(b, da/(da-db)));
        else if (Math.abs(da) < 1e-8) hits.push(a.clone());
      }
      if (hits.length >= 2) addSegment(hits[0], hits[1]);
    }
  });
  const contours = [];
  let openContours = 0, repairedContours = 0, maximumRepairGap = 0;
  const openPaths = [];
  for (const first of edges.values()) {
    if (first.used) continue;
    const start = first.a, contour = [nodes.get(start).point];
    let at = start, edge = first, closed = false;
    while (edge && !edge.used) {
      edge.used = true;
      at = edge.a === at ? edge.b : edge.a;
      if (at === start) { closed = true; break; }
      contour.push(nodes.get(at).point);
      edge = nodes.get(at).edges.find(candidate => !candidate.used);
    }
    if (closed && contour.length >= 3) contours.push(contour);
    else {
      const gap = contour[0].distanceTo(contour.at(-1));
      // Supplied meshes contain small open/non-manifold seams. Close only a
      // bounded local gap in the cosmetic cap, never alter the original mesh.
      if (contour.length >= 3 && gap <= maxRepairGap) {
        contours.push(contour); repairedContours++; maximumRepairGap = Math.max(maximumRepairGap, gap);
      } else if (contour.length === 2 && gap <= .005) {
        // A dangling sub-5 mm seam has no polygonal area. A narrow dark ribbon
        // finishes that edge without claiming an anatomical/watertight remesh.
        const offset = contour[1].clone().sub(contour[0]);
        offset.set(-offset.z, 0, offset.x).normalize().multiplyScalar(.00075);
        contours.push([contour[0].clone().add(offset), contour[1].clone().add(offset),
          contour[1].clone().sub(offset), contour[0].clone().sub(offset)]);
        repairedContours++; maximumRepairGap = Math.max(maximumRepairGap, gap);
      } else {
        openContours++; openPaths.push({ points: contour.length, gap, from: contour[0].toArray(), to: contour.at(-1).toArray() });
      }
    }
  }
  const capVertices = [];
  for (const contour of contours) {
    const planar = contour.map(p => new THREE.Vector2(p.x-center.x, p.z-center.z));
    for (const triangle of THREE.ShapeUtils.triangulateShape(planar, [])) for (const index of triangle) {
      const p = planar[index]; capVertices.push(p.x, 0, p.y);
    }
  }
  for (let i = 0; i < capVertices.length; i += 3) for (const half of points)
    half.push({ x: axis.z*capVertices[i]-axis.x*capVertices[i+2], y: capVertices[i+1] });
  return { support: points.map(supportHull), capVertices, contours: contours.length, openContours, openPaths, repairedContours, maximumRepairGap };
}

// One authoritative world-space pose snapshot feeds bounds, ownership and cap
// construction. This avoids re-skinning every mesh once per phase while keeping
// the snapshot private to this death event/entity.
function buildPoseCache(THREE, source) {
  const cache = new Map(), bounds = new THREE.Box3();
  const meshes = [];
  let ordinal = 0;
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    const count = mesh.geometry.attributes.position.count, vertices = new Array(count);
    for (let i = 0; i < count; i++) {
      const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      vertices[i] = point; bounds.expandByPoint(point);
    }
    cache.set(mesh.uuid, { mesh, vertices });
    const topology = getTopology(mesh, source), serializedVertices = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { serializedVertices[i * 3] = vertices[i].x; serializedVertices[i * 3 + 1] = vertices[i].y; serializedVertices[i * 3 + 2] = vertices[i].z; }
    meshes.push({ key: `${ordinal++}:${topology.key}`, topologyKey: topology.key, worldSpace: true, vertices: serializedVertices,
      faceIndices: topology.faceIndices, materialIndex: topology.materialIndex,
      positions: topology.positions, skinIndices: topology.skinIndices, skinWeights: topology.skinWeights,
      bindMatrix: topology.bindMatrix, bindMatrixInverse: topology.bindMatrixInverse, held: topology.held, influence: topology.influence });
  });
  return { cache, bounds, meshes };
}

function buildWorkerPosePayload(THREE, source) {
  const meshes = [], topologies = new Map();
  let ordinal = 0;
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    const topology = getTopology(mesh, source);
    topologies.set(topology.key, topology);
    let boneMatrices = null;
    if (topology.skinned) {
      const matrices = new Float32Array(mesh.skeleton.bones.length * 16), boneMatrix = new THREE.Matrix4();
      mesh.skeleton.bones.forEach((bone, index) => {
        boneMatrix.multiplyMatrices(bone.matrixWorld, mesh.skeleton.boneInverses[index]);
        matrices.set(boneMatrix.elements, index * 16);
      });
      boneMatrices = matrices;
    }
    meshes.push({ key: `${ordinal++}:${topology.key}`, topologyKey: topology.key,
      worldMatrix: Float32Array.from(mesh.matrixWorld.elements),
      // AttachedBindMode can replace this on every instance transform. Keep a
      // private copy per death while retaining shared topology in the worker.
      bindMatrixInverse: topology.skinned ? Float32Array.from(mesh.bindMatrixInverse.elements) : null,
      boneMatrices });
  });
  return { meshes, topologies: [...topologies.values()] };
}

/**
 * Freeze the rendered death pose before handing pure numeric work to a worker.
 * The cloned root is detached and owns no live gameplay/controller state; it is
 * only used if the prepared result is admitted and committed atomically.
 */
export function captureDeathCutSnapshot({ THREE, source, direction = { x: 0, z: 1 }, groundY = 0 }) {
  source.parent?.updateWorldMatrix(true, false);
  source.updateMatrixWorld(true);
  source.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
  const captured = buildWorkerPosePayload(THREE, source);
  if (!captured.meshes.length) return null;
  const root = cloneSkeleton(source);
  root.visible = true;
  root.matrix.copy(source.matrixWorld);
  root.matrix.decompose(root.position, root.quaternion, root.scale);
  root.updateMatrixWorld(true);
  return {
    root,
    bounds: null,
    meshes: captured.meshes,
    topologies: captured.topologies,
    direction: { x: Number(direction?.x) || 0, z: Number(direction?.z) || 0 },
    groundY: Number.isFinite(groundY) ? groundY : 0,
  };
}

function cutContext(THREE, bounds, direction, groundY) {
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  center.y = bounds.min.y + size.y * .48;
  const axis = new THREE.Vector3(Number(direction?.z) || 0, 0, -(Number(direction?.x) || 0));
  if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); else axis.normalize();
  return { size, center, axis, ground: (Number.isFinite(groundY) ? groundY : 0) + .012, maxRepairGap: size.y * .02 };
}

/** Death-only rigid fragments: private skeletons/materials/caps; source untouched. */
export function createEnemyDeathCut({ THREE, source, scene, direction = { x: 0, z: 1 }, hideSource = true, groundY = 0, lifetime = 8, fadeDuration = .4, settleAfter = .85, profile = false, snapshot = null, prepared = null }) {
  const profileTimings = profile ? {} : null;
  const now = profile ? () => globalThis.performance?.now?.() ?? Date.now() : null;
  let phase = 0;
  let bounds, poseCache, preparation = prepared;
  if (snapshot) {
    const preparedBounds = prepared?.bounds;
    const sourceBounds = snapshot.bounds || preparedBounds;
    if (!sourceBounds) return null;
    bounds = new THREE.Box3(new THREE.Vector3(...sourceBounds.min), new THREE.Vector3(...sourceBounds.max));
  } else {
    source.parent?.updateWorldMatrix(true, false);
    source.updateMatrixWorld(true);
    source.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
    const poseStart = profile ? now() : 0;
    const captured = buildPoseCache(THREE, source); poseCache = captured.cache; bounds = captured.bounds;
    if (profile) profileTimings.poseCache = now() - poseStart;
    preparation = captured.meshes;
  }
  if (bounds.isEmpty()) return null;
  const context = cutContext(THREE, bounds, direction, groundY), { size, center, axis: side, ground } = context;
  const basePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y);
  phase = profile ? now() : 0;
  if (Array.isArray(preparation)) preparation = prepareDeathCut({ meshes: preparation, cutY: center.y, center, axis: side, maxRepairGap: context.maxRepairGap });
  const regions = new Map(preparation.regions.map(region => [region.key || region.uuid, region]));
  if (profile) profileTimings.regions = now() - phase;
  phase = profile ? now() : 0;
  const surface = preparation.surface;
  if (profile) profileTimings.surface = now() - phase;
  const parts = [], materials = new Set(), skeletons = new Set(), geometries = new Set();
  let triangleCount = 0, meshCount = 0;
  const originalVisible = source.visible;
  const capGeometry = surface.capVertices.length ? new THREE.BufferGeometry() : null;
  if (capGeometry) {
    capGeometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.capVertices, 3));
    capGeometry.computeVertexNormals(); geometries.add(capGeometry);
    triangleCount += surface.capVertices.length / 9;
  }
  phase = profile ? now() : 0;
  for (const sign of [1, -1]) {
    const root = cloneSkeleton(source);
    root.visible = true;
    const pivot = new THREE.Group();
    pivot.name = sign > 0 ? 'DashCutUpper' : 'DashCutLower';
    scene.add(pivot);
    pivot.position.copy(center);
    pivot.updateMatrixWorld(true);
    scene.add(root);
    root.matrix.copy(source.matrixWorld);
    root.matrix.decompose(root.position, root.quaternion, root.scale);
    pivot.attach(root);
    const plane = basePlane.clone();
    if (sign < 0) plane.negate();
    const base = plane.clone(), copies = new Map();
    const sourceMeshes = [];
    source.traverse(mesh => { if (mesh.isMesh) sourceMeshes.push(mesh); });
    let meshIndex = 0;
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      meshCount++;
      const original = sourceMeshes[meshIndex++], topology = getTopology(original, source);
      const region = regions.get(`${meshIndex - 1}:${topology.key}`) || preparation.regions[meshIndex - 1];
      if (!region) return;
      const carries = region.carry;
      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const copyMaterial = (material, carry) => {
        const key = `${material.uuid}:${carry}`;
        if (!copies.has(key)) {
          const copy = material.clone();
          copy.clippingPlanes = carry ? null : [plane]; copy.clipShadows = true; copy.side = THREE.DoubleSide;
          copy.userData = { ...copy.userData, deathCarry: carry };
          copies.set(key, copy); materials.add(copy);
        }
        return copies.get(key);
      };
      // Private indices/groups let standard color and shadow passes use exactly
      // the same ownership, without a shader-only mask or live geometry edits.
      const geometry = mesh.geometry.clone(), indices = [], outputMaterials = [];
      geometry.clearGroups();
      for (let materialIndex = 0; materialIndex < sourceMaterials.length; materialIndex++) for (const carry of [false,true]) {
        if (carry && sign < 0) continue;
        const start = indices.length;
        for (let faceIndex = 0; faceIndex < topology.materialIndex.length; faceIndex++)
          if (topology.materialIndex[faceIndex] === materialIndex && Boolean(carries[faceIndex]) === carry)
            indices.push(topology.faceIndices[faceIndex * 3], topology.faceIndices[faceIndex * 3 + 1], topology.faceIndices[faceIndex * 3 + 2]);
        if (indices.length > start) {
          geometry.addGroup(start,indices.length-start,outputMaterials.length);
          outputMaterials.push(copyMaterial(sourceMaterials[materialIndex],carry));
        }
      }
      geometry.setIndex(indices); geometries.add(geometry);
      triangleCount += indices.length / 3;
      mesh.geometry = geometry; mesh.material = outputMaterials;
      if (mesh.isSkinnedMesh) { mesh.frustumCulled = false; skeletons.add(mesh.skeleton); }
    });
    let cap = null;
    if (capGeometry) {
      const material = new THREE.MeshStandardMaterial({ color: 0x302b35, roughness: .94, metalness: .03,
        side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      materials.add(material);
      cap = new THREE.Mesh(capGeometry, material); cap.name = 'StylizedCutSurface'; cap.frustumCulled = false;
      pivot.add(cap);
    }
    const partMaterials = [...copies.values(), ...(cap ? [cap.material] : [])];
    const support = surface.support[sign > 0 ? 0 : 1];
    parts.push({ pivot, root, sign, plane, base, cap, support,
      initialInverse: pivot.matrixWorld.clone().invert(), planeMatrix: new THREE.Matrix4(), opacity: partMaterials.map(material => [material, material.opacity]),
      minimumY: center.y + Math.min(...support.map(p => p.y)), grounded: false, angle: 0 });
  }
  if (profile) profileTimings.cloneAndBuild = now() - phase;
  if (hideSource) source.visible = false;
  let disposed = false, elapsed = 0, settled = false, settledAt = null;
  const duration = Math.max(.9, Number(lifetime) || 8), fade = Math.max(.1, Number(fadeDuration) || .4);
  const resourceCost = {
    triangles: triangleCount,
    meshes: meshCount,
    geometries: geometries.size,
    materials: materials.size,
    skeletons: skeletons.size,
  };
  return {
    parts,
    diagnostics: { capTriangles: surface.capVertices.length / 9, closedContours: surface.contours,
      openContours: surface.openContours, openPaths: surface.openPaths,
      repairedContours: surface.repairedContours, maximumRepairGap: surface.maximumRepairGap,
      groundY: ground, carriedArmTriangles: preparation.regions.reduce((sum, region) => sum + [...region.carry].reduce((count, value) => count + value, 0), 0), supportVertices: surface.support.map(p => p.length),
      triangleCount: resourceCost.triangles, meshCount: resourceCost.meshes, geometryCount: resourceCost.geometries,
      materialCount: resourceCost.materials, skeletonCount: resourceCost.skeletons, resourceCost,
      lifetime: duration, fadeDuration: fade, settleAfter: Math.max(0, Number(settleAfter) || .85),
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() }, profile: profileTimings || undefined },
    update(dt, { quality = 'high' } = {}) {
      if (disposed) return;
      elapsed += Math.max(0, Number(dt) || 0);
      if (settled) {
        const opacity = Math.min(1, Math.max(0, (duration - elapsed) / fade));
        if (opacity < 1) for (const part of parts) for (const [material, originalOpacity] of part.opacity) {
          if (!material.transparent) { material.transparent = true; material.needsUpdate = true; }
          material.opacity = originalOpacity * opacity;
        }
        return;
      }
      const t = Math.min(1, elapsed / .66), ease = t*t*(3-2*t);
      const separation = 1 - Math.exp(-5 * elapsed);
      for (const part of parts) {
        // Gravity supplies the downward arc; tipping plus exact support prevents
        // the lower half sinking as its lowest material vertex changes.
        const angle = (part.sign > 0 ? 1.42 : -1.25) * ease;
        const sine = Math.sin(angle), cosine = Math.cos(angle);
        let minimum = Infinity;
        for (const point of part.support) minimum = Math.min(minimum, point.y*cosine + point.x*sine);
        const ballistic = center.y + (part.sign > 0 ? .7 : .15)*elapsed - .5*12*elapsed*elapsed;
        part.pivot.position.copy(center).addScaledVector(side, size.y * (part.sign > 0 ? .16 : -.10) * separation);
        part.pivot.position.y = Math.max(ballistic, ground - minimum);
        part.pivot.quaternion.setFromAxisAngle(side, angle);
        part.grounded = ballistic <= ground - minimum;
        part.minimumY = part.pivot.position.y + minimum;
        part.angle = angle;
        part.pivot.updateMatrixWorld(true);
        part.plane.copy(part.base).applyMatrix4(part.planeMatrix.copy(part.pivot.matrixWorld).multiply(part.initialInverse));
        const opacity = Math.min(1, Math.max(0, (duration-elapsed)/fade));
        for (const [material, originalOpacity] of part.opacity) {
          if (opacity < 1 && !material.transparent) { material.transparent = true; material.needsUpdate = true; }
          material.opacity = originalOpacity*opacity;
        }
        part.pivot.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = quality !== 'low'; mesh.receiveShadow = quality === 'high'; } });
      }
      if (elapsed >= Math.max(0, Number(settleAfter) || .85) && parts.every(part => part.grounded)) { settled = true; settledAt = elapsed; }
    },
    getState() {
      return { elapsed, lifetime: duration, settled, settledAt, grounded: parts.every(part => part.grounded), disposed };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const part of parts) part.pivot.removeFromParent();
      for (const material of materials) material.dispose();
      for (const skeleton of skeletons) skeleton.dispose();
      for (const geometry of geometries) geometry.dispose();
      if (hideSource) source.visible = originalVisible;
    },
  };
}
