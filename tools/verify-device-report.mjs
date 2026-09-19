// Browser check of the device QA mode (`src/qa/device-report.js`).
//   npm run verify:qa-device            # starts its own isolated server on port 5361 and takes the shared GPU lock
//   node tools/verify-device-report.mjs http://127.0.0.1:5361/    # use a server that is already running
//
// Loads the game with `?offline=1&qa=TEST` in Playwright Chromium with touch emulation (390x844), plays about
// 20 s with real touch events, taps "Copiar relatório QA" and validates the copied JSON. Also checks the
// button at 844x390, that it never sits on an existing control, that tokens are stripped from `href`, and that
// the module is inert without the flag. Viewport emulation is NOT physical-device evidence.
//
// GPU is shared between agents: `mkdir /tmp/bipx-arpg-gpu.lock` is the atomic lock (retry every 2 s, up to
// 25 min); we write an `owner` file, hold it well under 4 min and only ever remove a lock we own.
// Set BIPX_GPU_LOCK_HELD=1 when a parent process already holds the lock.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium, browserLaunchOptions, waitForRuntimeAssets, attachQualityTelemetry, evidenceDir } from './quality-browser.mjs';
import { sanitizedChildEnv } from './lib/child-env.mjs';

const LOCK = '/tmp/bipx-arpg-gpu.lock';
const PORT = Number(process.env.BIPX_QA_DEVICE_PORT || 5361);
const HOLD_LIMIT_MS = 170_000;
const token = crypto.randomUUID();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquireGpuLock() {
  if (process.env.BIPX_GPU_LOCK_HELD === '1') return () => {};
  const deadline = Date.now() + 25 * 60_000;
  for (;;) {
    try { fs.mkdirSync(LOCK); break; } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() > deadline) throw new Error('GPU lock was busy for 25 minutes; giving up without touching it.');
      await sleep(2000);
    }
  }
  fs.writeFileSync(path.join(LOCK, 'owner'), JSON.stringify({ owner: 't7-jef-gate verify-device-report', pid: process.pid, token, created: new Date().toISOString(), maxHoldSeconds: HOLD_LIMIT_MS / 1000 }));
  return () => {
    try { if (JSON.parse(fs.readFileSync(path.join(LOCK, 'owner'), 'utf8')).token === token) fs.rmSync(LOCK, { recursive: true, force: true }); } catch { /* not ours or already gone: never remove a lock we do not own */ }
  };
}

async function startServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-qa-device-'));
  const child = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: sanitizedChildEnv({ HOST: '127.0.0.1', PORT: String(PORT), LEADERBOARD_FILE: path.join(scratch, 'lb.json') }), stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  const stop = async () => { child.kill('SIGTERM'); await Promise.race([new Promise((resolve) => child.once('close', resolve)), sleep(1500)]); if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL'); fs.rmSync(scratch, { recursive: true, force: true }); };
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) { await stop(); throw new Error(`Server exited during startup (is port ${PORT} busy?): ${output.slice(-400)}`); }
    try { const response = await fetch(`http://127.0.0.1:${PORT}/`, { signal: AbortSignal.timeout(1000) }); if (response.ok) { await response.arrayBuffer(); return { origin: `http://127.0.0.1:${PORT}/`, stop }; } } catch { /* not up yet */ }
    await sleep(200);
  }
  await stop();
  throw new Error(`Server did not answer on port ${PORT}: ${output.slice(-400)}`);
}

