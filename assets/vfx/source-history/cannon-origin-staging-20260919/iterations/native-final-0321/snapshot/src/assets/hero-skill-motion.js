// Presentation timing mirrors Combat's published contract; never grants damage.
const definitions = {
  warrior_war_cry: { characterId: 'warrior', clip: 'SkillWarCry', duration: .85, impactAt: .38, gesture: 'Mixamo sword-and-shield power up: chest, arms and head battle cry' },
  warrior_cleaving_dash: { characterId: 'warrior', clip: 'SkillCleavingDash', duration: .78, impactAt: .22, gesture: 'Mixamo prepared sword cleave with independent dash gait' },
  warrior_shield_charge: { characterId: 'warrior', clip: 'SkillShieldCharge', duration: 1.10, impactAt: .28, gesture: 'Mixamo shield block braced throughout moving charge' },
  dwarf_explosive_cannon: { characterId: 'dwarf', clip: 'SkillExplosiveCannon', duration: .72, impactAt: .30, gesture: 'Mixamo aimed rifle recoil and weighted recovery' },
  dwarf_frost_shot: { characterId: 'dwarf', clip: 'SkillFrostShot', duration: .68, impactAt: .28, gesture: 'Mixamo aimed cold rifle shot' },
  dwarf_gravity_shot: { characterId: 'dwarf', clip: 'SkillGravityShot', duration: .85, impactAt: .42, gesture: 'Mixamo charged aim and rifle recoil' },
};
export const HERO_SKILL_MOTIONS = Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id, value]) => [id, Object.freeze({ skillId: id, ...value })])));
export const getHeroSkillMotion = skillId => HERO_SKILL_MOTIONS[skillId] || null;

const promises = new Map();
export async function loadHeroSkillClips(THREE, characterId, model) {
  if (!promises.has(characterId)) promises.set(characterId, fetch(new URL(`./${characterId}-skill-clips.json`, import.meta.url))
    .then(response => { if (!response.ok) throw new Error(`Skill motions unavailable: ${characterId}`); return response.json(); })
    .catch(error => { promises.delete(characterId); throw error; }));
  const data = await promises.get(characterId);
  const names = new Map();
  model.traverse(object => names.set(object.name.replace(/_\d+$/, ''), object.name));
  return data.clips.map(entry => {
    const clip = THREE.AnimationClip.parse(entry.clip);
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf('.');
      const name = track.name.slice(0, dot).replace(/_\d+$/, '');
      if (!names.has(name)) throw new Error(`Skill track has no target: ${track.name}`);
      track.name = names.get(name) + track.name.slice(dot);
    }
    return clip;
  });
}

/** One authoritative cast event -> one visual gesture, including remote catchup. */
export function createHeroSkillCast({ characterId, stats, transition }) {
  let active = null;
  const seen = new Set();
  stats.cast = null;
  function cancel() {
    if (active) stats.cast = { ...stats.cast, phase: 'cancelled' };
    active = null;
  }
  return {
    get active() { return active !== null; },
    cast({ skillId, castId, duration, impactAt, elapsed = 0 } = {}) {
      const definition = getHeroSkillMotion(skillId);
      if (!definition || definition.characterId !== characterId || (castId != null && seen.has(castId))) return false;
      duration = Number.isFinite(duration) && duration > .05 ? duration : definition.duration;
      impactAt = Number.isFinite(impactAt) ? impactAt : definition.impactAt * duration / definition.duration;
      impactAt = Math.max(.001, Math.min(duration - .001, impactAt));
      elapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
      if (castId != null) {
        seen.add(castId);
        if (seen.size > 64) seen.delete(seen.values().next().value);
      }
      if (elapsed >= duration) return false;
      const action = transition(definition.clip, .07, { once: true, playbackDuration: duration });
      active = { definition, action, elapsed, duration, impactAt };
      action.time = elapsed <= impactAt
        ? elapsed / impactAt * definition.impactAt
        : definition.impactAt + (elapsed - impactAt) / (duration - impactAt) * (definition.duration - definition.impactAt);
      stats.cast = { skillId, castId: castId ?? null, duration, impactAt, elapsed, phase: elapsed < impactAt ? 'anticipation' : 'recovery' };
      return true;
    },
    beforeUpdate(dt) {
      if (!active) return;
      const { definition: d, action, duration, impactAt } = active;
      active.elapsed = Math.min(duration, active.elapsed + dt);
      const t = active.elapsed;
      const sourceTime = t <= impactAt ? t / impactAt * d.impactAt : d.impactAt + (t - impactAt) / (duration - impactAt) * (d.duration - d.impactAt);
      action.setEffectiveTimeScale(dt > 0 ? Math.max(0, sourceTime - action.time) / dt : 0);
      Object.assign(stats.cast, { elapsed: t, phase: t >= duration ? 'complete' : t < impactAt ? 'anticipation' : 'recovery' });
    },
    finished(action) {
      if (active?.action === action) {
        stats.cast.elapsed = active.duration;
        stats.cast.phase = 'complete';
        active = null;
      }
    },
    cancel,
  };
}
