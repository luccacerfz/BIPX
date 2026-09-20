// Server-owned per-run progression. Pure CPU module: callers supply only trusted
// kill/tick/damage events; network clients can choose offered IDs or collect drops.
import { heroMaxHealth, xpToNext as heroXpToNext, offerSpacing } from '../combat/hero-power.mjs';
import { SKILL_UPGRADES, SKILL_UPGRADE_WEIGHTS, EXHAUSTED_REWARD, isUpgradeForClass, getSkillMods } from './skill-upgrades.mjs';
import { RELICS, BOSS_RELIC_DROPS, FALLBACK_INFUSION_SECONDS, AUTO_WEAPONS, nextRelicDrop, getAutoWeaponLoadout, getRelicName } from '../combat/arsenal.mjs';
export const RELIC_ECHO_DURATION = 8;
export const DEFINITIONS = [
  ['damage', '+Dano', 'common', 'stat', 1, 6],
  ['cadence', '+Cadência', 'common', 'stat', 1, 5],
  ['area', '+Área', 'common', 'stat', 1, 5],
  ['speed', '+Velocidade', 'common', 'stat', 1, 4],
  ['pickup', '+Raio de coleta', 'common', 'stat', 1, 5],
  ['maxHealth', '+Vida máxima', 'common', 'stat', 1, 4],
  ['projectile', '+Projétil extra', 'common', 'stat', 1, 3],
  ['autoWeapon', 'Desbloquear arma automática', 'common', 'stat', 1, 3],
  ['soulMagnet', 'Ímã de Almas', 'rare', 'perk', 2, 2],
  ['ironBlood', 'Sangue de Ferro', 'rare', 'perk', 2, 3],
  ['bladeEcho', 'Eco da Lâmina', 'rare', 'perk', 2, 2],
  ['hunterEye', 'Olho do Caçador', 'rare', 'perk', 2, 3],
  ['sealRitual', 'Ritual de Selos', 'epic', 'perk', 5, 2],
  ['ashenHeart', 'Coração de Cinzas', 'epic', 'perk', 5, 2],
  ['prismStorm', 'Tempestade Prismática', 'epic', 'perk', 5, 1],
  ['cuttingMoon', 'Lua Cortante', 'legendary', 'perk', 10, 1],
  ['lastBreath', 'Último Fôlego', 'legendary', 'perk', 10, 1],
  ['slayerPact', 'Pacto do Exterminador', 'legendary', 'perk', 10, 1],
].map(([id, label, rarity, kind, minLevel, maxStacks]) => Object.freeze({id, label, rarity, kind, minLevel, maxStacks, weight: rarity === 'common' ? 72 : undefined}))
  // Upgrades 2.0: class skill cards (kind 'skill'), class-filtered in available().
  .concat(SKILL_UPGRADES.map(({id, label, rarity, kind, minLevel, maxStacks, classId, skillId}) => Object.freeze({id, label, rarity, kind, minLevel, maxStacks, weight: undefined, classId, skillId})));
