import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {getClassSkills} from '../src/combat/class-skills.mjs';
import {verifyNaturalSkillInput} from './arpg-natural-skill-evidence.mjs';
import { chromium, browserLaunchOptions, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';

import { localServer } from './quality-isolated-server.mjs';
import { createCollisionWorld, moveActor } from '../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';
const steeringWorld = createCollisionWorld({ colliders:getEnvironmentColliders(), bounds:ENVIRONMENT_GROUND });
const isolated = process.argv[2] ? null : await localServer();
const runUrl = process.argv[2] || `${isolated.origin}/?offline=1`;
const durationMs = Number(process.env.BIPX_NATURAL_DURATION_MS || 100_000);
assert.ok(durationMs >= 60_000 && durationMs <= 120_000, 'Natural runs must last 60–120 seconds per class');
// Declared before inspecting final samples: a 60Hz display need not measure
// exactly 60.000 FPS. Retain raw values and require both sustained rate and p95.
const frameBudget = { averageFpsAtLeast: 57, p95MsAtMost: 20, nominalTargetFps: 60 };
const characters = (process.env.BIPX_NATURAL_CHARACTERS || 'warrior,dwarf').split(',');
assert.ok(characters.length > 0 && characters.every(character => ['warrior', 'dwarf'].includes(character)), 'Unknown natural-run character');
const runnerSha256 = crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
const skillEvidenceUrl = new URL('./arpg-natural-skill-evidence.mjs', import.meta.url);
const skillEvidenceHash = () => crypto.createHash('sha256').update(fs.readFileSync(skillEvidenceUrl)).digest('hex');
const skillEvidenceSha256 = skillEvidenceHash();
const browser = await chromium.launch(browserLaunchOptions);
const results = [];
const skillObservation = page => page.evaluate(() => {
  const d=window.__zombieNightDebug;
  return {at:performance.now(),simulationTime:d.getState().survivalTime,skills:d.getSkillState(),events:d.getSkillEvents()};
});
const snapshot = page => page.evaluate(() => {
  const state = window.__zombieNightDebug.getState();
  const presentation = window.__zombieNightDebug.getPresentationStats();
    return { arpg: window.__zombieNightDebug.getArpgState(), skillEvents: window.__zombieNightDebug.getSkillEvents(), state, actors: presentation.assets.enemies.actors, hero: presentation.assets.hero, perf: window.__zombieNightDebug.getPerfStats(), resources: presentation.resources, document: { focused: document.hasFocus(), hidden: document.hidden, activeElement: document.activeElement?.id, dialogOpen: document.querySelector('#game-dialog')?.open } };
});

try {
  for (const character of characters) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: evidenceDir, size: { width: 1440, height: 900 } } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__naturalInputTrace = [];
      const record = event => {
        const trace = window.__naturalInputTrace;
        trace.push({ type: event.type, at: performance.now(), epochMs: Date.now(), code: event.code, repeat: event.repeat, target: event.target?.id || event.target?.tagName, pointer: Number.isFinite(event.clientX) ? { x: event.clientX, y: event.clientY } : undefined, trusted: event.isTrusted, activeElement: document.activeElement?.id, hidden: document.hidden, focused: document.hasFocus(), dialogOpen: document.querySelector('#game-dialog')?.open, paused: window.__zombieNightDebug?.getState().paused });
        if (trace.length > 4000) trace.shift();
      };
      for (const event of ['keydown', 'keyup', 'click', 'pointerdown', 'focus', 'blur', 'visibilitychange', 'close']) window.addEventListener(event, record, true);
    });
    const telemetry = attachQualityTelemetry(page, `natural-${character}`);
    telemetry.report.runnerSha256 = runnerSha256;
    telemetry.report.skillEvidenceSha256 = skillEvidenceSha256;
    telemetry.report.scope = 'Natural game world with automated real keyboard/pointer input. No autoplay, injected exports, spawned targets, stress flags, granted XP, health changes, time changes or scripted scores. Debug APIs are read only. Target-aware input is automation, not a human feel review.';
    const details = { character, requestedDurationMs: durationMs, samples: [], upgrades: [], skills: [], deaths: [], restarts: [], captureEvents: [], escapes: [], inputChanges: 0, coverage: {}, frameBudget };
    async function capture(label) {
      const before = await page.evaluate(() => performance.now());
      await telemetry.capture(label);
      const after = await page.evaluate(() => performance.now());
      details.captureEvents.push({ label, beforePerformanceMs: before, afterPerformanceMs: after, durationMs: after - before });
    }
    const held = new Set();
    async function keys(next) {
      const desired = new Set(next);
      for (const key of held) if (!desired.has(key)) { await page.keyboard.up(key); held.delete(key); details.inputChanges++; }
      for (const key of desired) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); details.inputChanges++; }
    }
    try {
      await page.goto(runUrl, { waitUntil: 'domcontentloaded' });
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${character}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#player-name').fill(`QA Natural ${character}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
      const initial = await snapshot(page);
      assert.equal(initial.state.character, character);
      assert.equal(initial.state.score, 0);
      assert.equal(initial.state.kills, 0);
      assert.equal(initial.state.level, 1);
      details.initial = initial;
      await capture('natural-start');
      // Read-only RAF observation, stopped explicitly when the run ends.
      await page.evaluate(() => {
        window.__naturalFrameObservation = { running: true, times: [], longTasks: [] };
        if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
          const observer = new PerformanceObserver(list => {
            window.__naturalFrameObservation.longTasks.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, duration: entry.duration, name: entry.name })));
          });
          observer.observe({ type: 'longtask' });
          window.__naturalFrameObservation.observer = observer;
        }
        function sample(time) {
          const observation = window.__naturalFrameObservation;
          if (!observation.running) return;
          observation.times.push(time);
          requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      const started = Date.now();
      let nextSample = 0, nextCapture = 30_000, previousKills = 0, lastTarget = null, pickup = null, iterations = 0;
      let breadcrumbs = [], escape = [], previousPosition = null, previousElapsed = 0, stagnantMs = 0, escapeUntil = 0;
      while (Date.now() - started < durationMs) {
        const elapsed = Date.now() - started;
        const current = await snapshot(page);
        const state = current.state;
        assert.ok(Number.isFinite(state.health) && Number.isFinite(state.player.x) && Number.isFinite(state.player.z), 'Non-finite natural game state');
        assert.equal(state.character, character, 'Character changed during a natural run');
        assert.equal(state.weapon, character === 'warrior' ? 'katana' : 'pistol');
        if (character === 'warrior') assert.equal(state.bullets, 0, 'Warrior basic weapon illegally produced a rifle projectile; authorized skill casts have separate simulation');
        if (elapsed >= nextSample) { details.samples.push({ elapsedMs: elapsed, ...current }); nextSample += 2000; }
        if (elapsed >= nextCapture) { await capture(`natural-${Math.floor(elapsed / 1000)}s`); nextCapture += 30_000; }
        if (state.state === 'dead') {
          await keys([]);
          await page.waitForTimeout(400);
          details.deaths.push({ elapsedMs: elapsed, ...(await snapshot(page)) });
          await capture(`natural-death-${details.deaths.length}`);
          await page.locator('#play-button').click();
          await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
          const restarted = await snapshot(page);
          assert.equal(restarted.state.score, 0);
          assert.equal(restarted.state.kills, 0);
          assert.equal(restarted.state.character, character);
          details.restarts.push({ elapsedMs: Date.now() - started, ...restarted });
          previousKills = 0; lastTarget = null; pickup = null;
          breadcrumbs = []; escape = []; previousPosition = null; stagnantMs = 0;
          continue;
        }
        assert.equal(state.state, 'playing', 'Natural run left playing unexpectedly');
        assert.equal(state.paused, false, 'Natural run unexpectedly paused');
        if (state.pendingUpgradeChoices.length) {
          await keys([]);
          const card = page.locator('#upgrade-options .upgrade-card').first();
          const label = await card.innerText();
          await capture(`natural-upgrade-${details.upgrades.length + 1}`);
          await card.click();
          details.upgrades.push({ elapsedMs: elapsed, offered: state.pendingUpgradeChoices, selectedVisibleLabel: label, after: (await snapshot(page)).state });
          continue;
        }
        if (state.kills > previousKills && lastTarget) pickup = { ...lastTarget.position, expires: elapsed + 3500 };
        previousKills = state.kills;
        const actors = current.actors.filter(actor => actor.position && Number.isFinite(actor.position.x));
        actors.sort((a, b) => Math.hypot(a.position.x - state.player.x, a.position.z - state.player.z) - Math.hypot(b.position.x - state.player.x, b.position.z - state.player.z));
        const target = actors[0];
        const next = ['Space'];
        let moveX = 0, moveZ = 0;
        if (target) {
          const dx = target.position.x - state.player.x, dz = target.position.z - state.player.z, distance = Math.hypot(dx, dz);
          // Eight-direction keyboard aim is actual product input; no aim setter.
          if (Math.abs(dx) > Math.abs(dz) * .414) next.push(dx > 0 ? 'l' : 'j');
          if (Math.abs(dz) > Math.abs(dx) * .414) next.push(dz > 0 ? 'k' : 'i');
          lastTarget = target;
          const preferredDistance = character === 'warrior' ? 1.7 : 7;
          if (distance > preferredDistance) { moveX = dx; moveZ = dz; }
          else if (character === 'dwarf' && distance < 4.5) { moveX = -dx; moveZ = -dz; }
          else if (character === 'warrior' && distance < 1.2) { moveX = -dz; moveZ = dx; }
        } else {
          const angle = elapsed / 7000;
          moveX = Math.cos(angle); moveZ = Math.sin(angle);
          next.push(['l', 'k', 'j', 'i'][Math.floor(elapsed / 5000) % 4]);
        }
        if (pickup && elapsed < pickup.expires) {
          moveX = pickup.x - state.player.x; moveZ = pickup.z - state.player.z;
          if (Math.hypot(moveX, moveZ) < .8) pickup = null;
        }
        // Steering only: retrace observed movement after sustained blocked input.
        // The predicted body stays in this Node controller; only real keys move the game.
        const position = state.player, separation = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
        const moving = [...held].some(key=>['w','a','s','d'].includes(key));
        stagnantMs = previousPosition && moving && separation(previousPosition,position)<.06 ? stagnantMs+elapsed-previousElapsed : 0;
        previousPosition = {...position}; previousElapsed = elapsed;
        if (!escape.length && (!breadcrumbs.length || separation(position,breadcrumbs.at(-1))>.65)) {
          breadcrumbs.push({x:position.x,z:position.z}); if(breadcrumbs.length>80)breadcrumbs.shift();
        }
        if (!escape.length && stagnantMs>=1800 && breadcrumbs.length>1) {
          escape=breadcrumbs.slice(0,-1).reverse().slice(0,12);breadcrumbs=[];escapeUntil=elapsed+5000;stagnantMs=0;
          details.escapes.push({elapsedMs:elapsed,from:{...position},waypoints:escape.map(p=>({...p})),method:'Real WASD retraces previously observed positions; no world writes or teleport.'});
        }
        if (escape.length) {
          while(escape.length && separation(position,escape[0])<.55)escape.shift();
          if(elapsed>escapeUntil)escape=[];
          if(escape.length) {
            const normalized=moveActor(steeringWorld,{...position,radius:.64},{x:0,z:0});
            const body={x:normalized.x,z:normalized.z,radius:.64},goal=escape[0],length=separation(body,goal)||1;
            const dx=(goal.x-body.x)/length,dz=(goal.z-body.z)/length,candidates=[];
            for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)if(x||z){const n=Math.hypot(x,z),m=moveActor(steeringWorld,body,{x:x/n*.6,z:z/n*.6});candidates.push({x,z,score:(m.x-body.x)*dx+(m.z-body.z)*dz-(m.blocked?.08:0)});}
            candidates.sort((a,b)=>b.score-a.score);moveX=candidates[0].x;moveZ=candidates[0].z;
          }
        }
        if (Math.abs(moveX) > Math.abs(moveZ) * .414) next.push(moveX > 0 ? 'd' : 'a');
        if (Math.abs(moveZ) > Math.abs(moveX) * .414) next.push(moveZ > 0 ? 's' : 'w');
        await keys(next);
        const skill = current.arpg.skills.find(skill => skill.enabled);
        if (target && skill) {
          const beforeSkill=await skillObservation(page);
          await page.keyboard.press(skill.key);
          const afterSkill=await skillObservation(page);
          const attempt={ elapsedMs:elapsed,skillId:skill.id,actualKeyboardInput:skill.key,before:beforeSkill,after:afterSkill };
          details.skills.push(attempt);
          Object.assign(attempt,verifyNaturalSkillInput(skill.id,beforeSkill,afterSkill));
        }
        await page.waitForTimeout(180);
        if (++iterations % 150 === 0) console.log(JSON.stringify({ character, elapsedSeconds: Math.round(elapsed / 1000), kills: state.kills, health: state.health, level: state.level, upgrades: details.upgrades.length, deaths: details.deaths.length }));
      }
      await keys([]);
      details.final = await snapshot(page);
      details.actualDurationMs = Date.now() - started;
      details.frameSample = await page.evaluate(() => {
        const o = window.__naturalFrameObservation; o.running = false;
        o.observer?.disconnect();
        const times = o.times, delta = times.slice(1).map((v, i) => v - times[i]).sort((a, b) => a - b);
        const slowFrames = times.slice(1).map((time, index) => ({ elapsedMs: time - times[0], frameMs: time - times[index] })).filter(frame => frame.frameMs > 50);
        return { frames: times.length, firstFramePerformanceMs: times[0], durationMs: times.at(-1) - times[0], averageFps: (times.length - 1) * 1000 / (times.at(-1) - times[0]), p95Ms: delta[Math.ceil(delta.length * .95) - 1], p99Ms: delta[Math.ceil(delta.length * .99) - 1], worstMs: delta.at(-1), framesOver50Ms: slowFrames.length, slowFrames, mainThreadLongTasks: o.longTasks, scope: 'Whole natural automation run including screenshots, upgrades, deaths and restarts; not a pure isolated renderer benchmark.' };
      });
      const lives = [...details.samples.map(sample => sample.state), ...details.deaths.map(event => event.state), details.final.state];
      const maxKills = Math.max(...lives.map(state => state.kills));
      details.coverage = { actualKillsObserved: maxKills > 0, maxKillsInOneLife: maxKills, maxWave: Math.max(...lives.map(state => state.wave)), maxLevel: Math.max(...lives.map(state => state.level)), actualXpObserved: lives.some(state => state.xp > 0 || state.level > 1), upgrades: details.upgrades.length ? 'observed' : 'not observed', death: details.deaths.length ? 'observed naturally' : 'not observed', restart: details.restarts.length ? 'observed after natural death' : 'not observed', humanFeelReview: 'pending', physicalMobile: false };
      details.coverage.requestedSkillIds = [...new Set(details.skills.map(skill => skill.skillId))];
      details.coverage.skillIds = [...new Set(details.skills.filter(skill=>skill.confirmed).map(skill => skill.skillId))];
      details.coverage.confirmedCastCount=details.skills.filter(skill=>skill.confirmed).length;
      assert.deepEqual([...details.coverage.skillIds].sort(),getClassSkills(character).map(skill=>skill.id).sort(),'Natural run did not confirm all three canonical skills with cost/cooldown receipts');
      assert.ok(maxKills > 0, 'Automation did not establish natural combat damage/kill coverage');
      assert.ok(details.frameSample.averageFps >= frameBudget.averageFpsAtLeast, `Natural-run average FPS below ${frameBudget.averageFpsAtLeast}: ${details.frameSample.averageFps}`);
      assert.ok(details.frameSample.p95Ms <= frameBudget.p95MsAtMost, `Natural-run p95 above ${frameBudget.p95MsAtMost}ms: ${details.frameSample.p95Ms}`);
      assert.equal(skillEvidenceHash(), skillEvidenceSha256, 'Skill evidence validator changed during the run');
      telemetry.assertClean();
      results.push({ character, passed: true, coverage: details.coverage, frameSample: details.frameSample });
    } catch (error) {
      telemetry.fail(error); results.push({ character, passed: false, error: error.stack }); process.exitCode = 1;
    } finally {
      await keys([]).catch(() => {});
      details.lastSnapshot = await snapshot(page).catch(() => null);
      details.inputTrace = await page.evaluate(() => window.__naturalInputTrace).catch(() => []);
      const video = page.video();
      await telemetry.save({ measurements: details });
      await context.close();
      if (video) await video.saveAs(path.join(evidenceDir, `natural-${character}.webm`));
    }
  }
} finally {
  await browser.close();
  await isolated?.stop();
  fs.writeFileSync(path.join(evidenceDir, 'natural-runs.json'), JSON.stringify({ passed: results.every(result => result.passed), requestedCharacters: characters, durationMsPerClass: durationMs, syntheticFixture: false, runnerSha256, skillEvidenceSha256, results }, null, 2));
  console.log(JSON.stringify({ results, evidenceDirectory: evidenceDir }));
}
