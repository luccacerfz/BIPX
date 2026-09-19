# Elemental VFX candidate — HandCast + Linear

This candidate adds presentation for existing enemy events. It does not add a spell to a hero, change a collision radius, apply damage, freeze an actor, create a damage puddle, or replace the existing evil-eye/invoice projectile silhouettes. Aldric remains sword-only and Lyra remains rifle-only.

Native visual and JEF approval are separate from the CPU checks below. No 10/10 rating is established by this document.

## Retrieved source and retained algorithms

Both repositories were cloned from GitHub into `/tmp/bipx-handcast-reference` and `/tmp/bipx-linear-reference`. Their actual HEADs exactly matched the previously documented pins:

| Repository | Commit | Actual source incorporated |
| --- | --- | --- |
| [HandCastAbilityThreeJS](https://github.com/achrefelouafi/HandCastAbilityThreeJS/tree/3431252f7ad88059681d4b9b6484cb7483f7d0d6) | `3431252f7ad88059681d4b9b6484cb7483f7d0d6` | `src/assets/GlacialGeometry.js`; `src/materials/GlacialShardStormMaterials.js`; hash helpers from `src/utils/math.js` and `src/shaders/lib/noise.glsl.js` |
| [LinearAbiltyCastingExtendedThreeJS](https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS/tree/8c377c886ac2c68b26bc65c8f3507905818b974a) | `8c377c886ac2c68b26bc65c8f3507905818b974a` | `src/materials/AcidPoolMaterial.js`, `src/materials/SingularityMaterial.js`, `src/materials/NeonTrailMaterial.js`; hash helpers from `src/shaders/lib/noise.glsl.js` |

Both MIT copyright notices are retained in [`ELEMENTAL-LICENSE.txt`](../src/vfx/ELEMENTAL-LICENSE.txt). No external texture, audio, character or animation asset is imported from either repository.

| Visible component | Preserved algorithm | BIPX adaptation / deliberate difference |
| --- | --- | --- |
| Glacial facets | Twisted antiprism profile, jittered rings, chipped rear, satellite bipyramids, outward triangle winding, per-face normals, barycentric edges and face pivots | Six sides and one satellite for a smaller solid silhouette; fixed instanced pool. Local normal uses inverse scale and the same rigid fragment rotation as the vertex. Source's two-pass transparent interior is reduced to one faceted icy material; no claim of identical refraction or subsurface scattering. |
| Glacial fracture | Rigid face rotation about a face pivot; deterministic per-face direction and shrinking fragments | Small contact fragments, analytical ballistics and ground fade. The projectile itself remains the existing gameplay object. No mesh manipulation or new collision body. |
| Frost lattice | Source sixfold signed-distance fold, tapered spar, variable side branches, central hex plate and optional hex ring | Short ground mark plus smaller face-on lattice at a confirmed impact; no snow texture or broad obscuring white cloud. |
| Void contact/cast | Source opaque shadow, narrow photon ring, secondary ring, brighter approaching limb and inverse-radius differential halo winding | Brief, small camera-facing glyph; budgeted value-noise filaments replace four-octave ridged simplex. No screen refraction, gravity, target attraction or actor consumption. Straight alpha composites a dark core; source premultiplied opaque shadow is not claimed verbatim. |
| Toxic contact | Source two-loop true Voronoi nearest-bisector etching and independent jittered bubble-cell clocks | Crimson palette follows Dinzo's existing projectile color. Short 0.72-second stain is visual aftermath, never a persistent hazard. One crack scale; source derivative wet normals, large pool expansion and volumetric toxic gas are not transported. Reversed-edge `smoothstep` calls are converted to defined increasing-edge form. |
| Elemental trails | Source tapered helical ribbon, strand-specific pitch/phase, wandering centerline and camera-facing strip width | Small segments record actual swept positions, including curved/homing travel; distance sampling replaces sandbox's straight analytic flight spine. Two strands high/medium, one low/reduced. No fake straight trail bridging teleports. Colors follow current enemy identity. |

Files: [`elemental-vfx.js`](../src/vfx/elemental-vfx.js), [`elemental-geometry.js`](../src/vfx/elemental-geometry.js), [`elemental-shaders.js`](../src/vfx/elemental-shaders.js), [`elemental-source-glsl.js`](../src/vfx/elemental-source-glsl.js).

## Integration contract

```js
import { createElementalVfx } from './vfx/elemental-vfx.js';
const elemental = createElementalVfx({ THREE, scene, quality: 'medium', reducedMotion: false });

// Existing projectile release, at the confirmed release pose/world emitter.
elemental.emit('glacialCast', projectile.mesh.position, {
  direction: projectile.velocity, radius: projectile.radius, color: projectile.color,
});

// Existing swept travel, before removal. Supply the actual projectile as key.
elemental.emitTrail('glacial', projectile.previousPosition, projectile.mesh.position, {
  key: projectile, radius: projectile.radius, color: projectile.color,
});

// Existing confirmed contact point. Radius here is purely artistic, in metres.
elemental.emit('glacialImpact', projectile.mesh.position, {
  direction: projectile.velocity, radius: 1.4, groundY: .075,
});
elemental.update(paused ? 0 : dt);
```

Accepted event IDs: `glacialCast`, `glacialImpact`, `voidCast`, `voidImpact`, `toxicCast`, `toxicImpact`. Accepted trail IDs: `glacial`, `void`, `toxic`. Use glacial for Visor, void for caster, crimson toxic for Dinzo. Other enemy classes retain their existing effects.

`radius` is cosmetic and clamped to 0.12–4.5 metres for events, 0.1–1.4 for trails. `color` optionally takes a Three color input; crystal/lattice ice intentionally retains its authored cold palette. `direction` is an existing world direction. `groundY` defaults to 0.075 metres on BIPX's flat arena. Emitters must not infer a damaging radius from this visual radius.

The `key` enables frame-rate-independent distance cadence in a WeakMap, which does not retain removed projectile objects. If omitted, a call is an independent segment and cannot accumulate sub-spacing travel across frames. Stationary calls emit nothing. A single travel segment exceeding 8 metres clears continuity instead of painting a teleport. At most 12 sample points are written by a call. No particle list grows dynamically.

`setQuality`, `setReducedMotion`, `reset`, `getStats`, `dispose` follow the existing combat VFX lifecycle. `update(0)` freezes age, animation and lifetime. There is no wall clock or requestAnimationFrame inside the module. dt is finite, nonnegative and bounded to 0.15 seconds, matching the existing combat VFX clock convention. Reset clears all effect slots and trail continuity; diagnostic event totals remain cumulative. Dispose is idempotent and removes/disposes exactly three owned geometries/materials.

Quality/reduced-motion changes must be forwarded from the same player preference and quality manager as existing effects. Reset must follow new-run/world reset; no new emitter should outlive its game.

## Fixed budgets

| Quality | Crystal instances | Surface instances | Ribbon instances | Distance between trail samples |
| --- | ---: | ---: | ---: | ---: |
| High | 96 | 24 | 112 | 0.62 m |
| Medium | 64 | 16 | 72 | 0.80 m |
| Low | 24 | 8 | 28 | 1.15 m |

Maximum three draws, no dynamic light, texture, fullscreen pass, depth texture, engine upgrade or render-target allocation. Instance buffers allocate 15,872 bytes once; base geometry buffers and renderer's own shader resources are additional. An occupied ring-buffer slot can be replaced under pressure, counted in `getStats().overwritten`. Downshifting clears slots above the new limit; later upshifting never resurrects those old effects.

Reduced motion clears existing effects, eliminates helical travel/rotation and crystal drift, reduces counts/durations, and increases sample spacing by 1.8. Short contact geometry and static material patterns retain event identity. There is no camera shake or full-screen flash.

## Verification

`node tools/elemental-vfx-cpu.mjs` passed seven checks; current output is [`output/qa/elemental-vfx-cpu.json`](../output/qa/elemental-vfx-cpu.json):

- Source-derived topology is finite, outward, nondegenerate and has valid barycentric coordinates.
- All six event families create finite instance data.
- Pause leaves clock/data unchanged; stationary/invalid inputs do not emit.
- A 16-metre real path emits exactly 50 strip instances at each of 30, 60 and 144 FPS.
- Overload/quality downshift/upshift/reset preserve buffer identity, budgets and no-resurrection behavior.
- Reduced motion retains contact feedback and all effects expire.
- Repeated disposal removes scene nodes and disposes each owned geometry/material exactly once.

CPU evidence does not compile a shader, prove perceptual quality or measure a physical GPU.

Native fixture: [`tools/elemental-vfx-preview.html`](../tools/elemental-vfx-preview.html), explicitly labelled synthetic and not gameplay. Run `node tools/elemental-vfx-native.mjs` with exclusive GPU ownership; it serves a small allowlisted fixture on an ephemeral loopback port, because the main game server intentionally rejects tool HTML routes. Its `window.elementalFixture.capturePhase(.45)` exercises trail flight and `capturePhase(1.26)` exercises contact. Inspect close and gameplay-like camera angles, shaders/GL errors, all three families, low/reduced, resource counts and pause before acceptance. Existing player/projectile and enemy animation gameplay must then be captured from the running BIPX; fixture images do not satisfy this requirement.

The parent integration owns actual cast release timing, contact authority and multiplayer. A projectile disappearing from a snapshot is not proof of contact: it might have expired or been culled. Until a confirmed network event exists, absence of a network impact must remain an explicit gap rather than inventing an impact from removal.

## Native candidate evidence and visual review

The first reviewed candidate passed [`2026-09-18T22-51-46-840Z-elemental-vfx/verification.json`](../output/playwright/2026-09-18T22-51-46-840Z-elemental-vfx/verification.json). This is actual Chrome WebGL2 via ANGLE Metal on Apple M5 Pro, rendering an isolated synthetic scene. Exact hashes bind the fixture, four source modules and Three vendor to the run; they did not change during capture.

Five native images cover high flight/contact/decay, low contact and reduced contact; all five were visually inspected at their native 1280×800 resolution. Three shaders compiled without browser or GL errors. The observed maximum remained three VFX draws. Repeating 200 three-family contacts kept geometry count at 8; disposal reduced it to 5, disposing exactly the three effect geometries, with no textures allocated. A captured 8.3-second loop measured median/p95 about 16.7 ms and max 16.8 ms on this isolated desktop scene. This is not BIPX horde performance, a mobile measurement or a physical-device acceptance result.

The first preserved candidate at [`2026-09-18T22-50-56-585Z-elemental-vfx`](../output/playwright/2026-09-18T22-50-56-585Z-elemental-vfx) revealed overly tight spring-like trail segments. Reducing radial excursion and per-segment pitch produced slimmer open woven streaks in the final flight image; this change was rerun through both CPU and native checks.

Observed visual strengths: large faceted ice silhouettes and distinct dendrite marks; a dark nucleus with a violet halo rather than a uniformly luminous orb; crimson branching etching and independent bubble rings at Dinzo contact. Low quality preserves all three identities, and reduced motion removes moving trails while keeping the short contact symbols. Limits visible in the fixture: the frost mark remains a clean, stylized snowflake rather than natural frost accumulation; bright facets must be checked against the actual cemetery and horde to avoid overpowering actors. The fixture omits real projectile meshes, enemy skeletons, combat VFX/bloom and occluding world props, so their interactions remain unverified here.

Captured WebM files preserve the native test loop; screenshot inspection does not establish a full animation or gameplay timing score. JEF must be given observations and measured scope honestly, not told it viewed these files.

## Raised-ground toxic contact follow-up

The parent captured actual BIPX cast/trail/impact events in `output/playwright/2026-09-18T22-54-13-593Z-verify-vfx/`. Reviewing its `vfx-integration-toxic-actual-impact.png` showed the floor stain hidden by the elevated blue rune portal while the player stood on it. The glacial contact remained visible because its geometry extends above the floor. Disabling floor depth testing would falsely draw the stain through the portal, so floor occlusion is preserved.

A confirmed toxic impact now adds one short camera-facing residue to the existing surface pool: radius 0.48 times the artistic contact radius, at the contact height plus 0.14 m, lasting 0.30 s (0.22 s with reduced motion). It reuses the Voronoi boundaries and bubble cells as sparse suspended fragments with a broken expanding edge. The center is transparent, no opaque crust is drawn in the air, and depth testing remains enabled. This is residue from the confirmed impact, not a persistent damage zone or an extra draw call.

The updated source passed [`2026-09-18T22-56-03-848Z-elemental-vfx/verification.json`](../output/playwright/2026-09-18T22-56-03-848Z-elemental-vfx/verification.json). High/low/reduced contact images were inspected: an irregular hollow copper/crimson cue appears above the target, with the torso still visible and the floor stain unchanged. Shader diagnostics, disposal and fixed resources passed again; CPU checks also passed with updated source hashes. Its intentionally subdued contrast still requires a fresh actual BIPX portal-contact capture: the earlier 22:54 integration run predates this follow-up and cannot certify its runtime appearance.

## Scope still pending / excluded

This is selective integration from both new sources, not a claim that either entire ability catalogue was ported. Phoenix/fire, barriers, full glacial prison, drone, monowheel, astral body consumption, huge volumetric nebula, cyber serpent, arbor bloom, celestial rend, monolith rift, sumi tide and baleful cascade remain outside this small event adapter. Full barriers or persistent zones require matching real gameplay state; sci-fi vehicles/serpents need a separate design decision for this cemetery. Samurai remains the existing separate system documented in `vfx-reference.md`.

Pending acceptance: real release/contact timing; natural gameplay before/after; boss crowd occlusion and threat visibility; low/reduced review; current frame-time measurements; authoritative multiplayer impact coverage; physical device and prolonged play; honest JEF text evaluation of observed evidence. None is implied by the CPU pass.
