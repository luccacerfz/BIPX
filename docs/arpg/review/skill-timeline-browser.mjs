// Independent native observer. It never grants skills, resources or targets.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
process.chdir(root);
const expected = {
  warrior: ['warrior_war_cry', 'warrior_cleaving_dash', 'warrior_shield_charge'],
  dwarf: ['dwarf_explosive_cannon', 'dwarf_frost_shot', 'dwarf_gravity_shot'],
};
const core = await import('../../../src/combat/class-skills.mjs');
const actual = core.CLASS_SKILLS.map(s => s.id);
const requested = process.argv.find(arg => arg.startsWith('--skills='))?.slice('--skills='.length).split(',');
if (requested) assert(requested.length > 0 && requested.every(id => actual.includes(id)), 'Unknown selected skill');
const headless = !process.argv.includes('--visible');
const missing = Object.values(expected).flat().filter(id => !actual.includes(id));
const ready = missing.length === 0 && actual.length === 6;
if (!process.argv.includes('--capture') || !ready) {
  console.log(JSON.stringify({ ready, missing, actual, accepted: false,
    scope: 'ID availability only, not behavior or visual acceptance',
    next: ready ? 'Run with --capture during a free GPU window' : 'Wait for the six v2 definitions to be implemented by Combat' }));
  process.exit(ready ? 0 : 75);
}
const { chromium, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir, sourceFingerprint } = await import('../../../tools/quality-browser.mjs');
const { localServer } = await import('../../../tools/quality-isolated-server.mjs');
const harnessHash = crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');
const lock = '/tmp/bipx-arpg-gpu.lock', token = crypto.randomUUID();
try { fs.mkdirSync(lock); } catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log(JSON.stringify({ gpuOccupied: true, accepted: false, launchedBrowser: false }));
  process.exit(75);
}
let server, browser, snapshot;
const results = [], cleanupErrors = [];
let capturedSources;
const manifestEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
try {
  fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'root-skill-timeline', pid: process.pid, token, startedAt: new Date().toISOString() }));
  capturedSources = sourceFingerprint();
  // Copy exact fingerprinted runtime files; no hardlinks to the active checkout.
  snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-root-skill-timeline-'));
  for (const name of Object.keys(capturedSources)) {
    const destination = path.join(snapshot, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, name), destination);
  }
  assert(manifestEqual(capturedSources, sourceFingerprint()), 'Checkout changed during snapshot copy; no browser launched');
  process.chdir(snapshot);
  assert(manifestEqual(capturedSources, sourceFingerprint()), 'Snapshot does not match captured hashes');
  const frozenCore = await import(pathToFileURL(path.join(snapshot, 'src/combat/class-skills.mjs')));
  assert.deepEqual(frozenCore.CLASS_SKILLS.map(s => s.id).sort(), Object.values(expected).flat().sort());
  server = await localServer();
  const launch = { channel: 'chrome', headless,
    args: ['--use-gl=angle', '--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] };
  browser = await chromium.launch(launch);
  for (const [classId, ids] of Object.entries(expected)) for (const [slot, skillId] of ids.entries()) {
    if (requested && !requested.includes(skillId)) continue;
    const definition = frozenCore.getClassSkill(skillId);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
      recordVideo: { dir: evidenceDir, size: { width: 1440, height: 900 } } });
    await context.addInitScript(() => {
      window.__bipxIndependentInputs = [];
      for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click']) window.addEventListener(type, event => {
        const list = window.__bipxIndependentInputs;
        list.push({ timeMs: performance.now(), type, code: event.code, key: event.key,
          pointerType: event.pointerType, x: event.clientX, y: event.clientY, trusted: event.isTrusted,
          target: event.target?.id || event.target?.tagName });
        if (list.length > 4000) list.shift();
      }, true);
    });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, `timeline-${skillId}`);
    telemetry.report.browserLaunch = launch;
    const item = { classId, slot, skillId, definition, phasesCaptured: [], completed: false,
      scope: 'Real solo gameplay with fresh run and natural enemies. Observer reads debug getters only. Screenshots perturb timing; not a performance benchmark or network/device proof.' };
    let stopMovement;
    const heldKeys = [];
    try {
      await page.goto(`${server.origin}/?offline=1&quality=high`, { waitUntil: 'domcontentloaded' });
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${classId}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#player-name').fill(`Timeline ${classId}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug?.getState().state === 'playing');
      item.graphics = await page.evaluate(() => {
        const gl = document.querySelector('#game-canvas').getContext('webgl2');
        const ext = gl?.getExtension('WEBGL_debug_renderer_info');
        return { version: gl?.getParameter(gl.VERSION), renderer: gl?.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
      });
      await page.locator('#game-canvas').focus();
      await page.mouse.move(1070, 400);
      // Wait for an ordinary enemy to approach instead of manufacturing targets.
      await page.waitForTimeout(5200);
      await page.waitForFunction(() => {
        const debug = window.__zombieNightDebug, state = debug.getState();
        return state.state !== 'playing' || debug.getSkillTargets().some(target => target.health > 0 &&
          Math.hypot(target.x - state.player.x, target.z - state.player.z) < 4.5);
      }, null, { timeout: 12000 }).catch(() => {});
      item.before = await page.evaluate(() => ({ state: window.__zombieNightDebug.getState(), hud: window.__zombieNightDebug.getArpgState(),
        targets: window.__zombieNightDebug.getSkillTargets(), skills: window.__zombieNightDebug.getSkillState(),
        events: window.__zombieNightDebug.getSkillEvents(), inputs: window.__bipxIndependentInputs }));
      assert.equal(item.before.state.state, 'playing', 'Natural run ended before a valid observation');
      assert.equal(item.before.skills.sequence, 0, 'Unexpected skill input before the planned cast; inspect the recorded DOM inputs');
      assert.equal(item.before.hud.skills[slot].id, skillId);
      assert.equal(item.before.hud.skills[slot].enabled, true, 'Natural run did not have a valid cast opportunity');
      const player = item.before.state.player;
      const target = item.before.targets.filter(t => t.health > 0).sort((a, b) =>
        Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
      assert(target, 'No natural target was available');
      const angle = Math.atan2(target.z - player.z, target.x - player.x);
      const aimAngle = Math.round(angle / (Math.PI / 4)) * Math.PI / 4;
      const dx = Math.round(Math.cos(aimAngle)), dz = Math.round(Math.sin(aimAngle));
      const aimKeys = [dx > 0 ? 'l' : dx < 0 ? 'j' : null, dz > 0 ? 'k' : dz < 0 ? 'i' : null].filter(Boolean);
      const moveKeys = [dx > 0 ? 'd' : dx < 0 ? 'a' : null, dz > 0 ? 's' : dz < 0 ? 'w' : null].filter(Boolean);
      for (const key of aimKeys) { await page.keyboard.down(key); heldKeys.push(key); }
      await page.waitForTimeout(80);
      item.targetSelection = { target, distance: Math.hypot(target.x - player.x, target.z - player.z),
        aimKeys, moveKeys, note: 'Nearest ordinary enemy; aim quantized to existing IJKL controls. A miss remains a miss.' };
      // Only this observer object is installed. It never calls debug setters.
      await page.evaluate(({ skillId }) => {
        const observer = window.__bipxIndependentTimeline = { started: performance.now(), samples: [], events: [], seen: new Set(), running: true };
        const tick = () => {
          if (!observer.running) return;
          const debug = window.__zombieNightDebug, now = performance.now() - observer.started;
          const state = debug.getState(), hud = debug.getArpgState(), presentation = debug.getPresentationStats();
          if (!observer.samples.length || now - observer.samples.at(-1).timeMs >= 40) {
            observer.samples.push({ timeMs: now, state, hud, hero: presentation.assets.hero,
              enemies: presentation.assets.enemies, targets: debug.getSkillTargets(), skillState: debug.getSkillState(),
              audio: debug.getAudioState(), vfx: debug.getClassSkillVfxStats() });
          }
          for (const event of debug.getSkillEvents()) if (event.skillId === skillId) {
            const key = JSON.stringify(event);
            if (!observer.seen.has(key)) { observer.seen.add(key); observer.events.push({ observedMs: now, event }); }
          }
          if (now < 16000) requestAnimationFrame(tick); else observer.running = false;
        };
        requestAnimationFrame(tick);
      }, { skillId });
      // Moving during windup deliberately covers the former frozen-origin bug.
      for (const key of moveKeys) { await page.keyboard.down(key); heldKeys.push(key); }
      await page.keyboard.press(String(slot + 1));
      stopMovement = setTimeout(() => { for (const key of moveKeys) page.keyboard.up(key).catch(() => {}); }, Math.max(400, Math.round((definition.windup + .2) * 1000)));
      await page.waitForFunction(() => window.__bipxIndependentTimeline.events.length > 0, null, { timeout: 2500 });
      item.phasesCaptured.push({ phase: 'first-observed-event', file: await telemetry.capture('first-event') });
      const durationMs = Math.min(14000, Math.max(5500,
        (definition.buffDuration || definition.fieldDuration || definition.effectDuration || 0) * 1000 + 1800));
      const started = Date.now(), observedPhases = new Set();
      let lastCapture = 0;
      while (Date.now() - started < durationMs) {
        const observation = await page.evaluate(() => ({
          events: window.__bipxIndependentTimeline.events,
          state: window.__zombieNightDebug.getState(),
        }));
        for (const event of observation.events) {
          const phase = event.event.phase;
          if (observedPhases.has(phase)) continue;
          observedPhases.add(phase);
          const beforeCapture = await page.evaluate(() => performance.now() - window.__bipxIndependentTimeline.started);
          const file = await telemetry.capture(`phase-${String(phase).replace(/[^a-z0-9_-]/gi, '')}`);
          const afterCapture = await page.evaluate(() => performance.now() - window.__bipxIndependentTimeline.started);
          item.phasesCaptured.push({ phase, eventObservedMs: event.observedMs, beforeCaptureMs: beforeCapture, afterCaptureMs: afterCapture, file,
            note: 'Capture follows observed event; video is authoritative for short effects that end before screenshot completes.' });
        }
        if (Date.now() - lastCapture > 1100 && item.phasesCaptured.length < 16) {
          item.phasesCaptured.push({ phase: 'ongoing-observation', file: await telemetry.capture(`ongoing-${item.phasesCaptured.length}`) });
          lastCapture = Date.now();
        }
        if (observation.state.state !== 'playing') { item.endedState = observation.state.state; break; }
        const upgrade = page.locator('#upgrade-panel:not(.hidden) button').first();
        if (await upgrade.isVisible().catch(() => false)) await upgrade.click();
        await page.waitForTimeout(35);
      }
      clearTimeout(stopMovement); for (const key of heldKeys) await page.keyboard.up(key);
      item.observation = await page.evaluate(() => {
        const observer = window.__bipxIndependentTimeline; observer.running = false;
        return { samples: observer.samples, events: observer.events };
      });
      assert(item.observation.events.length > 0, 'No real skill event was observed');
      item.observedPhases = [...observedPhases];
      item.impactObserved = item.observation.events.some(e => e.event.phase === 'impact');
      item.targetStatusObserved = item.observation.samples.some(s => s.targets.some(t => t.freeze > 0 || t.stun > 0 || t.pull > 0));
      item.buffObserved = item.observation.samples.some(s => s.skillState.buff?.remaining > 0);
      item.unproven = ['Perceptual AAA quality', 'Multiplayer authority', 'Physical device',
        ...(!item.impactObserved ? ['No natural impact was observed; this run cannot approve target effects'] : [])];
      telemetry.assertClean(); item.completed = true;
    } catch (error) { item.failure = error.stack; telemetry.fail(error); process.exitCode = 1; }
    finally {
      clearTimeout(stopMovement);
      for (const key of heldKeys) await page.keyboard.up(key).catch(() => {});
      item.inputs = await page.evaluate(() => window.__bipxIndependentInputs).catch(() => []);
      await telemetry.save({ measurements: item });
      item.sourceChangedDuringRun = telemetry.report.sourceChangedDuringRun;
      const video = page.video(); await context.close();
      if (video) { item.video = `${skillId}.webm`; await video.saveAs(path.join(evidenceDir, item.video)); }
      results.push(item);
    }
  }
} catch (error) { results.push({ failure: error.stack }); process.exitCode = 1; }
finally {
  try {
    for (const result of await Promise.allSettled([browser?.close(), server?.stop()])) {
      if (result.status === 'rejected') { cleanupErrors.push(String(result.reason)); process.exitCode = 1; }
    }
    process.chdir(root);
    const currentSources = sourceFingerprint();
    fs.writeFileSync(path.join(evidenceDir, 'timeline-index.json'), JSON.stringify({ accepted: false,
      scope: 'Independent native visual observation; source-bound snapshot, not global acceptance',
      capturedSources, currentCheckoutStillMatches: Boolean(capturedSources) && manifestEqual(capturedSources, currentSources),
      snapshot, harnessHash, results, cleanupErrors }, null, 2) + '\n');
  } finally {
    // Preserve the runtime snapshot; only release the GPU lease owned by this process.
    try { if (JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'))).token === token) fs.rmSync(lock, { recursive: true }); } catch {}
  }
  console.log(JSON.stringify({ evidenceDir, snapshot, accepted: false, results: results.map(({ skillId, completed, failure, observedPhases }) => ({ skillId, completed, failure, observedPhases })) }));
}
