# BIPX quality evaluation

The requested outcome is a substantially upgraded game, integration of every applicable VFX family in the referenced Samurai, HandCast and LinearAbility sources, and **every evaluation dimension at 10/10**, following the latest user target. Passing automated tests alone does not establish that outcome. No weighted average can hide a failing dimension. Missing evidence remains pending.

The current rubric has **12 dimensions** below. The current v2 authorization requires war cry buff, cleaving dash, shield charge/stun, fire cannon, area freezing shot and persistent gravity pull, three active skills per class while retaining sword/rifle basic attacks; older sword-only/rifle-only wording is historical.

## Evidence contract

Each evaluation names a candidate with source hashes, the exact browser/device and quality mode, scenario, capture time, observations, defects, and artifact references. A report collected while source files changed is exploratory and must be rerun on a stable candidate. Debug-spawned hordes and weapons are labeled fixtures even when rendered by the real game. Natural gameplay evidence must use actual keyboard, pointer, or touch input. A screenshot does not prove animation, sound, input latency, network synchronization, or sustained performance.

| Dimension | Evidence needed before scoring | Acceptance observations |
| --- | --- | --- |
| Game design and class identity | Natural runs with sword/rifle basics and all six intentional skills; costs, resource regeneration, cooldowns, range/control, progression and enemy counterplay | Three meaningful active skills per class, readable preparation/impact/recovery, legitimate server authority and preserved XP/drops/party/reconnect/wipe/ranking |
| Animation, locomotion and contact | Native complete-cycle playback and independent skinned sole/world contact metrics for both heroes/enemies at multiple speeds, turns and casts, local/remote | Stable body/weapon grip, legs continue while casting, correct impact timing; fixed ToeBase markers or vertical bounds do not prove no sliding |
| Art direction | Native desktop and mobile captures, sustained play video, inspected scenes and extreme combat moments | Cohesive environment, material/light balance, clear silhouettes, intentional composition, readable enemies and pickups; no obvious placeholder clash or clipping |
| VFX | Source inventory mapped to integrations or reasoned exclusions, effect-trigger captures, dense-combat playback, cleanup/budget telemetry | All applicable upstream effect families have genuine runtime use; restrained timing, clear telegraphs and hit feedback, no missing textures, obscured threats, stuck particles or persistent allocations |
| Combat feel | Natural input video and measured player/projectile state; all weapon and damage cases | Responsive motion/aim/fire, coherent impact and recovery, consistent aiming, visible damage direction and escalation, useful feedback under dense combat |
| UI and flow | Menu/login/ranking, HUD, upgrades, death/restart, settings and pause exercised with keyboard and pointer | Consistent hierarchy and typography, clear state transitions, reliable focus, legible ARPG bottom HUD with two orbs, three skills, weapon indicator and authoritative cost/cooldown/resource; usable touch and 1/2/3 with upgrade/input precedence; no misleading buttons |
| Mobile | Touch movement plus simultaneous firing, portrait/landscape/compact browser captures, physical iOS and Android sessions | Comfortable targets and safe areas, no overflow/overlap, stable orientation and touch cancellation, physical-device play and thermal evidence |
| Audio | Recorded output and listening notes across quiet play, heavy combat, damage/death, mute/unmute/settings | Audible and distinct events, balanced mix, useful spatial/directional cues, no clipping, fatigue, or unexpected unlock/mute behavior |
| Performance | Sustained frame-time series and memory/resource counts across normal, level 6 and level 16 play; declared hardware and browser | Stable frame pacing and bounded allocations. Premium target: normal play near 60 fps, p95 frame time at most 20 ms on declared desktop target, at most 25 ms on declared mobile target, no recurring long frames; physical device required for mobile claim |
| Multiplayer | At least two real browsers, shared enemies/projectiles/rewards, late join, reconnect, disconnect, simultaneous death/wipe | Consistent authoritative world and fair damage/rewards; recovery and state reconciliation verified; a WebSocket protocol probe alone is incomplete |
| Accessibility | Keyboard walkthrough, focus/labels/contrast inspection, reduced-motion playback, zoom/readability, non-color cues | Settings usable without pointer, focus remains visible and restored, meaningful labels, motion reduction actually suppresses motion, no essential information conveyed by color or sound alone |
| Reliability | All current automated suites, zero runtime/page/resource errors, boot/restart/settings persistence, long play and lifecycle recovery | Reliable startup and repeated sessions; no silent failures, unhandled exceptions, missing assets or state corruption |

