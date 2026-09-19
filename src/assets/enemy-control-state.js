// Authoritative seconds remaining, supplied by Combat. Visuals never expire,
// extend or grant statuses themselves; reconciliation replaces these values.
export function getEnemyControlState(state = {}) {
  const freezeRemaining = Math.max(0, Number(state.freezeTimer ?? state.freezeRemaining) || 0);
  const stunRemaining = Math.max(0, Number(state.stunTimer ?? state.stunRemaining) || 0);
  const frozen = !state.dead && freezeRemaining > 0;
  const stunned = !state.dead && stunRemaining > 0;
  return { frozen, stunned, paused: frozen || stunned, freezeRemaining, stunRemaining };
}
