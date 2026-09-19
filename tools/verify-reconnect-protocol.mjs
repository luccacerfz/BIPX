import { relocateServerImports } from './quality-server-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
const baseRoot=process.cwd();
const candidate=process.argv[2]||'server.mjs';
const output=process.env.BIPX_EVIDENCE_DIR||'output/qa/reconnect-protocol';
await fs.mkdir(output,{recursive:true});
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-resume-verification-'));
const source=await fs.readFile(candidate,'utf8');
const fixture=`
process.on('message', request => {
 if(request.type==='qa-prepare') {
  try {
   const room=rooms.get('resume'),client=room.clients.get(request.clientId);
   room.world.monsters.clear();room.world.projectiles.clear();room.world.zombiesToSpawn=0;room.world.nextWaveDelay=1e9;
   client.state.x=-4;client.state.z=0;
   const monster=spawnServerMonster(room,0,0,'zombie');monster.speed=0;monster.attackCooldown=1e9;monster.health=7;monster.maxHealth=7;
   broadcastWorldState(room);process.send({id:request.id,result:serializeMonster(monster)});
  } catch(error) {process.send({id:request.id,error:error.message});}
  return;
 }
 if(request.type!=='qa-damage')return;
 try { const room=rooms.get(request.room),client=room?.clients.get(request.clientId);if(!client)throw Error('Missing fixture client');damageServerPlayer(room,client,request.amount);process.send({id:request.id,ok:true}); }
 catch(error){process.send({id:request.id,error:error.message});}
});`;
const instrumented=path.join(temp,'server.mjs');
await fs.writeFile(instrumented,relocateServerImports(source)+fixture);
const report={scope:'Isolated source-identical production server functions with private IPC damage and stationary-target/clear-center placement fixture/import relocation; real WebSockets, no browser. Credentials excluded.',serverSha256:crypto.createHash('sha256').update(source).digest('hex'),passed:false,checks:[]};
const clients=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(process.execPath,[instrumented],{cwd:baseRoot,env:{...process.env,HOST:'127.0.0.1',PORT:'0',LEADERBOARD_FILE:path.join(temp,'leaderboard.json'),SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','pipe','pipe','ipc']});
let ipcSerial=0;const pendingIpc=new Map();
child.on('message',m=>{const pending=pendingIpc.get(m.id);if(!pending)return;pendingIpc.delete(m.id);m.error?pending.reject(Error(m.error)):pending.resolve(m.result);});
function damage(client,amount,room='resume'){return new Promise((resolve,reject)=>{const id=++ipcSerial;pendingIpc.set(id,{resolve,reject});child.send({type:'qa-damage',id,room,clientId:client.id,amount});});}
let stderr='';child.stderr.on('data',b=>stderr+=b);
async function until(f,ms=6000){const end=Date.now()+ms;while(Date.now()<end){const value=f();if(value)return value;await delay(15)}throw Error('Condition timed out');}
async function connect(room,name,token){const url=new URL(wsbase);url.searchParams.set('room',room);url.searchParams.set('name',name);url.searchParams.set('character','dwarf');if(token)url.searchParams.set('resumeToken',token);const socket=new WebSocket(url);const c={socket,messages:[]};clients.push(c);socket.addEventListener('message',event=>{const m=JSON.parse(event.data);c.messages.push(m);if(m.type==='welcome'){c.welcome=m;c.id=m.id;c.token=m.resumeToken;c.authority=m.selfState;}if(m.type==='runStarted'||m.type==='playerReward'||(m.id===c.id&&m.state))c.authority=m.state;});await until(()=>c.welcome);return c;}
function send(c,m){c.socket.send(JSON.stringify(m));}
function state(c,patch={}){send(c,{type:'state',state:{...c.authority,...patch}});}
async function msg(c,p,from=0,timeout=6000){return until(()=>c.messages.slice(from).find(p),timeout);}
async function close(c){if(c.socket.readyState<2)c.socket.close();await until(()=>c.socket.readyState===3);await delay(80)}
function check(name,details={}){report.checks.push({name,...details});console.log(name);}
let wsbase;
try{
 const port=await new Promise((res,rej)=>{let out='';const timeout=setTimeout(()=>rej(Error('Server startup timeout')),8000);child.stdout.on('data',b=>{out+=b;const m=out.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timeout);res(m[1]);}})});wsbase=`ws://127.0.0.1:${port}/ws`;
 const watch=await connect('resume','Watch');state(watch,{state:'playing',x:0,z:25});
 let player=await connect('resume','ResumeQA');assert.equal(player.welcome.resumed,false);assert.equal(player.welcome.resumeGraceMs,30000);assert.ok(player.token.length>=40);state(player,{state:'playing',x:-4,z:0});
 const target=await new Promise((resolve,reject)=>{const id=++ipcSerial;pendingIpc.set(id,{resolve,reject});child.send({type:'qa-prepare',id,clientId:player.id});});
 state(player,{x:target.x-4,z:target.z});send(player,{type:'attack',attack:{kind:'pistol',weapon:'pistol',aimX:1,aimZ:0,damageMultiplier:8}});
 await msg(player,m=>m.type==='monsterHit'&&m.id===target.id);await delay(330);send(player,{type:'attack',attack:{kind:'pistol',weapon:'pistol',aimX:1,aimZ:0,damageMultiplier:8}});
 const reward=await msg(player,m=>m.type==='playerReward');assert.ok(reward.xpTotal>0);assert.equal(reward.totalKills,1);
 const damageStart=player.messages.length;send(watch,{type:'damagePlayer',targetId:player.id,amount:40});await delay(100);assert.equal(player.messages.slice(damageStart).filter(m=>m.type==='playerDamaged').length,0);check('Legacy damagePlayer packet cannot damage another client');
 await damage(player,40);await msg(player,m=>m.type==='playerDamaged'&&m.id===player.id);
 const saved={...player.authority};assert.equal(saved.health,160);const id=player.id,token=player.token,epoch=player.welcome.world.epoch;
 await close(player);player=await connect('resume','RenamedRequest',token);
 assert.equal(player.id,id);assert.equal(player.welcome.resumed,true);assert.equal(player.welcome.world.epoch,epoch);
 for(const key of ['health','maxHealth','score','kills','xpTotal','runId','stateVersion'])assert.equal(player.authority[key],saved[key],key);
 assert.equal(player.welcome.players.find(p=>p.id===id).name,'ResumeQA');
 assert.ok(!JSON.stringify(player.welcome.players).includes(token));assert.ok(!JSON.stringify(player.welcome.world).includes(token));
 check('30s contract resumes same identity, private credential, run, HP, score, kills, XP and world');
 let from=watch.messages.length;state(player,{score:0,kills:0,xpTotal:0,health:200,stateVersion:0});
 const stale=(await msg(watch,m=>m.type==='playerState'&&m.id===id,from)).state;
 assert.equal(stale.score,saved.score);assert.equal(stale.kills,saved.kills);assert.equal(stale.xpTotal,saved.xpTotal);assert.equal(stale.health,160);
 check('Stale periodic state cannot roll back rewards or erase acknowledged damage');
 assert.ok(player.welcome.pendingRewards.some(p=>p.rewardId===reward.rewardId));
 send(player,{type:'rewardAck',rewardId:reward.rewardId});
 const old=player;player=await connect('resume','ResumeQA',token);await until(()=>old.socket.readyState===3);await delay(150);
 assert.ok(!player.welcome.pendingRewards.some(p=>p.rewardId===reward.rewardId));
 check('Unacknowledged rewards replay on resume and disappear after rewardAck');
 from=watch.messages.length;state(player,{x:55,z:-55});const taken=await msg(watch,m=>m.type==='playerState'&&m.id===id,from);assert.ok(Math.hypot(taken.state.x,taken.state.z)<=55-.64+1e-4);
 check('Socket takeover keeps new transport alive after old close callback');
 for(let i=0;i<4;i++)await damage(player,40);
 await msg(player,m=>m.type==='playerDamaged'&&m.id===id&&m.state.state==='dead');
 from=watch.messages.length;state(player,{state:'playing',health:200,score:999999,stateVersion:0});
 const terminal=(await msg(watch,m=>m.type==='playerState'&&m.id===id,from)).state;assert.equal(terminal.state,'dead');assert.equal(terminal.health,0);assert.equal(terminal.score,saved.score);
 await close(player);player=await connect('resume','ResumeQA',token);assert.equal(player.authority.state,'dead');
 check('Death stays terminal across stale state and reconnect');
 const previousRun=player.authority.runId;send(player,{type:'startRun',requestId:'repeatable-start',state:{character:'warrior'}});await msg(player,m=>m.type==='runStarted');
 assert.notEqual(player.authority.runId,previousRun);assert.equal(player.authority.score,0);assert.equal(player.authority.kills,0);assert.equal(player.authority.xpTotal,0);assert.equal(player.authority.health,200);assert.equal(player.authority.character,'warrior');
 const newRun=player.authority.runId;from=player.messages.length;send(player,{type:'startRun',requestId:'repeatable-start',state:{character:'warrior'}});await msg(player,m=>m.type==='runStarted',from);assert.equal(player.authority.runId,newRun);
 check('Repeated startRun requestId returns same run instead of creating another session');
 await delay(800);const ledger=JSON.parse(await fs.readFile(path.join(temp,'leaderboard.json'),'utf8'));const record=Object.values(ledger.players).find(r=>r.name==='ResumeQA');assert.equal(record.gamesPlayed,2);assert.equal(record.totalScore,saved.score);assert.equal(record.totalKills,saved.kills);
 check('Only explicit startRun creates fresh progress; disconnect did not duplicate cumulative ledger',{gamesPlayed:record.gamesPlayed,totalScore:record.totalScore,totalKills:record.totalKills});
 const spectator=await connect('grace','Spectator');let survivor=await connect('grace','Survivor');state(survivor,{state:'playing'});const first=(await msg(spectator,m=>m.type==='worldState'&&m.world.monsters.length)).world;
 const sid=survivor.id,stoken=survivor.token;await close(survivor);await delay(800);survivor=await connect('grace','Survivor',stoken);assert.equal(survivor.id,sid);assert.equal(survivor.welcome.world.epoch,first.epoch);assert.equal(survivor.welcome.world.wave,first.wave);assert.ok(survivor.welcome.world.monsters.some(m=>m.id===first.monsters[0].id));
 check('Last active player briefly disconnected preserves room instead of wiping');
 from=spectator.messages.length;await close(survivor);const expiryStart=Date.now();await msg(spectator,m=>m.type==='roomWipe',from,35000);const elapsed=Date.now()-expiryStart;assert.ok(elapsed>=29000);
 survivor=await connect('grace','Survivor',stoken);assert.notEqual(survivor.id,sid);assert.equal(survivor.welcome.resumed,false);assert.notEqual(survivor.welcome.world.epoch,first.epoch);
 check('Real30-second grace expiration finalizes run and rejects expired resume identity',{observedMs:elapsed});
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{for(const c of clients)if(c.socket.readyState<2)c.socket.close();child.kill('SIGTERM');report.stderr=stderr;report.sourceUnchanged=source===await fs.readFile(candidate,'utf8');await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
