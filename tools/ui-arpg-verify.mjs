import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, browserLaunchOptions, attachQualityTelemetry, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';

const lock = '/tmp/bipx-arpg-gpu.lock';
try { fs.mkdirSync(lock); } catch (error) { if (error.code === 'EEXIST') { console.log('GPU occupied; UI verification deferred.'); process.exit(75); } throw error; }
fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'gui-fixture', pid: process.pid, startedAt: new Date().toISOString() }));
const uiFiles = ['index.html', 'styles.css', 'src/ui/arpg-hud.js', 'src/ui/presentation.js', 'assets/ui/arpg/icons.svg'];
const hashUi = () => Object.fromEntries(uiFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const sourceHashes = hashUi();
const names = {
  warrior: [['warrior_war_cry', 'Grito de Guerra'], ['warrior_cleaving_dash', 'Corte Devastador'], ['warrior_shield_charge', 'Investida de Escudo']],
  dwarf: [['dwarf_explosive_cannon', 'Canhão Infernal'], ['dwarf_frost_shot', 'Disparo Glacial'], ['dwarf_gravity_shot', 'Núcleo Gravitacional']],
};
function state(classId = 'warrior') {
  return { classId, health: 146, maxHealth: 200, resource: 72, maxResource: 100, resourceLabel: classId === 'warrior' ? 'Fervor' : 'Foco', weapon: classId === 'warrior' ? 'Espada' : 'Rifle', dead: false, paused: false, statuses: [],
    skills: names[classId].map(([id, name], slot) => ({ id, name, slot, key: String(slot + 1), cost: [22, 32, 38][slot], cooldownRemaining: 0, cooldownDuration: [4, 9, 12][slot], enabled: true })) };
}
let browser, server;
const checks = [];
function check(name, condition) { assert.ok(condition, name); checks.push(name); }
try {
  server = await localServer();
  browser = await chromium.launch(browserLaunchOptions);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const telemetry = attachQualityTelemetry(page, 'gui-fixture'); telemetry.markFixture();
  // UI fixture: no Three renderer, simulation, network client or gameplay claims.
  await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
  await page.route('**/src/ui/presentation.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
  await page.addInitScript(() => {
    window.uiRequests = []; window.uiReadyCount = 0;
    window.addEventListener('bipx:skill-request', event => window.uiRequests.push(event.detail));
    window.addEventListener('bipx:arpg-ready', () => { window.uiReadyCount++; });
  });
  const publish = snapshot => page.evaluate(detail => window.dispatchEvent(new CustomEvent('bipx:arpg-state', { detail })), snapshot);
  const requestCount = () => page.evaluate(() => window.uiRequests.length);
  const slot = i => page.locator(`[data-arpg-slot="${i}"]`);
  try {
    await page.goto(server.origin + '/?offline=1&gui-fixture=1');
    await page.waitForFunction(() => window.uiReadyCount === 1);
    check('HUD mounted once and requested initial snapshot', await page.locator('#arpg-hud').count() === 1);
    check('HUD hidden in menu', !await page.locator('#arpg-hud').isVisible());
    await page.evaluate(() => document.querySelector('#message').classList.add('is-hidden'));
    check('Unknown state never ready', await slot(0).getAttribute('aria-disabled') === 'true');
    await page.keyboard.press('Digit1');
    check('Unknown state emits no cast', await requestCount() === 0);
    await publish(state());
    await page.waitForFunction(() => [...document.querySelectorAll('.arpg-actions use')].length === 4 && [...document.querySelectorAll('.arpg-actions use')].every(e => e.getBBox().width > 10));
    check('Weapon and all three skill glyphs actually render from served SVG', true);
    let svgRequests = 0;
    page.on('request', request => { if (request.url().includes('/assets/ui/arpg/icons.svg')) svgRequests++; });
    for (let i = 0; i < 20; i++) await publish(state());
    await page.waitForTimeout(200);
    check('Twenty identical snapshots do not refetch the SVG sprite', svgRequests === 0);
    await page.locator('#pause-button').focus();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      check(`Tab reaches skill slot ${i + 1} in order`, await slot(i).evaluate(e => e === document.activeElement));
    }
    await page.locator('#game-canvas').focus();
    check('Valid snapshot connects HUD', await page.locator('#arpg-hud').getAttribute('data-connected') === 'true');
    check('Health value and fill are from snapshot', await page.locator('#arpg-health').getAttribute('aria-valuenow') === '146' && await page.locator('#arpg-health').evaluate(e => e.style.getPropertyValue('--orb-fill')) === '73%');
    check('Original HP hidden only with known snapshot', !await page.locator('.health').isVisible());
    await page.keyboard.press('Digit1'); await page.keyboard.press('Numpad2'); await slot(2).click();
    check('Keyboard/numpad/mouse each emits exactly one slot', JSON.stringify(await page.evaluate(() => window.uiRequests)) === JSON.stringify([{slot:0}, {slot:1}, {slot:2}]));
    check('Pointer activation restores canvas focus', await page.locator('#game-canvas').evaluate(e => e === document.activeElement));
    check('Requests did not mutate resource', await page.locator('#arpg-resource').getAttribute('aria-valuenow') === '72');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', repeat: true })));
    check('Held keys do not repeat casts', await requestCount() === 3);
    const cooling = state(); cooling.skills[0].cooldownRemaining = 2; await publish(cooling);
    check('Cooldown displays time and radial fraction', await slot(0).innerText().then(t => t.includes('2s')) && await slot(0).evaluate(e => e.style.getPropertyValue('--cooldown-angle')) === '180deg');
    await page.keyboard.press('Digit1'); check('Cooldown forwards intent for authoritative rejection/SFX', await requestCount() === 4 && await slot(0).getAttribute('aria-disabled') === 'true');
    const empty = state(); empty.resource = 10; await publish(empty);
    await page.keyboard.press('Digit2');
    check('Insufficient resource is named and forwards rejection intent', (await slot(1).getAttribute('aria-label')).includes('insuficiente') && await requestCount() === 5);
    for (const key of ['paused', 'dead']) {
      const blocked = state(); blocked[key] = true; await publish(blocked); await page.keyboard.press('Digit3');
      check(`${key} suppresses intention`, await requestCount() === 5);
    }
    const off = state(); off.skills[0].enabled = false; await publish(off); await page.keyboard.press('Digit1');
    check('Combat enabled flag is required', await requestCount() === 5);
    await publish(state());
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'fixture-input'; document.body.append(input); input.focus(); });
    await page.keyboard.press('Digit1'); check('Typing does not cast', await requestCount() === 5);
    await page.locator('#fixture-input').evaluate(e => e.remove());
    await page.evaluate(() => document.querySelector('#game-dialog').showModal());
    await page.keyboard.press('Digit1'); check('Dialog does not cast', await requestCount() === 5);
    await page.evaluate(() => document.querySelector('#game-dialog').close());
    await page.evaluate(() => document.querySelector('#upgrade-panel').classList.remove('is-hidden'));
    await page.keyboard.press('Digit2'); check('Upgrade selection has precedence', await requestCount() === 5);
    await page.evaluate(() => document.querySelector('#upgrade-panel').classList.add('is-hidden'));
    await slot(0).focus(); await page.keyboard.press('Enter');
    check('Native keyboard activation works', await requestCount() === 6);
    check('Tooltip includes skill, element, cost and availability', (await page.locator('#arpg-tooltip').innerText()).includes('22 de Fervor'));
    await publish(null); check('Invalid snapshot falls back safely and restores legacy health', await slot(0).getAttribute('aria-disabled') === 'true' && await page.locator('.health').isVisible());
    const wrongClass = state(); wrongClass.skills[0].id = 'dwarf_explosive_cannon'; await publish(wrongClass);
    check('Cross-class skill mismatch stays unavailable', await slot(0).getAttribute('aria-disabled') === 'true');
    const malformed = state(); malformed.resource = null; await publish(malformed);
    check('Malformed numeric state is not coerced to readiness', await page.locator('#arpg-hud').getAttribute('data-connected') === 'false');
    const oldIds = state(); oldIds.skills[0].id = 'warrior_flame_cleave'; await publish(oldIds);
    check('Retired v1 IDs cannot enable a v2 slot', await slot(0).getAttribute('aria-disabled') === 'true');
    const buff = state(); buff.statuses = [{id:'warcry', skillId:'warrior_war_cry', label:'Grito de Guerra', remaining:5.5, duration:6, description:'Dano +50% (fixture).'}];
    await publish(buff);
    check('Authoritative buff label and remaining time are visible', (await page.locator('#arpg-statuses').innerText()).includes('6s') && (await page.locator('.arpg-status').getAttribute('aria-label')).includes('Dano +50%'));
    await page.waitForTimeout(200);
    const requestsBeforeStatus = svgRequests;
    buff.statuses[0].remaining = 4.3; await publish(buff); await page.waitForTimeout(150);
    check('Status tick updates time without reloading its SVG', (await page.locator('#arpg-statuses').innerText()).includes('5s') && svgRequests === requestsBeforeStatus);
    buff.statuses[0].remaining = 0; await publish(buff);
    check('Expired status is removed on snapshot', !await page.locator('#arpg-statuses').isVisible());
    buff.statuses[0].remaining = 4; buff.dead = true; await publish(buff);
    check('Death clears active status even with stale positive remaining', !await page.locator('#arpg-statuses').isVisible());
    buff.dead = false; await publish(buff); await publish(state('dwarf'));
    check('Class change clears previous class buff', !await page.locator('#arpg-statuses').isVisible());
    const coreBuff = state(); coreBuff.statuses = [{id:'warrior_war_cry',name:'Grito de Guerra',remaining:7.2,duration:8,damageMultiplier:1.35,speedMultiplier:1.15}];
    await publish(coreBuff); await slot(0).focus();
    check('Actual Combat status schema exposes received modifiers', (await page.locator('.arpg-tooltip__effect').innerText()).includes('Dano +35%') && (await page.locator('.arpg-tooltip__effect').innerText()).includes('Movimento +15%'));
    await page.locator('#game-canvas').focus(); await slot(0).hover();
    check('Intentional mouse hover exposes help', await page.locator('#arpg-tooltip').isVisible());
    await slot(0).click(); await publish(coreBuff);
    check('Mouse cast dismisses help and snapshot does not reopen it', !await page.locator('#arpg-tooltip').isVisible());
    await slot(0).focus(); await page.keyboard.press('Enter');
    check('Keyboard focused activation retains intentional help', await page.locator('#arpg-tooltip').isVisible());
    cooling.statuses = [{id:'warcry',skillId:'warrior_war_cry',label:'Grito de Guerra',remaining:5.4,duration:6}];
    await publish(cooling); await page.locator('#game-canvas').focus(); await page.mouse.move(500, 400);
    await telemetry.capture('warrior-desktop');
    await page.setViewportSize({ width: 2560, height: 1080 }); await telemetry.capture('ultrawide');
    await publish(state('dwarf')); check('Class switch changes weapon/element/resource', await slot(2).getAttribute('data-element') === 'arcane' && await page.locator('#arpg-resource').getAttribute('aria-label') === 'Foco');
    await page.setViewportSize({ width: 1440, height: 900 }); await telemetry.capture('dwarf-desktop');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('Reduced motion removes liquid transition', await page.locator('.arpg-orb__liquid').first().evaluate(e => getComputedStyle(e).transitionDuration) === '0s');
    // Geometry is measured after actual browser layout, at minimum phone and landscape sizes.
    for (const [width, height] of [[320,568], [375,667], [393,852], [844,390], [667,375]]) {
      const context = await browser.newContext({ viewport: {width,height}, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      const phone = await context.newPage();
      await phone.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
      await phone.route('**/src/ui/presentation.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export {};' }));
      await phone.goto(server.origin + '/?offline=1&gui-fixture=1');
      await phone.waitForSelector('[data-arpg-slot="0"]', {state:'attached'});
      await phone.evaluate(detail => { document.querySelector('#message').classList.add('is-hidden'); window.dispatchEvent(new CustomEvent('bipx:arpg-state', {detail})); window.uiRequests = []; window.addEventListener('bipx:skill-request', e => window.uiRequests.push(e.detail)); }, state('dwarf'));
      const geometry = await phone.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
        return { hud:rect('#arpg-hud'), stick:rect('#touch-stick'), fire:rect('#touch-fire'), skills:[0,1,2].map(i => rect(`[data-arpg-slot="${i}"]`)), scrollWidth:document.documentElement.scrollWidth, width:innerWidth, height:innerHeight };
      });
      const overlap = (a,b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
      check(`${width}x${height}: HUD inside viewport`, geometry.hud.x >= 0 && geometry.hud.right <= geometry.width && geometry.hud.bottom <= geometry.height);
      check(`${width}x${height}: three targets at least 44px`, geometry.skills.every(r => r.width >= 44 && r.height >= 44));
      check(`${width}x${height}: skills clear of both joysticks`, geometry.skills.every(r => !overlap(r,geometry.stick) && !overlap(r,geometry.fire)));
      check(`${width}x${height}: no horizontal overflow`, geometry.scrollWidth <= geometry.width);
      await phone.locator('[data-arpg-slot="0"]').tap();
      check(`${width}x${height}: touch requests exactly one cast`, await phone.evaluate(() => window.uiRequests.length === 1 && window.uiRequests[0].slot === 0));
      check(`${width}x${height}: primary touch leaves combat free of tooltip`, !await phone.locator('#arpg-tooltip').isVisible());
      const touch = await context.newCDPSession(phone);
      const held = {id:1,x:geometry.stick.x+geometry.stick.width/2,y:geometry.stick.y+geometry.stick.height/2};
      const skillTouch = {id:2,x:geometry.skills[1].x+geometry.skills[1].width/2,y:geometry.skills[1].y+geometry.skills[1].height/2};
      await touch.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[held]});
      await touch.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[held,skillTouch]});
      await touch.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[held]});
      await touch.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
      check(`${width}x${height}: secondary finger requests one skill without duplicate`, await phone.evaluate(() => window.uiRequests.length === 2 && window.uiRequests[1].slot === 1));
      check(`${width}x${height}: secondary touch leaves combat free of tooltip`, !await phone.locator('#arpg-tooltip').isVisible());
      await touch.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[held]});
      await touch.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[held,skillTouch]});
      await touch.send('Input.dispatchTouchEvent', {type:'touchCancel',touchPoints:[]});
      check(`${width}x${height}: cancelled secondary touch does not cast`, await phone.evaluate(() => window.uiRequests.length === 2));
      await phone.locator('[data-arpg-slot="0"]').tap();
      check(`${width}x${height}: next primary tap is not suppressed`, await phone.evaluate(() => window.uiRequests.length === 3 && window.uiRequests[2].slot === 0));
      check(`${width}x${height}: next cast still does not open help`, !await phone.locator('#arpg-tooltip').isVisible());
      await phone.locator('[data-arpg-slot="0"]').focus();
      const tooltipRect = await phone.locator('#arpg-tooltip').boundingBox();
      const tooltip = {x:tooltipRect.x,y:tooltipRect.y,right:tooltipRect.x+tooltipRect.width,bottom:tooltipRect.y+tooltipRect.height};
      check(`${width}x${height}: focused help clears both joysticks`, !overlap(tooltip,geometry.stick) && !overlap(tooltip,geometry.fire));
      check(`${width}x${height}: focused help stays inside viewport`, tooltip.x >= 0 && tooltip.y >= 0 && tooltip.right <= geometry.width && tooltip.bottom <= geometry.height);
      await phone.waitForFunction(() => [...document.querySelectorAll('.arpg-actions use')].length === 4 && [...document.querySelectorAll('.arpg-actions use')].every(e => e.getBBox().width > 10));
      await phone.locator('#game-canvas').focus();
      await phone.screenshot({path:path.join(evidenceDir, `gui-fixture-mobile-${width}x${height}.png`)});
      fs.writeFileSync(path.join(evidenceDir, `geometry-${width}x${height}.json`), JSON.stringify(geometry, null, 2));
      await context.close();
    }
    telemetry.assertClean();
  } catch(error) { telemetry.fail(error); throw error; }
  finally { await telemetry.save({ checks, uiSourceHashes: sourceHashes, uiSourceChangedDuringRun: JSON.stringify(sourceHashes) !== JSON.stringify(hashUi()), skillDirection: 'v2', scope: 'UI event/layout fixture; main and presentation modules intercepted. No gameplay/casts/damage proof.' }); }
  console.log(JSON.stringify({ checks: checks.length, evidenceDir }));
} finally {
  await browser?.close();
  await server?.stop();
  if (JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'))).pid === process.pid) fs.rmSync(lock, { recursive: true });
}
