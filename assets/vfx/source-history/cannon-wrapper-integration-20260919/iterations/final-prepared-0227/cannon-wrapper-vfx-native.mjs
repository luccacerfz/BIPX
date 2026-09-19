// Reuses existing asset snapshot, browser telemetry, isolated server and atomic GPU reservation.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,evidenceDir,sourceFingerprint} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const diagnostic=process.env.BIPX_CANNON_FOCUS==='diagnosis';
const focus=process.env.BIPX_CANNON_FOCUS==='silhouette'||diagnostic;
const release=await gpuReservation(),root=process.cwd();let browser,server,context,telemetry;
const directory='assets/vfx/source-history/cannon-wrapper-integration-20260919';
const files=(await fs.readdir(directory)).filter(n=>n.endsWith('.js')).map(n=>`${directory}/${n}`);
const report={scope:'Staged WRAPPER/coexistence cannon A/B with actual Lyra/zombie/cemetery assets and gameplay base camera; real cinematic HDR+bloom and shared packed depth/cutaway. Controlled cast/release .30s, travel 22m/s, impact radius3.4; no actual gameplay or promotion.',promoted:false,captures:[],playback:[]};
try{
 report.mode=diagnostic?'diagnosis':focus?'silhouette':'full';report.applicationSources=sourceFingerprint();report.stagingSources=Object.fromEntries(await Promise.all([...files,path.join(directory,'iterations/shared-depth-0215/cannon-source-glsl.js'),'tools/cannon-wrapper-vfx-preview.html','tools/cannon-wrapper-vfx-native.mjs'].map(async f=>[f,sha256(await fs.readFile(f))])));
 report.snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-cannon-vfx-'));
 for(const f of Object.keys(report.applicationSources)){const out=path.join(report.snapshot,f);await fs.mkdir(path.dirname(out),{recursive:true});await fs.copyFile(f,out);}
 assert.deepEqual(sourceFingerprint(),report.applicationSources,'Application changed during copy');await fs.mkdir(path.join(report.snapshot,'src/vfx-cannon-staged'),{recursive:true});for(const f of files)await fs.copyFile(f,path.join(report.snapshot,'src/vfx-cannon-staged',path.basename(f)));await fs.copyFile('tools/cannon-wrapper-vfx-preview.html',path.join(report.snapshot,'src/cannon-wrapper-vfx-preview.html'));
 await fs.copyFile(path.join(directory,'iterations/shared-depth-0215/cannon-source-glsl.js'),path.join(report.snapshot,'src/vfx-cannon-staged/cannon-diagnostic-original.js'));
 // QA-only accessor in the temporary snapshot; runtime pipeline remains untouched. Bloom passes/MSAA/exposure are unchanged.
 const pipelineFile=path.join(report.snapshot,'src/render/cinematic-pipeline.js');const pipelineSource=await fs.readFile(pipelineFile,'utf8');
 const diagnosticSource=pipelineSource.replace('let damage = 0;','let damage = 0; let diagnosticBloomScale=1;').replace('    setQuality(value) {','    setDiagnosticBloomScale(value) { diagnosticBloomScale=value; },\n    setQuality(value) {').replace('bloom ? .24 : 0','bloom ? .24 * diagnosticBloomScale : 0');
 assert.notEqual(diagnosticSource,pipelineSource);await fs.writeFile(pipelineFile,diagnosticSource);report.pipelineDiagnostic={scope:'Temporary fixture only: scales bloom composite contribution; same HDR/MSAA/blur/render state. No shared runtime edits.',sourceSha256:sha256(pipelineSource),injectedSha256:sha256(diagnosticSource)};
 process.chdir(report.snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});context=await browser.newContext({viewport:{width:2560,height:720},recordVideo:{dir:evidenceDir,size:{width:2560,height:720}}});const page=await context.newPage();telemetry=attachQualityTelemetry(page,'cannon-wrapper-vfx-native');telemetry.markFixture();
 await page.goto(server.origin+'/src/cannon-wrapper-vfx-preview.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.cannonVfxPrototype?.ready,null,{timeout:60000});

 const capture=async(name,data)=>{const file=await telemetry.capture(name);report.captures.push({file,sha256:sha256(await fs.readFile(path.join(evidenceDir,file))),...data});return file;};
 if(!diagnostic){for(const [quality,reduced,times]of [['high',false,[.52,.74,.86,1.25,1.8]],['low',true,[.52,1.25]]])for(const time of times){
  const data=await page.evaluate(({time,quality,reduced})=>{const f=window.cannonVfxPrototype;return {stats:f.sample(time,quality,reduced),occlusion:f.audit()};},{time,quality,reduced});
  await capture(`${quality}${reduced?'-reduced':''}-${time}`,data);assert.equal(data.stats.glError,0);assert.equal(data.stats.pipeline.hdr,true);for(const c of data.stats.candidate.casts)assert.equal(c.radius,3.4);
  if(time===.52)assert.ok(data.stats.candidate.casts.some(c=>c.body&&c.flight.visible));assert.ok(data.occlusion.every(o=>o.preservedFraction===null||o.preservedFraction>=.65));
 }
 report.coexistence=[];
 for(const [quality,reduced]of [['high',false],['low',true]])for(const count of [1,4]){
  const data=await page.evaluate(({count,quality,reduced})=>{const f=window.cannonVfxPrototype;return {stats:f.combine(count,quality,reduced),shared:f.sharedDepth(),fireOcclusion:f.audit(true),allOcclusion:f.audit(),contextOcclusion:f.auditContext()};},{count,quality,reduced});
  data.file=await capture(`coexist-${quality}-${count}`,data);report.coexistence.push(data);
  assert.equal(data.stats.pipeline.depth.passes,1);assert.equal(data.stats.wrapper.states.gravity.depthValid,true);assert.equal(data.stats.candidate.depthValid,true);assert.equal(data.shared.textures,1);assert.equal(data.shared.gravityFields,1);assert.equal(data.shared.fireCasts,count);assert.equal(data.stats.wrapper.states.frozen,4);
  assert.ok(data.fireOcclusion.every(o=>o.preservedFraction===null||o.preservedFraction>=.65),'Fire added to gravity/ice obscures real actor torso');console.log(JSON.stringify({quality,count,shared:data.shared,fireTorso:data.fireOcclusion,combinedTorso:data.allOcclusion}));
 }
 if(!focus){report.lifecycle=await page.evaluate(()=>window.cannonVfxPrototype.lifecycle());
 assert.deepEqual(report.lifecycle.before,report.lifecycle.paused);assert.deepEqual(report.lifecycle.memory,report.lifecycle.afterMemory);assert.equal(report.lifecycle.away.pipeline.depth.passes,0);assert.equal(report.lifecycle.back.pipeline.depth.passes,1);assert.equal(report.lifecycle.fireExpired.candidate.casts.length,0);assert.equal(report.lifecycle.fireExpired.wrapper.sceneDepth.gravityFields,1);assert.equal(report.lifecycle.expiry.pipeline.depth.passes,0);assert.equal(report.lifecycle.reset.pipeline.depth.passes,0);assert.equal(report.lifecycle.missed.candidate.casts.length,0);assert.equal(report.lifecycle.missed.wrapper.events.dwarf_explosive_cannon.impact,report.lifecycle.missImpactBefore);
 report.wall=await page.evaluate(()=>window.cannonVfxPrototype.wall());report.wall.file=await capture('behind-real-ruin',report.wall);assert.equal(report.wall.stats.pipeline.depth.passes,1);assert.ok(report.wall.depthOcclusionChangedPixels>20,'Real environment depth must occlude flame');
 await page.evaluate(()=>window.cannonVfxPrototype.center());report.cost=await page.evaluate(()=>window.cannonVfxPrototype.measureCost());
 }
 }
 if(diagnostic){report.diagnosis=[];report.diagnosisReference=JSON.parse(await fs.readFile(path.join(root,'output/playwright/2026-09-19T02-15-38-208Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json'),'utf8')).coexistence[0];await page.evaluate(()=>window.cannonVfxPrototype.startDiagnosis());for(const mask of ['original','candidate'])for(const bloom of [true,false])for(const [volume,embers]of [[true,true],[true,false],[false,true],[false,false]]){const data=await page.evaluate(args=>window.cannonVfxPrototype.diagnose(...args),[mask,volume,embers,bloom]);assert.ok(data.stats.target.every((v,i)=>Math.abs(v-report.diagnosisReference.stats.target[i])<1e-5),'Diagnostic must preserve original contact/actor locations');data.file=await capture(`diagnosis-${mask}-bloom${Number(bloom)}-volume${Number(volume)}-embers${Number(embers)}`,data);report.diagnosis.push(data);console.log(JSON.stringify({mask,bloom,volume,embers,torso:data.occlusion.map(x=>x.preservedFraction)}));}report.passed=true;report.diagnosticCandidateGatePassed=report.diagnosis.filter(c=>c.mask==='candidate'&&c.bloom&&c.volume&&c.embers).every(c=>c.occlusion.every(o=>o.preservedFraction>=.65));}
 if(!diagnostic){report.artGate={threshold:.65,allCombinedPassed:report.coexistence.every(c=>c.allOcclusion.every(o=>o.preservedFraction===null||o.preservedFraction>=.65)),fireContributionPassed:report.coexistence.every(c=>c.fireOcclusion.every(o=>o.preservedFraction===null||o.preservedFraction>=.65)),scope:'Four 11x11px real-actor torso patches. Overall coexistence failure remains a promotion gate; context-only is a reference for composition interactions, not evidence of sole inherited fault.'};report.contractPassed=true;report.passed=report.artGate.allCombinedPassed;if(!report.passed)process.exitCode=1;}report.disposal=await page.evaluate(()=>window.cannonVfxPrototype.dispose());assert.equal(report.disposal.candidate.disposed,true);telemetry.assertClean();
 const video=page.video();await telemetry.save({measurements:report});await context.close();context=null;if(video)await video.saveAs(path.join(evidenceDir,'cannon-wrapper-coexistence.webm'));
}catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;telemetry?.fail(error);await telemetry?.save({measurements:report}).catch(()=>{});}
finally{
 await context?.close();await browser?.close();await server?.stop();process.chdir(root);await release();report.currentApplicationStillMatches=JSON.stringify(report.applicationSources)===JSON.stringify(sourceFingerprint());const stagingNow=Object.fromEntries(await Promise.all(Object.keys(report.stagingSources??{}).map(async f=>[f,sha256(await fs.readFile(f))])));report.stagingStillMatches=JSON.stringify(report.stagingSources)===JSON.stringify(stagingNow);
 report.hashes=Object.fromEntries(await Promise.all((await fs.readdir(evidenceDir)).filter(n=>/\.(png|webm)$/.test(n)).map(async n=>[n,sha256(await fs.readFile(path.join(evidenceDir,n)))])));await fs.writeFile(path.join(evidenceDir,'cannon-wrapper-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,evidenceDir,captures:report.captures.length,currentApplicationStillMatches:report.currentApplicationStillMatches,stagingStillMatches:report.stagingStillMatches,failure:report.failure}));
}
