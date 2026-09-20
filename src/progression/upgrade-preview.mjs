// Pure upgrade previews. The card UI consumes these values but never mutates a
// live player or invents its own balance constants. Progression and combat
// numbers come from the same authority/hero-power/skill modules used at apply.
import { DEFINITIONS, MAX_HEALTH_UPGRADE, maxHealthForStacks, stats as progressionStats, attackStats } from './authority.mjs';
import { getSkillMods, getSkillUpgrade, describeSkillUpgrade, getSkillUpgradeTag } from './skill-upgrades.mjs';
import { CLASS_RESOURCES, SKILL_MOD_EFFECTS, getClassSkill, getSkillRadius, getSkillCost, getSkillCooldown, getClassSkills, getSkillModifiers, describeSkill } from '../combat/class-skills.mjs';
import { heroProfile, basicPower, skillPower, swingDuration, meleeShape } from '../combat/hero-power.mjs';
import { AUTO_WEAPONS, AUTO_WEAPON_IDS, nextAutoWeapon, isAutoWeaponEvolved, getAutoWeaponLoadout, getAutoWeaponPulse } from '../combat/arsenal.mjs';

const BASE_SPEED = 6.5;
const cloneStacks = value => ({ ...(value && typeof value === 'object' ? value : {}) });
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, min = 0) => Math.max(min, Math.floor(finite(value, min)));
const round = (value, digits = 2) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};
const pt = (value, digits = 2) => round(value, digits).toLocaleString('pt-BR', { maximumFractionDigits: digits });
const pct = value => `${pt(value * 100, 1)}%`;
const unit = (value, suffix, digits = 2) => `${pt(value, digits)} ${suffix}`;

function safeCharacter(character) {
  return character === 'warrior' || character === 'dwarf' ? character : 'dwarf';
}

function contextValues(input = {}) {
  const character = safeCharacter(input.character);
  const stacks = cloneStacks(input.stacks);
  const maxHealthBase = maxHealthForStacks(character);
  const health = Math.max(0, finite(input.health, maxHealthBase));
  const weaponTimer = Math.max(0, finite(input.weaponTimer, 0));
  const prismStormRemaining = Math.max(0, finite(input.prismStormRemaining, 0));
  const skillState = input.skillState && typeof input.skillState === 'object' ? input.skillState : null;
  // A live skill buff is included only when explicitly supplied; otherwise
  // both values stay permanent and cannot mix a transient state into text.
  const skillCombat = getSkillModifiers(skillState);
  const p = { character, stacks, weaponTimer, prismStormRemaining };
  const stats = progressionStats(p);
  const attack = attackStats(p);
  const level = Math.max(1, clampInt(input.level, 1));
  const skillMods = getSkillMods(stacks, character);
  const maxHealth = maxHealthForStacks(character, stacks);
  const resource = CLASS_RESOURCES[character];
  return { character, stacks, level, health: Math.min(maxHealth, health), maxHealth, stats, attack, skillMods, skillCombat, resource, weaponTimer, prismStormRemaining, skillState, baseSpeed: Math.max(0, finite(input.baseSpeed, BASE_SPEED)) };
}

function temporaryNote(context) {
  const notes = [];
  if (context.weaponTimer > 0) notes.push('Infusão ativa (temporária)');
  if (context.prismStormRemaining > 0) notes.push('Tempestade Prismática ativa (temporária)');
  if (context.skillCombat.damage !== 1 || context.skillCombat.speed !== 1) notes.push('Grito de Guerra ativo (temporário)');
  return notes.length ? ` Modificadores temporários: ${notes.join('; ')}.` : '';
}

function skillDamageScale(context) {
  return context.attack.damageMultiplier * context.skillCombat.damage * skillPower(context.character, context.level);
}

function withStack(context, upgrade) {
  const nextStacks = cloneStacks(context.stacks);
  nextStacks[upgrade.id] = clampInt(nextStacks[upgrade.id]) + 1;
  return contextValues({ ...context, stacks: nextStacks, weaponTimer: context.weaponTimer, prismStormRemaining: context.prismStormRemaining, skillState: context.skillState });
}

