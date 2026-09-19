# BIPX quality evaluation

The requested outcome is a substantially upgraded game, integration of every applicable VFX family in the referenced Samurai, HandCast and LinearAbility sources, and **every evaluation dimension strictly above 9.5/10**. Passing automated tests alone does not establish that outcome. No weighted average can hide a failing dimension. Missing evidence remains pending.

> **Target: owner decision dated 2026-09-19.** The project owner defines success as "JEF score ABOVE 9.5 in every dimension" (previously `>= 10`). `docs/quality-rubric.json` (schemaVersion 6) records it as `threshold: { operator: ">", value: 9.5 }` with the decision date, and `tools/verify-evaluator-contract.mjs` asserts it. Only the numeric target changed: exactly 9.5 fails, nothing is rounded upward, and **no other requirement was weakened or removed** — complete coverage, zero open defects, all tests passing and every requirement below still apply.

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

`node tools/evaluate-jev.mjs --state <evidence.json> --output <report.json>` submits the explicit evidence JSON to TypeSafe's [System One API](https://docs.typesafe.ai/api), with model `jev-1.13.0` and `TYPESAFE_API_KEY` read only from the environment. The key is never printed or saved. `--dry-run` validates/builds the request without sending it. Raw typed responses, probabilities, source/evidence hashes, missing dimensions, and confidence are retained. The mapping to 0–10 is documented and reads the threshold from the rubric and requires **every** dimension to be strictly above 9.5 (owner decision dated 2026-09-19; exactly 9.5 fails and 9.49 is never rounded upward); absent/partial dimensions produce `null` scores and cannot pass. A model score does not override known defects or failed tests. This v1 tool is kept unchanged as history; new evaluations use the gate v2 below.

