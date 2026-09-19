import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';

const instrumentation = `
let qualityMeleeEnemy = null;
let qualityMeleeHits = [];
function qualityMeleeState() {
  return { health: player.health, hits: [...qualityMeleeHits], paused, exists: zombies.includes(qualityMeleeEnemy),
    expectedDamage: qualityMeleeEnemy ? qualityMeleeEnemy.damage + Math.floor(player.wave * .55) : null,
    strike: qualityMeleeEnemy?.meleeAttack ? { ...qualityMeleeEnemy.meleeAttack } : null,
    position: qualityMeleeEnemy?.mesh.position.toArray(),
    actor: animatedEnemies.getStats().actors.find(actor => actor.entityId === qualityMeleeEnemy?.id) || null,
  };
}
function qualityMeleeVisual() {
  if (qualityMeleeEnemy && zombies.includes(qualityMeleeEnemy)) { qualityMeleeEnemy.renderMode = 'detail'; qualityMeleeEnemy.mesh.visible = true; }
  animatedEnemies.update(zombies, { dt: 0, playerPosition: player.position, mobile: false, quality: 'high' });
}
window.__qualityMelee = {
  setup(type) {
    window.__bipxPresentation.setPaused(true);
    clearEntities(); game.perfStressImmortal = false;
    player.position.set(0, 0, 0); player.mesh.position.copy(player.position);
    player.maxHealth = 200; player.health = 200; player.damageReduction = 0; player.revives = 0;
    player.perks = {}; player.critChance = 0;
    qualityMeleeHits = [];
    let health = 200;
    Object.defineProperty(player, 'health', { configurable: true, get: () => health, set: value => {
      if (value < health) qualityMeleeHits.push({ amount: health - value, elapsed: qualityMeleeEnemy?.meleeAttack?.elapsed });
      health = value;
    }});
    qualityMeleeEnemy = spawnZombie(1.5, 0, type, { eliteType: false, maxHealth: 100, health: 100 });
    refreshLivingPlayerTargets(); updateZombies(0); qualityMeleeVisual();
    return qualityMeleeState();
  },
  step(dt) { refreshLivingPlayerTargets(); updateZombies(dt); qualityMeleeVisual(); return qualityMeleeState(); },
  move(x, z) { player.position.set(x, 0, z); player.mesh.position.copy(player.position); return qualityMeleeState(); },
  freeze(seconds) { qualityMeleeEnemy.freezeTimer = seconds; return qualityMeleeState(); },
  kill() { damageZombie(qualityMeleeEnemy, 100000, false, false); return qualityMeleeState(); },
  reattach() { animatedEnemies.remove(qualityMeleeEnemy); qualityMeleeVisual(); return qualityMeleeState(); },
  renderAgain() { qualityMeleeVisual(); return qualityMeleeState(); },
  state: qualityMeleeState,
};
`;