function basicDamage(context) {
  const profile = heroProfile(context.character);
  return profile.basic.damage * context.attack.damageMultiplier * context.skillCombat.damage * basicPower(context.character, context.level);
}

function basicCadence(context) {
  return swingDuration(context.character, context.stats.cooldownMultiplier);
}

function autoCombatStats(context) {
  // Same bag fireAuto/readStats consume: attackStats (infusion, prism area) × Grito when supplied.
  // Automatic weapons do not use basicPower/skillPower.
  return {
    damageMultiplier: context.attack.damageMultiplier * context.skillCombat.damage,
    areaMultiplier: context.attack.areaMultiplier,
    cooldownMultiplier: context.stats.cooldownMultiplier,
  };
}

function autoWeaponTemporaryNote(context) {
  const notes = [];
  if (context.weaponTimer > 0) notes.push('Infusão ativa (temporária)');
  if (context.skillCombat.damage !== 1) notes.push('Grito de Guerra ativo (temporário)');
  if (!notes.length) return '';
  return ` Modificadores temporários: ${notes.join('; ')}.`;
}

function autoWeaponPreview(before, after) {
  const common = { id: 'autoWeapon', kind: 'stat', before: {}, after: {}, summary: null };
  const weaponId = nextAutoWeapon(before.stacks);
  if (!weaponId) {
    common.summary = 'No limite.';
    return common;
  }
  const combatStats = autoCombatStats(after);
  const evolved = isAutoWeaponEvolved(weaponId, after.stacks);
  const pulse = getAutoWeaponPulse(weaponId, combatStats, evolved);
  const hit = pulse.kind === 'seal' ? pulse.sealDamage : pulse.hitDamage;
  const per = pulse.kind === 'strike' ? 'por corte' : pulse.kind === 'pulse' ? 'por pulso' : 'por selo';
  let summary = `${pulse.label}: ${pt(hit)} de dano ${per} a cada ${unit(pulse.cooldown, 's')}.`;
  if (pulse.coneDamage > 0) {
    summary = `${pulse.label}: ${pt(pulse.hitDamage)} de dano por corte a cada ${unit(pulse.cooldown, 's')}; corte extra ${pt(pulse.coneDamage)} à frente.`;
  }
  const previous = AUTO_WEAPON_IDS
    .filter(id => getAutoWeaponLoadout(before.stacks)[id].level > 0)
    .map(id => (isAutoWeaponEvolved(id, before.stacks) ? AUTO_WEAPONS[id].evolution.label : AUTO_WEAPONS[id].label));
  if (previous.length === 1) summary += ` ${previous[0]} continua ativa.`;
  else if (previous.length > 1) summary += ' As armas automáticas anteriores continuam ativas.';
  summary += autoWeaponTemporaryNote(before);
  common.before = { weaponId: null, hitDamage: 0, cooldown: 0 };
  common.after = {
    weaponId, label: pulse.label, evolved, kind: pulse.kind,
    hitDamage: hit, cooldown: pulse.cooldown, coneDamage: pulse.coneDamage,
    sealCount: pulse.sealCount, strikeDamage: pulse.hitDamage,
  };
  common.summary = summary;
  return common;
}

function skillRows(context) {
  return getClassSkills(context.character).map(def => ({
    id: def.id,
    name: def.name,
    cost: getSkillCost(def, context.skillMods),
    cooldown: getSkillCooldown(def, context.skillMods),
    radius: getSkillRadius(def, context.attack.areaMultiplier),
    damage: def.damage * context.attack.damageMultiplier * context.skillCombat.damage * skillPower(context.character, context.level) * (context.skillMods[def.id === 'dwarf_explosive_cannon' ? 'cannonDamage' : def.id === 'warrior_cleaving_dash' ? 'dashDamage' : 'neutral'] || 1),
    description: describeSkill(def, context.attack.areaMultiplier, context.skillMods),
  }));
}

