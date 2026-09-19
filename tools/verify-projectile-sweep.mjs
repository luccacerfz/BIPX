import { suiteUrl } from './quality-target.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';

// Appended only to the response in this isolated Playwright context. Production
// functions are neither replaced nor reimplemented, and no public hook is added.
const instrumentation = `
window.__qualityProjectileSweep = (spec) => {
  clearEntities();
  player.critChance = 0;
  player.perks = {};
  player.weaponTimer = 0;
  Object.assign(player.upgradeStats, { damageMultiplier: 1, areaMultiplier: 1, projectileBonus: 0 });
  player.aimDirection.set(1, 0, 0);
  const hits = [];
  const targets = spec.targets.map((target) => {
    const entity = spawnZombie(target.x, target.z || 0, 'runner', { eliteType: false, health: target.health || 100, maxHealth: 100 });
    let health = entity.health;
    Object.defineProperty(entity, 'health', {
      configurable: true,
      get: () => health,
      set: (value) => {
        if (value < health) hits.push({ name: target.name, damage: health - value, impact: bullets[0]?.mesh.position.toArray() });
        health = value;
      },
    });
    return { name: target.name, entity };
  });
  spawnBullet();
  if (bullets.length !== 1) throw Error('The real rifle factory did not produce exactly one projectile');
  const bullet = bullets[0];
  // Position is the explicit fixture input; speed/radius/damage come from the
  // real rifle factory. Optional pierce count exercises shared collision policy.
  bullet.mesh.position.set(0, 1.12, 0);
  bullet.trailPosition.copy(bullet.mesh.position);
  if (spec.pierceHits !== undefined) bullet.pierceHits = spec.pierceHits;
  if (spec.remainingLife !== undefined) bullet.age = bullet.lifespan - spec.remainingLife;
  const initial = { speed: bullet.velocity.length(), radius: bullet.radius, damage: bullet.damage, age: bullet.age, lifespan: bullet.lifespan, targetRadii: targets.map(t => t.entity.radius) };
  const gridOrder = queryZombiesNear(new THREE.Vector3(.84, 0, 0), 3, []).map(entity => targets.find(t => t.entity === entity)?.name);
  const frames = [];
  for (const dt of spec.steps || [.035]) {
    updateBullets(dt);
    frames.push({ dt, activeBullets: bullets.length, age: bullet.age, previous: bullet.previousPosition.toArray(), next: bullet.nextPosition.toArray(), hitIds: [...bullet.hitZombies], health: targets.map(t => ({ name: t.name, health: t.entity.health })) });
  }
  return { initial, gridOrder, hits, frames, survivingTargets: targets.filter(t => zombies.includes(t.entity)).map(t => t.name) };
};
`;

const cases = [
  { name: 'crosses-runner-between-both-endpoints-at-35ms', targets: [{ name: 'runner', x: .84 }], expectHits: ['runner'], active: 0 },
  { name: 'near-miss-outside-expanded-radius', targets: [{ name: 'runner', x: .84, z: .701 }], expectHits: [], active: 1 },
  { name: 'nearest-impact-wins-reversed-grid-order', targets: [{ name: 'far', x: 1.5 }, { name: 'near', x: .82 }], expectHits: ['near'], active: 0, gridOrder: ['far', 'near'] },
  { name: 'expiry-prevents-hit-after-remaining-segment', targets: [{ name: 'beyond-life', x: 1.3 }], remainingLife: .01, expectHits: [], active: 0, maxTravel: .48 },
  { name: 'hit-before-expiry-endpoint', targets: [{ name: 'within-life', x: 1.15 }], remainingLife: .01, expectHits: ['within-life'], active: 0, maxTravel: .48 },
  { name: 'pierce-consumes-nearest-two-in-order', targets: [{ name: 'far', x: 1.55 }, { name: 'middle', x: 1.15 }, { name: 'near', x: .75 }], pierceHits: 1, expectHits: ['near', 'middle'], active: 0, gridOrder: ['far', 'middle', 'near'] },
  { name: 'pierced-target-not-damaged-again-next-frame', targets: [{ name: 'runner', x: .84 }], pierceHits: 3, steps: [.02, .015], expectHits: ['runner'], active: 1 },
  { name: 'lethal-pierce-removal-retains-next-target', targets: [{ name: 'far', x: 1.3 }, { name: 'near', x: .75, health: 2 }], pierceHits: 1, expectHits: ['near', 'far'], active: 0, survivors: ['far'] },
  { name: 'target-behind-shot-is-not-hit', targets: [{ name: 'behind', x: -.9 }], expectHits: [], active: 1 },
];

