# Hero locomotion — current candidate and rejected milestone

This work uses the original Aldric and Lyra Mixamo assemblies. `aldric-hero.glb` and `dwarf-rifleman.glb` are unchanged. Original Blender files are read in isolated background processes; export reports bind before/after source hashes.

The original controller selected Walk/Run from fixed speeds, capped both characters at the same cadence, and replaced their legs with the attack clip while moving. New `hero-locomotion.js` measures each motion's support sweep in the actual character scale, chooses authored forward/backward/lateral takes, runs legs independently through attacks, adapts cadence and a bounded stride, and exposes honest reach/contact diagnostics. Main integration must provide actual post-collision/interpolation `velocity:{x,z}`, `speed`, and `teleport`; parent aim rotation must already be updated. The root integration owns those changes and the 6.5m/s movement tuning.

## Added source motions

- Aldric: original sword/shield backward walk, backward run, left/right walk strafe and left/right running strafe.
- Lyra: original backward walk/run, left/right walking strafe and left/right running strafe.
- `src/assets/*-locomotion-clips.json` contain lower-body animation tracks only; skin, source actions, weapon props and original full-body runtime clips are preserved.
- An experimental faster Aldric-to-Lyra backward retarget is retained for diagnosis but **excluded from the runtime**. Its first export inherited a nonzero rest hip planar offset, and the candidate is not approved. Current high-speed backward Lyra still needs a supported take/cadence improvement.

