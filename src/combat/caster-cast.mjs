// PROPOSAL ONLY. Pure, synchronous, JSON state; no clock, RNG, renderer or I/O.
// Numeric timing from lich-mixamo-cast-v1; no asset dependency in this core.
export const CASTER_CAST_TIMING = Object.freeze({ duration: 1.10, releaseAt: 1.10 * 19 / 35 });
const VERSION = 1;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const validId = value => (typeof value === 'string' && value.length > 0) ||
  (Number.isSafeInteger(value) && value >= 0);
const validIndex = value => Number.isSafeInteger(value) && value >= 0;
const validTime = value => Number.isFinite(value) && value >= 0;
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.z)
  ? { x: value.x, z: value.z } : null;
const live = state => state.cast && state.cast.phase !== 'end';
const result = (state, events = [], accepted = true, reason = null) => ({ state, events, accepted, reason });

export function casterCastId(worldEpoch, actorId, sequence) {
  if (!validId(worldEpoch) || !validId(actorId) || !validIndex(sequence) || sequence < 1)
    throw new TypeError('Cast identity requires world epoch, monster ID and positive sequence');
  return JSON.stringify([worldEpoch, actorId, sequence]);
}

export function createCasterCastState({ worldEpoch, actorId, actorType = 'caster' }) {
  if (!validId(worldEpoch) || !validId(actorId) || actorType !== 'caster')
    throw new TypeError('Runtime actor type must be caster; lich is only a visual asset');
  return { version: VERSION, worldEpoch, actorId, actorType, sequence: 0,
    revision: 0, lastTick: -1, paused: false, cast: null };
}

function actorFailure(state, actor) {
  if (!actor || actor.present !== true) return 'removed';
  if (actor.id !== state.actorId || actor.type !== state.actorType) return 'actor-mismatch';
  if (actor.alive !== true) return 'death';
  if (actor.frozen === true) return 'freeze';
  if (actor.stunned === true) return 'stun';
  if (!point(actor.position)) return 'invalid-origin';
  return null;
}

function targetFailure(target, expectedId, expectedLifeId) {
  if (!target || target.present !== true || target.alive !== true || !validId(target.id)) return 'target-unavailable';
  if (target.lifeId !== undefined && !validId(target.lifeId)) return 'invalid-target-life';
  if (expectedId !== undefined && target.id !== expectedId) return 'target-mismatch';
  if (expectedLifeId !== undefined && target.lifeId !== expectedLifeId) return 'target-life-changed';
  if (!point(target.position)) return 'invalid-target';
  return null;
}

function event(state, phase, at, extra = {}) {
  const cast = state.cast;
  return { eventId: JSON.stringify([cast.castId, phase]), phase,
    worldEpoch: state.worldEpoch, actorId: state.actorId, actorType: state.actorType,
    castId: cast.castId, sequence: cast.sequence, revision: state.revision,
    targetId: cast.targetId, elapsed: at, duration: cast.duration, releaseAt: cast.releaseAt,
    direction: { ...cast.direction }, released: cast.released, ...extra };
}

/** caller supplies readiness/range/LOS already evaluated from its own policy. */
export function prepareCasterCast(state, input) {
  const { sequence, actor, target, ready, inRange, losClear, paused = false } = input;
  if (!validIndex(sequence) || sequence !== state.sequence + 1)
    return result(state, [], false, 'stale-or-invalid-sequence');
  if (live(state)) return result(state, [], false, 'busy');
  if (paused) return result(state, [], false, 'paused');
  const failure = actorFailure(state, actor) || targetFailure(target);
  if (failure) return result(state, [], false, failure);
  if (ready !== true) return result(state, [], false, 'cooldown');
  if (inRange !== true) return result(state, [], false, 'range');
  if (losClear !== true) return result(state, [], false, 'line-of-sight');
  const dx = target.position.x - actor.position.x, dz = target.position.z - actor.position.z;
  const length = Math.hypot(dx, dz);
  if (!Number.isFinite(length) || length <= 1e-9) return result(state, [], false, 'zero-direction');
  const next = { ...state, sequence, revision: state.revision + 1, paused: false,
    cast: { castId: casterCastId(state.worldEpoch, state.actorId, sequence), sequence,
      phase: 'prepare', elapsed: 0, ...CASTER_CAST_TIMING,
      targetId: target.id, ...(target.lifeId === undefined ? {} : { targetLifeId: target.lifeId }),
      direction: { x: dx / length, z: dz / length },
      preparedOrigin: point(actor.position), releaseOrigin: null,
      released: false, cancelReason: null, endReason: null } };
  return result(next, [event(next, 'prepare', 0, { origin: point(actor.position) })]);
}