const browser = await chromium.launch(browserLaunchOptions);
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(() => localStorage.setItem('bipx-character', 'dwarf'));
const page = await context.newPage();
const telemetry = attachQualityTelemetry(page, 'projectile-sweep');
telemetry.markFixture();
telemetry.report.scope = 'Deterministic integration fixture in the real game: unmodified spawnBullet, spawnZombie, spatial grid, updateBullets, damageZombie and removal. Test response appends access only. This is not naturally timed gameplay or a subjective combat review.';
telemetry.report.instrumentationSha256 = crypto.createHash('sha256').update(instrumentation).digest('hex');
const results = [];
try {
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    telemetry.report.servedMainSha256 = crypto.createHash('sha256').update(source).digest('hex');
    assert.equal(telemetry.report.servedMainSha256, telemetry.reportExpectedMainSha256, 'Main changed before instrumentation');
    await route.fulfill({ status: response.status(), contentType: 'text/javascript', body: source + '\n' + instrumentation });
  });
  telemetry.reportExpectedMainSha256 = crypto.createHash('sha256').update(fs.readFileSync('src/main.js')).digest('hex');
  await page.goto(await suiteUrl('/?offline=1&autoplay=1'), { waitUntil: 'networkidle' });
  await waitForRuntimeAssets(page, telemetry);
  await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
  await page.evaluate(() => window.__bipxPresentation.setPaused(true));
  for (const spec of cases) {
    const result = await page.evaluate(spec => window.__qualityProjectileSweep(spec), spec);
    results.push({ name: spec.name, fixture: spec, result, passed: false });
    assert.equal(result.initial.speed, 48);
    assert.equal(result.initial.radius, .12);
    assert.equal(result.initial.damage, 2);
    assert.ok(result.initial.targetRadii.every(radius => radius === .58));
    assert.deepEqual(result.hits.map(hit => hit.name), spec.expectHits, `${spec.name}: wrong contact order`);
    assert.ok(result.hits.every(hit => hit.damage === 2), `${spec.name}: wrong damage or duplicate hit`);
    assert.equal(result.frames.at(-1).activeBullets, spec.active);
    if (spec.gridOrder) assert.deepEqual(result.gridOrder, spec.gridOrder, 'Fixture did not actually reverse spatial iteration');
    if (spec.maxTravel) assert.ok(result.frames.at(-1).next[0] <= spec.maxTravel + 1e-10, 'Projectile moved beyond lifetime');
    if (spec.survivors) assert.deepEqual(result.survivingTargets, spec.survivors);
    if (spec.name.startsWith('crosses-runner')) {
      assert.ok(Math.abs(result.hits[0].impact[0] - .14) < 1e-10, 'Impact is not the first circle contact');
      assert.ok(.84 > result.initial.radius + result.initial.targetRadii[0], 'Fixture endpoints already touch the runner');
    }
    results.at(-1).passed = true;
  }
  telemetry.assertClean();
} catch (error) {
  telemetry.fail(error);
  process.exitCode = 1;
} finally {
  await telemetry.save({ measurements: { cases: results, passed: results.length === cases.length && results.every(result => result.passed) } });
  await browser.close();
  console.log(JSON.stringify({ passed: telemetry.report.assertions === 'passed', cases: results.map(({ name, passed }) => ({ name, passed })), failure: telemetry.report.failure, evidenceDirectory: evidenceDir }));
}
