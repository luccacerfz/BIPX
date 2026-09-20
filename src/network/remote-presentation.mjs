// Bounded remote peer presentation v8. Pure CPU: no THREE, DOM, or gameplay authority.
// Truncation/overflow gaps are reconciliation edges (vertex.gap), never walkable chords.

import { PLAYER_LOCOMOTION_SPEED as WALK_SPEED, MAX_WALK_PRESENTATION_SPEED as WALK_MAX, MAX_PENDING_VERTICES as PENDING_MAX } from './authoritative-motion.mjs';

export const LEGACY_CHASE_BASE = 0.0008;
export const INTERP_DELAY_MS = 50;
export const SETTLE_BUDGET_MS = 100;
export const MAX_BUFFER_MS = 400;
export const MAX_SNAPSHOTS = 32;
export const MAX_RETIRED_IDS = 32;
export const TELEPORT_M = 3.5;
export const HOLD_AFTER_MS = 250;
export const PLAYER_LOCOMOTION_SPEED = WALK_SPEED;
export const MAX_WALK_PRESENTATION_SPEED = WALK_MAX;
export const MAX_CATCH_UP_DT = 0.25;
export const MAX_PENDING_VERTICES = PENDING_MAX;
// warrior_cleaving_dash: range 8 + dashRange max 3, travelTime 0.36. Not a 12 m/s gameplay cap.
export const MAX_SKILL_PRESENTATION_SPEED = 11 / 0.36;

export function legacyMoveAlpha(dt) {
  const seconds = Math.max(0, Number(dt) || 0);
  return 1 - Math.pow(LEGACY_CHASE_BASE, seconds);
}

export function legacyChase(x, z, targetX, targetZ, dt) {
  const alpha = legacyMoveAlpha(dt);
  return { x: x + (targetX - x) * alpha, z: z + (targetZ - z) * alpha, alpha };
}

export function legacyTimeConstantMs() {
  return -1000 / Math.log(LEGACY_CHASE_BASE);
}

export function legacyStepResponseMs(fraction) {
  return 1000 * Math.log(1 - fraction) / Math.log(LEGACY_CHASE_BASE);
}

function hypot(dx, dz) {
  return Math.hypot(dx, dz);
}

export function isObservedNumber(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return false;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n);
}

export function asCoord(value) {
  if (!isObservedNumber(value)) return null;
  return typeof value === 'number' ? value : Number(value);
}

function hypotSafe(dx, dz) {
  return Math.hypot(dx, dz);
}

function retireAdd(set, value) {
  if (value == null) return;
  set.add(value);
  while (set.size > MAX_RETIRED_IDS) {
    const first = set.values().next().value;
    set.delete(first);
  }
}

export function readRemoteStateMeta(state, { partial = false } = {}) {
  return {
    runId: typeof state?.runId === 'string' && state.runId ? state.runId : null,
    epoch: state?.worldEpoch == null && state?.epoch == null ? null : (state.worldEpoch ?? state.epoch),
    stateVersion: isObservedNumber(state?.stateVersion) ? Number(state.stateVersion) : null,
    serverTime: isObservedNumber(state?.serverTime) ? Number(state.serverTime) : null,
    motionSeq: isObservedNumber(state?.motionSeq) ? Number(state.motionSeq) : null,
    motionTime: isObservedNumber(state?.motionTime) ? Number(state.motionTime) : null,
    motionPath: Array.isArray(state?.motionPath) ? state.motionPath : null,
    motionKind: typeof state?.motionKind === 'string' ? state.motionKind : null,
    motionSnap: Boolean(state?.motionSnap),
    motionSpeed: isObservedNumber(state?.motionSpeed) && Number(state.motionSpeed) > 0 ? Number(state.motionSpeed) : null,
    motionTruncated: Boolean(state?.motionTruncated),
    lifecycle: typeof state?.state === 'string' ? state.state : null,
    partial: Boolean(partial),
    source: partial ? 'partial' : 'player-state',
  };
}

