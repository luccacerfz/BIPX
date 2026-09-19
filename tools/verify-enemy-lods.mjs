import { suiteUrl } from './quality-target.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, sampleAnimationFrames, evidenceDir } from './quality-browser.mjs';

const browser = await chromium.launch(browserLaunchOptions);
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 874, height: 402 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, mobile ? 'lod-landscape' : 'lod-desktop');
    telemetry.markFixture();
    telemetry.report.scope = "Real browser renderer with an explicitly static stress fixture: stressLevel6 disables AI/player/combat simulation. FPS is rendering evidence, not full moving-gameplay performance.";
    const measurements = {};
    let releaseLod;
    // Deliberately let real animated actors attach before the final static asset
    // arrives, exercising the fallback migration used on a slow connection.
    const gate = new Promise(resolve => { releaseLod = resolve; });
    if (!mobile) await page.route('**/enemy-lods/lich.glb', async route => { await gate; await route.continue(); });
    try {
      await page.goto(await suiteUrl('/?offline=1&autoplay=1&quality=auto'), { waitUntil: 'domcontentloaded' });
      await waitForRuntimeAssets(page, telemetry);
      if (!mobile) await page.evaluate(() => window.__zombieNightDebug.start());
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      if (!mobile) {
        await page.evaluate(() => {
          const debug = window.__zombieNightDebug;
          debug.clearCombatEntities();
          for (const [i, type] of ['orcPeon', 'zombie', 'brute', 'caster'].entries()) debug.spawnZombieAhead(7 + i, type);
        });
        await page.waitForFunction(() => window.__zombieNightDebug.getPresentationStats().assets.enemies.active === 4);
        measurements.beforeLateLod = await page.evaluate(() => window.__zombieNightDebug.getPresentationStats().assets.enemies);
        releaseLod();
      }
      await page.waitForFunction(() => window.__zombieNightDebug.getEnemyLodStats?.().loaded);
      await page.waitForTimeout(100);
      measurements.afterLateLod = await state(page);
      check(measurements.afterLateLod, mobile);
      assert.equal(measurements.afterLateLod.lods.mixers, 0);
      assert.equal(measurements.afterLateLod.lods.skeletons, 0);
      for (const entry of measurements.afterLateLod.lods.entries) {
        assert.ok(entry.triangles >= 500 && entry.triangles <= 1000);
        assert.ok(Math.abs(entry.height - 1) < .002 && Math.abs(entry.minY) < .002);
      }
      await telemetry.capture('pre-horde-playing');
      await page.evaluate(() => {
        const debug = window.__zombieNightDebug;
        debug.clearCombatEntities();
        for (let i = 0; i < 30; i++) debug.spawnZombieAhead(3.5 + i * .015, ['orcPeon', 'zombie', 'brute', 'caster'][i % 4]);
      });
      await page.waitForTimeout(250);
      measurements.exhaustedAnimationBudget = await state(page);
      check(measurements.exhaustedAnimationBudget, mobile);
      assert.equal(measurements.exhaustedAnimationBudget.actors.active, mobile ? 10 : 20);
      assert.ok(measurements.exhaustedAnimationBudget.lods.entities.some(entity => entity.mode === 'detail' && !entity.animated && entity.detailVisible), 'Detail fallback at animation capacity was not exercised');
      await page.evaluate(() => {
        const debug = window.__zombieNightDebug;
        debug.clearCombatEntities();
        debug.stressLevel6(61);
        debug.spawnZombieAhead(30, 'orcPeon');
        // Beyond proxy range: verifies textured instancing for every source.
        for (const type of ['orcPeon', 'zombie', 'brute', 'caster']) debug.spawnZombieAhead(110, type);
      });
      await page.waitForTimeout(500);
      measurements.dense61 = await state(page);
      check(measurements.dense61, mobile);
      assert.ok(measurements.dense61.lods.entities.length >= 61);
      assert.ok(measurements.dense61.lods.entities.some(entity => !entity.animated && !entity.instanced && (entity.detailVisible || entity.proxyVisible)), 'Static mesh fallback was not exercised');
      for (const type of ['orcPeon', 'zombie', 'brute', 'caster']) {
        const bucket = measurements.dense61.lods.buckets.find(candidate => candidate.type === type);
        assert.ok(bucket?.native && bucket.count > 0, `${type} did not use native instancing`);
      }
      await telemetry.capture('dense61-debug-fixture');
      measurements.frames = await page.evaluate(sampleAnimationFrames, 5000);
      measurements.afterFrameSample = await state(page);
      check(measurements.afterFrameSample, mobile);
      assert.ok(measurements.frames.averageFps >= (mobile ? 18 : 24), `FPS below existing viewport floor: ${measurements.frames.averageFps}`);
      await page.evaluate(() => window.__zombieNightDebug.start());
      await page.waitForTimeout(150);
      measurements.restarted = await state(page);
      assert.ok(measurements.restarted.lods.entities.length < 5);
      await page.evaluate(() => {
        const debug = window.__zombieNightDebug;
        debug.clearCombatEntities();
        debug.stressLevel6(61);
      });
      await page.waitForTimeout(200);
      measurements.reused = await state(page);
      check(measurements.reused, mobile);
      assert.deepEqual(measurements.reused.perf.poolExpansions, measurements.dense61.perf.poolExpansions, 'Restart grew entity pools');
      if (mobile) {
        measurements.chips = await page.locator('.skill-chip').evaluateAll(chips => chips.map(chip => {
          const label = chip.querySelector('small').getBoundingClientRect();
          const clip = chip.closest('.skill-list').getBoundingClientRect();
          const icon = chip.querySelector('.ui-icon')?.getBoundingClientRect();
          return { text: chip.textContent.trim(), label: label.toJSON(), clip: clip.toJSON(), icon: icon?.toJSON() };
        }));
        assert.ok(measurements.chips.length > 0);
        for (const { label, clip, icon } of measurements.chips) {
          assert.ok(label.top >= clip.top && label.bottom <= clip.bottom && label.right <= clip.right, 'Skill level label is clipped');
          if (icon) assert.ok(icon.height <= 12.1, 'Skill icon ignores compact font size');
        }
        await telemetry.capture('unclipped-skill-label');
      }
      telemetry.assertClean();
      results.push({ mobile, passed: true, frames: measurements.frames });
    } catch (error) {
      telemetry.fail(error);
      results.push({ mobile, passed: false, error: error.stack });
      process.exitCode = 1;
    } finally {
      releaseLod();
      await telemetry.save({ measurements });
      await context.close();
    }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'enemy-lods.json'), JSON.stringify({ passed: results.every(result => result.passed), results }, null, 2));
  console.log(JSON.stringify({ passed: results.every(result => result.passed), results, evidenceDirectory: evidenceDir }, null, 2));
}

