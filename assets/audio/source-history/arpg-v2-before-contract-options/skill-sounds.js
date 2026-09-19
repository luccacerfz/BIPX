// Canonical v2 IDs only. Simulation owns every timing, hit and persistent lifetime.
const cue = (sample, gain, duration, rate = 1, extra = {}) => Object.freeze({ sample, gain, duration, rate, ...extra });
const ready = cue('skillReady', .17, .30, 1, { feedback: true, cooldown: .8, priority: 1 });
const resourcefail = cue('skillResourceFail', .21, .27, 1, { feedback: true, cooldown: .4, priority: 2 });
const phases = values => Object.freeze({ cast: null, release: null, travel: null, impact: null, sustain: null, end: null, kill: null, cancel: null, ready, resourcefail, ...values });

export const SKILL_SOUND_PROFILES = Object.freeze({
  warrior_war_cry: phases({
    cast: cue('skillShieldRush', .18, .18, .85),
    release: cue('skillWarCry', .52, .85),
    sustain: cue('skillWarBuff', .10, 6, 1, { loop: true, priority: 1 }),
    end: cue('uiSelect', .12, .16, .78),
  }),
  warrior_cleaving_dash: phases({
    cast: cue('uiSelect', .18, .12, .75),
    release: cue('katana', .45, .48, .88),
    impact: cue('hit', .38, .28, .87),
    kill: cue('kill', .29, .30, .90),
  }),
  warrior_shield_charge: phases({
    cast: cue('skillCryoThrow', .22, .14, .78),
    release: cue('skillShieldRush', .38, .70, .90),
    impact: cue('skillShieldImpact', .47, .55, .92),
    end: cue('uiSelect', .11, .12, .70),
  }),
  dwarf_explosive_cannon: phases({
    cast: cue('flamethrower', .20, .28, .85),
    release: cue('skillCannonBlast', .49, .62),
    impact: cue('explosion', .46, .68, .86),
  }),
  dwarf_frost_shot: phases({
    cast: cue('skillFrostCharge', .29, .26, .94),
    release: cue('skillIncendiaryShot', .30, .16, 1.19),
    impact: cue('frostNova', .45, .76, 1.06),
    end: cue('frostNova', .17, .26, 1.25, { offset: .24 }),
  }),
  dwarf_gravity_shot: phases({
    cast: cue('talisman', .23, .34, .89),
    release: cue('skillArcaneShot', .39, .36, .93),
    impact: cue('talisman', .31, .38, .80),
    sustain: cue('skillGravityLoop', .18, 5, 1, { loop: true, priority: 1 }),
    end: cue('skillGravityCollapse', .37, .55),
  }),
});
export const SKILL_SOUND_IDS = Object.freeze(Object.keys(SKILL_SOUND_PROFILES));
export const SKILL_SOUND_PHASES = Object.freeze(['cast', 'release', 'travel', 'impact', 'sustain', 'end', 'kill', 'cancel', 'ready', 'resourcefail']);
