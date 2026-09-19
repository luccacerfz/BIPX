# OrcPeasantMiner runtime enemy

`src/assets/enemy-library.js`: `await loadEnemyLibrary({THREE})`, then synchronous `library.create('orcPeon',{parent,height=2.35,yaw=Math.PI,phase=0})`.

The controller exposes `root`, `model`, `weapon`, `stats`, `update(dt,{speed,dead})`, `attack({duration=.85})`, `hit()`, `reset({phase=0})`, and `dispose()`. The caller owns AI, hitboxes, spawn rate, pool capacity and parent movement. Reuse `reset()` for pooled actors. Dispose releases each clone's skeleton texture and cloned materials and removes its root. Geometry and texture resources stay shared. Each clone has its own materials, bones and mixer, so damage flashes and corpse fades do not affect other enemies. `phase` offsets idle animation without altering gameplay.

Source: `/Users/luccacerf/Projetos/Assets/Characters/OrcPeasantMiner/Source/OrcPeasantMiner_Animation_Master.blend`, SHA before/after `2ffef792604e40ffa584c6208cdc371e8fb79af60a2ed4e2e44072c907e87a7b`. Original preserved. Background Blender exports an independent runtime scene; it never saves the master. Authored `R_Hand_SickleGrip` shape (value 1) is baked into the copied body, retaining the closed hand around the supplied sickle. No weapon was invented.

Runtime `assets/models/orc-peon.glb`: 2,442,932 bytes; SHA `f183383155b0a763f46039a93bf048604a5a1f95529a3b4b9b6511b5767c846d`. 41 bones, 13,823 source body vertices and 1,396 source weapon vertices. One embedded 1024px body texture, five simple equipment materials. Original clip ranges retained at 24 fps:

| Clip | Frames | Seconds |
|---|---:|---:|
| Idle | 369 | 15.333 |
| Walk | 57 | 2.333 |
| Attack | 29 | 1.167 |
| Hit | 9 | 0.333 |
| Death | 31 | 1.250 |
| Mine | 25 | 1.000 |

There is no Run in the source. The controller uses Walk and adjusts time scale against the measured native ground speed 0.41087 source metres/second, actor scale, and a bounded multiplier. This preserves the source motion, but does not constitute a separately authored run cycle.

A sampled vertical correction on the copied Root bone keeps the body above ground. Max lift is 0.209853 source metres during Death and <=0.050083 in locomotion. Sampling reads the complete original action first, then writes keys, avoiding accumulated correction. Blender 5.2 required assigning `action_slot_handle` to the copied source slot before sampling; the explicit slot object setter crashed in this build. Frame-by-frame browser deformation verification guards against exporting a frozen action.

Verification: `tools/assets-orc-verify.mjs`, isolated browser fixture `tools/assets-orc-preview.html` served at localhost:5276. Evidence is in `output/playwright/orc/verification.json`, bound to GLB SHA. All 520 clip frames sampled for finite body bounds and weapon/hand transform stability. Real skinned vertex movement measured per clip. Pool check verifies shared geometry/textures and independent materials/skeletons/bones; Attack→Idle, clamped Death, reset→Idle and disposal removal are exercised. Screenshots show idle, two walking phases, attack, mid-death and completed death. These are real browser asset fixtures, not gameplay captures. The game's spawn balance, production frame budget and visual score remain separate checks.

The final material isolation contract is separately verified by `tools/assets-orc-pool-verify.mjs` without a WebGL renderer. `output/playwright/orc/pool-materials.json` confirms damage/fade changes affect only one clone, reset restores its materials, all six cloned materials are disposed, and shared geometry/textures are not disposed.
