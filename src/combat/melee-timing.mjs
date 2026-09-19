// Shared solo/server melee timing and hit contract. Rendering observes phase; it never applies damage.
// Cooldown is applied at begin so inter-hit time equals cooldown (theoretical cadence cannot rise vs t0).
export const MELEE_LOS_Y = .9;
export const MELEE_LOS_RADIUS = 0;
export const MELEE_SWARM_WAVE_FACTOR = .55;
export const MELEE_BOSS_WAVE_FACTOR = .65;
// Conservative server hit radius (monster.radius + 0.72), not solo's old radius+playerRadius+0.74.
export const MELEE_REACH_PADDING = .72;

const walkerTiming = Object.freeze({ duration: .88, impactTime: .46, cooldown: 1.05, reach: 2.05, minDot: .35 });
const runnerTiming = Object.freeze({ ...walkerTiming, reach: 1.85 });
const orcTiming = Object.freeze({ duration: .88, impactTime: .42, cooldown: .9, reach: 1.55, minDot: .35 });
const bruteTiming = Object.freeze({ duration: .6, impactTime: .4, cooldown: .62, reach: 1.9, minDot: .35 });
const cowWalkerTiming = Object.freeze({ duration: .6, impactTime: .34, cooldown: .62, reach: 1.58, minDot: .35 });
const cowChargerTiming = Object.freeze({ duration: .58, impactTime: .3, cooldown: .62, reach: 1.5, minDot: .35 });
const cowBruteTiming = Object.freeze({ duration: .6, impactTime: .4, cooldown: .62, reach: 1.96, minDot: .35 });
const bloodCowTiming = Object.freeze({ duration: .68, impactTime: .4, cooldown: .86, reach: 1.72 + MELEE_REACH_PADDING, minDot: .35 });

const TIMINGS = Object.freeze({
  zombie: walkerTiming,
  runner: runnerTiming,
  orcPeon: orcTiming,
  brute: bruteTiming,
  cowWalker: cowWalkerTiming,
  cowCharger: cowChargerTiming,
  cowBrute: cowBruteTiming,
  bloodCow: bloodCowTiming,
});

const BOSS_MELEE_TYPES = Object.freeze(new Set(['bloodCow']));

export function getMeleeTiming(type) {
  return TIMINGS[type] ?? null;
}

export function meleeTimingTypes() {
  return Object.freeze(Object.keys(TIMINGS));
}

export function meleeIsBossType(type) {
  return BOSS_MELEE_TYPES.has(type);
}

export function meleeHitReach(type, reachBonus = 0) {
  const timing = getMeleeTiming(type);
  if (!timing) return null;
  return timing.reach + (Number(reachBonus) || 0);
}

export function meleeLosClear(sweepStaticFn, origin, target) {
  return !sweepStaticFn(
    { x: origin.x, y: MELEE_LOS_Y, z: origin.z },
    { x: target.x, y: MELEE_LOS_Y, z: target.z },
    MELEE_LOS_RADIUS,
  );
}

export function meleeWaveFactor(type) {
  return meleeIsBossType(type) ? MELEE_BOSS_WAVE_FACTOR : MELEE_SWARM_WAVE_FACTOR;
}

export function meleeRawDamage(type, baseDamage, wave) {
  return (Number(baseDamage) || 0) + Math.floor((Number(wave) || 0) * meleeWaveFactor(type));
}

export function theoreticalMeleeCadence(type, damage) {
  const timing = getMeleeTiming(type);
  if (!timing) return null;
  const interHitSeconds = timing.cooldown;
  return Object.freeze({
    type,
    impactTime: timing.impactTime,
    duration: timing.duration,
    cooldown: timing.cooldown,
    reach: timing.reach,
    waveFactor: meleeWaveFactor(type),
    interHitSeconds,
    impactsPerSecond: 1 / interHitSeconds,
    damagePerSecond: Number.isFinite(damage) ? damage / interHitSeconds : null,
  });
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

export function serializeMeleeAttack(attack) {
  if (!attack) return null;
  return {
    id: attack.id,
    targetId: attack.targetId ?? null,
    elapsed: Number(Number(attack.elapsed || 0).toFixed(3)),
    duration: attack.duration,
    impactTime: attack.impactTime,
    impactPhase: attack.impactPhase,
    reach: attack.reach,
    minDot: attack.minDot,
    directionX: attack.directionX,
    directionZ: attack.directionZ,
    active: Boolean(attack.active),
    impactConsumed: Boolean(attack.impactConsumed),
  };
}

export function restoreMeleeDirection(snapshot) {
  const x = Number(snapshot?.directionX);
  const z = Number(snapshot?.directionZ);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { ok: false, directionX: 0, directionZ: -1, reason: "non_finite_direction" };
  }
  const length = Math.hypot(x, z);
  if (!(length > 1e-6)) {
    return { ok: false, directionX: 0, directionZ: -1, reason: "zero_vector" };
  }
  return { ok: true, directionX: x / length, directionZ: z / length, reason: null };
}

export function restoreMeleeAttack(snapshot) {
  const detailed = restoreMeleeAttackDetailed(snapshot);
  return detailed.attack;
}

export function restoreMeleeAttackDetailed(snapshot) {
  if (!snapshot || snapshot.id == null) {
    return { ok: false, attack: null, reason: "missing_snapshot" };
  }
  const duration = Number(snapshot.duration);
  const impactTime = Number(snapshot.impactTime);
  const reach = Number(snapshot.reach);
  if (!(duration > 0 && impactTime > 0 && impactTime < duration && reach > 0)) {
    return { ok: false, attack: null, reason: "invalid_timing" };
  }
  const elapsedRaw = Number(snapshot.elapsed);
  const elapsed = Number.isFinite(elapsedRaw) ? Math.min(duration, Math.max(0, elapsedRaw)) : 0;
  const direction = restoreMeleeDirection(snapshot);
  if (!direction.ok) {
    return { ok: false, attack: null, reason: direction.reason, fallbackDirection: { x: direction.directionX, z: direction.directionZ } };
  }
  const attack = {
    id: snapshot.id,
    targetId: snapshot.targetId ?? null,
    elapsed,
    duration,
    impactTime,
    impactPhase: Number.isFinite(Number(snapshot.impactPhase)) ? Number(snapshot.impactPhase) : impactTime / duration,
    reach,
    minDot: Number.isFinite(Number(snapshot.minDot)) ? Number(snapshot.minDot) : .35,
    directionX: direction.directionX,
    directionZ: direction.directionZ,
    impactConsumed: Boolean(snapshot.impactConsumed) || elapsed >= impactTime,
    active: snapshot.active !== false && elapsed < duration,
  };
  return { ok: true, attack, reason: null };
}
