// BIPX quality runner. Safe by construction: it never talks to the owner's live server on port 5173.
//
//   node tools/run-quality-suite.mjs                      the 41 historical `verify:all` suites, in their historical order
//   node tools/run-quality-suite.mjs --cpu-only           every registered suite that needs no browser (core + extended)
//   node tools/run-quality-suite.mjs --browser-only       the complement
//   node tools/run-quality-suite.mjs verify:http verify   named suites (names as printed by --list)
//   node tools/run-quality-suite.mjs --list [--json]      print the registry and exit; nothing is started
//
//   --evidence-dir=<dir>   where suite.json and one folder per suite go (default: BIPX_EVIDENCE_DIR, else output/playwright/<ISO>-quality-suite)
//   --timeout-ms=<n>       per-suite wall clock limit (default: BIPX_SUITE_TIMEOUT_MS, else 600 000; a suite may declare a longer one)
//   --base-url=<url>       use an already running server instead of starting one (refused if it is port 5173)
//   --port=<n>             fixed port for the ephemeral server (default 0: the OS picks a free one)
//   --include-historical   also select harnesses that can only test frozen snapshots
//
// For every suite that needs a server (`target` in --list) the runner starts its OWN `server.mjs` on 127.0.0.1 with SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY blank, a disposable LEADERBOARD_FILE and no credential-looking variable in its environment, passes the
// origin as BIPX_BASE_URL (tools/quality-target.mjs resolves each suite's own path/query against it) and stops it afterwards.
// Browser suites run under the shared GPU reservation (tools/quality-gpu-lock.mjs): the runner acquires it before the suite's clock
// starts, hands it down through BIPX_GPU_LOCK_TOKEN and releases it in `finally`, so a killed suite can never leave it behind.
// Exit code 78 from a suite means `needs-staging-artefact` (tools/quality-staging.mjs) and is recorded as skipped, not failed.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sourceFingerprint } from "./quality-browser.mjs";
import { acquireGpuLock, GPU_LOCK_DIR } from "./quality-gpu-lock.mjs";
import { assertNotLiveServer, sanitizedEnv, startEphemeralServer } from "./quality-target.mjs";
import { NEEDS_STAGING_EXIT, NEEDS_STAGING_STATUS } from "./quality-staging.mjs";

