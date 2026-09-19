// "Relíquias do Arsenal": shared authoritative rules for the legacy weapons. Pure CPU module used by the solo
// client and by the multiplayer server. Callers pass trusted actor/stat/target data and receive hit callbacks plus
// presentation events. No network field reaches this module: relic id, damage, radius and levels are never client input.
// Relics are INFUSIONS: the class basic attack still resolves in its caller; everything here is added on top of it,
// so an infused attack is always stronger than the plain one whatever the basic-attack numbers become.
import { segmentCircleContact } from './projectile-sweep.mjs';

const HIT_HEIGHT = .9, MAX_PROJECTILES = 24, MAX_PENDING = 48, AREA_LIMIT = 2.25;
const clamp = (value, min, max, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const alive = target => Boolean(target) && !target.dead && target.health > 0;
const freeze = value => { for (const key of Object.keys(value)) if (value[key] && typeof value[key] === 'object') freeze(value[key]); return Object.freeze(value); };

// Legacy build 9124df5 is the source for durations, colours, shapes and reach. `warrior` entries are melee-shaped.
export const RELICS = freeze({
  flamethrower: { id: 'flamethrower', label: 'Lança-chamas', duration: 20, color: 0xff7a28, icon: '🔥',
    warrior: { name: 'Lâmina Flamejante', summary: 'Cada golpe sopra um cone de fogo de 7,5 m que incendeia por 3 s.',
      actions: [{ type: 'cone', range: 7.5, halfAngle: .75, damage: 4, burnDps: 1.6 }] },
    dwarf: { name: 'Rifle Lança-chamas', summary: 'Cada disparo solta um jato de fogo de 10,5 m que incendeia por 3 s.',
      actions: [{ type: 'cone', range: 10.5, halfAngle: .58, damage: 4, burnDps: 1.6 }] } },
  axe: { id: 'axe', label: 'Machado', duration: 16, color: 0x7fd7ff, icon: '🪓',
    warrior: { name: 'Redemoinho do Machado', summary: 'Cada golpe gira 360° e corta duas vezes tudo em 4,4 m.',
      actions: [{ type: 'radius', radius: 4.4, damage: 5 }, { type: 'radius', radius: 4.4, damage: 5, delay: .18 }] },
    dwarf: { name: 'Machado Bumerangue', summary: 'A cada 2 disparos lança um machado que atravessa a horda e volta.',
      actions: [{ type: 'projectile', body: 'axe', every: 2, speed: 19, range: 10, life: 2.4, radius: .95, damage: 6, boomerang: true }] } },
  katana: { id: 'katana', label: 'Katana', duration: 20, color: 0x8ffcff, icon: '⚔',
    warrior: { name: 'Corte Fantasma', summary: 'Um eco repete o golpe com 5,8 m de alcance.',
      actions: [{ type: 'cone', range: 5.8, halfAngle: .92, damage: 7, delay: .14, phantom: true }] },
    dwarf: { name: 'Lâminas Ricochete', summary: 'Cada disparo solta uma lâmina que ricocheteia em até 4 inimigos.',
      actions: [{ type: 'projectile', body: 'blade', speed: 34, life: 1.1, radius: .35, damage: 7, ricochet: 3, ricochetRange: 9, spread: true }] } },
  crossbow: { id: 'crossbow', label: 'Besta', duration: 22, color: 0xffd36d, icon: '🏹',
    warrior: { name: 'Estocada Perfurante', summary: 'Cada golpe estoca uma linha de 12 m que atravessa todos.',
      actions: [{ type: 'line', length: 12, halfWidth: .9, damage: 9 }] },
    dwarf: { name: 'Virotes Perfurantes', summary: 'Cada disparo solta um virote que atravessa até 6 inimigos.',
      actions: [{ type: 'projectile', body: 'bolt', speed: 42, life: .75, radius: .24, damage: 5, pierce: 5, spread: true }] } },
  talisman: { id: 'talisman', label: 'Selo', duration: 18, color: 0xd978ff, icon: '📜',
    warrior: { name: 'Selos Detonantes', summary: 'Inimigos golpeados recebem selos que explodem em 3,2 m.',
      actions: [{ type: 'seals', range: 4.8, halfAngle: .92, max: 4, delay: .55, radius: 3.2, damage: 8 }] },
    dwarf: { name: 'Selos Teleguiados', summary: 'A cada 2 disparos lança um selo que persegue o alvo e explode em 4,8 m.',
      actions: [{ type: 'projectile', body: 'seal', every: 2, speed: 17, life: 1.6, radius: .32, damage: 3, explodeRadius: 4.8, explodeDamage: 5, homing: 14, turn: 5 }] } },
  thunderstaff: { id: 'thunderstaff', label: 'Cajado de Raio', duration: 20, color: 0xfff45c, icon: '⚡',
    warrior: { name: 'Lâmina Trovejante', summary: 'O golpe descarrega um raio que salta por até 6 inimigos.',
      actions: [{ type: 'chain', range: 5.2, halfAngle: .92, jumps: 5, jumpRange: 6.5, damage: 8, falloff: .88 }] },
    dwarf: { name: 'Raio Encadeado', summary: 'O disparo descarrega um raio de 18,5 m que salta por até 5 inimigos.',
      actions: [{ type: 'chain', ray: true, range: 18.5, rayRadius: .45, jumps: 4, jumpRange: 7, damage: 7, falloff: .88 }] } },
  boneCannon: { id: 'boneCannon', label: 'Canhão de Ossos', duration: 22, color: 0xe7e0c7, icon: '☠',
    warrior: { name: 'Impacto Ósseo', summary: 'Cada golpe esmaga o chão à frente: onda de choque de 5 m.',
      actions: [{ type: 'point', distance: 3.2, radius: 5, damage: 8, delay: .12 }] },
    dwarf: { name: 'Projéteis de Osso', summary: 'A cada 2 disparos lança um projétil de osso que explode em 5,8 m.',
      actions: [{ type: 'projectile', body: 'shell', every: 2, speed: 27, life: .85, radius: .34, damage: 3, explodeRadius: 5.8, explodeDamage: 8 }] } },
  frostNova: { id: 'frostNova', label: 'Orbe de Gelo', duration: 20, color: 0x7edcff, icon: '❄',
    warrior: { name: 'Nova Glacial', summary: 'A cada 3 golpes libera uma nova de 7,2 m que congela.',
      actions: [{ type: 'radius', every: 3, radius: 7.2, damage: 6.8, nova: true }] },
    dwarf: { name: 'Orbes de Gelo', summary: 'A cada 3 disparos lança um orbe que explode em 5 m e congela.',
      actions: [{ type: 'projectile', body: 'orb', every: 3, speed: 13, life: 1.5, radius: .6, damage: 2, explodeRadius: 5, explodeDamage: 6.8 }] } },
});
export const RELIC_IDS = Object.freeze(Object.keys(RELICS));
// Signature drop of each boss (pre-chest legacy rule), on top of the chest and potion.
export const BOSS_RELIC_DROPS = Object.freeze({ visor: 'talisman', himetrica: 'thunderstaff', dinzo: 'boneCannon', gitcity: 'crossbow',
  sofra: 'flamethrower', angelSheep: 'frostNova', bloodCow: 'axe', plumaFinance: 'crossbow' });
export const FALLBACK_INFUSION_SECONDS = 15;

export const AUTO_WEAPONS = freeze({
  guardianBlade: { id: 'guardianBlade', label: 'Lâmina Guardiã', color: 0x8ffcff, cooldown: .95, damage: 5.5, range: 24,
    evolution: { id: 'eclipseBlade', label: 'Lâmina Eclipse', color: 0x5dc7ff, damage: 1.45, coneRange: 9.2, coneHalfAngle: .2, coneDamage: .62 } },
  orbitOrb: { id: 'orbitOrb', label: 'Orbe Giratório', color: 0xd978ff, cooldown: .34, damage: 2.6, orbitRadius: 3.4, radius: 1.25, spin: 3.4,
    evolution: { id: 'profaneOrb', label: 'Orbe Profano', color: 0xff8a2a, damage: 1.22, radius: 1.18, orbit: 1.12 } },
  sealRain: { id: 'sealRain', label: 'Chuva de Selos', color: 0xffd36d, cooldown: 1.45, damage: 9, radius: 3.5, range: 31,
    evolution: { id: 'arcaneDeluge', label: 'Dilúvio Arcano', color: 0xffd76a, damage: 1.18, radius: 1.08, spread: 1.35, impactRadius: .86, impactDamage: .72 } },
});
export const AUTO_WEAPON_IDS = Object.freeze(Object.keys(AUTO_WEAPONS));
export const SEAL_RITUAL = Object.freeze({ every: 5, radius: 3.2, radiusPerStack: .65, damage: 6, damagePerStack: 2 });

/** Each `autoWeapon` stack unlocks the next companion, in the legacy order. */
export const nextAutoWeapon = stacks => AUTO_WEAPON_IDS[clamp(stacks?.autoWeapon, 0, 99, 0)] || null;
/** Legacy perk gates. Tempestade Prismática is rifle-only, so two Ritual de Selos stacks also open Dilúvio Arcano. */
export function isAutoWeaponEvolved(weaponId, stacks = {}) {
  if (weaponId === 'guardianBlade') return (stacks.bladeEcho || 0) >= 2;
  if (weaponId === 'orbitOrb') return (stacks.sealRitual || 0) >= 1;
  if (weaponId === 'sealRain') return (stacks.prismStorm || 0) >= 1 || (stacks.sealRitual || 0) >= 2;
  return false;
}
export function getAutoWeaponLoadout(stacks = {}) {
  const unlocked = Math.floor(clamp(stacks.autoWeapon, 0, AUTO_WEAPON_IDS.length, 0));
  return Object.fromEntries(AUTO_WEAPON_IDS.map((id, index) => [id, { level: index < unlocked ? 1 : 0, evolved: index < unlocked && isAutoWeaponEvolved(id, stacks) }]));
}
/** Round robin over the eight relics that never repeats the relic currently held. */
export function nextRelicDrop(index = 0, held = null) {
  const start = Math.floor(clamp(index, 0, 1e9, 0));
  for (let attempt = 0; attempt < RELIC_IDS.length; attempt++) {
    const at = (start + attempt) % RELIC_IDS.length;
    if (RELIC_IDS[at] !== held) return { type: RELIC_IDS[at], index: (at + 1) % RELIC_IDS.length };
  }
  return { type: RELIC_IDS[start % RELIC_IDS.length], index: (start + 1) % RELIC_IDS.length };
}
export const getRelicSpec = (relicId, classId) => Object.hasOwn(RELICS, relicId) ? RELICS[relicId][classId === 'warrior' ? 'warrior' : 'dwarf'] : null;
export const getRelicName = (relicId, classId) => getRelicSpec(relicId, classId)?.name || null;

export function createArsenalState(classId = 'dwarf') {
  return { classId: classId === 'warrior' ? 'warrior' : 'dwarf', clock: 0, serial: 0, relic: null, swing: 0, pending: [], projectiles: [], autoAttacks: 0,
    auto: { guardianBlade: { cooldown: .2 }, orbitOrb: { cooldown: .2, angle: 0, x: null, z: null }, sealRain: { cooldown: .2 } } };
}
/** Death, restart and disconnect: nothing keeps damaging and every live body gets a terminal event. */
export function cancelArsenal(state, emit = () => {}, reason = 'cancelled') {
  for (const projectile of state.projectiles) emit({ kind: 'projectile', phase: 'end', id: projectile.id, relic: projectile.relic, x: projectile.x, z: projectile.z, reason });
  state.projectiles.length = 0; state.pending.length = 0; state.swing = 0; state.relic = null; state.auto.orbitOrb.x = state.auto.orbitOrb.z = null;
}
export const arsenalBusy = state => state.pending.length > 0 || state.projectiles.length > 0;

// ---- hit shapes. `targets` are authority-owned bodies { id, x, z, radius, health }. ----
const scratchA = { x: 0, y: HIT_HEIGHT, z: 0 }, scratchB = { x: 0, y: HIT_HEIGHT, z: 0 };
function blocked(sweepStatic, ax, az, bx, bz) {
  if (!sweepStatic) return false;
  scratchA.x = ax; scratchA.z = az; scratchB.x = bx; scratchB.z = bz;
  return Boolean(sweepStatic(scratchA, scratchB, 0, 'projectile'));
}
/** Cone in front of `origin`. Walls block it, as they block the class basic attack. */
export function targetsInCone(targets, origin, direction, range, halfAngle, sweepStatic = null, out = []) {
  const minDot = Math.cos(halfAngle);
  for (const target of targets) {
    if (!alive(target)) continue;
    const dx = target.x - origin.x, dz = target.z - origin.z, distance = Math.hypot(dx, dz);
    if (distance > range + (target.radius || 0)) continue;
    const dot = distance <= .05 ? 1 : (dx * direction.x + dz * direction.z) / distance;
    if (dot >= minDot && !blocked(sweepStatic, origin.x, origin.z, target.x, target.z)) out.push(target);
  }
  return out;
}
/** Circle around `center`. `sweepStatic` is passed only for explosions, whose blast solids stop. */
export function targetsInRadius(targets, center, radius, sweepStatic = null, out = []) {
  for (const target of targets) {
    if (!alive(target) || Math.hypot(target.x - center.x, target.z - center.z) > radius + (target.radius || 0)) continue;
    if (!blocked(sweepStatic, center.x, center.z, target.x, target.z)) out.push(target);
  }
  return out;
}
/** Piercing corridor. Returns the wall-clipped length; victims are ordered from the origin outwards. */
export function targetsOnLine(targets, origin, direction, length, halfWidth, sweepStatic = null, out = []) {
  scratchA.x = origin.x; scratchA.z = origin.z; scratchB.x = origin.x + direction.x * length; scratchB.z = origin.z + direction.z * length;
  const wall = sweepStatic?.(scratchA, scratchB, 0, 'projectile'), reach = wall ? length * wall.t : length;
  for (const target of targets) {
    if (!alive(target)) continue;
    const dx = target.x - origin.x, dz = target.z - origin.z, along = dx * direction.x + dz * direction.z;
    if (along < -(target.radius || 0) || along > reach + (target.radius || 0)) continue;
    if (Math.abs(dx * direction.z - dz * direction.x) <= halfWidth + (target.radius || 0)) out.push(target);
  }
  out.sort((a, b) => (a.x - b.x) * direction.x + (a.z - b.z) * direction.z);
  return reach;
}
function closestTarget(targets, x, z, range, sweepStatic = null, skip = null) {
  let best = null, bestDistance = range;
  for (const target of targets) {
    if (!alive(target) || skip?.has(target.id)) continue;
    const distance = Math.hypot(target.x - x, target.z - z) - (target.radius || 0);
    if (distance < bestDistance && !blocked(sweepStatic, x, z, target.x, target.z)) { best = target; bestDistance = distance; }
  }
  return best;
}

// ---- resolution ----
let frameTargets = null;
const targetsOf = ctx => frameTargets ??= (typeof ctx.targets === 'function' ? ctx.targets() : ctx.targets) || [];
const victims = [];
function strike(ctx, target, damage, hitEffect, source, extra) {
  if (!alive(target) || !(damage > 0)) return false;
  const killed = Boolean(ctx.hit(target, { damage, hitEffect, source, ...extra }));
  if (killed) target.dead = true;
  return killed;
}
function strikeAll(ctx, list, damage, hitEffect, source, extra) {
  let count = 0;
  for (const target of list) if (alive(target)) { strike(ctx, target, damage, hitEffect, source, extra); count++; }
  list.length = 0;
  return count;
}
const readStats = stats => ({ damage: clamp(stats?.damageMultiplier, 0, 100, 2), area: Math.sqrt(clamp(stats?.areaMultiplier, 1, AREA_LIMIT, 1)),
  cooldown: clamp(stats?.cooldownMultiplier, .2, 1, 1), projectiles: Math.floor(clamp(stats?.projectileBonus, 0, 4, 0)) });
function readAim(aim) {
  const x = clamp(aim?.x, -1, 1, 0), z = clamp(aim?.z, -1, 1, -1), length = Math.hypot(x, z);
  return length > 1e-6 ? { x: x / length, z: z / length } : { x: 0, z: -1 };
}

/** Call once for every ACCEPTED basic attack. `ctx.relic` comes from trusted progression, never from the attack message. */
export function relicAttack(state, ctx) {
  const spec = getRelicSpec(ctx.relic, state.classId);
  if (!spec || !ctx.actor || !Number.isFinite(ctx.actor.x) || !Number.isFinite(ctx.actor.z)) return false;
  if (state.relic !== ctx.relic) { state.relic = ctx.relic; state.swing = 0; }
  state.swing++;
  frameTargets = null;
  const stats = readStats(ctx.stats), direction = readAim(ctx.aim), origin = { x: ctx.actor.x, z: ctx.actor.z };
  for (const action of spec.actions) {
    const every = action.every || 1, step = (state.swing - 1) % every;
    if (step !== 0) { if (action.nova) ctx.emit({ kind: 'relic', relic: ctx.relic, classId: state.classId, shape: 'charge', x: origin.x, z: origin.z, step, of: every }); continue; }
    if (action.type === 'projectile') { launch(state, ctx, action, origin, direction, stats); continue; }
    const job = { at: state.clock + (action.delay || 0), relic: ctx.relic, action, direction, stats, x: origin.x, z: origin.z, marks: null };
    if (action.type === 'seals') {
      // Marked now, detonated later: the blast follows a marked enemy that keeps walking.
      const struck = targetsInCone(targetsOf(ctx), origin, direction, action.range * stats.area, action.halfAngle, ctx.sweepStatic, victims)
        .sort((a, b) => Math.hypot(a.x - origin.x, a.z - origin.z) - Math.hypot(b.x - origin.x, b.z - origin.z)).slice(0, action.max);
      victims.length = 0;
      if (!struck.length) continue;
      job.marks = struck.map(target => ({ id: target.id, x: target.x, z: target.z }));
      ctx.emit({ kind: 'relic', relic: ctx.relic, classId: state.classId, shape: 'seal', phase: 'mark', points: job.marks.map(mark => ({ x: mark.x, z: mark.z })), radius: action.radius * stats.area, delay: action.delay });
    } else if (action.type === 'point') {
      job.x = origin.x + direction.x * action.distance; job.z = origin.z + direction.z * action.distance;
      if (action.delay) ctx.emit({ kind: 'relic', relic: ctx.relic, classId: state.classId, shape: 'point', phase: 'windup', x: job.x, z: job.z, radius: action.radius * stats.area, delay: action.delay });
    }
    if (action.delay) { if (state.pending.length < MAX_PENDING) state.pending.push(job); } else resolve(state, ctx, job);
  }
  frameTargets = null;
  return true;
}

function resolve(state, ctx, job) {
  const { action, stats, direction, relic } = job, targets = targetsOf(ctx), damage = action.damage * stats.damage, classId = state.classId;
  // Whirlwind, echo and chain follow the hero; slam points and seals stay where they were declared.
  const follows = action.type === 'radius' || action.type === 'cone' || action.type === 'chain' || action.type === 'line';
  const origin = follows && ctx.actor ? { x: ctx.actor.x, z: ctx.actor.z } : { x: job.x, z: job.z };
  if (action.type === 'cone') {
    const range = action.range * stats.area;
    targetsInCone(targets, origin, direction, range, action.halfAngle, ctx.sweepStatic, victims);
    ctx.emit({ kind: 'relic', relic, classId, shape: 'cone', x: origin.x, z: origin.z, dx: direction.x, dz: direction.z, range, halfAngle: action.halfAngle, phantom: Boolean(action.phantom) });
    strikeAll(ctx, victims, damage, relic, relic, action.burnDps ? { burnDps: action.burnDps * stats.damage, burnDuration: 3 } : undefined);
  } else if (action.type === 'radius') {
    const radius = action.radius * stats.area;
    targetsInRadius(targets, origin, radius, null, victims);
    ctx.emit({ kind: 'relic', relic, classId, shape: 'radius', x: origin.x, z: origin.z, radius, nova: Boolean(action.nova), echo: Boolean(action.delay) });
    strikeAll(ctx, victims, damage, relic, relic);
  } else if (action.type === 'line') {
    const reach = targetsOnLine(targets, origin, direction, action.length * stats.area, action.halfWidth, ctx.sweepStatic, victims);
    ctx.emit({ kind: 'relic', relic, classId, shape: 'line', x: origin.x, z: origin.z, dx: direction.x, dz: direction.z, length: reach, halfWidth: action.halfWidth });
    strikeAll(ctx, victims, damage, relic, relic);
  } else if (action.type === 'point') {
    const radius = action.radius * stats.area;
    targetsInRadius(targets, origin, radius, ctx.sweepStatic, victims);
    ctx.emit({ kind: 'relic', relic, classId, shape: 'point', phase: 'impact', x: origin.x, z: origin.z, radius });
    strikeAll(ctx, victims, damage, relic, relic);
  } else if (action.type === 'seals') {
    // One detonation wave per swing: overlapping seals widen the blast, they do not multiply it on the same victim.
    const radius = action.radius * stats.area, points = [], wave = new Set();
    for (const mark of job.marks) {
      const holder = targets.find(target => target.id === mark.id && alive(target)), center = holder ? { x: holder.x, z: holder.z } : { x: mark.x, z: mark.z };
      points.push(center);
      for (const target of targetsInRadius(targets, center, radius, ctx.sweepStatic, victims)) wave.add(target);
      victims.length = 0;
    }
    ctx.emit({ kind: 'relic', relic, classId, shape: 'seal', phase: 'detonate', points, radius });
    for (const target of wave) strike(ctx, target, damage, relic, relic);
  } else if (action.type === 'chain') {
    const range = action.range * stats.area, points = [{ x: origin.x, z: origin.z }], struck = new Set();
    let node = null;
    if (action.ray) {
      // Hitscan like the rifle: first body on the ray, before any wall.
      scratchA.x = origin.x; scratchA.z = origin.z; scratchB.x = origin.x + direction.x * range; scratchB.z = origin.z + direction.z * range;
      const wall = ctx.sweepStatic?.(scratchA, scratchB, action.rayRadius, 'projectile'), end = { x: scratchB.x, z: scratchB.z };
      let first = wall?.t ?? Infinity;
      for (const target of targets) {
        if (!alive(target)) continue;
        const contact = segmentCircleContact(origin, end, target, action.rayRadius + (target.radius || 0));
        if (contact < first) { first = contact; node = target; }
      }
      if (!node) points.push(Number.isFinite(first) ? { x: origin.x + (end.x - origin.x) * first, z: origin.z + (end.z - origin.z) * first } : end);
    } else {
      targetsInCone(targets, origin, direction, range, action.halfAngle, ctx.sweepStatic, victims);
      for (const target of victims) if (!node || Math.hypot(target.x - origin.x, target.z - origin.z) < Math.hypot(node.x - origin.x, node.z - origin.z)) node = target;
      victims.length = 0;
    }
    let amount = damage;
    for (let jump = 0; node && jump <= action.jumps; jump++) {
      struck.add(node.id); points.push({ x: node.x, z: node.z });
      const from = node;
      strike(ctx, node, amount, relic, relic);
      amount *= action.falloff;
      node = closestTarget(targets, from.x, from.z, action.jumpRange * stats.area, ctx.sweepStatic, struck);
    }
    if (points.length > 1) ctx.emit({ kind: 'relic', relic, classId, shape: 'chain', points });
  }
}

function launch(state, ctx, action, origin, direction, stats) {
  const count = action.spread ? 1 + stats.projectiles : 1;
  for (let index = 0; index < count && state.projectiles.length < MAX_PROJECTILES; index++) {
    const angle = (index - (count - 1) / 2) * .12, cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = direction.x * cos - direction.z * sin, dz = direction.x * sin + direction.z * cos;
    const projectile = { id: `${ctx.ownerId ?? 'solo'}:${++state.serial}`, relic: ctx.relic, action, stats, x: origin.x, z: origin.z, dx, dz, speed: action.speed,
      age: 0, travelled: 0, pierce: action.pierce || 0, bounces: action.ricochet || 0, returning: false, hitIds: new Set(), notify: 0,
      from: { x: origin.x, y: HIT_HEIGHT, z: origin.z }, to: { x: origin.x, y: HIT_HEIGHT, z: origin.z } };
    state.projectiles.push(projectile);
    ctx.emit({ kind: 'projectile', phase: 'spawn', id: projectile.id, relic: ctx.relic, body: action.body, x: origin.x, z: origin.z, vx: dx * action.speed, vz: dz * action.speed,
      life: action.life, radius: action.radius * stats.area });
  }
}

function explode(ctx, projectile, targets) {
  const { action, stats, relic } = projectile, radius = action.explodeRadius * stats.area;
  targetsInRadius(targets, projectile, radius, ctx.sweepStatic, victims);
  strikeAll(ctx, victims, action.explodeDamage * stats.damage, relic, relic);
  return radius;
}

function advanceProjectile(state, ctx, projectile, dt, targets) {
  const { action, stats, relic } = projectile, radius = action.radius * stats.area;
  let step = Math.min(dt, Math.max(0, action.life - projectile.age)), steered = false;
  projectile.age += step;
  if (action.homing && !projectile.returning) {
    const prey = closestTarget(targets, projectile.x, projectile.z, action.homing, null, projectile.hitIds);
    if (prey) {
      const tx = prey.x - projectile.x, tz = prey.z - projectile.z, length = Math.hypot(tx, tz) || 1, turn = Math.min(1, step * action.turn);
      const nx = projectile.dx * (1 - turn) + tx / length * turn, nz = projectile.dz * (1 - turn) + tz / length * turn, n = Math.hypot(nx, nz) || 1;
      projectile.dx = nx / n; projectile.dz = nz / n; steered = true;
    }
  }
  if (projectile.returning && ctx.actor) {
    const tx = ctx.actor.x - projectile.x, tz = ctx.actor.z - projectile.z, length = Math.hypot(tx, tz);
    if (length <= Math.max(1, projectile.speed * step)) return finish(ctx, projectile, 'returned');
    projectile.dx = tx / length; projectile.dz = tz / length; steered = true;
  }
  while (step > 1e-6) {
    const from = projectile.from, to = projectile.to, travel = projectile.speed * step;
    from.x = projectile.x; from.z = projectile.z; to.x = projectile.x + projectile.dx * travel; to.z = projectile.z + projectile.dz * travel;
    // A returning axe flies home over cover; every other body stops at solids.
    const wall = projectile.returning ? null : ctx.sweepStatic?.(from, to, radius, 'projectile');
    let first = wall?.t ?? Infinity, victim = null;
    for (const target of targets) {
      if (!alive(target) || projectile.hitIds.has(target.id)) continue;
      const contact = segmentCircleContact(from, to, target, radius + (target.radius || 0));
      if (contact < first) { first = contact; victim = target; }
    }
    const reached = Number.isFinite(first) ? first : 1;
    projectile.x = from.x + (to.x - from.x) * reached; projectile.z = from.z + (to.z - from.z) * reached;
    projectile.travelled += travel * reached; step *= 1 - reached;
    if (victim) {
      projectile.hitIds.add(victim.id);
      strike(ctx, victim, action.damage * stats.damage, relic, relic);
      if (action.explodeRadius) return finish(ctx, projectile, 'impact', explode(ctx, projectile, targets));
      if (action.boomerang) continue;
      if (projectile.bounces > 0) {
        const next = closestTarget(targets, projectile.x, projectile.z, action.ricochetRange * stats.area, ctx.sweepStatic, projectile.hitIds);
        if (!next) return finish(ctx, projectile, 'impact');
        const tx = next.x - projectile.x, tz = next.z - projectile.z, length = Math.hypot(tx, tz) || 1;
        projectile.bounces--; projectile.dx = tx / length; projectile.dz = tz / length; projectile.age = Math.min(projectile.age, action.life - .4);
        ctx.emit({ kind: 'projectile', phase: 'move', id: projectile.id, relic, x: projectile.x, z: projectile.z, vx: projectile.dx * projectile.speed, vz: projectile.dz * projectile.speed, bounce: true });
        continue;
      }
      if (projectile.pierce > 0) { projectile.pierce--; continue; }
      return finish(ctx, projectile, 'impact');
    }
    if (wall) {
      if (action.boomerang) { turnBack(ctx, projectile); break; }
      return finish(ctx, projectile, 'wall', action.explodeRadius ? explode(ctx, projectile, targets) : 0);
    }
  }
  if (action.boomerang && !projectile.returning && projectile.travelled >= action.range * stats.area) turnBack(ctx, projectile);
  if (projectile.age >= action.life - 1e-6) return finish(ctx, projectile, 'expired', action.explodeRadius ? explode(ctx, projectile, targets) : 0);
  projectile.notify -= dt;
  if (steered && projectile.notify <= 0) {
    projectile.notify = .1;
    ctx.emit({ kind: 'projectile', phase: 'move', id: projectile.id, relic, x: projectile.x, z: projectile.z, vx: projectile.dx * projectile.speed, vz: projectile.dz * projectile.speed });
  }
  return false;
}
function turnBack(ctx, projectile) {
  projectile.returning = true; projectile.hitIds.clear(); projectile.dx = -projectile.dx; projectile.dz = -projectile.dz; projectile.notify = 0;
  ctx.emit({ kind: 'projectile', phase: 'move', id: projectile.id, relic: projectile.relic, x: projectile.x, z: projectile.z, vx: projectile.dx * projectile.speed, vz: projectile.dz * projectile.speed, returning: true });
}
function finish(ctx, projectile, reason, radius = 0) {
  ctx.emit({ kind: 'projectile', phase: reason === 'returned' || (reason === 'expired' && !radius) ? 'end' : 'impact', id: projectile.id, relic: projectile.relic,
    body: projectile.action.body, x: projectile.x, z: projectile.z, radius, reason });
  return true;
}

function fireAuto(state, ctx, weaponId, slot, stats, targets) {
  const profile = AUTO_WEAPONS[weaponId], evolution = ctx.loadout[weaponId].evolved ? profile.evolution : null, actor = ctx.actor;
  const damage = profile.damage * stats.damage * (evolution?.damage || 1), recharge = Math.max(.045, profile.cooldown * stats.cooldown);
  let ritualAt = null;
  if (weaponId === 'guardianBlade') {
    const target = closestTarget(targets, actor.x, actor.z, profile.range, ctx.sweepStatic);
    if (!target) { slot.cooldown = Math.min(slot.cooldown + .1, .18); return; }
    slot.cooldown = recharge;
    const dx = target.x - actor.x, dz = target.z - actor.z, length = Math.hypot(dx, dz) || 1, direction = { x: dx / length, z: dz / length };
    ctx.emit({ kind: 'auto', weapon: weaponId, evolved: Boolean(evolution), x: actor.x, z: actor.z, tx: target.x, tz: target.z, dx: direction.x, dz: direction.z });
    ritualAt = { x: target.x, z: target.z };
    strike(ctx, target, damage, weaponId, weaponId);
    if (evolution) { targetsInCone(targets, actor, direction, evolution.coneRange, evolution.coneHalfAngle, ctx.sweepStatic, victims); strikeAll(ctx, victims, damage * evolution.coneDamage, weaponId, weaponId); }
  } else if (weaponId === 'orbitOrb') {
    slot.cooldown = recharge;
    const orbit = profile.orbitRadius * stats.area * (evolution?.orbit || 1), radius = profile.radius * stats.area * (evolution?.radius || 1);
    const x = actor.x + Math.cos(slot.angle) * orbit, z = actor.z + Math.sin(slot.angle) * orbit;
    // The orb sweeps the arc flown since its previous tick, so it hits what it visibly touches.
    const fromX = slot.x ?? x, fromZ = slot.z ?? z, far = Math.hypot(fromX - x, fromZ - z) > orbit * 1.6;
    const start = far ? { x, z } : { x: fromX, z: fromZ }, end = { x, z };
    for (const target of targets) if (alive(target) && segmentCircleContact(start, end, target, radius + (target.radius || 0)) <= 1) victims.push(target);
    slot.x = x; slot.z = z;
    if (!victims.length) return;
    ctx.emit({ kind: 'auto', weapon: weaponId, evolved: Boolean(evolution), x, z, radius });
    ritualAt = { x, z };
    strikeAll(ctx, victims, damage, weaponId, weaponId);
  } else {
    const target = closestTarget(targets, actor.x, actor.z, profile.range);
    if (!target) { slot.cooldown = Math.min(slot.cooldown + .16, .24); return; }
    slot.cooldown = recharge;
    const radius = profile.radius * stats.area * (evolution?.radius || 1), points = [{ x: target.x, z: target.z }];
    if (evolution) {
      const dx = target.x - actor.x, dz = target.z - actor.z, length = Math.hypot(dx, dz) || 1;
      for (const offset of [-evolution.spread, evolution.spread]) points.push({ x: target.x - dz / length * offset, z: target.z + dx / length * offset });
    }
    const blast = evolution ? radius * evolution.impactRadius : radius;
    ctx.emit({ kind: 'auto', weapon: weaponId, evolved: Boolean(evolution), x: target.x, z: target.z, points, radius: blast });
    ritualAt = points[0];
    for (const point of points) { targetsInRadius(targets, point, blast, null, victims); strikeAll(ctx, victims, damage * (evolution ? evolution.impactDamage : 1), weaponId, weaponId); }
  }
  const ritual = Math.floor(clamp(ctx.perks?.sealRitual, 0, 2, 0));
  if (!ritual || !ritualAt || ++state.autoAttacks % SEAL_RITUAL.every) return;
  const radius = (SEAL_RITUAL.radius + SEAL_RITUAL.radiusPerStack * ritual) * stats.area;
  ctx.emit({ kind: 'auto', weapon: 'sealRitual', x: ritualAt.x, z: ritualAt.z, radius });
  targetsInRadius(targets, ritualAt, radius, null, victims);
  strikeAll(ctx, victims, (SEAL_RITUAL.damage + SEAL_RITUAL.damagePerStack * ritual) * stats.damage, 'sealRain', 'sealRitual');
}

/** Per-tick authority: delayed relic actions, relic bodies in flight and the three automatic weapons. */
export function advanceArsenal(state, dt, ctx) {
  if (ctx.dead) { cancelArsenal(state, ctx.emit, 'death'); return; }
  dt = clamp(dt, 0, .1, 0); if (!dt) return;
  state.clock += dt; frameTargets = null;
  if (state.relic && state.relic !== ctx.relic && !arsenalBusy(state)) { state.relic = null; state.swing = 0; }
  for (let index = 0; index < state.pending.length;) {
    if (state.pending[index].at > state.clock) { index++; continue; }
    resolve(state, ctx, state.pending.splice(index, 1)[0]);
  }
  for (let index = state.projectiles.length - 1; index >= 0; index--) {
    if (advanceProjectile(state, ctx, state.projectiles[index], dt, targetsOf(ctx))) state.projectiles.splice(index, 1);
  }
  const loadout = ctx.loadout;
  if (loadout && ctx.actor) {
    let stats = null;
    for (const weaponId of AUTO_WEAPON_IDS) {
      if (!(loadout[weaponId]?.level > 0)) continue;
      const slot = state.auto[weaponId];
      if (weaponId === 'orbitOrb') slot.angle = (slot.angle + AUTO_WEAPONS.orbitOrb.spin * dt) % (Math.PI * 2);
      slot.cooldown -= dt;
      if (slot.cooldown <= 0) fireAuto(state, ctx, weaponId, slot, stats ??= readStats(ctx.stats), targetsOf(ctx));
    }
  }
  frameTargets = null;
}
