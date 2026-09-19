import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';

const expected = {
  warrior: ['warrior_war_cry', 'warrior_cleaving_dash', 'warrior_shield_charge'],
  dwarf: ['dwarf_explosive_cannon', 'dwarf_frost_shot', 'dwarf_gravity_shot'],
};
const lock = '/tmp/bipx-arpg-gpu.lock', token = crypto.randomUUID();
try { fs.mkdirSync(lock); } catch(error) { if (error.code === 'EEXIST') { console.log('GPU occupied; no browser launched.'); process.exit(75); } throw error; }
fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'gui-v2-gameplay', pid: process.pid, token, startedAt: new Date().toISOString() }));
const uiFiles = ['index.html', 'styles.css', 'src/ui/arpg-hud.js', 'src/ui/presentation.js', 'assets/ui/arpg/icons.svg'];
const hashUi = () => Object.fromEntries(uiFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const uiSourceHashes = hashUi();
let browser, server;
const results = [];
try {
  // Explicit live-server audit never starts, restarts or stops the user's process.
  server = process.env.BIPX_UI_USE_EXISTING_SERVER === '1'
    ? { origin: 'http://127.0.0.1:5173', stop: async () => {} }
    : await localServer();
  browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  for (const classId of (process.env.BIPX_UI_CLASS ? [process.env.BIPX_UI_CLASS] : ['warrior', 'dwarf'])) {
    assert.ok(expected[classId], 'BIPX_UI_CLASS must be warrior or dwarf');
    const mobile = classId === 'dwarf';
    const context = await browser.newContext({ viewport: mobile ? { width: 393, height: 852 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      localStorage.setItem('bipx-controls-seen', 'true');
      localStorage.setItem('bipxAudioMuted', '0');
      window.guiSnapshots = []; window.guiRequests = []; window.guiClicks = []; window.guiPointers = [];
      window.addEventListener('bipx:arpg-state', event => { window.guiSnapshots.push(event.detail); if (window.guiSnapshots.length > 500) window.guiSnapshots.shift(); });
      window.addEventListener('bipx:skill-request', event => window.guiRequests.push(event.detail));
      window.addEventListener('click', event => window.guiClicks.push({slot:event.target.closest?.('[data-arpg-slot]')?.dataset.arpgSlot ?? null,x:event.clientX,y:event.clientY,scale:visualViewport?.scale,time:performance.now()}),true);
      for (const type of ['pointerdown','pointerup','pointercancel']) window.addEventListener(type,event=>window.guiPointers.push({type,slot:event.target.closest?.('[data-arpg-slot]')?.dataset.arpgSlot ?? null,target:event.target.id,pointer:event.pointerType,id:event.pointerId,primary:event.isPrimary,x:event.clientX,y:event.clientY}),true);
    });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, `gui-v2-${classId}`);
    telemetry.report.browserLaunch = { channel: 'chrome', headless: false };
    const result = { classId, mobile, skillDirection: 'v2', passed: false, checks: [], casts: [], evidenceKind: 'actual_menu_keyboard_pointer_touch_input_no_gameplay_mutation' };
    const check = (name, condition) => { assert.ok(condition, name); result.checks.push(name); };
    try {
      await page.goto(server.origin + '/?offline=1', { waitUntil: 'domcontentloaded' });
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#open-login-button').click();
      await page.locator(`label[for="character-${classId}"]`).click();
      await waitForRuntimeAssets(page, telemetry);
      await page.locator('#player-name').fill(`GUI V2 ${classId}`);
      await page.locator('#play-button').click();
      await page.waitForFunction(() => window.__zombieNightDebug?.getState().state === 'playing');
      await page.waitForFunction(() => document.querySelector('#arpg-hud').dataset.connected === 'true');
      const actual = await page.evaluate(() => window.__zombieNightDebug.getArpgState());
      assert.deepEqual(actual.skills.map(skill => skill.id), expected[classId], 'Core must be migrated to v2 before this integrated test');
      check('Correct class, weapon and v2 three slots connected', actual.classId === classId && actual.weapon === (mobile ? 'Rifle' : 'Espada'));
      await page.waitForFunction(() => [...document.querySelectorAll('.arpg-actions use')].length === 4 && [...document.querySelectorAll('.arpg-actions use')].every(e => e.getBBox().width > 10));
      result.icons = await page.locator('.arpg-actions use').evaluateAll(elements => elements.map(e => ({href:e.getAttribute('href'),width:e.getBBox().width,height:e.getBBox().height})));
      check('Weapon and all three skill icons rendered in real gameplay', true);
      const spriteRequests = [];
      page.on('request', request => { if (request.url().includes('/assets/ui/arpg/icons.svg')) spriteRequests.push(request.url()); });
      let touch;
      if (mobile) touch = await context.newCDPSession(page);
      const holdMove = async (enabled) => {
        if (!mobile) { if (enabled) await page.keyboard.down('w'); else await page.keyboard.up('w'); return; }
        const r = await page.locator('#touch-stick').boundingBox();
        if (enabled) {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: r.x+r.width/2, y: r.y+r.height/2 }] });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: r.x+r.width/2, y: r.y+14 }] });
        } else await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      for (let slot = 0; slot < 3; slot++) {
        await page.waitForFunction(slot => window.__zombieNightDebug.getArpgState().skills[slot].enabled, slot, { timeout: 20000 });
        await page.waitForFunction(slot => document.querySelector(`[data-arpg-slot="${slot}"]`).dataset.state === 'ready', slot);
        const before = await page.evaluate(() => ({ hud: window.__zombieNightDebug.getArpgState(), game: window.__zombieNightDebug.getState(), requests:window.guiRequests.length, scale:visualViewport?.scale }));
        if (slot === 1) await holdMove(true);
        if (mobile && slot === 1) {
          const r = await page.locator('#touch-stick').boundingBox();
          const b = await page.locator(`[data-arpg-slot="${slot}"]`).boundingBox();
          const movement = { id:1, x:r.x+r.width/2, y:r.y+14 };
          const skillTouch = { id:2, x:b.x+b.width/2, y:b.y+b.height/2 };
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [movement, skillTouch] });
          // This Chrome emits pointerup for the explicitly supplied ending point.
          // Keep the movement point down until holdMove(false) after the cast.
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [skillTouch] });
        } else if (mobile) await page.locator(`[data-arpg-slot="${slot}"]`).tap();
        else if (slot === 0) await page.locator('[data-arpg-slot="0"]').click();
        else await page.keyboard.press(slot === 1 ? 'Digit2' : 'Numpad3');
        await page.waitForFunction(count=>window.guiRequests.length>count,before.requests,{timeout:2500});
        const requested = await page.evaluate(count => window.guiRequests.slice(count),before.requests);
        assert.deepEqual(requested,[{slot}],`Input must request exactly the intended slot ${slot}`);
        await page.waitForFunction(slot => window.__zombieNightDebug.getArpgState().skills[slot].cooldownRemaining > 0, slot);
        const immediate = await page.evaluate(() => ({ hud: window.__zombieNightDebug.getArpgState(), events: window.__zombieNightDebug.getSkillEvents() }));
        check(`${slot}: real input produces matching cast and cooldown`, immediate.events.some(event => event.phase === 'cast' && event.skillId === expected[classId][slot]));
        check(`${slot}: authoritative resource consumption`, immediate.hud.resource < before.hud.resource);
        check(`${slot}: GUI shows actual cooldown mask`, await page.locator(`[data-arpg-slot="${slot}"]`).getAttribute('data-state') === 'cooldown');
        check(`${slot}: cast does not open automatic help`, !await page.locator('#arpg-tooltip').isVisible());
        if (slot === 0 && classId === 'warrior') {
          await page.waitForFunction(() => document.querySelector('#arpg-statuses').textContent.includes('Grito'), null, { timeout: 4000 });
          check('War cry buff has a real authoritative duration badge', await page.locator('.arpg-status').count() > 0);
        }
        await page.waitForTimeout(450);
        check(`${slot}: help remains hidden during skill playback`, !await page.locator('#arpg-tooltip').isVisible());
        const after = await page.evaluate(() => ({ hud: window.__zombieNightDebug.getArpgState(), game: window.__zombieNightDebug.getState(), events: window.__zombieNightDebug.getSkillEvents(), audio: window.__zombieNightDebug.getAudioState() }));
        if (slot === 1) {
          await holdMove(false);
          check('Movement continues while casting with held control', Math.hypot(after.game.player.x-before.game.player.x, after.game.player.z-before.game.player.z) > .05);
        }
        result.casts.push({ slot, before, immediate, after });
        await telemetry.capture(`cast-${slot + 1}`);
      }
      check('Exactly three accepted v2 cast IDs observed', new Set(result.casts.flatMap(item => item.immediate.events).filter(event => event.phase === 'cast').map(event => event.castId)).size === 3);
      // Repeated cast input is routed to the core so it can reject without effects.
      const beforeReject = await page.evaluate(() => ({ requests:window.guiRequests.length, events:window.__zombieNightDebug.getSkillEvents().filter(e=>e.phase==='cast').map(e=>e.castId), hud:window.__zombieNightDebug.getArpgState() }));
      const button = await page.locator('[data-arpg-slot="2"]').boundingBox();
      if (mobile) await page.touchscreen.tap(button.x+button.width/2, button.y+button.height/2);
      else await page.keyboard.press('Numpad3');
      await page.waitForTimeout(120);
      const afterReject = await page.evaluate(() => ({ requests:window.guiRequests.length, events:window.__zombieNightDebug.getSkillEvents().filter(e=>e.phase==='cast').map(e=>e.castId), hud:window.__zombieNightDebug.getArpgState(), audio:window.__zombieNightDebug.getAudioState() }));
      check('Cooldown input reaches core once and adds no accepted cast', afterReject.requests === beforeReject.requests+1 && !afterReject.events.some(id=>!beforeReject.events.includes(id)));
      result.rejection = {before:beforeReject,after:afterReject};
      await page.locator('#pause-button').click();
      check('Options open and pause solo gameplay', await page.locator('#game-dialog').isVisible() && await page.evaluate(() => window.__zombieNightDebug.getState().paused));
      await page.keyboard.press('Digit1');
      check('Options typing does not emit skill request', await page.evaluate(() => window.guiRequests.length) === afterReject.requests);
      await page.locator('#dialog-done').click();
      await page.locator('.leaderboard-panel summary').click();
      check('Collapsed ranking remains accessible and opens', await page.locator('.leaderboard-panel').getAttribute('open') !== null && await page.locator('#leaderboard-list').isVisible());
      await page.locator('.leaderboard-panel summary').click();
      if (mobile) {
        await page.setViewportSize({width:852,height:393});
        await page.waitForTimeout(250);
        const layout = await page.locator('#arpg-hud').boundingBox();
        check('Real gameplay resizes to landscape without clipping', layout.x >= 0 && layout.x+layout.width <= 852 && layout.y+layout.height <= 393);
        await telemetry.capture('landscape');
      }
      result.spriteRequestsAfterInitialRender = spriteRequests.length;
      result.final = await page.evaluate(() => ({ hud:window.__zombieNightDebug.getArpgState(), snapshots:window.guiSnapshots, game:window.__zombieNightDebug.getState() }));
      telemetry.assertClean(); result.passed = true;
    } catch(error) { result.failure = error.stack; telemetry.fail(error); process.exitCode = 1; }
    finally {
      result.inputTrace = await page.evaluate(() => ({requests:window.guiRequests,clicks:window.guiClicks,pointers:window.guiPointers,scale:visualViewport?.scale,viewport:{width:innerWidth,height:innerHeight},hud:window.__zombieNightDebug?.getArpgState()})).catch(()=>null);
      await telemetry.save({ measurements:result, uiSourceHashes, uiSourceChangedDuringRun:JSON.stringify(uiSourceHashes)!==JSON.stringify(hashUi()) });
      result.sourceChangedDuringRun = telemetry.report.sourceChangedDuringRun;
      await context.close(); results.push(result);
    }
  }
} finally {
  await browser?.close(); await server?.stop();
  if (JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token === token) fs.rmSync(lock,{recursive:true});
  fs.writeFileSync(path.join(evidenceDir,'gui-v2-gameplay.json'), JSON.stringify({results},null,2));
  console.log(JSON.stringify({evidenceDir,results:results.map(({classId,passed,failure,sourceChangedDuringRun})=>({classId,passed,failure,sourceChangedDuringRun}))}));
}
