import { acquireGpuLock } from './quality-gpu-lock.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const gpu=await acquireGpuLock({owner:'combat-combos'}); // shared reservation: waits (2 s retries, 25 min) or inherits the runner's lease
let server,browser;const results=[];
try{
 server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
 for(const [character,quality,reduced] of [['warrior','high',false],['dwarf','high',false],['dwarf','low',true]]){
  const name=`combo-${character}-${quality}`,item={character,quality,reduced,passed:false,scope:'Natural enemies and real menu/mouse/keyboard input; no gameplay mutations. Read-only target projection and RAF observations.',casts:[]};
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
  const page=await context.newPage(),telemetry=attachQualityTelemetry(page,name);telemetry.report.browserLaunch={channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']};
  try{
   await page.goto(server.origin+'/?offline=1',{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
   await page.locator('#menu-settings-button').click();await page.locator('#quality-select').selectOption(quality);await page.locator('#motion-toggle').setChecked(reduced);await page.locator('#dialog-done').click();
   await page.locator('#open-login-button').click();await page.locator(`label[for="character-${character}"]`).click();await waitForRuntimeAssets(page,telemetry);await page.locator('#player-name').fill(name);await page.locator('#play-button').click();
   await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{window.__comboObservation={frames:[],events:[],seen:new Set(),running:true};const tick=()=>{const o=window.__comboObservation;if(!o.running)return;const d=window.__zombieNightDebug,s=d.getState();o.frames.push({time:s.survivalTime,health:s.health,kills:s.kills,targets:d.getSkillTargets(),skills:d.getSkillState(),vfx:d.getClassSkillVfxStats(),pipeline:d.getPresentationStats().pipeline,cutEvents:d.getPresentationStats().assets.enemies.cutEvents});if(o.frames.length>2500)o.frames.shift();for(const e of d.getSkillEvents()){const key=[e.castId,e.phase,e.contactId,e.time].join(':');if(!o.seen.has(key)){o.seen.add(key);o.events.push(e)}}requestAnimationFrame(tick)};requestAnimationFrame(tick)});
   await page.waitForFunction(()=>{const d=window.__zombieNightDebug,p=d.getState().player;return d.getSkillTargets().some(t=>t.health>0&&Math.hypot(t.x-p.x,t.z-p.z)<6)},null,{timeout:20000});
   let comboTargetId=null;
   async function aim(){const target=await page.evaluate(preferredId=>{const d=window.__zombieNightDebug,p=d.getState().player,t=d.getSkillTargets().filter(t=>t.health>0).sort((a,b)=>Number(b.id===preferredId)-Number(a.id===preferredId)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];return t?{...t,screen:d.projectWorldPosition(t.x,0,t.z)}:null},comboTargetId);if(character==='dwarf'&&target)comboTargetId=target.id;assert.ok(target,'Natural target missing');await page.mouse.move(target.screen.x,target.screen.y);await page.waitForTimeout(80);return target;}
   async function cast(slot){await page.waitForFunction(slot=>document.querySelector(`[data-arpg-slot="${slot}"]`)?.dataset.state==='ready',slot);const target=await aim(),before=await page.evaluate(()=>window.__zombieNightDebug.getSkillState().sequence);await page.keyboard.press(String(slot+1));await page.waitForFunction(n=>window.__zombieNightDebug.getSkillState().sequence>n,before);const receipt=await page.evaluate(()=>window.__zombieNightDebug.getSkillEvents().filter(e=>e.phase==='cast').at(-1));item.casts.push({slot,target,receipt});return receipt;}
   if(character==='warrior'){
    await cast(0);await page.waitForFunction(()=>window.__zombieNightDebug.getSkillState().buff?.remaining>0);
    await page.waitForFunction(()=>window.__zombieNightDebug.getPresentationStats().assets.world.skillAreaFocusCount>0);
    item.environmentBuff=await page.evaluate(()=>window.__zombieNightDebug.getPresentationStats().assets.world);
    await cast(2);await page.waitForFunction(()=>window.__zombieNightDebug.getSkillTargets().some(t=>t.health>0&&t.stun>0),null,{timeout:3500});
    await telemetry.capture('living-stunned-targets');await cast(1);
    await page.waitForFunction(()=>window.__zombieNightDebug.getPresentationStats().assets.enemies.cutEvents>0,null,{timeout:4000});await telemetry.capture('confirmed-dash-death');
   }else{
    await cast(2);await page.waitForFunction(()=>window.__zombieNightDebug.getSkillState().fields.length>0);
    await page.waitForFunction(()=>window.__zombieNightDebug.getPresentationStats().assets.world.skillAreaFocusCount>0);
    item.environmentGravity=await page.evaluate(()=>window.__zombieNightDebug.getPresentationStats().assets.world);
    await page.waitForTimeout(200);await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().states.gravity?.depthValid===true);await telemetry.capture('fixed-gravity-pull');
    await cast(1);await page.waitForFunction(()=>window.__zombieNightDebug.getSkillTargets().some(t=>t.health>0&&t.freeze>0),null,{timeout:3500});
    await telemetry.capture('living-frozen-targets');const before=await page.evaluate(()=>window.__zombieNightDebug.getState().kills);await cast(0);
    await page.waitForFunction(n=>window.__zombieNightDebug.getState().kills>n,before,{timeout:4000});await telemetry.capture('cannon-combo');
    await page.locator('#pause-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().paused);
    const pausedBefore=await page.evaluate(()=>({state:window.__zombieNightDebug.getState(),vfx:window.__zombieNightDebug.getClassSkillVfxStats()}));
    assert.ok(pausedBefore.vfx.cannon.casts.length>0,'Pause must exercise a live cannon effect');
    await page.waitForTimeout(250);
    const pausedAfter=await page.evaluate(()=>({state:window.__zombieNightDebug.getState(),vfx:window.__zombieNightDebug.getClassSkillVfxStats()}));
    assert.equal(pausedAfter.state.survivalTime,pausedBefore.state.survivalTime);assert.equal(pausedAfter.vfx.cannon.time,pausedBefore.vfx.cannon.time);
    item.cannonPause={before:pausedBefore,after:pausedAfter};await page.locator('#dialog-done').click();await page.waitForFunction(()=>!window.__zombieNightDebug.getState().paused);
    await page.waitForTimeout(300);await telemetry.capture('gravity-mature');
   }
   await page.waitForTimeout(600);
   item.observation=await page.evaluate(()=>{window.__comboObservation.running=false;return {frames:window.__comboObservation.frames,events:window.__comboObservation.events}});
   if(character==='dwarf'){
    const cannonCast=item.casts.find(c=>c.receipt.skillId==='dwarf_explosive_cannon').receipt.castId;
    const fireFrames=item.observation.frames.filter(f=>f.vfx.cannon?.casts.some(c=>c.id===cannonCast));
    assert.ok(fireFrames.length>0,'Runtime cannon pool was never observed');
    const records=fireFrames.flatMap(f=>f.vfx.cannon.casts.filter(c=>c.id===cannonCast));
    assert.ok(records.some(c=>c.originBridge.queries>0),'Main visual sweep callback was never queried');
    assert.ok(records.every(c=>!['missing-sweep','invalid-sweep','missing-socket'].includes(c.originBridge.fallback)),'Runtime cannon lost its callback or animated socket');
    const impact=item.observation.events.find(e=>e.castId===cannonCast&&e.phase==='impact');assert.ok(impact);
    assert.ok(records.some(c=>c.phase==='impact'&&Math.hypot(c.hit[0]-impact.target.x,c.hit[1]-impact.target.y,c.hit[2]-impact.target.z)<1e-8),'Rendered explosion must end at confirmed contact');
    const shared=fireFrames.filter(f=>f.vfx.sceneDepth.fireCasts>0&&f.vfx.sceneDepth.gravityFields>0);
    assert.ok(shared.length>0,'No fire/gravity coexistence observed');
    assert.ok(shared.every(f=>f.pipeline.depth.passes===1&&f.vfx.cannon.depthValid&&f.vfx.states.gravity.depthValid),'Both consumers need one current depth pass');
    item.cannonIntegration={castId:cannonCast,observedFrames:fireFrames.length,sharedDepthFrames:shared.length,impact};
    await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon.casts.length===0,null,{timeout:4000});
    item.cannonExpired=await page.evaluate(()=>window.__zombieNightDebug.getClassSkillVfxStats().cannon);
   }
   item.final=await page.evaluate(()=>({state:window.__zombieNightDebug.getState(),skills:window.__zombieNightDebug.getSkillState(),vfx:window.__zombieNightDebug.getClassSkillVfxStats()}));
   assert.equal(new Set(item.casts.map(c=>c.receipt.skillId)).size,3);if(character==='dwarf'){const frames=item.observation.frames.filter(f=>f.vfx.states.gravity?.visibleFields>0);assert.ok(frames.length>0,'No visible gravity observed');assert.ok(frames.every(f=>f.vfx.states.gravity.depthValid&&f.pipeline.depth.passes===1),'Visible gravity requires one same-frame depth pass');assert.ok(frames.some(f=>f.pipeline.depth.adapted>0),'Runtime Environment depth adapter missing');}telemetry.assertClean();item.passed=true;
  }catch(error){item.failure=error.stack;telemetry.fail(error);item.observation=await page.evaluate(()=>window.__comboObservation?{frames:window.__comboObservation.frames,events:window.__comboObservation.events}:null).catch(()=>null);process.exitCode=1;}
  finally{await telemetry.save({measurements:item});item.sourceChanged=telemetry.report.sourceChangedDuringRun;const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidenceDir,`${name}.webm`));results.push(item);}
 }
}finally{await browser?.close();await server?.stop();gpu.release();fs.writeFileSync(path.join(evidenceDir,'arpg-combos.json'),JSON.stringify({passed:results.length===3&&results.every(r=>r.passed&&!r.sourceChanged),results},null,2));console.log(JSON.stringify({evidenceDir,results:results.map(({character,quality,passed,failure,sourceChanged})=>({character,quality,passed,failure,sourceChanged}))}));}
