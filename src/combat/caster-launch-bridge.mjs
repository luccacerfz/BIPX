// Presentation coordinates only. The caller retains the authoritative body.
const point = p => p && ['x', 'y', 'z'].every(k => Number.isFinite(p[k]));
const copy = p => ({ x: p.x, y: p.y, z: p.z });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function createCasterLaunchBridge({ sweepVisual, radius, authorityY = 1.05 }) {
  if (!(Number.isFinite(radius) && radius > 0)) throw new TypeError('Valid presentation radius required');
  let id = null, source, socket, previous, enabled = false, first = true, progress = 0;
  let fallback = 'no-release', queries = 0;
  function reset() {
    id = null; source = socket = previous = undefined; enabled = false; first = true;
    progress = queries = 0; fallback = 'no-release';
  }
  function blocked(from, to, phase) {
    queries++;
    try {
      const hit = sweepVisual(copy(from), copy(to), radius, { castId: id, authorityY, phase });
      if (hit === null) return false;
      if (!hit || !Number.isFinite(hit.t) || hit.t < 0 || hit.t > 1) throw new Error('Invalid contact');
      return true;
    } catch { fallback = 'invalid-sweep'; return true; }
  }
  function release({ castId, origin, emitter, ageMs = 0 }) {
    // Duplicate release cannot rewind a live or completed bridge.
    if (castId === id && id !== null) return false;
    if (id !== null) return false; // One instance belongs to one projectile until reset/recycle.
    id = castId;
    if (typeof id !== 'string' || !id || !point(origin) || !point(emitter)) { fallback = 'invalid-release'; return false; }
    source = copy(origin); socket = copy(emitter); previous = copy(socket);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 250 || distance(source, socket) > 3) { fallback = 'stale-or-distant'; return false; }
    if (typeof sweepVisual !== 'function') { fallback = 'missing-sweep'; return false; }
    if (blocked(source, socket, 'launch')) { if (fallback !== 'invalid-sweep') fallback = 'blocked-launch'; return false; }
    enabled = true; fallback = null; return true;
  }
  function sample(authority, { terminal = false } = {}) {
    if (!point(authority)) throw new TypeError('Valid authority endpoint required');
    const direct = copy(authority);
    if (!enabled) {
      const result = { position: direct, from: previous && !first ? copy(previous) : direct, resetTrail: first, bridged: false };
      previous = direct; first = false; return result;
    }
    if (first && !terminal) {
      // Network replicas may already have travelled before their first render.
      // Anchor the visual at the observed hand while keeping that replica intact.
      source = copy(authority); first = false;
    }
    progress = Math.max(progress, Math.hypot(authority.x - source.x, authority.z - source.z));
    const settle = Math.max(3.2, distance(source, socket) * 2);
    const weight = terminal ? 0 : 1 - smooth(progress / settle);
    const visual = { x: authority.x + (socket.x - source.x) * weight,
      y: authority.y + (socket.y - source.y) * weight, z: authority.z + (socket.z - source.z) * weight };
    const abandon = reason => {
      enabled = false; if (fallback !== 'invalid-sweep') fallback = reason;
      previous = direct;
      return { position: direct, from: direct, resetTrail: true, bridged: false };
    };
    if (distance(authority, visual) > 1e-9 && blocked(authority, visual, 'offset')) return abandon('blocked-offset');
    if (distance(previous, visual) > 8) return abandon('network-gap');
    if (distance(previous, visual) > 1e-9 && blocked(previous, visual, terminal ? 'terminal' : 'segment')) return abandon('blocked-segment');
    const result = { position: visual, from: copy(previous), resetTrail: false, bridged: weight > 0 };
    previous = copy(visual);
    if (terminal || weight === 0) enabled = false;
    return result;
  }
  return { release, sample, reset, getStats: () => ({ castId: id, enabled, fallback, queries, progress }) };
}
