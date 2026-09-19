// Presentation only. Timing and accepted casts belong to combat/class-skills.mjs.
// Travel is intentionally silent for instantaneous warrior areas; never loop per frame.
const cue = (sample, gain, duration, rate = 1, extra = {}) => Object.freeze({ sample, gain, duration, rate, ...extra });
const ready = cue('skillReady', .17, .30, 1, { feedback: true, cooldown: .8, priority: 1 });
const resourcefail = cue('skillResourceFail', .21, .27, 1, { feedback: true, cooldown: .4, priority: 2 });
const phases = (cast, travel, impact) => Object.freeze({ cast, travel, impact, ready, resourcefail });

export const SKILL_SOUND_PROFILES = Object.freeze({
  warrior_flame_cleave: phases(
    cue('skillFlameCleave', .43, .30, .95), null,
    cue('flamethrower', .35, .42, .90)),
  warrior_frost_nova: phases(
    cue('skillFrostCharge', .28, .34, .92), null,
    cue('frostNova', .43, .88, .94)),
  warrior_thunder_judgment: phases(
    cue('skillThunderCharge', .30, .65, .90), null,
    cue('thunderstaff', .49, .85, .92)),
  dwarf_incendiary_burst: phases(
    cue('uiSelect', .23, .14, .80),
    cue('skillIncendiaryShot', .43, .30),
    cue('explosion', .39, .55, 1.09)),
  dwarf_cryo_grenade: phases(
    cue('skillCryoThrow', .29, .30),
    cue('skillFrostCharge', .12, .48, 1.18, { offset: .08 }),
    cue('frostNova', .41, .72, 1.12)),
  dwarf_arcane_shot: phases(
    cue('talisman', .22, .32, .92),
    cue('skillArcaneShot', .38, .34),
    cue('talisman', .33, .55, 1.09)),
});

export const SKILL_SOUND_IDS = Object.freeze(Object.keys(SKILL_SOUND_PROFILES));
export const SKILL_SOUND_PHASES = Object.freeze(['cast', 'travel', 'impact', 'ready', 'resourcefail']);
