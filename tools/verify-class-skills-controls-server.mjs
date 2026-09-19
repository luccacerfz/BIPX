import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchProtocolServer,connectProtocolClient,protocolMessage as message,startProtocolRun,closeProtocolClient,delay} from './quality-protocol.mjs';
const clients=[],checks=[],server=await launchProtocolServer('arpg-v2-controls'),report={passed:false,scope:'Real authoritative WebSockets; explicitly arranged stationary enemies/positions through private IPC. Not natural gameplay.',...server.evidence,checks};
const send=(c,m)=>c.socket.send(JSON.stringify(m));let serial=0;
async function setup(name,character,targets){const c=await connectProtocolClient(server.wsUrl+`?room=${name}&character=${character}`,clients);await startProtocolRun(c,character);await server.placePlayer(name,c.id,{x:-4,z:0});const monsters=await server.arrangeCombat(name,targets);for(let i=0;i<targets.length;i++)assert.ok(Math.hypot(monsters[i].x-targets[i].x,monsters[i].z-targets[i].z)<.001,'Fixture must begin at the intended collision-free coordinates');return {c,monsters,name};}
async function cast(c,slot){const requestId=`control-${++serial}`,from=c.messages.length;send(c,{type:'skill',requestId,runId:c.authority.runId,slot,aimX:1,aimZ:0});const result=await message(c,m=>m.type==='skillResult'&&m.requestId===requestId,from);assert.ok(result.result.ok);return {from,castId:result.result.castId};}
const world=async(c,predicate,from=0)=> (await message(c,m=>m.type==='worldState'&&predicate(m.world),from,12000)).world;
try{
 const buff=await setup('buff','warrior',[{x:0,z:0,health:1000}]);const observer=await connectProtocolClient(server.wsUrl+'?room=buff',clients);const started=await cast(buff.c,0);
 await world(buff.c,w=>w.skillStates.some(s=>s.id===buff.c.id&&s.skills.buff?.remaining>7),started.from);await delay(900);
 let from=observer.messages.length;send(buff.c,{type:'attack',attack:{kind:'katana',weapon:'katana',aimX:1,aimZ:0,damageMultiplier:999}});
 const boosted=await message(observer,m=>m.type==='playerAttack',from);assert.equal(boosted.attack.damageMultiplier,2.7);
 const hit=await message(observer,m=>m.type==='monsterHit',from);assert.ok(hit.amount>14);
 await world(buff.c,w=>w.skillStates.some(s=>s.id===buff.c.id&&!s.skills.buff),buff.c.messages.length);
 from=observer.messages.length;send(buff.c,{type:'attack',attack:{kind:'katana',weapon:'katana',aimX:1,aimZ:0}});assert.equal((await message(observer,m=>m.type==='playerAttack',from)).attack.damageMultiplier,2);
 checks.push('War cry authoritative basic damage multiplier increases to2.7 then expires to2; forged modifier ignored');
 const dash=await setup('dash','warrior',[{x:0,z:0,health:1},{x:2,z:0,health:1000}]);const dc=await cast(dash.c,1);await delay(1100);
 const deaths=dash.c.messages.slice(dc.from).filter(m=>m.type==='monsterKilled');assert.equal(deaths.length,1);assert.equal(deaths[0].deathStyle,'cleave');assert.equal(deaths[0].killedBySkillId,'warrior_cleaving_dash');
 assert.equal(dash.c.messages.slice(dc.from).filter(m=>m.type==='playerReward').length,1);
 const path=dash.c.messages.slice(dc.from).filter(m=>m.type==='skillEvent'&&m.event.phase==='travel');assert.ok(path.length>2);assert.ok(path.at(-1).event.actorPosition.x>3.9);
 checks.push('Dash moves authoritative body8m, hits corridor once each, confirmed cleave only on death and one reward');
 const stun=await setup('stun','warrior',[{x:0,z:0,health:1000},{x:1.8,z:.7,health:1000}]);const sc=await cast(stun.c,2);
 const stunned=await world(stun.c,w=>w.monsters.filter(m=>m.stunTimer>0).length===2,sc.from);assert.ok(stunned.monsters.every(m=>m.skillStatuses.stun));
 await world(stun.c,w=>w.monsters.every(m=>m.stunTimer===0),stun.c.messages.length);checks.push('Shield stuns every corridor target and authoritative status expiry clears both');
 const frost=await setup('frost','dwarf',[{x:0,z:0,health:1000},{x:1,z:1.8,health:1000}]);const fc=await cast(frost.c,1);
 const frozen=await world(frost.c,w=>w.monsters.filter(m=>m.freezeTimer>0).length===2,fc.from);assert.ok(frozen.monsters.every(m=>m.skillStatuses.freeze));
 const late=await connectProtocolClient(server.wsUrl+'?room=frost',clients);assert.equal(late.welcome.world.monsters.filter(m=>m.freezeTimer>0).length,2);
 await world(frost.c,w=>w.monsters.every(m=>m.freezeTimer===0),frost.c.messages.length);checks.push('Frost freezes full area, latejoin receives remaining timers, expiry clears all');
 const gravity=await setup('gravity','dwarf',[{x:0,z:0,health:1000},{x:2.8,z:2,health:1000}]);const gc=await cast(gravity.c,2);
 const first=await world(gravity.c,w=>w.skillStates.some(s=>s.skills.fields.length),gc.from),field=first.skillStates.find(s=>s.id===gravity.c.id).skills.fields[0],victim=first.monsters[1];
 await delay(1000);const second=gravity.c.latestWorld,moved=second.monsters.find(m=>m.id===victim.id),same=second.skillStates.find(s=>s.id===gravity.c.id).skills.fields[0];
 assert.equal(field.x,same.x);assert.equal(field.z,same.z);assert.ok(same.remaining<field.remaining);assert.ok(Math.hypot(moved.x-field.x,moved.z-field.z)<Math.hypot(victim.x-field.x,victim.z-field.z)-.4);
 const join=await connectProtocolClient(server.wsUrl+'?room=gravity',clients);assert.equal(join.welcome.world.skillStates.find(s=>s.id===gravity.c.id).skills.fields[0].castId,field.castId);
 await server.killPlayers('gravity',[gravity.c.id]);assert.equal(gravity.c.authority.skills.fields.length,0);
 checks.push('Gravity pulls actual monster positions toward fixed field, latejoin shares center/time, owner death cancels field');
 server.assertClean();report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{for(const c of clients)await closeProtocolClient(c);await server.stop();fs.mkdirSync('output/qa/arpg-skills-v2',{recursive:true});fs.writeFileSync('output/qa/arpg-skills-v2/server-controls.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