function statPreview(id, before, after) {
  const common = { id, kind: 'stat', before: {}, after: {}, summary: null };
  if (id === 'damage') {
    const beforeDamage = basicDamage(before), afterDamage = basicDamage(after);
    common.before = { multiplier: before.stats.damageMultiplier, basicDamage: beforeDamage };
    common.after = { multiplier: after.stats.damageMultiplier, basicDamage: afterDamage };
    common.summary = `Dano básico: ${pt(beforeDamage)} → ${pt(afterDamage)} (+${pct(afterDamage / beforeDamage - 1)}).${temporaryNote(before)}`;
  } else if (id === 'cadence') {
    const beforeSeconds = basicCadence(before), afterSeconds = basicCadence(after);
    const beforeSkills = skillRows(before), afterSkills = skillRows(after);
    common.before = {
      multiplier: before.stats.cooldownMultiplier,
      basicSeconds: beforeSeconds,
      skillCooldowns: beforeSkills.map(row => row.cooldown),
    };
    common.after = {
      multiplier: after.stats.cooldownMultiplier,
      basicSeconds: afterSeconds,
      skillCooldowns: afterSkills.map(row => row.cooldown),
    };
    const recargas = beforeSkills.map((row, i) => `${unit(row.cooldown, 's')} → ${unit(afterSkills[i].cooldown, 's')}`).join(' · ');
    common.summary = `Ataque básico: ${unit(beforeSeconds, 's')} → ${unit(afterSeconds, 's')}. Recargas: ${recargas}.`;
  } else if (id === 'area') {
    const beforeSkills = skillRows(before), afterSkills = skillRows(after);
    const beforeRadius = beforeSkills.find(row => row.id === 'dwarf_explosive_cannon')?.radius;
    const afterRadius = afterSkills.find(row => row.id === 'dwarf_explosive_cannon')?.radius;
    if (before.character === 'warrior') {
      const beforeShape = meleeShape('warrior', { areaMultiplier: before.attack.areaMultiplier });
      const afterShape = meleeShape('warrior', { areaMultiplier: after.attack.areaMultiplier });
      common.before = { multiplier: before.stats.areaMultiplier, meleeRange: beforeShape.range };
      common.after = { multiplier: after.stats.areaMultiplier, meleeRange: afterShape.range };
      common.summary = `Alcance do golpe: ${unit(common.before.meleeRange, 'm')} → ${unit(common.after.meleeRange, 'm')}.${temporaryNote(before)}`;
    } else {
      common.before = { multiplier: before.stats.areaMultiplier, projectileRadius: beforeRadius };
      common.after = { multiplier: after.stats.areaMultiplier, projectileRadius: afterRadius };
      common.summary = `Canhão Infernal — raio do impacto: ${unit(beforeRadius, 'm')} → ${unit(afterRadius, 'm')}.${temporaryNote(before)}`;
    }
  } else if (id === 'speed') {
    common.before = { multiplier: before.stats.speedMultiplier, speed: before.baseSpeed * before.stats.speedMultiplier * before.skillCombat.speed };
    common.after = { multiplier: after.stats.speedMultiplier, speed: after.baseSpeed * after.stats.speedMultiplier * after.skillCombat.speed };
    common.summary = `Velocidade: ${unit(common.before.speed, 'm/s')} → ${unit(common.after.speed, 'm/s')}.${temporaryNote(before)}`;
  } else if (id === 'pickup') {
    common.before = { radius: before.stats.pickupRadius };
    common.after = { radius: after.stats.pickupRadius };
    common.summary = `Raio de coleta: ${unit(before.stats.pickupRadius, 'm')} → ${unit(after.stats.pickupRadius, 'm')}.`;
  } else if (id === 'maxHealth') {
    const afterHealth = Math.min(after.maxHealth, before.health + MAX_HEALTH_UPGRADE);
    common.before = { maxHealth: before.maxHealth, health: before.health };
    common.after = { maxHealth: after.maxHealth, health: afterHealth, heal: afterHealth - before.health };
    common.summary = `Vida máxima: ${pt(before.maxHealth, 0)} → ${pt(after.maxHealth, 0)}; cura agora +${pt(afterHealth - before.health, 0)}.`;
  } else if (id === 'projectile') {
    const beforeCount = 1 + before.attack.projectileBonus, afterCount = 1 + after.attack.projectileBonus;
    common.before = { count: beforeCount };
    common.after = { count: afterCount };
    common.summary = `Projéteis: ${beforeCount} → ${afterCount}.${temporaryNote(before)}`;
  } else if (id === 'autoWeapon') {
    return autoWeaponPreview(before, after);
  }
  return common;
}

