import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
try{fs.mkdirSync(lock)}catch{console.log('GPU occupied; no browser launched');process.exit(75)}
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'animation-death-only',pid:process.pid,token}));
let server,browser;const results=[];
try{
 server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
 for(const [character,quality,reduced] of [['warrior','high',false]]){
  const name=`death-cut-${character}-${quality}`,item={character,quality,reduced,passed:false,scope:'Natural enemies and real menu/mouse/keyboard input; no gameplay mutations. Read-only target projection and RAF observations.',casts:[]};
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
  const page=await context.newPage(),telemetry=attachQualityTelemetry(page,name);telemetry.report.browserLaunch={channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']};
  try{
   await page.goto(server.origin+'/?offline=1',{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
   await page.locator('#menu-settings-button').click();await page.locator('#quality-select').selectOption(quality);await page.locator('#motion-toggle').setChecked(reduced);await page.locator('#dialog-done').click();
   await page.locator('#open-login-button').click();await page.locator(`label[for="character-${character}"]`).click();await waitForRuntimeAssets(page,telemetry);await page.locator('#player-name').fill(name);await page.locator('#play-button').click();
   await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');await page.locator('#game-canvas').focus();
   await page.evaluate(()=>{window.__comboObservation={frames:[],events:[],seen:new Set(),running:true};const tick=()=>{const o=window.__comboObservation;if(!o.running)return;const d=window.__zombieNightDebug,s=d.getState();o.frames.push({time:s.survivalTime,health:s.health,kills:s.kills,targets:d.getSkillTargets(),skills:d.getSkillState(),vfx:d.getClassSkillVfxStats(),cutEvents:d.getPresentationStats().assets.enemies.cutEvents,cutCorpses:d.getPresentationStats().assets.enemies.cutCorpses});if(o.frames.length>2500)o.frames.shift();for(const e of d.getSkillEvents()){const key=[e.castId,e.phase,e.contactId,e.time].join(':');if(!o.seen.has(key)){o.seen.add(key);o.events.push(e)}}requestAnimationFrame(tick)};requestAnimationFrame(tick)});
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
    await page.waitForTimeout(240);await telemetry.capture('falling');
    await page.waitForTimeout(460);await telemetry.capture('settled');
    await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(()=>window.__zombieNightDebug.getPresentationStats().assets.enemies.cutCorpses),0,'Cut must expire');
   }
   await page.waitForTimeout(600);
   item.observation=await page.evaluate(()=>{window.__comboObservation.running=false;return {frames:window.__comboObservation.frames,events:window.__comboObservation.events}});
   item.final=await page.evaluate(()=>({state:window.__zombieNightDebug.getState(),skills:window.__zombieNightDebug.getSkillState(),vfx:window.__zombieNightDebug.getClassSkillVfxStats()}));
   assert.equal(new Set(item.casts.map(c=>c.receipt.skillId)).size,3);
   const dash=item.casts.find(c=>c.receipt.skillId==='warrior_cleaving_dash');
   const contacts=item.observation.events.filter(e=>e.castId===dash.receipt.castId&&e.killed);
   assert(contacts.length>0,'Dash must have a confirmed lethal event');
   const firstCut=item.observation.frames.findIndex(f=>f.cutEvents>0);
   assert(firstCut>=0,'Actual render pool must create a cut');
   assert(item.observation.frames.slice(0,firstCut).every(f=>f.cutCorpses===0),'No corpse before lethal dash');
   item.confirmedDashDeaths=contacts;item.firstCutFrame=item.observation.frames[firstCut];telemetry.assertClean();item.passed=true;
  }catch(error){item.failure=error.stack;telemetry.fail(error);item.observation=await page.evaluate(()=>window.__comboObservation?{frames:window.__comboObservation.frames,events:window.__comboObservation.events}:null).catch(()=>null);process.exitCode=1;}
  finally{await telemetry.save({measurements:item});item.sourceChanged=telemetry.report.sourceChangedDuringRun;const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidenceDir,`${name}.webm`));results.push(item);}
 }
}finally{await browser?.close();await server?.stop();if(JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});fs.writeFileSync(path.join(evidenceDir,'death-only.json'),JSON.stringify({passed:results.length===1&&results.every(r=>r.passed&&!r.sourceChanged),results},null,2));console.log(JSON.stringify({evidenceDir,results:results.map(({character,quality,passed,failure,sourceChanged})=>({character,quality,passed,failure,sourceChanged}))}));}
