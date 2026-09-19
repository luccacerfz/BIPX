import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { sourceFingerprint } from "./quality-browser.mjs";

const available = {
  verify: "verify-canvas.mjs",
  "verify:skills": "verify-class-skills.mjs",
  "verify:skills:server": "verify-class-skills-server.mjs",
  "verify:skills:controls": "verify-class-skills-controls-server.mjs",
  "verify:experience": "verify-experience.mjs",
  "verify:characters": "verify-character-experience.mjs",
  "verify:projectiles": "verify-projectile-sweep.mjs",
  "verify:keyboard": "verify-keyboard-combat.mjs",
  "verify:natural": "verify-natural-runs.mjs",
  "verify:motion": "verify-visual-motion.mjs",
  "verify:locomotion": "verify-locomotion-game.mjs",
  "verify:melee": "verify-melee-integration.mjs",
  "verify:melee:server": "verify-melee-server.mjs",
  "verify:npcs": "verify-npc-integration.mjs",
  "verify:npcs:pool": "verify-enemy-pool.mjs",
  "verify:lifecycle": "verify-lifecycle.mjs",
  "verify:vfx": "verify-vfx.mjs",
  "verify:vfx:catalogue": "verify-vfx-catalogue.mjs",
  "verify:mobile": "verify-mobile.mjs",
  "verify:performance": "verify-performance.mjs",
  "verify:performance:lv16": "verify-performance-lv16.mjs",
  "verify:http": "verify-http.mjs",
  "verify:multiplayer": "verify-multiplayer-world.mjs",
  "verify:classes": "verify-character-authority.mjs",
  "verify:orc": "verify-orc-spawning.mjs",
  "verify:evaluator": "verify-evaluator-contract.mjs",
  "verify:multiplayer:browser": "verify-multiplayer-browser.mjs",
  "verify:assets": "assets-verify.mjs",
  "verify:audio": "audio-verify.mjs",
  "verify:audio:signal": "audio-signal-check.mjs",
  "verify:webkit": "verify-webkit.mjs",
  "verify:reconnect": "verify-reconnect-protocol.mjs",
  "verify:reconnect:browser": "verify-reconnect-browser.mjs",
  "verify:npcs:lods": "verify-enemy-lods.mjs",
  "verify:enemy-projectiles": "verify-enemy-projectiles.mjs",
  "verify:local-records": "verify-local-records.mjs",
  "verify:entry-ranking": "verify-entry-ranking.mjs",
  "verify:ranking-authority": "verify-ranking-authority.mjs",
  "verify:protocol": "verify-protocol-robustness.mjs",
  "verify:progression": "verify-progression-authority.mjs",
  "verify:progression:parity": "verify-progression-parity.mjs",
};
const selected = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(available);
for (const name of selected) if (!available[name]) throw new Error(`Unknown suite ${name}`);
const directory = path.resolve(process.env.BIPX_EVIDENCE_DIR || `output/playwright/${new Date().toISOString().replace(/[:.]/g, "-")}-quality-suite`);
fs.mkdirSync(directory, { recursive: true });
const toolHashes = () => Object.fromEntries(fs.readdirSync('tools').filter(file => /\.(mjs|js)$/.test(file)).sort().map(file => [`tools/${file}`, crypto.createHash('sha256').update(fs.readFileSync(path.join('tools', file))).digest('hex')]));
const report = {
  startedAt: new Date().toISOString(), sourceHashes: sourceFingerprint(), verificationToolHashes: toolHashes(),
  executionEnvironment: { node: process.version, browserChannel: process.env.BIPX_BROWSER_CHANNEL || 'playwright-chromium', headless: process.env.BIPX_HEADLESS !== '0', note: process.env.BIPX_QA_ENVIRONMENT_NOTE || null },
  allRequestedSuites: selected, results: [], ok: false, status: "running",
};
const save = () => fs.writeFileSync(path.join(directory, "suite.json"), `${JSON.stringify(report, null, 2)}\n`);
save();
for (const name of selected) {
  const folder = path.join(directory, name.replace(/:/g, "-"));
  fs.mkdirSync(folder, { recursive: true });
  const startedAt = new Date().toISOString();
  const log = fs.createWriteStream(path.join(folder, "stdout.log"));
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join("tools", available[name])], { env: { ...process.env, BIPX_EVIDENCE_DIR: folder }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on("error", (error) => resolve({ exitCode: null, error: error.message }));
    child.on("close", (exitCode, signal) => resolve({ exitCode, signal }));
  });
  await new Promise((resolve) => log.end(resolve));
  report.results.push({ name, startedAt, finishedAt: new Date().toISOString(), status: result.exitCode === 0 ? "passed" : "failed", ...result, evidenceDirectory: folder });
  save();
  console.log(`${name}: ${result.exitCode === 0 ? "PASS" : "FAIL"} (${path.relative(process.cwd(), folder)})`);
}
report.sourceChangedDuringRun = JSON.stringify(report.sourceHashes) !== JSON.stringify(sourceFingerprint());
report.verificationToolsChangedDuringRun = JSON.stringify(report.verificationToolHashes) !== JSON.stringify(toolHashes());
report.finishedAt = new Date().toISOString();
report.ok = report.results.every((result) => result.status === "passed") && !report.sourceChangedDuringRun && !report.verificationToolsChangedDuringRun;
report.status = report.ok ? "passed" : report.sourceChangedDuringRun || report.verificationToolsChangedDuringRun ? "candidate_changed_rerun_required" : "failed";
save();
console.log(JSON.stringify({ ok: report.ok, status: report.status, evidenceDirectory: directory }));
if (!report.ok) process.exitCode = 1;
