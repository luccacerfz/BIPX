import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {chromium,waitForRuntimeAssets} from './quality-browser.mjs';
import {createCollisionWorld,moveActor,sweepStatic} from '../output/physics/pursuit-native-20260919/game/src/physics/contacts.mjs';
import {getEnvironmentColliders,ENVIRONMENT_GROUND} from '../output/physics/pursuit-native-20260919/game/src/render/environment-layout.js';
const root=process.cwd(),staging=path.resolve('output/physics/pursuit-native-20260919'),gameRoot=path.join(staging,'game');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),evidence=path.resolve(`output/playwright/${stamp}-physics-pursuit-native`);
fs.mkdirSync(evidence,{recursive:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),manifest=JSON.parse(fs.readFileSync(path.join(staging,'manifest.json')));
const hashes=dir=>Object.fromEntries(Object.keys(manifest.candidate).map(p=>[p,sha(fs.readFileSync(path.join(dir,p)))]));
const before=hashes(gameRoot),liveBefore=hashes(root);assert.deepEqual(before,manifest.candidate);
const fixture=fs.readFileSync('tools/physics-pursuit-native-fixture.js','utf8');
const main=fs.readFileSync(path.join(gameRoot,'src/main.js'),'utf8');
assert.equal(main.split('import { getPursuitDirection }').length,2);
const servedMain=main.replace('import { getPursuitDirection }','import { getPursuitDirection as physicsQaOriginalPursuit }')+'\n'+fixture;
fs.writeFileSync(path.join(evidence,'served-main.js'),servedMain);fs.writeFileSync(path.join(evidence,'fixture.js'),fixture);
const world=createCollisionWorld({colliders:getEnvironmentColliders(),bounds:ENVIRONMENT_GROUND,groundY:0});
const scenarios=[{name:'north-fixed',x:16.56428861789936,z:8.359204549834535},{name:'south-fixed',x:16.847589032244333,z:18.323203398288207},{name:'north-moving',x:16.56428861789936,z:8.359204549834535,moving:true},{name:'four-plans-cost',cost:true}];
const report={at:new Date().toISOString(),scope:'Synthetic native fixed-start fixtures, actual full offline game/RAF/render/input. No natural-run or multiplayer/performance promotion.',sourceBefore:before,liveBefore,servedMainSha256:sha(servedMain),fixtureSha256:sha(fixture),results:[]};
let browser,server,closed,owned=false;const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
function audit(runtime,initial){let maxStep=0,maxInvalid=0,staticChords=0,totalStepExceedsLocomotion=0;for(const s of runtime.samples){assert.ok(s.plans<=4);for(let i=0;i<s.bodies.length;i++){const a=s.before[i],b=s.bodies[i],d=Math.hypot(a.x-b.x,a.z-b.z);maxStep=Math.max(maxStep,d);if(d>initial.speed*s.dt+1e-4)totalStepExceedsLocomotion++;const v=moveActor(world,b,{x:0,z:0});maxInvalid=Math.max(maxInvalid,Math.hypot(v.x-b.x,v.z-b.z));assert.equal(v.unresolved,false);if(d>1e-8&&sweepStatic(world,{...a,y:1},{...b,y:1},a.radius,{kind:'actor'}))staticChords++;}}
 for(const hit of runtime.hits){assert.ok(hit.after<hit.before,'real health loss');for(const b of hit.bosses){assert.ok(b.clearLos);assert.ok(Math.hypot(b.x-hit.player.x,b.z-hit.player.z)<=b.radius+initial.player.radius+.74+1e-6);}}
 assert.ok(maxInvalid<1e-4);return {maxStep,maxInvalid,totalStepExceedsLocomotion,requiresExactMovementCrowdReplay:true,staticFrameChordsWithContact:staticChords,maxPlans:Math.max(...runtime.samples.map(s=>s.plans)),maxVisited:Math.max(...runtime.plans.map(p=>p.visited),0)};
}
try{
 const window=JSON.parse(fs.readFileSync(path.join(staging,'gpu-window.json')));assert.equal(window.authorized,true);report.window=window;
 fs.mkdirSync(lock);owned=true;fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'physics-pursuit-native',pid:process.pid,token,created:new Date().toISOString()}));
 server=spawn(process.execPath,['server.mjs'],{cwd:gameRoot,env:{...process.env,HOST:'127.0.0.1',PORT:'0',LEADERBOARD_FILE:path.join(evidence,'isolated-ledger.json'),SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','pipe','pipe']});closed=new Promise(r=>server.once('close',r));
 let serverErr='';server.stderr.on('data',x=>serverErr+=x);
 const port=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('server startup timeout')),8000);server.stdout.on('data',x=>{text+=x;const m=text.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});server.once('error',reject);});
 report.server={pid:server.pid,port,root:gameRoot};
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 for(const scenario of scenarios){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidence,size:{width:1440,height:900}}});
  const page=await context.newPage(),row={name:scenario.name,passed:false,errors:[],httpErrors:[],screenshots:[],inputs:[]};
  const capture=async label=>{const file=`${scenario.name}-${label}.png`;await page.screenshot({path:path.join(evidence,file)});row.screenshots.push(file);};
  page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({url:r.url(),status:r.status()});});
  await page.route('**/__physics_baseline/*',route=>{const filename=new URL(route.request().url()).pathname.split('/').at(-1);const p=filename==='navigation.mjs'?path.join(staging,'baseline/src/physics/navigation.mjs'):path.join(gameRoot,'src/physics',filename);return route.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(p)});});
  await page.route('**/src/main.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:servedMain}));
  try{
   await page.goto(`http://127.0.0.1:${port}/?offline=1&quality=high`,{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page);
   await page.locator('#open-login-button').click();await page.locator('label[for="character-warrior"]').click();await waitForRuntimeAssets(page);
   await page.locator('#player-name').fill('Pursuit fixture');await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');await page.locator('#game-canvas').focus();
   if(scenario.cost){
    row.cost=await page.evaluate(()=>window.__physicsPursuitNative.planningCost());
    for(const trial of row.cost.samples){assert.equal(trial.plans,4);assert.ok(trial.indexCleared);assert.equal(trial.calls.filter(c=>c.planned).length,4);assert.ok(trial.calls.every(c=>c.visited<=768));}
    const quantile=a=>{a=a.slice().sort((x,y)=>x-y);return {samples:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)}};
    row.cost.summary=Object.fromEntries(['baseline','candidate'].map(variant=>{const a=row.cost.samples.filter(s=>s.variant===variant&&s.i>=4);return [variant,{updateMs:quantile(a.map(s=>s.ms)),navigationMs:quantile(a.map(s=>s.calls.reduce((v,c)=>v+c.ms,0))),visited:quantile(a.flatMap(s=>s.calls.map(c=>c.visited))),terminalSweeps:quantile(a.flatMap(s=>s.calls.map(c=>c.terminal?.sweeps??0)))}]}));
    await capture('workload');row.passed=true;
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
  finally{const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidence,scenario.name+'.webm'));report.results.push(row);fs.writeFileSync(path.join(evidence,scenario.name+'.json'),JSON.stringify(row,null,2));console.log(JSON.stringify({name:row.name,passed:row.passed,firstHit:row.runtime?.hits?.[0]?.at,speed:row.initial?.speed,plans:row.runtime?.plans?.length,cost:row.cost?.summary,failure:row.failure}));}
 }
 report.server.stderr=serverErr;
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{
 await browser?.close();if(server){server.kill('SIGTERM');await Promise.race([closed,new Promise(r=>setTimeout(r,1000))]);if(server.exitCode===null&&!server.signalCode)server.kill('SIGKILL');}
 if(owned&&JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
 const replay=spawnSync(process.execPath,['tools/physics-pursuit-native-audit.mjs',evidence],{encoding:'utf8'});report.exactPostCaptureReplay={passed:replay.status===0,stderr:replay.stderr};
 report.sourceAfter=hashes(gameRoot);report.sourceStable=JSON.stringify(before)===JSON.stringify(report.sourceAfter);report.liveAfter=hashes(root);report.liveStable=JSON.stringify(liveBefore)===JSON.stringify(report.liveAfter);report.passed=report.results.length===scenarios.length&&report.results.every(r=>r.passed)&&report.sourceStable&&report.exactPostCaptureReplay.passed;
 fs.writeFileSync(path.join(evidence,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({evidence,passed:report.passed,sourceStable:report.sourceStable,liveStable:report.liveStable,failure:report.failure}));if(!report.passed)process.exitCode=1;
}
