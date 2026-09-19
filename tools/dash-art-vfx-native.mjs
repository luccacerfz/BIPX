import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,waitForRuntimeAssets} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const root=process.cwd(),base=path.resolve('output/vfx-dash-art-v1'),out=path.join(base,'native-'+new Date().toISOString().replace(/[:.]/g,'-'));
const report={at:new Date().toISOString(),syntheticFixture:true,promoted:false,scope:'Paired actual Aldric/ARPG assets/current cinematic pipeline, literal core/adapter. Separate one real input checks pre-mixer emitter versus post-render socket. No physics/global suite.',captures:[],errors:[]};
const window=JSON.parse(await fs.readFile(path.join(base,'gpu-window.json'),'utf8'));
assert.equal(window.authorized,true,'Await current Combat window before acquiring GPU');
let browser,server,release;
const hashes=async dir=>Object.fromEntries(await Promise.all((await fs.readdir(dir)).filter(f=>f.endsWith('.js')).map(async f=>[f,sha256(await fs.readFile(path.join(dir,f)))])));
try{
 report.window=window;release=await gpuReservation();await fs.mkdir(out,{recursive:true});
 const originalLive=JSON.parse(await fs.readFile(path.join(base,'live-before.json'),'utf8')).files;
 const promotionPath=path.join(root,'output/lich-cast-launch-bridge-v3/promotion.json'),promotion=JSON.parse(await fs.readFile(promotionPath,'utf8'));
 const allowedLiveChanges=['src/main.js','server.mjs','src/render/animated-enemies.js'];assert.equal(Object.keys(originalLive).length,39);
 const expectedLive={...originalLive};for(const f of allowedLiveChanges){assert.ok(promotion.after[f]);expectedLive[f]=promotion.after[f];}
 report.preCaptureIntegrity={at:new Date().toISOString(),promotionSHA256:sha256(await fs.readFile(promotionPath)),files:{}};
 for(const [f,h]of Object.entries(expectedLive)){const actual=sha256(await fs.readFile(path.join(root,f)));assert.equal(actual,h,'Unapproved live drift '+f);report.preCaptureIntegrity.files[f]=actual;}
 await fs.writeFile(path.join(out,'live-pre-capture.json'),JSON.stringify(report.preCaptureIntegrity,null,2));
 const snapshot=path.join(out,'snapshot');await fs.cp(path.join(base,'baseline/source'),snapshot,{recursive:true});
 report.sources=JSON.parse(await fs.readFile(path.join(base,'source-manifest.json'),'utf8'));report.candidateSources=await hashes(path.join(base,'candidate'));
 await fs.cp(path.join(base,'candidate'),path.join(snapshot,'src/vfx-dash-staged'),{recursive:true});
 await fs.copyFile('tools/dash-art-vfx-preview.html',path.join(snapshot,'src/dash-art-vfx-preview.html'));
 const main=await fs.readFile(path.join(snapshot,'src/main.js'),'utf8'),a=main.indexOf('function presentClassSkill('),b=main.indexOf('\n// Reconstruct enduring visuals',a);assert(a>0&&b>a);const adapter=main.slice(a,b);report.adapter={main:sha256(main),literal:sha256(adapter)};
 await fs.writeFile(path.join(snapshot,'src/dash-adapter-literal.js'),`export function createLiteralPresenter(context){return new Function('context',${JSON.stringify(`with(context){${adapter}\nreturn presentClassSkill;}`)})(context);}`);
 process.chdir(snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal']});
 const context=await browser.newContext({viewport:{width:2880,height:900},recordVideo:{dir:out,size:{width:2880,height:900}}}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(server.origin+'/src/dash-art-vfx-preview.html');await page.waitForFunction(()=>window.dashArt?.ready,null,{timeout:60000});
 for(const [t,q,rm]of [[.12,'high',false],[.30,'high',false],[.50,'high',false],[.83,'high',false],[.30,'low',true]]){
  const state=await page.evaluate(args=>window.dashArt.sample(...args),[t,q,rm]);const gate=await page.evaluate(()=>window.dashArt.audit());
  const file=`${q}${rm?'-reduced':''}-${t}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,sha256:sha256(await fs.readFile(path.join(out,file))),state,gate});assert.equal(state.glError,0);
  assert.ok(state.heroMaterials.every(m=>!m.transparent&&m.depthWrite));assert.equal(state.contactDelta,state.events.filter(e=>e.phase==='impact').length);
 }
 report.silhouette={threshold:.65,passed:report.captures.every(c=>c.gate.every(g=>g.preservedFraction>=.65))};
 await page.evaluate(()=>window.dashArt.play());await page.waitForFunction(()=>window.dashArt.stats().time>=1.05);report.playback=await page.evaluate(()=>window.dashArt.stats());
 await page.evaluate(()=>window.dashArt.dispose());await context.close();report.fixtureVideo=await page.video().path();
 // Real input probe: candidate served only in this private browser, main appended
 // with a post-render read-only observer. No clocks/poses/gameplay are injected.
 const observer=String.raw`
 ;(() => {const trace={frames:[],inputs:[],active:false};window.__dashSocketProbe=trace;
  for(const type of ['keydown','keyup'])window.addEventListener(type,e=>trace.inputs.push({type,code:e.code,trusted:e.isTrusted,at:performance.now()}),true);
  const render=cinematicPipeline.render.bind(cinematicPipeline);
  cinematicPipeline.render=(...args)=>{const result=render(...args);if(trace.active){
   const e=skillPresentationHistory.findLast(e=>e.skillId==='warrior_cleaving_dash'&&e.phase==='travel');
   if(e&&e.time===game.survivalTime){const socket=(heroVisual.weapon||heroVisual.muzzle).getWorldPosition(new THREE.Vector3());trace.frames.push({wall:performance.now(),time:game.survivalTime,received:e.emitter,drawn:socket.toArray(),root:player.mesh.position.toArray(),event:e,pool:classSkillVfx.getStats().dash,delta:socket.distanceTo(new THREE.Vector3(e.emitter.x,e.emitter.y,e.emitter.z))});}
  }return result;};})();`;
 await fs.writeFile(path.join(out,'socket-observer.js'),observer);report.observerSHA256=sha256(observer);
 const gameContext=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});const gamePage=await gameContext.newPage();
 gamePage.on('pageerror',e=>report.errors.push(e.message));gamePage.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await gamePage.route('**/src/main.js',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:(await res.text())+observer});});
 await gamePage.route('**/src/vfx/*.js',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);await route.fulfill({status:200,contentType:'text/javascript',body:await fs.readFile(path.join(base,'candidate',name))});});
 await gamePage.goto(server.origin+'/?offline=1&quality=high');await waitForRuntimeAssets(gamePage);
 await gamePage.locator('#open-login-button').click();await gamePage.locator('label[for="character-warrior"]').click();await waitForRuntimeAssets(gamePage);await gamePage.locator('#player-name').fill('Dash socket');await gamePage.locator('#play-button').click();await gamePage.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
 await gamePage.locator('#game-canvas').focus();const aim=await gamePage.evaluate(()=>{const d=window.__zombieNightDebug,p=d.getState().player;return d.projectWorldPosition(p.x,0,p.z-8)});await gamePage.mouse.move(aim.x,aim.y);
 report.inputBefore=await gamePage.evaluate(()=>window.__zombieNightDebug.getSkillState());await gamePage.evaluate(()=>window.__dashSocketProbe.active=true);await gamePage.keyboard.press('2');await gamePage.waitForTimeout(400);await gamePage.screenshot({path:path.join(out,'real-input-socket.png')});await gamePage.waitForTimeout(850);
 report.inputProbe=await gamePage.evaluate(()=>{window.__dashSocketProbe.active=false;return {trace:window.__dashSocketProbe,state:window.__zombieNightDebug.getState(),skills:window.__zombieNightDebug.getSkillState(),events:window.__zombieNightDebug.getSkillEvents(),glError:document.querySelector('canvas').getContext('webgl2')?.getError()}});
 const frames=report.inputProbe.trace.frames;assert.ok(frames.length>0,'No fresh travel payload observed');report.socketLag={frames:frames.length,max:Math.max(...frames.map(f=>f.delta)),mean:frames.reduce((n,f)=>n+f.delta,0)/frames.length,scope:'Actual local input; received pre-mixer emitter vs socket after same render. Remote order not measured.'};
 assert.ok(report.inputProbe.trace.inputs.some(e=>e.code==='Digit2'&&e.trusted));assert.equal(report.inputProbe.skills.sequence,report.inputBefore.sequence+1);
 await gameContext.close();report.inputVideo=await gamePage.video().path();
 process.chdir(root);report.candidateStable=JSON.stringify(await hashes(path.join(base,'candidate')))===JSON.stringify(report.candidateSources);
 report.liveAfter={};for(const [f,h]of Object.entries(report.preCaptureIntegrity.files)){const actual=sha256(await fs.readFile(path.join(root,f)));report.liveAfter[f]=actual;assert.equal(actual,h,'Live changed during capture '+f);}
 report.liveProtectedPreserved=true;
 assert.ok(report.candidateStable&&report.liveProtectedPreserved);assert.deepEqual(report.errors,[]);report.technicalPassed=true;report.artisticAccepted=false;
}catch(e){report.technicalPassed=false;report.failure=e.stack;process.exitCode=1;}
finally{process.chdir(root);await browser?.close();await server?.stop();await release?.();report.closedAt=new Date().toISOString();report.resourcesReleased=true;await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.technicalPassed,failure:report.failure,socketLag:report.socketLag,silhouette:report.silhouette},null,2));}
