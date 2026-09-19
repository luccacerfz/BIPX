import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { attachQualityTelemetry, waitForRuntimeAssets, sampleAnimationFrames, evidenceDir } from './quality-browser.mjs';

const launchOptions = { headless: process.env.BIPX_HEADLESS !== '0' };
const browser = await webkit.launch(launchOptions);
const results = [];
const readState = page => page.evaluate(() => window.__zombieNightDebug.getState());
try {
  for (const scenario of [
    { name: 'webkit-desktop-warrior', width: 1440, height: 900, character: 'warrior', touch: false },
    { name: 'webkit-portrait-dwarf', width: 390, height: 844, character: 'dwarf', touch: true },
    { name: 'webkit-landscape-warrior', width: 874, height: 402, character: 'warrior', touch: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, isMobile: scenario.touch, hasTouch: scenario.touch, deviceScaleFactor: scenario.touch ? 2 : 1 });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, scenario.name);
    telemetry.report.browserLaunch = { engine: 'webkit', ...launchOptions };
    telemetry.report.scope = 'Playwright WebKit on this Mac. Real menu input, keyboard combat and rendered frames. Compact viewports emulate layout; this is not Safari.app, iOS hardware, mobile GPU performance or simultaneous multitouch proof.';
    const measurements = { scenario, physicalDevice: false };
    const activate = async selector => scenario.touch ? page.locator(selector).tap() : page.locator(selector).click();
    try {
      await page.goto(process.argv[2] || 'http://127.0.0.1:5173/?offline=1', { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      await activate('#open-login-button');
      await activate(`label[for="character-${scenario.character}"]`);
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#player-name').fill(`QA ${scenario.name}`);
      assert.equal(await page.locator(`#character-${scenario.character}`).isChecked(), true);
      await telemetry.capture('selection');
      await activate('#play-button');
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      const before = await readState(page);
      await page.keyboard.down('w'); await page.keyboard.down('l'); await page.keyboard.down('Space');
      await page.waitForTimeout(250);
      const active = await readState(page);
      assert.ok(active.player.z < before.player.z - .1, 'WebKit keyboard movement failed');
      assert.equal(active.character, scenario.character);
      assert.equal(active.weapon, scenario.character === 'warrior' ? 'katana' : 'pistol');
      if (scenario.character === 'warrior') {
        assert.equal(active.bullets, 0, 'Warrior emitted a projectile');
        assert.ok(active.swordSwingRemaining > 0, 'Sword attack did not start');
      } else assert.ok(active.bullets > 0 || active.kills > before.kills, 'Rifle did not fire');
      await page.keyboard.up('w'); await page.keyboard.up('l'); await page.keyboard.up('Space');
      await page.waitForTimeout(250);
      const released = await readState(page);
      await page.waitForTimeout(200);
      assert.ok(Math.abs((await readState(page)).player.z - released.player.z) < .1, 'Movement stayed active after release');
      const audio = await page.evaluate(() => window.__zombieNightDebug.getAudioState());
      assert.ok(audio.unlocked && audio.contextState === 'running', 'User gesture did not unlock WebKit audio');
      await telemetry.capture('combat');
      await activate('#pause-button');
      await page.waitForFunction(() => document.querySelector('#game-dialog').open && window.__zombieNightDebug.getState().paused);
      const paused = await readState(page);
      await page.waitForTimeout(200);
      assert.equal((await readState(page)).survivalTime, paused.survivalTime, 'Pause did not freeze simulation');
      await page.locator('#motion-toggle').check();
      await page.locator('#quality-select').selectOption('medium');
      assert.equal(await page.evaluate(() => window.__bipxPresentation.getSettings().reducedMotion), true);
      await telemetry.capture('settings');
      await activate('#dialog-done');
      await page.waitForFunction(() => !window.__zombieNightDebug.getState().paused && document.activeElement.id === 'game-canvas');
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, hud: document.querySelector('.survivor-hud').getBoundingClientRect().toJSON(), width: innerWidth, height: innerHeight }));
      assert.ok(layout.overflow <= 1, 'Horizontal overflow in WebKit');
      assert.ok(layout.hud.x >= 0 && layout.hud.right <= layout.width + 1 && layout.hud.bottom <= layout.height + 1, 'HUD outside WebKit viewport');
      const frames = await page.evaluate(sampleAnimationFrames, 2000);
      frames.environmentLimit = 'Playwright WebKit on this Mac; viewport emulation is not physical mobile hardware evidence';
      Object.assign(measurements, { before, active, released, paused, audio, layout, frames });
      telemetry.assertClean();
      results.push({ name: scenario.name, passed: true, frames });
    } catch (error) {
      telemetry.fail(error); process.exitCode = 1;
      results.push({ name: scenario.name, passed: false, error: error.stack });
    } finally {
      await telemetry.save({ measurements });
      await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'webkit-summary.json'), JSON.stringify({ passed: results.every(result => result.passed), results }, null, 2));
  console.log(JSON.stringify({ evidenceDir, results }));
}