const byId = new Map(DEFINITIONS.map(d => [d.id, d]));
const rarityRank = {common: 0, rare: 1, epic: 2, legendary: 3};
const weights = {common: 88, rare: 7, epic: 3.2, legendary: .35};
const bossWeights = {rare: 86, epic: 13, legendary: 1};
const copy = value => structuredClone(value);
const safeInt = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
// The max-health card is authoritative here so the server, solo mirror and
// immutable previews cannot drift by repeating the increment in each caller.
export const MAX_HEALTH_UPGRADE = 18;
export function maxHealthForStacks(character, stacks = {}) {
  return heroMaxHealth(character) + safeInt(stacks.maxHealth) * MAX_HEALTH_UPGRADE;
}
export const xpToNext = heroXpToNext; // Pacing lives in hero-power.mjs, shared with the solo client.
export function levelFromXp(total) {
  let xp = safeInt(total), level = 1;
  while (xp >= xpToNext(level)) { xp -= xpToNext(level); level++; }
  return {level, xp, xpToNext: xpToNext(level)};
}
export function createProgression(state, {random = Math.random} = {}) {
  const p = {runId: state.runId, character: state.character, xpTotal: 0,
    level: 1, xp: 0, xpToNext: xpToNext(1), pendingLevelUps: 0,
    stacks: {}, offer: null, offerSerial: 0, nextOfferAt: 0, rarityPity: 0,
    bossKills: 0, revives: 0, weaponTimer: 0, relicEcho: null, prismStormRemaining: 0, exhaustedRewards: 0,
    drops: new Map(), dropSerial: 0, dropCounter: 0, receipts: new Map(),
    random, clock: 0};
  syncProgression(state, p);
  return p;
}
export function available(p, definition, source = 'level') {
  if (!definition) return false;
  if (p.character === 'warrior' && ['projectile', 'prismStorm'].includes(definition.id)) return false;
  if (!isUpgradeForClass(definition, p.character)) return false;
  if (source === 'bossChest' && rarityRank[definition.rarity] < 1) return false;
  if (!(source === 'bossChest' && definition.rarity !== 'legendary') && p.level < definition.minLevel) return false;
  return (p.stacks[definition.id] || 0) < definition.maxStacks;
}
function pick(p, values, weight) {
  const total = values.reduce((sum, value) => sum + weight(value), 0);
  let roll = p.random() * total;
  return values.find(value => (roll -= weight(value)) <= 0) || values.at(-1);
}
function rollChoices(p, source) {
  let pool = DEFINITIONS.filter(d => available(p, d, source));
  const selected = [];
  while (selected.length < 3 && pool.length) {
    let nextPool = pool;
    // The first card of every offer belongs to the class while any skill card is available (all are rare+,
    // so it also satisfies the pity rule below).
    const classPool = selected.length ? [] : pool.filter(d => d.kind === 'skill');
    if (classPool.length) nextPool = classPool;
    else if (source === 'level' && p.rarityPity >= 8 && !selected.length) {
      const rare = pool.filter(d => rarityRank[d.rarity] >= 1);
      if (rare.length) nextPool = rare;
    }
    const item = pick(p, nextPool, d => source === 'bossChest' ? bossWeights[d.rarity] : nextPool === classPool ? SKILL_UPGRADE_WEIGHTS[d.rarity] : d.weight ?? weights[d.rarity]);
    selected.push(item.id); pool = pool.filter(d => d !== item);
  }
  if (source === 'level') p.rarityPity = selected.some(id => rarityRank[byId.get(id).rarity] >= 1) ? 0 : p.rarityPity + 1;
  return selected;
}
// Nothing left to offer: every surplus level-up (or boss chest) pays a heal and score instead of vanishing.
function payExhausted(state, p, count) {
  if (!(count > 0) || !(state.health > 0)) return;
  state.health = Math.min(state.maxHealth, state.health + state.maxHealth * EXHAUSTED_REWARD.healFraction * count);
  state.score = Math.max(0, Math.floor((state.score || 0) + EXHAUSTED_REWARD.score * count));
  p.exhaustedRewards += count;
}
function openOffer(state, p, source = 'level') {
  if (p.offer) return false;
  const upgradeIds = rollChoices(p, source);
  if (!upgradeIds.length) { if (source === 'level') { payExhausted(state, p, p.pendingLevelUps); p.pendingLevelUps = 0; } return false; }
  p.offer = {id: `${p.runId}:choice:${++p.offerSerial}`, source, upgradeIds};
  return true;
}
// Offer spacing (hero-power.mjs): choosing a card starts a gap of gameplay time; level-ups earned meanwhile are banked, never
// lost, and tickProgression opens the next offer when the gap ends. An exhausted pool has nothing to space: it pays at once.
function openLevelOffer(state, p) {
  if (p.offer || !(p.pendingLevelUps > 0)) return false;
  if (p.clock < p.nextOfferAt && DEFINITIONS.some(d => available(p, d, 'level'))) return false;
  return openOffer(state, p);
}
export function stats(p) {
  const s = p.stacks;
  return {damageMultiplier: 2 + (s.damage || 0) * .16,
    cooldownMultiplier: Math.max(.48, .9 ** (s.cadence || 0)),
    areaMultiplier: 1 + (s.area || 0) * .13,
    speedMultiplier: 1 + (s.speed || 0) * .1,
    pickupRadius: 2.35 + (s.pickup || 0) * 1.2,
    projectileBonus: p.character === 'warrior' ? 0 : s.projectile || 0};
}
// Trusted class skill mods for beginSkill/advanceSkills/getSkillHud. Derived from owned stacks only.
export const skillMods = p => getSkillMods(p.stacks, p.character);
export function attackStats(p) {
  const base = stats(p);
  return {damageMultiplier: base.damageMultiplier * (p.weaponTimer > 0 ? 1.4 : 1),
    cooldownMultiplier: base.cooldownMultiplier,
    areaMultiplier: base.areaMultiplier * (p.prismStormRemaining > 0 ? 1.35 : 1),
    projectileBonus: p.character === 'warrior' ? 0 : base.projectileBonus + (p.prismStormRemaining > 0 ? 1 : 0)};
}
export function snapshot(p) {
  return {xp: p.xp, xpToNext: p.xpToNext, pendingLevelUps: p.pendingLevelUps,
    offer: copy(p.offer), upgradeStacks: {...p.stacks}, upgradeStats: stats(p),
    perks: Object.fromEntries(DEFINITIONS.filter(d => d.kind === 'perk' && p.stacks[d.id]).map(d => [d.id, p.stacks[d.id]])),
    damageReduction: Math.min(.48, (p.stacks.ironBlood || 0) * .12),
    critChance: Math.min(.42, (p.stacks.hunterEye || 0) * .08), critMultiplier: 1.8,
    bossKills: p.bossKills, revives: p.revives, rarityPity: p.rarityPity, exhaustedRewards: p.exhaustedRewards,
    weaponTimer: p.weaponTimer, prismStormRemaining: p.prismStormRemaining,
    ...arsenalSnapshot(p),
    drops: [...p.drops.values()].map(d => ({...d, ttl: Math.max(0, d.expiresAt - p.clock)}))};
}
// Relic (temporary infusion of the basic attack) and automatic weapons are server-owned like every other stack.
export const activeRelic = p => p.weaponTimer > 0 && Object.hasOwn(RELICS, p.relic) ? p.relic : null;
export const activeRelicEcho = p => p.relicEcho && p.relicEcho.remaining > 0 && Object.hasOwn(RELICS, p.relicEcho.id) ? p.relicEcho : null;
/** Held relic + optional next drop. Same id refreshes duration and never creates or extends an echo. */
export function replaceRelic(held, nextType, currentEcho = null) {
  const next = Object.hasOwn(RELICS, nextType) ? nextType : null;
  let echo = null;
  if (held && next && next !== held) echo = { id: held, remaining: RELIC_ECHO_DURATION };
  else if (currentEcho && currentEcho.remaining > 0 && Object.hasOwn(RELICS, currentEcho.id)) {
    echo = { id: currentEcho.id, remaining: currentEcho.remaining };
  }
  return { relic: next, duration: next ? RELICS[next].duration : FALLBACK_INFUSION_SECONDS, echo };
}
export function formatRelicEchoHud(echo, classId) {
  const live = echo && echo.remaining > 0 && Object.hasOwn(RELICS, echo.id) ? echo : null;
  if (!live) return null;
  const seconds = Math.ceil(live.remaining);
  const short = RELICS[live.id].short;
  const name = getRelicName(live.id, classId) || RELICS[live.id].label;
  return { id: live.id, remaining: live.remaining, short, name, text: `Eco · ${short} · ${seconds}s`, aria: `eco da relíquia anterior ${name}, ${seconds} segundos` };
}
/** Drop nonfinite/non-positive remaining and unknown ids. Does not trust extra client fields. */
export function sanitizeRelicEcho(incoming) {
  if (!incoming || typeof incoming !== 'object') return null;
  const remaining = Number(incoming.remaining);
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (typeof incoming.id !== 'string' || !Object.hasOwn(RELICS, incoming.id)) return null;
  return { id: incoming.id, remaining };
}
/**
 * Client mirror of server-owned relicEcho.
 * newerVersion (new run or higher stateVersion): install the sanitized snapshot, including a valid initial echo.
 * Same-version/stale: cannot create, resurrect, replace identity, or extend remaining.
 */