const browser = await chromium.launch(browserLaunchOptions);
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const telemetry = attachQualityTelemetry(page, 'melee-integration');
telemetry.markFixture();
telemetry.report.scope = 'Deterministic solo integration of production updateZombies/damage/status, plus real RAF pause/resume and real animated actor late attach. An isolated main response append exposes fixture controls; no production functions are replaced. No natural-gameplay claim.';
telemetry.report.instrumentationSha256 = crypto.createHash('sha256').update(instrumentation).digest('hex');
const cases = [];
const call = (method, ...args) => page.evaluate(({ method, args }) => window.__qualityMelee[method](...args), { method, args });
function check(name, details) { cases.push({ name, passed: true, details }); }
try {
  const expectedMain = crypto.createHash('sha256').update(fs.readFileSync('src/main.js')).digest('hex');
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch(); const source = await response.text();
    telemetry.report.servedMainSha256 = crypto.createHash('sha256').update(source).digest('hex');
    assert.equal(telemetry.report.servedMainSha256, expectedMain);
    await route.fulfill({ status: response.status(), contentType: 'text/javascript', body: source + '\n' + instrumentation });
  });
  await page.goto(await suiteUrl('/?offline=1&autoplay=1'), { waitUntil: 'networkidle' });
  await waitForRuntimeAssets(page, telemetry);
  await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
  for (const type of ['zombie', 'runner']) {
    let start = await call('setup', type);
    assert.equal(start.strike.elapsed, 0); assert.equal(start.hits.length, 0);
    assert.equal(start.strike.impactTime, .46); assert.equal(start.strike.duration, .88);
    const before = await call('step', .45);
    assert.equal(before.health, 200, `${type} damaged during windup`);
    const impact = await call('step', .011);
    assert.equal(impact.hits.length, 1); assert.equal(impact.health, 200 - start.expectedDamage);
    const recovery = await call('step', .43);
    assert.equal(recovery.hits.length, 1); assert.equal(recovery.strike.active, false);
    check(`${type}: no early damage, one impact, recovery`, { start, before, impact, recovery });

    start = await call('setup', type);
    const large = await call('step', .9); const afterLarge = await call('step', .001);
    assert.equal(large.hits.length, 1); assert.equal(afterLarge.hits.length, 1);
    check(`${type}: step crossing impact and end still damages once`, { large, afterLarge });

    await call('setup', type); await call('step', .2); await call('move', 4, 0);
    const outOfRange = await call('step', .3);
    assert.equal(outOfRange.health, 200); assert.equal(outOfRange.strike.impactConsumed, true);
    check(`${type}: range dodge after windup`, outOfRange);

    await call('setup', type); await call('step', .2); await call('move', 2.9, 0);
    const behind = await call('step', .3);
    assert.equal(behind.health, 200); assert.equal(behind.strike.impactConsumed, true);
    check(`${type}: move behind locked arc after windup`, behind);

    await call('setup', type); await call('step', .2); await call('freeze', 1);
    const frozen = await call('step', .5);
    assert.equal(frozen.health, 200); assert.equal(frozen.strike.active, false);
    assert.notEqual(frozen.actor.currentClip, 'Attack');
    check(`${type}: freeze cancels pending impact and visual attack`, frozen);

    await call('setup', type); await call('step', .2); await call('kill');
    const killed = await call('step', .5);
    assert.equal(killed.exists, false); assert.equal(killed.health, 200);
    check(`${type}: death cancels pending impact`, killed);

    await call('setup', type); const current = await call('step', .3);
    const reattached = await call('reattach');
    assert.equal(reattached.actor.currentClip, 'Attack');
    assert.ok(Math.abs(reattached.actor.attack.normalizedTime - current.strike.elapsed / current.strike.duration) < 1e-6, 'Late actor restarted at time zero');
    const repeated = await call('renderAgain');
    assert.equal(repeated.actor.attack.startCount, reattached.actor.attack.startCount);
    assert.equal(repeated.health, 200); assert.equal(repeated.hits.length, 0);
    check(`${type}: late attachment preserves authoritative phase without damage`, { current, reattached, repeated });
  }
  await call('setup', 'zombie'); const pauseBefore = await call('step', .2);
  await page.waitForTimeout(250);
  const pauseAfter = await call('state');
  assert.equal(pauseAfter.strike.elapsed, pauseBefore.strike.elapsed);
  assert.equal(pauseAfter.health, 200);
  await page.evaluate(() => window.__bipxPresentation.setPaused(false));
  await page.waitForFunction(() => window.__qualityMelee.state().hits.length > 0, null, { timeout: 1500 });
  await page.evaluate(() => window.__bipxPresentation.setPaused(true));
  const resumed = await call('state');
  assert.equal(resumed.hits.length, 1);
  assert.ok(resumed.strike.elapsed >= resumed.strike.impactTime);
  check('real RAF pause freezes attack; resume reaches one impact', { pauseBefore, pauseAfter, resumed });
  await telemetry.capture('paused-at-real-impact');
  telemetry.assertClean();
} catch (error) { telemetry.fail(error); process.exitCode = 1; }
finally {
  await telemetry.save({ measurements: { cases } });
  await browser.close();
  console.log(JSON.stringify({ passed: telemetry.report.assertions === 'passed', checks: cases.length, failure: telemetry.report.failure, evidenceDirectory: evidenceDir }));
}
