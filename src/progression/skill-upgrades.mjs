// Upgrades 2.0: cards tied to the six class skills and to the class resource. Pure shared data and derivation:
// the authoritative server (authority.mjs), the solo mirror (main.js) and the HUD all read this module.
// Owned stacks are the only input; the simulation (class-skills.mjs) clamps whatever it receives again.
import { CLASS_SKILLS, CLASS_RESOURCES, SKILL_MOD_LIMITS, SKILL_MOD_EFFECTS, NEUTRAL_SKILL_MODS, sanitizeSkillMods } from '../combat/class-skills.mjs';

const shock = SKILL_MOD_EFFECTS.warCryShockwave, quake = SKILL_MOD_EFFECTS.chargeShockwave, napalm = SKILL_MOD_EFFECTS.cannonNapalm;
const pt = value => (Math.round(value * 10) / 10).toLocaleString('pt-BR');
// `mod` is the key of SKILL_MOD_LIMITS the card feeds; `values[n]` is the mod at n stacks. `{recurso}` becomes Fervor/Foco.
const cards = [
  ['warCryDuration', 'Brado Prolongado', 'rare', 2, 'warrior_war_cry', 'warCryDuration', [0, 2, 4, 6], 'O Grito de Guerra dura +2 s por nível.'],
  ['warCryBloodlust', 'Sede de Sangue', 'epic', 4, 'warrior_war_cry', 'warCryKillHeal', [0, 3, 6], `Com o Grito de Guerra ativo, cada abate cura 3 de vida por nível. Chefes curam ${SKILL_MOD_EFFECTS.warCryKillHeal.boss}×.`],
  ['warCryShockwave', 'Brado Trovejante', 'epic', 5, 'warrior_war_cry', 'warCryShockwave', [0, 1], `O Grito de Guerra fere, empurra ${pt(shock.push)} m e atordoa por ${pt(shock.stun)} s os inimigos a até ${pt(shock.radius)} m.`],
  ['dashFervor', 'Ceifa Fervorosa', 'rare', 2, 'warrior_cleaving_dash', 'dashKillFervor', [0, 4, 8, 12], `Cada abate do Corte Devastador devolve 4 de Fervor por nível (até ${SKILL_MOD_EFFECTS.dashKillFervor.castLimit} por corte).`],
  ['dashReach', 'Avanço Implacável', 'rare', 3, 'warrior_cleaving_dash', 'dashRange', [0, 1, 2, 3], 'Corte Devastador: +1 m de alcance e +20% de dano por nível.'],
  ['dashMomentum', 'Ímpeto do Carrasco', 'epic', 5, 'warrior_cleaving_dash', 'dashMultiKill', [0, .35, .7], `Abater ${SKILL_MOD_EFFECTS.dashMultiKill.kills} ou mais inimigos num Corte Devastador reduz a recarga dele em 35% por nível.`],
  ['chargeBastion', 'Bastião', 'epic', 4, 'warrior_shield_charge', 'chargeBastion', [0, .25, .4], `Após a Investida de Escudo, recebe 25% menos dano por ${pt(SKILL_MOD_EFFECTS.chargeBastion.duration)} s (40% no nível 2).`],
  ['chargeShockwave', 'Impacto Sísmico', 'legendary', 8, 'warrior_shield_charge', 'chargeShockwave', [0, 1], `A Investida de Escudo termina numa onda de choque de ${pt(quake.radius)} m que fere e atordoa todos ao redor.`],
  ['cannonPowder', 'Pólvora Negra', 'rare', 2, 'dwarf_explosive_cannon', 'cannonDamage', [1, 1.25, 1.5, 1.75], 'O Canhão Infernal causa +25% de dano por nível.'],
  ['cannonNapalm', 'Napalm Rúnico', 'epic', 5, 'dwarf_explosive_cannon', 'cannonNapalm', [0, 1, 2], `A explosão do Canhão Infernal deixa chamas por ${pt(napalm.duration)} s que queimam quem ficar na área. Nível 2 dobra o dano.`],
  ['frostShatter', 'Estilhaçar', 'epic', 4, 'dwarf_frost_shot', 'frostShatter', [0, .35, .7], 'Suas habilidades causam +35% de dano por nível a inimigos congelados.'],
  ['frostHop', 'Recuo Tático', 'rare', 3, 'dwarf_frost_shot', 'frostHop', [0, 4], 'Ao usar o Disparo Glacial, Lyra salta 4 m para trás antes do tiro.'],
  ['gravityDuration', 'Horizonte de Eventos', 'rare', 3, 'dwarf_gravity_shot', 'gravityDuration', [0, 1.5, 3, 4.5], 'O Núcleo Gravitacional dura +1,5 s por nível.'],
  ['gravityCollapse', 'Colapso do Núcleo', 'legendary', 8, 'dwarf_gravity_shot', 'gravityCollapse', [0, 1], 'Ao se esgotar, o Núcleo Gravitacional implode e causa dano pesado a todos dentro do campo.'],
  ['resourceMax', 'Reserva Profunda', 'rare', 2, null, 'resourceMax', [100, 115, 130, 145], '+15 de {recurso} máximo por nível.'],
  ['resourceRegen', 'Fôlego de Batalha', 'rare', 2, null, 'resourceRegen', [1, 1.2, 1.4, 1.6], 'Regenera {recurso} 20% mais rápido por nível.'],
  ['skillThrift', 'Economia de Guerra', 'epic', 4, null, 'costMultiplier', [1, .88, .76], 'Habilidades custam 12% menos {recurso} por nível.'],
  ['skillHaste', 'Ritmo Implacável', 'epic', 4, null, 'cooldownMultiplier', [1, .9, .8, .7], 'Reduz a recarga de todas as habilidades em 10% por nível.'],
];
const skillById = new Map(CLASS_SKILLS.map(def => [def.id, def]));
export const SKILL_UPGRADES = Object.freeze(cards.map(([id, label, rarity, minLevel, skillId, mod, values, description]) => {
  const skill = skillById.get(skillId) ?? null;
  return Object.freeze({ id, label, rarity, kind: 'skill', minLevel, maxStacks: values.length - 1, classId: skill?.classId ?? null, skillId, slot: skill?.slot ?? null,
    icon: skill ? skill.id.slice(skill.classId.length + 1).replaceAll('_', '-') : null, mod, values: Object.freeze([...values]), description });
}));
const upgradeById = new Map(SKILL_UPGRADES.map(card => [card.id, card]));
export const getSkillUpgrade = id => upgradeById.get(id) ?? null;
export const getClassSkillUpgrades = classId => SKILL_UPGRADES.filter(card => !card.classId || card.classId === classId);
// Aldric never sees Lyra's cards and vice versa. Non-skill definitions pass through untouched.
export const isUpgradeForClass = (definition, classId) => definition?.kind !== 'skill' || !definition.classId || definition.classId === classId;
// The guaranteed class slot of every offer rolls with these (rarer tiers stay rarer, but reachable).
export const SKILL_UPGRADE_WEIGHTS = Object.freeze({ rare: 10, epic: 5, legendary: 1.5 });
// +Cadência also trims skill cooldowns a little: 3% per stack, multiplied with Ritmo Implacável.
export const CADENCE_SKILL_COOLDOWN = .03;
// Nothing left to offer: a level-up (or boss chest) pays this instead of vanishing.
export const EXHAUSTED_REWARD = Object.freeze({ healFraction: .25, score: 250, label: 'Poder no auge' });

