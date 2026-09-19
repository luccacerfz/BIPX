import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, evidenceDir, waitForRuntimeAssets } from './quality-browser.mjs';

const browser = await chromium.launch(browserLaunchOptions);
const results = [];
try {
  for (const character of ['warrior', 'dwarf']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: path.join(evidenceDir, 'video'), size: { width: 1440, height: 900 } } });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, `character-${character}`);
    const details = { character, phases: [] };
    try {
      await page.goto(await suiteUrl('/?offline=1'), { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${character}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      assert.equal(await page.locator(`#character-${character}`).isChecked(), true);
      assert.equal((await page.evaluate(() => window.__bipxCharacters.getState())).selected, character);
      if (character === 'warrior') {
        // Warm both cached prototypes before measuring repeated UI switches.
        for (const id of ['dwarf', 'warrior']) {
          await page.locator(`label[for="character-${id}"]`).click();
          await waitForRuntimeAssets(page, telemetry);
        }
        const baseline = await page.evaluate(() => window.__zombieNightDebug.getPresentationStats().resources);
        const switches = [];
        for (let cycle = 0; cycle < 20; cycle++) {
          const id = cycle % 2 ? 'warrior' : 'dwarf';
          await page.locator(`label[for="character-${id}"]`).click();
          await waitForRuntimeAssets(page, telemetry);
          const resources = await page.evaluate(() => window.__zombieNightDebug.getPresentationStats().resources);
          assert.equal((await page.evaluate(() => window.__bipxCharacters.getState())).selected, id);
          assert.ok(resources.geometries <= baseline.geometries && resources.textures <= baseline.textures, `GPU resources grew on character switch ${cycle + 1}: ${JSON.stringify({ baseline, resources })}`);
          switches.push({ character: id, resources });
        }
        details.selectionLifecycle = { baseline, switches };
      }
      await telemetry.capture('menu-selected');
      await page.reload({ waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      assert.equal(await page.locator(`#character-${character}`).isChecked(), true, 'Visible selection was not restored after reload');
      await page.locator('#open-login-button').click();
      await page.locator('#player-name').fill(`QA ${character}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      const initial = await snapshot(page);
      assert.equal(initial.game.character, character);
      assert.equal(initial.game.weapon, character === 'warrior' ? 'katana' : 'pistol');
      const changed = await page.evaluate(id => window.__bipxCharacters.select(id), character === 'warrior' ? 'dwarf' : 'warrior');
      assert.equal(changed, false, 'Character changed during playing');
      await page.mouse.move(1050, 440);
      await page.keyboard.down('w');
      await page.mouse.down();
      await page.waitForTimeout(370);
      const active = await snapshot(page);
      details.phases.push({ name: 'natural menu, persistence, movement and class animation', initial, active });
      await telemetry.capture('natural-move-attack');
      await page.mouse.up(); await page.keyboard.up('w');
      assert.ok(active.game.player.z < initial.game.player.z - .1);
      assert.ok(active.hero.animationTime > 0, 'Imported character animation did not advance');
      if (character === 'warrior') {
        assert.equal(active.game.bullets, 0);
        assert.ok(active.game.swordSwingRemaining > 0);
        assert.equal(active.hero.currentClip, 'Attack');
      } else {
        assert.ok(active.game.bullets > 0 || active.game.kills > initial.game.kills);
        assert.equal(active.hero.currentClip, 'Shoot');
      }

      // Target placement below is explicitly a diagnostic fixture; input still
      // uses real pointer presses, and the normal game damage path must fire.
      telemetry.markFixture();
      await page.waitForTimeout(650);
      await page.evaluate(() => window.__zombieNightDebug.clearCombatEntities());
      await page.mouse.move(1050, 440);
      await page.waitForTimeout(60);
      await page.evaluate(distance => window.__zombieNightDebug.spawnZombieAhead(distance, 'zombie'), character === 'warrior' ? 2.5 : 8);
      const beforeHit = await snapshot(page);
      const attackStarted = Date.now();
      await page.mouse.down();
      await page.waitForTimeout(70);
      const windup = await snapshot(page);
      if (character === 'warrior') assert.equal(windup.game.kills, beforeHit.game.kills, 'Sword dealt damage before its impact phase');
      await page.waitForFunction(kills => window.__zombieNightDebug.getState().kills > kills, beforeHit.game.kills, { timeout: 2000 });
      const impactElapsedMs = Date.now() - attackStarted;
      const afterHit = await snapshot(page);
      await telemetry.capture('actual-target-hit');
      await page.mouse.up();
      assert.equal(afterHit.game.weapon, character === 'warrior' ? 'katana' : 'pistol');
      if (character === 'warrior') assert.equal(afterHit.game.bullets, 0);
      details.phases.push({ name: 'placed target defeated through real attack input', beforeHit, windup, afterHit, impactElapsedMs });

      await page.evaluate(() => window.__zombieNightDebug.equipWeapon('boneCannon'));
      const buff = await snapshot(page);
      assert.equal(buff.game.weapon, character === 'warrior' ? 'katana' : 'pistol');
      // Arsenal returned (loop/t3): the pickup is a relic infusing the class attack for the relic's own duration (22 s).
      assert.equal(buff.game.relic, 'boneCannon');
      assert.ok(buff.game.weaponTimer > 0 && buff.game.weaponTimer <= 22);
      await page.evaluate(() => {
        window.__zombieNightDebug.unlockAutoWeapon('guardianBlade');
        window.__zombieNightDebug.unlockAutoWeapon('orbitOrb');
        window.__zombieNightDebug.unlockAutoWeapon('sealRain');
        window.__zombieNightDebug.clearCombatEntities();
      });
      await page.waitForTimeout(2500);
      const idle = await snapshot(page);
      assert.equal(idle.game.bullets, 0, 'Automatic weapon companions must never create rifle projectiles');
      await page.evaluate(() => {
        const state = window.__zombieNightDebug.getState();
        window.__zombieNightDebug.grantXp(state.xpToNext);
      });
      const choices = await snapshot(page);
      // autoWeapon/sealRitual are offered to both classes again; only the rifle-only upgrades stay forbidden for the sword.
      const forbidden = character === 'warrior' ? ['projectile', 'prismStorm'] : [];
      assert.ok(choices.game.pendingUpgradeChoices.length > 0);
      assert.ok(choices.game.pendingUpgradeChoices.every(id => !forbidden.includes(id)), 'Upgrade offered a role-incompatible upgrade');
      await page.keyboard.press('Digit1');
      details.phases.push({ name: 'relic infusion and upgrades preserve role; automatic weapons are companions, not projectiles', buff, idle, choices });

      await page.evaluate(() => window.__zombieNightDebug.damagePlayer(999999));
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'dead');
      await page.waitForTimeout(200);
      assert.equal((await snapshot(page)).hero.currentClip, 'Death');
      await telemetry.capture('death');
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      const restarted = await snapshot(page);
      assert.equal(restarted.game.character, character);
      assert.equal(restarted.game.weapon, character === 'warrior' ? 'katana' : 'pistol');
      assert.equal(restarted.game.health, restarted.game.maxHealth);
      assert.equal(restarted.game.bullets, 0);
      assert.ok(Object.values(restarted.game.autoWeapons).every(level => level === 0));
      details.phases.push({ name: 'death and restart preserve class and clear old weapons', restarted });
      telemetry.report.measurements = details;
      telemetry.assertClean();
      results.push({ character, passed: true, details });
    } catch (error) {
      telemetry.report.measurements = details;
      telemetry.fail(error);
      results.push({ character, passed: false, error: error.stack });
      process.exitCode = 1;
    } finally {
      await telemetry.save();
      await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'character-experience.json'), JSON.stringify({ passed: results.every(result => result.passed), results }, null, 2));
  console.log(JSON.stringify({ passed: results.every(result => result.passed), evidenceDirectory: evidenceDir, results: results.map(({ character, passed, error }) => ({ character, passed, error })) }));
}
async function snapshot(page) { return page.evaluate(() => ({ game: window.__zombieNightDebug.getState(), hero: window.__zombieNightDebug.getPresentationStats().assets.hero, vfx: window.__zombieNightDebug.getVfxStats() })); }
