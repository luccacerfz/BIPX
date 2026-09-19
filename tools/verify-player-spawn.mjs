import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as physics from '../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';
import { launchProtocolServer, connectProtocolClient, protocolMessage, startProtocolRun, closeProtocolClient } from './quality-protocol.mjs';
import { spawnFixture as fixture } from './player-spawn-fixture.mjs';

const source=fs.readFileSync('server.mjs','utf8');
const report={createdAt:new Date().toISOString(),scope:'Literal CPU spawn/start fixtures plus real isolated WebSocket latejoin/restart/resume. Occupants and impossible giant body are explicitly synthetic, not natural gameplay.',checks:[],passed:false};
const extract=name=>{const start=source.indexOf(`function ${name}(`),end=source.indexOf('\n}',start);assert.ok(start>=0&&end>start);return source.slice(start,end+2)};
const world=physics.createCollisionWorld({colliders:getEnvironmentColliders(),bounds:ENVIRONMENT_GROUND});
const ctx=vm.createContext({...physics,crypto,collisionWorld:world,playerBaseMaxHealth:200,serverCharacterProfiles:{warrior:{weapon:'katana'}},getPlayingClients:r=>[...r.clients.values()].filter(c=>c.state.state==='playing'&&c.state.health>0)});
vm.runInContext(['getSpawnPoint','getServerCrowdBodies','createInitialPlayerState'].map(extract).join('\n'),ctx);
const overlaps=(point,bodies)=>Math.max(0,...bodies.map(b=>.64+b.radius-Math.hypot(point.x-b.x,point.z-b.z)));
const clients=[];let server;
try {
  const cases=[];
  for(let slot=0;slot<4;slot++)for(const kind of ['monster','boss','player']) {
    const position=ctx.getSpawnPoint(slot),body={id:'occupant',...position,radius:kind==='boss'?1.72:kind==='player'?.64:.78,health:100,freezeTimer:3};
    const room={clients:new Map(),world:{monsters:new Map()}};
    if(kind==='player')room.clients.set('occupant',{id:'occupant',state:{...position,health:200,state:'playing'},connected:false});
    else room.world.monsters.set(body.id,body);
    const state=ctx.createInitialPlayerState(slot,'warrior',1,room,'self');
    assert.ok(overlaps(state,[body])<1e-8);cases.push({slot,kind,position:{x:state.x,z:state.z},overlap:overlaps(state,[body])});
  }
  const own={id:'self',state:{x:0,z:0,health:200,state:'playing'}};
  const room={clients:new Map([['self',own]]),world:{monsters:new Map()}};
  const self=ctx.createInitialPlayerState(0,'warrior',1,room,'self');assert.equal(self.x,0);assert.equal(self.z,0);
  let calls=0;const original=ctx.findFreePosition;ctx.findFreePosition=(...args)=>{calls++;return original(...args)};
  ctx.createInitialPlayerState(0,'warrior');assert.equal(calls,1,'Resolve x/z together exactly once');
  report.checks.push({name:'12 slot/body/boss/player cases, disconnected live occupant included, self excluded, one solver call',cases});
  server=await launchProtocolServer('player-spawn',fixture);Object.assign(report,server.evidence);
  const connect=(room,name,token)=>connectProtocolClient(`${server.wsUrl}?room=${room}&name=${name}&character=warrior${token?'&resumeToken='+encodeURIComponent(token):''}`,clients);
  const watcher=await connect('spawn-live','Watcher');await startProtocolRun(watcher);
  const joining=await connect('spawn-live','Joining');
  await server.requestFixture('qa-spawn-config',{room:'spawn-live',actors:[{x:4,z:0,radius:1.72}]});
  const entered=await startProtocolRun(joining), snapshot=await server.requestFixture('qa-spawn-state',{room:'spawn-live',clientId:joining.id});
  assert.ok(overlaps(entered,snapshot.bodies.filter(b=>b.id!==`player:${joining.id}`))<1e-7);
  const beforeId=entered.runId;
  await server.requestFixture('qa-spawn-config',{room:'spawn-live',clientId:joining.id,dead:true,actors:[{x:4,z:0,radius:.78}]});
  const restarted=await startProtocolRun(joining), after=await server.requestFixture('qa-spawn-state',{room:'spawn-live',clientId:joining.id});
  assert.notEqual(restarted.runId,beforeId);assert.ok(overlaps(restarted,after.bodies.filter(b=>b.id!==`player:${joining.id}`))<1e-7);
  report.checks.push({name:'Real latejoin and explicit restart in living room avoid frozen boss/monster and live player',latejoin:{x:entered.x,z:entered.z},restart:{x:restarted.x,z:restarted.z}});
  await server.placePlayer('spawn-live',joining.id,{x:8,z:8});
  const saved=await server.requestFixture('qa-spawn-config',{room:'spawn-live',clientId:joining.id,skillState:true,actors:[]});
  const token=joining.welcome.resumeToken;await closeProtocolClient(joining);
  const resumed=await connect('spawn-live','Resume',token);
  assert.equal(resumed.id,joining.id);assert.equal(resumed.welcome.resumed,true);assert.equal(resumed.authority.runId,saved.state.runId);
  assert.equal(resumed.authority.x,saved.state.x);assert.equal(resumed.authority.z,saved.state.z);
  assert.equal(resumed.welcome.spawn.x,resumed.authority.x);assert.equal(resumed.welcome.spawn.z,resumed.authority.z);
  assert.equal(resumed.authority.skills.sequence,8);assert.ok(resumed.authority.skills.resource>=47&&resumed.authority.skills.resource<50);
  assert.ok(resumed.authority.skills.cooldowns[0]>4&&resumed.authority.skills.cooldowns[0]<=5);
  report.checks.push({name:'Reconnect preserves identity/run/position/resource/CD/sequence; welcome equals state'});
  const impossible=await server.requestFixture('qa-spawn-config',{room:'spawn-live',clientId:resumed.id,dead:true,skillState:true,actors:[{x:0,z:0,radius:30}]});
  const from=resumed.messages.length;
  resumed.socket.send(JSON.stringify({type:'startRun',requestId:'no-space',state:{character:'warrior'}}));
  const rejected=await protocolMessage(resumed,m=>m.type==='runStartRejected'&&m.requestId==='no-space',from);
  assert.equal(rejected.reason,'no-free-spawn');assert.deepEqual(rejected.state,impossible.state);
  const unchanged=await server.requestFixture('qa-spawn-state',{room:'spawn-live',clientId:resumed.id});
  assert.deepEqual(unchanged.state,impossible.state);assert.deepEqual(unchanged.skills,impossible.skills);assert.equal(unchanged.lastStartRequestId,impossible.lastStartRequestId);
  assert.equal(resumed.messages.slice(from).some(m=>m.type==='runStarted'),false);
  await server.requestFixture('qa-spawn-config',{room:'spawn-live',actors:[]});
  resumed.socket.send(JSON.stringify({type:'startRun',requestId:'no-space',state:{character:'warrior'}}));
  const retry=await protocolMessage(resumed,m=>m.type==='runStarted'&&m.requestId==='no-space',from);
  assert.notEqual(retry.state.runId,impossible.state.runId);
  report.checks.push({name:'Impossible spawn rejects atomically, preserves prior run/state/skills/idempotence receipt, same request can retry after space opens'});
  server.assertClean();report.passed=true;
} catch(error) {report.failure=error.stack;process.exitCode=1;}
finally {
  for(const c of clients)await closeProtocolClient(c);await server?.stop();
  report.sourceUnchanged=source===fs.readFileSync('server.mjs','utf8');
  const dir=path.join('output/qa/arpg-crowd-integrated-20260919',report.createdAt.replace(/[:.]/g,'-'));fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'player-spawn.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({dir,passed:report.passed,sourceUnchanged:report.sourceUnchanged,checks:report.checks.length,failure:report.failure}));
}
