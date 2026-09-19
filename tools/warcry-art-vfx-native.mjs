// Short art selection only; invoke after the coordinated Combat/Brute/Environment windows.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const diagnosis=process.argv.includes('--diagnosis'),art2=process.argv.includes('--art2');
const root=process.cwd(),base='output/vfx-warcry-art-v1',candidateBase=art2?`${base}/art2/candidate`:`${base}/candidate`,preview=diagnosis?'tools/warcry-depth-vfx-preview.html':'tools/warcry-art-vfx-preview.html',at=new Date().toISOString(),out=path.resolve(base,art2?'art2':'.',`${diagnosis?'diagnosis':'native'}-${at.replaceAll(':','-').replaceAll('.','-')}`);
const report={at,syntheticFixture:true,promoted:false,scope:'Aldric/assets/current ARPG parameters, literal core/adapter baseline03:33. Paired controlled poses, not gameplay/input proof.',captures:[],errors:[]};
let releaseGpu,browser,server;
try{
 const receipt=JSON.parse(await fs.readFile(`${base}${art2?'/art2':''}/gpu-window.json`,'utf8'));assert.equal(receipt.authorized,true);report.window=receipt;
 releaseGpu=await gpuReservation();await fs.mkdir(out,{recursive:true});
 report.snapshot=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-warcry-art1-'));await fs.cp(`${base}/baseline/source`,report.snapshot,{recursive:true});
 const hashFiles=async()=>Object.fromEntries(await Promise.all((await fs.readdir(candidateBase)).filter(f=>f.endsWith('.js')).map(async f=>[f,sha256(await fs.readFile(`${candidateBase}/${f}`))])));
 report.candidateSources=await hashFiles();await fs.cp(candidateBase,path.join(report.snapshot,'src/vfx-warcry-staged'),{recursive:true});
 await fs.copyFile(preview,path.join(report.snapshot,'src/warcry-art-vfx-preview.html'));
 const main=await fs.readFile(path.join(report.snapshot,'src/main.js'),'utf8'),a=main.indexOf('function presentClassSkill('),b=main.indexOf('\n// Reconstruct enduring visuals',a);assert.ok(a>0&&b>a);const adapter=main.slice(a,b);report.adapter={main:sha256(main),literal:sha256(adapter)};
 await fs.writeFile(path.join(report.snapshot,'src/warcry-adapter-literal.js'),`export function createLiteralPresenter(context){return new Function('context',${JSON.stringify(`with(context){${adapter}\nreturn presentClassSkill;}`)})(context);}`);
 process.chdir(report.snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});const context=await browser.newContext({viewport:{width:2880,height:900},recordVideo:{dir:out,size:{width:2880,height:900}}});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 if(diagnosis){const glbPath=path.join(root,'output/qa/arpg-root-review/aldric-material-audit-20260919/aldric-hero-opaque-candidate.glb'),body=await fs.readFile(glbPath);assert.equal(sha256(body),'5c1903a064decbcee1d018df4f6ee595e826640a0ccb9b40538efe5aef70f996');report.opaqueProbe={path:glbPath,sha256:sha256(body),runtimeModified:false};await page.route('**/assets/models/aldric-hero-opaque-probe.glb',route=>route.fulfill({status:200,contentType:'model/gltf-binary',body}));}
 if(art2&&!diagnosis){const glbPath=path.join(root,'output/qa/arpg-root-review/aldric-material-audit-20260919/aldric-hero-opaque-candidate.glb'),body=await fs.readFile(glbPath);assert.equal(sha256(body),'5c1903a064decbcee1d018df4f6ee595e826640a0ccb9b40538efe5aef70f996');report.aldricGlbOverride={path:glbPath,sha256:sha256(body),requests:0,appliesTo:'both panels',manualMaterialMutation:false};await page.route('**/assets/models/aldric-hero.glb',route=>{report.aldricGlbOverride.requests++;return route.fulfill({status:200,contentType:'model/gltf-binary',body});});}
 await page.goto(server.origin+'/src/warcry-art-vfx-preview.html'+(art2&&!diagnosis?'?art=2':''));await page.waitForFunction(()=>window.warcryArt?.ready,null,{timeout:60000});
 report.harnessHash=sha256(await fs.readFile(path.join(root,preview)));
 if(diagnosis){for(const [t,mode,layer]of [[.22,'aldric-opaque',-1],[.48,'aldric-opaque',-1],[.22,'bright-material',0],[.48,'no-depth',5],[.48,'flat-proxy',5]]){const data=await page.evaluate(args=>window.warcryArt.diagnose(...args),[t,mode,layer]);const file=`probe-${t}-${layer}-${mode}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,sha256:sha256(await fs.readFile(path.join(out,file))),...data});assert.equal(data.state.glError,0);if(mode==='aldric-opaque'){assert.ok(data.poseIdentical);assert.equal(data.pair[0].actualSharedDepthBodyDraws,0);assert.ok(data.pair[1].actualSharedDepthBodyDraws>0);assert.equal(data.pair[0].materials[0][0].transparent,true);assert.equal(data.pair[1].materials[0][0].depthWrite,true);}}}
 else for(const [t,q,rm]of (art2?[[.22,'high',false],[.48,'high',false],[1.8,'high',false],[.48,'low',true]]:[['high',false],['low',true]].flatMap(([q,rm])=>[.22,.48,1.8,8.5].map(t=>[t,q,rm])))){
  const state=await page.evaluate(([t,q,rm])=>window.warcryArt.sample(t,q,rm),[t,q,rm]);const gate=await page.evaluate(()=>window.warcryArt.audit());const file=`${q}${rm?'-reduced':''}-${t}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,sha256:sha256(await fs.readFile(path.join(out,file))),state,gate});assert.equal(state.glError,0);
  if(art2){assert.ok(state.heroMaterials.length>0);assert.ok(state.heroMaterials.every(m=>!m.transparent&&m.depthWrite));assert.ok(state.heroDepthDraws>0);assert.equal(state.pipeline.depth.passes,1);}
 }
 if(art2&&!diagnosis){assert.equal(report.aldricGlbOverride.requests,1);report.focalSilhouetteGate={minimum:.65,passed:report.captures.every(c=>c.gate.every(g=>g.preservedFraction>=.65))};}
 if(!diagnosis){await page.evaluate(()=>window.warcryArt.play());await page.waitForFunction(()=>window.warcryArt.stats().time>=2);}await page.evaluate(()=>window.warcryArt.dispose());await context.close();report.video=await page.video().path();
 process.chdir(root);report.sourcesStable=JSON.stringify(await hashFiles())===JSON.stringify(report.candidateSources);assert.ok(report.sourcesStable);assert.deepEqual(report.errors,[]);report.technicalPassed=true;report.artisticAccepted=false;
}catch(e){report.technicalPassed=false;report.error=e.message;process.exitCode=1;}
finally{process.chdir(root);await browser?.close();await server?.stop();await releaseGpu?.();await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,passed:report.technicalPassed,error:report.error}));}
