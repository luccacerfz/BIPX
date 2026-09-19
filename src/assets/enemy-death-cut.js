import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';

// Convex support in the tipping plane: exact minima for all sampled vertices,
// with O(hull) work per frame instead of re-skinning thousands of vertices.
function supportHull(points) {
  const sorted = [...new Map(points.map(p => [`${p.x.toFixed(6)},${p.y.toFixed(6)}`, p])).values()]
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a, b, c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const half = values => {
    const hull = [];
    for (const p of values) {
      while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), p) <= 0) hull.pop();
      hull.push(p);
    }
    return hull;
  };
  if (sorted.length < 3) return sorted;
  return [...half(sorted).slice(0,-1), ...half([...sorted].reverse()).slice(0,-1)];
}

// Split triangle ownership at the shoulder using the real skin weights. Arms,
// hands and held props stay whole with the torso even below the waist plane.
function torsoRegions(THREE, source, cutY) {
  const regions = new Map();
  const armName = /arm|hand|shoulder|clavicle|finger|thumb|index|pinky/i;
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry, skin = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
    let held = false;
    for (let at = mesh.parent; at && at !== source.parent; at = at.parent)
      if (at.isBone && armName.test(at.name)) held = true;
    const influence = i => {
      if (held) return 1;
      if (!mesh.isSkinnedMesh || !skin || !weights) return 0;
      let total = 0;
      for (let c = 0; c < 4; c++) if (armName.test(mesh.skeleton.bones[skin.getComponent(i,c)]?.name || '')) total += weights.getComponent(i,c);
      return total;
    };
    const index = geometry.index, count = index ? index.count : geometry.attributes.position.count;
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    const vertices = Array.from({length:geometry.attributes.position.count},(_,i) =>
      mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    const faces = [];
    for (const group of groups) for (let i = group.start; i + 2 < Math.min(count,group.start+group.count); i += 3) {
      const indices = [0,1,2].map(n => index ? index.getX(i+n) : i+n);
      faces.push({ indices, carry: false, materialIndex: group.materialIndex });
    }
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
      for (const v of face.indices) if (vertices[v].y < cutY) { total.weight += influence(v); total.count++; }
      weightsByPatch.set(id,total);
    });
    faces.forEach((face,i) => { const total = weightsByPatch.get(find(i)); face.carry = total.count > 0 && total.weight/total.count > .35; });
    regions.set(mesh.uuid, faces);
  });
  return regions;
}

