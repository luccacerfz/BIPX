// Native browser evidence. Runs only against an immutable runtime copy supplied by the caller.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, sampleAnimationFrames, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
const root = path.resolve(process.argv[2] || '.');
const lock = '/tmp/bipx-arpg-gpu.lock';
fs.mkdirSync(lock); // Atomic; never remove another owner's reservation.
fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'environment-native', pid: process.pid, root, startedAt: new Date().toISOString() }));
let server, browser;
try {
  process.chdir(root);
  server = await localServer();
  browser = await chromium.launch(browserLaunchOptions);
  for (const character of (process.env.ENV_CLASSES || 'warrior,dwarf').split(',')) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: evidenceDir, size: { width: 1440, height: 900 } } });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, `environment-${character}`);
    const details = { root, scope: 'Real isolated game with trusted keyboard/mouse input, no gameplay state injection. Frozen source copy; not global acceptance of the concurrently edited checkout.', samples: [] };
    const sample = () => page.evaluate(() => ({ state: window.__zombieNightDebug.getState(), presentation: window.__zombieNightDebug.getPresentationStats(), perf: window.__zombieNightDebug.getPerfStats() }));
    try {
      await page.goto(`${server.origin}/?offline=1&quality=high`, { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry, { timeoutMs: 90000 });
      await telemetry.capture('menu');
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${character}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#player-name').fill(`Environment ${character}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      await telemetry.capture('start');
      details.samples.push(await sample());
      await page.mouse.move(1080, 400);
      await page.mouse.down();
      for (const [i, keys] of [['w'], ['d'], ['s'], ['a'], ['w','a'], ['s','d']].entries()) {
        for (const key of keys) await page.keyboard.down(key);
        details.samples.push({ segment: i, frames: await page.evaluate(sampleAnimationFrames, 3200), ...(await sample()) });
        for (const key of keys) await page.keyboard.up(key);
        if (i === 0 || i === 3 || i === 5) await telemetry.capture(`route-${i}`);
        const upgrade = page.locator('#upgrade-panel:not(.hidden) button').first();
        if (await upgrade.isVisible().catch(() => false)) await upgrade.click();
      }
      await page.mouse.up();
      details.final = await sample();
      assert(details.final.state.survivalTime > 12, 'Game time did not advance through route');
      assert(details.final.presentation.assets.errors.length === 0, 'Missing runtime assets');
      telemetry.assertClean();
    } catch (error) { telemetry.fail(error); process.exitCode = 1; }
    finally { await telemetry.save(details); await context.close(); }
    console.log(JSON.stringify({ character, evidenceDir, assertions: telemetry.report.assertions, sourceChanged: telemetry.report.sourceChangedDuringRun, error: telemetry.report.failure, final: details.final?.state }));
  }
} finally {
  await browser?.close();
  await server?.stop();
  if (JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).pid === process.pid) fs.rmSync(lock, { recursive: true });
}
