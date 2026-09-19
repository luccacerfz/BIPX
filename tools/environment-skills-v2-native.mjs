import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,browserLaunchOptions,attachQualityTelemetry,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const actual=process.env.ENV_ACTUAL_VFX==='1';
const root=path.resolve(process.argv[2]),lock='/tmp/bipx-arpg-gpu.lock';
fs.mkdirSync(lock);fs.writeFileSync(`${lock}/owner.json`,JSON.stringify({owner:'environment-skills-v2-fixture',pid:process.pid}));
let browser,server;
try{
 fs.copyFileSync(new URL('./environment-skills-v2-preview.html',import.meta.url),path.join(root,'src/environment-skills-v2-preview.html'));
 process.chdir(root);server=await localServer();browser=await chromium.launch(browserLaunchOptions);
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const telemetry=attachQualityTelemetry(page,'environment-skills-v2');telemetry.markFixture();
 const results=[];
 try{
  for(const before of [true,false]){
   await page.goto(`${server.origin}/src/environment-skills-v2-preview.html?${before?'before=1&':''}${actual?'actual=1':''}`);
   await page.waitForFunction(()=>window.environmentSkillReview?.ready,null,{timeout:60000});
   for(const [quality,reducedMotion] of (actual?[['high',false],['low',false],['low',true]]:[['high',false]]))for(const skillId of ['dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot']){
    const sample=await page.evaluate(options=>window.environmentSkillReview.render(options),{skillId,quality,reducedMotion});
    results.push({before,skillId,quality,reducedMotion,...sample});
    if(actual){assert.equal(sample.vfx.version,2);assert.equal(sample.vfx.rejected,0);if(skillId==='dwarf_gravity_shot')assert.equal(sample.vfx.states.fields,1);}
    if(!before)assert.equal(sample.stats.skillAreaFocusCount,1,'Horde starved active skill area focus');
    await telemetry.capture(`${before?'before':'after'}-${skillId}-${quality}${reducedMotion?'-reduced':''}`);
   }
   const origin=await page.evaluate(()=>window.environmentSkillReview.render({origin:true}));
   if(!before)assert.equal(origin.stats.portalTintScale,.28,'Decorative portal did not yield to real active area');
   await telemetry.capture(`${before?'before':'after'}-portal-overlap`);
  }
  for(const state of [{remaining:0},{active:false},{paused:true}]){
   const sample=await page.evaluate(state=>window.environmentSkillReview.render(state),state);
   assert.equal(sample.stats.skillAreaFocusCount,0);assert.equal(sample.stats.portalTintScale,1);
  }
  telemetry.report.measurements=results;
  telemetry.report.scope=actual?'Synthetic fixture using actual v2 VFX wrapper and unchanged cemetery, in high/low/reduced. Controlled states are NOT real input, damage/status/authority or gameplay proof.':'Synthetic colored floor-area proxies behind foliage, with 20 threat inputs. Validates Environment shader/occlusion/reset only. Not final VFX, skill simulation, runtime input, or gameplay acceptance.';
  telemetry.assertClean();
 }catch(e){telemetry.fail(e);process.exitCode=1}finally{await telemetry.save()}
 console.log(JSON.stringify({assertions:telemetry.report.assertions,sourceChanged:telemetry.report.sourceChangedDuringRun,error:telemetry.report.failure,evidenceDir}));
}finally{await browser?.close();await server?.stop();if(JSON.parse(fs.readFileSync(`${lock}/owner.json`)).pid===process.pid)fs.rmSync(lock,{recursive:true})}
