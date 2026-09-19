import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium,waitForRuntimeAssets} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {gpuReservation,sha256} from './class-skill-vfx-support.mjs';
const root=process.cwd(),base=path.resolve('output/vfx-dash-art-v2'),integration=path.resolve('output/dash-post-mixer-integration-v1');
const out=path.join(base,'native-'+new Date().toISOString().replace(/[:.]/g,'-'));
const report={at:new Date().toISOString(),promoted:false,scope:'Six artistic paired fixture frames plus ONE real network input: local and remote all rendered frames, including no new event and terminal interpolation. No global/physics matrix.',captures:[],errors:[],clients:[]};
const authorization=JSON.parse(await fs.readFile(path.join(base,'gpu-window.json'),'utf8'));assert.equal(authorization.authorized,true,'Await Environment/Combat coordinated window and frozen main');
let browser,server,release;
const hashes=async files=>Object.fromEntries(await Promise.all(Object.keys(files).map(async f=>[f,sha256(await fs.readFile(path.join(root,f)))])));
const verify=async(directory,files)=>{for(const [f,h]of Object.entries(files))assert.equal(sha256(await fs.readFile(path.join(directory,f))),h,'Source mismatch '+f);};
const observer=String.raw`
;(()=>{const trace={active:false,frames:[],inputs:[],calls:[],last:new Map(),revisions:new WeakMap(),revision:0,renderRevision:0,castOrdinals:new Map(),observedEvents:[]};window.__dashSocketProbe=trace;
 for(const type of ['keydown','keyup'])window.addEventListener(type,e=>trace.inputs.push({type,code:e.code,trusted:e.isTrusted,at:performance.now()}),true);
 function observeEventRevision(history,trace){
  const relevant=history.filter(e=>e.skillId==='warrior_cleaving_dash'&&['cast','release','travel','end'].includes(e.phase));
  for(const e of relevant)if(!trace.revisions.has(e)){
   const revision=++trace.revision,ordinal=(trace.castOrdinals.get(e.castId)||0)+1;trace.revisions.set(e,revision);trace.castOrdinals.set(e.castId,ordinal);
   trace.observedEvents.push({revision,castId:e.castId,eventOrdinalWithinCast:ordinal,phase:e.phase,authoritativeSequence:e.sequence??null,time:e.time,terminal:!!e.terminal,origin:e.origin?{...e.origin}:null,target:e.target?{...e.target}:null,emitter:e.emitter?{...e.emitter}:null});
  }
  const event=relevant.at(-1),motion=relevant.findLast(e=>e.phase!=='end'),revision=event?trace.revisions.get(event):0,previousRevision=trace.renderRevision;
  const fresh=!!event&&revision!==previousRevision;trace.renderRevision=revision;
  return {event,motion,revision,previousRevision,fresh};
 }
 const transform=classSkillVfx.updateDashTransform.bind(classSkillVfx);
 classSkillVfx.updateDashTransform=(id,t)=>{const result=transform(id,t);if(trace.active){const call={id,time:game.survivalTime,accepted:result,emitter:{...t.emitter}};trace.last.set(id,call);trace.calls.push(call);}return result;};
 const render=cinematicPipeline.render.bind(cinematicPipeline);
 cinematicPipeline.render=(...args)=>{const result=render(...args);if(trace.active){
  const observed=observeEventRevision(skillPresentationHistory,trace),e=observed.motion;
  if(e){const local=e.local,remote=local?null:remotePlayers.get(e.actorId),visual=local?heroVisual:remote?.visual,socket=visual?.muzzle||visual?.weapon;
   if(socket){const drawn=socket.getWorldPosition(new THREE.Vector3()),pool=classSkillVfx.getStats().dash,r=pool.records.find(r=>r.id===e.castId),mesh=scene.getObjectByName('DashSteelRibbonArt2');
    const arcSlots=[];if(mesh)for(let i=0;i<64;i++)if(mesh.geometry.attributes.aClock.array[i*4+2]>0&&mesh.geometry.attributes.aStyle.array[i*4]<1.5)arcSlots.push(i);
    const arc=mesh?Array.from(mesh.geometry.attributes.aFrom.array.slice(0,3)):null;
    const tip=r?.headSegment>=0?Array.from(mesh.geometry.attributes.aTo.array.slice(r.headSegment*3,r.headSegment*3+3)):null;
    const rootMesh=local?player.mesh:remote.mesh;const rootPosition=rootMesh.getWorldPosition(new THREE.Vector3());
    const distance=p=>p?Math.hypot(p[0]-drawn.x,p[1]-drawn.y,p[2]-drawn.z):null;
    trace.frames.push({wall:performance.now(),time:game.survivalTime,local,castId:e.castId,eventPhase:observed.event.phase,eventTime:observed.event.time,eventRevision:observed.revision,previousRenderRevision:observed.previousRevision,fresh:observed.fresh,motionPhase:e.phase,motionOrigin:e.origin?{...e.origin}:null,motionTarget:e.target?{...e.target}:null,terminal:r?.terminal??false,following:r?.following??false,preparing:r?.preparing??false,released:r?.released??false,
     received:e.emitter,drawn:drawn.toArray(),arcSlots,arcSlotRead:0,recordOrdinal:pool.records.findIndex(r=>r.id===e.castId),arc,tip,arcError:distance(arc),tipError:distance(tip),poolError:distance(r?.lastEmitter),receivedError:e.emitter?drawn.distanceTo(new THREE.Vector3(e.emitter.x,e.emitter.y,e.emitter.z)):null,
     root:rootPosition.toArray(),target:remote?.targetPosition.toArray(),interpolationDistance:remote?rootPosition.distanceTo(remote.targetPosition):null,callback:trace.last.get(e.castId),poolRecords:pool.records.length,headSegment:r?.headSegment,active:pool.active,clock:pool.clock});
   }
  }
 }return result;};})();`;
