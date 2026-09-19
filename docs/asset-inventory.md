# Browser asset inventory

Exported 2026-09-18 from the user's local library in isolated Blender 5.2 background processes. Original files were never saved or edited. This is an asset/runtime checkpoint, not a 9.5 quality score or AAA certification.

| Runtime asset | File size | Source | Intended use |
| --- | ---: | --- | --- |
| `aldric-hero.glb` | 2,996,848 B | `Characters/Aldric_Leonguard/Blender/Aldric_Rebuilt.blend` | Animated sword/shield player visual |
| `cedar-tree.glb` | 333,808 B | `Environment/Harbor_Map/Source/Tripo/13_tree_tripo_v31_8k.glb` | Broadleaf canopy and trunk; filename retained as runtime ID |
| `lantern-post.glb` | 457,084 B | `Environment/Harbor_Map/Source/Tripo/10_lantern_post_tripo_v31_8k.glb` | Wooden post with amber lantern |
| `rune-portal.glb` | 581,560 B | `Environment/Harbor_Map/Source/Tripo/20_rune_portal_tripo_v31_8k.glb` | Horizontal floor rune disc, not a vertical arch |
| `ruined-wall.glb` | 517,644 B | `Environment/Harbor_Map/Source/Tripo/02_wall_tripo_v31_8k.glb` | Stone boundary accents |

Total GLB transfer size: **4,886,944 B**. Runtime images are embedded 1024×1024 textures. Browser needs no provider API, credentials, external CDN or Draco decoder.

## Provenance and preservation

Source base: `/Users/luccacerf/Projetos/Assets/`.

- `assets/models/aldric-hero.provenance.json`: original `.blend` path, SHA-256 before/after, output SHA-256, dimensions of original/runtime textures, source mesh vertices, bone and clip counts.
- `assets/models/environment.provenance.json`: original GLB paths and before/after SHA-256 hashes, output hashes, texture dimensions and simplification counts.
- Aldric source SHA-256: `1f6f5cc0917d8c52c07aaa7e1ce4039a429f72b827b7a2c432c473df7934fd4a`, unchanged.
- Three.js GLTFLoader, BufferGeometryUtils and SkeletonUtils were copied from the official `mrdoob/three.js` `r164` tag. Only module import paths changed; MIT license is in `src/assets/vendor/LICENSE`.

## Export choices

The source Aldric deform rig follows a separate Mixamo driver through world-space constraints. Directly exporting driver actions would bind motion to the wrong rest space. `tools/assets-export-character.py` samples the evaluated deform rig and fixed weapon grips for every frame, converts each bone pose using its explicit parent/rest matrices, then writes a constraint-free runtime rig.

The independent weapon meshes used centimetre scale. Their constant scale is baked into copied geometry before NLA export; omitting this made swords and shields 100× oversized in an early rejected candidate. Horizontal hip translation is removed only from copied actions. Vertical weight shifts remain. The originals retain their complete action library and root motion.

The runtime hero contains one 65-bone skin and two animated rigid props. Blender limits vertex influences to the four largest and normalizes them for glTF. Source mesh vertices are 2,449 body + 2,111 sword + 3,101 shield; exported vertices increase at UV/normal seams.

Environment sources contain about 469k–498k faces each. Coincident geometry vertices are welded before simplification, preserving UV corner data while preventing split seams from opening. Each runtime prop has approximately 6,500 faces and embedded 1024 textures. Original source meshes remain unchanged.

| Clip | Frames @ 30 FPS | Duration |
| --- | ---: | ---: |
| Idle | 107 | 3.533 s |
| Run | 22 | 0.700 s |
| Walk | 34 | 1.100 s |
| Attack | 46 | 1.500 s |
| AttackHeavy | 40 | 1.300 s |
| Hit | 24 | 0.767 s |
| Death | 70 | 2.300 s |

## Integration API

```js
import { loadHeroVisual, loadEnvironmentLibrary } from './assets/character-library.js';

const hero = await loadHeroVisual({ THREE, parent: player.mesh, height: 2.4 });
hero.update(dt, { speed: movementSpeedInWorldUnitsPerSecond, dead: health <= 0 });
hero.attack({ duration: 0.48, heavy: false });
hero.hit();
// hero.weapon / hero.shield: animated meshes suitable for VFX attachment.
// hero.stats: loaded, url, currentClip, animationTime, clips, bones, runtimeHeight.
// hero.dispose(): releases this instance's mixer and detaches its root.

const props = await loadEnvironmentLibrary({ THREE });
const tree = props.instantiate('cedar-tree', { height: 5, tint: 0x89aeba });
const rune = props.instantiate('rune-portal', { width: 4 });
```

`parent` owns gameplay position, yaw, collisions and authority. The loaded visual defaults to facing **−Z**. Existing procedural body meshes must be hidden by the caller after the promise resolves; failure leaves the caller free to retain its fallback. Do not apply procedural limb rotations to the loaded skeleton. `speed` controls idle/walk/run transitions; one-shot attacks and death override locomotion. The controller deliberately does not modify gameplay movement or hit timing.

Environment clone instances share geometry/textures and cache material variants per tint. Repeated equal-tint trees also share materials. Instance transforms remain independent. The floor rune uses width by default; tree/post use height. The stone wall is long, so width is usually a better art-placement constraint than height.

## Runtime evidence

Reproduce with the game server on `localhost:5173`:

```sh
node tools/assets-verify.mjs
```

The test opens an independent headless Chrome context at `src/assets/asset-preview.html?manual=1`, renders the exported GLBs through the same vendored Three.js module as the game, and writes:

- `output/playwright/assets/verification.json`: zero browser exceptions, all seven clips, 65 bones, actual material maps, 2.400000 runtime height, sampled deformed vertices, file sizes and SHA-256 binding to the exact GLBs. Attack returns to idle; death stays clamped; revival returns to idle.
- `output/playwright/assets/all-clips.json`: **343 frames** sampled across all clips; finite skinned geometry, maximum body extent below 0.918 source units, weapon-to-hand relative matrix drift below **0.000155**, repeated-tree resource sharing proven. The drift metric is the maximum absolute matrix-element difference, not a distance in metres.
- `hero-idle.png`, `hero-run-a.png`, `hero-run-b.png`, `hero-attack.png`: real browser-rendered asset poses, visually inspected. Six sampled body vertices moved 0.143–0.626 game units between the two run poses.
- `cedar-tree.png`, `lantern-post.png`, `rune-portal.png`, `ruined-wall.png`: actual browser-rendered runtime props, inspected after seam welding and scaling corrections.

These images are **asset preview evidence, not gameplay**. The fixture uses studio lighting. Main-game lighting, camera framing, enemy readability, combat synchronization, multiplayer and mobile frame rate require their own in-game checks. Ground bounds preserve source animation: the death clip reaches about −0.055 source units, and walk/heavy-attack also have small original ground intersections; collision-aware foot IK is not supplied by this export. All-clip structural sampling does not certify that every pose/contact is artistically polished.

## Rebuild

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/assets-export-character.py
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/assets-export-environment.py
node tools/assets-verify.mjs
```

The game does not require Blender. Export scripts depend on the documented user source paths; runtime GLBs and JavaScript are self-contained.
