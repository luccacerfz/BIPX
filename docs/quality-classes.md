# Fixed character contract and evidence

The current requested roles are Aldric (`warrior`, sword/`katana`) and Lyra Brasswarden (`dwarf`, rifle/`pistol`). The protocol identifiers retain `dwarf` and `pistol`; they do not change Lyra's displayed name. There is no legacy all-weapons exemption. Missing or invalid character data defaults to the rifle role on a fresh server connection.

Selection may change outside a running match. The client persists its selection locally and includes it in the WebSocket URL. Server welcome, join, profile and state snapshots carry the character. A fresh connection has a new socket identity: restoring the selected role is not proof of resumed multiplayer identity.

The server canonicalizes the weapon from the class, rejects a different attack kind or weapon before damage and peer broadcast, and uses the last accepted player position as the attack origin. Warrior base damage is 7, cone range 4.2, cooldown 500ms; rifle base damage is 2, range 26, cooldown 300ms. Existing bounded damage/area upgrade multipliers remain. Cadence upgrades are clamped to 0.48–1. Warrior projectile bonus is always zero. This does not establish complete anti-cheat: player positions, health and upgrade multipliers retain the existing client-reported protocol.

Orc Peon uses the requested common-melee profile from wave 2 with weight 0.12, base health 8, speed 3, radius 0.85, damage 15, score 18, XP 5, melee range 1.55 and cooldown 0.9s. Existing world difficulty/elite modifiers apply. The server's previous common-zombie weight overwrite was corrected from 0.02 to 1 to match solo spawn weighting; otherwise Orc/runner frequency would be inflated in multiplayer.

## Reproducible checks

- `npm run verify:classes`: starts an isolated localhost server with a temporary leaderboard and no Supabase configuration. Exercises class defaults, selection, immutability during play, wrong-weapon rejection, cooldowns and upgrade bounds, actual damage, cone/range exclusions, origin canonicalization, reward, death/wipe, late join and fresh rejoin. No browser rendering claim.
- `npm run verify:orc`: real isolated server with an explicitly synthetic deterministic random seed and scripted protocol input. Advances actual waves, checks no first-wave Orc, then Orc hit/kill/reward. No natural-gameplay or visual claim.
- `npm run verify:characters`: real browser UI selection and persistence, keyboard/pointer movement and class animation, separately labeled placed-target combat, windup, temporary buffs, class-compatible upgrades, death and restart. Screenshots/video preserve the actual rendering.
- `npm run verify:projectiles`: deterministic real-browser integration of the rifle factory, spatial grid, collision, damage and removal. An isolated response append exposes test access without adding a production hook or replacing those functions. Checks 35ms tunneling, near miss, first contact despite reversed grid order, remaining lifetime, piercing order, duplicate-hit prevention and lethal target removal. Piercing is explicitly a shared-collision fixture, not an extra naturally available weapon.
- `npm run verify:multiplayer:browser`: two browser roles, input, class snapshots, accepted peer sword/rifle attacks, common authoritative world and fresh late rejoin.
- `npm run verify:evaluator`: synthetic network-free boundary checks for the evaluation client. Exactly 10 can pass complete evidence; 9.99, missing evidence, known defects, failed tests and malformed scores cannot. These are not Jev grades.

## Evidence status

The immutable class baseline completed 20/20 suites in `output/playwright/2026-09-18T18-06-31-749Z-quality-suite/suite.json`, including 12 server authority checks, seeded Orc progression, both real browser roles, multiplayer, NPCs, lifecycle, audio and VFX. Its source map stayed unchanged during execution. [Candidate report](quality-candidate-20260918.md) records the remaining defects and evidence gaps. Subsequent collision/LOD/HUD/motion changes are a new candidate and must be verified again; the new projectile suite was not part of those 20 historical passes. Earlier failed reports remain history rather than being relabeled as passed.

The integrated rifle correction passed all nine deterministic cases in `output/playwright/2026-09-18T18-28-50-951Z-verify-projectile-sweep/projectile-sweep.json`, without source changes or browser errors. The 35ms case hit at x=0.14m before the 1.68m endpoint; reversed grid order still hit the nearer target. This closes the tested tunneling case for that recorded source, not every possible projectile scenario.

The evaluation target is **10 in every dimension**, read from `quality-rubric.json`. Scores are not rounded upward. Partial evidence remains pending, and automated pass counts do not assign visual/audio/feel grades. Physical mobile evidence and direct perceptual reviews remain separate required gates.
