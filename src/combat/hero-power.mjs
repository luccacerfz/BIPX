// Shared hero power and pacing. Pure CPU: no THREE, DOM or network. main.js (solo) and server.mjs
// (multiplayer authority) import the same numbers; callers own physics, rewards and presentation.
// Every multiplier is derived from trusted progression (class, level). Client payloads never reach it.
const freeze = value => { for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child); return Object.freeze(value); };
export const HERO_BASE_DAMAGE_MULTIPLIER = 2;
export const HERO_PROFILES = freeze({
  // Aldric: melee bruiser. Armor, sustain, wide cleave, stagger and a 3-hit combo. Never a projectile.
  // `mitigation` is the share removed from every hit; `plate` is then subtracted per hit, so a horde of small
  // hits is blunted far more than a brute, an elite or a late-wave blow.
  warrior: {
    maxHealth: 340, mitigation: .3, plate: 4,
    basic: { weapon: 'katana', shape: 'melee', damage: 9, range: 4.8, arc: 1.2, pointBlank: 2, cooldownMs: 470, swingSeconds: .52, minSwingSeconds: .3, impactFraction: .42 },
    knockback: { distance: 1.2, duration: .14, stagger: .4 },
    combo: { hits: 3, resetSeconds: 1.5, finisher: { damageMultiplier: 2, radius: 5.4, knockback: { distance: 2.6, duration: .2, stagger: .8 } } },
    // Fractions of max health, so +Vida máxima keeps the sustain relevant.
    leech: { perHit: .005, perKill: .012, capPerSecond: .05 },
    power: { basicPerLevel: .045, skillPerLevel: .08 },
  },
  // Lyra: rifle. One shot per opening-wave zombie, short pierce and stopping power; stays squishy.
  dwarf: {
    maxHealth: 200, mitigation: .1, plate: 0,
    // assist*: a body hugging Lyra inside the frontal arc is shot even when the cursor ray slips past it (ground-plane parallax).
    basic: { weapon: 'pistol', shape: 'ray', damage: 3.2, range: 25, radius: .2, speed: 48, cooldownMs: 300, swingSeconds: .32, minSwingSeconds: .16, pierce: 1, pierceFalloff: .6, assistRange: 2.2, assistArc: 1.05 },
    knockback: { distance: .55, duration: .1, stagger: .15 },
    combo: null, leech: null,
    power: { basicPerLevel: .045, skillPerLevel: .08 },
  },
});
export const HERO_POWER_LEVEL_CAP = 40;
// Swarm melee cannot land more often than this on one hero; brutes, elites, bosses, projectiles and traps ignore it.
export const INCOMING = freeze({ graceSeconds: .4, minimumTaken: .25 });
const HEAVY_MONSTER_TYPES = new Set(['brute', 'cowBrute']);
const WEIGHT_SCALE = freeze({ swarm: { distance: 1, stagger: 1 }, heavy: { distance: .35, stagger: 0 }, boss: { distance: 0, stagger: 0 } });
export const PACING = freeze({ openingSeconds: 25, openingExtraInterval: 1.1, openingSpawnSeconds: 10 });

const heroClass = classId => Object.hasOwn(HERO_PROFILES, classId) ? classId : 'dwarf';
export const heroProfile = classId => HERO_PROFILES[heroClass(classId)];
export const heroMaxHealth = classId => heroProfile(classId).maxHealth;
const levelSteps = level => Math.max(0, Math.min(HERO_POWER_LEVEL_CAP, Math.floor(Number(level)) || 1) - 1);
const round3 = value => Math.round(value * 1000) / 1000;
export const basicPower = (classId, level) => round3(1 + levelSteps(level) * heroProfile(classId).power.basicPerLevel);
export const skillPower = (classId, level) => round3(1 + levelSteps(level) * heroProfile(classId).power.skillPerLevel);

