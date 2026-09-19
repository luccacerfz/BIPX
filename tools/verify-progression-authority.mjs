import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import {evidenceDir} from './quality-browser.mjs';
import {serverDependencyHashes} from './quality-server-source.mjs';
import {launchProtocolServer} from './quality-protocol.mjs';
import {heroMaxHealth,basicAttackSpec,basicPower,createHeroCombatState,resolveIncomingDamage} from '../src/combat/hero-power.mjs';
import {attackStats} from '../src/progression/authority.mjs';
// Balance numbers are read from the shared hero-power/progression modules that the server itself imports, so a retune
// (T1 hero power, T2 upgrades) cannot stale this harness. What stays pinned is behaviour: forged client values are ignored,
// one hit per accepted attack, trusted stacks/level drive damage, and the '+Vida máxima' card grants exactly +18 max HP and heal.
const MAX_HEALTH_STEP=18;
const wire=value=>Number(value.toFixed(2)); // monsterHit.amount / health are sent with two decimals
const takenFrom=(classId,amount)=>resolveIncomingDamage(createHeroCombatState(classId),amount,{now:0}).damage;
const basicHit=(classId,{level=1,stacks={}}={})=>wire(basicAttackSpec(classId).damage*attackStats({stacks,character:classId,weaponTimer:0,prismStormRemaining:0}).damageMultiplier*basicPower(classId,level));
const dependencyHashes=serverDependencyHashes();
const sourcePath=path.resolve('server.mjs');
const sourceRoot=path.dirname(sourcePath);
const candidate=await fs.readFile(sourcePath,'utf8');
const fixture=`
import {grantXp as fixtureGrantXp,createDrop as fixtureCreateDrop,tickProgression as fixtureTickProgression} from ${JSON.stringify(pathToFileURL(sourceRoot+'/src/progression/authority.mjs').href)};
process.on('message',q=>{if(q?.type!=='qa-progression')return;try{
 const room=rooms.get(q.room),client=room?.clients.get(q.clientId); if(!client)throw Error('Fixture client missing');
 let value;
 if(q.action==='quiet'){room.world.monsters.clear();room.world.projectiles.clear();room.world.zombiesToSpawn=0;room.world.nextWaveDelay=1e9;}
 if(q.action==='xp'){fixtureGrantXp(client.state,client.progression,q.amount);}
 if(q.action==='tick'){fixtureTickProgression(client.state,client.progression,Math.max(0,Number(q.dt)||0));}
 if(q.action==='damage'){damageServerPlayer(room,client,q.amount);}
 if(q.action==='drop'){value=fixtureCreateDrop(client.progression,q.kind,q.position,q.data);syncProgression(client.state,client.progression);}
 if(q.action==='target'){room.world.monsters.clear();const m=spawnServerMonster(room,q.x,q.z,q.monsterType||'zombie');m.health=q.health||100;m.maxHealth=m.health;m.speed=0;m.attackCooldown=1e9;value=m.id;}
 if(q.action==='freshCooldown'){client.attackCooldowns.clear();}
 if(q.action==='kill'){const m=room.world.monsters.get(q.monsterId);killServerMonster(room,m,client.id);}
 if(q.action==='rng'){client.progression.random=()=>q.value;}
 syncProgression(client.state,client.progression);
 process.send({id:q.id,result:{ok:true,value,state:client.state,monsters:[...room.world.monsters.values()].map(serializeMonster)}});
}catch(e){process.send({id:q.id,error:e.message})}});
`;
// launchProtocolServer relocates every relative ES module import into an isolated copy; production itself remains untouched.
// Player placement goes through its private `qa-place-player` IPC: the v5 server treats client x/z as budgeted intent, never as a teleport.
const report={passed:false,sourcePath,dependencyHashes,scope:'Production server functions, real Node WebSocket clients; private IPC fixtures grant trusted XP/targets/drops. No public test route and no natural gameplay claim.',checks:[],candidateSha256:crypto.createHash('sha256').update(candidate).digest('hex')};
const delay=ms=>new Promise(r=>setTimeout(r,ms));const sockets=[];let server;let serial=0;
const until=async(test,ms=5000)=>{const end=Date.now()+ms;while(Date.now()<end){const v=test();if(v)return v;await delay(8)}throw Error('Timed out')};
const check=(name,details={})=>{report.checks.push({name,...details});console.log(name)};
function ipc(c,action,data={}){return server.requestFixture('qa-progression',{room:c.room,clientId:c.id,action,...data})}
function send(c,msg){c.socket.send(JSON.stringify(msg))}
async function message(c,p,start=0){return until(()=>c.messages.slice(start).find(p))}
let base;
async function connect(room,character='dwarf',token){const url=new URL(base);url.searchParams.set('room',room);url.searchParams.set('character',character);url.searchParams.set('name','AuthorityQA');if(token)url.searchParams.set('resumeToken',token);const socket=new WebSocket(url);sockets.push(socket);const c={room,socket,messages:[]};socket.addEventListener('message',e=>{const m=JSON.parse(e.data);c.messages.push(m);if(m.type==='welcome'){c.welcome=m;c.id=m.id;c.token=m.resumeToken;c.state=m.selfState}if(m.state&&(m.id===c.id||['runStarted','progressionResult','playerReward'].includes(m.type)))c.state=m.state});await message(c,m=>m.type==='welcome');return c}
async function start(c,id='start'){const from=c.messages.length;send(c,{type:'startRun',requestId:id,state:{character:c.state.character}});await message(c,m=>m.type==='runStarted',from);await ipc(c,'quiet');send(c,{type:'state',state:{x:0,z:0,aimX:0,aimZ:-1}});await delay(25)}
async function command(c,type,args){const requestId=args.requestId??`req${++serial}`;const from=c.messages.length;send(c,{type,runId:c.state.runId,requestId,...args});return message(c,m=>m.type==='progressionResult'&&m.requestId===requestId,from)}
try{
 server=await launchProtocolServer('progression',fixture);base=server.wsUrl;report.fixtureEvidence=server.evidence;
 let c=await connect('authority');await start(c);const lyraHealth=heroMaxHealth('dwarf'),hurt=lyraHealth-takenFrom('dwarf',40);assert.ok(hurt>0&&hurt<lyraHealth);const damaged=await ipc(c,'damage',{amount:40});assert.equal(damaged.state.health,hurt);await until(()=>c.state.health===hurt);assert.equal(c.state.health,hurt);
 send(c,{type:'state',state:{...c.state,health:600,maxHealth:600,level:999,bestLevel:999,xpTotal:999999,score:999999,kills:999,build:['FAKE x999'],progression:{upgradeStacks:{damage:99},upgradeStats:{damageMultiplier:8}}}});await delay(40);let probe=await ipc(c,'read');
 assert.equal(probe.state.health,hurt);assert.equal(probe.state.maxHealth,lyraHealth);assert.equal(probe.state.level,1);assert.equal(probe.state.bestLevel,1);assert.equal(probe.state.xpTotal,0);assert.equal(probe.state.score,0);assert.deepEqual(probe.state.build,[]);assert.deepEqual(probe.state.progression.upgradeStacks,{});
 check('Case1/2: latest-version forged HP600/level999/build/XP/score ignored',{health:hurt,maxHealth:lyraHealth,level:1});
 let target=await ipc(c,'target',{x:0,z:-10,health:100});let from=c.messages.length;send(c,{type:'attack',attack:{kind:'pistol',weapon:'pistol',aimX:0,aimZ:-1,damageMultiplier:8,areaMultiplier:5,cooldownMultiplier:.48,projectileBonus:6,crit:true}});const rifleHit=basicHit('dwarf');let hit=await message(c,m=>m.type==='monsterHit',from);assert.equal(hit.amount,rifleHit);from=c.messages.length;send(c,{type:'attack',attack:{kind:'pistol',weapon:'pistol',aimX:0,aimZ:-1,damageMultiplier:8,cooldownMultiplier:.48}});await delay(90);assert.equal(c.messages.slice(from).filter(m=>m.type==='monsterHit').length,0);probe=await ipc(c,'read');assert.equal(wire(probe.monsters[0].health),wire(100-rifleHit));
 check(`Case3: forged8x damage/.48 cooldown/6projectiles/crit produces one base${rifleHit} hit, immediate repeat rejected`,{rifleHit});
 const bad=await command(c,'chooseUpgrade',{offerId:'invented',upgradeId:'maxHealth'});assert.equal(bad.result.code,'not-offered');
 // .999 is a valid tail-roll that can exhaust all 27 banked offers without
 // selecting maxHealth; .5 keeps this semantic +18 assertion deterministic
 // without claiming a particular natural offer sequence.
 await ipc(c,'rng',{value:.5});probe=await ipc(c,'xp',{amount:50000});c.state=probe.state;let count=0,maxHealthChoice;
 // The shared contract spaces banked level-ups after each choice. The old
 // harness stopped as soon as the first offer closed, so it never reached a
 // legal maxHealth card and misreported the product as losing an offer.
 while(!maxHealthChoice && count < 64){
  if(!c.state.progression.offer){const advanced=await ipc(c,'tick',{dt:28});c.state=advanced.state;if(!c.state.progression.offer)break;}
  const offer=c.state.progression.offer;const id=offer.upgradeIds.includes('maxHealth')?'maxHealth':offer.upgradeIds[0];const args={offerId:offer.id,upgradeId:id,requestId:`legit-${++count}`};const prior=c.state.health;const result=await command(c,'chooseUpgrade',args);assert.equal(result.result.ok,true);c.state=result.state;if(id==='maxHealth'){maxHealthChoice=args;assert.equal(result.state.health,prior+MAX_HEALTH_STEP);assert.equal(result.state.maxHealth,lyraHealth+MAX_HEALTH_STEP)}
 }
 assert.ok(maxHealthChoice);const version=c.state.stateVersion;const hp=c.state.health;let ack=await command(c,'chooseUpgrade',maxHealthChoice);assert.equal(ack.result.duplicate,true);assert.equal(ack.state.stateVersion,version);assert.equal(ack.state.health,hp);
 check('Real XP→server offer→chosen+18 maxHP/heal; duplicate request applies once',{choicesUntilMaxHealth:count});
 const sameChoiceNewId=await command(c,'chooseUpgrade',{...maxHealthChoice,requestId:'new-key-same-choice'});assert.equal(sameChoiceNewId.result.ok,false);
 const runId=c.state.runId,id=c.id,token=c.token,saved=structuredClone(c.state);c.socket.close();await until(()=>c.socket.readyState===3);c=await connect('authority','dwarf',token);assert.equal(c.id,id);assert.equal(c.state.runId,runId);assert.deepEqual(c.state.progression.upgradeStacks,saved.progression.upgradeStacks);assert.deepEqual(c.state.progression.offer,saved.progression.offer);ack=await command(c,'chooseUpgrade',maxHealthChoice);assert.equal(ack.result.duplicate,true);assert.equal(ack.state.health,hp);
 check('Lost choice ACK/reconnect preserves same offer/stacks/HP and receipt idempotency');
 const dropAt={x:12,z:0};/* free ground in the promoted 153-collider layout; lantern-0 now stands on the former x10 z0 */let drop=(await ipc(c,'drop',{kind:'healthPotion',position:dropAt,data:{amount:10}})).value;let pickup={dropId:drop.id,requestId:'potion'};ack=await command(c,'pickup',pickup);assert.equal(ack.result.code,'out-of-range');const placed=await server.placePlayer(c.room,c.id,dropAt);assert.ok(Math.hypot(placed.x-dropAt.x,placed.z-dropAt.z)<.001,'Fixture must place the player exactly on the drop');const before=c.state.health;ack=await command(c,'pickup',pickup);assert.equal(ack.result.ok,true);assert.equal(ack.state.health,Math.min(ack.state.maxHealth,before+10));const healed=ack.state.health;ack=await command(c,'pickup',pickup);assert.equal(ack.result.duplicate,true);assert.equal(ack.state.health,healed);
 const other=await connect('other-owner');await start(other);ack=await command(other,'pickup',{dropId:drop.id});assert.equal(ack.result.code,'missing-drop');
 check('Pickup protocol validates owner/distance and potion heal exactly once');
 const oldRun=c.state.runId;await start(c,'fresh-run');ack=await command(c,'chooseUpgrade',{...maxHealthChoice,runId:oldRun});assert.equal(ack.result.code,'wrong-run');assert.equal(c.state.level,1);assert.equal(c.state.maxHealth,200);assert.deepEqual(c.state.progression.upgradeStacks,{});assert.equal(c.state.progression.drops.length,0);
 check('Explicit restart clears progression/drop/receipt state and rejects prior run commands');
 const warrior=await connect('warrior','warrior');await start(warrior);target=await ipc(warrior,'target',{x:0,z:-2.5,health:100});from=warrior.messages.length;send(warrior,{type:'attack',attack:{kind:'pistol',weapon:'pistol',aimZ:-1}});await delay(40);assert.equal(warrior.messages.slice(from).filter(m=>m.type==='monsterHit').length,0);send(warrior,{type:'attack',attack:{kind:'katana',weapon:'katana',aimX:0,aimZ:-1,damageMultiplier:8,projectileBonus:6}});const swordHit=basicHit('warrior');hit=await message(warrior,m=>m.type==='monsterHit',from);assert.equal(hit.amount,swordHit);assert.ok(swordHit>rifleHit);
 check(`Aldric rejects rifle and retains sword damage ${swordHit}; Lyra rifle remains ${rifleHit}`,{swordHit,rifleHit});
 await ipc(warrior,'rng',{value:0});probe=await ipc(warrior,'xp',{amount:18});warrior.state=probe.state;const offer=warrior.state.progression.offer;assert.ok(offer.upgradeIds.includes('damage'));ack=await command(warrior,'chooseUpgrade',{offerId:offer.id,upgradeId:'damage'});assert.equal(ack.result.ok,true);await ipc(warrior,'freshCooldown');await ipc(warrior,'target',{x:0,z:-2.5,health:100});from=warrior.messages.length;send(warrior,{type:'attack',attack:{kind:'katana',weapon:'katana',aimX:0,aimZ:-1,damageMultiplier:1}});assert.equal(ack.state.progression.upgradeStacks.damage,1);const raisedHit=basicHit('warrior',{level:ack.state.level,stacks:ack.state.progression.upgradeStacks});assert.ok(raisedHit>swordHit);hit=await message(warrior,m=>m.type==='monsterHit',from);assert.equal(hit.amount,raisedHit);
 check(`Legitimate damage choice raises sword hit ${swordHit}→${raisedHit} even when packet claims1x damage`,{level:ack.state.level,stacks:ack.state.progression.upgradeStacks});

 assert.deepEqual(serverDependencyHashes(),dependencyHashes);server.assertClean();report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1}finally{for(const s of sockets)if(s.readyState<2)s.close();report.stderr=server?.stderr()??'';await server?.stop();report.sourceUnchanged=candidate===await fs.readFile(sourcePath,'utf8');await fs.writeFile(path.join(evidenceDir,'progression-authority.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,evidenceDir,failure:report.failure}))}
