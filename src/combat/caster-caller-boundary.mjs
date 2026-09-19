// PROPOSAL ONLY. A pure boundary returning directives; it does not spawn anything.
import { createCasterCastState, advanceCasterCast, prepareCasterCast } from './caster-cast.mjs';

export function stepCasterCaller({ state, worldEpoch, actor, target, tick, dt, paused = false,
  ready, inRange, losClear, cooldownDuration }) {
  if (!Number.isFinite(cooldownDuration) || cooldownDuration <= 0) throw new TypeError('Caller cooldown required');
  const current = state ?? createCasterCastState({ worldEpoch, actorId: actor.id, actorType: actor.type });
  if (current.worldEpoch !== worldEpoch || current.actorId !== actor.id) throw new TypeError('Caller world/actor mismatch: reset explicitly on world replacement');
  const wasActive = current.cast && current.cast.phase !== 'end';
  // Consume the shared world tick even when idle. A repeated invocation cannot
  // prepare a second cast from the same tick after a terminal transition.
  const advanced = advanceCasterCast(current, { tick, dt, paused, actor, target, inRange, losClear });
  if (!advanced.accepted || wasActive) return { ...advanced, consumeActorStep: Boolean(wasActive) || !advanced.accepted, assignCooldown: null };
  const prepared = prepareCasterCast(advanced.state, {
    sequence: advanced.state.sequence + 1, paused, actor, target, ready, inRange, losClear,
  });
  return { ...prepared, consumeActorStep: prepared.accepted,
    assignCooldown: prepared.accepted ? cooldownDuration : null };
}