function skillPreview(card, before, after) {
  const def = card.skillId ? getClassSkill(card.skillId) : null;
  const beforeMods = before.skillMods, afterMods = after.skillMods;
  const rowsBefore = skillRows(before), rowsAfter = skillRows(after);
  const beforeRow = def ? rowsBefore.find(row => row.id === def.id) : null;
  const afterRow = def ? rowsAfter.find(row => row.id === def.id) : null;
  const result = { id: card.id, kind: 'skill', before: {}, after: {}, summary: null, tag: getSkillUpgradeTag(card, before.character) };
  if (!card.skillId) {
    const resource = before.resource;
    if (card.mod === 'resourceMax') {
      result.before = { maxResource: beforeMods.resourceMax };
      result.after = { maxResource: afterMods.resourceMax };
      result.summary = `${resource.label} máximo: ${pt(beforeMods.resourceMax, 0)} → ${pt(afterMods.resourceMax, 0)}.`;
    } else if (card.mod === 'resourceRegen') {
      result.before = { regeneration: resource.regeneration * beforeMods.resourceRegen };
      result.after = { regeneration: resource.regeneration * afterMods.resourceRegen };
      result.summary = `Regeneração de ${resource.label}: ${unit(result.before.regeneration, '/s')} → ${unit(result.after.regeneration, '/s')}.`;
    } else if (card.mod === 'costMultiplier') {
      result.before = { costs: rowsBefore.map(row => row.cost) };
      result.after = { costs: rowsAfter.map(row => row.cost) };
      result.summary = `Custo ${resource.label}: ${rowsBefore[0].cost} → ${rowsAfter[0].cost} (habilidade 1; demais também).`;
    } else if (card.mod === 'cooldownMultiplier') {
      result.before = { cooldowns: rowsBefore.map(row => row.cooldown) };
      result.after = { cooldowns: rowsAfter.map(row => row.cooldown) };
      result.summary = `Recarga: ${unit(rowsBefore[0].cooldown, 's')} → ${unit(rowsAfter[0].cooldown, 's')} (habilidade 1; demais também).`;
    }
  } else if (def && beforeRow && afterRow) {
    const mod = card.mod;
    result.before = { skillId: def.id, cost: beforeRow.cost, cooldown: beforeRow.cooldown, radius: beforeRow.radius, damage: beforeRow.damage };
    result.after = { skillId: def.id, cost: afterRow.cost, cooldown: afterRow.cooldown, radius: afterRow.radius, damage: afterRow.damage };
    if (mod === 'warCryDuration') result.summary = `Duração: ${unit(def.buffDuration + (beforeMods.warCryDuration || 0), 's')} → ${unit(def.buffDuration + (afterMods.warCryDuration || 0), 's')}.`;
    else if (mod === 'dashRange') {
      result.summary = `Alcance: ${unit(def.range + (beforeMods.dashRange || 0), 'm', 1)} → ${unit(def.range + (afterMods.dashRange || 0), 'm', 1)}. Dano do corte: ${pt(beforeRow.damage)} → ${pt(afterRow.damage)}.${temporaryNote(before)}`;
    }
    else if (mod === 'dashDamage' || mod === 'cannonDamage') result.summary = `Dano: ${pt(beforeRow.damage)} → ${pt(afterRow.damage)}.${temporaryNote(before)}`;
    else if (mod === 'gravityDuration') result.summary = `Duração do campo: ${unit(def.fieldDuration + (beforeMods.gravityDuration || 0), 's')} → ${unit(def.fieldDuration + (afterMods.gravityDuration || 0), 's')}.`;
    else if (mod === 'frostHop') result.summary = `Recuo: ${unit(beforeMods.frostHop || 0, 'm', 1)} → ${unit(afterMods.frostHop || 0, 'm', 1)}.`;
    else if (mod === 'frostShatter') result.summary = `Dano contra alvo congelado: +${pct(beforeMods.frostShatter || 0)} → +${pct(afterMods.frostShatter || 0)}.`;
    else if (mod === 'warCryKillHeal') result.summary = `Cura por abate: ${pt(beforeMods.warCryKillHeal || 0, 0)} → ${pt(afterMods.warCryKillHeal || 0, 0)} vida.`;
    else if (mod === 'warCryShockwave') result.summary = `Onda: raio ${unit(SKILL_MOD_EFFECTS.warCryShockwave.radius, 'm', 1)} (efeito novo).`;
    else if (mod === 'dashKillFervor') result.summary = `Fervor por abate: ${pt(beforeMods.dashKillFervor || 0, 0)} → ${pt(afterMods.dashKillFervor || 0, 0)}.`;
    else if (mod === 'dashMultiKill') result.summary = `Após 2+ abates: recarga −${pct(afterMods.dashMultiKill || 0)}.`;
    else if (mod === 'chargeBastion') result.summary = `Guarda: redução de dano ${pct(beforeMods.chargeBastion || 0)} → ${pct(afterMods.chargeBastion || 0)}.`;
    else if (mod === 'chargeShockwave') result.summary = `Onda de escudo: raio ${unit(SKILL_MOD_EFFECTS.chargeShockwave.radius, 'm', 1)} (efeito novo).`;
    else if (mod === 'cannonNapalm') result.summary = `Napalm: ${unit(SKILL_MOD_EFFECTS.cannonNapalm.duration, 's', 1)}; nível ${afterMods.cannonNapalm || 0}.`;
    else if (mod === 'gravityCollapse') {
      const beforeCollapse = beforeMods.gravityCollapse ? SKILL_MOD_EFFECTS.gravityCollapse.damage * skillDamageScale(before) : 0;
      const afterCollapse = afterMods.gravityCollapse ? SKILL_MOD_EFFECTS.gravityCollapse.damage * skillDamageScale(after) : 0;
      result.before.collapseDamageBase = beforeCollapse;
      result.after.collapseDamageBase = afterCollapse;
      result.summary = `Colapso ao fim: dano base ${pt(beforeCollapse)} → ${pt(afterCollapse)} por alvo (antes de Estilhaçar; multiplicadores atuais).${temporaryNote(before)}`;
    }
    else result.summary = `${describeSkillUpgrade(card, before.character)}.`;
  }
  return result;
}