try{
 release=await gpuReservation();await fs.mkdir(out,{recursive:true});report.authorization=authorization;
 const protectedFiles=JSON.parse(await fs.readFile(path.join(base,'live-before.json'),'utf8')).files;
 const pre=await hashes(protectedFiles);assert.deepEqual(pre,protectedFiles);report.livePreCapture={at:new Date().toISOString(),files:pre};await fs.writeFile(path.join(out,'live-pre-capture.json'),JSON.stringify(report.livePreCapture,null,2));
 const manifest=JSON.parse(await fs.readFile(path.join(integration,'candidate-manifest.json'),'utf8'));
 assert.equal(manifest.sources['src/main.js'],authorization.mainSHA256,'Main freeze changed');
 report.integrationManifest=manifest;await verify(path.join(integration,'baseline'),manifest.baselineSources);await verify(path.join(integration,'candidate'),manifest.sources);
 const freeze=JSON.parse(await fs.readFile(path.join(base,'freeze-manifest.json'),'utf8'));report.vfxFreeze=freeze;
 await verify(path.join(base,'candidate'),freeze.allCandidateFiles);
 const snapshot=path.join(out,'snapshot');await fs.cp(path.join(integration,'baseline'),snapshot,{recursive:true});
 const main=await fs.readFile(path.join(integration,'candidate/src/main.js'),'utf8');await fs.writeFile(path.join(snapshot,'src/main.js'),main);
 await fs.cp(path.join(base,'candidate'),path.join(snapshot,'src/vfx-dash-staged'),{recursive:true});
 await fs.copyFile(path.join(root,'tools/dash-art2-vfx-preview.html'),path.join(snapshot,'src/dash-art-vfx-preview.html'));
 const a=main.indexOf('function presentClassSkill('),b=main.indexOf('\n// Reconstruct enduring visuals',a);assert(a>0&&b>a);const adapter=main.slice(a,b);
 await fs.writeFile(path.join(snapshot,'src/dash-adapter-literal.js'),`export function createLiteralPresenter(context){return new Function('context',${JSON.stringify(`with(context){${adapter}\nreturn presentClassSkill;}`)})(context);}`);
 await fs.writeFile(path.join(out,'socket-observer.js'),observer);report.observerSHA256=sha256(observer);report.adapterSHA256=sha256(adapter);
 await verify(snapshot,{...manifest.baselineSources,'src/main.js':authorization.mainSHA256});report.snapshotPreCaptureVerified=true;
 process.chdir(snapshot);server=await localServer();browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=metal','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const fixtureContext=await browser.newContext({viewport:{width:2880,height:900},recordVideo:{dir:out,size:{width:2880,height:900}}}),page=await fixtureContext.newPage();
 const errors=p=>{p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});};errors(page);
 await page.goto(server.origin+'/src/dash-art-vfx-preview.html');await page.waitForFunction(()=>window.dashArt?.ready,null,{timeout:60000});
 for(const [t,q,rm]of [[.08,'high',false],[.30,'high',false],[.50,'high',false],[.83,'high',false],[.30,'low',true],[.50,'low',true]]){
  const state=await page.evaluate(args=>window.dashArt.sample(...args),[t,q,rm]),gate=await page.evaluate(()=>window.dashArt.audit());
  const file=`${q}${rm?'-reduced':''}-${t}.png`;await page.screenshot({path:path.join(out,file)});report.captures.push({file,sha256:sha256(await fs.readFile(path.join(out,file))),state,gate});assert.equal(state.glError,0);assert.ok(state.heroMaterials.every(m=>!m.transparent&&m.depthWrite));assert.equal(state.contactDelta,state.events.filter(e=>e.phase==='impact').length);
 }
 report.silhouette={threshold:.65,passed:report.captures.every(c=>c.gate.every(g=>g.preservedFraction>=.65))};
 await page.evaluate(()=>window.dashArt.play());await page.waitForFunction(()=>window.dashArt.stats().time>=1.05);report.fixturePlayback=await page.evaluate(()=>window.dashArt.stats());await page.evaluate(()=>window.dashArt.dispose());const fixtureVideo=page.video();await fixtureContext.close();report.fixtureVideo=await fixtureVideo.path();
 const clients=[];
 for(const name of ['caster','observer']){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),p=await context.newPage(),client={name,context,page:p,received:[],sent:[]};clients.push(client);errors(p);
  p.on('websocket',socket=>{socket.on('framereceived',({payload})=>{try{const m=JSON.parse(String(payload));if(m.type==='skillEvent')client.received.push(m);}catch{}});socket.on('framesent',({payload})=>{try{const m=JSON.parse(String(payload));if(['skillRequest','skill'].includes(m.type))client.sent.push(m);}catch{}});});
  await p.route('**/src/main.js',async route=>{const res=await route.fetch();assert.equal(sha256(await res.text()),authorization.mainSHA256);await route.fulfill({response:res,body:main+observer});});
  await p.route('**/src/vfx/*.js',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);await route.fulfill({status:200,contentType:'text/javascript',body:await fs.readFile(path.join(base,'candidate',name))});});
  await p.goto(server.origin+'/?room=dash-art2-focal&quality=high&ws='+encodeURIComponent(server.origin.replace('http:','ws:')+'/ws'));await waitForRuntimeAssets(p);
  await p.locator('#open-login-button').click();await p.locator('label[for="character-warrior"]').click();await waitForRuntimeAssets(p);await p.locator('#player-name').fill('Dash '+name);await p.locator('#play-button').click();
  await p.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing'&&window.__zombieNightDebug.getState().multiplayer.connected&&window.__zombieNightDebug.getArpgState().skills[1].enabled);
  client.id=await p.evaluate(()=>window.__zombieNightDebug.getState().multiplayer.id);
 }
 const [caster,peer]=clients;
 await peer.page.waitForFunction(id=>window.__zombieNightDebug.getActorMotionState().remote.some(r=>r.id===id&&r.locomotion),caster.id);
 for(const c of clients)await c.page.evaluate(()=>window.__dashSocketProbe.active=true);
 await caster.page.bringToFront();await caster.page.locator('#game-canvas').focus();const aim=await caster.page.evaluate(()=>{const d=window.__zombieNightDebug,p=d.getState().player;return d.projectWorldPosition(p.x,0,p.z-8)});await caster.page.mouse.move(aim.x,aim.y);
 report.before=await caster.page.evaluate(()=>window.__zombieNightDebug.getSkillState());await caster.page.keyboard.press('2');
 await caster.page.waitForFunction(()=>window.__zombieNightDebug.getSkillEvents().some(e=>e.skillId==='warrior_cleaving_dash'&&e.phase==='travel'));
 await caster.page.waitForTimeout(90);await caster.page.screenshot({path:path.join(out,'local-input-travel.png')});await peer.page.screenshot({path:path.join(out,'remote-input-travel.png')});await peer.page.waitForTimeout(900);
 for(const c of clients){
  const data=await c.page.evaluate(()=>{window.__dashSocketProbe.active=false;const t=window.__dashSocketProbe;return {trace:{frames:t.frames,inputs:t.inputs,calls:t.calls,observedEvents:t.observedEvents},events:window.__zombieNightDebug.getSkillEvents(),skills:window.__zombieNightDebug.getSkillState(),vfx:window.__zombieNightDebug.getClassSkillVfxStats(),state:window.__zombieNightDebug.getState()};});
  const video=c.page.video();await c.context.close();report.clients.push({name:c.name,id:c.id,data,received:c.received,sent:c.sent,video:await video.path()});
 }
 for(const c of report.clients){const frames=c.data.trace.frames.filter(f=>f.following);assert.equal(new Set(c.data.trace.observedEvents.map(e=>e.castId)).size,1,'Observer is explicitly single cast');assert.ok(frames.every(f=>f.poolRecords===1&&f.recordOrdinal===0&&f.arcSlots.length===1&&f.arcSlots[0]===0),'Single cast/slot0 assumption invalid');assert.ok(frames.every(f=>f.fresh===(f.eventRevision!==f.previousRenderRevision)),'Bad render revision classification');}
 const active=report.clients.map(c=>{const all=c.data.trace.frames,frames=all.filter(f=>f.following),travel=frames.filter(f=>f.released),between=travel.filter(f=>!f.fresh),terminal=travel.filter(f=>f.terminal);return {name:c.name,frames:frames.length,travel:travel.length,fresh:travel.length-between.length,between:between.length,terminal:terminal.length,maxArcError:Math.max(...frames.map(f=>f.arcError??Infinity)),maxTipError:Math.max(0,...frames.filter(f=>f.tip!==null).map(f=>f.tipError)),maxPoolError:Math.max(...frames.map(f=>f.poolError??Infinity)),maxReceivedGap:Math.max(...frames.map(f=>f.receivedError??0)),remoteTerminalStillInterpolating:terminal.filter(f=>f.interpolationDistance>.001).length,expiredObserved:all.some(f=>!f.following&&f.terminal),inactiveBeforeTerminal:all.filter(f=>f.released&&!f.terminal&&!f.following).length};});
 report.socketMeasurements=active;
 for(const r of active){assert.ok(r.frames>0&&r.travel>0);assert.ok(r.maxArcError<.00001&&r.maxPoolError<.00001,'Drawn socket mismatch '+JSON.stringify(r));assert.ok(r.maxTipError<.00001,'Open endpoint mismatch '+r.name);assert.ok(r.expiredObserved,'Expiry not observed '+r.name);}
 assert.ok(active[1].between>0,'Remote between-event frames not observed');assert.ok(active[1].terminal>0,'Remote terminal tail not observed');
 const own=report.clients[0],other=report.clients[1];assert.ok(own.data.trace.inputs.some(e=>e.code==='Digit2'&&e.trusted));assert.equal(own.data.skills.sequence,report.before.sequence+1);
 const confirmed=own.received.filter(m=>m.id===caster.id&&m.event.skillId==='warrior_cleaving_dash'),remotes=other.received.filter(m=>m.id===caster.id&&m.event.skillId==='warrior_cleaving_dash');assert.deepEqual(confirmed.map(m=>m.event),remotes.map(m=>m.event));assert.equal(confirmed.filter(m=>m.event.phase==='cast').length,1);report.confirmedSameEvents=confirmed.length;
 process.chdir(root);report.livePostCapture=await hashes(protectedFiles);assert.deepEqual(report.livePostCapture,report.livePreCapture.files);report.liveStable=true;
 await verify(path.join(base,'candidate'),freeze.allCandidateFiles);await verify(snapshot,{...manifest.baselineSources,'src/main.js':authorization.mainSHA256});report.sourceStable=true;
 assert.deepEqual(report.errors,[]);assert.ok(report.silhouette.passed,'Silhouette gate');report.technicalPassed=true;report.artisticAccepted=false;
}catch(error){report.technicalPassed=false;report.failure=error.stack;process.exitCode=1;}
finally{process.chdir(root);
 try{if(report.livePreCapture){report.livePostCapture=await hashes(report.livePreCapture.files);assert.deepEqual(report.livePostCapture,report.livePreCapture.files);report.liveStable=true;}if(report.vfxFreeze){await verify(path.join(base,'candidate'),report.vfxFreeze.allCandidateFiles);report.candidateStable=true;}}catch(e){report.technicalPassed=false;report.integrityFailure=e.stack;process.exitCode=1;}
 await browser?.close();await server?.stop();await release?.();report.closedAt=new Date().toISOString();report.resourcesReleased=true;await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,passed:report.technicalPassed,socketMeasurements:report.socketMeasurements,silhouette:report.silhouette,failure:report.failure},null,2));}
