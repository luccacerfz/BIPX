// Authoritative walk budget. Dash/charge stay on the skill mover. Solver unchanged.
export const PLAYER_LOCOMOTION_SPEED = 6.5; // src/main.js player.speed, both classes
export const MAX_CATCH_UP_DT = 0.25;

export function locomotionSpeed(progression, skills, { stats, getSkillModifiers }) {
  return PLAYER_LOCOMOTION_SPEED * (progression ? stats(progression).speedMultiplier : 1) * getSkillModifiers(skills).speed;
}

export function creditMoveBudget({ now, moveClock, moveBudget, speed }) {
  const clock = Number.isFinite(moveClock) ? moveClock : now;
  const rawElapsed = Math.max(0, (now - clock) / 1000);
  const elapsed = Math.min(MAX_CATCH_UP_DT, rawElapsed);
  const cap = speed * MAX_CATCH_UP_DT;
  const moveBudgetNext = Math.min(cap, Math.max(0, Number(moveBudget) || 0) + speed * elapsed);
  return { moveClock: now, moveBudget: moveBudgetNext, elapsed, rawElapsed, discardedDt: rawElapsed - elapsed, speed, cap };
}

export function consumeMoveBudget(requestedX, requestedZ, budget) {
  const requested = Math.hypot(requestedX, requestedZ);
  const available = Math.max(0, Number(budget) || 0);
  if (!(requested > 1e-9) || !(available > 1e-9)) {
    return { consume: 0, dx: 0, dz: 0, leftover: available, discarded: requested, requested };
  }
  const consume = Math.min(requested, available);
  const scale = consume / requested;
  return { consume, dx: requestedX * scale, dz: requestedZ * scale, leftover: available - consume, discarded: requested - consume, requested };
}