export function mirrorRelicEcho(local, incoming, { newerVersion = false } = {}) {
  const next = sanitizeRelicEcho(incoming);
  if (newerVersion) return next;
  const held = sanitizeRelicEcho(local);
  if (!held) return null;
  if (!next || next.id !== held.id) return { id: held.id, remaining: held.remaining };
  return { id: held.id, remaining: Math.min(held.remaining, next.remaining) };
}
export function arsenalSnapshot(p) {
  const relic = activeRelic(p);
  const echo = activeRelicEcho(p);
  const hud = formatRelicEchoHud(echo, p.character);
  return {
    relic, relicDuration: relic ? RELICS[relic].duration : p.weaponTimer > 0 ? FALLBACK_INFUSION_SECONDS : 0,
    relicEcho: hud ? { id: hud.id, remaining: echo.remaining, label: hud.short, name: hud.name, text: hud.text, aria: hud.aria } : null,
    autoWeapons: getAutoWeaponLoadout(p.stacks),
  };
}
function rollRelic(p) { const next = nextRelicDrop(p.relicDropIndex, activeRelic(p)); p.relicDropIndex = next.index; return next.type; }
export function syncProgression(state, p) {
  state.xpTotal = p.xpTotal; state.level = p.level;
  state.bestLevel = Math.max(state.bestLevel || 1, p.level);
  state.maxHealth = maxHealthForStacks(p.character, p.stacks);
  state.health = Math.min(state.maxHealth, state.health);
  // Rarest first (stable), so the eight slots of the ranking keep the cards that define the build.
  // Same order as the client death summary: unlocked automatic weapons (evolved name when evolved), then cards rarest first.
  const companions = Object.entries(getAutoWeaponLoadout(p.stacks)).filter(([, weapon]) => weapon.level > 0).map(([id, weapon]) => weapon.evolved ? AUTO_WEAPONS[id].evolution.label : AUTO_WEAPONS[id].label);
  state.build = [...companions, ...Object.entries(p.stacks).filter(([, n]) => n > 0).sort(([a], [b]) => rarityRank[byId.get(b).rarity] - rarityRank[byId.get(a).rarity]).map(([id, n]) => `${byId.get(id).label} x${n}`)].slice(0, 8);
  state.progression = snapshot(p);
  return state;
}
function changed(state, p) { state.stateVersion++; syncProgression(state, p); }
function grant(state, p, upgradeId) {
  p.stacks[upgradeId] = (p.stacks[upgradeId] || 0) + 1;
  if (upgradeId === 'maxHealth') state.health += MAX_HEALTH_UPGRADE;
  if (upgradeId === 'lastBreath') p.revives = Math.max(p.revives, 1);
}
function receipt(p, message, key) {
  if (message?.runId !== p.runId) return {ok: false, code: 'wrong-run'};
  if (typeof message.requestId !== 'string' || !message.requestId.length || message.requestId.length > 96) return {ok: false, code: 'invalid-request'};
  const previous = p.receipts.get(message.requestId);
  if (previous) return previous.key === key ? {ok: true, duplicate: true} : {ok: false, code: 'request-conflict'};
  return null;
}
function remember(p, message, key) {
  p.receipts.set(message.requestId, {key});
  while (p.receipts.size > 256) p.receipts.delete(p.receipts.keys().next().value);
}
export function chooseUpgrade(state, p, message) {
  const key = `choice:${message?.offerId}:${message?.upgradeId}`;
  const replay = receipt(p, message, key); if (replay) return replay;
  if (state.state !== 'playing' || state.health <= 0) return {ok: false, code: 'not-playing'};
  const offer = p.offer;
  if (!offer || offer.id !== message.offerId || !offer.upgradeIds.includes(message.upgradeId)) return {ok: false, code: 'not-offered'};
  if (!available(p, byId.get(message.upgradeId), offer.source)) return {ok: false, code: 'unavailable'};
  grant(state, p, message.upgradeId);
  if (offer.source === 'level') p.pendingLevelUps--;
  p.offer = null;
  p.nextOfferAt = p.clock + offerSpacing(p.clock);
  openLevelOffer(state, p);
  remember(p, message, key); changed(state, p);
  return {ok: true, upgradeId: message.upgradeId};
}
export function grantXp(state, p, amount) {
  // Internal API: never route raw network messages to this function.
  const previousLevel = p.level;
  p.xpTotal += safeInt(amount);
  Object.assign(p, levelFromXp(p.xpTotal));
  const levels = p.level - previousLevel;
  p.pendingLevelUps += levels;
  const effects = [];
  for (let i = 0; i < levels; i++) {
    if (p.stacks.prismStorm) p.prismStormRemaining = 8;
    if (p.stacks.cuttingMoon) effects.push({kind: 'cuttingMoon', radius: 9.5 * attackStats(p).areaMultiplier, damage: 12 * stats(p).damageMultiplier});
  }
  openLevelOffer(state, p);
  changed(state, p);
  return effects;
}
export function resolveDamage(p, amount) {
  let damage = amount * (p.stacks.slayerPact ? 1 + p.bossKills * .07 : 1);
  const critChance = Math.min(.42, (p.stacks.hunterEye || 0) * .08);
  const critical = critChance > 0 && p.random() < critChance;
  if (critical) damage *= 1.8;
  const echo = Boolean(p.stacks.bladeEcho && p.random() < .18 * p.stacks.bladeEcho);
  if (echo) damage += amount * .55;
  return {damage, critical, echo};
}
export function receiveDamage(state, p, amount) {
  if (state.state !== 'playing' || state.health <= 0 || !Number.isFinite(amount) || amount <= 0) return {damage: 0, revived: false};
  const damage = Math.min(120, amount) * (1 - Math.min(.48, (p.stacks.ironBlood || 0) * .12));
  state.health = Math.max(0, state.health - damage);
  let revived = false;
  if (state.health <= 0 && p.revives > 0) {
    p.revives--; state.health = Math.max(1, Math.floor(state.maxHealth * .4)); revived = true;
  } else if (state.health <= 0) { state.state = 'dead'; p.relicEcho = null; }
  changed(state, p);
  return {damage, revived};
}
export function createDrop(p, kind, position, data = {}) {
  const radius = kind === 'bossChest' ? 1.65 : kind === 'healthPotion' ? 1.35 : 1.45;
  const drop = {...data, id: `${p.runId}:drop:${++p.dropSerial}`, kind,
    x: position.x, z: position.z, radius, expiresAt: p.clock + 20};
  p.drops.set(drop.id, drop); return copy(drop);
}
function rollPerk(p, type) {
  const pool = DEFINITIONS.filter(d => d.kind === 'perk' && available(p, d, 'perkDrop'));
  if (!pool.length) return null;
  const chance = ['brute', 'caster'].includes(type) ? {rare: 90, epic: 9, legendary: 1} : {rare: 97, epic: 2.8, legendary: .2};
  const rarity = pick(p, Object.keys(chance), key => chance[key]);
  const fallbacks = {rare: ['rare','epic','legendary'], epic: ['epic','rare'], legendary: ['legendary','epic','rare']};
  for (const candidate of fallbacks[rarity]) {
    const subset = pool.filter(d => d.rarity === candidate);
    if (subset.length) return pick(p, subset, d => weights[d.rarity]);
  }
  return pick(p, pool, d => weights[d.rarity]);
}
export function rewardKill(state, p, monster, {boss = false} = {}) {
  // Called exactly once after the server deletes the dead monster from its Map.
  if (boss) p.bossKills++;
  if (p.stacks.ashenHeart && (boss || ['brute','caster'].includes(monster.type)) && state.health > 0) {
    state.health = Math.min(state.maxHealth, state.health + (boss ? 18 : 8) * p.stacks.ashenHeart);
  }
  const effects = grantXp(state, p, monster.xp);
  if (boss) {
    createDrop(p, 'healthPotion', {x: monster.x + (p.random()-.5)*1.4, z: monster.z + (p.random()-.5)*1.4}, {amount:10,source:monster.type});
    createDrop(p, 'bossChest', {x: monster.x+1.2,z:monster.z+.8}, {bossType:monster.type,source:monster.type});
    createDrop(p, 'weapon', {x: monster.x-1.2,z:monster.z+.8}, {type:BOSS_RELIC_DROPS[monster.type]||rollRelic(p),source:monster.type});
  } else {
    const chances = {zombie:.004,runner:.007,brute:.028,caster:.033,cowWalker:.009,cowCharger:.012,cowBrute:.038};
    if ([...p.drops.values()].filter(d=>d.kind==='perk').length < 4 && p.random() <= (chances[monster.type]??.015) + Math.min(.014,Math.max(0,p.level-5)*.0012)) {
      const perk = rollPerk(p,monster.type);
      if (perk) createDrop(p,'perk',monster,{perkId:perk.id,rarity:perk.rarity,source:monster.type});
    }
    // Kills charge the next relic only while no relic is infused: spikes alternate with plain combat.
    if (!(p.weaponTimer > 0)) p.dropCounter += ['brute','caster'].includes(monster.type) ? 2 : 1;
    const threshold = Math.max(3,6-Math.floor(state.wave/5)-Math.floor(p.level/8));
    if (p.dropCounter >= threshold) {
      p.dropCounter = 0;
      if (p.drops.size < 5) createDrop(p,'weapon',monster,{type:rollRelic(p),source:monster.type});
    }
  }
  syncProgression(state,p);
  return effects;
}
export function collectDrop(state, p, message) {
  const key = `drop:${message?.dropId}`;
  const replay = receipt(p,message,key); if(replay) return replay;
  if (state.state !== 'playing' || state.health <= 0) return {ok:false,code:'not-playing'};
  const drop = p.drops.get(message.dropId);
  if (!drop || drop.expiresAt <= p.clock) return {ok:false,code:'missing-drop'};
  if (Math.hypot(state.x-drop.x,state.z-drop.z) >= drop.radius) return {ok:false,code:'out-of-range'};
  let upgradeId;
  if (drop.kind === 'bossChest') {
    if (p.offer) return {ok:false,code:'choice-pending-or-exhausted'};
    if (!openOffer(state,p,'bossChest')) payExhausted(state,p,1);
  } else if (drop.kind === 'healthPotion') state.health = Math.min(state.maxHealth,state.health+drop.amount);
  else if (drop.kind === 'weapon') {
    const installed = replaceRelic(activeRelic(p), drop.type, p.relicEcho);
    p.relic = installed.relic; p.weaponTimer = installed.duration; p.relicEcho = installed.echo;
  }
  else if (drop.kind === 'perk') {
    if (available(p,byId.get(drop.perkId),'perkDrop')) { upgradeId = drop.perkId; grant(state,p,drop.perkId); }
    // Original rule: capped perk drops still disappear, without adding a stack.
    // A drop may cap a visible option. Issue a fresh offer ID and legal choices
    // so a stale click cannot spend a credit or leave the pending choice stuck.
    if (p.offer && p.offer.upgradeIds.some(id => !available(p,byId.get(id),p.offer.source))) {
      const source=p.offer.source; p.offer=null;
      if (!openOffer(state,p,source) && source==='bossChest') payExhausted(state,p,1);
      if (!p.offer) openLevelOffer(state,p);
    }
  }
  p.drops.delete(drop.id); remember(p,message,key); changed(state,p);
  return {ok:true,kind:drop.kind,upgradeId};
}
export function tickProgression(state,p,dt) {
  if (state.state !== 'playing' || !Number.isFinite(dt) || dt <= 0) return false;
  p.clock += dt;
  const previousWeaponActive = p.weaponTimer > 0;
  const previousPrismActive = p.prismStormRemaining > 0;
  p.weaponTimer = Math.max(0,p.weaponTimer-dt);
  if (!p.weaponTimer) p.relic = null;
  const previousEcho = Boolean(p.relicEcho && p.relicEcho.remaining > 0);
  if (p.relicEcho) {
    p.relicEcho.remaining = Math.max(0, p.relicEcho.remaining - dt);
    if (!(p.relicEcho.remaining > 0)) p.relicEcho = null;
  }
  p.prismStormRemaining = Math.max(0,p.prismStormRemaining-dt);
  let expired = (previousWeaponActive && p.weaponTimer === 0) || (previousPrismActive && p.prismStormRemaining === 0) || (previousEcho && !p.relicEcho);
  for (const [id,drop] of p.drops) if (drop.expiresAt<=p.clock) {p.drops.delete(id);expired=true;}
  // The offer spacing ended with level-ups banked: the next offer opens here and the caller pushes the new state.
  if (p.pendingLevelUps > 0 && !p.offer && p.clock >= p.nextOfferAt) { const banked = p.pendingLevelUps; if (openLevelOffer(state, p) || p.pendingLevelUps !== banked) expired = true; }
  if (expired) state.stateVersion++;
  syncProgression(state,p);
  return expired;
}