function sanitizePath(path, x, z, { truncated = false } = {}) {
  const points = [];
  if (Array.isArray(path)) {
    for (const point of path) {
      const px = asCoord(point?.x);
      const pz = asCoord(point?.z);
      if (px == null || pz == null) continue;
      const last = points.at(-1);
      if (last && hypotSafe(px - last.x, pz - last.z) < 1e-6) continue;
      points.push({ x: px, z: pz });
    }
  }
  const fx = asCoord(x);
  const fz = asCoord(z);
  if (fx != null && fz != null && !truncated) {
    const last = points.at(-1);
    if (!last || hypotSafe(fx - last.x, fz - last.z) > 1e-6) points.push({ x: fx, z: fz });
    if (!points.length) points.push({ x: fx, z: fz });
  } else if (!points.length && fx != null && fz != null) {
    points.push({ x: fx, z: fz });
  }
  return points;
}

export function continuousEdges(path) {
  const edges = [];
  if (!Array.isArray(path)) return edges;
  for (let i = 1; i < path.length; i++) {
    if (path[i].gap) continue;
    edges.push({ a: { x: path[i - 1].x, z: path[i - 1].z }, b: { x: path[i].x, z: path[i].z } });
  }
  return edges;
}

export function pathLength(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    if (path[i].gap) continue;
    length += hypotSafe(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
  }
  return length;
}

export function nearestOnPath(path, x, z) {
  if (!Array.isArray(path) || !path.length) return { x, z, traveled: 0, dist: 0 };
  let best = { x: path[0].x, z: path[0].z, traveled: 0, dist: hypotSafe(x - path[0].x, z - path[0].z) };
  let traveled = 0;
  for (let i = 1; i < path.length; i++) {
    const ax = path[i - 1].x, az = path[i - 1].z, bx = path[i].x, bz = path[i].z;
    const abx = bx - ax, abz = bz - az;
    const len = hypotSafe(abx, abz);
    const t = len > 1e-9 ? Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (len * len))) : 0;
    const px = ax + abx * t, pz = az + abz * t;
    const d = hypotSafe(x - px, z - pz);
    if (d < best.dist) best = { x: px, z: pz, traveled: traveled + t * len, dist: d };
    traveled += len;
  }
  return best;
}

export function concatSnapshotPath(snapshots) {
  const points = [];
  for (const snap of snapshots) {
    const path = snap.path?.length ? snap.path : [{ x: snap.x, z: snap.z }];
    for (const point of path) {
      const last = points.at(-1);
      if (!last || hypotSafe(point.x - last.x, point.z - last.z) > 1e-6) points.push({ x: point.x, z: point.z });
    }
  }
  return points;
}

