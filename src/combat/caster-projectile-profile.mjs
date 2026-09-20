// Runtime contract for the caster only. Other ranged monsters retain their
// caller-owned profiles. The emitter may be cosmetic; these coordinates are
// the physical launch/collision origin shared by solo and server.
export const CASTER_PROJECTILE_PROFILE = Object.freeze({
  maxDistance: 22,
  cooldown: 1.65,
  speed: 11,
  radius: .36,
  lifespan: 4.2,
  impactRadius: 2.2,
  height: 1.05,
  originForwardOffset: .4,
  homing: false,
});

export function casterMeleeRange({ radius = .82, meleeRange, reachBonus = 0 } = {}) {
  const base = Number.isFinite(meleeRange) ? meleeRange : radius + .72;
  return base + (Number.isFinite(reachBonus) ? reachBonus : 0);
}

export function canUseCasterRangedAttack(distance, actor = {}) {
  const meleeRange = casterMeleeRange(actor);
  return Number.isFinite(distance) && distance < CASTER_PROJECTILE_PROFILE.maxDistance &&
    distance > meleeRange + 1.2;
}

export function getCasterProjectileSpec(color = 0xff2f5e) {
  return { kind: 'orb', color, speed: CASTER_PROJECTILE_PROFILE.speed,
    radius: CASTER_PROJECTILE_PROFILE.radius, height: CASTER_PROJECTILE_PROFILE.height,
    lifespan: CASTER_PROJECTILE_PROFILE.lifespan, impactRadius: CASTER_PROJECTILE_PROFILE.impactRadius,
    homing: CASTER_PROJECTILE_PROFILE.homing };
}

export function getCasterProjectileOrigin(position, direction, actorRadius = .82) {
  if (!position || !direction || !Number.isFinite(position.x) || !Number.isFinite(position.z) ||
      !Number.isFinite(direction.x) || !Number.isFinite(direction.z)) {
    throw new TypeError('Caster physical origin requires finite X/Z position and direction');
  }
  const radius = Number.isFinite(actorRadius) ? actorRadius : .82;
  const offset = radius + CASTER_PROJECTILE_PROFILE.originForwardOffset;
  return { x: position.x + direction.x * offset, y: CASTER_PROJECTILE_PROFILE.height,
    z: position.z + direction.z * offset };
}
