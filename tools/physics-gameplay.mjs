import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
import { createCollisionWorld, moveActor } from '../src/physics/contacts.mjs';
import { getPursuitDirection } from '../src/physics/navigation.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';

const lock = '/tmp/bipx-arpg-gpu.lock', token = crypto.randomUUID();
try { fs.mkdirSync(lock); } catch { console.log('GPU occupied; no browser launched'); process.exit(75); }
fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'physics-gameplay', pid: process.pid, token, startedAt: new Date().toISOString() }));
const world = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND });
const results = [];
let browser, server;
try {
  server = await localServer();
  browser = await chromium.launch({ channel: 'chrome', headless: false,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  for (const character of ['warrior', 'dwarf']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: evidenceDir, size: { width: 1440, height: 900 } } });
    const page = await context.newPage(), telemetry = attachQualityTelemetry(page, `physics-${character}`), held = new Set();
    telemetry.report.scope = 'Natural offline world; actual menu and keyboard. Read-only state telemetry, no entity/health/position/time fixtures. QA steering chooses real keys to reach the visible burial rail.';
    telemetry.report.browserLaunch = { channel: 'chrome', headless: false };
    const result = { character, passed: false, phases: [], route: [] };
    async function keys(next) {
      for (const key of held) if (!next.includes(key)) { await page.keyboard.up(key); held.delete(key); }
      for (const key of next) { await page.keyboard.down(key); held.add(key); }
    }
    async function read() {
      return page.evaluate(() => ({ state: window.__zombieNightDebug.getState(), hero: window.__zombieNightDebug.getPresentationStats().assets.hero }));
    }
    async function walkTo(target) {
      let nav = null;
      for (let i = 0; i < 260; i++) {
        const sample = await read(), position = sample.state.player;
        assert.equal(sample.state.state, 'playing', 'Natural run interrupted during route');
        if (Math.hypot(position.x - target.x, position.z - target.z) < .32) { await keys([]); return sample; }
        // Debug x/z is rounded to .001m. Normalize only the planner's copy;
        // actual world positions are never written by this keyboard controller.
        const body = { ...position, id: 'hero', radius: .64 };
        const normalized = moveActor(world, body, { x: 0, z: 0 });
        body.x = normalized.x; body.z = normalized.z;
        const pursuit = getPursuitDirection(world, body, target, nav, .05, { speed: 6.5 }); nav = pursuit.state;
        const direction = pursuit.direction, choices = [];
        for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
          if (!x && !z) continue;
          const length = Math.hypot(x, z), dx = x / length * .48, dz = z / length * .48;
          const moved = moveActor(world, body, { x: dx, z: dz });
          const forward = (moved.x - body.x) * direction.x + (moved.z - body.z) * direction.z;
          choices.push({ x, z, score: forward - (moved.blocked ? .3 : 0) });
        }
        choices.sort((a, b) => b.score - a.score);
        const best = choices[0], next = [];
        if (Math.hypot(direction.x, direction.z) > .01 && best.score > .01) {
          if (best.x) next.push(best.x > 0 ? 'd' : 'a');
          if (best.z) next.push(best.z > 0 ? 's' : 'w');
        }
        result.route.push({ position, mode: pursuit.mode, next, waypoints: nav.waypoints, paused: sample.state.paused });
        await keys(next); await page.waitForTimeout(50);
      }
      throw new Error('Keyboard route did not reach the rail approach in bounded time');
    }
    try {
      await page.goto(server.origin + '/?offline=1', { waitUntil: 'domcontentloaded' });
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${character}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#player-name').fill(`Physics ${character}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      await page.locator('#game-canvas').focus();
      await page.mouse.up(); await page.keyboard.up('Space');
      result.phases.push({ phase: 'approach', sample: await walkTo({ x: -15.5, z: -6 }) });
      await keys(['w', 'i']);
      const wallSamples = [];
      for (let i = 0; i < 24; i++) { await keys(['w', 'i']); await page.waitForTimeout(75); wallSamples.push(await read()); }
      await keys(['i']);
      for (const sample of wallSamples) {
        assert.equal(sample.state.state, 'playing');
        assert.ok(sample.state.player.z >= -8.28, 'Actor crossed burial rail');
      }
      const tail = wallSamples.slice(-6).map(sample => sample.state.player);
      assert.ok(tail.every(p => Math.abs(p.z + 8.27) < .04), 'Actor did not reach actual collision face');
      assert.ok(Math.max(...tail.map(p => p.z)) - Math.min(...tail.map(p => p.z)) < .01, 'Stationary wall contact jitter');
      result.phases.push({ phase: 'wall-hold', samples: wallSamples });
      await telemetry.capture('wall-contact');
      if (character === 'warrior') {
        for (const slot of [1, 2]) {
          await page.waitForFunction(slot => window.__zombieNightDebug.getArpgState().skills[slot].enabled, slot);
          await keys(['i']);
          await page.waitForFunction(() => { const p = window.__zombieNightDebug.getState().player; return Math.abs(p.aimX) < .002 && p.aimZ < -.999; }, null, { timeout: 1500 });
          const before = await read();
          assert.ok(Math.abs(before.state.player.z + 8.27) < .04, 'Cast must start at the wall');
          const previous = await page.evaluate(() => window.__zombieNightDebug.getSkillEvents().filter(e => e.phase === 'cast').map(e => e.castId));
          await page.keyboard.press(String(slot + 1));
          await page.waitForFunction(previous => window.__zombieNightDebug.getSkillEvents().some(e => e.phase === 'cast' && !previous.includes(e.castId)), previous);
          await page.waitForTimeout(1300);
          const sample = await read();
          const events = await page.evaluate(previous => window.__zombieNightDebug.getSkillEvents().filter(e => !previous.includes(e.castId)), previous);
          const cast = events.find(e => e.phase === 'cast');
          assert.equal(cast.skillId, slot === 1 ? 'warrior_cleaving_dash' : 'warrior_shield_charge');
          assert.ok(Math.abs(cast.direction.x) < .002 && cast.direction.z < -.999, 'Cast did not point into wall');
          assert.ok(Math.hypot(sample.state.player.x - before.state.player.x, sample.state.player.z - before.state.player.z) < .06, 'Blocked cast displaced actor away from contact');
          assert.ok(events.filter(e => e.phase === 'travel').every(e => e.target.z >= -8.28), 'Travel crossed rail');
          result.phases.push({ phase: slot === 1 ? 'dash-against-wall' : 'shield-against-wall', before, sample, events });
          await telemetry.capture(slot === 1 ? 'dash-wall' : 'shield-wall');
        }
      }
      const before = await read();
      await keys(['d', 'w', 'i']); await page.waitForTimeout(300); await keys([]);
      const after = await read();
      assert.equal(after.state.state, 'playing');
      assert.ok(after.state.player.x > before.state.player.x + .5, 'Tangential input did not move along rail');
      assert.ok(Math.abs(after.state.player.z + 8.27) < .04, 'Slide must remain against the rail');
      const safe = moveActor(world, { ...after.state.player, radius: .64 }, { x: 0, z: 0 });
      assert.ok(Math.hypot(safe.x - after.state.player.x, safe.z - after.state.player.z) < .002, 'Resolved position still penetrates prop');
      result.phases.push({ phase: 'tangential-slide', before, after });
      await telemetry.capture('slide'); telemetry.assertClean(); result.passed = true;
    } catch (error) { result.failure = error.stack; result.lastSample = await read().catch(() => null); telemetry.fail(error); process.exitCode = 1; }
    finally {
      await keys([]).catch(() => {});
      await telemetry.save({ measurements: result }); result.sourceChanged = telemetry.report.sourceChangedDuringRun;
      if (result.sourceChanged) { result.passed = false; process.exitCode = 1; }
      const video = page.video(); await context.close();
      if (video) await video.saveAs(path.join(evidenceDir, `physics-${character}.webm`));
      results.push(result);
    }
  }
} finally {
  await browser?.close(); await server?.stop();
  if (fs.existsSync(path.join(lock, 'owner.json')) && JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'))).token === token) fs.rmSync(lock, { recursive: true });
  const summary = { passed: results.length === 2 && results.every(r => r.passed && !r.sourceChanged), syntheticFixture: false,
    scope: 'Natural offline keyboard wall/slide and warrior dash/charge contacts; network/full skill effects/global acceptance not covered', results };
  fs.writeFileSync(path.join(evidenceDir, 'physics-gameplay.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ evidenceDir, passed: summary.passed, results: results.map(({ character, passed, failure, sourceChanged }) => ({ character, passed, failure, sourceChanged })) }, null, 2));
}
