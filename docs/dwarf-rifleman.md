# Lyra Brasswarden, internal character ID `dwarf`

The user identified Lyra's folder as the requested rifle character. This runtime copy uses the supplied Lyra body, Steam Blunderbuss and authored contact setup; it does not substitute a different dwarf.

- Loader: `src/assets/dwarf-library.js`, `loadDwarfVisual({THREE,parent,height=2.2,yaw=Math.PI})`.
- Returns root/model/weapon/muzzle/stats/update/attack/hit/dispose and `getMuzzleDirection(target?)`.
- Caller owns movement, aim, collisions and gameplay. `update(dt,{speed,dead})`; `attack({duration=.267})` plays Shoot. Death clamps and resets when revived.
- Aim correction -0.0653 radians aligns the supplied aiming pose with parent -Z. Barrel local axis is +X, established from the authored mesh/socket.
- GLB: 4,532,928 bytes, SHA-256 `e11eadb8b428ad46332b0f70bc2db3459628775b65cbb101886cd46fdcd643b0`.
- 65 bones; 13,009 source body vertices, 4,331 weapon vertices; 1024-pixel embedded textures.
- Idle 92, Run 23, Walk 42, Shoot 9, Hit 14, Death 70 frames, 30 fps. In-place horizontal hip motion; preserved vertical weight shifts.

## Sources and preservation

Source `.blend`: `/Users/luccacerf/Projetos/Assets/Characters/Lyra_Brasswarden/Blender/Lyra_Brasswarden_Rebuilt.blend`. Before/after SHA `0ddce2ea3179d56ad8f693b36717e993312fad008d3bbb0e2ee79cc913059f79`.

The source had no Death. The local Aldric Mixamo `sword and shield death.fbx` was retargeted using source/target rest rotations and target limb lengths. SHA `9bebdc4b140df74de5dad95a0ff750d71494f95129faac8f02fb84a65f99cb1a`, unchanged. Support hand releases smoothly over frames 18–32; right hand retains the rifle. Per-frame floor correction, maximum 0.10584 source metres, prevents the body falling through the floor. Original sources and actions were not saved or changed. Reproduce with background Blender and `tools/assets-dwarf-export.py`.

## Verified evidence and limits

`node tools/assets-dwarf-verify.mjs`, isolated HTTP fixture at localhost:5276, Chrome Metal. `output/playwright/dwarf/verification.json` binds results to the GLB hash. All 250 clip frames sampled with finite skinned bounds. Primary hand/weapon relative matrix drift <=0.000198; active two-hand clips support distance <=0.855 mm. Death intentionally releases support. Actual deformed vertices differ between run frames. Shoot returns to Idle, death clamps, and revive resets. Idle barrel vector approximately (0.00001,-0.0745,-0.9972); shooting horizontal offset <0.007.

Inspected native browser screenshots: idle, two run frames, shot, mid-death, completed death. These are isolated runtime asset fixtures, not gameplay captures. Export keeps the source's coarse cloth weighting and small foot penetration during locomotion (worst raw bounds -0.0382 source metres in Run). These are limitations, not a 9.5/10 quality claim. Blender glTF normalizes skinning to four weights per vertex. Game-scale appearance, collision/shot behavior and production performance require the game's separate QA.
