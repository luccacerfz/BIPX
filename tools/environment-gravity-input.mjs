// One real keyboard cast near the spawn portal. Debug APIs are observation only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,browserLaunchOptions,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir,sourceFingerprint} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const root=path.resolve(process.argv[2]);
const code=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
assert(/worldVisuals\?\.update\([^;]*skillAreas\)/.test(code),'Snapshot lacks Environment fifth argument');
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
fs.mkdirSync(lock);fs.writeFileSync(`${lock}/owner.json`,JSON.stringify({owner:'environment-gravity-real-input',pid:process.pid,token,created:new Date().toISOString()}));
let server,browser,context,telemetry,page;
const report={scope:'Actual offline Dwarf input, one gravity cast against a naturally approaching enemy. No entity/resource/skill injection. Environment focus, portal attenuation and expiration only; no global AAA, multiplayer or six-skill acceptance.',observations:[]};
try {
 process.chdir(root);server=await localServer();browser=await chromium.launch(browserLaunchOptions);
 context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
 page=await context.newPage();telemetry=attachQualityTelemetry(page,'environment-gravity-input');
 const started=sourceFingerprint();
 const resumeUpgrade=async()=>{const choice=page.locator('#upgrade-panel:not(.hidden) [data-upgrade-index]').first();if(await choice.isVisible().catch(()=>false)){await choice.click();await page.locator('#game-canvas').focus();(report.upgradeInputs??=[]).push(Date.now());}};
 const sample=()=>page.evaluate(()=>{
  const d=window.__zombieNightDebug,p=d.getPresentationStats(),v=d.getClassSkillVfxStats(),s=d.getState();
  return {wallTime:performance.now(),time:s.survivalTime,game:s.state,paused:s.paused,health:s.health,kills:s.kills,player:s.player,
   skillState:d.getSkillState(),hud:d.getArpgState(),targets:d.getSkillTargets(),events:d.getSkillEvents(),
   vfx:{version:v.version,rejected:v.rejected,states:v.states},
   world:{loaded:p.assets.world.loaded,colliders:p.assets.world.colliders,skillAreaFocusCount:p.assets.world.skillAreaFocusCount,skillAreaIds:p.assets.world.skillAreaIds,portalTintScale:p.assets.world.portalTintScale},
   assetErrors:p.assets.errors,quality:p.quality,reducedMotion:p.reducedMotion};
 });
 try {
  await page.goto(`${server.origin}/?offline=1&quality=high`,{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
  await page.locator('#open-login-button').click();await page.locator('label[for="character-dwarf"]').click();await waitForRuntimeAssets(page,telemetry);
  await page.locator('#player-name').fill('Environment gravity QA');await page.locator('#play-button').click();
  await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');await page.locator('#game-canvas').focus();
  // Keep the real spawn position and let pursuit place a real target near the portal.
  await page.waitForFunction(()=>{const d=window.__zombieNightDebug;return d.getState().state==='playing'&&d.getSkillTargets().some(t=>t.health>0&&Math.hypot(t.x,t.z)>2&&Math.hypot(t.x,t.z)<4.2)},null,{timeout:45000});
  report.before=await sample();assert.equal(report.before.world.skillAreaFocusCount,0);assert.equal(report.before.world.portalTintScale,1);
  assert.equal(report.before.hud.skills[2].id,'dwarf_gravity_shot');assert(report.before.hud.skills[2].enabled);
  await telemetry.capture('portal-before-cast');
  const target=await page.evaluate(()=>{const d=window.__zombieNightDebug;const t=d.getSkillTargets().filter(t=>t.health>0).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];return {...t,screen:d.projectWorldPosition(t.x,0,t.z)}});
  report.target=target;await page.mouse.move(target.screen.x,target.screen.y);await page.waitForTimeout(40);await page.keyboard.press('3');
  await page.waitForFunction(()=>window.__zombieNightDebug.getSkillState().fields.length>0,null,{timeout:5000});
  await resumeUpgrade();
  await page.waitForFunction(()=>window.__zombieNightDebug.getPresentationStats().assets.world.skillAreaFocusCount>0,null,{timeout:1500});
  report.active=await sample();const field=report.active.skillState.fields[0];report.castId=field.castId;
  assert.equal(field.skillId,'dwarf_gravity_shot');assert.equal(field.radius,5);assert(field.remaining>0&&field.remaining<=5);
  assert(Math.hypot(field.x,field.z)<field.radius+1.8,'Natural impact did not overlap spawn portal');
  assert.equal(report.active.world.skillAreaFocusCount,1);assert.equal(report.active.world.portalTintScale,.28);
  assert(report.active.world.skillAreaIds.includes(field.castId));assert.equal(report.active.vfx.states.fields,1);assert.equal(report.active.vfx.version,2);
  assert(report.active.events.some(e=>e.phase==='cast'&&e.skillId==='dwarf_gravity_shot'),'Real input did not produce accepted cast');
  assert(report.active.hud.skills[2].cooldownRemaining>0);assert(report.active.hud.resource<report.before.hud.resource);
  await telemetry.capture('active-field-portal-dimmed');
  await page.keyboard.down('a');await page.waitForTimeout(450);await page.keyboard.up('a');
  report.moved=await sample();assert(Math.hypot(report.moved.player.x-report.active.player.x,report.moved.player.z-report.active.player.z)>.5,'Player did not move through real input');
  const movedField=report.moved.skillState.fields.find(f=>f.castId===field.castId);assert(movedField);assert.equal(movedField.x,field.x);assert.equal(movedField.z,field.z);assert.equal(report.moved.world.portalTintScale,.28);
  await telemetry.capture('fixed-field-player-moved');
  const deadline=Date.now()+9000;
  while(Date.now()<deadline){
   await resumeUpgrade();
   const current=await sample();report.observations.push(current);
   assert.equal(current.game,'playing','Run ended or paused before natural expiry');assert.equal(current.paused,false);assert.equal(current.assetErrors.length,0);
   const live=current.skillState.fields.find(f=>f.castId===field.castId);
   if(live){assert.equal(live.x,field.x);assert.equal(live.z,field.z);assert.equal(current.world.portalTintScale,.28);assert.equal(current.world.skillAreaFocusCount,1);}
   else if(current.world.skillAreaFocusCount===0&&current.vfx.states.fields===0){report.expired=current;break;}
   await page.waitForTimeout(100);
  }
  assert(report.expired,'Field/focus failed to expire');assert.equal(report.expired.world.portalTintScale,1);assert.deepEqual(report.expired.world.skillAreaIds,[]);
  assert.equal(report.expired.skillState.fields.length,0);assert.equal(report.expired.vfx.states.fields,0);
  const elapsed=report.expired.time-report.active.time;assert(elapsed>3&&elapsed<6,'Unexpected natural field lifetime');
  await page.waitForTimeout(300);report.final=await sample();assert.equal(report.final.world.skillAreaFocusCount,0);assert.equal(report.final.world.portalTintScale,1);
  await telemetry.capture('expired-portal-restored');
  assert.deepEqual(sourceFingerprint(),started,'Frozen candidate changed during input run');telemetry.assertClean();
 } catch(error){telemetry.fail(error);process.exitCode=1;}
 finally {await telemetry.save({measurements:report});}
 const video=await page.video()?.path();await context.close();context=null;
 if(video){fs.renameSync(video,path.join(evidenceDir,'environment-gravity-input.webm'));telemetry.report.video='environment-gravity-input.webm';fs.writeFileSync(path.join(evidenceDir,'environment-gravity-input.json'),JSON.stringify(telemetry.report,null,2)+'\n');}
 console.log(JSON.stringify({assertions:telemetry.report.assertions,failure:telemetry.report.failure,sourceChanged:telemetry.report.sourceChangedDuringRun,activeFocus:report.active?.world,expiredFocus:report.expired?.world,evidenceDir}));
} finally {
 await context?.close();await browser?.close();await server?.stop();
 if(fs.existsSync(`${lock}/owner.json`)&&JSON.parse(fs.readFileSync(`${lock}/owner.json`)).token===token)fs.rmSync(lock,{recursive:true});
}
