// Presentation only. Positions/radii/lifetimes come from accepted simulation state.
export const ENVIRONMENT_SKILL_AREA_LIMIT = 4;
export const ENVIRONMENT_SKILL_IDS = Object.freeze([
  'warrior_war_cry', 'warrior_cleaving_dash', 'warrior_shield_charge',
  'dwarf_explosive_cannon', 'dwarf_frost_shot', 'dwarf_gravity_shot',
]);
const ids = new Set(ENVIRONMENT_SKILL_IDS);

/** Reuses the caller's short array; never mutates simulation areas. */
export function selectEnvironmentSkillAreas(areas, focus, selected = []) {
  selected.length = 0;
  if (!Number.isFinite(focus?.x) || !Number.isFinite(focus?.z)) return selected;
  for (const area of areas ?? []) {
    // Combat v2 gravity snapshots keep their fixed world center as flat x/y/z.
    // Moving buffs must still supply their current position explicitly.
    const point = area?.position ?? (area?.skillId === 'dwarf_gravity_shot' ? area : null);
    if (!ids.has(area?.skillId) || !point || !Number.isFinite(point.x) || !Number.isFinite(point.z)
      || !Number.isFinite(point.y ?? 0) || !Number.isFinite(area.radius) || area.radius <= 0 || area.radius > 55
      || !Number.isFinite(area.remaining) || area.remaining <= 0) continue;
    const distance = Math.hypot(point.x - focus.x, point.z - focus.z);
    if (distance > 30 + area.radius) continue;
    const priority = Math.max(0, distance - area.radius);
    let index = selected.length;
    while (index > 0) {
      const other = selected[index - 1];
      const otherPriority = Math.max(0, Math.hypot(other.position.x - focus.x, other.position.z - focus.z) - other.radius);
      if (otherPriority <= priority) break;
      index--;
    }
    if (index >= ENVIRONMENT_SKILL_AREA_LIMIT) continue;
    selected.splice(index, 0, area.position ? area : { ...area, position: { x: point.x, y: point.y ?? 0, z: point.z } });
    selected.length = Math.min(selected.length, ENVIRONMENT_SKILL_AREA_LIMIT);
  }
  return selected;
}
