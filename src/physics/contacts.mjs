/** Deterministic XZ contacts. Pure, allocation-local, usable in browser and Node. */
const EPS = 1e-9;
const SKIN = 1e-5;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const finite = (x, label) => {
  if (!Number.isFinite(x)) throw new TypeError(`${label} must be finite`);
  return x;
};
const positive = (x, label, allowZero = false) => {
  finite(x, label);
  if (allowZero ? x < 0 : x <= 0) throw new RangeError(`${label} out of range`);
  return x;
};
const compareId = (a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
function uniqueIds(items) {
  const ids = new Set();
  for (const item of items) {
    if (item.id == null || ids.has(String(item.id))) throw new TypeError('Unique stable ids required');
    ids.add(String(item.id));
  }
}
function point(p) { finite(p.x, 'x'); finite(p.z, 'z'); }

// Private broad phase for worlds compiled here. Shapes/world are immutable;
// foreign worlds keep the complete scan, and candidate order stays unchanged.
const staticIndices = new WeakMap();
function indexStatics(world) {
  if (world.colliders.length < 16) return;
  const cells = new Map(), cellSize = 8;
  let entries = 0;
  for (let i = 0; i < world.colliders.length; i++) {
    const s = world.colliders[i], x0 = Math.floor(s.minX / cellSize), x1 = Math.floor(s.maxX / cellSize),
      z0 = Math.floor(s.minZ / cellSize), z1 = Math.floor(s.maxZ / cellSize);
    if (![x0, x1, z0, z1].every(Number.isSafeInteger)) return;
    entries += (x1 - x0 + 1) * (z1 - z0 + 1);
    // Extremely large shapes remain valid without an unbounded grid allocation.
    if (entries > 4096) return;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const key = `${x},${z}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(i);
    }
  }
  staticIndices.set(world, { cells, cellSize, cached: null });
}
function staticCandidates(world, minX, minZ, maxX, maxZ) {
  const index = staticIndices.get(world);
  if (!index) return world.colliders;
  const { cells, cellSize, cached } = index, x0 = Math.floor(minX / cellSize), x1 = Math.floor(maxX / cellSize),
    z0 = Math.floor(minZ / cellSize), z1 = Math.floor(maxZ / cellSize);
  if (cached && cached.x0 === x0 && cached.x1 === x1 && cached.z0 === z0 && cached.z1 === z1) return cached.shapes;
  if (!Number.isSafeInteger(x0) || !Number.isSafeInteger(x1) || !Number.isSafeInteger(z0) || !Number.isSafeInteger(z1)) return world.colliders;
  if ((x1 - x0 + 1) * (z1 - z0 + 1) > 16) return world.colliders;
  const ids = new Set();
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const i of cells.get(`${x},${z}`) ?? []) ids.add(i);
  const shapes = [...ids].sort((a, b) => a - b).map(i => world.colliders[i]);
  index.cached = { x0, x1, z0, z1, shapes };
  return shapes;
}

export function createCollisionWorld({ colliders = [], bounds = null, groundY = 0 } = {}) {
  finite(groundY, 'groundY');
  uniqueIds(colliders);
  const shapes = colliders.map(source => {
    if (source.id === '@bounds') throw new TypeError('@bounds is reserved for the arena');
    point(source);
    const shape = { ...source, minY: source.minY ?? -Infinity, maxY: source.maxY ?? Infinity };
    if (!(shape.minY < shape.maxY)) throw new RangeError('Collider vertical interval is empty');
    let extentX, extentZ;
    if (shape.shape === 'circle') {
      extentX = extentZ = positive(shape.radius, 'collider.radius');
    } else if (shape.shape === 'box') {
      positive(shape.halfX, 'halfX'); positive(shape.halfZ, 'halfZ');
      shape.yaw = finite(shape.yaw ?? 0, 'yaw');
      shape.cos = Math.cos(shape.yaw); shape.sin = Math.sin(shape.yaw);
      extentX = Math.abs(shape.cos) * shape.halfX + Math.abs(shape.sin) * shape.halfZ;
      extentZ = Math.abs(shape.sin) * shape.halfX + Math.abs(shape.cos) * shape.halfZ;
    } else throw new TypeError(`Unknown collision shape: ${shape.shape}`);
    return Object.freeze({ ...shape, minX: shape.x - extentX, maxX: shape.x + extentX,
      minZ: shape.z - extentZ, maxZ: shape.z + extentZ });
  }).sort(compareId);
  if (bounds) { point(bounds); positive(bounds.radius, 'bounds.radius'); }
  const world = Object.freeze({ colliders: Object.freeze(shapes), bounds: bounds ? Object.freeze({ ...bounds }) : null, groundY });
  indexStatics(world);
  return world;
}

function local(shape, x, z) {
  return { x: shape.cos * x - shape.sin * z, z: shape.sin * x + shape.cos * z };
}
function globalNormal(shape, normal) {
  return { x: shape.cos * normal.x + shape.sin * normal.z, z: -shape.sin * normal.x + shape.cos * normal.z };
}

// Signed overlap and nearest outward direction on the exact rounded rectangle.
function penetration(shape, x, z, radius) {
  if (shape.shape === 'circle') {
    const dx = x - shape.x, dz = z - shape.z, length = Math.hypot(dx, dz);
    return { depth: radius + shape.radius - length, normal: length > EPS ? { x: dx / length, z: dz / length } : { x: 1, z: 0 } };
  }
  const p = local(shape, x - shape.x, z - shape.z);
  const dx = p.x - clamp(p.x, -shape.halfX, shape.halfX);
  const dz = p.z - clamp(p.z, -shape.halfZ, shape.halfZ);
  const length = Math.hypot(dx, dz);
  if (length > EPS) return { depth: radius - length, normal: globalNormal(shape, { x: dx / length, z: dz / length }) };
  const sideX = shape.halfX - Math.abs(p.x), sideZ = shape.halfZ - Math.abs(p.z);
  return sideX <= sideZ
    ? { depth: radius + sideX, normal: globalNormal(shape, { x: Math.sign(p.x) || 1, z: 0 }) }
    : { depth: radius + sideZ, normal: globalNormal(shape, { x: 0, z: Math.sign(p.z) || 1 }) };
}

function circleSweep(x, z, dx, dz, radius) {
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < EPS * EPS) return null;
  const b = x * dx + z * dz, c = x * x + z * z - radius * radius;
  if (b >= 0) return null;
  const disc = b * b - lengthSq * c;
  if (disc < -EPS) return null;
  const t = (-b - Math.sqrt(Math.max(0, disc))) / lengthSq;
  if (t < -EPS || t > 1 + EPS) return null;
  const time = clamp(t, 0, 1), nx = x + dx * time, nz = z + dz * time;
  const length = Math.hypot(nx, nz);
  return { t: time, normal: length > EPS ? { x: nx / length, z: nz / length } : { x: -dx / Math.sqrt(lengthSq), z: -dz / Math.sqrt(lengthSq) } };
}

function shapeSweep(shape, from, to, radius, initialContact) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const overlap = penetration(shape, from.x, from.z, radius);
  if (overlap.depth >= -EPS && (initialContact || overlap.normal.x * dx + overlap.normal.z * dz < -EPS)) {
    return { t: 0, normal: overlap.normal };
  }
  if (shape.shape === 'circle') return circleSweep(from.x - shape.x, from.z - shape.z, dx, dz, shape.radius + radius);
  const start = local(shape, from.x - shape.x, from.z - shape.z), d = local(shape, dx, dz);
  let first = null;
  const consider = hit => {
    if (hit && hit.t >= -EPS && hit.t <= 1 + EPS && (!first || hit.t < first.t - EPS)) first = hit;
  };
  for (const sign of [-1, 1]) {
    if (d.x * sign < -EPS) {
      const t = (sign * (shape.halfX + radius) - start.x) / d.x;
      if (Math.abs(start.z + t * d.z) <= shape.halfZ + EPS) consider({ t, normal: { x: sign, z: 0 } });
    }
    if (d.z * sign < -EPS) {
      const t = (sign * (shape.halfZ + radius) - start.z) / d.z;
      if (Math.abs(start.x + t * d.x) <= shape.halfX + EPS) consider({ t, normal: { x: 0, z: sign } });
    }
  }
  if (radius > 0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hit = circleSweep(start.x - sx * shape.halfX, start.z - sz * shape.halfZ, d.x, d.z, radius);
    if (hit && sx * (start.x + d.x * hit.t) >= shape.halfX - EPS && sz * (start.z + d.z * hit.t) >= shape.halfZ - EPS) consider(hit);
  }
  return first ? { t: clamp(first.t, 0, 1), normal: globalNormal(shape, first.normal) } : null;
}

function boundsSweep(bounds, from, to, radius, initialContact) {
  const limit = Math.max(0, bounds.radius - radius);
  const x = from.x - bounds.x, z = from.z - bounds.z, dx = to.x - from.x, dz = to.z - from.z;
  const length = Math.hypot(x, z), nx = to.x - bounds.x, nz = to.z - bounds.z;
  const normalAt = (px, pz) => { const d = Math.hypot(px, pz); return d > EPS ? { x: -px / d, z: -pz / d } : { x: -1, z: 0 }; };
  if (length > limit + EPS || (initialContact && length >= limit - EPS)) return { t: 0, normal: normalAt(x, z) };
  if (Math.hypot(nx, nz) <= limit + EPS) return null;
  const a = dx * dx + dz * dz;
  if (a < EPS * EPS) return null;
  const b = x * dx + z * dz, c = x * x + z * z - limit * limit;
  const t = clamp((-b + Math.sqrt(Math.max(0, b * b - a * c))) / a, 0, 1);
  return { t, normal: normalAt(x + t * dx, z + t * dz) };
}

function verticalWindow(shape, from, to, radius, options) {
  if (options.kind === 'actor') {
    const bottom = options.y ?? from.y ?? 0;
    return bottom + (options.height ?? 2) > shape.minY && bottom < shape.maxY ? [0, 1] : null;
  }
  // Without a supplied Y this is explicitly a 2D query, conservative at all heights.
  if (!Number.isFinite(from.y) && !Number.isFinite(to.y)) return [0, 1];
  const y0 = from.y ?? to.y, y1 = to.y ?? from.y, dy = y1 - y0;
  const min = shape.minY - radius, max = shape.maxY + radius;
  if (Math.abs(dy) < EPS) return y0 >= min && y0 <= max ? [0, 1] : null;
  const a = (min - y0) / dy, b = (max - y0) / dy;
  const enter = Math.max(0, Math.min(a, b)), exit = Math.min(1, Math.max(a, b));
  return enter <= exit ? [enter, exit] : null;
}

/** First solid contact. `t` is on the original segment, not the clipped Y interval. */
export function sweepStatic(world, from, to, radius = 0, options = {}) {
  point(from); point(to); positive(radius, 'radius', true);
  const kind = options.kind ?? 'projectile', initialContact = kind !== 'actor';
  let first = null;
  const consider = (hit, colliderId) => {
    if (hit && (!first || hit.t < first.t - EPS)) first = { ...hit, colliderId };
  };
  const minX = Math.min(from.x, to.x) - radius, maxX = Math.max(from.x, to.x) + radius;
  const minZ = Math.min(from.z, to.z) - radius, maxZ = Math.max(from.z, to.z) + radius;
  for (const shape of staticCandidates(world, minX, minZ, maxX, maxZ)) {
    if (kind === 'actor' ? shape.blockingActors === false : shape.blockingProjectiles === false) continue;
    if (maxX < shape.minX || minX > shape.maxX || maxZ < shape.minZ || minZ > shape.maxZ) continue;
    const window = verticalWindow(shape, from, to, radius, { ...options, kind });
    if (!window) continue;
    const [enter, exit] = window;
    const a = { x: from.x + (to.x - from.x) * enter, z: from.z + (to.z - from.z) * enter };
    const b = { x: from.x + (to.x - from.x) * exit, z: from.z + (to.z - from.z) * exit };
    const hit = shapeSweep(shape, a, b, radius, initialContact);
    if (hit) consider({ ...hit, t: enter + hit.t * (exit - enter) }, shape.id);
  }
  if (world.bounds && options.includeBounds !== false) consider(boundsSweep(world.bounds, from, to, radius, initialContact), '@bounds');
  if (!first) return null;
  return { ...first, x: from.x + (to.x - from.x) * first.t, z: from.z + (to.z - from.z) * first.t,
    y: (from.y ?? world.groundY) + ((to.y ?? from.y ?? world.groundY) - (from.y ?? world.groundY)) * first.t };
}

function actorBody(world, body) {
  point(body); positive(body.radius, 'body.radius');
  if (world.bounds && body.radius >= world.bounds.radius) throw new RangeError('Actor cannot fit in bounds');
  return { x: body.x, z: body.z, y: finite(body.y ?? world.groundY, 'body.y'),
    radius: body.radius, height: positive(body.height ?? 2, 'body.height') };
}
function deepest(world, body) {
  let hit = { depth: 0, normal: { x: 0, z: 0 }, colliderId: null };
  for (const shape of staticCandidates(world, body.x - body.radius, body.z - body.radius, body.x + body.radius, body.z + body.radius)) {
    if (shape.blockingActors === false || body.y + body.height <= shape.minY || body.y >= shape.maxY) continue;
    if (body.x + body.radius < shape.minX || body.x - body.radius > shape.maxX || body.z + body.radius < shape.minZ || body.z - body.radius > shape.maxZ) continue;
    const overlap = penetration(shape, body.x, body.z, body.radius);
    if (overlap.depth > hit.depth) hit = { ...overlap, colliderId: shape.id };
  }
  if (world.bounds) {
    const dx = body.x - world.bounds.x, dz = body.z - world.bounds.z, length = Math.hypot(dx, dz);
    const depth = length + body.radius - world.bounds.radius;
    if (depth > hit.depth) hit = { depth, normal: { x: -dx / length, z: -dz / length }, colliderId: '@bounds' };
  }
  return hit;
}

/** Per-tick scratch broad phase; update after every accepted actor move. */
export function createActorIndex(bodies, { cellSize = 4 } = {}) {
  positive(cellSize, 'actorIndex.cellSize'); uniqueIds(bodies);
  const records = new Map(), cells = new Map();
  let cached = null;
  const cellKeys = (minX,minZ,maxX,maxZ) => {
    const keys=[];
    for(let x=Math.floor(minX/cellSize);x<=Math.floor(maxX/cellSize);x++)
      for(let z=Math.floor(minZ/cellSize);z<=Math.floor(maxZ/cellSize);z++) keys.push(`${x},${z}`);
    return keys;
  };
  function remove(bodyId) {
    cached = null;
    const id=String(bodyId),previous=records.get(id);
    for(const key of previous?.keys??[]) { const cell=cells.get(key);cell.delete(id);if(!cell.size)cells.delete(key); }
    return records.delete(id);
  }
  function update(body) {
    point(body);positive(body.radius,'body.radius');if(body.id==null)throw new TypeError('Stable body id required');
    const id=String(body.id);remove(id);
    const keys=cellKeys(body.x-body.radius,body.z-body.radius,body.x+body.radius,body.z+body.radius);
    records.set(id,{body:{...body},keys});
    for(const key of keys) { if(!cells.has(key))cells.set(key,new Set());cells.get(key).add(id); }
  }
  for(const body of bodies)update(body);
  return { update, remove, query(minX,minZ,maxX,maxZ) {
    const x0=Math.floor(minX/cellSize),z0=Math.floor(minZ/cellSize),x1=Math.floor(maxX/cellSize),z1=Math.floor(maxZ/cellSize);
    // Sliding often queries the same cells repeatedly before the next update.
    // Cache only membership/order; every sweep still applies its exact AABB/Y tests.
    if(!cached || cached.x0!==x0 || cached.z0!==z0 || cached.x1!==x1 || cached.z1!==z1) {
      const ids=new Set();
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)for(const id of cells.get(`${x},${z}`)??[])ids.add(id);
      const bodies=[...ids].map(id=>records.get(id).body).sort(compareId);
      cached={x0,z0,x1,z1,bodies};
    }
    // Keep the public result array independent of both cache and previous queries.
    return cached.bodies.slice();
  } };
}

// Peers are the current positions for this sequential solve, not stale frame origins.
// Starting overlaps may move apart; no sweep may deepen them or cross a third body.
function sweepBodies(world, body, from, to, bodies) {
  if (!bodies || Array.isArray(bodies) && !bodies.length) return null;
  if (body.id == null) throw new TypeError('Dynamic movement requires a stable body id');
  let first = null;
  const minX = Math.min(from.x, to.x) - body.radius, maxX = Math.max(from.x, to.x) + body.radius;
  const minZ = Math.min(from.z, to.z) - body.radius, maxZ = Math.max(from.z, to.z) + body.radius;
  const nearby = Array.isArray(bodies) ? bodies : bodies.query(minX,minZ,maxX,maxZ);
  for (const other of nearby) {
    if (String(other.id) === String(body.id) || other.dead) continue;
    if (other.x + other.radius < minX || other.x - other.radius > maxX || other.z + other.radius < minZ || other.z - other.radius > maxZ) continue;
    const y = other.y ?? world.groundY, height = other.height ?? 2;
    if (from.y >= y + height || from.y + body.height <= y) continue;
    // Coincident centers have no inward direction; every nonzero exit reduces overlap.
    if (Math.hypot(from.x - other.x, from.z - other.z) < EPS) continue;
    const hit = shapeSweep({ shape: 'circle', x: other.x, z: other.z, radius: other.radius }, from, to, body.radius, false);
    if (hit && (!first || hit.t < first.t - EPS || Math.abs(hit.t - first.t) <= EPS && String(other.id) < String(first.bodyId))) {
      first = { ...hit, bodyId: other.id, colliderId: `@actor:${other.id}` };
    }
  }
  return first;
}

/** Optional bodies prevent dynamic compression during advance and corrections. */
export function moveActor(world, body, displacement, options = {}) {
  const p = actorBody(world, body); point(displacement);
  const contacts = [], maxSlides = clamp(Math.floor(positive(options.maxSlides ?? 8, 'maxSlides')), 1, 16);
  const trace = [];
  for (let i = 0; i < 16; i++) {
    const overlap = deepest(world, p);
    if (overlap.depth <= EPS) break;
    const before = options.trace ? { x: p.x, z: p.z } : null;
    p.x += overlap.normal.x * (overlap.depth + SKIN);
    p.z += overlap.normal.z * (overlap.depth + SKIN);
    if (options.trace) trace.push({ from: before, to: { x: p.x, z: p.z }, recovery: true });
    contacts.push({ ...overlap, t: 0, recovery: true });
  }
  const recovery = { x: p.x - body.x, z: p.z - body.z };
  let rx = displacement.x, rz = displacement.z;
  for (let i = 0; i < maxSlides && Math.hypot(rx, rz) > EPS; i++) {
    const before = options.trace ? { x: p.x, z: p.z } : null, to = { x: p.x + rx, z: p.z + rz };
    let hit = sweepStatic(world, p, to, p.radius, { kind: 'actor', y: p.y, height: p.height });
    const dynamic = sweepBodies(world, { ...p, id: body.id }, p, to, options.bodies);
    if (dynamic && (!hit || dynamic.t < hit.t - EPS)) hit = dynamic;
    if (!hit) {
      p.x += rx; p.z += rz;
      if (options.trace) trace.push({ from: before, to: { x: p.x, z: p.z } });
      break;
    }
    contacts.push(hit);
    // With peers, retreat along the already-safe segment for static hits too;
    // an outward wall nudge can otherwise accumulate penetration into a neighbor.
    if (hit.bodyId != null || options.bodies?.query || options.bodies?.length) {
      const time = Math.max(0, hit.t - SKIN / Math.hypot(rx, rz));
      p.x += rx * time; p.z += rz * time;
    } else {
      p.x += rx * hit.t + hit.normal.x * SKIN;
      p.z += rz * hit.t + hit.normal.z * SKIN;
    }
    if (options.trace) trace.push({ from: before, to: { x: p.x, z: p.z } });
    if (options.stopOnContact) break;
    rx *= 1 - hit.t; rz *= 1 - hit.t;
    const inward = rx * hit.normal.x + rz * hit.normal.z;
    if (inward < 0) { rx -= inward * hit.normal.x; rz -= inward * hit.normal.z; }
    // A tangent to a circular arena leaves it immediately. Use the inward chord
    // to the projected destination, then sweep that chord against props as usual.
    if (hit.colliderId === '@bounds') {
      const b = world.bounds, tx = p.x + rx - b.x, tz = p.z + rz - b.z;
      const length = Math.hypot(tx, tz), limit = b.radius - p.radius - SKIN;
      if (length > limit) { rx = b.x + tx / length * limit - p.x; rz = b.z + tz / length * limit - p.z; }
    }
  }
  return { x: p.x, y: p.y, z: p.z, displacement: { x: p.x - body.x, z: p.z - body.z }, recovery,
    contacts, ...(options.trace ? { trace } : {}), blocked: contacts.length > 0, unresolved: deepest(world, p).depth > SKIN * 2 };
}

/** Velocity m/s and bounded simulation dt. Dropped time is explicit in the result. */
export function stepActor(world, body, velocity, dt, options = {}) {
  point(velocity);
  const requested = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const maxDt = clamp(positive(options.maxDt ?? .1, 'maxDt'), .001, .25);
  const maxStep = clamp(positive(options.maxStep ?? 1 / 60, 'maxStep'), .001, .05);
  const maxSubsteps = clamp(Math.floor(positive(options.maxSubsteps ?? 8, 'maxSubsteps')), 1, 16);
  const accepted = Math.min(requested, maxDt, maxStep * maxSubsteps);
  const substeps = accepted > 0 ? Math.ceil(accepted / maxStep - EPS) : 0;
  const slice = substeps ? accepted / substeps : 0;
  let current = { ...body }, result;
  const contacts = [], recovery = { x: 0, z: 0 }, trace = [];
  for (let i = 0; i < Math.max(1, substeps); i++) {
    result = moveActor(world, current, { x: velocity.x * slice, z: velocity.z * slice }, options);
    current = { ...current, x: result.x, y: result.y, z: result.z };
    contacts.push(...result.contacts); recovery.x += result.recovery.x; recovery.z += result.recovery.z;
    if (options.trace) trace.push(...result.trace);
    if (options.stopOnContact && result.blocked) break;
  }
  const displacement = { x: current.x - body.x, z: current.z - body.z };
  return { ...result, contacts, ...(options.trace ? { trace } : {}), blocked: contacts.length > 0, recovery, displacement, dt: accepted,
    discardedDt: requested - accepted, substeps,
    velocity: accepted > 0 ? { x: (displacement.x - recovery.x) / accepted, z: (displacement.z - recovery.z) / accepted } : { x: 0, z: 0 } };
}

/** Explicit spawn/teleport recovery. Never use this search for ordinary movement. */
export function findFreePosition(world, body, options = {}) {
  const original = actorBody(world, body);
  const maxDistance = clamp(positive(options.maxDistance ?? 12, 'maxDistance'), .25, 55);
  const stride = clamp(positive(options.stride ?? .5, 'stride'), .25, maxDistance);
  const otherBodies = (options.actors ?? []).filter(other => body.id == null || other.id !== body.id).map(other => actorBody(world, other));
  let attempts = 0;
  const free = p => {
    attempts++;
    if (deepest(world, p).depth > EPS) return false;
    return otherBodies.every(other => !verticalOverlap(p, other) || Math.hypot(p.x - other.x, p.z - other.z) >= p.radius + other.radius);
  };
  const result = (p, found) => ({ x: p.x, y: p.y, z: p.z, found, attempts,
    relocated: Math.hypot(p.x - original.x, p.z - original.z) > EPS,
    distance: Math.hypot(p.x - original.x, p.z - original.z) });
  if (free(original)) return result(original, true);
  const local = moveActor(world, original, { x: 0, z: 0 });
  const recovered = { ...original, x: local.x, z: local.z };
  if (Math.hypot(recovered.x - original.x, recovered.z - original.z) <= maxDistance && free(recovered)) return result(recovered, true);
  const center = world.bounds ?? { x: 0, z: 0 };
  const startAngle = Math.atan2(center.z - original.z, center.x - original.x);
  const rings = Math.ceil(maxDistance / stride);
  for (let ring = 1; ring <= rings; ring++) {
    const radius = Math.min(maxDistance, ring * stride);
    const count = Math.min(64, Math.max(8, Math.ceil(2 * Math.PI * radius / stride)));
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * Math.PI * 2 / count;
      const candidate = { ...original, x: original.x + Math.cos(angle) * radius, z: original.z + Math.sin(angle) * radius };
      if (free(candidate)) return result(candidate, true);
    }
  }
  return result(original, false);
}

function pairNormal(a, b) {
  let hash = 2166136261;
  for (const char of `${a.id}:${b.id}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const angle = (hash >>> 0) / 4294967296 * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}
function pairs(bodies) {
  const cell = Math.max(.1, ...bodies.map(body => body.radius * 2)), grid = new Map(), result = [];
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i], x = Math.floor(body.x / cell), z = Math.floor(body.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(`${x + dx},${z + dz}`) ?? []) result.push([j, i]);
    }
    const key = `${x},${z}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }
  return result.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
function verticalOverlap(a, b) { return a.y < b.y + b.height && b.y < a.y + a.height; }

/** Bounded positional crowd solve, stable under caller array reordering. */
export function separateActors(world, bodies, options = {}) {
  uniqueIds(bodies);
  const sorted = bodies.map(body => ({ ...body, ...actorBody(world, body),
    inverseMass: positive(body.inverseMass ?? 1, 'inverseMass', true) })).sort(compareId);
  const iterations = clamp(Math.floor(positive(options.iterations ?? 4, 'iterations')), 1, 12);
  const maxCorrection = clamp(positive(options.maxCorrection ?? .2, 'maxCorrection'), .001, 1);
  const maxTotalCorrection = clamp(positive(options.maxTotalCorrection ?? .5, 'maxTotalCorrection'), .001, 2);
  const slop = clamp(positive(options.slop ?? .001, 'slop', true), 0, .05);
  const budgets = sorted.map(() => maxTotalCorrection);
  const trace = [];
  // Retain the existing bounded recovery; pre-movement dynamic sweeps prevent
  // new compression. Optional outsiders guard the controlled-only recovery pass.
  const blockers = options.blockers ?? [];
  let used = 0;
  function push(index, x, z) {
    const actor = sorted[index], length = Math.hypot(x, z);
    if (!actor.inverseMass || length <= EPS || budgets[index] <= EPS) return;
    const scale = Math.min(1, budgets[index] / length);
    const moved = moveActor(world, actor, { x: x * scale, z: z * scale }, { bodies: blockers, trace: options.trace });
    if (options.trace) trace.push(...moved.trace.map(segment => ({ id: actor.id, ...segment })));
    budgets[index] -= Math.hypot(moved.x - actor.x, moved.z - actor.z);
    actor.x = moved.x; actor.z = moved.z;
  }
  for (; used < iterations; used++) {
    let active = false;
    for (const [i, j] of pairs(sorted)) {
      const a = sorted[i], b = sorted[j];
      if (!verticalOverlap(a, b)) continue;
      const dx = a.x - b.x, dz = a.z - b.z, length = Math.hypot(dx, dz);
      const depth = a.radius + b.radius - length - slop, mass = a.inverseMass + b.inverseMass;
      if (depth <= EPS || mass <= 0) continue;
      active = true;
      const normal = length > EPS ? { x: dx / length, z: dz / length } : pairNormal(a, b);
      const correction = Math.min(depth, maxCorrection);
      push(i, normal.x * correction * a.inverseMass / mass, normal.z * correction * a.inverseMass / mass);
      push(j, -normal.x * correction * b.inverseMass / mass, -normal.z * correction * b.inverseMass / mass);
    }
    if (!active) break;
  }
  let maxPenetration = 0;
  for (const [i, j] of pairs(sorted)) if (verticalOverlap(sorted[i], sorted[j])) {
    maxPenetration = Math.max(maxPenetration, sorted[i].radius + sorted[j].radius - Math.hypot(sorted[i].x - sorted[j].x, sorted[i].z - sorted[j].z));
  }
  const byId = new Map(sorted.map(body => [body.id, body]));
  return { bodies: bodies.map(body => byId.get(body.id)), iterations: used, maxPenetration, ...(options.trace ? { trace } : {}),
    unresolved: sorted.some(body => deepest(world, body).depth > SKIN * 2) };
}

/** Authoritative external force; no damage/status/UI logic. XZ centre stays fixed. */
export function pullActors(world, bodies, center, dt, options = {}) {
  point(center); uniqueIds(bodies);
  const radius = positive(options.radius ?? 6, 'pull.radius');
  const speed = positive(options.speed ?? 4, 'pull.speed', true);
  const coreRadius = positive(options.coreRadius ?? .7, 'pull.coreRadius', true);
  const acceptedDt = Math.min(.1, Number.isFinite(dt) ? Math.max(0, dt) : 0);
  const affectedIds = [], motion = [], trace = [];
  const ordered = bodies.map(body => ({ ...body, ...actorBody(world, body) })).sort(compareId);
  for (const body of ordered) {
    const dx = center.x - body.x, dz = center.z - body.z, distance = Math.hypot(dx, dz);
    const pullScale = Math.min(1, positive(body.pullScale ?? 1, 'pullScale', true));
    if (body.dead || body.inverseMass === 0 || distance > radius || acceptedDt === 0 || pullScale === 0) continue;
    affectedIds.push(body.id);
    // Ease to the core and never overshoot it, even after a delayed frame.
    const gap = Math.max(0, distance - Math.max(coreRadius, body.radius));
    const amount = Math.min(speed * acceptedDt * pullScale, gap * (1 - Math.exp(-8 * acceptedDt * pullScale)));
    let result = moveActor(world, body, { x: distance > EPS ? dx / distance * amount : 0,
      z: distance > EPS ? dz / distance * amount : 0 }, { trace: options.trace });
    // Sweep against the current crowd before applying the external force. Merely
    // pulling everyone into the same point then separating them re-injects deep
    // overlap every frame and makes a dense gravity field visibly churn.
    let fraction = 1;
    for (const other of ordered) {
      if (other === body || other.dead || !verticalOverlap(body, other)) continue;
      const hit = shapeSweep({ shape: 'circle', x: other.x, z: other.z, radius: other.radius }, body, result, body.radius, false);
      if (hit) fraction = Math.min(fraction, hit.t);
    }
    if (fraction < 1) result = moveActor(world, body, { x: (result.x - body.x) * fraction, z: (result.z - body.z) * fraction }, { trace: options.trace });
    if (options.trace) trace.push(...result.trace.map(segment => ({ id: body.id, ...segment })));
    motion.push({ id: body.id, blocked: result.blocked, recovery: result.recovery });
    body.x = result.x; body.y = result.y; body.z = result.z;
  }
  const byId = new Map(ordered.map(body => [body.id, body]));
  const moved = bodies.map(body => byId.get(body.id));
  if (!acceptedDt) return { bodies: bodies.map(body => ({ ...body })), affectedIds, motion, dt: 0, maxPenetration: 0, unresolved: false };
  // Enough relaxation for the pull rate; every correction still sweeps props.
  const separated = separateActors(world, moved, { iterations: options.iterations ?? 8,
    maxCorrection: .2, maxTotalCorrection: Math.max(.1, speed * acceptedDt * 2), slop: .001, trace: options.trace });
  return { ...separated, affectedIds, motion, dt: acceptedDt, ...(options.trace ? { trace: trace.concat(separated.trace) } : {}) };
}