export function deriveUpgradePreview(input = {}) {
  const before = contextValues(input);
  const requested = input.upgrade || getSkillUpgrade(input.upgradeId) || DEFINITIONS.find(definition => definition.id === input.upgradeId);
  // main.js keeps a compact presentation definition; resolve skill cards back
  // to the full shared card so values/mod keys cannot drift in the preview.
  const upgrade = requested?.kind === 'skill' ? (getSkillUpgrade(requested.id) || requested) : requested;
  if (!upgrade || typeof upgrade.id !== 'string') return null;
  const owned = clampInt(before.stacks[upgrade.id]);
  if (owned >= upgrade.maxStacks) return { id: upgrade.id, available: false, reason: 'cap', before, after: before, summary: 'No limite.' };
  const after = withStack(before, upgrade);
  // Max-health grants the same immediate heal as authority.grant; expose that
  // applied value while retaining the immutable before snapshot.
  const appliedAfter = upgrade.id === 'maxHealth' ? { ...after, health: Math.min(after.maxHealth, before.health + MAX_HEALTH_UPGRADE) } : after;
  const preview = upgrade.kind === 'skill' ? skillPreview(upgrade, before, appliedAfter) : statPreview(upgrade.id, before, appliedAfter);
  return { ...preview, detailBefore: preview.before, detailAfter: preview.after, id: upgrade.id, available: true, stack: { before: owned, after: owned + 1, max: upgrade.maxStacks }, before, after: appliedAfter };
}

export function deriveUpgradeSnapshot(input = {}) {
  const context = contextValues(input);
  return { character: context.character, level: context.level, stacks: { ...context.stacks }, stats: { ...context.stats }, attack: { ...context.attack }, skillMods: { ...context.skillMods }, skillCombat: { ...context.skillCombat }, weaponTimer: context.weaponTimer, prismStormRemaining: context.prismStormRemaining, maxHealth: context.maxHealth, health: context.health, resource: { ...context.resource } };
}
