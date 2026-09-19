import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, waitForRuntimeAssets, evidenceDir, redactPrivate } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
const lock='/tmp/bipx-arpg-gpu.lock',token=crypto.randomUUID();
try{fs.mkdirSync(lock)}catch{console.log('GPU occupied; no browser launched');process.exit(75)}
fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({owner:'combat-network',pid:process.pid,token,created:new Date().toISOString()}));
const report={passed:false,scope:'Two actual browsers, real menu/keyboard inputs; no target/HP/XP fixtures. Transport close is injected only to reproduce reconnect; gameplay functions are unchanged. Not physical mobile or long multiplayer soak.',casts:[]},clients=[];
let browser,server;
async function join(character,name){
 const context=await browser.newContext({viewport:{width:1280,height:800},recordVideo:{dir:evidenceDir,size:{width:1280,height:800}}});
 await context.addInitScript(c=>{
   localStorage.setItem('bipx-character',c);
   const Native=window.WebSocket;let current;
   window.WebSocket=class extends Native{constructor(...args){super(...args);current=this;}};
   window.__arpgNetworkClose=()=>current?.close();
  },character);
 const page=await context.newPage(),telemetry=attachQualityTelemetry(page,name);telemetry.report.browserLaunch={channel:'chrome',headless:false};const c={context,page,telemetry,received:[],sent:[]};clients.push(c);
 page.on('websocket',socket=>{socket.on('framereceived',({payload})=>{try{c.received.push(JSON.parse(String(payload)))}catch{}});socket.on('framesent',({payload})=>{try{c.sent.push(JSON.parse(String(payload)))}catch{}})});
 await page.goto(`${server.origin}/?room=arpg-network&ws=${encodeURIComponent(server.origin.replace('http:','ws:')+'/ws')}`,{waitUntil:'domcontentloaded'});
 await waitForRuntimeAssets(page,telemetry);await page.locator('#open-login-button').click();await page.locator(`label[for="character-${character}"]`).click();await waitForRuntimeAssets(page,telemetry);await page.locator('#player-name').fill(name);await page.locator('#play-button').click();
 await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing'&&window.__zombieNightDebug.getState().multiplayer.connected&&window.__zombieNightDebug.getArpgState().skills.some(s=>s.enabled));
 c.id=await page.evaluate(()=>window.__zombieNightDebug.getState().multiplayer.id);return c;
}
try{
 server=await localServer();browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const warrior=await join('warrior','arpg-network-warrior'),dwarf=await join('dwarf','arpg-network-dwarf');
 report.motion=[];
 for(const mover of [warrior,dwarf]){
  const observer=mover===warrior?dwarf:warrior;
  await observer.page.waitForFunction(id=>window.__zombieNightDebug.getActorMotionState().remote.some(p=>p.id===id&&p.locomotion),mover.id);
  await observer.page.evaluate(()=>{window.__remoteMotionSamples=[];window.__remoteMotionSampling=true;const tick=()=>{if(!window.__remoteMotionSampling)return;window.__remoteMotionSamples.push(window.__zombieNightDebug.getActorMotionState());requestAnimationFrame(tick)};requestAnimationFrame(tick)});
  await mover.page.bringToFront();await mover.page.locator('#game-canvas').focus();await mover.page.keyboard.down('i');await mover.page.keyboard.down('d');await mover.page.waitForTimeout(750);await mover.page.keyboard.up('d');await mover.page.keyboard.up('i');await mover.page.waitForTimeout(350);await observer.page.waitForFunction(id=>window.__zombieNightDebug.getActorMotionState().remote.find(p=>p.id===id)?.motion.speed<.2,mover.id,{timeout:3000});
  const samples=await observer.page.evaluate(()=>{window.__remoteMotionSampling=false;return window.__remoteMotionSamples});
  const peerSamples=samples.flatMap(s=>s.remote.filter(p=>p.id===mover.id));
  assert.ok(peerSamples.some(p=>p.motion.speed>.5),'Remote rendered locomotion never moved');
  assert.ok(peerSamples.at(-1).motion.speed<.2,'Remote actor did not stop after interpolation settled');
  assert.ok(peerSamples.every(p=>p.position.every(Number.isFinite)&&Number.isFinite(p.motion.speed)));
  for(const p of peerSamples){assert.equal(p.motion.x,p.position[0]);assert.equal(p.motion.z,p.position[2]);for(const foot of p.locomotion?.footContacts??[])assert.ok(foot.position.every(Number.isFinite));}
  report.motion.push({mover:mover.id,samples:peerSamples,scope:'Natural keyboard strafe and stop, actual interpolated mesh sampler and finite foot poses. Not sole-contact/no-slide approval.'});
  await observer.telemetry.capture('remote-strafe-stop');
 }
 for(const c of [warrior,dwarf]){
  const peer=c===warrior?dwarf:warrior;await c.page.bringToFront();await c.page.locator('#game-canvas').focus();await c.page.keyboard.down('i');
  for(let slot=0;slot<3;slot++){
   await c.page.waitForFunction(slot=>document.querySelector(`[data-arpg-slot="${slot}"]`)?.dataset.state==='ready',slot);
   const from=peer.received.length;await c.page.keyboard.press(String(slot+1));
   await c.page.waitForFunction(slot=>window.__zombieNightDebug.getArpgState().skills[slot].cooldownRemaining>0,slot);
   await c.page.waitForTimeout(1100);
   const event=peer.received.slice(from).find(m=>m.type==='skillEvent'&&m.id===c.id&&m.event.phase==='cast');assert.ok(event,'Peer missing confirmed cast');
   const matching=peer.received.slice(from).filter(m=>m.type==='skillEvent'&&m.event.castId===event.event.castId&&m.event.phase==='cast');assert.equal(matching.length,1);
   const own=c.received.find(m=>m.type==='skillEvent'&&m.event.castId===event.event.castId&&m.event.phase==='cast');assert.deepEqual(own.event,event.event);
   report.casts.push({id:c.id,slot,skillId:event.event.skillId,castId:event.event.castId,peerConfirmed:true});
   if(event.event.skillId==='dwarf_explosive_cannon'){
    const presentation=await peer.page.evaluate(id=>({vfx:window.__zombieNightDebug.getClassSkillVfxStats(),events:window.__zombieNightDebug.getSkillEvents().filter(e=>e.castId===id),pipeline:window.__zombieNightDebug.getPresentationStats().pipeline}),event.event.castId);
    const fire=presentation.vfx.cannon?.casts.find(r=>r.id===event.event.castId);assert.ok(fire,'Remote cannon presentation missing');
    assert.ok(fire.originBridge.queries>0,'Remote visual sweep was not called');
    assert.ok(!['missing-sweep','invalid-sweep','missing-socket'].includes(fire.originBridge.fallback),'Remote animated socket/callback unavailable');
    const impact=presentation.events.find(e=>e.phase==='impact');if(impact)assert.ok(Math.hypot(fire.hit[0]-impact.target.x,fire.hit[1]-impact.target.y,fire.hit[2]-impact.target.z)<1e-8);
    report.remoteCannon=presentation;await peer.telemetry.capture('remote-cannon');
   }
   if(slot===1)await c.telemetry.capture('second-skill');
  }
  await c.page.keyboard.up('i');await c.page.waitForFunction(()=>window.__zombieNightDebug.getSkillState().lock<=0);await c.page.keyboard.press('Space',{delay:400});
 }
 assert.equal(new Set(report.casts.map(c=>c.skillId)).size,6);
 assert.ok(warrior.sent.some(m=>m.type==='attack'&&m.attack.kind==='katana'));assert.ok(dwarf.sent.some(m=>m.type==='attack'&&m.attack.kind==='pistol'));
 const common=warrior.received.filter(m=>m.type==='worldState'&&m.world.monsters.length).findLast(m=>dwarf.received.some(n=>n.type==='worldState'&&n.world.serverTime===m.world.serverTime));
 assert.ok(common);const other=dwarf.received.find(m=>m.type==='worldState'&&m.world.serverTime===common.world.serverTime);assert.deepEqual(common.world,other.world);report.sharedTick={serverTime:common.world.serverTime,monsters:common.world.monsters.length};
 const before=await dwarf.page.evaluate(()=>({hud:window.__zombieNightDebug.getArpgState(),state:window.__zombieNightDebug.getState()}));
 const welcomeCount=dwarf.received.filter(m=>m.type==='welcome').length;await dwarf.page.evaluate(()=>window.__arpgNetworkClose());await dwarf.page.waitForFunction(()=>!window.__zombieNightDebug.getState().multiplayer.connected);
 await dwarf.page.waitForFunction(()=>window.__zombieNightDebug.getState().multiplayer.connected);
 for(let i=0;i<60&&dwarf.received.filter(m=>m.type==='welcome').length===welcomeCount;i++)await dwarf.page.waitForTimeout(100);
 const welcome=dwarf.received.filter(m=>m.type==='welcome').at(-1);assert.ok(welcome.resumed);assert.equal(welcome.id,dwarf.id);assert.equal(welcome.selfState.skills.sequence,3);assert.ok(welcome.selfState.skills.resource<100);report.reconnect={sameId:true,sequence:welcome.selfState.skills.sequence,resource:welcome.selfState.skills.resource};
 const late=await join('warrior','arpg-network-late');const lateWelcome=late.received.find(m=>m.type==='welcome');assert.ok(lateWelcome.players.some(p=>p.id===dwarf.id&&p.state.skills.sequence===3));assert.ok(lateWelcome.world.monsters.length);report.lateJoin={players:lateWelcome.players.length,monsters:lateWelcome.world.monsters.length};
 for(const c of clients){await c.telemetry.capture('integrated');c.telemetry.assertClean();}
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{
 for(const c of clients){if(report.failure)c.telemetry.fail(Error(report.failure));await c.telemetry.save();await c.context.close();}
 await browser?.close();await server?.stop();if(JSON.parse(fs.readFileSync(path.join(lock,'owner.json'))).token===token)fs.rmSync(lock,{recursive:true});
 report.sourceStable=clients.every(c=>!c.telemetry.report.sourceChangedDuringRun);fs.writeFileSync(path.join(evidenceDir,'arpg-network.json'),JSON.stringify(redactPrivate(report),null,2));console.log(JSON.stringify({evidenceDir,...report}));
}
