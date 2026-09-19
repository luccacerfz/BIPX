function buildArpgState() {
  if (pendingSkillRequest && performance.now() - pendingSkillRequest.at >= 2500) pendingSkillRequest = null;
  if (classSkillState.classId !== player.character) classSkillState = createSkillState(player.character);
  const snapshot = getSkillHud(classSkillState, { health: player.health, maxHealth: player.maxHealth,
    weapon: player.character === 'warrior' ? 'Espada' : 'Rifle', dead: game.state === 'dead',
    paused: paused || player.pendingUpgradeChoices.length > 0, enabled: game.state === 'playing' && !isMultiplayerSuspended() && !pendingSkillRequest });
  return { ...snapshot, statuses: (snapshot.statuses || []).map(status => ({
    ...status,
    skillId: status.skillId ?? status.id,
    label: status.label ?? status.name,
    description: typeof status.description === 'string' && status.description.trim() ? status.description :
      [['damageMultiplier', 'Dano'], ['speedMultiplier', 'Movimento']]
        .filter(([key]) => Number.isFinite(status[key]) && status[key] >= 0)
        .map(([key, label]) => { const percent = Math.round((status[key] - 1) * 100); return `${label} ${percent >= 0 ? '+' : ''}${percent}%`; })
        .join(' · '),
  })) };
}
