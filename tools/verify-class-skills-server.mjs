import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchProtocolServer, connectProtocolClient, startProtocolRun, protocolMessage, closeProtocolClient, delay } from './quality-protocol.mjs';
const server=await launchProtocolServer('arpg-skills'),clients=[],checks=[];
const report={passed:false,scope:'Real WebSocket isolated production server; explicit terminal-death IPC fixture, not visual gameplay',...server.evidence,checks};
const send=(c,m)=>c.socket.send(JSON.stringify(m));
let serial=0;
async function skill(c,slot,extra={}){const requestId=`skill-${++serial}`,from=c.messages.length;send(c,{type:'skill',slot,runId:c.authority.runId,requestId,aimX:0,aimZ:-1,...extra});return protocolMessage(c,m=>m.type==='skillResult'&&m.requestId===(extra.requestId||requestId),from);}
try {
 const observer=await connectProtocolClient(server.wsUrl+'?room=arpg',clients);
 for(const classId of ['warrior','dwarf']){
  let c=await connectProtocolClient(server.wsUrl+`?room=arpg&character=${classId}`,clients);
  await startProtocolRun(c,classId);
  let result=await skill(c,0,{runId:'stale'});assert.equal(result.result.reason,'wrong-run');
  result=await skill(c,3);assert.equal(result.result.reason,'slot');
  const start=observer.messages.length;
  result=await skill(c,0,{damage:99999,resource:999,cost:0,cooldown:0});assert.ok(result.result.ok);assert.ok(result.skills.resource>=(classId==='warrior'?76:72)&&result.skills.resource<(classId==='warrior'?78:74));
  const receipt=result.requestId,castId=result.result.castId;
  const duplicate=await skill(c,0,{requestId:receipt});assert.ok(duplicate.result.duplicate);assert.equal(duplicate.result.castId,castId);
  assert.equal((await skill(c,1)).result.reason,'casting');
  await delay(950);
  assert.equal((await skill(c,0)).result.reason,'cooldown');
  assert.ok((await skill(c,1)).result.ok);await delay(1000);
  assert.ok((await skill(c,2)).result.ok);await delay(1100);
  const casts=observer.messages.slice(start).filter(m=>m.type==='skillEvent'&&m.id===c.id&&m.event.phase==='cast');
  assert.equal(casts.length,3);assert.deepEqual(casts.map(m=>m.event.skillId),classId==='warrior'?['warrior_war_cry','warrior_cleaving_dash','warrior_shield_charge']:['dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot']);
  const id=c.id,runId=c.authority.runId,token=c.welcome.resumeToken;await closeProtocolClient(c);
  c=await connectProtocolClient(server.wsUrl+`?room=arpg&resumeToken=${encodeURIComponent(token)}`,clients);
  assert.equal(c.id,id);assert.equal(c.authority.runId,runId);assert.equal(c.authority.skills.sequence,3);assert.ok(c.authority.skills.resource<70);assert.ok(c.authority.skills.cooldowns[2]>0);
  result=await skill(c,0,{requestId:receipt});assert.ok(result.result.duplicate);
  await server.killPlayers('arpg',[c.id]);result=await skill(c,0);assert.equal(result.result.reason,'state');
  await startProtocolRun(c,classId);assert.equal(c.authority.skills.resource,100);assert.equal(c.authority.skills.sequence,0);assert.equal((await skill(c,0,{runId})).result.reason,'wrong-run');
  await server.killPlayers('arpg',[c.id]);await closeProtocolClient(c);
  checks.push(`${classId}: three accepted casts broadcast once; spoof/lock/cooldown/replay/run/death rejected; reconnect retained and restart reset`);
 }
 server.assertClean();report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{for(const c of clients)await closeProtocolClient(c);await server.stop();fs.mkdirSync('output/qa/arpg-skills-v2',{recursive:true});fs.writeFileSync('output/qa/arpg-skills-v2/server.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
