// Reuses the existing browser telemetry, isolated server and atomic GPU lease.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,evidenceDir,sourceFingerprint} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const release=await gpuReservation(),root=process.cwd();let browser,server,telemetry,context;
const prototypeDirectory='assets/vfx/source-history/gravity-runtime-before-horizon-20260919';
const prototypeFiles=(await fs.readdir(prototypeDirectory)).filter(f=>/\.(js|json|txt)$/.test(f)).map(f=>`${prototypeDirectory}/${f}`);
const report={scope:'Isolated A/B with actual Lyra/zombie/cemetery assets and base gameplay camera. Controlled field; actual unmodified cinematic HDR+bloom pipeline, integrated shared RGBA depth prepass with Environment cutaway adapter, one renderer with two canvas2D presentation copies; not gameplay or promotion.',promoted:false,captures:[],playback:[]};
try{
 report.applicationSources=sourceFingerprint();report.fixtureSources=Object.fromEntries(await Promise.all([...prototypeFiles,'tools/gravity-vfx-integration.html','tools/gravity-vfx-integration.mjs'].map(async f=>[f,sha256(await fs.readFile(f))])));
 report.snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-gravity-prototype-'));
 for(const f of Object.keys(report.applicationSources)){const out=path.join(report.snapshot,f);await fs.mkdir(path.dirname(out),{recursive:true});await fs.copyFile(f,out);}
 assert.deepEqual(sourceFingerprint(),report.applicationSources,'Application changed during copy');
 await fs.mkdir(path.join(report.snapshot,'src/vfx-before'),{recursive:true});
 for(const file of prototypeFiles)await fs.copyFile(file,path.join(report.snapshot,'src/vfx-before',path.basename(file)));
 await fs.copyFile('tools/gravity-vfx-integration.html',path.join(report.snapshot,'src/gravity-vfx-integration.html'));
 process.chdir(report.snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
 context=await browser.newContext({viewport:{width:2560,height:720},recordVideo:{dir:evidenceDir,size:{width:2560,height:720}}});const page=await context.newPage();telemetry=attachQualityTelemetry(page,'gravity-vfx-integration');telemetry.markFixture();
 await page.goto(server.origin+'/src/gravity-vfx-integration.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.gravityVfxPrototype?.ready,null,{timeout:60000});
 for(const [quality,reduced]of [['high',false],['low',true]]){
  for(const time of [.35,1.8,3.6,4.8,5.3]){
   const data=await page.evaluate(({time,quality,reduced})=>{const f=window.gravityVfxPrototype;return {stats:f.sample(time,quality,reduced),occlusion:f.audit()};},{time,quality,reduced});
   assert.equal(data.stats.glError,0);assert.equal(data.stats.pipeline.hdr,true);assert.equal(data.stats.pipeline.bloom,quality==='high');assert.equal(data.stats.prototype.reduced,reduced);for(const f of data.stats.prototype.fields){assert.equal(f.radius,5);assert.equal(f.duration,5);assert.equal(f.depthReady,true);}
   if(time>5)assert.equal(data.stats.prototype.drawCalls,0);
   console.log(JSON.stringify({quality,time,occlusion:data.occlusion,prototype:data.stats.prototype.fields[0]?.coreRadius}));
   const file=await telemetry.capture(`${quality}${reduced?'-reduced':''}-${time}`);report.captures.push({file,sha256:sha256(await fs.readFile(path.join(evidenceDir,file))),...data});
   assert.ok(data.occlusion.every(x=>x.preservedFraction===null||x.preservedFraction>=.65),'Prototype covers real actor torso');
  }
  const playback=await page.evaluate(async({quality,reduced})=>{const f=window.gravityVfxPrototype;f.play(quality,reduced);const samples=[];await new Promise(resolve=>{function tick(){const s=f.stats();samples.push({time:s.time,prototype:s.prototype});if(s.time<5.3)requestAnimationFrame(tick);else{f.stop();resolve();}}requestAnimationFrame(tick);});return samples;},{quality,reduced});
  const pairs=playback.slice(1).flatMap((s,i)=>(s.prototype.fields[0]?.debris??[]).map((p,j)=>({before:playback[i].prototype.fields[0]?.debris[j],after:p}))).filter(p=>p.before&&p.after.phase>=p.before.phase);
  assert.ok(pairs.length>100);assert.ok(pairs.every(p=>reduced?Math.abs(p.after.radius-p.before.radius)<1e-7:p.after.radius<=p.before.radius+1e-7),'Debris must converge, except the explicit outer respawn');
  report.playback.push({quality,reduced,samples:playback,nonWrappedPairs:pairs.length});
 }
 report.multiple=[];
 for(const count of [0,4,8,10]){const data=await page.evaluate(count=>{const f=window.gravityVfxPrototype;return {stats:f.sample(1.8,'high',false,count),occlusion:f.audit()};},count);assert.equal(data.stats.prototype.activeSlots,Math.min(count,8));assert.equal(data.stats.pipeline.depth.passes,count?1:0);assert.equal(data.stats.prototype.overflow,Math.max(0,count-8));const file=await telemetry.capture(`fields-${count}`);report.multiple.push({file,...data});assert.ok(data.occlusion.every(x=>x.preservedFraction===null||x.preservedFraction>=.65),`Multiple fields ${count} cover actor torso`);}
 const offscreen=await page.evaluate(()=>window.gravityVfxPrototype.sample(1.8,'high',false,8,true));assert.equal(offscreen.pipeline.depth.passes,0);assert.equal(offscreen.prototype.drawCalls,0);report.offscreen=offscreen;
 report.occluders=[];
 for(const name of ['tree','ruin']){const data=await page.evaluate(name=>window.gravityVfxPrototype.scenario(name),name);assert.ok(data.occluder,`No actual ${name} selected`);assert.ok(data.stats.pipeline.depth.adapted>0,'Cutaway adapter not active');const file=await telemetry.capture(`cutaway-${name}`);report.occluders.push({file,...data});}
 report.lifecycle=await page.evaluate(()=>window.gravityVfxPrototype.lifecycle());
 assert.deepEqual(report.lifecycle.before,report.lifecycle.pause,'Pause changes VFX state');assert.equal(report.lifecycle.cameraAway.pipeline.depth.passes,0);assert.equal(report.lifecycle.cameraBack.prototype.activeSlots,4);assert.equal(report.lifecycle.cameraBack.prototype.drawCalls,16);assert.deepEqual(report.lifecycle.memory,report.lifecycle.afterMemory,'Resources grow with repeated casts');assert.equal(report.lifecycle.reset.vfx.states.gravity.drawCalls,0);assert.equal(report.lifecycle.reset.pipeline.depth.passes,0);assert.equal(report.lifecycle.expiry.prototype.drawCalls,0);assert.equal(report.lifecycle.expiry.pipeline.depth.passes,0);
 report.cost=await page.evaluate(()=>window.gravityVfxPrototype.measureCost());
 report.disposal=await page.evaluate(()=>window.gravityVfxPrototype.dispose());telemetry.assertClean();report.passed=true;
 const video=page.video();await telemetry.save({measurements:report});await context.close();context=null;if(video)await video.saveAs(path.join(evidenceDir,'gravity-integrated-ab-playback.webm'));
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;telemetry?.fail(error);await telemetry?.save({measurements:report}).catch(()=>{});}
finally{
 await context?.close();await browser?.close();await server?.stop();process.chdir(root);await release();
 report.currentApplicationStillMatches=JSON.stringify(report.applicationSources)===JSON.stringify(sourceFingerprint());
 report.hashes=Object.fromEntries(await Promise.all((await fs.readdir(evidenceDir)).filter(n=>/\.(png|webm)$/.test(n)).map(async n=>[n,sha256(await fs.readFile(path.join(evidenceDir,n)))])));
 await fs.writeFile(path.join(evidenceDir,'integration-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,evidenceDir,captures:report.captures.length,currentApplicationStillMatches:report.currentApplicationStillMatches,failure:report.failure}));
}
