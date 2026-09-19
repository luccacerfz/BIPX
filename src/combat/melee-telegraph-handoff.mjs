/**
 * Future overlay handoff for timed melee. Does not draw and does not import
 * animated-enemies or vfx. Cow/BloodCow meshes are procedural (no Attack GLB);
 * they consume meleeAttack on the CPU pose fallback, not a skinned clip. This
 * module still does not draw.
 */
const TYPES_WITHOUT_PHASE_ATTACK_POSE = Object.freeze([
  'cowWalker', 'cowCharger', 'cowBrute', 'bloodCow',
]);

let sink = null;

export function meleeTelegraphBlockedTypes() {
  return TYPES_WITHOUT_PHASE_ATTACK_POSE;
}

export function setMeleeTelegraphSink(next) {
  sink = typeof next === 'function' ? next : null;
}

export function publishMeleeTelegraph(event) {
  if (!event || sink == null) return false;
  sink(event);
  return true;
}

export function meleeTelegraphEvent(monster, attack, phase = 'begin') {
  if (!monster || !attack) return null;
  return {
    kind: 'melee-telegraph',
    phase,
    monsterId: monster.id ?? monster.serverId ?? null,
    type: monster.type,
    attackId: attack.id,
    targetId: attack.targetId ?? null,
    elapsed: attack.elapsed,
    duration: attack.duration,
    impactTime: attack.impactTime,
    impactPhase: attack.impactPhase,
    active: Boolean(attack.active),
    poseBlocked: TYPES_WITHOUT_PHASE_ATTACK_POSE.includes(monster.type),
  };
}