Do not revise criteria, choose only flattering captures, or repeatedly query an unchanged candidate to obtain a passing score. Improvements must change the candidate or add genuinely missing evidence, and all failures remain part of the record. Official [Score semantics](https://docs.typesafe.ai/primitives/score) define a probability-weighted index across descriptive levels, not a guarantee of correctness.

## JEF gate v2

Design and rationale: `docs/arpg/aaa-loop/jef-research.md` §2.1 and §3.4. Jev returns only typed answers (`choice`, `score`, `noul`), never explanations; it reads questions literally, is weak with numbers, loses accuracy on large states and is swayed by self-praising prose. The gate therefore decides everything it can **in code** and asks the judge only small, atomic questions.

```
npm run jef:lint -- --evidence <evidence.json> --out <dir>                 # lint only: no key, no API call, no ledger write
npm run jef:gate -- --evidence <evidence.json> --out <dir> --dry-run       # lint + writes the exact requests to <dir>/requests.json
npm run jef:gate -- --evidence <evidence.json> --out <dir>                 # real run; TYPESAFE_API_KEY only from the environment
npm run jef:gate -- --evidence <evidence.json> --out <dir> --dimension mobile
npm run jef:gate -- --calibrate --out <dir>                                # synthetic canaries + ideal ceiling; never a game score
npm run verify:jef                                                         # CPU contract tests, mocked fetch, no network, no key
```

Order of operations of `tools/jef-gate.mjs`:

1. **Evidence lint** (`tools/lib/evidence-lint.mjs`, pure). Any integrity error ⇒ status `lint_failed`, **no API call**, exit code 3.
2. **Ledger rule** (`output/jef-ledger.jsonl`, append-only and hash-chained, keyed by candidate manifest hash + rubric hash). A dimension already evaluated for the same candidate + rubric is asked again only when its evidence **gained artifacts**; rewording is not evidence. Nothing new anywhere ⇒ `refused_requery`, exit code 4. `--force "<reason>"` overrides and records the reason. Answers reused from the ledger are marked carried forward; when their prose changed without a new artifact they block the run (`stale_answers_requery_refused`).
3. **One request per dimension** with a small state — candidate id, only that dimension's observations, code-verified measurements, code-computed `requirements_without_evidence`, open defects and tests — asking: the dimension `score` on the rubric levels, one `noul` per required scenario ("is this requirement established by the evidence?"), a lint `noul` ("does any observation claim quality without a measurement or observed behaviour?"), and per-dimension `evidence_complete` / `major_defect_absent`. Scenario ids are not sent: the mapping observation → scenario is the author's claim, so the judge has to find the support by itself.
4. **Canaries built in code**, per evaluated dimension: purely flattering prose with no measurement must stay at or below level 5 of 9, an irrelevant note at or below level 2, and a listed major defect must not read as "no major defect". A canary beyond its bound marks the whole run `judge_unreliable`.
5. **Decisions in code.** Pass = full run AND lint clean (no error, complete computed coverage) AND every request succeeded AND canaries sane AND no open defects AND all tests passed and verified AND every dimension strictly above 9.5 with `evidence_complete` ≥ 0.95, `major_defect_absent` ≥ 0.95, lint noul < 0.5 and no requirement noul below 0.5. Any failed request or invalid typed answer ⇒ `evaluation_error`, never "passed". `--dimension` runs end as `partial_run`. P(level ≥ 8) < 0.95, confidence < 0.8 and requirement nouls < 0.9 are reported as margin warnings. Every question and threshold lives in `tools/lib/jef-questions.mjs`; its hash is recorded as `questionsSha256`.
6. **Outputs** in `--out`: `lint.json`, `requests.json`, `responses.json` (raw typed answers), `report.json` and `delta.md` — per dimension score/10, P(level ≥ 8) when probabilities are returned, confidence, the requirement matrix sorted worst-first, which gaps are owner-only, and the delta versus the previous ledger entry with the **same** rubric hash (different rubrics are not comparable). The key is read only from `TYPESAFE_API_KEY`, sent only in the request header and redacted from everything written to disk. `fullGoalComplete` stays `false`: this remains an indirect evaluation of written evidence.

### Required scenarios and who can establish them

`docs/quality-rubric.json` lists `requiredScenarios` per dimension: an itemisation of the existing requirement text (the `requirements` string plus the matching row of the table above), each entry quoting its origin verbatim in `from`. Nothing was added or dropped; `npm run verify:jef` fails when a quote stops matching. Each scenario has a `kind`:

| kind | Counts only when | Who |
| --- | --- | --- |
| `automated` | the observation has at least one claim verified in code against a JSON artifact (plus the numeric bound, e.g. p95 ≤ 20 ms, when the scenario declares one) | agents |
| `agent_observed` | the observation names an `inspector` and cites a verified artifact | agents (reviewer ≠ implementer) |
| `human` | `source: "owner"` with device and date, the owner's own words in `verbatim`, and a cited file under `docs/arpg/aaa-loop/owner-sessions/` that contains those words | owner only |
| `device` | as `human`, plus `environment: { os, browser, physical: true }` | owner only, physical phone or tablet |

The owner's three ~10 minute sessions are in `docs/arpg/aaa-loop/owner-session-form.md`; its answer blocks map 1:1 to the `human` / `device` scenarios.

### Evidence file schema v2

Ready-to-fill skeleton: `docs/arpg/aaa-loop/evidence-template.v2.json` (regenerate with `node tools/jef-evidence-template.mjs --write`). Freeze the candidate first with `node tools/jef-candidate-manifest.mjs --id <id> --out <dir>/candidate-manifest.json`.

| Field | Rule checked by the lint |
| --- | --- |
| `schemaVersion`, `language` | `2`; plain English (owner words stay in `verbatim`) |
| `candidate { id, manifest { path, sha256 } }` | the manifest file exists, matches its SHA-256 and holds a `sources` map |
| `roles { implementer, reviewer, evaluator }` | warning when missing or when the reviewer is the implementer |
| `artifacts { <id>: { path, sha256, boundBy? } }` | file exists; SHA-256 matches; **references the same candidate manifest**: its `sourceHashes` equal the manifest, or the manifest hash appears inside the file, or `boundBy` names a bound JSON sidecar that lists this file's hash. `sourceChangedDuringRun: true` is rejected |
| `dimensions.<id>.observations[]` | `{ id, scenarios[], source: automation\|agent\|owner, inspector?, inputKind: natural\|fixture\|not_applicable, environment?, method, result, limits, verbatim?, artifacts[], claims[]? }`; one fact per observation; grading vocabulary (polished, flawless, AAA…) is rejected |
| `claims[]` | `{ claim, value, artifact, pointer, metric?, scenario? }`: `pointer` is a JSON Pointer into a JSON artifact and the value must be **equal**; numbers in prose are never trusted |
| `tests[]` | `{ name, status, dimensions[], artifact, pointer, expected }`: "passed" is accepted only when the artifact holds `expected` at `pointer` (for example `/ok` of `suite.json`) |
| `openDefects[]`, `closedDefects[]` | `{ id, dimensions[], severity, summary }` and `{ id, resolution, closedBy: { artifact } }`. A defect that was open in the previous ledger entry can only disappear when closed with a verified artifact |
| **forbidden** | `coverage`, `requiredMissing` or any other self-declared completeness field: coverage is computed from `requiredScenarios` |

Lint verdicts: `failed` (integrity errors — no API call), `incomplete` (honest gaps: uncovered scenarios, open defects, failed tests — a diagnostic query is allowed, the run cannot pass) and `clean`.

Small example (one artifact, one automated observation, one owner observation):

```json
{
  "schemaVersion": 2,
  "language": "en",
  "candidate": { "id": "aaa-loop-87625e0", "manifest": { "path": "output/qa/aaa-loop/c1/candidate-manifest.json", "sha256": "<64 hex>" } },
  "roles": { "implementer": "t1-power", "reviewer": "t9-review", "evaluator": "orchestrator" },
  "artifacts": {
    "perf-natural": { "path": "output/qa/aaa-loop/c1/verify-performance.json", "sha256": "<64 hex>" },
    "owner-s1-iphone": { "path": "docs/arpg/aaa-loop/owner-sessions/2026-09-21-s1-iphone15.md", "sha256": "<64 hex>" }
  },
  "dimensions": {
    "performance": { "observations": [ {
      "id": "pf-desktop-01", "scenarios": ["PF2", "PF5"], "source": "automation", "inputKind": "natural",
      "environment": { "hardware": "Apple M5 Pro", "browser": "Chrome 141 (ANGLE Metal)" },
      "method": "Ten minute natural run with real keyboard and mouse input, frame times sampled every frame.",
      "result": "Frame time p95 stayed under the desktop bound for the whole run. Two frames were longer than fifty milliseconds.",
      "limits": "One machine. No dense stress in this run.",
      "artifacts": ["perf-natural"],
      "claims": [ { "claim": "frame time p95 in milliseconds", "metric": "frameTimeP95Ms", "value": 8.3, "artifact": "perf-natural", "pointer": "/measurements/frameSample/frameTimeP95Ms" } ]
    } ] },
    "mobile": { "observations": [ {
      "id": "mb-ios-01", "scenarios": ["MB3"], "source": "owner", "inputKind": "natural",
      "environment": { "device": "iPhone 15", "os": "iOS 19.1", "browser": "Safari", "physical": true, "date": "2026-09-21" },
      "method": "Ten minute scripted session from owner-session-form.md, portrait then landscape, both classes.",
      "result": "The owner moved and attacked with two thumbs at once and used the three skills. Sound started on the first touch.",
      "verbatim": "Movi e ataquei ao mesmo tempo sem falha. O som tocou no primeiro toque.",
      "limits": "One device. Ten minutes.",
      "artifacts": ["owner-s1-iphone"]
    } ] }
  },
  "tests": [ { "name": "verify:all", "status": "passed", "dimensions": ["reliability"], "artifact": "perf-natural", "pointer": "/assertions", "expected": "passed" } ],
  "openDefects": [ { "id": "ANIM-01", "dimensions": ["animation"], "severity": "P1", "summary": "Independent sole contact study still reports visible sliding." } ],
  "closedDefects": []
}
```

(The other ten dimensions must be present too, with `"observations": []` until there is evidence.)

### Calibrating the judge

`npm run jef:gate -- --calibrate --out output/qa/aaa-loop/jef-calibration/<stamp>` sends only synthetic states built in code (three canaries and one "ideal ceiling" per dimension) and writes `calibration.json` / `calibration.md`. It needs no evidence file, writes no ledger line and is never a game score. If the flattery canary fails, the judge is flatterable for that dimension and no score of it can be trusted; if the ideal ceiling cannot exceed the threshold, the target is unreachable with the current level wording and the owner has to decide before anyone invests in evidence. Changing a question or a bound after calibration changes `questionsSha256` and has to be reviewed in git.

### Device QA mode

`src/qa/device-report.js` (one `<script type="module">` line, loaded last) does nothing unless the URL has `?qa=<code>`. With the flag it records frame-time percentiles per minute (p50/p95/p99, frames longer than 50 ms), long tasks, orientation changes, `env(safe-area-inset-*)`, viewport sizes, user agent, the WebGL renderer string, AudioContext state transitions and visibility changes, and shows a small "Copiar relatório QA" button (44×44 px minimum, top-left under the HUD) that copies a compact JSON. Issue the candidate manifest SHA-256 as the code (`?qa=<sha256>-iphone15`) so the pasted report references its candidate by itself. `npm run verify:qa-device` plays about 20 s with touch in Chromium (390×844 and 844×390), clicks the button and validates the JSON; it starts its own server on port 5361 and takes the shared GPU lock.

Child servers started by QA tools never inherit secrets: `tools/quality-isolated-server.mjs` blanks `TYPESAFE_API_KEY`, every `*_KEY` / `*_SECRET` / `*_TOKEN` and the Supabase variables (`tools/lib/child-env.mjs`).
