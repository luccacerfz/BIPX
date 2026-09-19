// Shared solo/server timing. Rendering observes phase; it never applies damage.
const walkerTiming = Object.freeze({ duration: .88, impactTime: .46, cooldown: 1.05, reach: 2.05 });
const runnerTiming = Object.freeze({ ...walkerTiming, reach: 1.85 });
export function getMeleeTiming(type) {
  return type === 'zombie' ? walkerTiming : type === 'runner' ? runnerTiming : null;
}
export function beginMeleeAttack(origin, target, { id, targetId, duration, impactTime, reach, minDot = .35 }) {
  if (!(duration > 0 && impactTime > 0 && impactTime < duration && reach > 0)) throw new RangeError('Invalid melee timing/range');
  const dx = target.x - origin.x, dz = target.z - origin.z;
  const distance = Math.hypot(dx, dz);
  return { id, targetId, elapsed: 0, duration, impactTime, impactPhase: impactTime / duration, reach, minDot,
    directionX: distance > 1e-6 ? dx / distance : 0, directionZ: distance > 1e-6 ? dz / distance : -1,
    impactConsumed: false, active: true };
}

export function advanceMeleeAttack(attack, dt) {
  if (!attack?.active) return { impact: false, finished: true };
  attack.elapsed = Math.min(attack.duration, attack.elapsed + Math.max(0, Number(dt) || 0));
  const impact = !attack.impactConsumed && attack.elapsed >= attack.impactTime;
  if (impact) attack.impactConsumed = true;
  const finished = attack.elapsed >= attack.duration;
  if (finished) attack.active = false;
  return { impact, finished };
}

export function isWithinMeleeArc(origin, target, attack) {
  const dx = target.x - origin.x, dz = target.z - origin.z;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq > attack.reach * attack.reach) return false;
  if (distanceSq < 1e-8) return true;
  return (dx * attack.directionX + dz * attack.directionZ) / Math.sqrt(distanceSq) >= attack.minDot;
}
