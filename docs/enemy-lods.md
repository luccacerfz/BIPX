# Static enemy LODs

The four reduced models replace the colored procedural proxies for the imported enemy types. The closest 20 desktop / 10 mobile enemies retain animated actors; other visible enemies use shared static meshes or instanced meshes. Gameplay entities, AI and collisions remain authoritative in `main.js`.

| Model | Used by | Triangles | GLB bytes | Material groups |
|---|---|---:|---:|---:|
| Orc | orcPeon | 912 | 127,284 | 6 |
| Walker | zombie, runner | 886 | 131,840 | 1 |
| Brute | brute | 891 | 121,280 | 1 |
| Lich | caster, visor | 899 | 126,204 | 1 |

Total: **506,608 bytes / 494.73 KiB**. Each GLB has one mesh node, one embedded 512 px base-color texture, no skin and no animation. Each merged geometry is one unit tall, grounded at y=0, facing -Z. Orc equipment retains six material groups; one InstancedMesh therefore costs six material draws. The other types cost one draw per bucket. The runner shares Walker geometry and the caster/visor share Lich geometry. Unsupported custom boss/cow models retain their existing presentation.

## Runtime contract

`loadEnemyLodLibrary({ THREE })` loads all four GLBs using the validated `loadGlb` helper. `get(id)` returns shared `geometry`, `material`, `materials`, bounds and triangle statistics. `createInstancedMesh(id, capacity)` creates a dynamic instance buffer, without any skeleton or mixer. Main uses capacity 800 per type, white instance colors, foot-position translation and the entity yaw. Scale is **profile.height only**, multiplied by the existing elite/entity scale. The informational `sourceHeight` was already normalized out during vertex extraction and must not be multiplied again.

Shared static detail/proxy wrappers allow the animation pool's existing fallback visibility logic to operate normally. On late library arrival, current animated actors detach before migration; then active and pooled groups replace procedural children. This prevents a pooled actor's old fallback snapshot from restoring retired parts. Geometry/materials from the shared procedural cache are preserved; unshared retired geometry/materials are disposed. Static detail/proxy wrappers share the library's geometry and material resources.

The library owns four merged geometries, nine materials and four textures. Scene owners detach and dispose instance buffers before disposing the library. Instanced frustum culling is disabled because horde transforms move continually and a cached combined bounding sphere would become stale. Static meshes have no per-enemy mixer, skeleton or cloned material. Material flash/fade remains on the independent animated actors.

## Source and generation

`assets/models/enemy-lods/provenance.json` records source GLB hashes before/after generation, output hashes, exact counts, original height and snapshot normalization. The original character/environment asset folders were never modified. The local exported source GLBs were opened only to reuse actual materials. A separately authorized Walker locomotion revision later changed the full source GLB hash; its Idle clip, geometry, texture, skeleton and inverse binds were unchanged, so this Idle-derived LOD remains compatible. The manifest records the historical source used for generation, not a claim that other agents cannot revise the runtime source later.

1. `tools/assets-enemy-lods-extract.mjs` samples actual CPU-deformed vertices from the game's controllers at height 1 / Idle t=0, after their orientation and ground correction. No approximation of the bind pose is used.
2. `tools/assets-enemy-lods-build.py` runs in a separate background Blender process. It constructs independent static geometry, preserves loop UVs when welding position duplicates, decimates to approximately 900 triangles, grounds/normalizes the result and embeds 512 px JPEG 82 textures. It does not save the source files.
3. The temporary preparation directory is `/tmp/bipx-enemy-lods`; extraction uses the isolated read-only HTTP server on localhost 5276. Create its `posed`, `models` and `review` directories before rerunning. The scripts retain the explicit workspace and temporary paths to avoid accidentally writing the originals.

## Evidence and limits

- `output/playwright/enemy-lods-preparation/*-lod-left-original-right.png`: actual Cycles CPU comparison renders, reduced model left / original posed mesh right, inspected for all four models. Both sides use the same 512 px textures. Facial/finger detail is visibly reduced.
- `output/playwright/enemy-lods-preparation/cpu-verification.json`: real Three.js instances, 800 per model, valid groups/attributes/textures, height 1/minY 0, no skeleton, and exactly once disposal of 4 geometries / 9 materials / 4 textures. This structural check does not measure rendering performance.
- `BIPX_BROWSER_CHANNEL=chrome node tools/verify-enemy-lods.mjs`: focused browser test for slow final-LOD arrival with existing animated actors, exhausted20/10 skeleton budgets, 61-enemy horde plus distant instances of each source, frame sampling, restart/reuse and unclipped landscape skill labels.
- `output/playwright/enemy-lods-integrated/enemy-lods.json`: **2/2 passed**, desktop 1440×900 and touch landscape 874×402, zero page/console/HTTP/request errors, source files stable during both runs. The five-second static-stress rendering samples each measured 60 FPS, p95=16.7ms, worst=16.8ms. Desktop after-sample draw calls 138, update 0.8 ms, render 1.1 ms; landscape draw calls 99, update 0.4 ms, render 1.4 ms. This is Chrome on this Mac with viewport emulation, not physical-device proof.
- Desktop dense fixture contained 20 animated actors, 4 static detail meshes, 38 static proxies and 4 native instances. Landscape dense fixture contained 53 static proxies and 13 instances; a separate close fixture exercised the full 10 animated slots and a static detail fallback. All supported entities reported native geometry and zero obsolete children. Restart did not grow the prewarmed pools.
- `lod-desktop-dense61-debug-fixture.png` and `lod-landscape-unclipped-skill-label.png` were inspected: textured Walker/Brute/Lich silhouettes replace the previous pins; landscape LVL labels end at y35 inside a clip bottom of38. The canopy cutaway reveals several bodies on the right, but retains visible dither, foliage silhouette and shadows. It is not a claim of perfect occlusion handling.

These screenshots are explicitly spawned debug fixtures in the real renderer. `stressLevel6` sets enemy speed to 0 and `perfStressImmortal` bypasses player movement, AI, shooting and normal simulation updates; only rendering, Idle mixers and presentation continue. Therefore the 60 FPS samples do not prove full gameplay performance or distance-driven LOD transitions. Static LODs retain Idle pose while moving; distant locomotion is intentionally omitted. The short samples do not establish long-session performance or every animated/static transition. No full quality suite was run for this bounded task; the coordinator runs that after all candidates freeze.