## Automated suites

`npm ci` followed by `npm run browser:install` installs pinned tooling. Tests use a local server with external leaderboard credentials disabled and a disposable leaderboard file. Browser artifacts are saved under `output/playwright/` and include source hashes, diagnostics, exact browser version, context capabilities, and native captures.

- `npm run verify`: existing broad combat/progression regression coverage. Setup of specific monsters, upgrades and weapons uses debug fixtures.
- `npm run verify:mobile`: existing viewport/safe-area and horde scenarios with actual mobile context.
- `npm run verify:performance` and `npm run verify:performance:lv16`: existing horde regression budgets, now with percentile frame times and correct touch/mobile context.
- `npm run verify:multiplayer`: existing server protocol probe; this is not a two-browser gameplay evaluation.
- `npm run verify:multiplayer:browser`: two actual browser contexts with real movement/fire, matching authoritative broadcasts, disconnect and fresh late rejoin. Transient reconnect with resumed identity, adverse networks and simultaneous browser death remain separate gates.
- `npm run verify:experience`: natural menu/start/move/fire, actual touch input, sound state, settings/pause when integrated, and screenshots/video.
- `npm run verify:vfx`: current class/basic-attack and enemy-projectile VFX regression coverage; historical nine-weapon debug catalogues are fixtures and do not authorize those basic weapons. Six new intentional skills require their own cast/travel/contact integration evidence across quality/reduced motion and restart cleanup.
- `npm run verify:skills` and `npm run verify:skills:server`: shared-simulation CPU cases and isolated real WebSocket authority/reconnect tests for six skills; these do not constitute natural gameplay or a two-browser visual proof.
- `npm run verify:http`: public resource delivery, protected source/config paths, encoded paths, malformed URLs, and allowed methods; response bodies are discarded.

`npm run verify:all` runs all of these suites sequentially and preserves every result and log. A nonempty argument list selects named suites, for example `npm run verify:all -- verify verify:vfx`. A source or asset change during a run prevents candidate approval even if individual tests passed. Fingerprints include application source, vendored runtime and game assets (excluding archived asset-generation history).

Existing low FPS regression thresholds are retained to avoid rewriting historical contracts; satisfying them is not a premium-performance evaluation. Browser viewport emulation is not physical iPhone or Android hardware proof.

The default pinned headless Chromium may use a software GPU; check the recorded graphics renderer before interpreting performance. `BIPX_BROWSER_CHANNEL=chrome BIPX_HEADLESS=0 npm run verify:performance` explicitly runs a separate installed Chrome test profile with a visible window. On the current host this exposes Apple M5 Pro through ANGLE Metal. Its actual browser version is recorded, and must not be confused with the pinned headless browser. Run performance suites sequentially to avoid GPU contention.

## JEV evaluation

The official [TypeSafe State documentation](https://docs.typesafe.ai/concepts/state) states that Jev accepts text only; it cannot see images, listen to audio, or watch gameplay. Its result here is an **indirect evaluation of written observations and measurements**. Native visual/audio review remains separate. Do not label a Codex sub-agent “JEV”.

`node tools/evaluate-jev.mjs --state <evidence.json> --output <report.json>` submits the explicit evidence JSON to TypeSafe's [System One API](https://docs.typesafe.ai/api), with model `jev-1.13.0` and `TYPESAFE_API_KEY` read only from the environment. The key is never printed or saved. `--dry-run` validates/builds the request without sending it. Raw typed responses, probabilities, source/evidence hashes, missing dimensions, and confidence are retained. The mapping to 0–10 is documented and reads the threshold from the rubric and requires **every** dimension to reach exactly 10, without rounding 9.99 upward; absent/partial dimensions produce `null` scores and cannot pass. A model score does not override known defects or failed tests.

Do not revise criteria, choose only flattering captures, or repeatedly query an unchanged candidate to obtain a passing score. Improvements must change the candidate or add genuinely missing evidence, and all failures remain part of the record. Official [Score semantics](https://docs.typesafe.ai/primitives/score) define a probability-weighted index across descriptive levels, not a guarantee of correctness.
