// Shared authoritative simulation. Presentation never supplies damage or resources.
export const CLASS_RESOURCES = Object.freeze({ warrior: Object.freeze({ label: 'Fervor', max: 100, regeneration: 8 }), dwarf: Object.freeze({ label: 'Foco', max: 100, regeneration: 9 }) });
const definitions = [
  { id: 'warrior_war_cry', classId: 'warrior', slot: 0, name: 'Grito de Guerra', description: 'Por 8 s: +35% de dano e +15% de movimento.', cost: 24, cooldown: 14, windup: .38, duration: .85, shape: 'buff', range: 0, radius: 3, buffDuration: 8, damageBoost: 1.35, speedBoost: 1.15, damage: 0, element: 'war' },
  { id: 'warrior_cleaving_dash', classId: 'warrior', slot: 1, name: 'Corte Devastador', description: 'Avança até 8 m, corta cada inimigo no caminho uma vez e parte os derrotados.', cost: 28, cooldown: 6, windup: .22, duration: .78, shape: 'dash', range: 8, travelTime: .36, radius: .85, damage: 14, element: 'steel' },
  { id: 'warrior_shield_charge', classId: 'warrior', slot: 2, name: 'Investida de Escudo', description: 'Avança até 7 m e atordoa todos na faixa por 2,2 s. Chefes: 0,65 s.', cost: 34, cooldown: 10, windup: .28, duration: 1.10, shape: 'dash', range: 7, travelTime: .65, radius: 1.05, damage: 1.2, stun: 2.2, element: 'shield' },
  { id: 'dwarf_explosive_cannon', classId: 'dwarf', slot: 0, name: 'Canhão Infernal', description: 'Projétil de fogo com explosão de raio 3,4 m; sólidos bloqueiam a área.', cost: 28, cooldown: 5, windup: .30, duration: .72, shape: 'projectile', range: 22, radius: 3.4, projectileRadius: .32, speed: 22, damage: 14, element: 'fire' },
  { id: 'dwarf_frost_shot', classId: 'dwarf', slot: 1, name: 'Disparo Glacial', description: 'Congela todos na área de 4 m por 3 s. Chefes: 0,8 s.', cost: 32, cooldown: 9, windup: .28, duration: .68, shape: 'projectile', range: 20, radius: 4, projectileRadius: .25, speed: 24, damage: .8, freeze: 3, element: 'frost' },
  { id: 'dwarf_gravity_shot', classId: 'dwarf', slot: 2, name: 'Núcleo Gravitacional', description: 'Campo fixo de 5 m por 5 s: atrai e impede caminhar, mas não atacar. Chefes sofrem 35% da atração.', cost: 38, cooldown: 12, windup: .42, duration: .85, shape: 'projectile', range: 18, radius: 5, projectileRadius: .3, speed: 20, damage: .6, fieldDuration: 5, pullSpeed: 4.5, element: 'gravity' },
];
export const CLASS_SKILLS = Object.freeze(definitions.map(def => Object.freeze({ ...def, key: String(def.slot + 1) })));
// +Área reaches only the announced impact areas (cannon/frost/gravity). Dash/charge lanes and travelled
// distance are never scaled. The multiplier comes from trusted progression and is frozen at cast time.
export const SKILL_AREA_LIMIT = 2.25; // 1 + 5 × .13 stacks, × 1.35 Tempestade Prismática
export const sanitizeAreaMultiplier = value => clamp(value, 1, SKILL_AREA_LIMIT, 1);
const scalesWithArea = def => def?.shape === 'projectile' && def.radius > 0;
// "+13% área" is literal: area grows linearly with the multiplier, so the radius grows with its square root.
export const getSkillRadius = (def, areaMultiplier = 1) => scalesWithArea(def) ? Math.round(def.radius * Math.sqrt(sanitizeAreaMultiplier(areaMultiplier)) * 1000) / 1000 : def.radius;
const meters = value => (Math.round(value * 10) / 10).toLocaleString('pt-BR');
// Class skill upgrades ("skillMods") come only from trusted progression (src/progression/skill-upgrades.mjs).
// [min, max, neutral]. Resource cap/regeneration are read every tick; everything else is frozen on the cast,
// exactly like areaMultiplier. The network intent is never read for any of them.
export const SKILL_MOD_LIMITS = Object.freeze({
  resourceMax: [100, 145, 100], resourceRegen: [1, 1.6, 1], costMultiplier: [.7, 1, 1], cooldownMultiplier: [.55, 1, 1],
  warCryDuration: [0, 6, 0], warCryKillHeal: [0, 6, 0], warCryShockwave: [0, 1, 0],
  dashKillFervor: [0, 12, 0], dashRange: [0, 3, 0], dashDamage: [1, 1.6, 1], dashMultiKill: [0, .7, 0],
  chargeBastion: [0, .4, 0], chargeShockwave: [0, 1, 0],
  cannonDamage: [1, 1.75, 1], cannonNapalm: [0, 2, 0], frostShatter: [0, .7, 0], frostHop: [0, 4, 0],
  gravityDuration: [0, 4.5, 0], gravityCollapse: [0, 1, 0],
});
const CAST_MOD_KEYS = Object.freeze({
  warrior_war_cry: ['warCryDuration', 'warCryKillHeal', 'warCryShockwave'],
  warrior_cleaving_dash: ['dashKillFervor', 'dashRange', 'dashDamage', 'dashMultiKill'],
  warrior_shield_charge: ['chargeBastion', 'chargeShockwave'],
  dwarf_explosive_cannon: ['cannonDamage', 'cannonNapalm', 'frostShatter'],
  dwarf_frost_shot: ['frostHop', 'frostShatter'],
  dwarf_gravity_shot: ['gravityDuration', 'gravityCollapse', 'frostShatter'],
});
export const SKILL_MOD_EFFECTS = Object.freeze({
  warCryShockwave: Object.freeze({ radius: 4.5, damage: 6, stun: 1.2, push: 3, pushTime: .25 }),
  chargeShockwave: Object.freeze({ radius: 3.5, damage: 8 }), chargeBastion: Object.freeze({ duration: 4 }),
  dashKillFervor: Object.freeze({ castLimit: 40 }), dashMultiKill: Object.freeze({ kills: 2 }),
  cannonNapalm: Object.freeze({ duration: 4, interval: .5, damage: 2 }), frostHop: Object.freeze({ time: .24 }),
  gravityCollapse: Object.freeze({ damage: 16 }), warCryKillHeal: Object.freeze({ boss: 3 }),
});
export const NEUTRAL_SKILL_MODS = Object.freeze(Object.fromEntries(Object.entries(SKILL_MOD_LIMITS).map(([key, [, , neutral]]) => [key, neutral])));
export function sanitizeSkillMods(value) {
  if (value === NEUTRAL_SKILL_MODS || value == null) return NEUTRAL_SKILL_MODS;
  const mods = {}; for (const [key, [min, max, neutral]] of Object.entries(SKILL_MOD_LIMITS)) mods[key] = clamp(value[key], min, max, neutral);
  return Object.freeze(mods);
}
// Only the keys that change this skill, and only when they differ from neutral: an unmodified cast stays identical.
function freezeCastMods(def, value) {
  const mods = {}; for (const key of CAST_MOD_KEYS[def.id]) { const [min, max, neutral] = SKILL_MOD_LIMITS[key], amount = clamp(value?.[key], min, max, neutral); if (amount !== neutral) mods[key] = amount; }
  return Object.keys(mods).length ? Object.freeze(mods) : null;
}
export const getSkillCost = (def, skillMods) => Math.max(1, Math.round(def.cost * sanitizeSkillMods(skillMods).costMultiplier));
export const getSkillCooldown = (def, skillMods) => Math.round(def.cooldown * sanitizeSkillMods(skillMods).cooldownMultiplier * 100) / 100;
const castRange = (cast, def) => def.range + (cast.mods?.dashRange || 0);
export function describeSkill(def, areaMultiplier = 1, skillMods) {
  const radius = getSkillRadius(def, areaMultiplier), mods = sanitizeSkillMods(skillMods), seconds = value => `${meters(value)} s`;
  let text = radius === def.radius ? def.description : def.description.replace(`${meters(def.radius)} m`, `${meters(radius)} m`);
  if (def.id === 'warrior_war_cry' && mods.warCryDuration) text = text.replace(`Por ${seconds(def.buffDuration)}`, `Por ${seconds(def.buffDuration + mods.warCryDuration)}`);
  if (def.id === 'warrior_cleaving_dash' && mods.dashRange) text = text.replace(`até ${meters(def.range)} m`, `até ${meters(def.range + mods.dashRange)} m`);
  if (def.id === 'dwarf_gravity_shot' && mods.gravityDuration) text = text.replace(`por ${seconds(def.fieldDuration)}`, `por ${seconds(def.fieldDuration + mods.gravityDuration)}`);
  return text;
}
export const getClassSkills = classId => CLASS_SKILLS.filter(def => def.classId === classId);
export const getClassSkill = id => CLASS_SKILLS.find(def => def.id === id);
export function createSkillState(classId = 'dwarf') {
  if (!Object.hasOwn(CLASS_RESOURCES, classId)) classId = 'dwarf';
  return { classId, resource: 100, cooldowns: [0, 0, 0], lock: 0, sequence: 0, active: [], buff: null, fields: [], movement: null };
}
export const getSkillModifiers = state => state?.buff?.remaining > 0 ? { damage: 1.35, speed: 1.15 } : { damage: 1, speed: 1 };
// Bastião (Investida de Escudo upgrade): callers multiply incoming damage by this while the guard lasts.
export const getSkillDamageTaken = state => state?.guard?.remaining > 0 ? 1 - clamp(state.guard.reduction, 0, SKILL_MOD_LIMITS.chargeBastion[1], 0) : 1;
// Sede de Sangue (Grito de Guerra upgrade): callers own health, so every kill credited to the caster asks here.
export function creditSkillKill(state, { boss = false } = {}) {
  const amount = state?.buff?.remaining > 0 ? clamp(state.buff.killHeal, 0, SKILL_MOD_LIMITS.warCryKillHeal[1], 0) : 0;
  return { heal: amount * (boss ? SKILL_MOD_EFFECTS.warCryKillHeal.boss : 1) };
}
const hopping = movement => movement?.skillId === 'dwarf_frost_shot' && movement.hop === true;
export function isSkillMoving(state) { return Boolean(state?.movement?.remaining > 0 || state?.active?.some(c => getClassSkill(c.skillId)?.shape === 'dash' && c.released && !c.done)); }
export function skillSnapshot(state) {
  return { classId: state.classId, resource: state.resource, cooldowns: [...state.cooldowns], lock: state.lock, sequence: state.sequence,
    buff: state.buff ? { ...state.buff, origin: { ...state.buff.origin } } : null,
    fields: state.fields.map(f => ({ ...f, origin: { ...f.origin } })), movement: state.movement ? { ...state.movement } : null,
    active: state.active.map(snapshotActive).filter(Boolean), ...(state.guard ? { guard: { ...state.guard } } : {}) };
}
const PERSISTENT_FIELDS = Object.freeze({ dwarf_gravity_shot: 'gravity', dwarf_explosive_cannon: 'napalm' });
export function restoreSkillSnapshot(snapshot) {
  const state = createSkillState(snapshot?.classId);
  state.resource = clamp(snapshot?.resource, 0, SKILL_MOD_LIMITS.resourceMax[1], 0);
  state.cooldowns = getClassSkills(state.classId).map(def => clamp(snapshot?.cooldowns?.[def.slot], 0, def.cooldown, 0));
  state.lock = clamp(snapshot?.lock, 0, 2, 0); state.sequence = clamp(snapshot?.sequence, 0, Number.MAX_SAFE_INTEGER, 0);
  if (state.classId === 'warrior' && snapshot?.buff?.remaining > 0) { const longest = 8 + SKILL_MOD_LIMITS.warCryDuration[1], killHeal = clamp(snapshot.buff.killHeal, 0, SKILL_MOD_LIMITS.warCryKillHeal[1], 0);
    state.buff = { ...snapshot.buff, remaining: clamp(snapshot.buff.remaining, 0, longest, 0), damageMultiplier: 1.35, speedMultiplier: 1.15 };
    if ('duration' in snapshot.buff) state.buff.duration = clamp(snapshot.buff.duration, 0, longest, 8);
    if (killHeal) state.buff.killHeal = killHeal; else delete state.buff.killHeal; }
  if (state.classId === 'warrior' && snapshot?.guard?.remaining > 0) { const duration = SKILL_MOD_EFFECTS.chargeBastion.duration;
    state.guard = { skillId: 'warrior_shield_charge', castId: String(snapshot.guard.castId || ''), status: 'guard', remaining: clamp(snapshot.guard.remaining, 0, duration, 0), duration, reduction: clamp(snapshot.guard.reduction, 0, SKILL_MOD_LIMITS.chargeBastion[1], 0) }; }
  state.fields = Array.isArray(snapshot?.fields) ? snapshot.fields.filter(f => PERSISTENT_FIELDS[f?.skillId] && f.remaining > 0 && (f.status ?? 'gravity') === PERSISTENT_FIELDS[f.skillId]).slice(0, 6).map(f => { const areaMultiplier = sanitizeAreaMultiplier(f.areaMultiplier), def = getClassSkill(f.skillId);
    // Restored snapshots are re-derived, never trusted for an arbitrary radius, duration or power.
    const field = { ...f, areaMultiplier, radius: getSkillRadius(def, areaMultiplier) };
    if (def.fieldDuration) { field.remaining = clamp(f.remaining, 0, def.fieldDuration + SKILL_MOD_LIMITS.gravityDuration[1], 0); if (f.duration > def.fieldDuration) field.duration = clamp(f.duration, def.fieldDuration, def.fieldDuration + SKILL_MOD_LIMITS.gravityDuration[1], def.fieldDuration); }
    else { field.remaining = clamp(f.remaining, 0, SKILL_MOD_EFFECTS.cannonNapalm.duration, 0); field.duration = SKILL_MOD_EFFECTS.cannonNapalm.duration; field.level = clamp(f.level, 0, SKILL_MOD_LIMITS.cannonNapalm[1], 0); field.tick = clamp(f.tick, 0, SKILL_MOD_EFFECTS.cannonNapalm.interval, SKILL_MOD_EFFECTS.cannonNapalm.interval); }
    for (const key of ['collapse', 'shatter', 'damageMultiplier']) if (key in f) field[key] = key === 'collapse' ? clamp(f.collapse, 0, 1, 0) : key === 'shatter' ? clamp(f.shatter, 0, SKILL_MOD_LIMITS.frostShatter[1], 0) : clamp(f.damageMultiplier, 1, 100, 2);
    return field; }) : [];
  if (snapshot?.movement?.remaining > 0 && (getClassSkill(snapshot.movement.skillId)?.shape === 'dash' || hopping(snapshot.movement))) state.movement = { ...snapshot.movement, remaining: clamp(snapshot.movement.remaining, 0, .65, 0) };
  // Presentation/resume only. Never treat client-authored hitIds as new damage authority.
  state.active = Array.isArray(snapshot?.active) ? snapshot.active.map(restoreActive).filter(cast => cast && getClassSkill(cast.skillId)?.classId === state.classId).slice(0, 3) : [];
  return state;
}
export function getSkillHud(state, { health = 0, maxHealth = 200, weapon, dead = false, paused = false, enabled = true, areaMultiplier = 1, skillMods } = {}) {
  const resource = CLASS_RESOURCES[state.classId], mods = sanitizeSkillMods(skillMods);
  const buffDef = state.buff ? getClassSkill(state.buff.skillId) : null;
  const activeStatus = state.buff?.remaining > 0 && buffDef ? {
    // `id` identifies this effect instance; `skillId` identifies the v2 skill.
    id: state.buff.castId || buffDef.id,
    skillId: buffDef.id,
    status: state.buff.status || 'buff',
    label: buffDef.name,
    name: buffDef.name,
    remaining: state.buff.remaining,
    duration: state.buff.duration ?? buffDef.buffDuration ?? buffDef.duration,
    description: state.buff.duration > buffDef.buffDuration ? describeSkill(buffDef, 1, { warCryDuration: state.buff.duration - buffDef.buffDuration }) : buffDef.description,
    damageMultiplier: state.buff.damageMultiplier ?? buffDef.damageBoost,
    speedMultiplier: state.buff.speedMultiplier ?? buffDef.speedBoost,
  } : null;
  const guardStatus = state.guard?.remaining > 0 ? { id: `${state.guard.castId}:guard`, skillId: 'warrior_shield_charge', status: 'guard', label: 'Bastião', name: 'Bastião',
    remaining: state.guard.remaining, duration: state.guard.duration, description: `Dano recebido −${Math.round((1 - getSkillDamageTaken(state)) * 100)}%.` } : null;
  return { classId: state.classId, health, maxHealth, resource: Math.min(state.resource, mods.resourceMax), maxResource: mods.resourceMax, resourceLabel: resource.label, weapon, dead, paused,
    statuses: [activeStatus, guardStatus].filter(Boolean),
    areaMultiplier: sanitizeAreaMultiplier(areaMultiplier),
    skills: getClassSkills(state.classId).map(def => { const cost = getSkillCost(def, mods); return { id: def.id, slot: def.slot, name: def.name, description: describeSkill(def, areaMultiplier, mods), radius: getSkillRadius(def, areaMultiplier), key: def.key, cost, cooldownRemaining: state.cooldowns[def.slot], cooldownDuration: getSkillCooldown(def, mods),
      enabled: enabled && !dead && !paused && state.lock <= 0 && state.cooldowns[def.slot] <= 0 && state.resource >= cost }; }) };
}
export function beginSkill(state, intent, actor = {}) {
  const def = getClassSkills(state.classId)[intent?.slot];
  if (!Number.isInteger(intent?.slot) || !def) return { ok: false, reason: 'slot' };
  if (actor.dead || actor.paused || actor.playing === false) return { ok: false, reason: 'state' };
  if (state.lock > 0) return { ok: false, reason: 'casting' };
  if (state.cooldowns[def.slot] > 0) return { ok: false, reason: 'cooldown' };
  // Trusted progression only (same rule as areaMultiplier): cost, cooldown and every cast mod are frozen here.
  const skillMods = sanitizeSkillMods(actor.skillMods), cost = getSkillCost(def, skillMods), mods = freezeCastMods(def, skillMods);
  if (state.resource < cost) return { ok: false, reason: 'resource' };
  const origin = point(actor.x, actor.z, .1), dx = clamp(intent.aimX, -1, 1, 0), dz = clamp(intent.aimZ, -1, 1, -1), length = Math.hypot(dx, dz) || 1;
  const direction = { x: dx / length, y: 0, z: dz / length }; if (!dx && !dz) direction.z = -1;
  state.resource -= cost; state.cooldowns[def.slot] = getSkillCooldown(def, skillMods); state.lock = def.duration;
  const range = def.range + (mods?.dashRange || 0);
  const cast = { skillId: def.id, castId: `${actor.runId || 'solo'}:${++state.sequence}`, origin, direction,
    target: point(origin.x + direction.x * range, origin.z + direction.z * range, .1),
    duration: def.duration, impactAt: def.windup, travelDuration: def.travelTime || (def.speed ? def.range / def.speed : 0),
    damageMultiplier: clamp(actor.damageMultiplier, 1, 100, 2) * getSkillModifiers(state).damage,
    // Only the caller's trusted progression supplies this; the network intent is never read for it.
    areaMultiplier: sanitizeAreaMultiplier(actor.areaMultiplier), radius: getSkillRadius(def, actor.areaMultiplier),
    elapsed: 0, distance: 0, released: false, hitIds: new Set(), done: false, ...(mods ? { mods } : {}) };
  state.active.push(cast);
  return { ok: true, castId: cast.castId, event: { ...eventFor(cast, 'cast'), ...(mods ? { mods } : {}) } };
}
export function cancelSkills(state, emit = () => {}, reason = 'cancelled') {
  for (const value of [state.buff, ...state.fields].filter(Boolean)) emit(persistentEvent(value, 'end', { remaining: 0, reason }));
  for (const cast of state.active) emit({ ...eventFor(cast, 'end'), reason, terminal: true });
  state.active.length = 0; state.fields.length = 0; state.buff = null; state.movement = null; state.lock = 0;
  if (state.guard) state.guard = null;
}
// Targets are authority-owned bodies. move callbacks resolve physics and return actual x/z.
export function advanceSkills(state, dt, { targets = [], hit = () => false, emit = () => {}, sweepStatic = null, moveCaster = null, moveTarget = null, pullTargets = null, dead = false, actor = null, skillMods = null } = {}) {
  if (dead) { cancelSkills(state, emit, 'death'); return; }
  dt = clamp(dt, 0, .1, 0); if (!dt) return;
  const resourceMods = sanitizeSkillMods(skillMods);
  state.resource = Math.min(Math.max(resourceMods.resourceMax, state.resource), state.resource + CLASS_RESOURCES[state.classId].regeneration * resourceMods.resourceRegen * dt);
  state.lock = Math.max(0, state.lock - dt); state.cooldowns = state.cooldowns.map(v => Math.max(0, v - dt));
  if (state.guard) { state.guard.remaining = Math.max(0, state.guard.remaining - dt); if (!state.guard.remaining) state.guard = null; }
  if (state.buff) {
    state.buff.remaining = Math.max(0, state.buff.remaining - dt);
    if (actor) state.buff.origin = point(actor.x, actor.z, .1);
    refreshPersistent(state.buff, dt, emit);
    if (!state.buff.remaining) state.buff = null;
  }
  for (const field of state.fields) {
    const step = Math.min(dt, field.remaining); field.remaining = Math.max(0, field.remaining - step);
    if (field.status === 'napalm') burnField(field, step, targets, hit, sweepStatic);
    else if (pullTargets) pullTargets(targets, field, step);
    else for (const target of targets) {
      if (target.dead || target.health <= 0) continue;
      const dx = field.x - target.x, dz = field.z - target.z, distance = Math.hypot(dx, dz), rest = Math.max(.55, target.radius || .5);
      if (distance > field.radius + (target.radius || 0) || distance <= rest) continue;
      const amount = Math.min(distance - rest, 4.5 * step * (target.boss ? .35 : 1));
      const moved = moveTarget?.(target, { x: dx / distance * amount, z: dz / distance * amount }, field);
      if (moved) { target.x = moved.x; target.z = moved.z; }
    }
    if (!field.remaining && field.collapse) collapseField(field, targets, hit, emit, sweepStatic);
    refreshPersistent(field, dt, emit);
  }
  state.fields = state.fields.filter(f => f.remaining > 0);
  for (const cast of state.active) {
    const def = getClassSkill(cast.skillId), previousElapsed = cast.elapsed, range = castRange(cast, def);
    if (cast.mods?.frostHop && !cast.released && !(cast.hopped >= cast.mods.frostHop)) hopCaster(state, cast, dt, { actor, emit, sweepStatic, moveCaster });
    cast.elapsed += dt; if (cast.elapsed < def.windup) continue;
    if (!cast.released) {
      if (Number.isFinite(actor?.x) && Number.isFinite(actor?.z)) cast.origin = point(actor.x, actor.z, def.shape === 'projectile' ? 1.05 : .1);
      cast.target = point(cast.origin.x + cast.direction.x * range, cast.origin.z + cast.direction.z * range, cast.origin.y);
      cast.position = { ...cast.origin }; cast.released = true;
      emit(eventFor(cast, 'release', cast.origin, cast.origin));
    }
    const travelDt = cast.elapsed - Math.max(previousElapsed, def.windup);
    if (def.shape === 'buff') {
      if (!cast.buffed) {
        const buffDuration = def.buffDuration + (cast.mods?.warCryDuration || 0);
        state.buff = { skillId: def.id, castId: cast.castId, status: 'buff', remaining: buffDuration, duration: buffDuration, damageMultiplier: def.damageBoost, speedMultiplier: def.speedBoost, origin: { ...cast.origin }, x: cast.origin.x, y: .1, z: cast.origin.z, radius: def.radius,
          ...(cast.mods?.warCryKillHeal ? { killHeal: cast.mods.warCryKillHeal } : {}) };
        emit(persistentEvent(state.buff, 'status')); cast.buffed = true;
        if (cast.mods?.warCryShockwave) { const shock = SKILL_MOD_EFFECTS.warCryShockwave;
          burstHit(cast, def, cast.origin, shock.radius, targets, hit, emit, sweepStatic, { mod: 'warCryShockwave', damage: shock.damage, stun: shock.stun });
          cast.push = shock.pushTime; }
      }
      if (cast.push > 0) pushTargets(cast, Math.min(cast.push, Math.max(travelDt, 0)), targets, moveTarget);
      if (!(cast.push > 0)) cast.done = true;
    } else if (def.shape === 'dash') {
      const previous = { ...cast.position }, amount = Math.min(range - cast.distance, range / def.travelTime * travelDt);
      const requested = point(previous.x + cast.direction.x * amount, previous.z + cast.direction.z * amount, .1);
      const wall = sweepStatic?.(previous, requested, .64, 'actor');
      const end = wall ? interpolate(previous, requested, Math.max(0, wall.t - 1e-5)) : requested;
      const moved = moveCaster?.({ x: end.x - previous.x, z: end.z - previous.z }, cast) || previous;
      const next = point(moved.x, moved.z, .1); cast.distance += Math.hypot(next.x - previous.x, next.z - previous.z); cast.position = next;
      if (actor) { actor.x = next.x; actor.z = next.z; }
      const terminal = Boolean(wall) || cast.elapsed >= def.windup + def.travelTime || cast.distance >= range - .001;
      state.movement = terminal ? null : { skillId: cast.skillId, castId: cast.castId, remaining: Math.max(0, def.windup + def.travelTime - cast.elapsed) };
      emit({ ...eventFor(cast, 'travel', previous, next), terminal, actorPosition: { ...next } });
      for (const target of targets) {
        if (target.dead || target.health <= 0 || cast.hitIds.has(target.id)) continue;
        const t = segmentContact(previous, next, target, def.radius); if (t === null) continue;
        const contact = interpolate(previous, next, t);
        if (sweepStatic?.({ ...contact, y: .9 }, point(target.x, target.z, .9), 0, 'projectile')) continue;
        const killed = applyHit(cast, def, target, hit, emit);
        emit({ ...eventFor(cast, 'impact', contact, point(target.x, target.z, .8), String(target.id)), targetId: target.id, killed });
        if (killed && cast.mods) creditDashKill(state, cast, resourceMods.resourceMax);
      }
      if (terminal && cast.mods) finishDash(state, cast, def, next, targets, hit, emit, sweepStatic);
      if (terminal) { cast.done = true; emit({ ...eventFor(cast, 'end', next, next), terminal: true }); }
    } else {
      const previous = { ...cast.position }; cast.distance = Math.min(def.range, cast.distance + def.speed * travelDt);
      let next = point(cast.origin.x + cast.direction.x * cast.distance, cast.origin.z + cast.direction.z * cast.distance, cast.origin.y);
      const wall = sweepStatic?.(previous, next, def.projectileRadius, 'projectile');
      const contacts = targets.filter(t => !t.dead && !(t.health <= 0)).map(target => ({ target, t: segmentContact(previous, next, target, def.projectileRadius) }))
        .filter(c => c.t !== null && (!wall || c.t < wall.t)).sort((a, b) => a.t - b.t || String(a.target.id).localeCompare(String(b.target.id)));
      const contactT = contacts[0]?.t ?? wall?.t;
      if (contactT !== undefined) next = interpolate(previous, next, contactT);
      const terminal = contactT !== undefined || cast.distance >= def.range;
      cast.position = next; emit({ ...eventFor(cast, 'travel', previous, next), terminal });
      if (terminal) {
        for (const target of targets) {
          if (target.dead || target.health <= 0 || Math.hypot(target.x - next.x, target.z - next.z) > cast.radius + (target.radius || 0)) continue;
          if (sweepStatic?.(next, point(target.x, target.z, next.y), 0, 'projectile')) continue;
          applyHit(cast, def, target, hit, emit);
        }
        emit(eventFor(cast, 'impact', cast.origin, next, 'area'));
        if (def.fieldDuration) {
          const fieldDuration = def.fieldDuration + (cast.mods?.gravityDuration || 0);
          const field = { skillId: def.id, castId: cast.castId, status: 'gravity', x: next.x, y: .08, z: next.z, radius: cast.radius, areaMultiplier: cast.areaMultiplier, remaining: fieldDuration, duration: fieldDuration, origin: { ...next },
            ...(cast.mods?.gravityCollapse ? { collapse: 1, damageMultiplier: cast.damageMultiplier, ...(cast.mods.frostShatter ? { shatter: cast.mods.frostShatter } : {}) } : {}) };
          state.fields.push(field); emit(persistentEvent(field, 'status'));
        }
        if (cast.mods?.cannonNapalm) { const napalm = SKILL_MOD_EFFECTS.cannonNapalm;
          const field = { skillId: def.id, castId: cast.castId, status: 'napalm', mod: 'cannonNapalm', x: next.x, y: .08, z: next.z, radius: cast.radius, areaMultiplier: cast.areaMultiplier, remaining: napalm.duration, duration: napalm.duration, origin: { ...next },
            level: cast.mods.cannonNapalm, tick: napalm.interval, damageMultiplier: cast.damageMultiplier, ...(cast.mods.frostShatter ? { shatter: cast.mods.frostShatter } : {}) };
          state.fields.push(field); emit(persistentEvent(field, 'status')); }
        cast.done = true;
      }
    }
  }
  state.active = state.active.filter(cast => !cast.done);
}
// `bonus` marks a hit that exists only because of a skill upgrade: { mod, damage, stun }. Its events carry `mod`
// so presentation can route them; the base hit of every skill is untouched.
function applyHit(cast, def, target, hit, emit, bonus = null) {
  if (cast.hitIds.has(target.id)) return false; cast.hitIds.add(target.id);
  const freeze = bonus ? 0 : def.freeze, stun = bonus ? bonus.stun || 0 : def.stun;
  const status = freeze ? 'freeze' : stun ? 'stun' : null;
  const duration = status === 'freeze' ? (target.boss ? Math.min(.8, freeze) : freeze) : status === 'stun' ? (target.boss ? Math.min(.65, stun) : stun) : 0;
  const shatter = shatterScale(cast.mods?.frostShatter, target), scale = (bonus ? 1 : cast.mods?.dashDamage || cast.mods?.cannonDamage || 1) * shatter;
  const base = (bonus ? bonus.damage : def.damage) * cast.damageMultiplier;
  const effect = { damage: scale === 1 ? base : base * scale, skillId: def.id, castId: cast.castId, element: def.element,
    status, statusDuration: duration, freeze: status === 'freeze' ? duration : 0, stun: status === 'stun' ? duration : 0, resisted: Boolean(status && target.boss),
    deathStyle: def.id === 'warrior_cleaving_dash' && !bonus ? 'cleave' : null, direction: { ...cast.direction }, ...(bonus ? { mod: bonus.mod } : {}), ...(shatter > 1 ? { shattered: true } : {}) };
  const killed = Boolean(hit(target, effect));
  if (status && !killed) emit({ ...eventFor(cast, 'status', cast.origin, point(target.x, target.z, .8), String(target.id)), targetId: target.id, status, remaining: duration, statusDuration: duration, resisted: effect.resisted, ...(bonus ? { mod: bonus.mod } : {}) });
  return killed;
}
// Estilhaçar reads the victim's state before this hit lands, so the Disparo Glacial never boosts itself on a fresh target.
const shatterScale = (shatter, target) => shatter > 0 && target.freezeTimer > 0 ? 1 + shatter : 1;
const alive = target => !target.dead && !(target.health <= 0);
const within = (target, centre, radius) => Math.hypot(target.x - centre.x, target.z - centre.z) <= radius + (target.radius || 0);
// Upgrade bursts reuse the impact rules: one hit per victim per cast and solids block line of sight.
function burstHit(cast, def, centre, radius, targets, hit, emit, sweepStatic, bonus) {
  const at = point(centre.x, centre.z, .9); let victims = 0;
  for (const target of targets) {
    if (!alive(target) || cast.hitIds.has(target.id) || !within(target, at, radius)) continue;
    if (sweepStatic?.(at, point(target.x, target.z, .9), 0, 'projectile')) continue;
    applyHit(cast, def, target, hit, emit, bonus); victims++;
  }
  emit({ ...eventFor(cast, 'impact', at, point(at.x, at.z, .1), bonus.mod), mod: bonus.mod, radius, victims });
}
function pushTargets(cast, step, targets, moveTarget) {
  const shock = SKILL_MOD_EFFECTS.warCryShockwave; cast.push = Math.max(0, cast.push - step);
  if (!(step > 0)) return;
  for (const target of targets) {
    if (!alive(target) || !cast.hitIds.has(target.id)) continue;
    let dx = target.x - cast.origin.x, dz = target.z - cast.origin.z; const distance = Math.hypot(dx, dz);
    if (distance < 1e-6) { dx = cast.direction.x; dz = cast.direction.z; } else { dx /= distance; dz /= distance; }
    const amount = shock.push / shock.pushTime * step * (target.boss ? .35 : 1);
    const moved = moveTarget?.(target, { x: dx * amount, z: dz * amount }, cast);
    if (moved) { target.x = moved.x; target.z = moved.z; }
  }
}
function creditDashKill(state, cast, resourceMax) {
  cast.kills = (cast.kills || 0) + 1;
  const refund = Math.min(cast.mods.dashKillFervor || 0, SKILL_MOD_EFFECTS.dashKillFervor.castLimit - (cast.refunded || 0));
  if (refund > 0) { cast.refunded = (cast.refunded || 0) + refund; state.resource = Math.min(Math.max(resourceMax, state.resource), state.resource + refund); }
}
function finishDash(state, cast, def, end, targets, hit, emit, sweepStatic) {
  if (cast.mods.chargeShockwave) { const shock = SKILL_MOD_EFFECTS.chargeShockwave; burstHit(cast, def, end, shock.radius, targets, hit, emit, sweepStatic, { mod: 'chargeShockwave', damage: shock.damage, stun: def.stun }); }
  if (cast.mods.chargeBastion) { const duration = SKILL_MOD_EFFECTS.chargeBastion.duration; state.guard = { skillId: def.id, castId: cast.castId, status: 'guard', remaining: duration, duration, reduction: cast.mods.chargeBastion }; }
  if (cast.mods.dashMultiKill && cast.kills >= SKILL_MOD_EFFECTS.dashMultiKill.kills) {
    state.cooldowns[def.slot] = Math.round(state.cooldowns[def.slot] * (1 - cast.mods.dashMultiKill) * 1000) / 1000;
    emit({ ...eventFor(cast, 'impact', end, end, 'dashMultiKill'), mod: 'dashMultiKill', kills: cast.kills, cooldown: state.cooldowns[def.slot] });
  }
}
function hopCaster(state, cast, dt, { actor, emit, sweepStatic, moveCaster }) {
  const total = cast.mods.frostHop; cast.hopped ??= 0;
  if (!Number.isFinite(actor?.x) || !Number.isFinite(actor?.z)) { cast.hopped = total; return; }
  const amount = Math.min(total - cast.hopped, total / SKILL_MOD_EFFECTS.frostHop.time * dt), previous = point(actor.x, actor.z, .1);
  const requested = point(previous.x - cast.direction.x * amount, previous.z - cast.direction.z * amount, .1);
  const wall = sweepStatic?.(previous, requested, .64, 'actor');
  const end = wall ? interpolate(previous, requested, Math.max(0, wall.t - 1e-5)) : requested;
  const moved = moveCaster?.({ x: end.x - previous.x, z: end.z - previous.z }, cast) || previous, next = point(moved.x, moved.z, .1);
  actor.x = next.x; actor.z = next.z; cast.hopped += amount;
  const terminal = Boolean(wall) || cast.hopped >= total - 1e-6; if (terminal) cast.hopped = total;
  state.movement = terminal ? null : { skillId: cast.skillId, castId: cast.castId, hop: true, remaining: Math.max(1e-3, (total - cast.hopped) / total * SKILL_MOD_EFFECTS.frostHop.time) };
  emit({ ...eventFor(cast, 'travel', previous, next), mod: 'frostHop', terminal, actorPosition: { ...next } });
}
function fieldEffect(field, target, damage, mod) {
  return { damage: damage * clamp(field.damageMultiplier, 1, 100, 2) * shatterScale(field.shatter, target), skillId: field.skillId, castId: field.castId, element: getClassSkill(field.skillId).element,
    status: null, statusDuration: 0, freeze: 0, stun: 0, resisted: false, deathStyle: null, direction: { x: 0, y: 0, z: -1 }, mod };
}
function fieldVictims(field, targets, sweepStatic) {
  const centre = point(field.x, field.z, .9);
  return targets.filter(target => alive(target) && within(target, centre, field.radius) && !sweepStatic?.(centre, point(target.x, target.z, .9), 0, 'projectile'));
}
// Napalm: the explosion area keeps burning. Whole intervals only, so damage never depends on the tick rate.
function burnField(field, step, targets, hit, sweepStatic) {
  const napalm = SKILL_MOD_EFFECTS.cannonNapalm; field.tick = (field.tick ?? napalm.interval) - step;
  while (field.tick <= 1e-9) { field.tick += napalm.interval;
    for (const target of fieldVictims(field, targets, sweepStatic)) hit(target, fieldEffect(field, target, napalm.damage * (field.level || 1), 'cannonNapalm')); }
}
function collapseField(field, targets, hit, emit, sweepStatic) {
  const victims = fieldVictims(field, targets, sweepStatic);
  for (const target of victims) hit(target, fieldEffect(field, target, SKILL_MOD_EFFECTS.gravityCollapse.damage, 'gravityCollapse'));
  emit(persistentEvent(field, 'impact', { mod: 'gravityCollapse', victims: victims.length, contactId: 'gravityCollapse' }));
}
export function applySkillControl(target, effect) {
  if (!effect.status) return;
  const key = effect.status === 'freeze' ? 'freezeTimer' : 'stunTimer';
  if ((target[key] || 0) > effect.statusDuration) return;
  target[key] = effect.statusDuration; target.skillStatuses ??= {};
  target.skillStatuses[effect.status] = { status: effect.status, skillId: effect.skillId, castId: effect.castId, remaining: effect.statusDuration, statusDuration: effect.statusDuration, resisted: effect.resisted };
  if (target.meleeAttack) target.meleeAttack.active = false;
}
export function tickSkillControl(target, dt, emit = () => {}, position = target) {
  if (!(dt > 0)) return;
  for (const status of ['freeze', 'stun']) {
    const key = status === 'freeze' ? 'freezeTimer' : 'stunTimer'; target[key] = Math.max(0, (target[key] || 0) - Math.min(.1, dt));
    const record = target.skillStatuses?.[status]; if (!record) continue; record.remaining = target[key];
    if (!record.remaining) { emit({ ...record, phase: 'end', origin: point(position.x, position.z, .8), target: point(position.x, position.z, .8), targetId: target.id, contactId: String(target.id), groundY: .04 }); delete target.skillStatuses[status]; }
  }
}
function refreshPersistent(value, dt, emit) {
  value.refresh = (value.refresh || 0) - dt;
  if (value.remaining <= 0 || value.refresh <= 0) {
    value.refresh = .1; emit(persistentEvent(value, value.remaining > 0 ? 'status' : 'end'));
  }
}
function persistentEvent(value, phase, extra = {}) {
  const target = value.status === 'buff' ? value.origin : point(value.x, value.z, value.y);
  return { skillId: value.skillId, castId: value.castId, phase, status: value.status, origin: { ...target }, target: { ...target }, radius: value.radius, areaMultiplier: value.areaMultiplier ?? 1,
    remaining: value.remaining, statusDuration: value.duration, duration: value.duration, groundY: .04, ...(value.mod ? { mod: value.mod } : {}), ...extra };
}
function eventFor(cast, phase, origin = cast.origin, target = cast.target, contactId) {
  const def = getClassSkill(cast.skillId);
  return { skillId: cast.skillId, castId: cast.castId, phase, origin: { ...origin }, direction: { ...cast.direction }, target: { ...target }, duration: cast.duration, impactAt: cast.impactAt,
    travelDuration: cast.travelDuration, radius: cast.radius ?? def.radius, areaMultiplier: cast.areaMultiplier ?? 1, groundY: .04, ...(contactId !== undefined ? { contactId } : {}) };
}
const point = (x, z, y = 0) => ({ x: Number.isFinite(x) ? x : 0, y, z: Number.isFinite(z) ? z : 0 });
const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
function snapshotActive(cast) {
  const def = getClassSkill(cast?.skillId);
  if (!def || cast.done) return null;
  const origin = point(cast.origin?.x, cast.origin?.z, Number.isFinite(cast.origin?.y) ? cast.origin.y : .1);
  const position = point(cast.position?.x ?? origin.x, cast.position?.z ?? origin.z, Number.isFinite(cast.position?.y) ? cast.position.y : origin.y);
  const hitIds = [...(cast.hitIds instanceof Set ? cast.hitIds : [])].map(id => String(id)).slice(0, 64), mods = freezeCastMods(def, cast.mods);
  return {
    skillId: def.id, castId: String(cast.castId || ''), origin, position, direction: { ...cast.direction },
    target: point(cast.target?.x, cast.target?.z, Number.isFinite(cast.target?.y) ? cast.target.y : origin.y),
    duration: def.duration, impactAt: def.windup, travelDuration: cast.travelDuration || 0,
    areaMultiplier: sanitizeAreaMultiplier(cast.areaMultiplier), radius: getSkillRadius(def, cast.areaMultiplier),
    damageMultiplier: clamp(cast.damageMultiplier, 1, 100, 2), elapsed: clamp(cast.elapsed, 0, 8, 0),
    distance: clamp(cast.distance, 0, castRange({ mods }, def), 0), released: Boolean(cast.released), done: false, hitIds, ...(mods ? { mods } : {}),
  };
}
function restoreActive(cast) {
  const def = getClassSkill(cast?.skillId);
  if (!def || cast?.done) return null;
  const origin = point(cast.origin?.x, cast.origin?.z, Number.isFinite(cast.origin?.y) ? cast.origin.y : .1);
  const ids = Array.isArray(cast.hitIds) ? cast.hitIds.map(id => String(id)).slice(0, 64) : [], mods = freezeCastMods(def, cast.mods);
  return {
    skillId: def.id, castId: String(cast.castId || ''), origin, direction: { x: clamp(cast.direction?.x, -1, 1, 0), y: 0, z: clamp(cast.direction?.z, -1, 1, -1) },
    target: point(cast.target?.x, cast.target?.z, Number.isFinite(cast.target?.y) ? cast.target.y : origin.y),
    position: point(cast.position?.x ?? origin.x, cast.position?.z ?? origin.z, Number.isFinite(cast.position?.y) ? cast.position.y : origin.y),
    duration: def.duration, impactAt: def.windup, travelDuration: clamp(cast.travelDuration, 0, 8, 0),
    areaMultiplier: sanitizeAreaMultiplier(cast.areaMultiplier), radius: getSkillRadius(def, cast.areaMultiplier),
    damageMultiplier: clamp(cast.damageMultiplier, 1, 100, 2), elapsed: clamp(cast.elapsed, 0, 8, 0),
    distance: clamp(cast.distance, 0, castRange({ mods }, def), 0), released: Boolean(cast.released), done: false, hitIds: new Set(ids), ...(mods ? { mods } : {}),
  };
}
function clamp(value, min, max, fallback) { return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback; }
function segmentContact(start, end, target, radius) {
  const dx = end.x - start.x, dz = end.z - start.z, fx = start.x - target.x, fz = start.z - target.z, r = radius + (target.radius || 0), c = fx * fx + fz * fz - r * r;
  if (c <= 0) return 0; const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), disc = b * b - 4 * a * c;
  if (a < 1e-12 || disc < 0) return null; const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : null;
}
