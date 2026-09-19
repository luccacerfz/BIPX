import { moveActor, sweepStatic } from './contacts.mjs';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (a, b) => { const d = distance(a, b); return d > 1e-8 ? { x: (b.x - a.x) / d, z: (b.z - a.z) / d } : { x: 0, z: 0 }; };
const clear = (world, a, b, body) => !sweepStatic(world, a, b, body.radius, { kind: 'actor', y: body.y ?? world.groundY, height: body.height ?? 2 });
function navigationTelemetry(result, trace) {
  if (!trace) return result;
  try { trace.sink({ ...trace.context, ...result, durationMs: performance.now() - trace.startedAt }); } catch { /* Diagnostics must never affect gameplay. */ }
  return result;
}
const quantize = value => Math.round(value * 2) / 2;
function failedPlanKey(body, target, options, region) {
  const attack = region ? `${region.range}:${region.minDistance}:${region.losY}` : '-';
  return [body.id ?? 'actor', quantize(body.x), quantize(body.z), quantize(target.x), quantize(target.z),
    options.cellSize ?? 1.25, options.arrivalRadius ?? 0, attack].join('|');
}
function failedPlanMatches(failure, body, target, options, region) {
  return failure.bodyX === quantize(body.x) && failure.bodyZ === quantize(body.z) &&
    failure.targetX === quantize(target.x) && failure.targetZ === quantize(target.z) &&
    failure.cellSize === (options.cellSize ?? 1.25) && failure.arrivalRadius === (options.arrivalRadius ?? 0) &&
    failure.attackRange === (region?.range ?? null) && failure.attackMinDistance === (region?.minDistance ?? null) &&
    failure.attackLosY === (region?.losY ?? null);
}
function failedPlanBackoff(attempts) {
  // A failed search is still allowed to recover when the actor/target moves,
  // but repeated identical failures must not spend 768-node A* budgets every
  // ~700 ms. The cap keeps the fallback steering responsive.
  return Math.min(2.5, .35 * 2 ** Math.min(Math.max(0, attempts - 1), 3));
}
function planningInterval(id) {
  let hash = 2166136261;
  for (const char of String(id ?? 'actor')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return .65 + (hash >>> 0) / 4294967296 * .35;
}

function attackRegion(options) {
  const region = options.attackRegion;
  if (!region) return null;
  if (!Number.isFinite(region.range) || region.range <= 0 || region.range > 5 ||
      !Number.isFinite(region.minDistance) || region.minDistance < 0 || region.minDistance >= region.range ||
      !Number.isFinite(region.losY)) throw new RangeError('Invalid attackRegion');
  return region;
}
function inAttackRegion(world, position, target, region) {
  const separation = distance(position, target);
  return separation >= region.minDistance && separation <= region.range && !sweepStatic(world,
    { ...position, y: region.losY }, { ...target, y: region.losY }, 0);
}
function attackTerminals(world, body, target, region) {
  const radii = [region.range - Math.min(.05, (region.range - region.minDistance) / 4),
    (region.range + region.minDistance) / 2];
  const poses = [];
  for (const radius of radii) for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, pose = { x: target.x + Math.cos(angle) * radius, z: target.z + Math.sin(angle) * radius };
    const valid = moveActor(world, { ...body, ...pose }, { x: 0, z: 0 });
    if (!valid.unresolved && distance(valid, pose) < 1e-5 && inAttackRegion(world, pose, target, region)) poses.push(pose);
  }
  return poses;
}

class Heap {
  values = [];
  less(a, b) { return a.f < b.f || (a.f === b.f && (a.h < b.h || (a.h === b.h && a.key < b.key))); }
  push(value) {
    const list = this.values; let i = list.length; list.push(value);
    while (i > 0) { const parent = (i - 1) >> 1; if (!this.less(value, list[parent])) break; list[i] = list[parent]; i = parent; }
    list[i] = value;
  }
  pop() {
    const list = this.values, first = list[0], tail = list.pop();
    if (list.length) {
      let i = 0;
      while (i * 2 + 1 < list.length) {
        let child = i * 2 + 1;
        if (child + 1 < list.length && this.less(list[child + 1], list[child])) child++;
        if (!this.less(list[child], tail)) break;
        list[i] = list[child]; i = child;
      }
      list[i] = tail;
    }
    return first;
  }
}