// Runs in the page: where is the QA button and what does it touch?
function readButtonLayout() {
  const button = document.getElementById('qa-report-button');
  if (!button) return { present: false };
  const rect = button.getBoundingClientRect();
  const controls = 'button,a[href],input,select,textarea,summary,[role="button"],#touch-stick,#touch-fire,.arpg-hud,.survivor-hud,.leaderboard-panel,.game-tools';
  const overlaps = [];
  for (const element of document.querySelectorAll(controls)) {
    if (element === button || element.closest('#qa-report-fallback')) continue;
    const other = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (other.width < 1 || other.height < 1 || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.01) continue;
    if (element.closest('[hidden], .is-hidden') || element.closest('dialog:not([open])')) continue;
    const width = Math.min(rect.right, other.right) - Math.max(rect.left, other.left);
    const height = Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top);
    if (width > 0 && height > 0) overlaps.push({ element: element.id || element.className || element.tagName, width: Math.round(width), height: Math.round(height) });
  }
  const hud = document.querySelector('.survivor-hud')?.getBoundingClientRect();
  const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return { present: true, label: button.textContent, rect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }, viewport: { width: innerWidth, height: innerHeight }, hudBottom: hud && hud.height > 0 ? Math.round(hud.bottom) : null, overlaps, hittable: top === button, insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight, overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
}

function assertButton(layout, label) {
  assert.ok(layout.present, `${label}: QA button is missing`);
  assert.ok(layout.rect.width >= 44 && layout.rect.height >= 44, `${label}: touch target is ${layout.rect.width}x${layout.rect.height}, needs at least 44x44`);
  assert.ok(layout.rect.width <= 140 && layout.rect.height <= 64, `${label}: button is not small (${layout.rect.width}x${layout.rect.height})`);
  assert.deepEqual(layout.overlaps, [], `${label}: QA button overlaps existing controls`);
  assert.ok(layout.insideViewport && layout.hittable, `${label}: QA button is not reachable (${JSON.stringify(layout.rect)})`);
  assert.ok(layout.rect.left <= 60, `${label}: QA button is not on the left edge`);
  assert.ok(layout.rect.top <= layout.viewport.height * 0.6, `${label}: QA button is not in the upper part of the screen`);
  if (layout.hudBottom !== null) assert.ok(layout.rect.top >= layout.hudBottom, `${label}: QA button is not under the HUD`);
  assert.ok(layout.overflowX <= 1, `${label}: page overflows horizontally`);
}

async function startRunWithTouch(page) {
  await page.locator('#open-login-button').tap();
  await page.locator('#player-name').fill('QA Touch');
  await page.locator('#play-button').tap();
  await page.waitForFunction(() => window.__zombieNightDebug?.getState?.().state === 'playing', null, { timeout: 20_000 });
}

