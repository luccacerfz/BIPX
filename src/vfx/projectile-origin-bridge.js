// Presentation only. Authoritative events and contacts are never modified.
export function createProjectileOriginBridge({ THREE, sweepVisual, skillId, projectileRadius, clampMuzzleLead = false }) {
  const source = new THREE.Vector3(), socket = new THREE.Vector3(), offset = new THREE.Vector3();
  const previous = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3(), aim = new THREE.Vector3();
  // The extra key exists only for opted-in skills so the cannon's output object stays deep-equal to its contract.
  const output = clampMuzzleLead ? { origin: from, target: to, resetTrail: false, hideBody: false } : { origin: from, target: to, resetTrail: false };
  const valid = p => p && [p.x, p.y, p.z].every(Number.isFinite);
  const clamp = n => Math.max(0, Math.min(1, n));
  const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
  let enabled = false, launchBlocked = false, converging = false, abandoned = false, castId = null, queries = 0, errors = 0, clipped = 0;
  let settleDistance = 3.2, progress = 0, forward = 0, fallback = 'no-release';

  function reset() {
    enabled = launchBlocked = converging = abandoned = false; castId = null; queries = errors = clipped = progress = forward = 0; aim.set(0, 0, 0);
    source.set(0, 0, 0); socket.set(0, 0, 0); offset.set(0, 0, 0); previous.set(0, 0, 0);
    fallback = 'no-release'; output.resetTrail = false; if (clampMuzzleLead) output.hideBody = false;
  }
  function query(a, b, phase) {
    queries++;
    try {
      const hit = sweepVisual({ x: a.x, y: a.y, z: a.z }, { x: b.x, y: b.y, z: b.z }, projectileRadius,
        { skillId, castId, authorityY: source.y, phase });
      if (hit === null) return null;
      if (!hit || !Number.isFinite(hit.t) || hit.t < 0 || hit.t > 1) throw new Error('Invalid visual sweep fraction');
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
    // Guards read the COMPLETE source→socket distance, before any decomposition: an aligned but distant
    // emitter is as untrustworthy as a lateral one.
    const reach = offset.length();
    if (reach > 3 || (event.ageMs || 0) > 250) { fallback = 'stale-or-distant-socket'; return; }
    settleDistance = Math.max(3.2, reach * 2);
    if (query(source, socket, 'launch') !== null) {
      launchBlocked = true; if(!errors)fallback = 'blocked-socket'; previous.copy(source); return;
    }
    // The muzzle sits ahead of the authoritative origin. Keep that lead as a separate scalar so the
    // visual body never runs ahead of an authority that has not yet reached the mouth.
    if (clampMuzzleLead && valid({ x: event.direction?.x, y: 0, z: event.direction?.z }) && Math.hypot(event.direction.x, event.direction.z) > 1e-6) {
      aim.set(event.direction.x, 0, event.direction.z).normalize(); forward = Math.max(0, offset.dot(aim)); offset.addScaledVector(aim, -forward);
    }
    enabled = converging = true; fallback = null;
  }
  function prepare(event) {
    // Cast origin is ground-level in the core; this probe uses the canonical
    // projectile collision height without changing the event or authority.
    release({ ...event, origin: { ...event.origin, y: 1.05 } });
    if (enabled) fallback = 'awaiting-release';
    enabled = converging = false;
  }
  function abandon(event, reason) {
    enabled = converging = false; abandoned = true;
    if (!errors) fallback = reason;
    // Do not draw the disconnected segment or keep a second projectile stalled
    // at the visual obstacle. The authority already resolved this endpoint.
    from.copy(event.target); to.copy(event.target); previous.copy(to);
    output.resetTrail = true; if (clampMuzzleLead) output.hideBody = false; return output;
  }
  function travel(event) {
    output.resetTrail = false; if (clampMuzzleLead) output.hideBody = false;
    if (!enabled) { from.copy(event.origin); to.copy(event.target); return output; }
    // Network gaps cannot be bridged by a newly invented visual segment.
    if (Math.hypot(event.target.x - event.origin.x, event.target.y - event.origin.y, event.target.z - event.origin.z) > 8) {
      return abandon(event, 'segment-gap');
    }
    from.copy(previous); to.copy(event.target);
    progress = Math.hypot(event.target.x - source.x, event.target.z - source.z);
    // An authoritative stop before the mouth (wall or body at point-blank) cannot be drawn from the muzzle
    // without showing the body beyond the contact: present only the real endpoint.
    if (event.terminal && forward > 0 && progress < forward - 1e-6) return abandon(event, 'terminal-before-muzzle');
    if (!event.terminal) { to.addScaledVector(offset, 1 - smooth(progress / settleDistance)); if (forward > progress) { to.addScaledVector(aim, forward - progress); output.hideBody = true; } } // still inside the barrel: no body is drawn ahead of the authority
    if (to.distanceToSquared(event.target) > 1e-10) {
      const t = query(event.target, to, 'offset');
      if (t !== null) { clipped++; return abandon(event, 'blocked-offset'); }
    }
    // A coarse step may land past settleDistance while its origin is still
    // displaced. Sweep that final link too; a blocked link abandons the bridge
    // instead of holding the visual projectile at the obstacle indefinitely.
    if (from.distanceToSquared(to) > 1e-10 && (converging || to.distanceToSquared(event.target) > 1e-10 || event.terminal)) {
      const t = query(from, to, 'segment');
      if (t !== null && t < 1 - 1e-5) {
        clipped++;
        return abandon(event, event.terminal ? 'blocked-terminal-link' : 'blocked-segment');
      }
    }
    if(!enabled)return abandon(event, 'invalid-sweep');
    converging = enabled && to.distanceToSquared(event.target) > 1e-10;
    previous.copy(to); return output;
  }
  function getStats() {
    return { enabled, launchBlocked, converging, abandoned, fallback, queries, errors, clipped, progress, settleDistance,
      source: source.toArray(), socket: socket.toArray(), offset: offset.toArray(), ...(clampMuzzleLead ? { forward } : {}) };
  }
  reset();
  return { release, prepare, travel, reset, getStats, get launchBlocked() { return launchBlocked; }, get abandoned() { return abandoned; } };
}