/** Bounded A*, tested segments including diagonals; no corner-cutting or teleports. */
export function findNavigationPath(world, body, target, options = {}) {
  const sink = globalThis.__bipxNavigationTelemetry;
  const trace = typeof sink === 'function' ? { sink, startedAt: performance.now(), context: {
    actorId: body.id ?? null, start: { x: body.x, z: body.z }, target: { x: target.x, z: target.z }, maxVisited: options.maxVisited ?? 768,
  } } : null;
  const cellSize = Math.max(.5, Math.min(3, Number(options.cellSize) || 1.25));
  const maxVisited = Math.max(16, Math.min(4096, Math.floor(options.maxVisited ?? 768)));
  const arrivalRadius = Math.max(0, Math.min(5, options.arrivalRadius ?? 0));
  const region = attackRegion(options);
  const start = { x: body.x, z: body.z }, goal = { x: target.x, z: target.z };
  const validated = moveActor(world, body, { x: 0, z: 0 });
  if (validated.unresolved || distance(validated, start) > 1e-4) return navigationTelemetry({ waypoints: [], reached: false, visited: 0, reason: 'invalid-start' }, trace);
  if (region && inAttackRegion(world, start, goal, region)) return navigationTelemetry({ waypoints: [], reached: true, visited: 0, reason: 'attack-region' }, trace);
  if (clear(world, start, goal, body)) {
    const radius = region ? region.range - Math.min(.05, (region.range - region.minDistance) / 4) : 0;
    const direction = unit(goal, start), endpoint = radius ? { x: goal.x + direction.x * radius, z: goal.z + direction.z * radius } : goal;
    return navigationTelemetry({ waypoints: [endpoint], reached: true, visited: 0, reason: 'direct' }, trace);
  }
  const terminals = region ? attackTerminals(world, body, goal, region) : [];
  const terminal = region ? { sampled: 16, valid: terminals.length, sweeps: 0, sweepLimit: 256, connectorLimit: cellSize * 4 } : null;
  const open = new Heap(), best = new Map(), closed = new Set();
  const startNode = { ...start, key: '@start', g: 0, h: distance(start, goal), parent: null }; startNode.f = startNode.h;
  best.set(startNode.key, startNode); open.push(startNode);
  const freeCache = new Map();
  let visited = 0, end = null;
  const within = (p) => !world.bounds || distance(p, world.bounds) + body.radius <= world.bounds.radius;
  while (open.values.length && visited < maxVisited) {
    const node = open.pop();
    if (closed.has(node.key)) continue;
    closed.add(node.key); visited++;
    if (region) {
      if (inAttackRegion(world, node, goal, region)) { end = node; break; }
      for (const pose of terminals) {
        if (terminal.sweeps >= terminal.sweepLimit) break;
        if (distance(node, pose) > terminal.connectorLimit) continue;
        terminal.sweeps++;
        if (clear(world, node, pose, body)) { end = { ...pose, parent: node }; break; }
      }
      if (end) break;
    } else {
      if (clear(world, node, goal, body)) { end = { ...goal, parent: node }; break; }
      if (arrivalRadius > 0 && distance(node, goal) <= arrivalRadius && !sweepStatic(world,
        { ...node, y: (body.y ?? world.groundY) + 1 }, { ...goal, y: (body.y ?? world.groundY) + 1 }, 0)) { end = node; break; }
    }
    const ix = Math.round(node.x / cellSize), iz = Math.round(node.z / cellSize);
    // Only an isolated off-grid start tries the next ring. All connectors use
    // the same body-radius sweep; ordinary grid expansion stays unchanged.
    for (let ring = 1; ring <= (node.key === '@start' ? 2 : 1); ring++) {
      if (ring === 2 && open.values.length) break;
      for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
        if (ring === 2 && Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        if (!dx && !dz && node.key !== '@start') continue;
        const x = (ix + dx) * cellSize, z = (iz + dz) * cellSize, key = `${ix + dx},${iz + dz}`;
        if (closed.has(key)) continue;
        const p = { x, z };
        if (!within(p)) continue;
        if (!freeCache.has(key)) {
          const test = moveActor(world, { ...body, x, z }, { x: 0, z: 0 });
          freeCache.set(key, !test.unresolved && distance(test, p) < 1e-5);
        }
        if (!freeCache.get(key) || !clear(world, node, p, body)) continue;
        const g = node.g + distance(node, p);
        if (best.has(key) && best.get(key).g <= g + 1e-8) continue;
        const h = distance(p, goal), next = { ...p, key, g, h, f: g + h, parent: node };
        best.set(key, next); open.push(next);
      }
    }
  }
  if (!end) return navigationTelemetry({ waypoints: [], reached: false, visited, reason: visited >= maxVisited ? 'budget' : 'no-route', ...(terminal ? { terminal } : {}) }, trace);
  const chain = [];
  for (let node = end; node?.parent; node = node.parent) chain.push({ x: node.x, z: node.z });
  chain.reverse();
  // Visibility string-pulling keeps few waypoints and a consistent chosen side.
  const waypoints = []; let origin = start, index = 0;
  while (index < chain.length) {
    let far = index;
    for (let i = chain.length - 1; i > index; i--) if (clear(world, origin, chain[i], body)) { far = i; break; }
    origin = chain[far]; waypoints.push(origin); index = far + 1;
  }
  return navigationTelemetry({ waypoints, reached: true, visited, reason: 'route', ...(terminal ? { terminal } : {}) }, trace);
}

