function buildArpgState() {
  if (pendingSkillRequest && performance.now() - pendingSkillRequest.at >= 2500) pendingSkillRequest = null;
  if (classSkillState.classId !== player.character) classSkillState = createSkillState(player.character);
  return getSkillHud(classSkillState, { health: player.health, maxHealth: player.maxHealth,
    weapon: player.character === 'warrior' ? 'Espada' : 'Rifle', dead: game.state === 'dead',
    paused: paused || player.pendingUpgradeChoices.length > 0, enabled: game.state === 'playing' && !isMultiplayerSuspended() && !pendingSkillRequest });
}