// Intersect only torso/leg triangles with the waist plane; carried arms stay whole.
// Quantized shared endpoints weld UV seams without changing the live mesh.
function cutSurface(THREE, source, cutY, center, axis, maxRepairGap, regions) {
  const points = [[], []], nodes = new Map(), edges = new Map();
  const key = p => `${Math.round(p.x * 2000)},${Math.round(p.z * 2000)}`;
  const addPoint = (point, sign) => points[sign > 0 ? 0 : 1].push({
    x: axis.z * (point.x-center.x) - axis.x * (point.z-center.z), y: point.y-center.y,
  });
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
    const vertices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
      mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    for (const face of regions.get(mesh.uuid)) {
      const triangle = face.indices.map(i => vertices[i]);
      for (const p of triangle) {
        if (face.carry || p.y >= cutY - 1e-8) addPoint(p, 1);
        if (!face.carry && p.y <= cutY + 1e-8) addPoint(p, -1);
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

/** Death-only rigid fragments: private skeletons/materials/caps; source untouched. */
export function createEnemyDeathCut({ THREE, source, scene, direction = { x: 0, z: 1 }, hideSource = true, groundY = 0 }) {
  source.parent?.updateWorldMatrix(true, false);
  // Match the renderer path, including SkinnedMesh.bindMatrixInverse refresh
  // after scene.attach. updateWorldMatrix alone bypasses that mesh override.
  source.updateMatrixWorld(true);
  source.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
  const bounds = new THREE.Box3().setFromObject(source, true);
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  center.y = bounds.min.y + size.y * .48;
  const basePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y);
  const side = new THREE.Vector3(Number(direction.z)||0, 0, -(Number(direction.x)||0));
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  const ground = (Number.isFinite(groundY) ? groundY : 0) + .012;
  const regions = torsoRegions(THREE, source, center.y);
  const surface = cutSurface(THREE, source, center.y, center, side, size.y * .02, regions);
  const parts = [], materials = new Set(), skeletons = new Set(), geometries = new Set();
  const originalVisible = source.visible;
  const capGeometry = surface.capVertices.length ? new THREE.BufferGeometry() : null;
  if (capGeometry) {
    capGeometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.capVertices, 3));
    capGeometry.computeVertexNormals(); geometries.add(capGeometry);
  }
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
      const original = sourceMeshes[meshIndex++], faces = regions.get(original.uuid);
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
        for (const face of faces) if (face.materialIndex === materialIndex && face.carry === carry) indices.push(...face.indices);
        if (indices.length > start) {
          geometry.addGroup(start,indices.length-start,outputMaterials.length);
          outputMaterials.push(copyMaterial(sourceMaterials[materialIndex],carry));
        }
      }
      geometry.setIndex(indices); geometries.add(geometry);
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
      initialInverse: pivot.matrixWorld.clone().invert(), opacity: partMaterials.map(material => [material, material.opacity]),
      minimumY: center.y + Math.min(...support.map(p => p.y)), grounded: false, angle: 0 });
  }
  if (hideSource) source.visible = false;
  let disposed = false, elapsed = 0;
  return {
    parts,
    diagnostics: { capTriangles: surface.capVertices.length / 9, closedContours: surface.contours,
      openContours: surface.openContours, openPaths: surface.openPaths,
      repairedContours: surface.repairedContours, maximumRepairGap: surface.maximumRepairGap,
      groundY: ground, carriedArmTriangles: [...regions.values()].flat().filter(f => f.carry).length, supportVertices: surface.support.map(p => p.length) },
    update(dt, { quality = 'high' } = {}) {
      if (disposed) return;
      elapsed += Math.max(0, Number(dt) || 0);
      const t = Math.min(1, elapsed / .66), ease = t*t*(3-2*t);
      const separation = 1 - Math.exp(-5 * elapsed);
      for (const part of parts) {
        // Gravity supplies the downward arc; tipping plus exact support prevents
        // the lower half sinking as its lowest material vertex changes.
        const angle = (part.sign > 0 ? 1.42 : -1.25) * ease;
        const sine = Math.sin(angle), cosine = Math.cos(angle);
        const minimum = Math.min(...part.support.map(p => p.y*cosine + p.x*sine));
        const ballistic = center.y + (part.sign > 0 ? .7 : .15)*elapsed - .5*12*elapsed*elapsed;
        part.pivot.position.copy(center).addScaledVector(side, size.y * (part.sign > 0 ? .16 : -.10) * separation);
        part.pivot.position.y = Math.max(ballistic, ground - minimum);
        part.pivot.quaternion.setFromAxisAngle(side, angle);
        part.grounded = ballistic <= ground - minimum;
        part.minimumY = part.pivot.position.y + minimum;
        part.angle = angle;
        part.pivot.updateMatrixWorld(true);
        part.plane.copy(part.base).applyMatrix4(part.pivot.matrixWorld.clone().multiply(part.initialInverse));
        const fade = Math.min(1, Math.max(0, (1.65-elapsed)/.35));
        for (const [material, opacity] of part.opacity) {
          if (fade < 1 && !material.transparent) { material.transparent = true; material.needsUpdate = true; }
          material.opacity = opacity*fade;
        }
        part.pivot.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = quality !== 'low'; mesh.receiveShadow = quality === 'high'; } });
      }
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