// needs: cpu (pure Node) | server (spawns its own ephemeral WebSocket server) | http (needs the runner's server) | browser.
// target: consumes BIPX_BASE_URL. group: core = the historical verify:all list; extended = runtime harnesses outside it;
// historical = can only exercise a frozen snapshot, never selected unless named or --include-historical.
// selfLocks: the tool reserves the GPU with its own mkdir code; the runner must not hold the lock for it (it would wait on us).
const suite = (file, needs, options = {}) => ({ file, needs, group: "core", target: false, ...options });
const browser = (file, options = {}) => suite(file, "browser", { target: true, ...options });
export const registry = {
  verify: browser("verify-canvas.mjs"),
  "verify:skills": suite("verify-class-skills.mjs", "cpu"),
  "verify:skills:server": suite("verify-class-skills-server.mjs", "server"),
  "verify:skills:controls": suite("verify-class-skills-controls-server.mjs", "server"),
  "verify:experience": browser("verify-experience.mjs"),
  "verify:characters": browser("verify-character-experience.mjs"),
  "verify:projectiles": browser("verify-projectile-sweep.mjs"),
  "verify:keyboard": browser("verify-keyboard-combat.mjs"),
  "verify:natural": browser("verify-natural-runs.mjs", { target: false, timeoutMs: 1_200_000 }),
  "verify:motion": suite("verify-visual-motion.mjs", "cpu"),
  "verify:locomotion": browser("verify-locomotion-game.mjs"),
  "verify:melee": browser("verify-melee-integration.mjs"),
  "verify:melee:server": suite("verify-melee-server.mjs", "server"),
  "verify:npcs": browser("verify-npc-integration.mjs"),
  "verify:npcs:pool": suite("verify-enemy-pool.mjs", "cpu"),
  "verify:lifecycle": browser("verify-lifecycle.mjs"),
  "verify:vfx": browser("verify-vfx.mjs"),
  "verify:vfx:catalogue": browser("verify-vfx-catalogue.mjs"),
  "verify:mobile": browser("verify-mobile.mjs"),
  "verify:performance": browser("verify-performance.mjs"),
  "verify:performance:lv16": browser("verify-performance-lv16.mjs"),
  "verify:http": suite("verify-http.mjs", "http", { target: true }),
  "verify:multiplayer": suite("verify-multiplayer-world.mjs", "server"),
  "verify:classes": suite("verify-character-authority.mjs", "server"),
  "verify:orc": suite("verify-orc-spawning.mjs", "server"),
  "verify:evaluator": suite("verify-evaluator-contract.mjs", "cpu"),
  "verify:multiplayer:browser": browser("verify-multiplayer-browser.mjs"),
  "verify:assets": browser("assets-verify.mjs"),
  "verify:audio": browser("audio-verify.mjs"),
  "verify:audio:signal": browser("audio-signal-check.mjs", { target: false }),
  "verify:webkit": browser("verify-webkit.mjs"),
  "verify:reconnect": suite("verify-reconnect-protocol.mjs", "server"),
  "verify:reconnect:browser": browser("verify-reconnect-browser.mjs", { target: false }),
  "verify:npcs:lods": browser("verify-enemy-lods.mjs"),
  "verify:enemy-projectiles": suite("verify-enemy-projectiles.mjs", "cpu"),
  "verify:local-records": suite("verify-local-records.mjs", "cpu"),
  "verify:entry-ranking": browser("verify-entry-ranking.mjs", { target: false }),
  "verify:ranking-authority": suite("verify-ranking-authority.mjs", "server"),
  "verify:protocol": suite("verify-protocol-robustness.mjs", "server"),
  "verify:progression": suite("verify-progression-authority.mjs", "server"),
  "verify:progression:parity": suite("verify-progression-parity.mjs", "cpu"),
  // Extended: runtime harnesses that were never part of verify:all.
  "verify:hero-power": suite("verify-hero-power.mjs", "cpu", { group: "extended" }),
  "verify:hero-power:server": suite("verify-hero-power-server.mjs", "server", { group: "extended" }),
  "verify:skill-upgrades": suite("verify-skill-upgrades.mjs", "cpu", { group: "extended" }),
  "verify:skill-upgrades:server": suite("verify-skill-upgrades-server.mjs", "server", { group: "extended" }),
  "verify:arsenal": suite("verify-arsenal.mjs", "server", { group: "extended" }),
  "verify:spawn": suite("verify-player-spawn.mjs", "server", { group: "extended" }),
  "verify:physics": suite("physics-verify.mjs", "cpu", { group: "extended" }),
  "verify:physics:v2": suite("physics-v2-verify.mjs", "cpu", { group: "extended" }),
  "verify:physics:integration": suite("physics-integration.mjs", "cpu", { group: "extended" }),
  "verify:layout": suite("verify-arpg-layout.mjs", "cpu", { group: "extended" }),
  "verify:environment": suite("environment-cpu.mjs", "cpu", { group: "extended" }),
  "verify:crowd": suite("verify-crowd-integration.mjs", "cpu", { group: "extended", staging: true }),
  "verify:natural:evidence": suite("verify-arpg-natural-skill-evidence.mjs", "cpu", { group: "extended" }),
  "verify:skill-presentation": suite("verify-skill-presentation.mjs", "cpu", { group: "extended" }),
  "verify:skills:vfx": suite("class-skill-vfx-cpu.mjs", "cpu", { group: "extended" }),
  "verify:skills:animation": suite("animation-skill-cpu.mjs", "cpu", { group: "extended" }),
  "verify:vfx:elemental": suite("elemental-vfx-cpu.mjs", "cpu", { group: "extended" }),
  "verify:vfx:gravity-pool": suite("gravity-vfx-pool-cpu.mjs", "cpu", { group: "extended" }),
  "verify:vfx:cannon:wrapper": suite("cannon-wrapper-vfx-cpu.mjs", "cpu", { group: "extended" }),
  "verify:vfx:cannon:depth": suite("cannon-depth-vfx-cpu.mjs", "cpu", { group: "extended" }),
  "verify:vfx:cannon:origin": suite("cannon-origin-vfx-cpu.mjs", "cpu", { group: "extended" }),
  "verify:vfx:cannon:composition": suite("cannon-composition-vfx-cpu.mjs", "cpu", { group: "extended" }),
  "verify:animation:enemy-state": suite("animation-enemy-state-cpu.mjs", "cpu", { group: "extended" }),
  "verify:animation:retiming": suite("animation-retiming-cpu.mjs", "cpu", { group: "extended" }),
  "verify:monster:motion": suite("monster-motion-cpu.mjs", "cpu", { group: "extended" }),
  "verify:monster:phase": suite("monster-phase-cpu.mjs", "cpu", { group: "extended" }),
  "verify:enemy-locomotion": suite("enemy-locomotion-cpu.mjs", "cpu", { group: "extended" }),
  "verify:gpu-lock": suite("verify-gpu-lock.mjs", "cpu", { group: "extended" }),
  "verify:jef": suite("verify-jef-gate.mjs", "cpu", { group: "extended" }),
  "verify:qa-device": browser("verify-device-report.mjs", { group: "extended", target: false, selfLocks: true }),
  "verify:skills:browser": browser("verify-arpg-browser.mjs", { group: "extended", target: false }),
  "verify:skills:network": browser("verify-arpg-network.mjs", { group: "extended", target: false }),
  "verify:skills:audio": browser("audio-arpg-verify.mjs", { group: "extended", target: false }),
  // Historical: frozen-snapshot gates kept for provenance.
  "verify:vfx:cannon:prototype": suite("cannon-vfx-cpu.mjs", "cpu", { group: "historical" }),
};