export function createHeroCombatState(classId) {
  return { classId: heroClass(classId), combo: 0, lastSwingAt: -Infinity, lastHitAt: -Infinity, leechWindowAt: -Infinity, leechWindowHealed: 0 };
}
// Server gate (ms) and client cadence (s) stay apart so a legitimate client is never rejected by jitter.
export function basicAttackSpec(classId) {
  const { basic } = heroProfile(classId);
  return { classId: heroClass(classId), weapon: basic.weapon, shape: basic.shape, range: basic.range, radius: basic.radius ?? 0, damage: basic.damage, cooldown: basic.cooldownMs };
}
export function swingDuration(classId, cooldownMultiplier = 1) {
  const { basic } = heroProfile(classId);
  return Math.max(basic.minSwingSeconds, basic.swingSeconds * (Number.isFinite(cooldownMultiplier) ? cooldownMultiplier : 1));
}
// One call per accepted basic attack. Aldric: 1, 2, finisher; a pause longer than resetSeconds starts over.
export function beginBasicAttack(state, now) {
  const profile = heroProfile(state?.classId), combo = profile.combo;
  if (!combo) return { index: 1, finisher: false, damageMultiplier: 1, knockback: profile.knockback };
  const since = now - state.lastSwingAt;
  if (!(since >= 0 && since <= combo.resetSeconds)) state.combo = 0;
  state.combo = state.combo % combo.hits + 1; state.lastSwingAt = now;
  const finisher = state.combo === combo.hits;
  return { index: state.combo, finisher, damageMultiplier: finisher ? combo.finisher.damageMultiplier : 1,
    knockback: finisher ? combo.finisher.knockback : profile.knockback };
}
// "+Área" is literal area, so reach grows with its square root (same rule as class skills).
export function meleeShape(classId, { areaMultiplier = 1, finisher = false } = {}) {
  const profile = heroProfile(classId), { basic } = profile, area = Math.sqrt(Math.max(.4, Number(areaMultiplier) || 1));
  if (finisher && profile.combo) return { range: profile.combo.finisher.radius * area, minDot: -1, pointBlank: 0 };
  return { range: basic.range * area, minDot: Math.cos(basic.arc), pointBlank: basic.pointBlank };
}
// Centre-to-centre test with the target radius added, identical for solo and server. No line-of-sight here.
export function insideMeleeShape(shape, origin, direction, target) {
  const dx = target.x - origin.x, dz = target.z - origin.z, distance = Math.hypot(dx, dz), radius = target.radius || 0;
  if (distance > shape.range + radius) return false;
  if (shape.minDot <= -1 || distance <= shape.pointBlank + radius || distance < 1e-3) return true;
  return (dx * direction.x + dz * direction.z) / distance >= shape.minDot;
}
export function rifleShot(classId, { areaMultiplier = 1 } = {}) {
  const { basic } = heroProfile(classId), area = Math.sqrt(Math.max(.4, Number(areaMultiplier) || 1));
  return { damage: basic.damage, radius: (basic.radius ?? .12) * area, range: basic.range, speed: basic.speed ?? 48,
    lifespan: basic.range / (basic.speed ?? 48), pierce: basic.pierce ?? 0, pierceFalloff: basic.pierceFalloff ?? 1,
    assistRange: basic.assistRange ?? 0, assistMinDot: Math.cos(basic.assistArc ?? 0) };
}
// Point-blank forgiveness for the rifle. Returns `direction` untouched unless the nearest living body inside the
// frontal arc and assist range would be missed; then the shot goes straight at it. Same call solo and server.
export function assistRifleAim(origin, direction, targets, shot) {
  let best = null, bestDistance = Infinity;
  for (const target of targets) {
    const dx = target.x - origin.x, dz = target.z - origin.z, distance = Math.hypot(dx, dz);
    if (!(target.health > 0) || distance < 1e-3 || distance >= bestDistance || distance > shot.assistRange + (target.radius || 0)) continue;
    if ((dx * direction.x + dz * direction.z) / distance < shot.assistMinDot) continue;
    best = target; bestDistance = distance;
  }
  if (!best) return direction;
  const dx = best.x - origin.x, dz = best.z - origin.z;
  if (dx * direction.x + dz * direction.z > 0 && Math.abs(dx * direction.z - dz * direction.x) <= (best.radius || 0) * .5) return direction;
  return { x: dx / bestDistance, z: dz / bestDistance };
}