async function state(page) {
  return page.evaluate(() => ({ lods: window.__zombieNightDebug.getEnemyLodStats(), actors: window.__zombieNightDebug.getPresentationStats().assets.enemies, integrity: window.__zombieNightDebug.getRenderIntegrity(), perf: window.__zombieNightDebug.getPerfStats() }));
}
function check(snapshot, mobile) {
  assert.equal(snapshot.integrity.invisibleThreats, 0);
  assert.ok(snapshot.actors.allocated <= (mobile ? 10 : 20));
  assert.ok(snapshot.actors.active + snapshot.actors.corpses <= (mobile ? 10 : 20));
  for (const entity of snapshot.lods.entities) {
    assert.equal(entity.native, true, `${entity.type} still uses procedural geometry`);
    assert.equal(entity.obsoleteChildren, 0, `${entity.type} retains obsolete children`);
    if (entity.animated) assert.ok(!entity.detailVisible && !entity.proxyVisible, 'Static copy overlaps animated actor');
    else if (!entity.instanced) assert.ok(entity.visible && (entity.detailVisible || entity.proxyVisible), 'Unanimated entity is invisible');
  }
  for (const bucket of snapshot.lods.buckets.filter(bucket => ['orcPeon', 'zombie', 'runner', 'brute', 'caster'].includes(bucket.type))) assert.equal(bucket.native, true);
}
