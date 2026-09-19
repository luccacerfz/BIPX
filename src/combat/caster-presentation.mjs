import { acceptCasterCastSnapshot, projectCasterCastSnapshot } from './caster-cast.mjs';

export function casterVisual(snapshot, age = 0) {
  if (!snapshot) return null;
  const { cast } = projectCasterCastSnapshot(snapshot, age);
  if (!cast) return null;
  // Prediction may approach the release, but cannot pass its pose until the
  // authority confirms it. This preserves a monotonic live mixer while giving
  // the release event its exact socket sample, even after a delayed packet.
  const awaitingRelease = !cast.released && cast.phase === 'prepare' && cast.elapsed >= cast.releaseAt;
  const elapsed = awaitingRelease ? cast.releaseAt : cast.elapsed;
  return { id: cast.castId, sequence: cast.sequence, elapsed,
    duration: cast.duration, impactPhase: cast.releaseAt / cast.duration,
    active: cast.phase !== 'end' && elapsed < cast.duration, awaitingRelease,
    cancelReason: cast.cancelReason, paused: snapshot.paused };
}

// Per-actor presentation inbox. Neither snapshots nor accepted events spawn a
// projectile. Only the authoritative caller may do that. A snapshot consumes
// the phases already represented by its state, including after reconnect.
export function createCasterPresentationInbox(worldEpoch) {
  const actors = new Map(), removed = new Set();
  function receive(snapshot, event = null) {
    if (!snapshot || removed.has(snapshot.actorId)) return { accepted: false, events: [] };
    const prior = actors.get(snapshot.actorId);
    const accepted = acceptCasterCastSnapshot(prior?.snapshot, snapshot, { worldEpoch, actorId: snapshot.actorId });
    const identical = prior && JSON.stringify(prior.snapshot) === JSON.stringify(snapshot);
    if (!accepted.accepted && !(event && identical)) return { accepted: false, events: [] };
    const priorCast = prior?.snapshot.cast;
    const entry = prior || { snapshot: null, consumed: new Set(), age: 0 };
    if (accepted.accepted) { entry.snapshot = accepted.snapshot; entry.age = 0; }
    const cast = entry.snapshot.cast;
    const events = [];
    if (event) {
      const valid = cast && event.worldEpoch === worldEpoch && event.actorId === snapshot.actorId &&
        event.castId === cast.castId && event.sequence === cast.sequence &&
        event.eventId === JSON.stringify([cast.castId, event.phase]) &&
        ['prepare', 'release', 'cancel', 'end'].includes(event.phase) &&
        (event.phase !== 'prepare' || cast.phase === 'prepare') &&
        (event.phase !== 'release' || (cast.released && (cast.phase === 'release' ||
          (accepted.accepted && priorCast?.castId === cast.castId && priorCast.phase !== 'end' && cast.endReason === 'completed')))) &&
        (event.phase !== 'cancel' || Boolean(cast.cancelReason && priorCast)) &&
        (event.phase !== 'end' || Boolean(cast.phase === 'end' && priorCast));
      if (valid && !entry.consumed.has(event.eventId)) {
        entry.consumed.add(event.eventId); events.push(event);
      }
    } else if (cast) {
      const phases = ['prepare', ...(cast.released ? ['release'] : []),
        ...(cast.phase === 'end' ? ['end', ...(cast.cancelReason ? ['cancel'] : [])] : [])];
      for (const phase of phases) entry.consumed.add(JSON.stringify([cast.castId, phase]));
    }
    // At most current and recent events; sequence/revision reject older casts.
    while (entry.consumed.size > 16) entry.consumed.delete(entry.consumed.values().next().value);
    actors.set(snapshot.actorId, entry);
    return { accepted: true, snapshot: entry.snapshot, visual: casterVisual(entry.snapshot, entry.age), events };
  }
  return { receive,
    advance(actorId, dt) {
      const entry = actors.get(actorId); if (!entry) return null;
      entry.age += Math.max(0, Number(dt) || 0);
      return casterVisual(entry.snapshot, entry.age);
    },
    remove(actorId) { actors.delete(actorId); removed.add(actorId); },
    clear() { actors.clear(); removed.clear(); },
  };
}
