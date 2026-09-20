// Server-stamped motion metadata. Generated AFTER physics. Never copied from the client.
// Does not change walk budget, HP, ranking, or skill authority.

export const MOTION_KEYS = Object.freeze(['motionSeq', 'motionTime', 'motionPath', 'motionKind', 'motionSnap', 'motionSpeed', 'motionTruncated']);
// moveActor: 16 recovery iterations + maxSlides clamped to 16 + start vertex.
export const MAX_PATH_POINTS = 33;
// Unconsumed polyline budget across the presentation buffer. Finite; overflow truncates the future tail after keeping a prefix from the current pose.
export const MAX_PENDING_VERTICES = 96;
export const PLAYER_LOCOMOTION_SPEED = 6.5; // src/combat/network-move.mjs
export const SPEED_STACK_BONUS = 0.1; // authority.mjs stats: 1 + stacks.speed * .1
export const MAX_SPEED_STACKS = 4;
export const WAR_CRY_SPEED = 1.15; // class-skills getSkillModifiers buff
export const MAX_WALK_PRESENTATION_SPEED = PLAYER_LOCOMOTION_SPEED * (1 + MAX_SPEED_STACKS * SPEED_STACK_BONUS) * WAR_CRY_SPEED;

function finiteCoord(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pushPoint(points, x, z) {
  const px = finiteCoord(x);
  const pz = finiteCoord(z);
  if (px == null || pz == null) return;
  const last = points.at(-1);
  if (last && Math.hypot(px - last.x, pz - last.z) < 1e-4) return;
  points.push({ x: px, z: pz });
}

function collinear(a, b, c) {
  const abx = b.x - a.x, abz = b.z - a.z, bcx = c.x - b.x, bcz = c.z - b.z;
  const area = abx * bcz - abz * bcx;
  const ab = Math.hypot(abx, abz), bc = Math.hypot(bcx, bcz);
  if (ab < 1e-6 || bc < 1e-6) return true;
  return Math.abs(area) < 1e-5 * ab * bc && abx * bcx + abz * bcz > 0;
}

/** Keep solver vertices from the start. Overflow truncates the future, never [first,...tail] and never a destination chord. */
export function compactPath(trace, from, to) {
  const points = [];
  if (Array.isArray(trace) && trace.length) {
    for (const segment of trace) {
      if (segment?.from) pushPoint(points, segment.from.x, segment.from.z);
      if (segment?.to) pushPoint(points, segment.to.x, segment.to.z);
    }
  } else {
    if (from) pushPoint(points, from.x, from.z);
    if (to) pushPoint(points, to.x, to.z);
  }
  if (!points.length && to) pushPoint(points, to.x, to.z);
  if (points.length <= 2) return { points, truncated: false };
  const kept = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = kept.at(-1);
    const cur = points[i];
    const next = points[i + 1];
    if (!collinear(prev, cur, next)) kept.push(cur);
  }
  kept.push(points.at(-1));
  if (kept.length <= MAX_PATH_POINTS) return { points: kept, truncated: false };
  return { points: kept.slice(0, MAX_PATH_POINTS), truncated: true };
}

export function stripClientMotion(state) {
  if (!state || typeof state !== 'object') return state;
  for (const key of MOTION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(state, key)) delete state[key];
  }
  return state;
}

export function motionEnvelope(state) {
  return {
    motionSeq: Number.isFinite(state?.motionSeq) ? state.motionSeq : null,
    motionTime: Number.isFinite(state?.motionTime) ? state.motionTime : null,
    motionPath: Array.isArray(state?.motionPath) ? state.motionPath : [],
    motionKind: typeof state?.motionKind === 'string' ? state.motionKind : null,
    motionSnap: Boolean(state?.motionSnap),
    motionSpeed: Number.isFinite(state?.motionSpeed) ? state.motionSpeed : null,
    motionTruncated: Boolean(state?.motionTruncated),
  };
}

export function stampAuthoritativeMotion(state, options = {}) {
  if (!state || typeof state !== 'object') return null;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const prevTime = Number.isFinite(state.motionTime) ? state.motionTime : 0;
  const prevSeq = Number.isFinite(state.motionSeq) ? state.motionSeq : 0;
  const to = options.to || { x: state.x, z: state.z };
  const from = options.from || { x: state.x, z: state.z };
  state.motionSeq = prevSeq + 1;
  state.motionTime = Math.max(now, prevTime);
  const packed = compactPath(options.trace, from, to);
  state.motionPath = packed.points;
  state.motionTruncated = Boolean(packed.truncated);
  state.motionKind = options.kind || 'walk';
  state.motionSnap = Boolean(options.snap);
  if (Number.isFinite(options.speed) && options.speed > 0) state.motionSpeed = options.speed;
  else delete state.motionSpeed;
  return motionEnvelope(state);
}