/** Caller stores returned `state` per living actor; clear it on spawn/teleport. */
export function getPursuitDirection(world, body, target, previous = null, dt = 0, options = {}) {
  const region = attackRegion(options);
  const elapsed = Math.max(0, Math.min(.1, Number(dt) || 0));
  const state = { waypoints: (previous?.waypoints ?? []).map(p => ({ ...p })), target: previous?.target ? { ...previous.target } : { x: target.x, z: target.z },
    lastPosition: { x: body.x, z: body.z }, cooldown: Math.max(0, (previous?.cooldown ?? 0) - elapsed),
    stuck: previous && distance(body, previous.lastPosition) < .005 ? (previous.stuck ?? 0) + elapsed : 0,
    failedPlan: previous?.failedPlan ? { ...previous.failedPlan } : null,
    visited: 0, reached: previous?.reached ?? true, planned: false, needsPlan: false };
  if (state.failedPlan && !failedPlanMatches(state.failedPlan, body, target, options, region)) {
    // A changed cell/target is a new causal search, not the same failure;
    // never carry the previous exponential delay into the new location.
    state.failedPlan = null;
    state.cooldown = 0;
  }
  if (region && inAttackRegion(world, body, target, region)) return { direction: { x: 0, z: 0 }, state: { ...state, target: { x: target.x, z: target.z }, waypoints: [], cooldown: 0, stuck: 0, failedPlan: null }, mode: 'arrived' };
  if (clear(world, body, target, body)) return { direction: unit(body, target), state: { ...state, target: { x: target.x, z: target.z }, waypoints: [], cooldown: 0, stuck: 0, failedPlan: null }, mode: 'direct' };
  // A movement tick may cover >1 waypoint epsilon: discard any passed waypoint
  // whose successor is visible, so fast actors do not oscillate around corners.
  while (state.waypoints.length && !(region && state.waypoints.length === 1) && distance(body, state.waypoints[0]) < Math.max(.2, (options.speed ?? 6.5) * elapsed * 1.2)) state.waypoints.shift();
  while (state.waypoints.length > 1 && clear(world, body, state.waypoints[1], body)) state.waypoints.shift();
  const targetMoved = previous && distance(target, previous.target) > 1.5;
  const invalid = state.waypoints.length && (!clear(world, body, state.waypoints[0], body) ||
    (region && !inAttackRegion(world, state.waypoints.at(-1), target, region)));
  state.needsPlan = state.cooldown <= 0 && Boolean(!state.waypoints.length || targetMoved || invalid || state.stuck > .6);
  if (state.needsPlan && options.allowPlanning !== false) {
    const path = findNavigationPath(world, body, target, options);
    state.waypoints = path.waypoints; state.visited = path.visited; state.reached = path.reached;
    state.target = { x: target.x, z: target.z };
    if (path.terminal) state.terminal = path.terminal;
    if (path.reached) {
      state.failedPlan = null;
      state.cooldown = planningInterval(body.id);
    } else {
      const attempts = (state.failedPlan?.attempts ?? 0) + 1;
      const key = failedPlanKey(body, target, options, region);
      state.failedPlan = { key, bodyX: quantize(body.x), bodyZ: quantize(body.z), targetX: quantize(target.x), targetZ: quantize(target.z),
        cellSize: options.cellSize ?? 1.25, arrivalRadius: options.arrivalRadius ?? 0,
        attackRange: region?.range ?? null, attackMinDistance: region?.minDistance ?? null, attackLosY: region?.losY ?? null,
        attempts, reason: path.reason, visited: path.visited,
        backoff: failedPlanBackoff(attempts) };
      state.cooldown = Math.max(planningInterval(body.id), state.failedPlan.backoff);
    }
    state.stuck = 0; state.planned = true; state.needsPlan = false;
  }
  // Keep a failed pursuer moving through the regular swept-physics step while
  // the bounded retry is cooling down. This is intentionally only steering;
  // callers still apply stepActor, so a wall can never be crossed.
  if (!state.waypoints.length || !clear(world, body, state.waypoints[0], body)) {
    return { direction: unit(body, target), state, mode: state.failedPlan ? 'fallback' : 'waiting' };
  }
  return { direction: unit(body, state.waypoints[0]), state, mode: 'waypoint' };
}