Reproduction:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/hero-locomotion-export.py
node tools/hero-locomotion-extract.mjs
node tools/hero-locomotion-cpu.mjs
node tools/hero-locomotion-contact-surface.mjs
```

The experimental `hero-locomotion-retarget.mjs` is separate; running it adds an excluded sidecar take, not an approval.

## Rejected native milestone

`output/playwright/hero-locomotion-first-native/` contains twelve native Chrome Metal screenshots, four videos and source hashes. It is an **isolated asset fixture**, not gameplay. The initial candidate kept toe anchors nearly still but had two material failures:

1. Preserving the spine world pose while replacing hips stretched Lyra's mixed pelvis/spine cloth weights during moving shooting. `dwarf-after-backward.png` visibly shows the defect. That layering was rejected. Current production preserves the entire authored torso/hips and overrides only the leg chains; any bounded yield translates the complete visual, including weapon props.
2. Toe anchor drift did not prove stable sole surfaces. An independent CPU probe of actual skinned vertices (>75% foot/toe weights, same vertices in a 4cm floor band) measured substantial residual sole drift and penetration. It samples all eligible vertices, rather than trusting controller anchors. `deformed-contact-surface.json` is the current measured evidence; no anti-sliding approval follows from the toe telemetry.

The root's real-input game report `output/playwright/2026-09-18T22-57-07-094Z-verify-locomotion-game/` passed its controller telemetry gates on the rejected milestone. It does not approve later source or actual sole contact. JEF also rejected that milestone; historical numbers are not current acceptance.

## Native review fixture

`tools/hero-locomotion-preview.html` has before/candidate controllers, fixed world checker, front/side/rear/game views, independent aim and movement directions, speed, quarter-speed playback, and moving attack loops. The normal game server does not serve `/tools`; use an isolated static server. Public fixture automation API: `window.heroFixture.configure(options)`, `step(count,dt)`, `snapshot()`, and `ready`.

Native review must cover the complete gait, actual boot support, knees, waist/cloth, hand/weapon contact, start/stop, cardinal/diagonal turning and moving attacks. CPU finite transforms, world upper-pose equivalence and anchor telemetry support that review, without substituting for it. Start/stop and turn-in-place remain blended controller behavior; they are not newly authored dedicated Mixamo takes.

## FINAL CHECKPOINT — handoff to Orca Astra Animation

**Production and GPU ownership released after this checkpoint. This agent stopped further iterations as directed by the root following the user's request for one Astra agent per area in Orca.**

Current default controller hash: `src/assets/hero-locomotion.js = b958aca3ff8a0c1353c8af8007dbade40c69ab446ec258aea4bab92502bcabc6`.

Current default behavior:

- Both hero libraries use `createHeroLocomotion`; continuous leg gait survives Shoot/Attack/Hit.
- The full authored hips, spine, upper body, hands and separately baked props stay coherent. The leg solver overrides only leg chains. A bounded yield moves the complete visual root and props together.
- Measured, source-specific cadence and maximum 1.06 stride adaptation; maximum cadence 2.2. Real authored backward and lateral motions are enabled.
- Contact now uses actual skin-surface witnesses (`hero-foot-probes.js`), horizontal anchoring of a surface patch, and a floor clamp. The authored ankle/toe roll is retained. When the old patch lifts 12mm above the current lowest patch, the pivot transfers to the latter.
- Full-foot rigid orientation locking was tried and **rejected** on CPU because it produced overreach and airborne "planted" feet. It is not the current default.
- `RunBackwardFast` remains excluded by an explicit filter; the experimental data is retained in the dwarf sidecar for investigation. Do not remove the filter without a proper bind/rest/planar-zero audit and native validation. During isolated diagnosis its inherited hip planar offset was approximately 0.4396 source metres.

### Current verification and exact limits

Latest native evidence: `output/playwright/hero-locomotion-handoff-native/report.json`, two `.webm` videos, six screenshots and two extracted cycle contact sheets. Native Chrome Metal, no page errors, all six monitored runtime files unchanged throughout capture. Each of the forward, lateral and backward-plus-attack phases recorded about **1.51 simulated seconds** at quarter-speed: enough for more than two of the slowest measured Aldric run cycles. Video capture is real fixture playback, not gameplay.

Directly inspected native snapshots and the ordered 36-frame contact sheets for each actor:

- The rejected Lyra horizontal waist/cloth stretch is absent across the new moving-rifle sample sequence, including the backward attack pose. Rifle, primary grip and supporting arm remain connected in inspected poses.
- Aldric's body and sword/shield remain coherent through sampled forward, lateral and attacking backward cycles; legs continue through the upper-body swing.
- Released feet visibly move through swing poses. No frozen full-foot rotation scheme remains enabled.
- These observations do **not** approve subtle slip, animation smoothness at all frame rates, upgraded speeds, game camera, multiplayer, or all extreme poses. The fixture is not a new JEF evaluation.

`node tools/hero-locomotion-cpu.mjs` currently passes finite transitions, death/revive to Idle, true Run selection, continuous legs during attacks, and preservation of upper-body world pose apart from the whole-visual vertical yield. Those five checks deliberately do not claim anti-sliding success.

`node tools/hero-locomotion-contact-surface.mjs` samples all eligible deformed vertices independently of the controller's smaller witness set. Latest 6.5m/s support samples are within approximately **−6.7mm to +17.2mm** of the floor (was up to roughly −100mm in Lyra source/earlier candidate). However, same-vertex horizontal motion within the 4cm floor band remains material:

| Case at 6.5m/s | Aldric P90 m/s | Lyra P90 m/s |
| --- | ---: | ---: |
| Forward | 0.466 | 0.573 |
| Lateral | 0.397 | 0.591 |
| Backward | 1.108 | 1.429 |

The floor band includes some heel/toe rolling, so it needs contact-patch interpretation and native comparison; it must not simply be weakened to produce approval. The current telemetry's `horizontalDrift` still measures the **toe bone**, while `footContacts[].position` now reports the current lowest sole witness and `toePosition` reports the bone. The fixture note saying that green dots are toe bones is therefore stale. A next diagnostic revision should name these metrics separately and retain an independent skinned-surface check.

Remaining defects/gaps, in next-action order:

1. Refine contact-patch/heel-to-toe support across actual soles. Current native/CPU evidence does not establish absence of visible sliding. Preserve the supplied authored rolling and released swing.
2. Audit source bind/rest references before retargeting Lyra's faster backward gait. At 9.1m/s the current original Lyra backward take hits cadence 2.2 and stride 1.06 with **1.722m/s speed mismatch**, reach error up to 0.0873m in CPU. This is pending, not an approved sprint.
3. Review diagonal and moving-attack extremes: Lyra diagonal reached about 0.0441m residual target error and moving attack about 0.0736m in the controller CPU matrix. Latest full-cycle native only covers forward/lateral/backward at 6.5, with attacks in backward phase.
4. Start/stop and turn-in-place are blend behavior, not dedicated imported takes. Acceleration, abrupt pivots, collision stops, remote interpolation, frame-rate variation and real game-camera contact need fresh QA after the next animation change.
5. Re-run the root's real-input gameplay verifier against the actual new source and explicitly distinguish toe-bone telemetry from physical sole contact. The old 22:57 pass and old JEF rejection describe older source.
6. Performance of skin-witness correction with four heroes needs runtime profiling. The helper updates a small probe set, but CPU throughput alone is not a frame-time result.

### Files owned by this handoff

Production:

- `src/assets/character-library.js`, `src/assets/dwarf-library.js`
- `src/assets/hero-locomotion.js`, `src/assets/hero-foot-probes.js`
- `src/assets/warrior-locomotion-clips.json`, `src/assets/dwarf-locomotion-clips.json`

Tools (all `hero-locomotion*`): CPU fetch support, source analysis, evaluated Blender export, directional extraction, excluded experimental backward retarget, controller CPU matrix, independent surface verification, witness builder, native fixture/runner, and preserved baseline controllers. No main/server/enemy/VFX files were edited by this agent.

Runtime GLB hashes remain:

- Aldric: `0e5da9d8a667fa44dbccf6c5ae9141f6f3183df555c2ed6781bc87d632327a32`
- Lyra: `e11eadb8b428ad46332b0f70bc2db3459628775b65cbb101886cd46fdcd643b0`

Useful artifacts:

- `output/hero-locomotion/export/`: isolated full-GLB directional exports and source-preservation reports.
- `output/hero-locomotion/source-analysis.json`, `controller-cpu.json`, `deformed-contact-surface.json`, `foot-surface-probes.json`.
- `output/playwright/hero-locomotion-first-native/`: rejected waist/marker milestone; preserve as history.
- `output/playwright/hero-locomotion-sole-native/`: short intermediate native confirmation; not all clips had complete-cycle duration.
- `output/playwright/hero-locomotion-handoff-native/`: final source-stable complete-cycle recording and inspected ordered contact sheets.

Reproduce the last native capture with an isolated static server (the agent's `python3 -m http.server 5278 --bind 127.0.0.1` was left available for handoff; verify its process before reuse):

```sh
HERO_NATIVE_AFTER_ONLY=1 HERO_NATIVE_PHASE_MS=6000 HERO_NATIVE_OUTPUT=output/playwright/hero-locomotion-next-native node tools/hero-locomotion-native.mjs
```

The Playwright skill wrapper was attempted after confirming `npx`, but its bundled CLI failed with `playwright-cli: command not found`. Native verification used the repository's installed Playwright JavaScript API and Chrome Metal convention; no package was installed. Browser contexts used by this agent are closed. The user's main Chrome localhost preview was not closed.
