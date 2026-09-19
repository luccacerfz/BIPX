import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,evidenceDir,sourceFingerprint} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
const root=process.cwd(),report={scope:'Bounded synthetic integration fixture: real renderer, HDR pipeline, cemetery and animated assets. Controlled fields; not natural gameplay.',checks:[],captures:[]};
let browser,server,telemetry,context;
const check=(name,fn)=>{fn();report.checks.push(name);};
try{
 report.applicationSources=sourceFingerprint();report.snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-scene-depth-'));
 for(const f of Object.keys(report.applicationSources)){const out=path.join(report.snapshot,f);await fs.mkdir(path.dirname(out),{recursive:true});await fs.copyFile(f,out);}
 assert.deepEqual(sourceFingerprint(),report.applicationSources,'Application changed during copy');
 if(process.env.BIPX_DEPTH_ENVIRONMENT_CANDIDATE==='1'){
  report.environmentStagedOverride=true;
  for(const f of ['environment-cutaway.js','asset-dressing.js']) await fs.copyFile(path.join(root,'output/qa/environment-depth-cutaway-v1/candidate/src/render',f),path.join(report.snapshot,'src/render',f));
 }
 await fs.copyFile('tools/scene-depth-preview.html',path.join(report.snapshot,'src/scene-depth-preview.html'));
 process.chdir(report.snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:false,args:['--use-gl=angle','--use-angle=metal']});
 context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:evidenceDir,size:{width:1280,height:720}}});const page=await context.newPage();telemetry=attachQualityTelemetry(page,'scene-depth');telemetry.markFixture();
 await page.goto(server.origin+'/src/scene-depth-preview.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.sceneDepthFixture?.ready,null,{timeout:60000});
 report.lifecycle=await page.evaluate(()=>window.sceneDepthFixture.lifecycle());const life=report.lifecycle;
 check('Zero/offscreen fields skip depth and invalidate prior frame',()=>{assert.equal(life.initial.pipeline.depth.allocated,false);for(const s of [life.empty,life.offscreen]){assert.equal(s.pipeline.depth.passes,0);assert.equal(s.vfx.states.gravity.depthValid,false);assert.equal(s.vfx.states.gravity.visibleFields,0)}});
 check('One shared depth pass for 1/4/8 visible fields and bounded overflow',()=>{for(const [key,n]of [['one',1],['four',4],['eight',8],['overflow',8]]){const s=life[key];assert.equal(s.pipeline.depth.passes,1);assert.equal(s.vfx.states.gravity.visibleFields,n);assert.equal(s.vfx.states.gravity.depthValid,true);assert.equal(s.vfx.states.gravity.allocatedSlots,8);}assert.equal(life.overflow.vfx.states.gravity.overflow,2)});
 check('Repeated frames reuse depth allocations',()=>{assert.deepEqual(life.allocations.before,life.allocations.after);assert.equal(life.allocations.materialsBefore,life.allocations.materialsAfter)});
 check('Pause retains phase, expiry/reset stop depth',()=>{assert.equal(life.pause.before.vfx.time,life.pause.after.vfx.time);assert.deepEqual(life.pause.before.vfx.states.gravity.fields,life.pause.after.vfx.states.gravity.fields);for(const s of [life.reset,life.expired])assert.equal(s.pipeline.depth.passes,0)});
 check('Resize/reduced/near/far propagate same-frame depth contract',()=>{assert.deepEqual(life.depthContract,{encoding:'rgba-packed',width:640,height:360,near:.3,far:170,viewport:{x:0,y:0,width:640,height:360}});assert.equal(life.resize.vfx.states.gravity.depthValid,true);assert.equal(life.resize.vfx.reducedMotion,true);assert.equal(life.resize.pipeline.depth.adapted>0,true)});
 report.state=await page.evaluate(()=>window.sceneDepthFixture.auditState());
 check('Renderer and scene state survive render and injected exception',()=>{assert.deepEqual(report.state.before,report.state.after);assert.deepEqual(report.state.before,report.state.afterFailure);assert.equal(report.state.failure,'injected render failure');assert.equal(report.state.depthAfterFailure,false)});
 report.parity=await page.evaluate(()=>window.sceneDepthFixture.auditParity());
 check('Cutaway and clipping preserve exact color/depth pixels on instanced wall',()=>{assert.equal(report.parity.length,4);for(const c of report.parity){assert.equal(c.mismatch,0);assert.ok(c.visible>0);assert.ok(c.depthStats.adapted>0)}assert.ok(report.parity[2].visible<report.parity[0].visible)});
 for(const [count,quality,reduced,position,label]of [[1,'high',false,[0,0,-4],'one-high'],[4,'high',false,[0,0,-4],'four-high'],[8,'high',false,[0,0,-4],'eight-high'],[1,'low',true,[0,0,-4],'one-low-reduced'],[1,'high',false,[-8,0,-6],'tree-ruin-high']]){
  const stats=await page.evaluate(({count,quality,reduced,position})=>window.sceneDepthFixture.sample(count,quality,reduced,position),{count,quality,reduced,position});assert.equal(stats.glError,0);report.captures.push({file:await telemetry.capture(label),stats});
 }
 if(process.env.BIPX_DEPTH_SKIP_GPU_COST!=='1'){
  report.cost=await page.evaluate(()=>window.sceneDepthFixture.measureCost());
  check('Actual GPU timer returned non-disjoint samples',()=>{assert.equal(report.cost.available,true);for(const c of report.cost.cases){assert.equal(c.disjoint,0);assert.equal(c.gpuMs.samples,24)}});
 }
 report.disposal=await page.evaluate(()=>window.sceneDepthFixture.dispose());
 check('Idempotent disposal releases owned depth target and material cache',()=>{assert.equal(report.disposal.pipeline.depth.allocated,false);assert.equal(report.disposal.pipeline.depth.materials,0);assert.equal(report.disposal.vfx.states.gravity.disposed,true)});
 telemetry.assertClean();report.passed=true;const video=page.video();await telemetry.save({measurements:report});await context.close();context=null;if(video)await video.saveAs(path.join(evidenceDir,'scene-depth.webm'));
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;telemetry?.fail(error);await telemetry?.save({measurements:report}).catch(()=>{});}
finally{await context?.close();await browser?.close();await server?.stop();process.chdir(root);report.currentApplicationStillMatches=JSON.stringify(report.applicationSources)===JSON.stringify(sourceFingerprint());await fs.writeFile(path.join(evidenceDir,'scene-depth-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,evidenceDir,currentApplicationStillMatches:report.currentApplicationStillMatches,failure:report.failure}));}