async function playWithTouch(page, context, seconds) {
  const stick = await page.locator('#touch-stick').boundingBox();
  const fire = await page.locator('#touch-fire').boundingBox();
  assert.ok(stick && fire, 'Touch controls are not visible under touch emulation');
  const cdp = await context.newCDPSession(page);
  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0], [0.7, -0.7]];
  const startedAt = Date.now();
  let phase = 0;
  while (Date.now() - startedAt < seconds * 1000) {
    const [dx, dy] = directions[phase % directions.length];
    const move = { x: stick.x + stick.width / 2, y: stick.y + stick.height / 2, id: 1 };
    const shoot = { x: fire.x + fire.width / 2, y: fire.y + fire.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [move] });
    move.x += dx * Math.min(30, stick.width / 3); move.y += dy * Math.min(30, stick.height / 3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [move] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [move, shoot] });
    await page.waitForTimeout(3200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const skill = page.locator('#arpg-hud button').nth(phase % 3);
    if (await skill.isVisible().catch(() => false)) await skill.tap({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
    phase += 1;
  }
  await cdp.detach();
  return phase;
}

function validateReport(report, { code, width, minFrames }) {
  assert.deepEqual([report.kind, report.version, report.code], ['bipx-device-qa-report', 1, code]);
  for (const field of ['startedAt', 'copiedAt']) assert.ok(!Number.isNaN(Date.parse(report[field])), `${field} is not a timestamp`);
  assert.ok(Date.parse(report.copiedAt) >= Date.parse(report.startedAt) && report.durationS > 0);
  assert.match(report.href, /^http:\/\/127\.0\.0\.1:\d+\/\?/);
  assert.ok(report.href.includes(`qa=${code}`) && report.href.includes('offline=1'));
  assert.ok(typeof report.userAgent === 'string' && report.userAgent.length > 20);
  assert.ok(typeof report.webgl?.renderer === 'string' && report.webgl.renderer.length > 0, 'WebGL renderer string is missing');
  const total = report.frames.total;
  assert.ok(total.frames >= minFrames, `only ${total.frames} frames were recorded`);
  assert.ok(total.p50Ms > 0 && total.p50Ms <= total.p95Ms && total.p95Ms <= total.p99Ms && total.p99Ms <= Math.max(total.maxMs, total.p99Ms), `percentiles are not ordered: ${JSON.stringify(total)}`);
  assert.ok(Number.isInteger(total.longFrames) && total.longFrames >= 0 && report.frames.longFrameMs === 50);
  assert.ok(Array.isArray(report.frames.minutes) && typeof report.frames.currentMinute.frames === 'number');
  assert.equal(typeof report.longTasks.supported, 'boolean');
  assert.ok(Number.isInteger(report.longTasks.count) && Array.isArray(report.longTasks.recent));
  assert.ok(typeof report.orientation.current.type === 'string' && Array.isArray(report.orientation.changes.entries));
  for (const side of ['top', 'right', 'bottom', 'left']) assert.equal(typeof report.safeArea.current[side], 'number', `safe-area ${side}`);
  assert.equal(report.viewport.current.innerWidth, width);
  assert.ok(report.viewport.history.entries.length >= 1 && report.viewport.current.devicePixelRatio > 0);
  assert.ok(report.audio.supported === true && Array.isArray(report.audio.transitions.entries));
  assert.ok(report.visibility.current === 'visible' && Array.isArray(report.visibility.changes.entries));
}

const releaseLock = await acquireGpuLock();
const lockAcquiredAt = Date.now();
let server = null;
let browser = null;
const watchdog = setTimeout(async () => {
  console.error('GPU hold limit reached; closing the browser and releasing the lock.');
  await Promise.race([Promise.allSettled([browser?.close(), server?.stop()]), sleep(5000)]);
  releaseLock();
  process.exit(1);
}, HOLD_LIMIT_MS);
const result = { scope: 'Chromium touch EMULATION of the device QA mode; not physical-device evidence.', evidenceDirectory: evidenceDir, checks: [] };
try {
  server = process.argv[2] ? { origin: process.argv[2], stop: async () => {} } : await startServer();
  const url = (extra) => { const target = new URL(server.origin); target.searchParams.set('offline', '1'); for (const [name, value] of Object.entries(extra)) target.searchParams.set(name, value); return target.toString(); };
  browser = await chromium.launch(browserLaunchOptions);

  // ---- 1. Portrait 390x844: play about 20 s with touch, tap the button, validate the copied JSON. -------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, 'qa-device-portrait');
    telemetry.markFixture();
    try {
      await page.goto(url({ qa: 'TEST' }), { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      const menu = await page.evaluate(readButtonLayout);
      assertButton(menu, 'portrait menu');
      await startRunWithTouch(page);
      const phases = await playWithTouch(page, context, 20);
      await page.waitForTimeout(1200); // let the 1 Hz placement settle on the playing HUD
      const playing = await page.evaluate(readButtonLayout);
      assertButton(playing, 'portrait playing');
      const before = await page.evaluate(() => window.__zombieNightDebug.getState());
      if (before.state === 'playing') assert.ok(playing.hudBottom !== null, 'HUD was not visible while playing');
      await telemetry.capture('playing-with-qa-button');
      await page.locator('#qa-report-button').tap();
      await page.waitForFunction(() => document.getElementById('qa-report-button').textContent.includes('Copiado'), null, { timeout: 5000 });
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      assert.equal(clipboard, await page.evaluate(() => window.__bipxQaReport.lastCopied), 'clipboard does not hold the report that the button built');
      const report = JSON.parse(clipboard);
      validateReport(report, { code: 'TEST', width: 390, minFrames: 300 });
      assert.ok(clipboard.length < 24_000 && !/\n/.test(clipboard), `report is not compact (${clipboard.length} bytes)`);
      assert.ok(report.audio.contexts >= 1 && report.audio.transitions.entries.some((entry) => entry.state === 'running'), 'AudioContext transitions were not recorded after the first touch');
      const after = await page.evaluate(() => window.__zombieNightDebug.getState());
      assert.equal(after.state, before.state, 'tapping the QA button changed the game state');
      telemetry.assertClean();
      result.checks.push({ name: 'portrait-390x844-touch-play-and-copy', passed: true, touchPhases: phases, gameState: after.state, menuButton: menu.rect, playingButton: playing.rect, hudBottom: playing.hudBottom, reportBytes: clipboard.length, frames: report.frames.total, longTasks: { supported: report.longTasks.supported, count: report.longTasks.count }, webglRenderer: report.webgl.renderer, audioTransitions: report.audio.transitions.entries.map((entry) => entry.state), safeArea: report.safeArea.current });
      fs.writeFileSync(path.join(evidenceDir, 'qa-report-portrait.json'), `${JSON.stringify(report, null, 2)}\n`);
    } catch (error) { telemetry.fail(error); throw error; } finally { await telemetry.save(); await context.close(); }
  }

  // ---- 2. Landscape 844x390: layout while playing, rotation recorded, tokens stripped from href. ----------------
  {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, 'qa-device-landscape');
    telemetry.markFixture();
    try {
      await page.goto(url({ qa: 'TEST-land_01', resumeToken: 'SECRET-TOKEN-123', name: 'Lucca' }), { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      assertButton(await page.evaluate(readButtonLayout), 'landscape menu');
      await startRunWithTouch(page);
      await playWithTouch(page, context, 4);
      await page.waitForTimeout(1200);
      const playing = await page.evaluate(readButtonLayout);
      assertButton(playing, 'landscape playing');
      await telemetry.capture('landscape-playing-with-qa-button');
      const orientationBefore = await page.evaluate(() => screen.orientation?.type ?? null);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(1500);
      const rotated = await page.evaluate(readButtonLayout);
      assertButton(rotated, 'after rotation to portrait');
      const report = await page.evaluate(() => window.__bipxQaReport.getReport());
      validateReport(report, { code: 'TEST-land_01', width: 390, minFrames: 60 });
      assert.ok(!JSON.stringify(report).includes('SECRET-TOKEN-123') && !JSON.stringify(report).includes('Lucca'), 'href leaked a token or the player name');
      assert.ok(report.viewport.history.entries.length >= 2, 'the viewport change was not recorded');
      const orientationAfter = await page.evaluate(() => screen.orientation?.type ?? null);
      if (orientationBefore !== orientationAfter) assert.ok(report.orientation.changes.entries.length >= 1, 'the orientation change was not recorded');
      telemetry.assertClean();
      result.checks.push({ name: 'landscape-844x390-layout-rotation-and-token-stripping', passed: true, playingButton: playing.rect, rotatedButton: rotated.rect, href: report.href, orientationChanges: report.orientation.changes.entries.length, viewportsRecorded: report.viewport.history.entries.length });
    } catch (error) { telemetry.fail(error); throw error; } finally { await telemetry.save(); await context.close(); }
  }

  // ---- 3. Without the flag (or with an invalid code) the module is inert. ------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    for (const extra of [{}, { qa: 'bad code!' }, { qa: '' }]) {
      await page.goto(url(extra), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.readyState === 'complete', null, { timeout: 30_000 });
      const state = await page.evaluate(() => ({ button: Boolean(document.getElementById('qa-report-button')), api: typeof window.__bipxQaReport }));
      assert.deepEqual(state, { button: false, api: 'undefined' }, `module must be inert for ${JSON.stringify(extra)}`);
    }
    await context.close();
    result.checks.push({ name: 'inert-without-valid-qa-flag', passed: true });
  }
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  await browser?.close().catch(() => {});
  await server?.stop().catch(() => {});
  releaseLock();
  result.gpuLockHeldSeconds = Math.round((Date.now() - lockAcquiredAt) / 1000);
  fs.writeFileSync(path.join(evidenceDir, 'device-report-summary.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}
