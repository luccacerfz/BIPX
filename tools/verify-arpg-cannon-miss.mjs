import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {createCollisionWorld,sweepStatic} from '../src/physics/contacts.mjs';
import {getEnvironmentColliders,ENVIRONMENT_GROUND} from '../src/render/environment-layout.js';
const source=fs.readFileSync('src/main.js','utf8');
const fixture=`\nwindow.__cannonMissPrepare=()=>{clearPlayerInput();clearEntities();game.zombiesToSpawn=0;game.nextWaveDelay=1000000;game.trapTimer=1000000;return window.__zombieNightDebug.getState();};`;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let server,browser,context,telemetry;
const report={passed:false,scope:'Declared empty-world fixture: clears entities and disables spawning only. Actual menu/keyboard aim/key1; no position, HP, resource, cooldown or core mutation. Range detonation is authoritative, not a victim hit.',instrumentation:{sourceSha256:hash(source),fixtureSha256:hash(fixture),servedSha256:hash(source+fixture)}};
try{
 server=await localServer();browser=await chromium.launch({channel:'chrome',headless:false});
 context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
 const page=await context.newPage();telemetry=attachQualityTelemetry(page,'cannon-miss');telemetry.markFixture();telemetry.report.browserLaunch={channel:'chrome',headless:false};
 await page.route('**/src/main.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:source+fixture}));
 await page.goto(server.origin+'/?offline=1',{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
 await page.locator('#open-login-button').click();await page.locator('label[for="character-dwarf"]').click();await waitForRuntimeAssets(page,telemetry);await page.locator('#player-name').fill('Cannon range miss');await page.locator('#play-button').click();
 await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
 const before=await page.evaluate(()=>window.__cannonMissPrepare()),p=before.player;
 const world=createCollisionWorld({colliders:getEnvironmentColliders(),bounds:ENVIRONMENT_GROUND});
 let direction;for(let i=0;i<8;i++){const angle=i*Math.PI*2/8,dir={x:Math.abs(Math.cos(angle))<1e-8?0:Math.cos(angle),z:Math.abs(Math.sin(angle))<1e-8?0:Math.sin(angle)};if(!sweepStatic(world,{x:p.x,y:1.05,z:p.z},{x:p.x+dir.x*22,y:1.05,z:p.z+dir.z*22},.32,{kind:'projectile'})){direction=dir;break;}}
 assert.ok(direction,'No unobstructed range lane');report.direction=direction;
 await page.evaluate(()=>{window.__cannonMissFrames=[];window.__cannonMissEvents=[];window.__cannonMissSeen=new Set();window.__cannonMissRunning=true;const tick=()=>{if(!window.__cannonMissRunning)return;const d=window.__zombieNightDebug;window.__cannonMissFrames.push({time:d.getState().survivalTime,vfx:d.getClassSkillVfxStats()});for(const e of d.getSkillEvents()){const key=[e.castId,e.phase,e.time].join(':');if(!window.__cannonMissSeen.has(key)){window.__cannonMissSeen.add(key);window.__cannonMissEvents.push(e)}}requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 const aimKeys=[direction.x>0?'l':direction.x<0?'j':null,direction.z>0?'k':direction.z<0?'i':null].filter(Boolean);
 await page.locator('#game-canvas').focus();for(const key of aimKeys)await page.keyboard.down(key);await page.waitForTimeout(80);await page.keyboard.press('1');
 await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon.casts.some(c=>c.phase==='travel'));await telemetry.capture('travel');
 await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon.casts.some(c=>c.phase==='impact'));await page.waitForTimeout(180);await telemetry.capture('range-detonation');
 await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon.casts.length===0);
 const observed=await page.evaluate(()=>{window.__cannonMissRunning=false;return{frames:window.__cannonMissFrames,events:window.__cannonMissEvents,after:window.__zombieNightDebug.getState(),targets:window.__zombieNightDebug.getSkillTargets(),vfx:window.__zombieNightDebug.getClassSkillVfxStats()}});
 for(const key of aimKeys)await page.keyboard.up(key);
 report.before=before;report.observed=observed;
 const impacts=observed.events.filter(e=>e.skillId==='dwarf_explosive_cannon'&&e.phase==='impact');assert.equal(impacts.length,1);
 const impact=impacts[0],travel=observed.events.filter(e=>e.castId===impact.castId&&e.phase==='travel');
 assert.ok(Math.abs(Math.hypot(impact.target.x-impact.origin.x,impact.target.z-impact.origin.z)-22)<.001,'Miss detonated before its authoritative range');assert.ok(travel.at(-1).terminal);
 assert.equal(observed.targets.length,0);assert.equal(observed.after.kills,before.kills);assert.equal(observed.after.score,before.score);
 const records=observed.frames.flatMap(f=>f.vfx.cannon.casts);assert.ok(records.some(c=>c.originBridge.queries>0));assert.ok(records.some(c=>c.phase==='impact'&&Math.hypot(c.hit[0]-impact.target.x,c.hit[1]-impact.target.y,c.hit[2]-impact.target.z)<1e-8));assert.equal(observed.vfx.cannon.casts.length,0);
 report.before=before;report.observed=observed;report.impact=impact;telemetry.assertClean();report.passed=true;
}catch(error){report.failure=error.stack;telemetry?.fail(error);process.exitCode=1}
finally{if(telemetry){await telemetry.save({measurements:report});report.sourceChanged=telemetry.report.sourceChangedDuringRun}await context?.close();await browser?.close();await server?.stop();fs.writeFileSync(path.join(evidenceDir,'cannon-miss-summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({evidenceDir,passed:report.passed,failure:report.failure,sourceChanged:report.sourceChanged}));}
