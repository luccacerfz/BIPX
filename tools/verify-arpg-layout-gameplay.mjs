import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
import {localServer} from './quality-isolated-server.mjs';
import {createCollisionWorld,moveActor,sweepStatic} from '../src/physics/contacts.mjs';
import {getEnvironmentColliders,ENVIRONMENT_GROUND} from '../src/render/environment-layout.js';

// Private setup is appended to the isolated HTTP response, never production main.
// Casts enter through the actual GUI keyboard listener; boss AI keeps its real tick.
const fixture=`
const layoutQa={active:false,samples:[]};
const layoutOriginalUpdate=updateZombies;
updateZombies=function(dt){
  const before=layoutQa.active?zombies.map(z=>({id:z.id,x:z.mesh.position.x,z:z.mesh.position.z,radius:z.radius})):null;
  const result=layoutOriginalUpdate(dt);
  if(before)layoutQa.samples.push({dt,before,after:zombies.map(z=>({id:z.id,x:z.mesh.position.x,z:z.mesh.position.z,radius:z.radius,visited:z.navigation?.visited||0,planned:!!z.navigation?.planned,reached:z.navigation?.reached,waypoints:z.navigation?.waypoints})),budget:zombieNavigationBudget,indexCleared:zombieActorIndex===null});
  return result;
};
window.__layoutQa={
 prepare({position,targets=[]}){
  layoutQa.active=false;clearPlayerInput();clearEntities();audioManager.samples?.reset();
  classSkillState=createSkillState(player.character);skillPresentationHistory.length=0;
  game.soloRunId=crypto.randomUUID();game.perfStressImmortal=false;
  player.health=player.maxHealth=1000000;player.shotCooldown=1000000;game.shooting=false;
  game.zombiesToSpawn=0;game.nextWaveDelay=1000000;game.trapTimer=1000000;
  const p=findFreePosition(collisionWorld,{...position,radius:.64},{maxDistance:16});
  if(!p.found)throw Error('No fixture player placement');
  player.position.set(p.x,0,p.z);player.mesh.position.copy(player.position);heroVisualMotion.initialized=false;
  for(const t of targets){const z=spawnZombie(t.x,t.z,t.type||'zombie',{maxHealth:10000,health:10000});if(!z)throw Error('No target placement');z.speed=t.speed??3.3;z.freezeTimer=t.freeze||0;z.attackCooldown=1000000;}
  publishArpgState();layoutQa.samples=[];layoutQa.active=true;
  return this.read();
 },
 read(){return {player:{x:player.position.x,z:player.position.z},targets:zombies.map(z=>({id:z.id,type:z.type,x:z.mesh.position.x,z:z.mesh.position.z,radius:z.radius,health:z.health,freeze:z.freezeTimer,stun:z.stunTimer||0})),samples:layoutQa.samples};},
 stop(){layoutQa.active=false;return this.read();}
};`;
const source=fs.readFileSync('src/main.js','utf8'),instrumented=source+fixture;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const world=createCollisionWorld({colliders:getEnvironmentColliders(),bounds:ENVIRONMENT_GROUND});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const characters=(process.env.BIPX_LAYOUT_CHARACTERS||'warrior,dwarf').split(',');
assert.ok(characters.length&&characters.every(c=>['warrior','dwarf'].includes(c)));
const results=[];let browser,server;
try{
 server=await localServer();
 browser=await chromium.launch({channel:'chrome',headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 for(const character of characters){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:evidenceDir,size:{width:1440,height:900}}});
  const page=await context.newPage(),telemetry=attachQualityTelemetry(page,`layout-${character}`),result={character,passed:false,cases:[]};
  telemetry.markFixture();telemetry.report.browserLaunch={channel:'chrome',headless:false};
  telemetry.report.scope='Synthetic placement/HP/control fixtures, real rendered runtime and boss AI; skills via actual menu/mouse/1-2-3 GUI input. No simulation function replaced; updateZombies wrapped for read-only trace. Not natural gameplay or performance benchmark.';
  telemetry.report.instrumentation={sourceSha256:hash(source),servedSha256:hash(instrumented),fixtureSha256:hash(fixture)};
  async function prepare(config){await page.keyboard.up('Space');await page.mouse.up();const r=await page.evaluate(c=>window.__layoutQa.prepare(c),config);await page.waitForTimeout(350);await page.locator('#game-canvas').focus();return r;}
  async function cast(slot,target){
   const screen=await page.evaluate(t=>window.__zombieNightDebug.projectWorldPosition(t.x,0,t.z),target);
   await page.mouse.move(screen.x,screen.y);await page.waitForTimeout(80);
   await page.waitForFunction(slot=>window.__zombieNightDebug.getArpgState().skills[slot].enabled,slot);
   const sequence=await page.evaluate(()=>window.__zombieNightDebug.getSkillState().sequence);
   await page.keyboard.press(String(slot+1));
   await page.waitForFunction(n=>window.__zombieNightDebug.getSkillState().sequence>n,sequence);
   const receipt=await page.evaluate(()=>window.__zombieNightDebug.getSkillEvents().filter(e=>e.phase==='cast').at(-1));
   if(receipt.skillId==='warrior_war_cry')await page.waitForFunction(id=>{const buff=window.__zombieNightDebug.getSkillState().buff;return buff?.castId===id&&buff.remaining>0},receipt.castId);
   else await page.waitForFunction(id=>window.__zombieNightDebug.getSkillEvents().some(e=>e.castId===id&&(e.phase==='impact'||e.phase==='travel'&&e.terminal)),receipt.castId);
   return receipt;
  }
  try{
   await page.route('**/src/main.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:instrumented}));
   await page.goto(server.origin+'/?offline=1&quality=high',{waitUntil:'domcontentloaded'});await waitForRuntimeAssets(page,telemetry);
   await page.locator('#open-login-button').click();await page.locator(`label[for="character-${character}"]`).click();await waitForRuntimeAssets(page,telemetry);
   await page.locator('#player-name').fill(`Layout ${character}`);await page.locator('#play-button').click();await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing');
   if(character==='warrior'){
    const initial=await prepare({position:{x:15.80896918313038,z:8.612477431631392},targets:[{x:23,z:15,type:'bloodCow',speed:3.3}]});
    assert.ok(dist(initial.targets[0],{x:23.635399692273165,z:15.943486465505979})<1e-5,'Must reproduce exact free boss start');
    await telemetry.capture('boss-maintenance-start');
    await page.waitForFunction(()=>{const q=window.__layoutQa.read();return Math.hypot(q.targets[0].x-q.player.x,q.targets[0].z-q.player.z)<=2.72},null,{timeout:15000});
    const final=await page.evaluate(()=>window.__layoutQa.stop());
    assert.ok(final.samples.length>60);assert.ok(final.samples.some(s=>s.after.some(a=>a.planned&&a.visited>1)));
    for(const s of final.samples){assert.ok(s.budget>=0&&s.budget<=4);assert.ok(s.indexCleared);for(const a of s.after){const b=s.before.find(b=>b.id===a.id);assert.ok(a.visited<=768);assert.ok(dist(a,b)<=3.3*Math.min(.1,s.dt)+.0002);assert.equal(sweepStatic(world,b,a,a.radius,{kind:'actor'}),null,'Boss accepted segment crosses cover');}}
    result.cases.push({name:'exact-maintenance-boss-real-AI',initial,final});await telemetry.capture('boss-maintenance-arrived');
    for(const id of ['crypt-entry-wall','fallen-beam-1'])for(const slot of [1,2]){
     const c=getEnvironmentColliders().find(c=>c.id===id),yaw=c.yaw||0;
     const offset=c.halfZ+.64+1.5,position={x:c.x+Math.sin(yaw)*offset,z:c.z+Math.cos(yaw)*offset};
     const initial=await prepare({position});const receipt=await cast(slot,c);await page.waitForTimeout(200);
     const final=await page.evaluate(()=>window.__layoutQa.stop()),events=await page.evaluate(id=>window.__zombieNightDebug.getSkillEvents().filter(e=>e.castId===id),receipt.castId),travel=events.filter(e=>e.phase==='travel');
     assert.ok(travel.length);assert.ok(travel.at(-1).terminal);assert.ok(dist(initial.player,final.player)<(slot===1?8:7)-.1);
     for(const e of travel)assert.equal(sweepStatic(world,e.origin,e.target,.64,{kind:'actor'}),null);
     const valid=moveActor(world,{...final.player,radius:.64},{x:0,z:0});assert.equal(valid.unresolved,false);assert.ok(dist(valid,final.player)<.0002);
     result.cases.push({name:`${id}-${slot===1?'dash':'shield'}`,initial,final,events});await telemetry.capture(`${id}-${slot}`);
    }
    await prepare({position:{x:-13.4,z:-7}});const receipt=await cast(0,{x:-13.4,z:-11});
    assert.ok(await page.evaluate(()=>window.__zombieNightDebug.getSkillState().buff?.remaining>0));
    result.cases.push({name:'garden-war-cry',receipt});await telemetry.capture('garden-war-cry');
   }else{
    for(const slot of [0,1,2]){
     const initial=await prepare({position:{x:12.3,z:-12.7},targets:[{x:12.3,z:-19.7,freeze:20}]});
     const receipt=await cast(slot,initial.targets[0]);await page.waitForTimeout(160);
     const final=await page.evaluate(()=>window.__layoutQa.stop()),events=await page.evaluate(id=>window.__zombieNightDebug.getSkillEvents().filter(e=>e.castId===id),receipt.castId),impact=events.find(e=>e.phase==='impact');
     assert.ok(impact);assert.ok(dist(initial.player,impact.target)<dist(initial.player,initial.targets[0])-.5);
     assert.equal(final.targets[0].health,initial.targets[0].health,'AOE must respect crypt LOS');
     if(slot===2){await page.waitForFunction(()=>window.__zombieNightDebug.getClassSkillVfxStats().states.gravity?.depthValid);const p=await page.evaluate(()=>window.__zombieNightDebug.getPresentationStats());assert.equal(p.pipeline.depth.passes,1);assert.ok(p.pipeline.depth.adapted>0);result.depth=p.pipeline.depth;}
     result.cases.push({name:`crypt-projectile-${slot}`,initial,final,events});await telemetry.capture(`crypt-projectile-${slot}`);
    }
   }
   result.integrity=await page.evaluate(()=>window.__zombieNightDebug.getRenderIntegrity());assert.equal(result.integrity.invisibleThreats,0);telemetry.assertClean();result.passed=true;
  }catch(error){result.failure=error.stack;result.last=await page.evaluate(()=>window.__layoutQa?.stop()).catch(()=>null);telemetry.fail(error);process.exitCode=1;}
  finally{await telemetry.save({measurements:result});result.sourceChanged=telemetry.report.sourceChangedDuringRun;if(result.sourceChanged){result.passed=false;process.exitCode=1;}const video=page.video();await context.close();if(video)await video.saveAs(path.join(evidenceDir,`layout-${character}.webm`));results.push(result);}
 }
}finally{
 await browser?.close();await server?.stop();
 const report={passed:results.length===characters.length&&results.every(r=>r.passed),requestedCharacters:characters,syntheticFixture:true,results};
 fs.writeFileSync(path.join(evidenceDir,'layout-gameplay.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({evidenceDir,passed:report.passed,results:results.map(({character,passed,failure,sourceChanged,cases})=>({character,passed,failure,sourceChanged,cases:cases.map(c=>c.name)}))},null,2));
}
