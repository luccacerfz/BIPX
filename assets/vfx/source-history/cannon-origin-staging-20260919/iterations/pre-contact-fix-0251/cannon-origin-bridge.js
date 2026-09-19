// Presentation only. Authoritative events and contacts are never modified.
export function createCannonOriginBridge({ THREE, sweepVisual }) {
  const source = new THREE.Vector3(), socket = new THREE.Vector3(), offset = new THREE.Vector3();
  const previous = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
  const output = { origin: from, target: to, resetTrail: false };
  const valid = p => p && [p.x, p.y, p.z].every(Number.isFinite);
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  let enabled = false, launchBlocked = false, castId = null, queries = 0, errors = 0, clipped = 0;
  let settleDistance = 3.2, progress = 0, fallback = 'no-release';

  function reset() {
    enabled = launchBlocked = false; castId = null; queries = errors = clipped = progress = 0;
    source.set(0, 0, 0); socket.set(0, 0, 0); offset.set(0, 0, 0); previous.set(0, 0, 0);
    fallback = 'no-release'; output.resetTrail = false;
  }
  function query(a, b, phase) {
    queries++;
    try {
      const hit = sweepVisual({ x: a.x, y: a.y, z: a.z }, { x: b.x, y: b.y, z: b.z }, .32,
        { skillId: 'dwarf_explosive_cannon', castId, authorityY: source.y, phase });
      if (hit == null) return null;
      if (!Number.isFinite(hit.t) || hit.t < 0 || hit.t > 1) throw new Error('Invalid visual sweep fraction');
      return hit.t;
    } catch {
      errors++; enabled=false; launchBlocked=true; fallback='invalid-sweep'; return 0; // Fail closed; a bad query cannot authorize a visual crossing.
    }
  }
  function release(event) {
    reset(); castId = event.castId;
    if (!valid(event.origin) || !valid(event.emitter)) { fallback = 'missing-socket'; return; }
    source.copy(event.origin); socket.copy(event.emitter); offset.subVectors(socket, source); previous.copy(socket);
    if (typeof sweepVisual !== 'function') { fallback = 'missing-sweep'; return; }
    if (offset.length() > 3 || (event.ageMs || 0) > 250) { fallback = 'stale-or-distant-socket'; return; }
    settleDistance = Math.max(3.2, offset.length() * 2);
    if (query(source, socket, 'launch') !== null) {
      launchBlocked = true; if(!errors)fallback = 'blocked-socket'; previous.copy(source); return;
    }
    enabled = true; fallback = null;
  }
  function prepare(event) {
    // Cast origin is ground-level in the core; this probe uses the canonical
    // cannon collision height without changing the event or authority.
    release({ ...event, origin: { ...event.origin, y: 1.05 } });
    enabled = false; if (!launchBlocked) fallback = 'awaiting-release';
  }
  function travel(event) {
    output.resetTrail = false;
    if (!enabled) { from.copy(event.origin); to.copy(event.target); return output; }
    // Network gaps cannot be bridged by a newly invented visual segment.
    if (Math.hypot(event.target.x - event.origin.x, event.target.y - event.origin.y, event.target.z - event.origin.z) > 8) {
      enabled = false; fallback = 'segment-gap'; from.copy(event.target); to.copy(event.target); output.resetTrail = true; return output;
    }
    from.copy(previous); to.copy(event.target);
    progress = Math.hypot(event.target.x - source.x, event.target.z - source.z);
    if (!event.terminal) to.addScaledVector(offset, 1 - smooth(progress / settleDistance));
    if (to.distanceToSquared(event.target) > 1e-10) {
      const t = query(event.target, to, 'offset');
      if (t !== null) { clipped++; to.lerpVectors(event.target, to, Math.max(0, t - .001 / Math.max(.001, to.distanceTo(event.target)))); }
    }
    if (from.distanceToSquared(to) > 1e-10 && (progress <= settleDistance || event.terminal)) {
      const t = query(from, to, 'segment');
      if (t !== null && t < 1 - 1e-5) {
        clipped++;
        if (event.terminal) { from.copy(event.target); to.copy(event.target); output.resetTrail = true; }
        else to.lerpVectors(from, to, Math.max(0, t - .001 / Math.max(.001, from.distanceTo(to))));
      }
    }
    if(!enabled){from.copy(event.target);to.copy(event.target);output.resetTrail=true;}
    previous.copy(to); return output;
  }
  function getStats() {
    return { enabled, launchBlocked, fallback, queries, errors, clipped, progress, settleDistance,
      source: source.toArray(), socket: socket.toArray(), offset: offset.toArray() };
  }
  reset();
  return { release, prepare, travel, reset, getStats, get launchBlocked() { return launchBlocked; } };
}