export function pointAlongPath(path, distance) {
  if (!Array.isArray(path) || !path.length) return null;
  if (distance <= 0) return { x: path[0].x, z: path[0].z, traveled: 0 };
  let left = distance;
  let traveled = 0;
  for (let i = 1; i < path.length; i++) {
    if (path[i].gap) continue;
    const step = hypotSafe(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    if (left <= step) {
      const u = step > 1e-9 ? left / step : 1;
      return {
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * u,
        z: path[i - 1].z + (path[i].z - path[i - 1].z) * u,
        traveled: traveled + left,
      };
    }
    left -= step;
    traveled += step;
  }
  const last = path.filter((p, i) => i === 0 || !p.gap).at(-1) || path.at(-1);
  return { x: last.x, z: last.z, traveled };
}

export function motionFromPlayerState(state) {
  const meta = readRemoteStateMeta(state, { partial: false });
  const x = asCoord(state?.x) ?? 0;
  const z = asCoord(state?.z) ?? 0;
  return {
    x, z,
    ...meta,
    path: sanitizePath(state?.motionPath, x, z, { truncated: Boolean(meta.motionTruncated) }),
    speed: meta.motionSpeed,
    truncated: Boolean(meta.motionTruncated),
    snap: Boolean(meta.motionSnap) || meta.motionKind === 'lifecycle',
  };
}

export function motionFromSkillActor(event, envelope = null) {
  const position = event?.actorPosition;
  const source = envelope && typeof envelope === 'object' ? { ...event, ...envelope, actorPosition: position } : event;
  const hasEnvelopeRun = typeof envelope?.runId === 'string' && envelope.runId;
  const meta = readRemoteStateMeta(source, { partial: !hasEnvelopeRun && !(typeof event?.runId === 'string' && event.runId) });
  const x = asCoord(position?.x);
  const z = asCoord(position?.z);
  const path = sanitizePath(envelope?.motionPath ?? event?.motionPath, x, z, { truncated: Boolean(meta.motionTruncated) });
  const hasProtocol = isObservedNumber(envelope?.motionSeq) || Array.isArray(envelope?.motionPath);
  const snap = Boolean(meta.motionSnap) || meta.motionKind === 'lifecycle' || !hasProtocol;
  return {
    x, z,
    ...meta,
    runId: hasEnvelopeRun ? envelope.runId : meta.runId,
    motionTime: isObservedNumber(envelope?.motionTime) ? Number(envelope.motionTime)
      : isObservedNumber(envelope?.serverTime) ? Number(envelope.serverTime)
      : meta.motionTime,
    path,
    speed: meta.motionSpeed,
    snap,
    source: 'skill-actorPosition',
  };
}

export function createRemotePresentation() {
  return {
    snapshots: [],
    render: { x: 0, z: 0 },
    velocity: { x: 0, z: 0 },
    prevVelocity: { x: 0, z: 0 },
    identity: { runId: null, epoch: null },
    retiredRunIds: new Set(),
    retiredEpochs: new Set(),
    initialized: false,
    lastPushMs: 0,
    lastResetReason: null,
    serverOrigin: null,
    localOrigin: null,
    pathCursor: 0,
    playT: null,
    lastKind: 'walk',
    overflow: { truncated: false, events: 0, droppedVertices: 0, snapMeters: 0, folds: 0 },
    pendingVisualReset: null,
  };
}

function stamp(identity, extra, t, x, z, path, kind, snap) {
  return {
    t, x, z, path, kind, snap: Boolean(snap),
    runId: identity?.runId ?? null,
    epoch: identity?.epoch ?? null,
    version: extra.version ?? null,
    serverTime: extra.serverTime ?? null,
    motionSeq: extra.motionSeq ?? null,
    motionTime: extra.motionTime ?? null,
    speed: extra.speed ?? null,
    truncated: Boolean(extra.truncated),
  };
}

export function resetRemotePresentation(state, x, z, nowMs, reason, identity, extra = {}) {
  const nx = asCoord(x) ?? 0;
  const nz = asCoord(z) ?? 0;
  const hadPose = Boolean(state.initialized);
  const prev = state.render || { x: nx, z: nz };
  const t = isObservedNumber(nowMs) ? Number(nowMs) : 0;
  const id = { runId: identity?.runId ?? null, epoch: identity?.epoch ?? null };
  if (state.identity.runId && id.runId && state.identity.runId !== id.runId) {
    retireAdd(state.retiredRunIds, state.identity.runId);
  }
  if (state.identity.epoch != null && id.epoch != null && state.identity.epoch !== id.epoch) {
    retireAdd(state.retiredEpochs, state.identity.epoch);
  }
  const path = extra.path?.length ? extra.path : [{ x: nx, z: nz }];
  state.snapshots = [stamp(id, extra, t, nx, nz, path, extra.kind || 'lifecycle', true)];
  state.render = { x: nx, z: nz };
  state.velocity = { x: 0, z: 0 };
  state.prevVelocity = { x: 0, z: 0 };
  state.identity = id;
  state.initialized = true;
  state.lastPushMs = t;
  state.lastResetReason = reason;
  state.pathCursor = 0;
  state.playT = t;
  state.lastKind = extra.kind || 'lifecycle';
  state.overflow = { truncated: false, events: 0, droppedVertices: 0, snapMeters: 0, folds: 0 };
  state.pendingVisualReset = hadPose
    ? { reason: reason || 'lifecycle', distance: hypotSafe(nx - (prev.x || 0), nz - (prev.z || 0)), reset: true }
    : null;
  if (isObservedNumber(extra.motionTime)) {
    state.serverOrigin = Number(extra.motionTime);
    state.localOrigin = t;
  }
  return { reset: true, reason, x: nx, z: nz };
}

function attachObservedIdentity(state, incoming) {
  if (incoming.runId != null && state.identity.runId == null) state.identity.runId = incoming.runId;
  if (incoming.epoch != null && state.identity.epoch == null) state.identity.epoch = incoming.epoch;
}

function identityDecision(state, incoming) {
  const observed = state.identity;
  if (incoming.runId != null && observed.runId != null && incoming.runId !== observed.runId) {
    if (state.retiredRunIds.has(incoming.runId)) return 'identity-rollback';
    return 'reset-run';
  }
  if (incoming.epoch != null && observed.epoch != null && incoming.epoch !== observed.epoch) {
    if (state.retiredEpochs.has(incoming.epoch)) return 'identity-rollback';
    return 'reset-epoch';
  }
  return 'keep';
}

function olderThan(sample, last) {
  if (sample.motionSeq != null && last.motionSeq != null && sample.motionSeq < last.motionSeq) return true;
  if (sample.version != null && last.version != null && sample.version < last.version) return true;
  if (sample.serverTime != null && last.serverTime != null && sample.serverTime < last.serverTime && sample.motionSeq == null) return true;
  return false;
}

function uniquePath(points) {
  const out = [];
  for (const point of points) {
    if (!point) continue;
    const next = { x: point.x, z: point.z, ...(point.gap ? { gap: true } : {}) };
    const last = out.at(-1);
    if (!last || hypotSafe(next.x - last.x, next.z - last.z) > 1e-6) out.push(next);
  }
  return out;
}

function pathOf(snap) {
  return snap.path?.length ? snap.path : [{ x: snap.x, z: snap.z }];
}

function copyVertex(point) {
  if (!point) return point;
  return { x: point.x, z: point.z, ...(point.gap ? { gap: true } : {}) };
}

/** Keep only the unwalked suffix of `path` after playT on [startT, endT]. First vertex is the live pose. */
function suffixAfterPlayT(path, startT, endT, playT, render) {
  const points = path?.length ? path : [{ x: render.x, z: render.z }];
  const head = { x: render.x, z: render.z };
  const plen = pathLength(points);
  const span = endT - startT;
  if (!(plen > 1e-9) || !(span > 1e-9) || playT <= startT + 1e-9) {
    return uniquePath([head, ...points.map(copyVertex)]);
  }
  if (playT >= endT - 1e-9) return [head];
  const d0 = plen * (playT - startT) / span;
  const suffix = [head];
  let traveled = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].gap) {
      if (traveled + 1e-9 >= d0) suffix.push(copyVertex(points[i]));
      continue;
    }
    const step = hypotSafe(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    const next = traveled + step;
    if (next > d0 + 1e-9) suffix.push(copyVertex(points[i]));
    traveled = next;
  }
  return uniquePath(suffix);
}

