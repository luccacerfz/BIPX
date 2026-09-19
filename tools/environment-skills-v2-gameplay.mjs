// Real input/read-only debug observations; no entity placement or granted resources.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,browserLaunchOptions,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const root=path.resolve(process.argv[2]);
assert(fs.readFileSync(path.join(root,'src/combat/class-skills.mjs'),'utf8').includes('warrior_war_cry'),'Snapshot core is not migrated to v2');
const lock='/tmp/bipx-arpg-gpu.lock';fs.mkdirSync(lock);fs.writeFileSync(`${lock}/owner.json`,JSON.stringify({owner:'environment-v2-real-gameplay',pid:process.pid}));
let server,browser;
try{
 process.chdir(root);server=await localServer();browser=await chromium.launch(browserLaunchOptions);
 for(const character of ['warrior','dwarf']){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
  const page=await context.newPage(),telemetry=attachQualityTelemetry(page,`environment-v2-${character}`);
  const report={character,scope:'Actual input in a frozen integrated runtime copy. No gameplay injection; debug API read-only. Environment paths/visibility scope, not complete six-skill authority/animation acceptance.',casts:[]};
  const snapshot=()=>page.evaluate(()=>({state:window.__zombieNightDebug.getState(),hud:window.__zombieNightDebug.getArpgState(),events:window.__zombieNightDebug.getSkillEvents(),vfx:window.__zombieNightDebug.getClassSkillVfxStats(),presentation:window.__zombieNightDebug.getPresentationStats()}));
  try{
   await page.goto(`${server.origin}/?offline=1&quality=high`,{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
   await page.locator('#open-login-button').click();await page.locator(`label[for="character-${character}"]`).click();await waitForRuntimeAssets(page,telemetry);
   await page.locator('#player-name').fill(`Environment v2 ${character}`);await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
   await page.locator('#game-canvas').focus();await page.mouse.move(1050,420);await page.mouse.down();
   await page.keyboard.down('a');await page.waitForTimeout(600);await page.keyboard.up('a');
   await page.waitForTimeout(4500);
   for(let slot=0;slot<3;slot++){
    const upgrades=page.locator('#upgrade-panel:not(.hidden) button').first();if(await upgrades.isVisible().catch(()=>false))await upgrades.click();
    await page.waitForFunction(slot=>window.__zombieNightDebug.getArpgState().skills[slot].enabled,slot,{timeout:20000});
    await page.locator('#game-canvas').focus();
    const before=await snapshot(),skillId=before.hud.skills[slot].id;
    assert.equal(skillId,({warrior:['warrior_war_cry','warrior_cleaving_dash','warrior_shield_charge'],dwarf:['dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot']})[character][slot]);
    if(slot===1)await page.keyboard.down('a');
    await page.keyboard.press(String(slot+1));
    await page.waitForFunction(slot=>window.__zombieNightDebug.getArpgState().skills[slot].cooldownRemaining>0,slot);
    await page.waitForTimeout(180);const prepare=await snapshot();await telemetry.capture(`${skillId}-prepare-release`);
    if(slot===1)await page.keyboard.up('a');
    await page.waitForTimeout(650);const contact=await snapshot();await telemetry.capture(`${skillId}-travel-contact`);
    await page.waitForTimeout(1200);const after=await snapshot();await telemetry.capture(`${skillId}-aftermath`);
    assert([...prepare.events,...contact.events,...after.events].some(e=>e.phase==='cast'&&e.skillId===skillId),'No accepted v2 cast');
    assert.equal(after.vfx.version,2);assert.equal(after.presentation.assets.errors.length,0);
    report.casts.push({skillId,before,prepare,contact,after});
   }
   await page.mouse.up();
   if(character==='dwarf'){
    report.gravityFocus=await snapshot();
    assert(report.gravityFocus.vfx.states.fields>0,'No enduring VFX gravity field');
    assert(report.gravityFocus.presentation.assets.world.skillAreaFocusCount>0,'Active gravity field did not reach environment focus');
    for(const [quality,reducedMotion] of [['low',false],['low',true]]){
     await page.evaluate(({quality,reducedMotion})=>{window.__bipxPresentation.setQuality(quality);window.__bipxPresentation.setReducedMotion(reducedMotion)},{quality,reducedMotion});
     await page.waitForTimeout(80);await telemetry.capture(`gravity-${quality}${reducedMotion?'-reduced':''}`);
    }
   }
   report.final=await snapshot();telemetry.assertClean();
  }catch(error){telemetry.fail(error);process.exitCode=1}
  finally{await telemetry.save({measurements:report});await context.close()}
  console.log(JSON.stringify({character,assertions:telemetry.report.assertions,sourceChanged:telemetry.report.sourceChangedDuringRun,error:telemetry.report.failure,evidenceDir}));
 }
}finally{await browser?.close();await server?.stop();if(JSON.parse(fs.readFileSync(`${lock}/owner.json`)).pid===process.pid)fs.rmSync(lock,{recursive:true})}
