# Multiplayer reconnect contract

The server retains a disconnected client's identity, run, health, score, kill count, cumulative XP and room reservation for **30 seconds**. If that is the last living participant, the room pauses during the grace period. Expiry finalizes the run once and releases its slot; explicit restart creates a fresh run. A deliberate restart retains the connection identity while changing the run ID.

The client holds its opaque resume credential in a private module variable. Its value is never included in debug/presentation snapshots, this document or the evidence. It is sent only to the selected WebSocket server on reconnect. The browser page must remain open: this implementation does not persist the credential across reload or browser closure. Server process restart also clears these in-memory sessions.

## Protocol

- `welcome` carries private resume data, `resumed`, a 30-second grace value, `selfState`, `world` and unacknowledged `pendingRewards`. Other players' snapshots contain no resume credential.
- Authoritative self state includes `runId`, `stateVersion`, `xpTotal`, health/maxHealth, score, kills and existing presentation/progression fields. Periodic client state includes its latest version. Server score, kills and XP cannot be overwritten by these packets; stale health cannot erase later damage, and ordinary state cannot resurrect a dead run. Current-version health increases still support locally computed healing/upgrades.
- `{type:'startRun', requestId, state:{character}}` explicitly restarts an established run. The reply is `runStarted` with that request ID, authoritative state and world. Repeating the same request ID returns the same run, including when its first reply was lost. A fresh never-started connection still accepts the legacy first playing-state transition for existing protocol clients.
- Rewards retain their previous payload and add `rewardId`, `runId`, `stateVersion`, `xpTotal` and a full state snapshot. `{type:'rewardAck', rewardId}` removes the pending effect event. The server retains up to256 unacknowledged effects separately from cumulative score/XP. The client applies only the positive XP-total difference and deduplicates the latest512 reward IDs, so a replay does not create another pickup/chest or add XP twice.
- `world.epoch` identifies a replacement world. The client clears prior entities when it changes, avoiding ID reuse against an old world.
- A resumed transport replaces the previous socket atomically. Old-socket data/close callbacks cannot mutate or remove the resumed owner. Normal socket closure does not finish a leaderboard session during grace.

The main client sends start requests only after welcome, keeps the same request ID across reconnect, reconciles authoritative self state before releasing input, and freezes gameplay/inputs while disconnected or awaiting start confirmation. Rendering and the monotonic reconnect deadline continue. Multiplayer no longer submits a solo leaderboard session merely because its transport is temporarily disconnected.

The obsolete client-to-client `damagePlayer` message handler was removed. Client packets cannot inflict direct arbitrary damage on another player; damage remains in the production server combat path.

## Verification

`node tools/verify-reconnect-protocol.mjs` passed **10 checks** with real WebSockets against an isolated temporary server copy. Production functions are unchanged in that copy; only the combat-module import path and a private child-process IPC damage fixture are added. It uses an ephemeral loopback port, disposable leaderboard and disabled Supabase, and terminates afterward. It verifies credential privacy in public snapshots, same identity/progress/world on resume, stale-state rejection, old-socket callback safety, authoritative death, idempotent restart, reward replay/ACK, cumulative leaderboard accounting, brief last-player loss and actual30-second expiry. It also proves the removed legacy damage packet is ignored. Evidence: `output/qa/reconnect-protocol/verification.json`; production server source unchanged during the run.

`BIPX_BROWSER_CHANNEL=chrome node tools/verify-reconnect-browser.mjs` passed the complete browser flow against another isolated server. Its private IPC fixture produces server damage/rewards; a browser socket wrapper deliberately drops one reward, one reward ACK and one start reply. It exposes only test methods/noncredential counters. Evidence: `output/playwright/reconnect-browser-integrated/reconnect-browser.json` and its native screenshots. Source fingerprints were stable; page/console/request/HTTP error lists were empty.

Observed browser values: **160HP, 3XP, 10points and the same player ID** before/after the first drop. Holding move/fire during disconnection did not move the player, change HP, create bullets or advance survival time. A lost reward recovered XP from3 to6. A later acknowledged-local/unacknowledged-server reward replay left XP at9. A lost start reply reused one new run ID instead of generating another session.

These are explicit protocol/debug fixtures, not natural combat or a physical-device/network test. Full mobile and prolonged real-network reconnect testing remain separate gates. Position, build and current-version local healing are not fully server-validated anti-cheat; this change addresses transport continuity, stale state and duplicate accounting. The captured browser run preceded the coordinator’s final cosmetic HUD correction from “Solo” to “Online” while reconnecting; gameplay suspension was verified before that correction.

Historical read-only defect reproduction is in `/tmp/bipx-reconnect-audit/`; candidate preparation is in `/tmp/bipx-reconnect-candidate/`. No original character/environment source was changed by this network work.
