import { createCasterLaunchBridge } from './caster-launch-bridge.mjs';

const copy = p => ({ x: p.x, y: p.y, z: p.z });
const valid = p => p && ['x', 'y', 'z'].every(k => Number.isFinite(p[k]));

// Fresh accepted releases are consumed once by a new replica, never by snapshots.
export function createCasterProjectilePresenter({ sweepVisual, now = () => performance.now() }) {
  const pending = new Map(), seen = new Set();
  let attached = new WeakSet();
  function clear() { pending.clear(); seen.clear(); attached = new WeakSet(); }
  function remember({ castId, actorId, origin, emitter, radius, ageMs = 0 }) {
    if (seen.has(castId)) return false;
    if (typeof castId !== 'string' || !castId || !valid(origin) || !valid(emitter) ||
        !Number.isFinite(ageMs) || ageMs < 0 || ageMs > 250 || !(radius > 0)) return false;
    seen.add(castId); while (seen.size > 256) seen.delete(seen.values().next().value);
    const probe = createCasterLaunchBridge({ sweepVisual: (a, b, r, c) => sweepVisual(a, b, r, { ...c, actorId }), radius });
    if (!probe.release({ castId, origin, emitter, ageMs })) return false;
    const time = now();
    for (const [id, entry] of pending) if (time - entry.time + entry.ageMs > 250) pending.delete(id);
    pending.set(castId, { castId, actorId, origin: copy(origin), emitter: copy(emitter), ageMs, time });
    while (pending.size > 128) pending.delete(pending.keys().next().value);
    return true;
  }
  function attach(projectile) {
    if (projectile.sourceType !== 'caster' || !projectile.castId || attached.has(projectile)) return false;
    attached.add(projectile);
    const release = pending.get(projectile.castId); pending.delete(projectile.castId);
    if (!release) return false;
    const bridge = createCasterLaunchBridge({ sweepVisual: (a, b, r, c) => sweepVisual(a, b, r, { ...c, actorId: release.actorId }), radius: projectile.radius });
    const accepted = bridge.release({ ...release, ageMs: release.ageMs + now() - release.time });
    if (!accepted) return false;
    projectile.casterLaunchBridge = bridge;
    // A packet can be interpolated before its first rendered frame. Keep the
    // solver's first sample available to anchor that frame at the exact hand.
    projectile.casterPresentation = { position: copy(release.emitter), from: copy(release.emitter), authority: copy(projectile.mesh.position), bridged: true, resetTrail: false };
    return true;
  }
  function sample(projectile, terminal = false) {
    if (!projectile.casterLaunchBridge) return null;
    const frame = projectile.casterLaunchBridge.sample(projectile.mesh.position, { terminal });
    frame.authority = copy(projectile.mesh.position);
    projectile.casterPresentation = frame;
    if (frame.resetTrail || !projectile.casterTrailProxy) {
      // New weak cadence key breaks continuity without mutating borrowed VFX pools.
      projectile.casterTrailProxy = { sourceType: projectile.sourceType, radius: projectile.radius, color: projectile.color,
        mesh: { position: frame.position }, previousPosition: frame.from };
    } else {
      projectile.casterTrailProxy.mesh.position = frame.position;
      projectile.casterTrailProxy.previousPosition = frame.from;
    }
    return frame;
  }
  function release(projectile) {
    projectile.casterLaunchBridge?.reset();
    delete projectile.casterLaunchBridge; delete projectile.casterPresentation; delete projectile.casterTrailProxy;
  }
  return { remember, attach, sample, release, clear, getStats: () => ({ pending: pending.size, seen: seen.size }) };
}

// Collision and interpolation retain their own coordinates even after render errors.
export function withCasterProjectilePresentation(projectiles, render) {
  const restored = [];
  try {
    for (const projectile of projectiles) {
      if (!projectile.casterPresentation) continue;
      restored.push([projectile.mesh, copy(projectile.mesh.position)]);
      projectile.mesh.position.copy(projectile.casterPresentation.position);
    }
    return render();
  } finally {
    for (const [mesh, position] of restored) {
      mesh.position.copy(position);
      mesh.updateMatrixWorld?.(true);
    }
  }
}
