// Reuses existing asset snapshot, browser telemetry, isolated server and atomic GPU reservation.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,evidenceDir,sourceFingerprint} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const release=await gpuReservation(),root=process.cwd();let browser,server,context,telemetry;
const directory='assets/vfx/source-history/cannon-volumetric-staging-20260919';
const files=(await fs.readdir(directory)).filter(n=>n.endsWith('.js')).map(n=>`${directory}/${n}`);
const report={scope:'Isolated cannon A/B with actual Lyra/zombie/cemetery assets and gameplay base camera; real cinematic HDR+bloom and shared packed depth/cutaway. Controlled cast/release .30s, travel 22m/s, impact radius3.4; no actual gameplay or promotion.',promoted:false,captures:[],playback:[]};
try{
 report.applicationSources=sourceFingerprint();report.stagingSources=Object.fromEntries(await Promise.all([...files,'tools/cannon-vfx-prototype.html','tools/cannon-vfx-prototype.mjs'].map(async f=>[f,sha256(await fs.readFile(f))])));
 report.snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-cannon-vfx-'));
 for(const f of Object.keys(report.applicationSources)){const out=path.join(report.snapshot,f);await fs.mkdir(path.dirname(out),{recursive:true});await fs.copyFile(f,out);}
 assert.deepEqual(sourceFingerprint(),report.applicationSources,'Application changed during copy');await fs.mkdir(path.join(report.snapshot,'src/cannon-staging'),{recursive:true});for(const f of files)await fs.copyFile(f,path.join(report.snapshot,'src/cannon-staging',path.basename(f)));await fs.copyFile('tools/cannon-vfx-prototype.html',path.join(report.snapshot,'src/cannon-vfx-prototype.html'));
 process.chdir(report.snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});context=await browser.newContext({viewport:{width:2560,height:720},recordVideo:{dir:evidenceDir,size:{width:2560,height:720}}});const page=await context.newPage();telemetry=attachQualityTelemetry(page,'cannon-vfx-prototype');telemetry.markFixture();
 await page.goto(server.origin+'/src/cannon-vfx-prototype.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.cannonVfxPrototype?.ready,null,{timeout:60000});
 for(const [quality,reduced]of [['high',false],['low',true]]){
  for(const time of [.18,.33,.52,.74,.86,1.25,1.8,2.7,3.1]){
   const data=await page.evaluate(({time,quality,reduced})=>{const f=window.cannonVfxPrototype;return {stats:f.sample(time,quality,reduced),occlusion:f.audit()};},{time,quality,reduced});
   assert.equal(data.stats.glError,0);assert.equal(data.stats.pipeline.hdr,true);assert.equal(data.stats.pipeline.bloom,quality==='high');for(const c of data.stats.candidate.casts)assert.equal(c.radius,3.4);
   if(time===.52)assert.ok(data.stats.candidate.casts.some(c=>c.body&&c.flight.visible),'Controller owns actual fire body/volume');
   if(time>3){assert.equal(data.stats.candidate.casts.length,0);assert.equal(data.stats.pipeline.depth.passes,0);}
   const file=await telemetry.capture(`${quality}${reduced?'-reduced':''}-${time}`);report.captures.push({file,sha256:sha256(await fs.readFile(path.join(evidenceDir,file))),...data});console.log(JSON.stringify({quality,time,occlusion:data.occlusion,draws:data.stats.candidate.drawCalls}));
   assert.ok(data.occlusion.every(o=>o.preservedFraction===null||o.preservedFraction>=.65),'Cannon covers sampled real actor torso');
  }
  const samples=await page.evaluate(async({quality,reduced})=>{const f=window.cannonVfxPrototype;f.play(quality,reduced);const samples=[];await new Promise(resolve=>{function tick(){const s=f.stats();samples.push({time:s.time,candidate:s.candidate,pipeline:s.pipeline});if(s.time<3.1)requestAnimationFrame(tick);else{f.stop();resolve();}}requestAnimationFrame(tick);});return samples;},{quality,reduced});report.playback.push({quality,reduced,samples});
 }
 report.multiple=await page.evaluate(()=>{const f=window.cannonVfxPrototype;return {stats:f.bursts(4),occlusion:f.audit()};});report.multiple.file=await telemetry.capture('four-bursts');assert.equal(report.multiple.stats.pipeline.depth.passes,1);assert.equal(report.multiple.stats.candidate.casts.length,4);assert.ok(report.multiple.occlusion.every(o=>o.preservedFraction===null||o.preservedFraction>=.65),'Overlapping bursts obscure torso');
 report.lifecycle=await page.evaluate(()=>window.cannonVfxPrototype.lifecycle());assert.deepEqual(report.lifecycle.before,report.lifecycle.paused,'Pause changes cannon');assert.deepEqual(report.lifecycle.memory,report.lifecycle.afterMemory,'Repeated casts leak GPU resources');assert.equal(report.lifecycle.reset.candidate.drawCalls,0);assert.equal(report.lifecycle.expiry.candidate.drawCalls,0);
 report.cost=await page.evaluate(()=>window.cannonVfxPrototype.measureCost());report.disposal=await page.evaluate(()=>window.cannonVfxPrototype.dispose());telemetry.assertClean();report.passed=true;
 const video=page.video();await telemetry.save({measurements:report});await context.close();context=null;if(video)await video.saveAs(path.join(evidenceDir,'cannon-volumetric-ab-playback.webm'));
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;telemetry?.fail(error);await telemetry?.save({measurements:report}).catch(()=>{});}
finally{
 await context?.close();await browser?.close();await server?.stop();process.chdir(root);await release();report.currentApplicationStillMatches=JSON.stringify(report.applicationSources)===JSON.stringify(sourceFingerprint());const stagingNow=Object.fromEntries(await Promise.all(Object.keys(report.stagingSources??{}).map(async f=>[f,sha256(await fs.readFile(f))])));report.stagingStillMatches=JSON.stringify(report.stagingSources)===JSON.stringify(stagingNow);
 report.hashes=Object.fromEntries(await Promise.all((await fs.readdir(evidenceDir)).filter(n=>/\.(png|webm)$/.test(n)).map(async n=>[n,sha256(await fs.readFile(path.join(evidenceDir,n)))])));await fs.writeFile(path.join(evidenceDir,'cannon-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,evidenceDir,captures:report.captures.length,currentApplicationStillMatches:report.currentApplicationStillMatches,stagingStillMatches:report.stagingStillMatches,failure:report.failure}));
}
