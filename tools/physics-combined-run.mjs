import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {chromium,waitForRuntimeAssets} from './quality-browser.mjs';
import {requireStagingArtefacts} from './quality-staging.mjs';
// Native capture of one staged candidate served from its own game copy under the untracked output/ tree.
requireStagingArtefacts(['output/physics/combined-native-20260919/game/server.mjs','output/physics/combined-native-20260919/game/src/physics/contacts.mjs','output/physics/combined-native-20260919/game/src/render/environment-layout.js']);
const {createCollisionWorld,moveActor,sweepStatic}=await import('../output/physics/combined-native-20260919/game/src/physics/contacts.mjs');
const {getEnvironmentColliders,ENVIRONMENT_GROUND}=await import('../output/physics/combined-native-20260919/game/src/render/environment-layout.js');
const root=process.cwd(),staging=path.resolve('output/physics/combined-native-20260919'),gameRoot=path.join(staging,'game');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),evidence=path.resolve(`output/playwright/${stamp}-physics-combined`);
fs.mkdirSync(evidence,{recursive:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),manifest=JSON.parse(fs.readFileSync(path.join(staging,'manifest.json')));
const hashes=(dir,keys=Object.keys(manifest.candidate))=>Object.fromEntries(keys.map(p=>[p,sha(fs.readFileSync(path.join(dir,p)))]));
const before=hashes(gameRoot),liveBefore=hashes(root,Object.keys(manifest.baseline));assert.deepEqual(before,manifest.candidate);assert.deepEqual(liveBefore,manifest.baseline,'Live changed after preparation: preserve snapshot and re-coordinate');
const bindingReference=JSON.parse(fs.readFileSync(path.join(staging,'layout-engine-diagnostic.json')));
const fixture=fs.readFileSync('tools/physics-combined-fixture.js','utf8');
const main=fs.readFileSync(path.join(gameRoot,'src/main.js'),'utf8');
assert.equal(main.split('import { getPursuitDirection }').length,2);
const servedMain=main.replace('import { getPursuitDirection }','import { getPursuitDirection as physicsQaOriginalPursuit }')+'\n'+fixture;
fs.writeFileSync(path.join(evidence,'served-main.js'),servedMain);fs.writeFileSync(path.join(evidence,'fixture.js'),fixture);
const world=createCollisionWorld({colliders:getEnvironmentColliders(),bounds:ENVIRONMENT_GROUND,groundY:0});
const scenarios=[{name:'north-fixed',x:16.56428861789936,z:8.359204549834535},{name:'south-fixed',x:16.847589032244333,z:18.323203398288207},{name:'north-moving',x:16.56428861789936,z:8.359204549834535,moving:true},{name:'crypt-input',crypt:true}];
const harnessFiles=['tools/physics-combined-run.mjs','tools/physics-combined-fixture.js','tools/physics-combined-audit.mjs','tools/quality-browser.mjs','tools/quality-server-source.mjs','output/physics/combined-native-20260919/node-layout-probe.mjs','output/physics/combined-native-20260919/layout-engine-diagnostic.json'];
const harnessHashes=()=>Object.fromEntries(harnessFiles.map(p=>[p,sha(fs.readFileSync(p))]));
const report={harnessBefore:harnessHashes(),at:new Date().toISOString(),scope:'Synthetic native fixed-start fixtures, actual full offline game/RAF/render/input. No natural-run or multiplayer/performance promotion.',sourceBefore:before,liveBefore,servedMainSha256:sha(servedMain),fixtureSha256:sha(fixture),results:[]};
let browser,server,closed,owned=false;const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
function audit(runtime,initial){let maxStep=0,maxInvalid=0,staticChords=0,totalStepExceedsLocomotion=0;for(const s of runtime.samples){assert.ok(s.plans<=4);for(let i=0;i<s.bodies.length;i++){const a=s.before[i],b=s.bodies[i],d=Math.hypot(a.x-b.x,a.z-b.z);maxStep=Math.max(maxStep,d);if(d>initial.speed*s.dt+1e-4)totalStepExceedsLocomotion++;const v=moveActor(world,b,{x:0,z:0});maxInvalid=Math.max(maxInvalid,Math.hypot(v.x-b.x,v.z-b.z));assert.equal(v.unresolved,false);if(d>1e-8&&sweepStatic(world,{...a,y:0},{...b,y:0},a.radius,{kind:'actor'}))staticChords++;}}
 for(const hit of runtime.hits){assert.ok(hit.after<hit.before,'real health loss');for(const b of hit.bosses){assert.ok(b.clearLos);assert.ok(Math.hypot(b.x-hit.player.x,b.z-hit.player.z)<=b.radius+initial.player.radius+.74+1e-6);}}
 assert.ok(maxInvalid<1e-4);return {maxStep,maxInvalid,totalStepExceedsLocomotion,requiresExactMovementCrowdReplay:true,staticFrameChordsWithContact:staticChords,maxPlans:Math.max(...runtime.samples.map(s=>s.plans)),maxVisited:Math.max(...runtime.plans.map(p=>p.visited),0)};
}
try{
 const window=JSON.parse(fs.readFileSync(path.join(staging,'gpu-window.json')));assert.equal(window.authorized,true);report.window=window;
 fs.mkdirSync(lock);owned=true;fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'physics-combined',pid:process.pid,token,created:new Date().toISOString()}));
 server=spawn(process.execPath,['--import',path.join(staging,'node-layout-probe.mjs'),'server.mjs'],{cwd:gameRoot,env:{...process.env,PHYSICS_LAYOUT_BINDING_REPORT:path.join(evidence,'node-layout-binding.json'),HOST:'127.0.0.1',PORT:'0',LEADERBOARD_FILE:path.join(evidence,'isolated-ledger.json'),SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','pipe','pipe']});closed=new Promise(r=>server.once('close',r));
 let serverErr='';server.stderr.on('data',x=>serverErr+=x);
 const port=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('server startup timeout')),8000);server.stdout.on('data',x=>{text+=x;const m=text.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});server.once('error',reject);});
 report.server={pid:server.pid,port,root:gameRoot};report.nodeLayout=JSON.parse(fs.readFileSync(path.join(evidence,'node-layout-binding.json')));assert.equal(report.nodeLayout.pid,server.pid);assert.equal(report.nodeLayout.count,153);assert.equal(report.nodeLayout.sourceSha256,manifest.candidate['src/render/environment-layout.js']);
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidence,size:{width:1440,height:900}}});
  const page=await context.newPage(),row={name:scenario.name,passed:false,errors:[],httpErrors:[],screenshots:[],inputs:[]};
  const capture=async label=>{const file=`${scenario.name}-${label}.png`;await page.screenshot({path:path.join(evidence,file)});row.screenshots.push(file);};
  page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({url:r.url(),status:r.status()});});
  await page.route('**/src/main.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:servedMain}));
  try{
   await page.goto(`http://127.0.0.1:${port}/?offline=1&quality=high`,{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page);
   await page.locator('#open-login-button').click();await page.locator('label[for="character-warrior"]').click();await waitForRuntimeAssets(page);
   await page.locator('#player-name').fill('Pursuit fixture');await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');await page.locator('#game-canvas').focus();
   row.layout=await page.evaluate(async()=>{const m=await import('/src/render/environment-layout.js'),c=m.getEnvironmentColliders(),sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');return {count:c.length,colliders:c,sourceSha256:await sha(await (await fetch('/src/render/environment-layout.js')).text()),collidersSha256:await sha(JSON.stringify(c)),ground:m.ENVIRONMENT_GROUND};});
   assert.equal(row.layout.count,report.nodeLayout.count);assert.equal(row.layout.sourceSha256,report.nodeLayout.sourceSha256);assert.equal(row.layout.sourceSha256,bindingReference.sourceSha256);assert.deepEqual(row.layout.ground,report.nodeLayout.ground);
   assert.equal(row.layout.collidersSha256,bindingReference.chromeSha256);assert.equal(report.nodeLayout.collidersSha256,bindingReference.nodeSha256);assert.deepEqual(row.layout.colliders,bindingReference.chrome);assert.deepEqual(report.nodeLayout.colliders,bindingReference.node);
   row.descriptorComparison={bitIdentical:row.layout.collidersSha256===report.nodeLayout.collidersSha256,explainedDifferences:bindingReference.differences,maxAbs:Math.max(...bindingReference.differences.map(d=>d.abs)),maxUlp:Math.max(...bindingReference.differences.map(d=>d.ulp)),gate:'Exact per-engine descriptors and module SHA; seven documented legacy trig differences only, no general numeric tolerance'};
   if(scenario.crypt){
    row.initial=await page.evaluate(()=>window.__physicsPursuitNative.prepareCrypt());
    await page.waitForTimeout(250);await capture('entrance');
    const walk=async(key,axis,operator,target,label)=>{const before=await page.evaluate(()=>window.__physicsPursuitNative.status());await page.keyboard.down(key);try{await page.waitForFunction(({axis,operator,target})=>{const p=window.__physicsPursuitNative.status().player;return operator==='le'?p[axis]<=target:p[axis]>=target;},{axis,operator,target},{timeout:3500,polling:'raf'});}finally{await page.keyboard.up(key);}row.inputs.push({key,axis,operator,target,label,before,after:await page.evaluate(()=>window.__physicsPursuitNative.status())});};
    await walk('w','z','le',-15.1,'landing-approach');await capture('landing');
    await page.keyboard.down('w');try{await page.waitForTimeout(1100);}finally{await page.keyboard.up('w');}
    row.door=await page.evaluate(()=>({state:window.__physicsPursuitNative.status(),probe:window.__physicsPursuitNative.cryptProbe()}));
    assert.ok(row.door.state.player.z>=-15.836&&row.door.state.player.z<=-15.80);assert.equal(row.door.probe.body.colliderId,'crypt-entry-door');assert.equal(row.door.probe.los.colliderId,'crypt-entry-door');await capture('blocked-door');
    await walk('s','z','ge',-13,'retreat');await walk('a','x','le',10.6,'front-left');await walk('d','x','ge',16,'front-crossing');await capture('crossed-front');
    row.runtime=await page.evaluate(()=>window.__physicsPursuitNative.finish());let previous={x:row.initial.x,z:row.initial.z},maxStep=0,maxInvalid=0,maxY=0;let segments=0;
    for(const sample of row.runtime.samples){const p=sample.player,body={...p,radius:row.initial.radius},valid=moveActor(world,body,{x:0,z:0}),d=Math.hypot(p.x-previous.x,p.z-previous.z);assert.equal(valid.unresolved,false);maxInvalid=Math.max(maxInvalid,Math.hypot(valid.x-p.x,valid.z-p.z));maxY=Math.max(maxY,Math.abs(p.y));maxStep=Math.max(maxStep,d);assert.ok(d<=row.initial.speed*sample.dt+1e-5);if(d>1e-8){assert.equal(sweepStatic(world,{...previous,y:0},{...p,y:0},body.radius,{kind:'actor'}),null);segments++;}previous=p;}
    assert.ok(maxInvalid<1e-5);assert.equal(maxY,0);assert.equal(row.runtime.hits.length,0);row.audit={maxStep,maxInvalid,maxY,segments};row.presentation=await page.evaluate(()=>window.__zombieNightDebug.getPresentationStats());assert.equal(row.errors.length,0);assert.equal(row.httpErrors.length,0);row.passed=true;
   }else {
   row.initial=await page.evaluate(start=>window.__physicsPursuitNative.prepare(start),scenario);await capture('start');
   if(scenario.moving){
    await page.waitForTimeout(500);await page.evaluate(()=>window.__physicsPursuitNative.mark('input-start'));
    for(const [keys,ms] of [[['w'],450],[['w','a'],420],[['a'],300]]){
     for(const key of keys)await page.keyboard.down(key);row.inputs.push({keys,requestedMs:ms,before:await page.evaluate(()=>window.__physicsPursuitNative.status())});await page.waitForTimeout(ms);for(const key of keys)await page.keyboard.up(key);
    }
    await page.evaluate(()=>window.__physicsPursuitNative.mark('input-end'));await capture('player-moved');
   } else {await page.waitForTimeout(1200);await capture('approach');}
   await page.waitForFunction(()=>window.__physicsPursuitNative.status().hits>0,null,{timeout:25000,polling:50});
   await capture('melee');row.runtime=await page.evaluate(()=>window.__physicsPursuitNative.finish());
   row.integrity=await page.evaluate(()=>window.__zombieNightDebug.getRenderIntegrity());row.presentation=await page.evaluate(()=>window.__zombieNightDebug.getPresentationStats());
   row.audit=audit(row.runtime,row.initial);assert.equal(row.integrity.invisibleZombies,0);assert.equal(row.integrity.invisibleThreats,0);assert.ok(row.runtime.indexCleared);assert.equal(row.runtime.perfStressImmortal,false);assert.equal(row.errors.length,0);assert.equal(row.httpErrors.length,0);
   if(scenario.moving){const [a,b]=row.runtime.marks;row.playerDisplacement=Math.hypot(a.player.x-b.player.x,a.player.z-b.player.z);assert.ok(row.playerDisplacement>1.5);row.replansAfterInput=row.runtime.plans.filter(p=>p.at>=a.time&&Math.hypot(p.target.x-row.initial.player.x,p.target.z-row.initial.player.z)>1.5);assert.ok(row.replansAfterInput.length>0,'must observe actual replan to moved target');}
   row.passed=true;
   }
  }catch(error){row.failure=error.stack;try{row.runtime??=await page.evaluate(()=>window.__physicsPursuitNative?.finish());await capture('failure');}catch{}process.exitCode=1;}
  finally{for(const key of ['w','a','s','d'])await page.keyboard.up(key).catch(()=>{});const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidence,scenario.name+'.webm'));report.results.push(row);fs.writeFileSync(path.join(evidence,scenario.name+'.json'),JSON.stringify(row,null,2));console.log(JSON.stringify({name:row.name,passed:row.passed,firstHit:row.runtime?.hits?.[0]?.at,speed:row.initial?.speed,plans:row.runtime?.plans?.length,crypt:row.audit?.segments,failure:row.failure}));}
 }
 report.server.stderr=serverErr;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 await browser?.close();if(server){server.kill('SIGTERM');await Promise.race([closed,new Promise(r=>setTimeout(r,1000))]);if(server.exitCode===null&&!server.signalCode)server.kill('SIGKILL');}
 if(owned&&['north-fixed','south-fixed','north-moving'].every(name=>report.results.some(r=>r.name===name&&r.initial&&r.runtime?.samples?.length))){
  const replay=spawnSync(process.execPath,['tools/physics-combined-audit.mjs',evidence],{encoding:'utf8'});report.exactPostCaptureReplay={passed:replay.status===0,stderr:replay.stderr};
 }else report.exactPostCaptureReplay={passed:false,reason:'Incomplete capture; replay not run'};
 report.harnessAfter=harnessHashes();report.harnessStable=JSON.stringify(report.harnessBefore)===JSON.stringify(report.harnessAfter);
 if(owned&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
 report.sourceAfter=hashes(gameRoot);report.sourceStable=JSON.stringify(before)===JSON.stringify(report.sourceAfter);report.liveAfter=hashes(root,Object.keys(manifest.baseline));report.liveStable=JSON.stringify(liveBefore)===JSON.stringify(report.liveAfter);report.passed=report.results.length===scenarios.length&&report.results.every(r=>r.passed)&&report.sourceStable&&report.harnessStable&&report.exactPostCaptureReplay.passed;
 fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({evidence,passed:report.passed,sourceStable:report.sourceStable,liveStable:report.liveStable,failure:report.failure}));if(!report.passed)process.exitCode=1;
}
