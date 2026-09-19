import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,browserLaunchOptions,attachQualityTelemetry,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const root=path.resolve(process.argv[2]),lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
fs.mkdirSync(lock);fs.writeFileSync(`${lock}/owner.json`,JSON.stringify({owner:'environment-depth-cutaway-qa',pid:process.pid,token,created:new Date().toISOString()}));
let browser,server;
try{
 fs.copyFileSync(new URL('./environment-depth-cutaway-preview.html',import.meta.url),path.join(root,'src/environment-depth-cutaway-preview.html'));
 process.chdir(root);server=await localServer();browser=await chromium.launch(browserLaunchOptions);
 const page=await browser.newPage({viewport:{width:1920,height:720}}),telemetry=attachQualityTelemetry(page,'environment-depth-cutaway');telemetry.markFixture();const report={baseline:[],candidate:[]};
 try{
  for(const legacy of [true,false]){
   await page.goto(`${server.origin}/src/environment-depth-cutaway-preview.html${legacy?'?legacyColor=1':''}`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.environmentDepthReview?.ready,null,{timeout:60000});
   for(const kind of ['canopy','wall','actor']){
    const result=await page.evaluate(kind=>window.environmentDepthReview.sample(kind),kind);report[legacy?'baseline':'candidate'].push(result);
    assert.equal(result.glError,0);assert.equal(result.worldFocus,1);
    if(!legacy){
     const old=report.baseline.find(x=>x.kind===kind);assert.equal(result.colorWithoutEffectHash,old.colorWithoutEffectHash,`${kind}: isolated extraction changed color pass`);
     if(kind!=='actor'){assert(result.depthDiff.changed>100,`${kind}: no depth occlusion discrepancy reproduced`);assert(result.fieldROI.changed>50,`${kind}: nebula did not respond inside field region`);}
     else {assert.equal(result.actor.depth.changed,0,'Opaque actor depth changed');assert.equal(result.depthDiff.changed,0,'Unmarked control depth changed');assert(result.actor.torsoPreservedFraction>=.75,'Opaque actor torso occluded by background gas');}
     await telemetry.capture(kind);
    }
   }
   await page.evaluate(()=>window.environmentDepthReview.dispose());
  }
  telemetry.assertClean();
 }catch(error){telemetry.fail(error);process.exitCode=1;}finally{await telemetry.save({measurements:report,scope:'Synthetic native A/B on isolated candidate and original Horizon prototype, fixed camera/time. Color pass hash equality; before/after RGBA depth sharing only cutaway; opaque skinned actor control. No gameplay claim.'})}
 console.log(JSON.stringify({assertions:telemetry.report.assertions,failure:telemetry.report.failure,sourceChanged:telemetry.report.sourceChangedDuringRun,evidenceDir}));
}finally{await browser?.close();await server?.stop();if(fs.existsSync(`${lock}/owner.json`)&&JSON.parse(fs.readFileSync(`${lock}/owner.json`)).token===token)fs.rmSync(lock,{recursive:true})}
