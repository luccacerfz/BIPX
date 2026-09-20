import { ShapeUtils, Vector2 } from '../../vendor/three/three.module.js';

const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const clonePoint = point => ({ x: point.x, y: point.y, z: point.z });
const lerpPoint = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const pointAt = (mesh, index) => ({ x: mesh.vertices[index * 3], y: mesh.vertices[index * 3 + 1], z: mesh.vertices[index * 3 + 2] });

function transformPoint(matrix, x, y, z) {
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] || 1;
  return { x: (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w, y: (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w, z: (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w };
}

export function skinDeathCutVertex(mesh, index) {
  const local = [mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]];
  if (!mesh.skinIndices || !mesh.boneMatrices) return transformPoint(mesh.worldMatrix, ...local);
  const base = transformPoint(mesh.bindMatrix, ...local), skinned = { x: 0, y: 0, z: 0 };
  const stride = Math.max(4, Number(mesh.skinStride) || 4);
  for (let slot = 0; slot < stride; slot++) {
    const weight = mesh.skinWeights[index * stride + slot]; if (!weight) continue;
    const boneIndex = mesh.skinIndices[index * stride + slot], matrix = mesh.boneMatrices.subarray(boneIndex * 16, boneIndex * 16 + 16), transformed = transformPoint(matrix, base.x, base.y, base.z);
    skinned.x += transformed.x * weight; skinned.y += transformed.y * weight; skinned.z += transformed.z * weight;
  }
  const unbound = transformPoint(mesh.bindMatrixInverse, skinned.x, skinned.y, skinned.z);
  return transformPoint(mesh.worldMatrix, unbound.x, unbound.y, unbound.z);
}

function worldVertices(mesh) {
  if (mesh.worldSpace) return mesh.vertices;
  const vertices = new Float32Array(mesh.positions.length);
  for (let index = 0; index < mesh.positions.length / 3; index++) { const point = skinDeathCutVertex(mesh, index); vertices[index * 3] = point.x; vertices[index * 3 + 1] = point.y; vertices[index * 3 + 2] = point.z; }
  return vertices;
}

function supportHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y), unique = [];
  for (const point of sorted) { const previous = unique.at(-1); if (!previous || Math.abs(point.x - previous.x) > 1e-6 || Math.abs(point.y - previous.y) > 1e-6) unique.push(point); }
  const half = values => { const hull = []; for (const point of values) { while (hull.length > 1 && cross(hull.at(-2), hull.at(-1), point) <= 0) hull.pop(); hull.push(point); } return hull; };
  if (unique.length < 3) return unique;
  return [...half(unique).slice(0, -1), ...half([...unique].reverse()).slice(0, -1)];
}

function regionFaces(mesh, cutY) {
  const faceCount = mesh.faceIndices.length / 3, parents = new Uint32Array(faceCount), owner = new Map();
  for (let face = 0; face < faceCount; face++) parents[face] = face;
  const find = index => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  // Keep all three quantized coordinates. The old BigInt expression masked X
  // after shifting it into a 64-bit value, merging disconnected arm/torso
  // patches that happened to share Y/Z.
  const positionKey = point => `${Math.round(point.x * 100000)},${Math.round(point.y * 100000)},${Math.round(point.z * 100000)}`;
  for (let face = 0; face < faceCount; face++) for (let corner = 0; corner < 3; corner++) { const vertex = mesh.faceIndices[face * 3 + corner], point = pointAt(mesh, vertex); if (point.y >= cutY) continue; const key = positionKey(point), previous = owner.get(key); if (previous == null) owner.set(key, face); else parents[find(face)] = find(previous); }
  const weight = new Float32Array(faceCount), count = new Uint32Array(faceCount);
  for (let face = 0; face < faceCount; face++) for (let corner = 0; corner < 3; corner++) { const vertex = mesh.faceIndices[face * 3 + corner], point = pointAt(mesh, vertex); if (point.y < cutY) { const patch = find(face); weight[patch] += mesh.held ? 1 : (mesh.influence?.[vertex] || 0); count[patch]++; } }
  const carry = new Uint8Array(faceCount); for (let face = 0; face < faceCount; face++) { const patch = find(face); carry[face] = count[patch] > 0 && weight[patch] / count[patch] > .35 ? 1 : 0; }
  return carry;
}

function boundsFor(meshes) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of meshes) for (let i = 0; i < mesh.vertices.length; i += 3) { min[0] = Math.min(min[0], mesh.vertices[i]); min[1] = Math.min(min[1], mesh.vertices[i + 1]); min[2] = Math.min(min[2], mesh.vertices[i + 2]); max[0] = Math.max(max[0], mesh.vertices[i]); max[1] = Math.max(max[1], mesh.vertices[i + 1]); max[2] = Math.max(max[2], mesh.vertices[i + 2]); }
  return { min, max };
}

