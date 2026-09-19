import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';

const browser = await chromium.launch(browserLaunchOptions);
const results = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
    await context.addInitScript(() => localStorage.setItem('bipx-character', 'dwarf'));
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, mobile ? 'npc-mobile' : 'npc-desktop');
    telemetry.markFixture();
    telemetry.report.scope = 'Explicit spawned-target and horde fixture in the real game renderer. Keyboard/pointer damage uses production combat; emulated viewport does not prove physical mobile performance.';
    const details = { mobile, physicalDevice: false };
    try {
      await page.goto(process.argv[2] || 'http://127.0.0.1:5173/?offline=1&autoplay=1', { waitUntil: 'networkidle' });
      await waitForRuntimeAssets(page, telemetry);
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      await page.waitForFunction(() => ['orc','monsters'].every(id => window.__zombieNightDebug.getPresentationStats().assets.enemies.libraries.includes(id)));
      await page.mouse.move(mobile ? 290 : 1050, mobile ? 400 : 450);
      await page.evaluate(() => {
        window.__zombieNightDebug.clearCombatEntities();
        for (const [index, type] of ['orcPeon','zombie','brute','caster'].entries()) window.__zombieNightDebug.spawnZombieAhead(6 + index * 1.1, type);
      });
      await page.waitForFunction(() => ['orcPeon','zombie','brute','caster'].every(type => window.__zombieNightDebug.getPresentationStats().assets.enemies.actors.some(actor => actor.type === type)));
      const before = await stats(page);
      await page.waitForTimeout(500);
      const after = await stats(page);
      for (const type of ['orcPeon','zombie','brute','caster']) {
        const actor = after.actors.find(actor => actor.type === type);
        const previous = before.actors.find(candidate => candidate.entityId === actor?.entityId);
        assert.ok(actor && previous && actor.bones > 0 && actor.clips.length >= 5, `${type} lacks a real animated skeleton`);
        assert.ok(Number.isFinite(actor.animationTime) && actor.animationTime !== previous.animationTime, `${type} animation did not advance`);
        assert.ok(['Walk','Run','Attack','Spell','Idle'].includes(actor.currentClip), `${type} has unknown live animation ${actor.currentClip}`);
        assert.ok(Math.hypot(actor.position.x - previous.position.x, actor.position.z - previous.position.z) > .05, `${type} did not move in the actual game simulation`);
      }
      details.movement = { before, after };
      await telemetry.capture('four-animated-types');

      await page.evaluate(() => {
        window.__zombieNightDebug.clearCombatEntities();
        window.__zombieNightDebug.spawnZombieAhead(8, 'orcPeon');
      });
      await page.waitForFunction(() => window.__zombieNightDebug.getPresentationStats().assets.enemies.actors.some(actor => actor.type === 'orcPeon'));
      const beforeHit = await page.evaluate(() => window.__zombieNightDebug.getState());
      await page.mouse.down();
      await page.waitForFunction(() => window.__zombieNightDebug.getPresentationStats().assets.enemies.actors.some(actor => actor.type === 'orcPeon' && actor.currentClip === 'Hit'), null, { polling: 'raf', timeout: 2500 });
      const hit = await stats(page);
      await page.mouse.up();
      await telemetry.capture('orc-hit');
      await page.waitForTimeout(350);
      await page.mouse.down();
      await page.waitForFunction(() => window.__zombieNightDebug.getPresentationStats().assets.enemies.corpseActors.some(actor => actor.type === 'orcPeon' && actor.currentClip === 'Death'), null, { polling: 'raf', timeout: 3000 });
      const dead = await stats(page);
      await page.mouse.up();
      const afterKill = await page.evaluate(() => window.__zombieNightDebug.getState());
      assert.ok(afterKill.kills > beforeHit.kills && afterKill.score > beforeHit.score, 'Animated Orc death did not accompany gameplay reward');
      assert.ok(dead.corpses > 0 && dead.active + dead.corpses <= dead.limit);
      details.combat = { beforeHit, hit, dead, afterKill };
      await telemetry.capture('orc-death');

      await page.evaluate(() => window.__zombieNightDebug.stressLevel16(360));
      await page.waitForTimeout(1000);
      const dense = await stats(page);
      assert.equal(dense.limit, mobile ? 10 : 20);
      assert.ok(dense.active > 0 && dense.allocated <= dense.limit && dense.active + dense.corpses <= dense.limit, 'Skeleton pool exceeded its desktop/mobile bound');
      const integrity = await page.evaluate(() => window.__zombieNightDebug.getRenderIntegrity());
      assert.equal(integrity.invisibleThreats, 0, 'Horde pool created invisible threats');
      details.dense = { stats: dense, integrity };
      await telemetry.capture('bounded-horde');
      const restarted = await page.evaluate(() => { window.__zombieNightDebug.start(); return window.__zombieNightDebug.getPresentationStats().assets.enemies; });
      assert.equal(restarted.active, 0); assert.equal(restarted.corpses, 0);
      assert.ok(restarted.allocated <= restarted.limit);
      details.restarted = restarted;
      telemetry.report.measurements = details;
      telemetry.assertClean();
      results.push({ mobile, passed: true });
    } catch (error) { telemetry.report.measurements = details; telemetry.fail(error); results.push({ mobile, passed: false, error: error.stack }); process.exitCode = 1; }
    finally { await telemetry.save(); await context.close(); }
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(evidenceDir, 'npc-integration.json'), JSON.stringify({ passed: results.every(result => result.passed), results }, null, 2));
  console.log(JSON.stringify({ passed: results.every(result => result.passed), results, evidenceDirectory: evidenceDir }));
}
async function stats(page) { return page.evaluate(() => window.__zombieNightDebug.getPresentationStats().assets.enemies); }