function destVertex(snap) {
  return { x: snap.x, z: snap.z, gap: true };
}

function stripTrailingGaps(path) {
  const out = Array.isArray(path) ? path.map(copyVertex) : [];
  while (out.length && out.at(-1).gap) out.pop();
  return out;
}

function foldOldest(state) {
  if (state.snapshots.length < 3) return false;
  const a = state.snapshots[0];
  const b = state.snapshots[1];
  const c = state.snapshots[2];
  const render = { x: state.render.x, z: state.render.z };
  const playT = state.playT ?? a.t;
  const clippedB = suffixAfterPlayT(snapshotPath(a, b), a.t, b.t, playT, render);
  const cPath = pathOf(c);
  const lastB = clippedB.at(-1);
  const firstC = cPath[0];
  const disconnected = Boolean(lastB && firstC && hypotSafe(lastB.x - firstC.x, lastB.z - firstC.z) > 1e-3);
  const needGap = Boolean(b.truncated) || Boolean(c.truncated) || disconnected;
  let merged;
  let truncated = Boolean(b.truncated || c.truncated);
  // Truncation/discontinuity: keep the valid prefix and reconcile to c's dest.
  // Never concatenate the retained tip onto a later remote path as a walkable chord.
  if (needGap) {
    merged = uniquePath([...stripTrailingGaps(clippedB), destVertex(c)]);
    truncated = true;
  } else {
    merged = uniquePath([...clippedB, ...cPath.map(copyVertex)]);
  }
  state.overflow.folds = (state.overflow.folds || 0) + 1;
  if (merged.length > MAX_PENDING_VERTICES) {
    truncated = true;
    const dropped = merged.length - (MAX_PENDING_VERTICES - 1);
    merged = uniquePath([...merged.slice(0, MAX_PENDING_VERTICES - 1), destVertex(c)]);
    state.overflow.events += 1;
    state.overflow.droppedVertices += Math.max(0, dropped);
    state.overflow.truncated = true;
  }
  c.path = merged;
  c.truncated = truncated;
  a.t = playT;
  a.x = render.x;
  a.z = render.z;
  a.path = [render];
  a.truncated = false;
  state.snapshots.splice(1, 1);
  return true;
}