const flags = new Map(), names = [];
for (const argument of process.argv.slice(2)) {
  if (!argument.startsWith("--")) { names.push(argument); continue; }
  const [flag, ...value] = argument.slice(2).split("="); flags.set(flag, value.length ? value.join("=") : true);
}
const known = new Set(["list", "json", "cpu-only", "browser-only", "evidence-dir", "timeout-ms", "base-url", "port", "include-historical", "help"]);
for (const flag of flags.keys()) if (!known.has(flag)) throw new Error(`Unknown option --${flag} (try --help)`);
for (const name of names) if (!registry[name]) throw new Error(`Unknown suite ${name} (try --list)`);
if (flags.get("cpu-only") && flags.get("browser-only")) throw new Error("--cpu-only and --browser-only exclude each other");
const defaultTimeoutMs = Number(flags.get("timeout-ms") ?? process.env.BIPX_SUITE_TIMEOUT_MS ?? 600_000);
if (!(defaultTimeoutMs > 0)) throw new Error("--timeout-ms must be a positive number");
const timeoutOf = entry => flags.has("timeout-ms") ? defaultTimeoutMs : Math.max(defaultTimeoutMs, entry.timeoutMs ?? 0);

if (flags.get("help")) { console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter(line => line.startsWith("//")).map(line => line.slice(3)).join("\n")); process.exit(0); }
if (flags.get("list")) {
  const rows = Object.entries(registry).map(([name, entry]) => ({ name, file: `tools/${entry.file}`, needs: entry.needs, group: entry.group, target: entry.target, timeoutMs: timeoutOf(entry), ...(entry.staging ? { staging: true } : {}), ...(entry.selfLocks ? { selfLocks: true } : {}) }));
  if (flags.get("json")) console.log(JSON.stringify(rows, null, 2));
  else for (const row of rows) console.log(`${row.name.padEnd(30)} ${row.needs.padEnd(8)} ${row.group.padEnd(10)} ${(row.target ? "target" : "-").padEnd(7)} ${String(row.timeoutMs / 1000).padStart(5)}s  ${row.file}${row.staging ? "  (full run needs a staging artefact)" : ""}`);
  process.exit(0);
}

const wanted = entry => (flags.get("cpu-only") ? entry.needs !== "browser" : flags.get("browser-only") ? entry.needs === "browser" : true);
const selected = (names.length ? names
  : Object.keys(registry).filter(name => (flags.get("cpu-only") || flags.get("browser-only") ? registry[name].group !== "historical" || flags.get("include-historical") : registry[name].group === "core" || (flags.get("include-historical") && registry[name].group === "historical"))))
  .filter(name => names.length ? true : wanted(registry[name]));
if (!selected.length) throw new Error("Selection is empty");
const externalBase = flags.has("base-url") ? assertNotLiveServer(flags.get("base-url"), "--base-url").origin : null;

const directory = path.resolve(flags.get("evidence-dir") || process.env.BIPX_EVIDENCE_DIR || `output/playwright/${new Date().toISOString().replace(/[:.]/g, "-")}-quality-suite`);
fs.mkdirSync(directory, { recursive: true });
const toolHashes = () => Object.fromEntries(fs.readdirSync("tools").filter(file => /\.(mjs|js)$/.test(file)).sort().map(file => [`tools/${file}`, crypto.createHash("sha256").update(fs.readFileSync(path.join("tools", file))).digest("hex")]));
const report = {
  startedAt: new Date().toISOString(), sourceHashes: sourceFingerprint(), verificationToolHashes: toolHashes(),
  executionEnvironment: { node: process.version, browserChannel: process.env.BIPX_BROWSER_CHANNEL || "playwright-chromium", headless: process.env.BIPX_HEADLESS !== "0", note: process.env.BIPX_QA_ENVIRONMENT_NOTE || null },
  runner: { selection: flags.get("cpu-only") ? "cpu-only" : flags.get("browser-only") ? "browser-only" : names.length ? "named" : "core", defaultTimeoutMs,
    server: externalBase ? { mode: "external", origin: externalBase } : { mode: "ephemeral-per-suite", host: "127.0.0.1", port: Number(flags.get("port") ?? 0), supabase: "blank", leaderboard: "disposable", secretsStripped: true },
    gpuLock: GPU_LOCK_DIR, livePortRefused: 5173 },
  allRequestedSuites: selected, results: [], ok: false, status: "running",
};
const save = () => fs.writeFileSync(path.join(directory, "suite.json"), `${JSON.stringify(report, null, 2)}\n`);
save();