const stacksOf = (stacks, card) => { const value = stacks?.[card.id]; return Number.isFinite(value) ? Math.max(0, Math.min(card.maxStacks, Math.floor(value))) : 0; };
export function getSkillMods(stacks, classId) {
  const mods = {}; let changed = false;
  for (const card of getClassSkillUpgrades(classId)) { const owned = stacksOf(stacks, card); if (owned) { mods[card.mod] = card.values[owned]; changed = true; } }
  if (mods.dashRange) mods.dashDamage = 1 + .2 * mods.dashRange;
  const cadence = Number.isFinite(stacks?.cadence) ? Math.max(0, Math.min(5, Math.floor(stacks.cadence))) : 0;
  if (cadence) { mods.cooldownMultiplier = (mods.cooldownMultiplier ?? 1) * (1 - CADENCE_SKILL_COOLDOWN * cadence); changed = true; }
  return changed ? sanitizeSkillMods(mods) : NEUTRAL_SKILL_MODS;
}
export const describeSkillUpgrade = (card, classId) => card.description.replaceAll('{recurso}', CLASS_RESOURCES[card.classId ?? classId]?.label ?? 'recurso');
// "Habilidade 2 · Corte Devastador" for skill cards, "Aldric · Fervor" for the class resource cards.
export function getSkillUpgradeTag(card, classId) {
  const skill = skillById.get(card.skillId);
  if (skill) return `Habilidade ${skill.slot + 1} · ${skill.name}`;
  const owner = card.classId ?? classId;
  return `${owner === 'warrior' ? 'Aldric' : 'Lyra'} · ${CLASS_RESOURCES[owner]?.label ?? 'Recurso'}`;
}
export const getSkillUpgradeIcon = (card, classId) => card.icon ?? ((card.classId ?? classId) === 'warrior' ? 'blade' : 'rifle');
// HUD tooltip line: the owned cards that change one skill (resource/cooldown cards touch all three).
export function getOwnedSkillUpgrades(stacks, classId, skillId) {
  return getClassSkillUpgrades(classId).filter(card => stacksOf(stacks, card) > 0 && (!card.skillId || card.skillId === skillId || (card.id === 'frostShatter' && classId === 'dwarf')))
    .map(card => ({ id: card.id, label: card.label, stacks: stacksOf(stacks, card), maxStacks: card.maxStacks, shared: card.skillId !== skillId }));
}
// Every card must stay inside the simulation's clamps, otherwise a stack would silently do nothing.
for (const card of SKILL_UPGRADES) { const [min, max] = SKILL_MOD_LIMITS[card.mod]; if (card.values.some(value => value < min || value > max)) throw new RangeError(`${card.id} outside SKILL_MOD_LIMITS`); }
