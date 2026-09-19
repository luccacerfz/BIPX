import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';

const browser = await chromium.launch(browserLaunchOptions);
const results = [];
const state = page => page.evaluate(() => window.__zombieNightDebug.getState());
async function tabTo(page, id) {
  for (let step = 0; step < 35; step++) {
    if (await page.evaluate(() => document.activeElement?.id) === id) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Could not reach ${id} using the native Tab order`);
}
try {
  for (const character of ['warrior', 'dwarf']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__keyboardDialogEvents = [];
      document.addEventListener('close', event => {
        if (event.target.id !== 'game-dialog') return;
        const observe = phase => window.__keyboardDialogEvents.push({ phase, at: performance.now(), open: event.target.open, paused: window.__zombieNightDebug?.getState().paused, focus: document.activeElement?.id });
        observe('close-capture');
        setTimeout(() => observe('after-close-handlers'), 0);
      }, true);
    });
    const telemetry = attachQualityTelemetry(page, `keyboard-${character}`);
    const details = { character, input: 'Native keyboard events; no programmatic focus or start. A later target-placement phase is explicitly a fixture.' };
    try {
      await page.goto(await suiteUrl('/?offline=1'), { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      await tabTo(page, 'open-login-button');
      await page.keyboard.press('Enter');
      await tabTo(page, 'character-warrior');
      if (character === 'dwarf') await page.keyboard.press('ArrowRight');
      await waitForRuntimeAssets(page, telemetry);
      assert.equal(await page.locator(`#character-${character}`).isChecked(), true);
      await tabTo(page, 'play-button');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'game-canvas');
      const initial = await state(page);
      await page.keyboard.down('w'); await page.keyboard.down('i');
      await page.waitForTimeout(280);
      await page.keyboard.up('w'); await page.keyboard.up('i');
      const moved = await state(page);
      assert.ok(moved.player.z < initial.player.z - .2);
      assert.equal(moved.player.aimX, 0); assert.equal(moved.player.aimZ, -1);
      details.movement = { initial, moved };
      details.aim = [];
      for (const [keys, x, z] of [['l', 1, 0], ['j', -1, 0], ['k', 0, 1], ['il', Math.SQRT1_2, -Math.SQRT1_2], ['ij', -Math.SQRT1_2, -Math.SQRT1_2]]) {
        for (const key of keys) await page.keyboard.down(key);
        await page.waitForTimeout(75);
        const held = await state(page);
        for (const key of keys) await page.keyboard.up(key);
        await page.waitForTimeout(45);
        const aimed = await state(page);
        details.aim.push({ keys, expected: { x, z }, held: held.player, released: aimed.player });
        assert.ok(Math.abs(held.player.aimX - x) < .002 && Math.abs(held.player.aimZ - z) < .002, 'Held keyboard aim does not match input direction');
        assert.ok(Math.abs(aimed.player.aimX - x) < .002 && Math.abs(aimed.player.aimZ - z) < .002, 'Keyboard direction was not held after key release');
      }
      await page.keyboard.down('i'); await page.keyboard.down('l');
      await page.waitForTimeout(80);
      const diagonal = await state(page);
      await page.keyboard.up('i');
      await page.waitForTimeout(110);
      const partialHeld = await state(page);
      await page.keyboard.up('l');
      await page.waitForTimeout(80);
      const partialReleased = await state(page);
      details.partialRelease = { diagonal: diagonal.player, remainingKeyHeld: partialHeld.player, released: partialReleased.player };
      assert.ok(Math.abs(diagonal.player.aimX - Math.SQRT1_2) < .002 && Math.abs(diagonal.player.aimZ + Math.SQRT1_2) < .002);
      assert.equal(partialHeld.player.aimX, 1, 'Holding the remaining aim key did not become cardinal after the release grace');
      assert.equal(partialHeld.player.aimZ, 0);
      assert.equal(partialReleased.player.aimX, 1);
      assert.equal(partialReleased.player.aimZ, 0);
      await telemetry.capture('native-keyboard-move-and-aim');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('#game-dialog').open);
      assert.equal((await state(page)).paused, true);
      await tabTo(page, 'controls-tab'); await page.keyboard.press('Enter');
      assert.match(await page.locator('#controls-content').textContent(), /I J K L/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#game-dialog').open);
      details.immediateDialogClosed = await state(page);
      // The product resumes in the native close event, not in dialog.close().
      // Await its full observable outcome, retaining the earlier state/trace.
      await page.waitForFunction(() => !window.__zombieNightDebug.getState().paused && document.activeElement.id === 'game-canvas', null, { timeout: 1000 });
      details.dialogCloseEvents = await page.evaluate(() => window.__keyboardDialogEvents);
      assert.equal((await state(page)).paused, false);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'game-canvas');
      await page.keyboard.down('l'); await page.waitForTimeout(75); await page.keyboard.up('l');
      assert.equal((await state(page)).player.aimX, 1, 'Keyboard combat stopped responding after pause');

      telemetry.markFixture();
      await page.evaluate(character => {
        window.__zombieNightDebug.clearCombatEntities();
        window.__zombieNightDebug.spawnZombieAhead(character === 'warrior' ? 2.5 : 8, 'zombie');
      }, character);
      const before = await state(page);
      await page.keyboard.down('Space');
      await page.waitForFunction(kills => window.__zombieNightDebug.getState().kills > kills, before.kills, { timeout: 3500 });
      await page.keyboard.up('Space');
      const hit = await state(page);
      assert.equal(hit.weapon, character === 'warrior' ? 'katana' : 'pistol');
      if (character === 'warrior') assert.equal(hit.bullets, 0);
      details.attack = { before, hit };
      await telemetry.capture('space-defeated-placed-target');
      await page.waitForTimeout(650);
      await page.mouse.move(170, 700);
      await page.waitForTimeout(100);
      const pointer = await state(page);
      assert.ok(pointer.player.aimX < .9, 'Pointer failed to take over from keyboard aim');
      details.pointerHandoff = pointer.player;

      // Explicit XP fixture; selection/focus/shortcuts still use native input.
      await page.evaluate(() => {
        window.__zombieNightDebug.clearCombatEntities();
        window.__zombieNightDebug.grantXp(100);
      });
      await page.locator('#upgrade-options .upgrade-card').first().waitFor();
      let cardFocused = false;
      for (let step = 0; step < 40; step++) {
        if (await page.evaluate(() => Boolean(document.activeElement?.closest('#upgrade-options .upgrade-card')))) { cardFocused = true; break; }
        await page.keyboard.press('Tab');
      }
      assert.equal(cardFocused, true, 'Native Tab could not reach an upgrade card');
      details.upgradeKeyboard = [];
      for (let choice = 0; choice < 8; choice++) {
        const offered = await state(page);
        if (!offered.pendingUpgradeChoices.length) break;
        const focusBefore = await page.evaluate(() => ({ card: Boolean(document.activeElement?.closest('#upgrade-options .upgrade-card')), tag: document.activeElement?.tagName }));
        assert.equal(focusBefore.card, true, 'Chained upgrade lost keyboard focus');
        const index = choice === 1 ? 0 : Math.min(1, offered.pendingUpgradeChoices.length - 1);
        const key = choice === 1 ? 'Enter' : String(index + 1);
        if (choice === 0) await page.keyboard.down(key);
        else await page.keyboard.press(key);
        await page.waitForFunction(before => JSON.stringify(window.__zombieNightDebug.getState().build) !== before, JSON.stringify(offered.build), { timeout: 1000 });
        const after = await state(page);
        if (choice === 0) {
          if (after.pendingUpgradeChoices.length) {
            await page.keyboard.down(key); // Native repeated keydown while held.
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.deepEqual((await state(page)).build, after.build, 'Held digit autorepeat consumed a second upgrade');
          }
          await page.keyboard.up(key);
        }
        const focusAfter = await page.evaluate(() => ({ card: Boolean(document.activeElement?.closest('#upgrade-options .upgrade-card')), id: document.activeElement?.id, announcement: document.querySelector('#upgrade-announcement')?.textContent }));
        if (after.pendingUpgradeChoices.length) assert.equal(focusAfter.card, true, 'Next upgrade did not receive focus');
        else assert.equal(focusAfter.id, 'game-canvas', 'Completing upgrades did not restore canvas focus');
        details.upgradeKeyboard.push({ offered: offered.pendingUpgradeChoices, input: key, selectedIndex: index, focusBefore, beforeBuild: offered.build, afterBuild: after.build, focusAfter });
      }
      assert.ok(details.upgradeKeyboard.length >= 2, 'Fixture did not exercise chained upgrades');
      assert.equal((await state(page)).pendingUpgradeChoices.length, 0);
      assert.equal(await page.locator('#upgrade-announcement').getAttribute('aria-live'), 'polite');
      await telemetry.capture('keyboard-upgrades-completed');
      await page.keyboard.down('l'); await page.waitForTimeout(80); await page.keyboard.up('l');
      await page.evaluate(character => window.__zombieNightDebug.spawnZombieAhead(character === 'warrior' ? 2.5 : 8, 'zombie'), character);
      const postUpgradeBefore = await state(page);
      await page.keyboard.down('Space');
      await page.waitForFunction(kills => window.__zombieNightDebug.getState().kills > kills, postUpgradeBefore.kills, { timeout: 3500 });
      await page.keyboard.up('Space');
      details.postUpgradeCombat = { before: postUpgradeBefore, after: await state(page) };
      telemetry.assertClean();
      results.push({ character, passed: true });
    } catch (error) {
      telemetry.fail(error); results.push({ character, passed: false, error: error.stack }); process.exitCode = 1;
    } finally {
      telemetry.report.measurements = details;
      await telemetry.save(); await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'keyboard-combat.json'), JSON.stringify({ passed: results.every(result => result.passed), results }, null, 2));
  console.log(JSON.stringify({ results, evidenceDirectory: evidenceDir }));
}
