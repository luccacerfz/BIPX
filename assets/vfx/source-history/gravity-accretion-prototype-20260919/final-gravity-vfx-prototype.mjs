// Reuses the existing browser telemetry, isolated server and atomic GPU lease.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,evidenceDir,sourceFingerprint} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const release=await gpuReservation(),root=process.cwd();let browser,server,telemetry,context;
const prototype='assets/vfx/source-history/gravity-accretion-prototype-20260919/gravity-accretion.js';
const report={scope:'Isolated A/B with actual Lyra/zombie/cemetery assets and base gameplay camera. Controlled field; not gameplay or promotion.',promoted:false,captures:[],playback:[]};
try{
 report.applicationSources=sourceFingerprint();report.fixtureSources=Object.fromEntries(await Promise.all([prototype,'tools/gravity-vfx-prototype.html','tools/gravity-vfx-prototype.mjs'].map(async f=>[f,sha256(await fs.readFile(f))])));
 report.snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-gravity-prototype-'));
 for(const f of Object.keys(report.applicationSources)){const out=path.join(report.snapshot,f);await fs.mkdir(path.dirname(out),{recursive:true});await fs.copyFile(f,out);}
 assert.deepEqual(sourceFingerprint(),report.applicationSources,'Application changed during copy');
 await fs.mkdir(path.join(report.snapshot,'src/vfx-prototype'),{recursive:true});
 await fs.copyFile(prototype,path.join(report.snapshot,'src/vfx-prototype/gravity-accretion.js'));
 await fs.copyFile('tools/gravity-vfx-prototype.html',path.join(report.snapshot,'src/gravity-vfx-prototype.html'));
 process.chdir(report.snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
 context=await browser.newContext({viewport:{width:1600,height:900},recordVideo:{dir:evidenceDir,size:{width:1600,height:900}}});const page=await context.newPage();telemetry=attachQualityTelemetry(page,'gravity-vfx-prototype');telemetry.markFixture();
 await page.goto(server.origin+'/src/gravity-vfx-prototype.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.gravityVfxPrototype?.ready,null,{timeout:60000});
 for(const [quality,reduced]of [['high',false],['low',true]]){
  for(const time of [.35,1.8,3.6,4.8,5.3]){
   const data=await page.evaluate(({time,quality,reduced})=>{const f=window.gravityVfxPrototype;return {stats:f.sample(time,quality,reduced),occlusion:f.audit()};},{time,quality,reduced});
   assert.equal(data.stats.glError,0);assert.equal(data.stats.prototype.radius,5);assert.equal(data.stats.prototype.duration,5);assert.equal(data.stats.prototype.reduced,reduced);
   assert.ok(data.occlusion.every(x=>x.preservedFraction===null||x.preservedFraction>=.65),'Prototype covers real actor torso');
   if(time>5)assert.equal(data.stats.prototype.drawCalls,0);
   const file=await telemetry.capture(`${quality}${reduced?'-reduced':''}-${time}`);report.captures.push({file,sha256:sha256(await fs.readFile(path.join(evidenceDir,file))),...data});
  }
  const playback=await page.evaluate(async({quality,reduced})=>{const f=window.gravityVfxPrototype;f.play(quality,reduced);const samples=[];await new Promise(resolve=>{function tick(){const s=f.stats();samples.push({time:s.time,prototype:s.prototype});if(s.time<5.3)requestAnimationFrame(tick);else{f.stop();resolve();}}requestAnimationFrame(tick);});return samples;},{quality,reduced});
  const pairs=playback.slice(1).flatMap((s,i)=>s.prototype.debris.map((p,j)=>({before:playback[i].prototype.debris[j],after:p}))).filter(p=>p.after.phase>=p.before.phase);
  assert.ok(pairs.length>100);assert.ok(pairs.every(p=>reduced?Math.abs(p.after.radius-p.before.radius)<1e-7:p.after.radius<=p.before.radius+1e-7),'Debris must converge, except the explicit outer respawn');
  report.playback.push({quality,reduced,samples:playback,nonWrappedPairs:pairs.length});
 }
 report.disposal=await page.evaluate(()=>window.gravityVfxPrototype.dispose());telemetry.assertClean();report.passed=true;
 const video=page.video();await telemetry.save({measurements:report});await context.close();context=null;if(video)await video.saveAs(path.join(evidenceDir,'gravity-ab-playback.webm'));
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;telemetry?.fail(error);await telemetry?.save({measurements:report}).catch(()=>{});}
finally{
 await context?.close();await browser?.close();await server?.stop();process.chdir(root);await release();
 report.currentApplicationStillMatches=JSON.stringify(report.applicationSources)===JSON.stringify(sourceFingerprint());
 report.hashes=Object.fromEntries(await Promise.all((await fs.readdir(evidenceDir)).filter(n=>/\.(png|webm)$/.test(n)).map(async n=>[n,sha256(await fs.readFile(path.join(evidenceDir,n)))])));
 await fs.writeFile(path.join(evidenceDir,'prototype-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,evidenceDir,captures:report.captures.length,currentApplicationStillMatches:report.currentApplicationStillMatches,failure:report.failure}));
}
