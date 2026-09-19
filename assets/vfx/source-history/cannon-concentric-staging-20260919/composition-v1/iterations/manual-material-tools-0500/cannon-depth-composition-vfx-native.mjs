// Bounded four-way composition diagnosis. No runtime patch and no global suite.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const root=process.cwd(),base='assets/vfx/source-history/cannon-concentric-staging-20260919/composition-v1',at=new Date().toISOString(),out=path.resolve(`output/playwright/${at.replaceAll(':','-').replaceAll('.','-')}-cannon-depth-composition-vfx`);
const report={at,syntheticFixture:true,promoted:false,scope:'Recorded centers/ages, real assets and steady ARPG camera. Fixed controlled poses identical across four variants; no exact bone/corpse or PTS replay.',captures:[],errors:[]};
let releaseGpu,browser,server;
try{
 report.window=JSON.parse(await fs.readFile(`${base}/gpu-window.json`,'utf8'));assert.equal(report.window.authorized,true);releaseGpu=await gpuReservation();await fs.mkdir(out,{recursive:true});
 const manifest=JSON.parse(await fs.readFile('output/vfx-warcry-art-v1/baseline/manifest.json','utf8'));report.sourceHashes=manifest.sourceHashes;
 report.snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-cannon-concentric-'));await fs.cp('output/vfx-warcry-art-v1/baseline/source',report.snapshot,{recursive:true});
 await fs.copyFile('tools/cannon-depth-composition-vfx-preview.html',path.join(report.snapshot,'src/cannon-concentric-vfx-preview.html'));await fs.copyFile(`${base}/../contract.json`,path.join(report.snapshot,'src/cannon-concentric-contract.json'));
 report.candidateHashes=Object.fromEntries(await Promise.all((await fs.readdir(`${base}/candidate`)).filter(f=>f.endsWith('.js')).map(async f=>[f,sha256(await fs.readFile(`${base}/candidate/${f}`))])));await fs.cp(`${base}/candidate`,path.join(report.snapshot,'src/vfx-composition-staged'),{recursive:true});
 report.harnessHash=sha256(await fs.readFile('tools/cannon-depth-composition-vfx-preview.html'));report.contractHash=sha256(await fs.readFile(`${base}/../contract.json`));
 process.chdir(report.snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});const context=await browser.newContext({viewport:{width:2880,height:1800}});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(server.origin+'/src/cannon-concentric-vfx-preview.html');await page.waitForFunction(()=>window.cannonConcentric?.ready,null,{timeout:60000});
 if(process.env.VFX_OPAQUE_DWARF){await page.evaluate(()=>window.cannonConcentric.setBodyOpaque(true));report.bodyMaterialOverride='DwarfBody loaded material clone only: transparent=false,depthWrite=true; runtime/GLB unchanged';}
 for(const [age,q,rm]of ((process.env.VFX_LAYER_DIAG||process.env.VFX_BODY_DIAG||process.env.VFX_LOW_DIAG)?[]:[[.1505,'high',false],[.30,'high',false],[.5,'high',false],[.1505,'low',true]])){
  const data=await page.evaluate(([age,q,rm])=>window.cannonConcentric.sample(age,q,rm),[age,q,rm]);const file=`${q}${rm?'-reduced':''}-${age}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,sha256:sha256(await fs.readFile(path.join(out,file))),...data});
  for(const r of data.results){assert.equal(r.glError,0);assert.equal(r.pipeline.depth.passes,1);}
 }
 if(process.env.VFX_LOW_DIAG){report.lowAblation=await page.evaluate(()=>window.cannonConcentric.diagnoseLow());await page.screenshot({path:path.join(out,'low-contribution-ablation.png')});}else if(process.env.VFX_BODY_DIAG){report.bodyDiagnosis=[];for(const [q,rm]of [['high',false],['low',true]]){report.bodyDiagnosis.push(await page.evaluate(([q,rm])=>window.cannonConcentric.diagnoseBody(q,rm),[q,rm]));await page.screenshot({path:path.join(out,'body-diagnosis-'+q+'.png')});}}else if(process.env.VFX_LAYER_DIAG){report.layerDiagnosis=await page.evaluate(()=>window.cannonConcentric.diagnoseLayers());await page.screenshot({path:path.join(out,'layer-diagnosis.png')});}else{report.cost=await page.evaluate(()=>window.cannonConcentric.cost());report.lowAblation=await page.evaluate(()=>window.cannonConcentric.diagnoseLow());await page.screenshot({path:path.join(out,'low-contribution-ablation.png')});report.lowAblation.sha256=sha256(await fs.readFile(path.join(out,'low-contribution-ablation.png')));}
 if(process.env.VFX_FRONT_BACK){report.frontBack=[];for(const offset of [-3,3]){const data=await page.evaluate(o=>window.cannonConcentric.sample(.1505,'high',false,o),offset);const file='synthetic-offset-'+offset+'.png';await page.screenshot({path:path.join(out,file)});report.frontBack.push({file,...data});}}
 await page.evaluate(()=>window.cannonConcentric.dispose());await context.close();process.chdir(root);
 const live=await Promise.all(Object.entries(manifest.sourceHashes).filter(([p])=>p.startsWith('src/vfx/')).map(async([p,hash])=>({p,equal:sha256(await fs.readFile(p))===hash})));
 report.candidateStable=JSON.stringify(report.candidateHashes)===JSON.stringify(Object.fromEntries(await Promise.all(Object.keys(report.candidateHashes).map(async f=>[f,sha256(await fs.readFile(`${base}/candidate/${f}`))]))));assert.ok(report.candidateStable);report.liveVfxUnchanged=live.every(x=>x.equal);assert.ok(report.liveVfxUnchanged);assert.deepEqual(report.errors,[]);report.technicalPassed=true;
 report.artGate={minimum:.65,allCombinedPassed:report.captures.length>0&&report.captures.every(c=>c.results.filter(r=>r.mode==='combined-after').every(r=>r.gate.every(g=>g.preservedFraction>=.65)))};
 report.artisticAccepted=false;
}catch(e){report.technicalPassed=false;report.error=e.message;process.exitCode=1;}
finally{process.chdir(root);await browser?.close();await server?.stop();await releaseGpu?.();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,passed:report.technicalPassed,error:report.error,artGate:report.artGate}));}