function trimBuffer(state) {
  const cutoff = state.lastPushMs - MAX_BUFFER_MS;
  for (let i = 0; i < 64 && state.snapshots.length > 2 && state.snapshots[1].t < cutoff; i++) {
    if (state.playT != null && state.playT < state.snapshots[1].t) {
      if (!foldOldest(state)) break;
      continue;
    }
    state.snapshots.shift();
  }
  for (let i = 0; i < 64 && state.snapshots.length > MAX_SNAPSHOTS && state.snapshots.length > 2; i++) {
    if (state.playT != null && state.playT < state.snapshots[1].t) {
      if (!foldOldest(state)) break;
      continue;
    }
    state.snapshots.shift();
  }
}

function durationMs(sample, last) {
  const path = sample.path?.length ? sample.path : [{ x: last?.x ?? sample.x, z: last?.z ?? sample.z }, { x: sample.x, z: sample.z }];
  const length = pathLength(path);
  const skill = sample.kind === 'skill';
  const speed = Number.isFinite(sample.speed) && sample.speed > 0
    ? sample.speed
    : (skill ? MAX_SKILL_PRESENTATION_SPEED : PLAYER_LOCOMOTION_SPEED);
  return Math.max(1, 1000 * length / Math.max(speed, 1e-6));
}

function mappedTime(state, motionTime, now) {
  if (!isObservedNumber(motionTime)) return now;
  if (state.serverOrigin == null) {
    state.serverOrigin = Number(motionTime);
    state.localOrigin = now;
  }
  const mapped = state.localOrigin + (Number(motionTime) - state.serverOrigin);
  return mapped > now ? now : mapped;
}

