/** Real menu/settings/keyboard input. Read-only debug telemetry; no spawned actors or granted resources. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir, sourceFingerprint } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
import { gpuReservation, sha256 } from './class-skill-vfx-support.mjs';
const release=await gpuReservation();
const root=process.cwd();
let browser,server,snapshot,capturedSources;const results=[];
try{
 capturedSources=sourceFingerprint();
 snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-vfx-gameplay-'));
 for(const file of Object.keys(capturedSources)){
  const target=path.join(snapshot,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(root,file),target);
 }
 assert.deepEqual(sourceFingerprint(),capturedSources,'Checkout changed during snapshot copy');
 process.chdir(snapshot);assert.deepEqual(sourceFingerprint(),capturedSources,'Copied runtime differs from captured hashes');
 server=await localServer();
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
 for(const [character,quality,reduced] of [['warrior','high',false],['dwarf','high',false],['dwarf','low',true]]){
  const name=`vfx-v2-${character}-${quality}${reduced?'-reduced':''}`,item={character,quality,reduced,passed:false,casts:[],scope:'Natural offline game with menu/settings/keyboard input; no actor spawning, damage/resource/cooldown overrides or debug starts'};
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
  const page=await context.newPage(),telemetry=attachQualityTelemetry(page,name);telemetry.report.browserLaunch={channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']};
  try{
   await page.goto(server.origin+'/?offline=1',{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
   await page.locator('#menu-settings-button').click();await page.locator('#quality-select').selectOption(quality);await page.locator('#motion-toggle').setChecked(reduced);await page.locator('#dialog-done').click();
   await page.locator('#open-login-button').click();await page.locator(`label[for="character-${character}"]`).click();await waitForRuntimeAssets(page,telemetry);
   await page.locator('#player-name').fill(`VFX ${character}`);await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug?.getState().state==='playing');
   await page.locator('#game-canvas').focus();await telemetry.capture('before');
   // Record a bounded timeline from read-only telemetry while real simulation runs.
   await page.evaluate(()=>{
    window.__vfxEvidence={frames:[],events:new Map(),active:true};
    function tick(){const out=window.__vfxEvidence;if(!out.active)return;
     const d=window.__zombieNightDebug,s=d.getClassSkillVfxStats(),state=d.getState();
     for(const e of d.getSkillEvents()){const key=[e.castId,e.phase,e.contactId??'',e.time].join(':');if(out.events.size<1024)out.events.set(key,e);}
     if(out.frames.length<3000)out.frames.push({time:state.survivalTime,body:s.bodies.active,states:s.states,events:s.events,resource:d.getArpgState().resource,player:state.player,targets:d.getSkillTargets()});
     requestAnimationFrame(tick);
    }requestAnimationFrame(tick);
   });
   await page.waitForTimeout(5000);
   await page.waitForFunction(()=>{const d=window.__zombieNightDebug,p=d.getState().player;return d.getSkillTargets().some(t=>t.health>0&&Math.hypot(t.x-p.x,t.z-p.z)<4.5);},null,{timeout:12000});
   for(const slot of character==='dwarf'?[2,1,0]:[0,1,2]){
    if(await page.locator('[data-upgrade-index="0"]').isVisible())await page.locator('[data-upgrade-index="0"]').click();
    await page.waitForFunction(slot=>window.__zombieNightDebug.getArpgState().skills[slot].enabled,slot,{timeout:12000});
    const aim=await page.evaluate(()=>{const d=window.__zombieNightDebug,p=d.getState().player,targets=d.getSkillTargets();targets.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));const t=targets[0];if(!t)return ['i'];const x=t.x-p.x,z=t.z-p.z,m=Math.max(Math.abs(x),Math.abs(z));return [...(Math.abs(z)>m*.42?[z<0?'i':'k']:[]),...(Math.abs(x)>m*.42?[x<0?'j':'l']:[])];});
    await page.locator('#game-canvas').focus();
    for(const key of aim)await page.keyboard.down(key);
    await page.waitForTimeout(80);
    const before=await page.evaluate(()=>window.__zombieNightDebug.getArpgState());
    if(slot===0)await page.keyboard.down('a');
    const approach=character==='dwarf'&&slot===2?aim.map(k=>({i:'w',j:'a',k:'s',l:'d'})[k]):[];
    for(const key of approach)await page.keyboard.down(key);
    await page.keyboard.press(String(slot+1));
    await page.waitForFunction(slot=>window.__zombieNightDebug.getArpgState().skills[slot].cooldownRemaining>0,slot,{timeout:4000});
    const accepted=await page.evaluate(()=>window.__zombieNightDebug.getArpgState());
    assert.ok(accepted.resource<before.resource,'Accepted input spends actual resource');
    const skillId=before.skills[slot].id;
    const castId=await page.evaluate(id=>window.__zombieNightDebug.getSkillEvents().findLast(e=>e.skillId===id&&e.phase==='cast').castId,skillId);
    await page.waitForFunction(id=>window.__zombieNightDebug.getSkillEvents().some(e=>e.castId===id&&e.phase==='release'),castId,{timeout:4000});
    if(slot===0)await page.keyboard.up('a');
    for(const key of approach)await page.keyboard.up(key);
    if(character==='dwarf'){
     await page.waitForFunction(id=>window.__zombieNightDebug.getClassSkillVfxStats().bodies.active>0||window.__vfxEvidence.events.size&&[...window.__vfxEvidence.events.values()].some(e=>e.castId===id&&e.phase==='impact'),castId,{timeout:2500});
     item.flightObservation??=[];
     item.flightObservation.push(await page.evaluate(id=>({castId:id,body:window.__zombieNightDebug.getClassSkillVfxStats().bodies.active,impactAlreadyObserved:[...window.__vfxEvidence.events.values()].some(e=>e.castId===id&&e.phase==='impact')}),castId));
     await telemetry.capture(`slot${slot+1}-flight`);
     await page.waitForFunction(id=>[...window.__vfxEvidence.events.values()].some(e=>e.castId===id&&e.phase==='impact'),castId,{timeout:4000});
     await telemetry.capture(`slot${slot+1}-impact`);
    }else {await telemetry.capture(`slot${slot+1}-release`);await telemetry.capture(`slot${slot+1}-execution`);}
    await page.waitForTimeout(250);
    const after=await page.evaluate(()=>({hud:window.__zombieNightDebug.getArpgState(),vfx:window.__zombieNightDebug.getClassSkillVfxStats(),state:window.__zombieNightDebug.getState()}));
    assert.equal(after.vfx.events[skillId].cast,1);assert.equal(after.vfx.events[skillId].release,1);
    item.casts.push({slot,skillId,castId,before,accepted,after});
    for(const key of aim)await page.keyboard.up(key);
   }
   await page.waitForTimeout(1300);await telemetry.capture('persistent-states');
   item.timeline=await page.evaluate(()=>{const o=window.__vfxEvidence;o.active=false;return {frames:o.frames,events:[...o.events.values()]};});
   item.final=await page.evaluate(()=>({vfx:window.__zombieNightDebug.getClassSkillVfxStats(),state:window.__zombieNightDebug.getState(),presentation:window.__zombieNightDebug.getPresentationStats()}));
   assert.equal(item.final.vfx.version,2);assert.equal(item.final.vfx.quality,quality);assert.equal(item.final.vfx.reducedMotion,reduced);assert.equal(item.final.vfx.rejected,0);
   assert.equal(new Set(item.casts.map(c=>c.skillId)).size,3);telemetry.assertClean();item.passed=true;
  }catch(error){item.failure=error.stack;telemetry.fail(error);process.exitCode=1;}
  finally{
   await page.evaluate(()=>{if(window.__vfxEvidence)window.__vfxEvidence.active=false;}).catch(()=>{});
   await telemetry.save({measurements:item});item.sourceChanged=telemetry.report.sourceChangedDuringRun;
   const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidenceDir,`${name}.webm`));results.push(item);
  }
 }
}finally{
 await browser?.close();await server?.stop();process.chdir(root);await release();
 const hashes={};for(const name of await fs.readdir(evidenceDir))if(/\.(png|webm)$/.test(name))hashes[name]=sha256(await fs.readFile(path.join(evidenceDir,name)));
 const passed=results.length===3&&results.every(r=>r.passed&&!r.sourceChanged);if(!passed)process.exitCode=1;
 const currentCheckoutStillMatches=JSON.stringify(capturedSources)===JSON.stringify(sourceFingerprint());
 await fs.writeFile(path.join(evidenceDir,'class-skill-vfx-gameplay.json'),JSON.stringify({passed,currentCheckoutStillMatches,snapshot,capturedSources,results,hashes,scope:'Stable runtime snapshot; input-only short offline gameplay. Not a natural60s, multiplayer, mobile or perceptual AAA gate.'},null,2)+'\n');
 console.log(JSON.stringify({passed,evidenceDir,results:results.map(({character,quality,reduced,passed,sourceChanged,failure})=>({character,quality,reduced,passed,sourceChanged,failure}))}));
}