let activeChild = null, interrupted = null;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { interrupted = signal; if (activeChild) killTree(activeChild, "SIGTERM"); });
function killTree(child, signal) { try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already gone */ } } }

async function runSuite(name) {
  const entry = registry[name], folder = path.join(directory, name.replace(/:/g, "-"));
  fs.mkdirSync(folder, { recursive: true });
  const result = { name, file: `tools/${entry.file}`, needs: entry.needs, startedAt: new Date().toISOString(), timeoutMs: timeoutOf(entry), evidenceDirectory: folder };
  let server = null, lease = null;
  const log = fs.createWriteStream(path.join(folder, "stdout.log"));
  try {
    if (entry.needs === "browser" && !entry.selfLocks) { lease = await acquireGpuLock({ owner: `run-quality-suite ${name}`, log: message => console.log(`  ${message}`) }); result.gpuLock = { waitedMs: lease.waitedMs, inherited: lease.inherited }; }
    if (entry.target && !externalBase) { server = await startEphemeralServer({ port: Number(flags.get("port") ?? 0), logFile: path.join(folder, "ephemeral-server.log") }); result.server = { origin: server.origin, pid: server.pid }; }
    const baseUrl = entry.target ? externalBase ?? server.origin : null;
    result.startedAt = new Date().toISOString(); // lock wait and server start are not charged to the suite
    const outcome = await new Promise(resolve => {
      const child = spawn(process.execPath, [path.join("tools", entry.file)], { detached: true, stdio: ["ignore", "pipe", "pipe"],
        env: sanitizedEnv({ BIPX_EVIDENCE_DIR: folder, ...(baseUrl ? { BIPX_BASE_URL: baseUrl } : {}), ...(lease?.env ?? {}) }) });
      activeChild = child; let timedOut = false;
      // SIGTERM first so Playwright can close its browsers and harnesses can stop their servers, then the whole process group.
      const timer = setTimeout(() => { timedOut = true; killTree(child, "SIGTERM"); setTimeout(() => killTree(child, "SIGKILL"), 5000).unref(); }, result.timeoutMs);
      child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
      child.on("error", error => { clearTimeout(timer); resolve({ exitCode: null, error: error.message, timedOut }); });
      child.on("close", (exitCode, signal) => { clearTimeout(timer); resolve({ exitCode, signal, timedOut }); });
    });
    activeChild = null; Object.assign(result, outcome);
  } catch (error) { result.exitCode = null; result.error = error.message; }
  finally { await server?.stop().catch(() => {}); lease?.release(); await new Promise(resolve => log.end(resolve)); }
  result.finishedAt = new Date().toISOString();
  result.status = result.timedOut ? "timeout" : result.exitCode === 0 ? "passed" : result.exitCode === NEEDS_STAGING_EXIT ? "skipped" : "failed";
  if (result.status === "skipped") result.reason = NEEDS_STAGING_STATUS;
  return result;
}

for (const name of selected) {
  if (interrupted) break;
  const result = await runSuite(name);
  report.results.push(result); save();
  const label = { passed: "PASS", failed: "FAIL", timeout: "TIMEOUT", skipped: "SKIP" }[result.status];
  console.log(`${name}: ${label}${result.status === "skipped" ? ` (${result.reason})` : ""} (${path.relative(process.cwd(), result.evidenceDirectory)})`);
}
report.sourceChangedDuringRun = JSON.stringify(report.sourceHashes) !== JSON.stringify(sourceFingerprint());
report.verificationToolsChangedDuringRun = JSON.stringify(report.verificationToolHashes) !== JSON.stringify(toolHashes());
report.finishedAt = new Date().toISOString();
const count = status => report.results.filter(result => result.status === status).length;
report.totals = { requested: selected.length, ran: report.results.length, passed: count("passed"), failed: count("failed"), timeout: count("timeout"), skipped: count("skipped") };
if (interrupted) report.interruptedBy = interrupted;
const clean = !interrupted && report.results.length === selected.length && report.totals.failed === 0 && report.totals.timeout === 0;
report.ok = clean && !report.sourceChangedDuringRun && !report.verificationToolsChangedDuringRun;
report.status = report.ok ? (report.totals.skipped ? "passed_with_skips" : "passed") : interrupted ? "interrupted" : report.sourceChangedDuringRun || report.verificationToolsChangedDuringRun ? "candidate_changed_rerun_required" : "failed";
save();
console.log(JSON.stringify({ ok: report.ok, status: report.status, totals: report.totals, evidenceDirectory: directory }));
if (!report.ok) process.exitCode = 1;
