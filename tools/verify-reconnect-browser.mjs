import { relocateServerImports } from './quality-server-source.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium,browserLaunchOptions,attachQualityTelemetry,waitForRuntimeAssets,evidenceDir} from './quality-browser.mjs';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'bipx-resume-browser-'));
const source=await fs.readFile('server.mjs','utf8');
const append=`\nprocess.on('message',m=>{if(m.type!=='qa-reconnect')return;try{const room=rooms.get('browser-reconnect');const client=room?.clients.get(m.clientId);if(!client)throw Error('Missing connected fixture client');room.world.zombiesToSpawn=0;room.world.nextWaveDelay=999;room.world.monsters.clear();room.world.projectiles.clear();if(m.action==='kill'){const monster=spawnServerMonster(room,client.state.x+3,client.state.z,'zombie');damageServerMonster(room,monster,999,client.id,'pistol');}if(m.action==='damage')damageServerPlayer(room,client,40);broadcastWorldState(room);process.send({id:m.id,ok:true});}catch(e){process.send({id:m.id,error:e.message});}});`;
const fixture=relocateServerImports(source.replace('const root = path.dirname(fileURLToPath(import.meta.url));',`const root = ${JSON.stringify(process.cwd())};`))+append;
const file=path.join(temp,'server.mjs');await fs.writeFile(file,fixture);
const server=spawn(process.execPath,[file],{env:{...process.env,HOST:'127.0.0.1',PORT:'0',LEADERBOARD_FILE:path.join(temp,'leaderboard.json'),SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:''},stdio:['ignore','pipe','pipe','ipc']});
const ready=new Promise((resolve,reject)=>{let output='';const t=setTimeout(()=>reject(Error('Startup timeout')),8000);server.stdout.on('data',b=>{output+=b;const m=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(t);resolve(m[1]);}})});
let serial=0;const pending=new Map();server.on('message',m=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error)):p.resolve();});
const ipc=(clientId,action)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});server.send({type:'qa-reconnect',id,clientId,action});});
let stderr='';server.stderr.on('data',b=>stderr+=b);
const browser=await chromium.launch(browserLaunchOptions);
const context=await browser.newContext({viewport:{width:1280,height:720}});
await context.addInitScript(()=>{
 localStorage.setItem('bipx-character','dwarf');
 const Native=window.WebSocket;let current=null,ownId=null,suppressOwnState=false;let dropReward=false,dropAck=false,dropRun=false;const details={welcomes:0,resumes:0,runReplies:[],droppedRewards:0,droppedAcks:0,droppedRuns:0};
 window.WebSocket=class extends Native{
  constructor(url,protocols){super(url,protocols);current=this;super.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='welcome'){ownId=m.id;suppressOwnState=false;details.welcomes++;if(m.resumed)details.resumes++;}if(m.type==='runStarted'){details.runReplies.push(m.state.runId);if(dropRun){dropRun=false;details.droppedRuns++;e.stopImmediatePropagation();this.close();return;}}if(m.type==='playerReward'&&dropReward){dropReward=false;suppressOwnState=true;details.droppedRewards++;e.stopImmediatePropagation();this.close();return;}if(suppressOwnState&&m.type==='playerState'&&m.id===ownId)e.stopImmediatePropagation();});}
  send(data){let m;try{m=JSON.parse(data)}catch{}if(m?.type==='rewardAck'&&dropAck){dropAck=false;details.droppedAcks++;return;}super.send(data);}
 };
 // Only methods and noncredential counters are exposed by the fixture.
 window.__qaWire={close:()=>current?.close(),drop:kind=>{if(kind==='reward')dropReward=true;if(kind==='ack')dropAck=true;if(kind==='run')dropRun=true;},stats:()=>structuredClone(details)};
});
const page=await context.newPage();const telemetry=attachQualityTelemetry(page,'reconnect-browser');telemetry.markFixture();
telemetry.report.scope='Real browser/client reconnect and reward handling against production server functions in an isolated child. Private IPC creates damage/reward fixtures; injected socket wrapper drops selected messages/ACKs. No natural-gameplay or latency-device claim. Resume credentials excluded.';
const measurements={};
try{
 const port=await ready;
 const url=new URL(`http://127.0.0.1:${port}/`);url.searchParams.set('ws',`ws://127.0.0.1:${port}/ws`);url.searchParams.set('room','browser-reconnect');url.searchParams.set('autoplay','1');
 await page.goto(url.href,{waitUntil:'networkidle'});await waitForRuntimeAssets(page,telemetry);
 await page.waitForFunction(()=>window.__zombieNightDebug.getState().state==='playing'&&window.__qaWire.stats().runReplies.length>0);
 let state=await read();const id=state.multiplayer.id;await ipc(id,'clear');await ipc(id,'kill');await page.waitForFunction(()=>window.__zombieNightDebug.getState().kills===1);await ipc(id,'damage');await page.waitForFunction(()=>window.__zombieNightDebug.getState().health===160);
 measurements.before=await read();assert.equal(measurements.before.xp,3);
 await page.evaluate(()=>window.__qaWire.close());await page.waitForFunction(()=>!window.__zombieNightDebug.getState().multiplayer.connected);
 const frozen=await read();await page.keyboard.down('KeyW');await page.mouse.down();await page.waitForTimeout(650);const whileDisconnected=await read();await page.keyboard.up('KeyW');await page.mouse.up();
 for(const key of ['x','z'])assert.equal(whileDisconnected.player[key],frozen.player[key]);assert.equal(whileDisconnected.health,160);assert.equal(whileDisconnected.bullets,0);assert.equal(whileDisconnected.survivalTime,frozen.survivalTime);
 measurements.disconnected=whileDisconnected;await telemetry.capture('reconnecting-input-blocked');
 await connected(2);state=await read();assert.equal(state.multiplayer.id,id);for(const key of ['score','kills','xp','health'])assert.equal(state[key],measurements.before[key]);measurements.resumed=state;
 await page.evaluate(()=>window.__qaWire.drop('reward'));await ipc(id,'kill');await page.waitForFunction(()=>!window.__zombieNightDebug.getState().multiplayer.connected);await connected(3);await page.waitForFunction(()=>window.__zombieNightDebug.getState().kills===2);state=await read();assert.equal(state.xp,6);measurements.lostRewardRecovered=state;
 await page.evaluate(()=>window.__qaWire.drop('ack'));await ipc(id,'kill');await page.waitForFunction(()=>window.__zombieNightDebug.getState().kills===3);const beforeReplay=await read();assert.equal(beforeReplay.xp,9);await page.evaluate(()=>window.__qaWire.close());await page.waitForFunction(()=>!window.__zombieNightDebug.getState().multiplayer.connected);await connected(4);state=await read();assert.equal(state.xp,9);assert.equal(state.kills,3);assert.equal(state.score,beforeReplay.score);assert.ok(state.powerups<=beforeReplay.powerups);measurements.replayedAckDoesNotDuplicate=state;
 await page.evaluate(()=>{window.__qaWire.drop('run');window.__zombieNightDebug.start();});await page.waitForFunction(()=>!window.__zombieNightDebug.getState().multiplayer.connected);await connected(5);await page.waitForFunction(()=>window.__qaWire.stats().runReplies.length>=3);state=await read();assert.equal(state.kills,0);assert.equal(state.xp,0);assert.equal(state.health,200);const wire=await page.evaluate(()=>window.__qaWire.stats());assert.equal(wire.runReplies.at(-1),wire.runReplies.at(-2));measurements.runStartReplay={state,wire};
 await telemetry.capture('resumed-and-restarted');telemetry.assertClean();
}catch(error){telemetry.fail(error);process.exitCode=1;}finally{await telemetry.save({measurements,serverStderr:stderr});const savedReport=path.join(evidenceDir,'reconnect-browser.json');await fs.writeFile(savedReport,redact(await fs.readFile(savedReport,'utf8')));await context.close();await browser.close();server.kill('SIGTERM');console.log(redact(JSON.stringify({passed:telemetry.report.assertions==='passed',failure:telemetry.report.failure,evidenceDir})));}
async function read(){return page.evaluate(()=>window.__zombieNightDebug.getState());}
async function connected(count){await page.waitForFunction(expected=>window.__zombieNightDebug.getState().multiplayer.connected&&window.__qaWire.stats().welcomes>=expected,count,{timeout:10000});await page.waitForTimeout(120);}

function redact(text){return text.replace(/([?&]resumeToken=)[^&#\s\"'<>]+/g,'$1[REDACTED]').replace(/(\"resumeToken\"\s*:\s*\")[^\"]+/g,'$1[REDACTED]');}