function endCancelled(state, reason) {
  const next = { ...state, revision: state.revision + 1,
    cast: { ...state.cast, phase: 'end', cancelReason: reason, endReason: 'cancelled' } };
  // A previous projectile is deliberately not referenced/deleted here.
  return result(next, [event(next, 'cancel', next.cast.elapsed, { reason }),
    event(next, 'end', next.cast.elapsed, { reason: 'cancelled', cancelReason: reason })]);
}

/** Explicit lifecycle cancellation is scoped to an identity, never a player. */
export function cancelCasterCast(state, { castId, reason = 'cancelled' }) {
  if (!live(state) || state.cast.castId !== castId) return result(state, [], false, 'inactive-or-stale-cast');
  if (typeof reason !== 'string' || !reason.length) throw new TypeError('Cancellation requires a reason');
  return endCancelled(state, reason);
}

/**
 * Exactly one call/monster/world tick. dt is SIMULATION seconds, including long
 * ticks, not wall-clock time. Context is fresh at the crossing of release.
 * Actor controls take precedence over a release in the same tick, even paused.
 */
export function advanceCasterCast(state, { tick, dt, actor, target, inRange, losClear, paused = false }) {
  if (!validIndex(tick) || !validTime(dt)) throw new TypeError('Finite nonnegative dt and integer world tick required');
  if (tick <= state.lastTick) return result(state, [], false, 'stale-or-duplicate-tick');
  let next = { ...state, lastTick: tick, revision: state.revision + 1, paused: Boolean(paused) };
  if (!live(next)) return result(next);
  const failure = actorFailure(next, actor);
  if (failure) return endCancelled(next, failure);
  if (paused || dt === 0) return result(next);
  const previousElapsed = next.cast.elapsed;
  const elapsed = Math.min(next.cast.duration, previousElapsed + dt);
  next = { ...next, cast: { ...next.cast, elapsed } };
  const events = [];
  if (!next.cast.released && elapsed >= next.cast.releaseAt) {
    const releaseFailure = targetFailure(target, next.cast.targetId, next.cast.targetLifeId) ||
      (inRange !== true ? 'range' : losClear !== true ? 'line-of-sight' : null);
    if (releaseFailure) {
      // Crossing failed at the marker, not after a fictional release/end.
      next.cast.elapsed = next.cast.releaseAt;
      return endCancelled(next, releaseFailure);
    }
    next.cast = { ...next.cast, phase: 'release', released: true, releaseOrigin: point(actor.position) };
    events.push(event(next, 'release', next.cast.releaseAt, {
      origin: point(actor.position),
      releaseOffsetInStep: Math.max(0, next.cast.releaseAt - previousElapsed),
      remainderAfterRelease: Math.max(0, dt - (next.cast.releaseAt - previousElapsed)),
    }));
  }
  if (elapsed >= next.cast.duration) {
    next.cast = { ...next.cast, phase: 'end', endReason: 'completed' };
    events.push(event(next, 'end', next.cast.duration, { reason: 'completed' }));
  }
  return result(next, events);
}

/** Age at authority sampling; serialize this once and fan it out to all peers. */
export function casterCastSnapshot(state) {
  return copy(state);
}

function validSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== VERSION || snapshot.actorType !== 'caster' ||
      !validId(snapshot.worldEpoch) || !validId(snapshot.actorId) ||
      !validIndex(snapshot.sequence) || !validIndex(snapshot.revision) ||
      !Number.isSafeInteger(snapshot.lastTick) || snapshot.lastTick < -1 ||
      typeof snapshot.paused !== 'boolean') return false;
  const c = snapshot.cast;
  if (c === null) return snapshot.sequence === 0;
  if (!c || c.sequence !== snapshot.sequence || c.sequence < 1 ||
      c.castId !== casterCastId(snapshot.worldEpoch, snapshot.actorId, c.sequence) ||
      c.duration !== CASTER_CAST_TIMING.duration || c.releaseAt !== CASTER_CAST_TIMING.releaseAt ||
      !validTime(c.elapsed) || c.elapsed > c.duration || !validId(c.targetId) ||
      !point(c.direction) || Math.abs(Math.hypot(c.direction.x, c.direction.z) - 1) > 1e-9 ||
      !point(c.preparedOrigin) || (c.targetLifeId !== undefined && !validId(c.targetLifeId)) || typeof c.released !== 'boolean' ||
      !['prepare', 'release', 'end'].includes(c.phase)) return false;
  if (c.released && (!point(c.releaseOrigin) || c.elapsed < c.releaseAt)) return false;
  if (c.phase === 'prepare') return !c.released && c.elapsed < c.releaseAt && c.cancelReason === null && c.endReason === null;
  if (c.phase === 'release') return c.released && c.elapsed < c.duration && c.cancelReason === null && c.endReason === null;
  return c.endReason === 'completed'
    ? c.released && c.elapsed === c.duration && c.cancelReason === null
    : c.endReason === 'cancelled' && typeof c.cancelReason === 'string' && c.cancelReason.length > 0;
}

/** Presentation receiver only: snapshots never turn into projectile/events. */
export function acceptCasterCastSnapshot(previous, incoming, { worldEpoch, actorId }) {
  const reject = reason => ({ snapshot: previous, accepted: false, reason, events: [] });
  if (!validSnapshot(incoming)) return reject('invalid-snapshot');
  if (incoming.worldEpoch !== worldEpoch || incoming.actorId !== actorId) return reject('wrong-scope');
  if (previous && previous.worldEpoch === worldEpoch && previous.actorId === actorId) {
    if (incoming.sequence < previous.sequence || incoming.revision <= previous.revision) return reject('stale-snapshot');
    if (incoming.sequence === previous.sequence && previous.cast) {
      const a = previous.cast, b = incoming.cast;
      if (!b || b.castId !== a.castId || b.elapsed < a.elapsed ||
          (a.released && !b.released) || (a.phase === 'end' && b.phase !== 'end') ||
          (a.phase === 'end' && (a.endReason !== b.endReason || a.cancelReason !== b.cancelReason || a.elapsed !== b.elapsed || a.released !== b.released)) ||
          (a.released && (a.releaseOrigin.x !== b.releaseOrigin.x || a.releaseOrigin.z !== b.releaseOrigin.z)) ||
          (a.cancelReason && a.cancelReason !== b.cancelReason) ||
          a.targetId !== b.targetId || a.targetLifeId !== b.targetLifeId ||
          a.direction.x !== b.direction.x || a.direction.z !== b.direction.z)
        return reject('regressive-snapshot');
    }
  }
  return { snapshot: copy(incoming), accepted: true, reason: null, events: [] };
}

/** Extrapolate presentation age only. Never synthesize release/cancel/end. */
export function projectCasterCastSnapshot(snapshot, ageSeconds = 0) {
  if (!validSnapshot(snapshot) || !validTime(ageSeconds)) throw new TypeError('Valid snapshot and finite nonnegative age required');
  const c = snapshot.cast;
  if (!c) return { cast: null, events: [] };
  const elapsed = Math.min(c.duration, c.elapsed + (snapshot.paused || c.phase === 'end' ? 0 : ageSeconds));
  return { cast: { ...copy(c), authoritativeElapsed: c.elapsed, elapsed,
    remaining: Math.max(0, c.duration - elapsed), normalizedTime: elapsed / c.duration,
    visualActive: c.phase !== 'end' && elapsed < c.duration,
    releaseConfirmed: c.released }, events: [] };
}