export function monsterWeight(monster) {
  if (monster?.boss) return 'boss';
  return monster?.eliteType || HEAVY_MONSTER_TYPES.has(monster?.type) ? 'heavy' : 'swarm';
}
export const isSwarmSource = source => Boolean(source) && monsterWeight(source) === 'swarm';
// Sets a short slide plus a stagger on the monster record; the caller resolves the slide with its own physics.
// Controlled (frozen, stunned, pulled) bodies keep their owner: no knockback.
export function applyHeroKnockback(monster, direction, spec, weight = monsterWeight(monster)) {
  const scale = WEIGHT_SCALE[weight] ?? WEIGHT_SCALE.swarm, length = Math.hypot(direction?.x, direction?.z);
  if (!spec || !(length > 1e-6) || monster.freezeTimer > 0 || monster.stunTimer > 0 || monster.pullTimer > 0) return false;
  const distance = spec.distance * scale.distance, stagger = spec.stagger * scale.stagger;
  if (distance > 0) monster.knockback = { x: direction.x / length * distance / spec.duration, z: direction.z / length * distance / spec.duration, remaining: spec.duration };
  if (stagger > 0) monster.staggerTimer = Math.max(monster.staggerTimer || 0, stagger);
  return distance > 0 || stagger > 0;
}
export function advanceHeroKnockback(monster, dt) {
  const step = Math.max(0, Math.min(.1, Number(dt) || 0)), staggered = monster.staggerTimer > 0;
  if (staggered) monster.staggerTimer = Math.max(0, monster.staggerTimer - step);
  const slide = monster.knockback; if (!slide) return { dx: 0, dz: 0, staggered };
  const used = Math.min(step, slide.remaining); slide.remaining -= used;
  if (slide.remaining <= 1e-6) monster.knockback = null;
  return { dx: slide.x * used, dz: slide.z * used, staggered };
}

// Armor first, then the caller's own reductions (Sangue de Ferro). A clock that runs backwards never grants grace.
export function resolveIncomingDamage(state, amount, { now, swarm = false } = {}) {
  if (typeof amount !== 'number' || !(amount > 0) || !Number.isFinite(amount) || !Number.isFinite(now)) return { damage: 0, graced: false };
  const since = now - state.lastHitAt;
  if (swarm && since >= 0 && since < INCOMING.graceSeconds) return { damage: 0, graced: true };
  state.lastHitAt = now;
  const profile = heroProfile(state.classId);
  return { damage: Math.max(amount * INCOMING.minimumTaken, amount * (1 - profile.mitigation) - profile.plate), graced: false };
}
// Returns the health actually restored; the rolling one-second budget is only spent on real healing.
export function resolveLeech(state, { hits = 0, kills = 0, now, health, maxHealth } = {}) {
  const leech = heroProfile(state?.classId).leech;
  if (!leech || !(maxHealth > 0) || !(health > 0) || !Number.isFinite(now)) return 0;
  const since = now - state.leechWindowAt;
  if (!(since >= 0 && since < 1)) { state.leechWindowAt = now; state.leechWindowHealed = 0; }
  const wanted = (Math.max(0, hits) * leech.perHit + Math.max(0, kills) * leech.perKill) * maxHealth;
  const granted = Math.max(0, Math.min(wanted, leech.capPerSecond * maxHealth - state.leechWindowHealed, maxHealth - health));
  state.leechWindowHealed += granted;
  return granted;
}

// Pacing. First level-up after three kills, then the curve rejoins the previous one from below.
export const xpToNext = level => { const l = Math.max(1, Math.floor(Number(level)) || 1); return Math.round((10 + l * 7 + Math.floor(l ** 1.35)) * (1 - .5 * .62 ** (l - 1))); };
export function waveSpawnBudget(wave, survivalTime = 0) {
  const w = Math.max(1, Math.floor(Number(wave)) || 1);
  return 24 + w * 11 + Math.floor(Math.max(0, w - 1) ** 1.32 * 7.8) + Math.floor(Math.max(0, survivalTime) / 6);
}
export const openingEase = survivalTime => 1 + PACING.openingExtraInterval * Math.max(0, 1 - Math.max(0, survivalTime) / PACING.openingSeconds);
export function spawnInterval(wave, survivalTime = 0, floor = .05) {
  const wavePressure = Math.min(.66, wave * .043 + Math.max(0, wave - 10) * .017), timePressure = Math.min(.22, Math.max(0, survivalTime) * .0045);
  return Math.max(floor, .7 - wavePressure - timePressure) * openingEase(survivalTime);
}
// The first contacts arrive sooner; afterwards the ring is the previous 28–50 m.
export const spawnDistance = (survivalTime = 0, random = Math.random()) => survivalTime < PACING.openingSpawnSeconds ? 22 + random * 10 : 28 + random * 22;
