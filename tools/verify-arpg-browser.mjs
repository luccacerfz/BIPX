import { acquireGpuLock } from './quality-gpu-lock.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { getClassSkills } from '../src/combat/class-skills.mjs';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
const gpu=await acquireGpuLock({owner:'combat'}); // shared reservation: waits (2 s retries, 25 min) or inherits the runner's lease
let server,browser;const results=[];
try {
 server=await localServer();
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 for(const character of ['warrior','dwarf']) for(const moving of [false,true]) {
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
  await context.addInitScript(c=>localStorage.setItem('bipx-character',c),character);
  const page=await context.newPage(),telemetry=attachQualityTelemetry(page,`arpg-${character}-${moving?'moving':'standing'}`);
  telemetry.report.browserLaunch={channel:'chrome',headless:false};
  const item={character,moving,passed:false,input:'Actual menu/pointer/keyboard, no spawned targets or modified game state',casts:[]};
  try {
   await page.goto(server.origin+'/?offline=1&quality=high',{waitUntil:'domcontentloaded'});
   await waitForRuntimeAssets(page,telemetry);
   await page.locator('#open-login-button').click();
   await page.locator(`label[for="character-${character}"]`).click();
   await waitForRuntimeAssets(page,telemetry);
   await page.locator('#player-name').fill(`ARPG ${character}`);
   await page.locator('#play-button').click();
   await page.waitForFunction(()=>window.__zombieNightDebug?.getState().state==='playing');
   await page.locator('#game-canvas').focus();
   await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');
   for(let slot=0;slot<3;slot++) {
    await page.waitForFunction(slot=>document.querySelector(`[data-arpg-slot="${slot}"]`)?.dataset.state==='ready',slot);
    await page.keyboard.down('i');await page.waitForTimeout(60);
    if (moving) await page.keyboard.down('d');
    const before=await page.evaluate(()=>window.__zombieNightDebug.getArpgState());
    await page.keyboard.press(String(slot+1));await page.keyboard.up('i');
    await page.waitForFunction(slot=>window.__zombieNightDebug.getArpgState().skills[slot].cooldownRemaining>0,slot);
    const def=getClassSkills(character)[slot];
    const receipt=await page.evaluate(id=>window.__zombieNightDebug.getSkillEvents().filter(e=>e.phase==='cast'&&e.skillId===id).at(-1),def.id);
    assert.ok(receipt);const castId=receipt.castId;
    await page.waitForTimeout(60);await telemetry.capture(`${moving?'moving':'standing'}-${slot+1}-preparation`);
    await page.waitForFunction(id=>window.__zombieNightDebug.getSkillEvents().some(e=>e.castId===id&&e.phase==='release'),castId);
    await telemetry.capture(`${moving?'moving':'standing'}-${slot+1}-release`);
    await page.waitForTimeout(def.shape==='dash'?150:450);await telemetry.capture(`${moving?'moving':'standing'}-${slot+1}-active`);
    if (moving) await page.keyboard.up('d');
    const after=await page.evaluate(()=>({hud:window.__zombieNightDebug.getArpgState(),events:window.__zombieNightDebug.getSkillEvents(),vfx:window.__zombieNightDebug.getClassSkillVfxStats()}));
    assert.ok(after.hud.skills[slot].cooldownRemaining>0, 'Confirmed cast did not start cooldown');
    assert.ok(after.hud.resource<before.resource+1, 'Cast did not consume class resource');
    assert.equal(receipt.skillId,before.skills[slot].id);
    item.casts.push({moving,slot,castId,receipt,...after});
   }
   await page.keyboard.up('i');
   const events=await page.evaluate(()=>window.__zombieNightDebug.getSkillEvents());
   assert.equal(new Set(item.casts.map(sample=>sample.castId)).size,3);
   item.final=await page.evaluate(()=>({state:window.__zombieNightDebug.getState(),hud:window.__zombieNightDebug.getArpgState(),presentation:window.__zombieNightDebug.getPresentationStats()}));
   assert.equal(item.final.state.weapon,character==='warrior'?'katana':'pistol');
   telemetry.assertClean();item.passed=true;
  }catch(error){item.failure=error.stack;telemetry.fail(error);process.exitCode=1;}
  finally{await telemetry.save({measurements:item});item.sourceChanged=telemetry.report.sourceChangedDuringRun;const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidenceDir,`arpg-${character}-${moving?'moving':'standing'}.webm`));results.push(item);}
 }
}finally{
 await browser?.close();await server?.stop();
 gpu.release();
 fs.writeFileSync(path.join(evidenceDir,'arpg-browser.json'),JSON.stringify({passed:results.length===4&&results.every(r=>r.passed&&!r.sourceChanged),results},null,2));
 console.log(JSON.stringify({evidenceDir,results:results.map(({character,passed,failure,sourceChanged})=>({character,passed,failure,sourceChanged}))}));
}
