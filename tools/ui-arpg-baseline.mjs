import fs from 'node:fs';
import path from 'node:path';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';

const lock = '/tmp/bipx-arpg-gpu.lock';
try { fs.mkdirSync(lock); } catch (error) { if (error.code === 'EEXIST') { console.log('GPU occupied; baseline deferred.'); process.exit(75); } throw error; }
fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'gui-baseline', pid: process.pid, startedAt: new Date().toISOString() }));
let browser;
try {
  browser = await chromium.launch(browserLaunchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const telemetry = attachQualityTelemetry(page, 'gui-before');
  try {
    await page.goto('http://127.0.0.1:5173/?offline=1');
    await waitForRuntimeAssets(page, telemetry);
    await telemetry.capture('menu');
    await page.locator('#open-login-button').click();
    await page.locator('#player-name').fill('GUI baseline');
    await page.locator('#play-button').click();
    await page.waitForFunction(() => document.querySelector('#message').classList.contains('is-hidden'));
    await page.waitForTimeout(1200);
    await telemetry.capture('gameplay');
    telemetry.assertClean();
  } catch (error) { telemetry.fail(error); throw error; }
  finally { await telemetry.save(); }
  console.log(evidenceDir);
} finally {
  await browser?.close();
  if (JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'))).pid === process.pid) fs.rmSync(lock, { recursive: true });
}