export function prepareDeathCut({ meshes, cutY, center, axis, maxRepairGap, direction = { x: 0, z: 1 } }) {
  for (const mesh of meshes) mesh.vertices = worldVertices(mesh);
  const bounds = boundsFor(meshes), sizeY = bounds.max[1] - bounds.min[1], centerPoint = center ? { x: center.x ?? center[0], y: center.y ?? center[1], z: center.z ?? center[2] } : { x: (bounds.min[0] + bounds.max[0]) / 2, y: bounds.min[1] + sizeY * .48, z: (bounds.min[2] + bounds.max[2]) / 2 };
  const side = axis ? { x: axis.x ?? axis[0], y: axis.y ?? axis[1], z: axis.z ?? axis[2] } : { x: Number(direction?.z) || 0, y: 0, z: -(Number(direction?.x) || 0) }, axisLength = Math.hypot(side.x, side.z) || 1; side.x /= axisLength; side.z /= axisLength;
  const planeY = Number.isFinite(cutY) ? cutY : centerPoint.y, repairGap = Number.isFinite(maxRepairGap) ? maxRepairGap : sizeY * .02;
  const points = [[], []], nodes = new Map(), edges = new Map(), supportSeen = new Map(), key = point => `${Math.round(point.x * 2000)},${Math.round(point.z * 2000)}`;
  const addPoint = (point, sign, mesh = null, index = -1) => { if (mesh && index >= 0) { let seen = supportSeen.get(mesh.key); if (!seen) { seen = new Uint8Array(mesh.vertices.length / 3); supportSeen.set(mesh.key, seen); } const mask = sign > 0 ? 1 : 2; if (seen[index] & mask) return; seen[index] |= mask; } points[sign > 0 ? 0 : 1].push({ x: side.z * (point.x - centerPoint.x) - side.x * (point.z - centerPoint.z), y: point.y - centerPoint.y }); };
  const addSegment = (a, b) => { const ka = key(a), kb = key(b); if (ka === kb) return; for (const [id, point] of [[ka, a], [kb, b]]) if (!nodes.has(id)) nodes.set(id, { point: clonePoint(point), edges: [] }); const id = [ka, kb].sort().join('|'); if (edges.has(id)) return; const edge = { a: ka, b: kb, used: false }; edges.set(id, edge); nodes.get(ka).edges.push(edge); nodes.get(kb).edges.push(edge); addPoint(a, 1); addPoint(a, -1); addPoint(b, 1); addPoint(b, -1); };
  const regions = [];
  for (const mesh of meshes) {
    const carry = regionFaces(mesh, planeY); regions.push({ key: mesh.key, carry });
    for (let faceIndex = 0; faceIndex < mesh.faceIndices.length / 3; faceIndex++) {
      const indices = [mesh.faceIndices[faceIndex * 3], mesh.faceIndices[faceIndex * 3 + 1], mesh.faceIndices[faceIndex * 3 + 2]], triangle = indices.map(index => pointAt(mesh, index));
      for (let corner = 0; corner < 3; corner++) { const point = triangle[corner], index = indices[corner]; if (carry[faceIndex] || point.y >= planeY - 1e-8) addPoint(point, 1, mesh, index); if (!carry[faceIndex] && point.y <= planeY + 1e-8) addPoint(point, -1, mesh, index); }
      if (carry[faceIndex]) continue;
      const hits = []; for (let edge = 0; edge < 3; edge++) { const a = triangle[edge], b = triangle[(edge + 1) % 3], da = a.y - planeY, db = b.y - planeY; if ((da < 0 && db > 0) || (da > 0 && db < 0)) hits.push(lerpPoint(a, b, da / (da - db))); else if (Math.abs(da) < 1e-8) hits.push(clonePoint(a)); } if (hits.length >= 2) addSegment(hits[0], hits[1]);
    }
  }
  const contours = [], openPaths = []; let openContours = 0, repairedContours = 0, maximumRepairGap = 0;
  for (const first of edges.values()) {
    if (first.used) continue;
    const start = first.a, contour = [nodes.get(start).point]; let at = start, edge = first, closed = false;
    while (edge && !edge.used) { edge.used = true; at = edge.a === at ? edge.b : edge.a; if (at === start) { closed = true; break; } contour.push(nodes.get(at).point); edge = nodes.get(at).edges.find(candidate => !candidate.used); }
    if (closed && contour.length >= 3) contours.push(contour); else { const gap = Math.hypot(contour[0].x - contour.at(-1).x, contour[0].y - contour.at(-1).y, contour[0].z - contour.at(-1).z); if (contour.length >= 3 && gap <= repairGap) { contours.push(contour); repairedContours++; maximumRepairGap = Math.max(maximumRepairGap, gap); } else if (contour.length === 2 && gap <= .005) { const offset = { x: contour[1].x - contour[0].x, z: contour[1].z - contour[0].z }, length = Math.hypot(offset.x, offset.z) || 1, dx = -offset.z / length * .00075, dz = offset.x / length * .00075; contours.push([{ x: contour[0].x + dx, y: contour[0].y, z: contour[0].z + dz }, { x: contour[1].x + dx, y: contour[1].y, z: contour[1].z + dz }, { x: contour[1].x - dx, y: contour[1].y, z: contour[1].z - dz }, { x: contour[0].x - dx, y: contour[0].y, z: contour[0].z - dz }]); repairedContours++; maximumRepairGap = Math.max(maximumRepairGap, gap); } else { openContours++; openPaths.push({ points: contour.length, gap, from: [contour[0].x, contour[0].y, contour[0].z], to: [contour.at(-1).x, contour.at(-1).y, contour.at(-1).z] }); } }
  }
  const capVertices = []; for (const contour of contours) { const planar = contour.map(point => new Vector2(point.x - centerPoint.x, point.z - centerPoint.z)); for (const triangle of ShapeUtils.triangulateShape(planar, [])) for (const index of triangle) { const point = planar[index]; capVertices.push(point.x, 0, point.y); } }
  for (let i = 0; i < capVertices.length; i += 3) for (const half of points) half.push({ x: side.z * capVertices[i] - side.x * capVertices[i + 2], y: capVertices[i + 1] });
  return { bounds, regions, surface: { support: points.map(supportHull), capVertices: Float32Array.from(capVertices), contours: contours.length, openContours, openPaths, repairedContours, maximumRepairGap } };
}
