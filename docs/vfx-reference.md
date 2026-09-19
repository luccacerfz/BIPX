# Samurai reference: provenance, scope and integration

Reference: [achrefelouafi/SamuraiThirdPersonTemplateThreeJS](https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS), inspected at commit [`496862cda55bfba3be6d02eec5aee3ca808a31a3`](https://github.com/achrefelouafi/SamuraiThirdPersonTemplateThreeJS/tree/496862cda55bfba3be6d02eec5aee3ca808a31a3).

User-directed expansion (2026-09-18): also use **HandCastAbilityThreeJS** and **LinearAbiltyCastingExtendedThreeJS**. Their pinned source inventory, proposed gameplay mappings and integration gates are in [vfx-additional-references.md](vfx-additional-references.md). This page records Samurai integrations only; it does not imply the two additional sources are already installed.

The reference source is MIT, copyright (c) 2026 mohamedachrefelouafi. Its complete notice is retained at [`src/vfx/SAMURAI-LICENSE.txt`](../src/vfx/SAMURAI-LICENSE.txt). The thermal-color GLSL function is retained; other VFX algorithms were adapted to the current flat BIPX arena, rigid/skinned characters and Three.js 0.164.1. No external character, animation, fist model, moon texture or leaf texture is included by the VFX module. Asset-specific rights remain separate from the source-code license.

This is a source and implementation inventory. Availability of an API does not prove that every family is reached by normal play, nor establish a visual score. Integration is in `src/main.js`; real gameplay captures, performance evidence and independent judging remain separate gates.

## Inventory of the reference's effect systems

All reference paths below are relative to its pinned `src/` tree.

| Reference system | BIPX implementation | Scope and differences |
| --- | --- | --- |
| `vfx/EmberSystem.js` | `combat-vfx.js`, `shaders.js`: instanced ember/spark pool | Birth, velocity, lifetime and drag are written once; closed-form GPU motion and velocity-oriented streaks. Blackbody cooling. Four hard quality budgets, including reduced motion. |
| `vfx/BloodBurst.js` | `emit('blood')` | Ballistic tinted droplets with opacity and lifetime. Uses non-additive blending for BIPX blood; source blood mist is emissive. |
| `vfx/DustBurst.js` | `emit('dust')`, shockwave dust | Expanding moon-tinted dust and heavier falling grains share a bounded diffuse pool. Arena ground is flat; no terrain texture fetch is needed. |
| `vfx/BladeImpact.js` | `impact`, `muzzle`, `frost`, `death` | Sparks, short radial highlights and smoke, with separate particle/decal lifetimes. Frost and muzzle are BIPX additions, not claimed to exist in the source. |
| `vfx/ShockRing.js` | `emit('shockwave')` | Decelerating radial wave exposes glowing irregular cracks behind its front; intensity falls during expansion. Flat at `groundY`, default 0.055 m. |
| `vfx/SummonSeal.js` | `seal`, `teleport`, `heal`, `levelUp`, `judgement`, `bladeStorm` | Procedural scales, counter-rotating runic band, inner polygon and progressive circular reveal. No texture downloads. |
| `vfx/TargetMarkers.js` | `setTargets(...)` in `target-markers.js` | Up to 16 instanced diamonds, hover/locked distinction and eased lock fill. Overlay remains readable behind bodies. |
| `vfx/TargetRings.js` | Same `setTargets(...)` | Ground rings share target positions; depth-tested, dashed and below the body. BIPX owns target selection; the VFX never chooses or damages an enemy. |
| `vfx/SurfaceSampler.js` | `attachWeapon(mesh)` | Triangle-area cumulative sampling, square-root barycentric samples, exact world transformation and face-normal ejection. Indexed/non-indexed rigid geometry supported. |
| `vfx/EmitterBox.js` | Whole supplied mesh is the emitter | Pass the actual sword blade, not the whole player. Interactive emitter-box authoring is not ported. |
| `vfx/BladeHeat.js` | `attachWeapon(mesh)` material patch | Clones materials before adding uneven thermal emission and a hot Fresnel edge; `dispose()` restores originals without disposing shared textures. |
| `vfx/WeaponFire.js` | `attachWeapon(mesh)` | Coordinates steel heat, surface flames, sparks and optional flame volume; updates on the game simulation clock. |
| `vfx/VolumetricFireMaterial.js` | `weapon-fire.js` | Actual raymarched emission/absorption volume, shared blackbody temperature, flow pulled behind moving steel. Medium: 16 steps; high: 28. Uses visible flame-front depth instead of proxy-hull depth. This path is exercised by the procedural BoxGeometry blade fallback and the isolated fixture. The current Aldric GLB sword is arbitrary geometry and uses surface-sampled flames/embers plus steel heat, not the box volume. Low/reduced-motion also uses that lightweight surface path. |
| `vfx/DistanceField.js` | Exact analytic box SDF for fallback `BoxGeometry` blade | No distance texture bake is necessary for the box-shaped fallback. Aldric's arbitrary GLB weapon keeps triangle-sampled flames; a bounding box is deliberately not represented as exact arbitrary steel. Mesh-distance voxel baking is not ported. |
| `vfx/ShadowCharacter.js` | `setSoulSource` / `summonEcho`, `soul-echoes.js` | Actual avatar pose baked at each summon into that slot's own reusable indexed geometry. Supports rigid and skinned meshes, bone-weighted positions/normals, relative/absolute morph targets, real world scale and heading. Two pooled translucent echoes (one in low) with rim light, emergence and dissolving exit. Source's independently animated hunting clones, body capsule fire and melee state machine are not reproduced by this visual API. |
| `vfx/BladeStorm.js` | `emit('bladeStorm')`, existing guardian blade gameplay | Seal, falling luminous blade streaks and impact sparks. The source's equipped-mesh forging/flight/windup/plant state machine requires a separate gameplay port; light streaks are not represented as imported katana meshes. |
| `vfx/Judgement.js` | `emit('judgement')` | Overhead seal, descending light column, ground shock and ejecta. Does not include the source's physical fist model, clipped forearm, target lock lifecycle or hit-stop damage timing. |
| `world/GroundFog.js` | Ambient low smoke wisps | Bounded wind-driven diffuse billboards with soft silhouette. Flat arena replaces terrain-cache grounding. Does not reproduce reference height-field soft intersections. |
| `world/DustMotes.js` | `emit('ambient')` and background motes | Slow sparse particles driven by the simulation clock. Source uses motes in its character studio; BIPX consciously also uses them in gameplay. |
| `world/LeafDrift.js`, `LeafLitter.js`, `Leaves.js`, `leafMaterial.js` | `leaves.js` | One opaque instanced draw for drifting and ground leaves, procedural silhouette/veins, character-proximity scatter proportional to movement, no alpha-sorting. Seeded placement. High 520, medium 320, low 160. Source texture sheet and terrain displacement are not copied. |
| `world/Atmosphere.js` | Root `src/render/atmosphere.js`, `createWorldAtmosphere` | Source-derived analytic exponential height-fog integral and forward moon-scatter lobe, with direction aligned to the moon light. Root patches world/loaded-prop standard materials at `fog_vertex` / `opaque_fragment`, sets those materials `fog=false`, and retains scene fog for unpatched characters/objects, avoiding double fog on patched surfaces. Adds zero render passes by construction. Runtime shader/performance validation of this final root integration remains the gameplay audit's gate. |
| `world/Sky.js`, `Moon.js`, `Environment.js`, `ContactShadows.js` | Root world/presentation scope | Source procedural stars, physically aligned moon, displaced lunar surface and contact-shadow renderer are separate world features, not implied by combat effects. |
| `postprocessing/PostProcessing.js`, `GradeShader.js` | Root `src/render/cinematic-pipeline.js` | Bloom and grading integration is owned by the renderer. It must be verified independently; the combat module adds no renderer passes. |

Lightning ribbons, frost, healing and firearm highlights are BIPX-specific extensions using the same pooled machinery. They are not attributed as original Samurai abilities.

## API

```js
import { createCombatVfx } from './vfx/combat-vfx.js';

const vfx = createCombatVfx({
  THREE, scene, quality: 'high', reducedMotion: false, ambient: true,
});
vfx.emit('slash', player.position, {
  direction: player.aimDirection, radius: 3, color: 0xffdc9b,
});
vfx.emit('lightning', start, { target: end, intensity: 0.8 });
vfx.update(paused ? 0 : dt, { playerPosition: player.position });

const bladeFire = vfx.attachWeapon(actualSwordMesh, { intensity: 0.7, rate: 16 });
bladeFire.dispose(); // restores original material; safe to repeat

vfx.setTargets([{ id: zombie.id, position: zombie.mesh.position, locked: true }]);
vfx.setTargets([]); // eases markers out
vfx.setSoulSource(hero.root); // rigid or skinned visual hierarchy; allocate two buffers
vfx.summonEcho(player.position, { direction: player.aimDirection, duration: 0.85 });
vfx.emitTrail(previousPoint, currentPoint, 'ember', { color: 0xffddc1 });
vfx.setQuality('low');
vfx.setReducedMotion(true);
vfx.setAmbient(false);
vfx.reset(); // clears transient particles, markers and echoes; keeps attachments
vfx.getStats();
vfx.dispose(); // detaches group, restores weapon materials, disposes owned GPU resources
```

Positions must have finite `x,z`; `y` defaults per effect. Options include `color`, `intensity` (0.1–3), `radius` (0.1–18), `direction`, `target`, `angle`, `tilt`, `life`, and `groundY`. Unknown types/invalid positions return false and increment `rejected`. Valid types are `impact`, `blood`, `muzzle`, `slash`, `fire`, `ember`, `frost`, `lightning`, `shockwave`, `dust`, `smoke`, `heal`, `levelUp`, `death`, `teleport`, `ambient`, `seal`, `target`, `judgement`, `bladeStorm`, `shadow`.

The game owns attachment lifetime and target/soul integration. The VFX never applies damage or spawns enemies. `setSoulSource` records the rigid/skinned hierarchy and allocates two independent indexed buffer sets. Every `summonEcho` snapshots the current animation pose into its selected slot; previous echoes retain their pose even when the live actor animates or another echo is summoned. Source position/normal/skin arrays, materials, local bone transforms, bone inverse matrices, bind matrices and skeleton palette are untouched. Derived world matrix caches are refreshed before reading. Source world scale is baked in meters; the echo keeps the source's heading and `direction` controls its drift. Hidden source meshes collapse to invisible degenerate triangles. Re-supplying the same source is idempotent; to adopt a changed topology, clear the source first with `setSoulSource(null)`. Each echo uses one draw, and pose capture occurs only at summon, not per frame. `getStats().soulPoseBake` exposes mesh/vertex/triangle counts, capture count and the last capture cost. Explicit source material displacement shaders and instanced/skinned shader customizations are not evaluated by CPU pose baking.

## Budgets and accessibility

| Quality | Emissive particle slots | Diffuse slots | Glyphs | Lightning segments | Leaves | Volume samples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| High | 960 | 160 | 28 | 160 | 520 | 28 |
| Medium | 576 | 96 | 18 | 96 | 320 | 16 |
| Low | 224 | 40 | 8 | 48 | 160 | Off |

Four instanced effect batches, one leaf draw, two optional target draws, at most two soul draws, and one volume draw per attached box blade. Attachments are capped at four; main normally attaches one. CPU/GPU arrays are allocated once. When a pool fills, its oldest slot is replaced rather than extending the arrays. `getStats().overwritten` measures this intentional budget pressure, not a memory allocation failure. No particle creates a light or mesh.

Reduced motion clears existing bursts, reduces emission, reduces travel, disables ambient particle emission, freezes leaf drift/scatter and marker bob, removes seal rotation, and disables the raymarched volume. Essential hit/attack/selection feedback remains. `dt = 0` freezes all simulation clocks; no `Date.now` or external clock drives motion. Quality changes do not allocate larger buffers. Renderer DPR and postprocessing budgets are controlled separately.

## Verification evidence

Syntax is checked with `node --check src/vfx/*.js` (one invocation per file). Isolated browser fixture evidence is saved in `output/playwright/vfx-module/`; it is explicitly labelled synthetic and is not gameplay. It exercises all shaders, both weapon material restoration and repeated disposal, quality downshift, overload, reset, reduced motion and GL diagnostics. Gameplay verification belongs to `tools/verify-vfx.mjs`, the existing gameplay suites and judge review.

The skinned-pose follow-up has separate evidence in `output/playwright/soul-pose-bake/`. Actual Aldric `Idle` and `AttackHeavy` clips produced distinct snapshots of all 15,494 vertices; the largest displacement was 1.973 m and the frozen idle echo measured 2.362 m against a 2.4 m live character setup. The browser checked independent slot geometry, pose stability after further animation, untouched source geometry/materials/skeleton data, one-echo low budget and repeated disposal, with zero shader/GL errors. This is a real Chromium render of an isolated fixture, not gameplay. A separate two-bone/morph CPU probe matched Three r164 `SkinnedMesh.getVertexPosition` in world space to 1.31e-8 m and confirmed changing normals. Timing is a recorded sample, not a physical-device frame-time guarantee.

Known limits: diffuse sprites are not individually depth-sorted; the small, low-opacity smoke budget limits artifacts but does not provide order-independent transparency. Leaves are artistically procedural, not the source's nine-leaf texture sheet. Shader compilation/resource tests do not prove 9.5/10 art, frame pacing on physical mobile hardware, or an AAA production claim.