export function segmentHitsAabb(x0, z0, x1, z1, box) {
  const minX = box.x - box.halfX;
  const maxX = box.x + box.halfX;
  const minZ = box.z - box.halfZ;
  const maxZ = box.z + box.halfZ;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const slabs = [[dx, minX - x0, maxX - x0], [dz, minZ - z0, maxZ - z0]];
  for (const [delta, n0, n1] of slabs) {
    if (Math.abs(delta) < 1e-12) {
      if (n0 > 0 || n1 < 0) return false;
      continue;
    }
    let u0 = n0 / delta;
    let u1 = n1 / delta;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return t0 <= t1 && t1 >= 0 && t0 <= 1;
}

export function pushRemoteSnapshot(state, sample, nowMs) {
  const x = asCoord(sample?.x);
  const z = asCoord(sample?.z);
  if (x == null || z == null) return { ignored: true, reason: 'invalid' };
  const incomingNow = asCoord(nowMs);
  if (incomingNow == null) return { ignored: true, reason: 'invalid-clock' };
  const receiveT = Math.max(incomingNow, state.lastPushMs || 0);
  const identity = {
    runId: typeof sample.runId === 'string' && sample.runId ? sample.runId : null,
    epoch: sample.epoch == null || sample.epoch === '' ? null : sample.epoch,
  };
  const extra = {
    version: isObservedNumber(sample.stateVersion) ? Number(sample.stateVersion) : null,
    serverTime: isObservedNumber(sample.serverTime) ? Number(sample.serverTime) : null,
    motionSeq: isObservedNumber(sample.motionSeq) ? Number(sample.motionSeq) : null,
    motionTime: isObservedNumber(sample.motionTime) ? Number(sample.motionTime) : null,
    path: sanitizePath(sample.path ?? sample.motionPath, x, z, { truncated: Boolean(sample.truncated || sample.motionTruncated) }),
    kind: typeof sample.motionKind === 'string' ? sample.motionKind : (sample.kind || 'walk'),
    truncated: Boolean(sample.truncated || sample.motionTruncated),
    speed: isObservedNumber(sample.motionSpeed) && Number(sample.motionSpeed) > 0 ? Number(sample.motionSpeed)
      : (isObservedNumber(sample.speed) && Number(sample.speed) > 0 ? Number(sample.speed) : null),
  };

  if (!state.initialized) {
    return resetRemotePresentation(state, x, z, receiveT, extra.kind === 'lifecycle' || sample.snap ? 'spawn' : 'spawn', identity, extra);
  }

  const decision = identityDecision(state, identity);
  if (decision === 'identity-rollback') return { ignored: true, reason: 'identity-rollback' };
  if (decision === 'reset-run' || decision === 'reset-epoch') {
    return resetRemotePresentation(state, x, z, receiveT, decision === 'reset-run' ? 'identity' : 'epoch', {
      runId: identity.runId ?? state.identity.runId,
      epoch: identity.epoch ?? state.identity.epoch,
    }, extra);
  }
  attachObservedIdentity(state, identity);

  const last = state.snapshots.at(-1);
  if (last && olderThan(extra, last)) return { ignored: true, reason: 'out-of-order' };
  if (last && extra.motionSeq != null && last.motionSeq != null && extra.motionSeq === last.motionSeq
    && hypotSafe(x - last.x, z - last.z) < 1e-6) {
    return { ignored: true, reason: 'duplicate' };
  }
  if (last && extra.motionSeq == null && hypotSafe(x - last.x, z - last.z) < 1e-6
    && extra.version === last.version && extra.serverTime === last.serverTime) {
    return { ignored: true, reason: 'duplicate' };
  }

  const lifecycleSnap = Boolean(sample.snap) || extra.kind === 'lifecycle' || extra.kind === 'reconnect' || extra.kind === 'spawn';
  if (lifecycleSnap) {
    return resetRemotePresentation(state, x, z, receiveT, sample.snap ? 'snap' : extra.kind, state.identity, extra);
  }

  let t = extra.motionTime != null ? mappedTime(state, extra.motionTime, receiveT) : receiveT;
  t = Math.max(t, state.lastPushMs || 0);
  if (last && extra.motionSeq != null && last.motionSeq != null && extra.motionSeq !== last.motionSeq && t <= last.t) {
    t = last.t + durationMs(extra, last);
  } else if (last && extra.motionSeq == null && t === last.t) {
    // No seq: coalesce like v2 only when the protocol is absent.
    const next = stamp(state.identity, extra, t, x, z, extra.path, extra.kind, false);
    state.snapshots[state.snapshots.length - 1] = next;
    state.lastPushMs = t;
    trimBuffer(state);
    return { ignored: false, reset: false, buffered: state.snapshots.length, coalesced: true };
  }

  const next = stamp(state.identity, extra, t, x, z, extra.path, extra.kind, false);
  state.snapshots.push(next);
  state.lastPushMs = t;
  state.lastKind = extra.kind;
  trimBuffer(state);
  return { ignored: false, reset: false, buffered: state.snapshots.length, coalesced: false };
}

function snapshotPath(a, b) {
  let path;
  if (b.path?.length >= 2) path = b.path.map(p => ({ x: p.x, z: p.z, ...(p.gap ? { gap: true } : {}) }));
  else if (b.path?.length === 1 && a) path = [{ x: a.x, z: a.z }, { x: b.path[0].x, z: b.path[0].z }];
  else if (a) path = [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
  else path = [{ x: b.x, z: b.z }];
  if (b.truncated) {
    const last = path.at(-1);
    if (last && hypotSafe(last.x - b.x, last.z - b.z) > 0.02) path.push({ x: b.x, z: b.z, gap: true });
  }
  return path;
}

function sampleAt(state, renderTime) {
  const snaps = state.snapshots;
  if (!snaps.length) return { ...state.render, held: true, kind: state.lastKind, path: [], speed: null };
  if (renderTime <= snaps[0].t) return { x: snaps[0].x, z: snaps[0].z, held: renderTime < snaps[0].t, kind: snaps[0].kind, path: snaps[0].path || [], speed: snaps[0].speed };
  const last = snaps.at(-1);
  if (renderTime >= last.t) return { x: last.x, z: last.z, held: renderTime > last.t, kind: last.kind, path: last.path || [], speed: last.speed };
  let i = 0;
  while (i + 1 < snaps.length && snaps[i + 1].t < renderTime) i += 1;
  const a = snaps[i];
  const b = snaps[i + 1];
  const path = snapshotPath(a, b);
  const span = b.t - a.t;
  const u = span > 1e-6 ? (renderTime - a.t) / span : 1;
  const along = pointAlongPath(path, pathLength(path) * u);
  return { x: along.x, z: along.z, held: false, kind: b.kind || a.kind, path, speed: b.speed ?? a.speed, truncated: Boolean(b.truncated || a.truncated) };
}

function capSpeed(sampled) {
  if ((sampled.kind || 'walk') === 'skill') return MAX_SKILL_PRESENTATION_SPEED;
  const stamped = Number.isFinite(sampled.speed) && sampled.speed > 0 ? sampled.speed : 0;
  return Math.min(MAX_WALK_PRESENTATION_SPEED, Math.max(PLAYER_LOCOMOTION_SPEED, stamped));
}

export function causalLength(state, fromT, toT) {
  const snaps = state.snapshots;
  if (!snaps.length || !(toT > fromT)) return 0;
  let length = 0;
  for (let i = 0; i + 1 < snaps.length; i++) {
    const a = snaps[i];
    const b = snaps[i + 1];
    if (b.t <= fromT || a.t >= toT) continue;
    const path = snapshotPath(a, b);
    const plen = pathLength(path);
    const span = b.t - a.t;
    if (!(span > 1e-9) || !(plen > 0)) continue;
    const t0 = Math.max(fromT, a.t);
    const t1 = Math.min(toT, b.t);
    length += plen * (t1 - t0) / span;
  }
  return length;
}

function firstGapVertex(path) {
  if (!Array.isArray(path)) return null;
  for (let i = 1; i < path.length; i++) {
    if (path[i].gap) return path[i];
  }
  return null;
}

function advanceByLength(state, fromT, toT, maxDistance) {
  const snaps = state.snapshots;
  if (!snaps.length) {
    const sampled = sampleAt(state, toT);
    return { t: toT, x: sampled.x, z: sampled.z, recovered: false, pending: 0, snap: null };
  }
  let t = fromT;
  let left = maxDistance;
  let pos = sampleAt(state, fromT);
  let snap = null;
  for (let i = 0; i + 1 < snaps.length && t < toT - 1e-9 && left > 1e-9; i++) {
    const a = snaps[i];
    const b = snaps[i + 1];
    if (b.t <= t) continue;
    if (a.t >= toT) break;
    const path = snapshotPath(a, b);
    const gapVertex = firstGapVertex(path);
    const plen = pathLength(path);
    const span = b.t - a.t;
    if (!(span > 1e-9) || !(plen > 0)) {
      t = Math.min(toT, b.t);
      if (gapVertex && hypotSafe(pos.x - gapVertex.x, pos.z - gapVertex.z) > 0.02) {
        const distance = hypotSafe(pos.x - gapVertex.x, pos.z - gapVertex.z);
        state.overflow.snapMeters += distance;
        pos = { x: gapVertex.x, z: gapVertex.z };
        snap = { reason: 'overflow-snap', distance, reset: true };
        return { t, x: pos.x, z: pos.z, recovered: false, pending: causalLength(state, t, toT), snap, unusedBudget: left };
      }
      pos = { x: b.x, z: b.z };
      continue;
    }
    const startT = Math.max(t, a.t);
    const endT = Math.min(toT, b.t);
    const d0 = plen * (startT - a.t) / span;
    const d1 = plen * (endT - a.t) / span;
    const remain = Math.max(0, d1 - d0);
    if (remain <= left) {
      left -= remain;
      t = endT;
      const along = pointAlongPath(path, d1);
      pos = { x: along.x, z: along.z };
      if (gapVertex && hypotSafe(pos.x - gapVertex.x, pos.z - gapVertex.z) > 0.02) {
        const distance = hypotSafe(pos.x - gapVertex.x, pos.z - gapVertex.z);
        state.overflow.snapMeters += distance;
        pos = { x: gapVertex.x, z: gapVertex.z };
        snap = { reason: 'overflow-snap', distance, reset: true };
        return { t, x: pos.x, z: pos.z, recovered: false, pending: causalLength(state, t, toT), snap, unusedBudget: left };
      }
      if (b.truncated && t >= b.t - 1e-9 && hypotSafe(pos.x - b.x, pos.z - b.z) > 0.02) {
        const distance = hypotSafe(pos.x - b.x, pos.z - b.z);
        state.overflow.snapMeters += distance;
        pos = { x: b.x, z: b.z };
        snap = { reason: 'overflow-snap', distance, reset: true };
        const pending = causalLength(state, t, toT);
        return { t, x: pos.x, z: pos.z, recovered: false, pending, snap, unusedBudget: left };
      }
      continue;
    }
    const along = pointAlongPath(path, d0 + left);
    const nextT = a.t + span * (d0 + left) / plen;
    return { t: nextT, x: along.x, z: along.z, recovered: true, pending: remain - left, snap };
  }
  const pending = causalLength(state, t, toT);
  return { t, x: pos.x, z: pos.z, recovered: !snap && pending > 1e-4, pending, snap };
}

export function stepRemotePresentation(state, dt, nowMs) {
  const seconds = Math.max(0, Number(dt) || 0);
  const now = asCoord(nowMs);
  if (!state.initialized || now == null) {
    return { x: state.render.x, z: state.render.z, vx: 0, vz: 0, ax: 0, az: 0, speed: 0, accel: 0, held: true, reset: false, blocked: false, recovered: false };
  }
  const targetT = now - INTERP_DELAY_MS;
  const sampled = sampleAt(state, targetT);
  if (state.playT == null) state.playT = Math.min(targetT, state.snapshots[0]?.t ?? targetT);
  if (seconds <= 0) {
    return {
      x: state.render.x, z: state.render.z, vx: 0, vz: 0, ax: 0, az: 0, speed: 0, accel: 0,
      held: true, reset: false, blocked: false, recovered: false, kind: sampled.kind, cap: 0, playT: state.playT,
      pending: causalLength(state, state.playT, targetT),
    };
  }
  const stepDt = Math.min(seconds, MAX_CATCH_UP_DT);
  const cap = capSpeed({ ...sampled, speed: sampled.speed ?? state.snapshots.at(-1)?.speed });
  const pending = causalLength(state, state.playT, targetT);
  const budget = cap * stepDt;
  const moved = advanceByLength(state, state.playT, targetT, budget);
  state.playT = moved.t;
  const dx = moved.x - state.render.x;
  const dz = moved.z - state.render.z;
  state.prevVelocity.x = state.velocity.x;
  state.prevVelocity.z = state.velocity.z;
  const pushReset = state.pendingVisualReset;
  const snapped = Boolean(moved.snap) || Boolean(pushReset);
  const reconcile = moved.snap || pushReset || null;
  if (pushReset) state.pendingVisualReset = null;
  if (snapped) {
    state.velocity.x = 0;
    state.velocity.z = 0;
  } else {
    state.velocity.x = dx / seconds;
    state.velocity.z = dz / seconds;
  }
  const ax = (state.velocity.x - state.prevVelocity.x) / seconds;
  const az = (state.velocity.z - state.prevVelocity.z) / seconds;
  state.render.x = moved.x;
  state.render.z = moved.z;
  const stillPending = causalLength(state, state.playT, targetT);
  return {
    x: state.render.x,
    z: state.render.z,
    vx: state.velocity.x,
    vz: state.velocity.z,
    ax, az,
    speed: hypot(state.velocity.x, state.velocity.z),
    accel: hypot(ax, az),
    held: Boolean(sampled.held) && stillPending < 1e-4 && !snapped,
    reset: snapped,
    blocked: false,
    recovered: !snapped && stillPending > 1e-4,
    kind: sampled.kind,
    cap,
    playT: state.playT,
    pending: stillPending,
    pendingBefore: pending,
    reason: reconcile?.reason ?? null,
    reconcile,
    unusedBudget: moved.unusedBudget ?? 0,
  };
}

export function disposeRemotePresentation(state) {
  state.snapshots.length = 0;
  state.initialized = false;
  state.lastResetReason = 'dispose';
  state.retiredRunIds.clear();
  state.retiredEpochs.clear();
}

export function applyRemoteMotion(state, motion, nowMs) {
  if (!motion || motion.x == null || motion.z == null) return { ignored: true, reason: 'invalid' };
  return pushRemoteSnapshot(state, motion, nowMs);
}
