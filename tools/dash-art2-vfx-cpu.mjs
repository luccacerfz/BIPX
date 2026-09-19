import {requireStagingArtefacts} from './quality-staging.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {moduleUrl,sha256} from './class-skill-vfx-support.mjs';
import {createSkillState,beginSkill,advanceSkills,skillSnapshot} from '../src/combat/class-skills.mjs';
const root='output/vfx-dash-art-v2';
// Promotion gate of the dash art2 candidate against its art1 baseline and recorded native input (untracked output/ tree). The shipped dash pool is covered by class-skill-vfx-cpu.
requireStagingArtefacts([root+'/candidate/class-skill-vfx.js','output/vfx-dash-art-v1/baseline/class-skill-vfx.js','output/playwright/2026-09-19T03-35-43-992Z-verify-arpg-combos/combo-warrior-high.json','output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/report.json']);
const THREE=await import(await moduleUrl('vendor/three/three.module.js'));
const {createClassSkillVfx}=await import(await moduleUrl(root+'/candidate/class-skill-vfx.js'));
const baseline=await import(await moduleUrl('output/vfx-dash-art-v1/baseline/class-skill-vfx.js'));
const {createDashVfx}=await import(await moduleUrl(root+'/candidate/dash-vfx.js'));
const report={at:new Date().toISOString(),checks:[],runs:[],native:false,scope:'CPU geometry/pools; real recorded events and current literal core with idealized socket. No render/visual acceptance.'};
const check=(name,fn)=>{fn();report.checks.push({name,passed:true});};
const make=(quality='high',reducedMotion=false)=>{const scene=new THREE.Scene();return {scene,vfx:createClassSkillVfx({THREE,scene,quality,reducedMotion})};};
const skillId='warrior_cleaving_dash',castId='cpu:1',origin={x:0,y:.1,z:0},direction={x:0,y:0,z:1},emitter={x:.35,y:1.7,z:0};
const request=(phase,extra={})=>({skillId,castId,phase,origin,target:origin,direction,emitter,radius:.85,impactAt:.22,travelDuration:.36,...extra});
check('Historical native events preserve all accepted phase/contact counts while removing repeated slash stamps',()=>{
 const raw=JSON.parse(fs.readFileSync('output/playwright/2026-09-19T03-35-43-992Z-verify-arpg-combos/combo-warrior-high.json'));
 const events=raw.measurements.observation.events.filter(e=>e.skillId===skillId),a=make(),b=baseline.createClassSkillVfx({THREE,scene:new THREE.Scene(),quality:'high'});let time=events[0].time;
 for(const e of events){let dt=e.time-time;while(dt>1e-7){const step=Math.min(.1,dt);a.vfx.update(step);b.update(step);dt-=step;}a.vfx.emit(e);b.emit(e);time=e.time;}
 const current=a.vfx.getStats(),old=b.getStats();assert.deepEqual(current.events[skillId],old.events[skillId]);assert.equal(current.dash.contacts,events.filter(e=>e.phase==='impact').length);assert.ok((old.combat.eventCounts?.slash??old.combat.events?.slash??0)>0);
 report.recordedReplay={events:events.length,phases:current.events[skillId],oldCombat:old.combat,newCombat:current.combat,candidate:current.dash};a.vfx.dispose();b.dispose();
});
check('Current core10/60Hz high and low-reduced: identical authority, real-contact-only feedback and fixed buffer allocation',()=>{
 for(const dt of [.1,1/60])for(const [quality,reduced]of [['high',false],['low',true]]){
  const {scene,vfx}=make(quality,reduced),actor={x:0,z:0,runId:'cpu',damageMultiplier:1},state=createSkillState('warrior'),events=[],hits=[];
  const accepted=beginSkill(state,{slot:1,aimX:0,aimZ:1},actor);assert.ok(accepted.ok);
  const emit=e=>{const supplied={...e,emitter:{x:actor.x+.35,y:1.7,z:actor.z}};events.push(JSON.parse(JSON.stringify(e)));vfx.emit(supplied);};emit(accepted.event);
  const targets=[{id:'alive',x:0,z:2,health:100,radius:.35},{id:'dead',x:.2,z:4,health:1,radius:.35}];
  for(let t=0;t<1.8;t+=dt){advanceSkills(state,dt,{actor,targets,moveCaster:d=>({x:actor.x+d.x,z:actor.z+d.z}),hit:(target,damage)=>{target.health-=damage;hits.push(target.id);return target.health<=0;},emit});vfx.update(dt);}
  const stats=vfx.getStats();assert.equal(stats.events[skillId].cast,1);assert.equal(stats.events[skillId].release,1);assert.equal(stats.events[skillId].impact,2);assert.equal(stats.dash.contacts,2);assert.equal(stats.dash.active,0);assert.equal(stats.dash.drawCalls,0);assert.equal(actor.z,8);assert.deepEqual(hits,['alive','dead']);assert.equal(stats.dash.allocatedBytes,capacityBytes());
  const clone=createSkillState('warrior'),control={x:0,z:0,runId:'cpu',damageMultiplier:1},controlEvents=[],controlTargets=[{id:'alive',x:0,z:2,health:100,radius:.35},{id:'dead',x:.2,z:4,health:1,radius:.35}];
  controlEvents.push(beginSkill(clone,{slot:1,aimX:0,aimZ:1},control).event);
  for(let t=0;t<1.8;t+=dt)advanceSkills(clone,dt,{actor:control,targets:controlTargets,moveCaster:d=>({x:control.x+d.x,z:control.z+d.z}),hit:(target,damage)=>{target.health-=damage;return target.health<=0;},emit:e=>controlEvents.push(e)});
  assert.deepEqual(skillSnapshot(state),skillSnapshot(clone));assert.deepEqual(events,JSON.parse(JSON.stringify(controlEvents)));assert.deepEqual(targets,controlTargets);
  for(const attr of Object.values(scene.getObjectByName('DashSteelRibbonArt2').geometry.attributes))assert.ok([...attr.array].every(Number.isFinite));
  report.runs.push({dt,quality,reduced,phases:stats.events[skillId],pool:stats.dash,authority:skillSnapshot(state)});vfx.dispose();
 }
});
function capacityBytes(){return 576*(3+3+4+4)*4;}
check('Ribbon endpoints are the two observed sockets; no teleport bridge or extrapolation',()=>{
 const scene=new THREE.Scene(),pool=createDashVfx({THREE,scene});pool.emit(request('release'));pool.update(.02);const next={x:.4,y:1.6,z:.5};pool.emit(request('travel',{target:{x:0,y:.1,z:.5},emitter:next}));pool.update(0);
 const a=scene.getObjectByName('DashSteelRibbonArt2').geometry.attributes;assert.deepEqual(Array.from(a.aFrom.array.slice(64*3,64*3+3)),[Math.fround(emitter.x),Math.fround(emitter.y),0]);assert.deepEqual(Array.from(a.aTo.array.slice(64*3,64*3+3)),[Math.fround(next.x),Math.fround(next.y),.5]);
 const before=pool.getStats().segments;pool.emit(request('travel',{origin:{x:20,y:.1,z:0},target:{x:20,y:.1,z:.5},emitter:{x:20.3,y:1.5,z:.5}}));assert.equal(pool.getStats().segments,before);assert.equal(pool.getStats().breaks,1);pool.dispose();
});
check('Zero-length terminal miss keeps one short execution arc and cannot fabricate a contact',()=>{
 const {vfx}=make('low',true);vfx.emit(request('cast'));vfx.update(.1);vfx.emit(request('release'));vfx.emit(request('travel',{terminal:true}));vfx.emit(request('end'));vfx.update(0);const s=vfx.getStats();assert.equal(s.dash.kinds[1],1);assert.equal(s.dash.contacts,0);assert.equal(s.events[skillId].impact,0);assert.equal(vfx.emit(request('travel')),false);vfx.update(.1);assert.equal(vfx.getStats().dash.active,0);vfx.dispose();
});
check('Contact dedup remains in wrapper; pause/reset/dispose clear only private surfaces',()=>{
 const {vfx,scene}=make();const source=new THREE.Group();scene.add(source);vfx.emit(request('impact',{contactId:'one'}));vfx.emit(request('impact',{contactId:'one'}));vfx.emit(request('impact',{contactId:'two',target:{x:1,y:.8,z:1},killed:true}));vfx.update(0);assert.equal(vfx.getStats().dash.contacts,2);const before=vfx.getStats().dash;for(let i=0;i<20;i++)vfx.update(0);assert.deepEqual(vfx.getStats().dash,before);vfx.reset();assert.equal(vfx.getStats().dash.active,0);vfx.dispose();vfx.dispose();assert.equal(scene.children.length,1);assert.equal(scene.children[0],source);
});
check('No new depth request for dash; combined gravity/warcry contract remains installed',()=>{
 const {vfx}=make();const camera=new THREE.PerspectiveCamera(48,1.6,.1,220);camera.position.set(5,10,8);camera.lookAt(0,0,0);vfx.emit(request('release'));vfx.update(0);assert.equal(vfx.prepareSceneDepth(camera).required,false);assert.equal(typeof vfx.updateCastTransform,'function');assert.ok(vfx.getStats().cannon&&vfx.getStats().warcry&&vfx.getStats().states.gravity);vfx.dispose();
});

check('Art2 preparation remains active at.08/.119/.16; release replaces it without adding glyphs',()=>{
 const scene=new THREE.Scene(),p=createDashVfx({THREE,scene});p.emit(request('cast'));p.update(.08);assert.equal(p.getStats().kinds[0],1);p.update(.039);assert.equal(p.getStats().kinds[0],1);p.update(.041);assert.equal(p.getStats().kinds[0],1);p.emit(request('release'));p.update(0);assert.deepEqual(p.getStats().kinds,[0,1,0,0]);p.dispose();
});
check('Preparation follows drawn socket across frames without events, TTL changes or extra instances',()=>{
 const {vfx,scene}=make();vfx.emit(request('cast'));vfx.update(.08);const before=vfx.getStats(),a=scene.getObjectByName('DashSteelRibbonArt2').geometry.attributes,clock=a.aClock.array.slice();
 assert.equal(vfx.updateDashTransform(castId,{emitter:{x:.8,y:1.9,z:.2}}),true);assert.equal(vfx.getStats().dash.active,before.dash.active);assert.deepEqual(vfx.getStats().events,before.events);assert.deepEqual(a.aClock.array,clock);
 vfx.update(.06);assert.equal(vfx.updateDashTransform(castId,{emitter:{x:.7,y:1.8,z:.3}}),true);vfx.update(.09);assert.equal(vfx.updateDashTransform(castId,{emitter:{x:1,y:2,z:1}}),false);vfx.dispose();
});
check('Post-mixer23 actual recorded poses: latest endpoint/arc corrected, every historical endpoint unchanged',()=>{
 const native=JSON.parse(fs.readFileSync('output/vfx-dash-art-v1/native-2026-09-19T07-13-48-249Z/report.json'));
 const frames=native.inputProbe.trace.frames,{scene,vfx}=make(),phases={cast:0,release:0,travel:0,end:0},source=JSON.stringify(native.inputProbe.events);
 const statsAt=[];let prior=native.inputProbe.events[0].time;
 const attributes=scene.getObjectByName('DashSteelRibbonArt2').geometry.attributes;
 for(const frame of frames){
   const events=native.inputProbe.events.filter(e=>e.time===frame.time&&e.skillId===skillId);
   if(frame===frames[0]){const cast=native.inputProbe.events.find(e=>e.phase==='cast');vfx.emit(cast);phases.cast++;vfx.update(frame.time-cast.time);}
   for(const event of events){vfx.emit(event);phases[event.phase]=(phases[event.phase]??0)+1;}
   const record=vfx.getStats().dash.records.find(r=>r.id===frame.event.castId),i=record.pendingSegment;
   const before={from:attributes.aFrom.array.slice(),to:attributes.aTo.array.slice(),clock:attributes.aClock.array.slice(),style:attributes.aStyle.array.slice()};
   const transform={emitter:{x:frame.drawn[0],y:frame.drawn[1],z:frame.drawn[2]}};
   assert.equal(vfx.updateDashTransform(record.id,transform),true);
   assert.deepEqual(vfx.getStats().dash.records.find(r=>r.id===record.id).lastEmitter,frame.drawn);
   assert.deepEqual(Array.from(attributes.aFrom.array.slice(0,3)),frame.drawn.map(Math.fround));
   if(i>=0)assert.deepEqual(Array.from(attributes.aTo.array.slice(i*3,i*3+3)),frame.drawn.map(Math.fround));
   for(let j=0;j<before.from.length;j++){if(j>=3)assert.equal(attributes.aFrom.array[j],before.from[j]);if(i<0||j<i*3||j>=i*3+3)assert.equal(attributes.aTo.array[j],before.to[j]);}
   assert.deepEqual(attributes.aClock.array,before.clock);assert.deepEqual(attributes.aStyle.array,before.style);
   const after=vfx.getStats();assert.equal(vfx.updateDashTransform(record.id,transform),true);assert.deepEqual(vfx.getStats(),after);
   statsAt.push({time:frame.time,preMixerError:frame.delta,correctedFloatError:Math.hypot(...frame.drawn.map((x,n)=>x-attributes.aFrom.array[n])),terminal:frame.event.terminal});
   vfx.update(Math.min(.02,Math.max(0,frame.time-prior)));assert.equal(vfx.updateDashTransform(record.id,transform),true);prior=frame.time;
 }
 assert.equal(JSON.stringify(native.inputProbe.events),source);assert.equal(phases.cast,1);assert.equal(phases.release,1);assert.equal(phases.travel,23);assert.equal(phases.end,1);assert.equal(vfx.getStats().dash.contacts,0);
 report.postMixerReplay={frames:statsAt,maxOriginal:Math.max(...statsAt.map(x=>x.preMixerError)),maxCorrectedStorage:Math.max(...statsAt.map(x=>x.correctedFloatError)),scope:'Replay of native observed positions into CPU buffers, not a new rendered alignment proof'};vfx.dispose();
});
check('Terminal/end follow within unchanged tail life; unknown/invalid/cancel/reset/dispose cannot move effects',()=>{
 const {vfx,scene}=make('low',true),fixed={emitter:{x:.8,y:1.8,z:.5}};vfx.emit(request('cast'));vfx.emit(request('release'));vfx.emit(request('travel',{target:{x:0,y:.1,z:.5},terminal:true}));vfx.emit(request('end'));
 assert.equal(vfx.updateDashTransform(castId,fixed),true);const state=vfx.getStats();assert.equal(vfx.updateDashTransform('unknown',fixed),false);assert.equal(vfx.updateDashTransform(castId,{emitter:{x:NaN,y:0,z:0}}),false);assert.equal(vfx.updateDashTransform(castId,{emitter:{x:1,z:0}}),false);assert.deepEqual(vfx.getStats(),state);
 vfx.update(0);assert.equal(vfx.updateDashTransform(castId,{emitter:{x:.9,y:2,z:.7}}),true);vfx.update(0);const ended=vfx.getStats();for(let n=0;n<8;n++)vfx.update(0);assert.deepEqual(vfx.getStats(),ended);vfx.update(.1);assert.equal(vfx.updateDashTransform(castId,fixed),false);
 vfx.reset();vfx.emit(request('cast'));vfx.emit(request('end',{reason:'cancelled'}));assert.equal(vfx.updateDashTransform(castId,fixed),false);assert.equal(vfx.getStats().dash.active,0);
 vfx.emit(request('cast',{castId:'other'}));vfx.reset();assert.equal(vfx.updateDashTransform('other',fixed),false);vfx.dispose();assert.equal(vfx.updateDashTransform(castId,fixed),false);assert.equal(scene.children.length,0);
});
check('Two same-frame remote-like segments correct only latest; next frame starts at corrected socket, contact stays authoritative',()=>{
 const scene=new THREE.Scene(),p=createDashVfx({THREE,scene});p.emit(request('release'));p.update(0);
 p.emit(request('travel',{target:{x:0,y:.1,z:.4},emitter:{x:.4,y:1.7,z:.4}}));
 p.emit(request('travel',{origin:{x:0,y:.1,z:.4},target:{x:0,y:.1,z:.8},emitter:{x:.5,y:1.7,z:.8}}));
 p.emit(request('impact',{target:{x:0,y:.1,z:.8}}));
 const a=scene.getObjectByName('DashSteelRibbonArt2').geometry.attributes,before=a.aFrom.array.slice(),to=a.aTo.array.slice(),record=p.getStats().records[0],latest=record.pendingSegment;
 const corrected={x:.7,y:1.9,z:.9};assert.equal(p.updateDashTransform(castId,{emitter:corrected}),true);
 for(let n=3;n<before.length;n++)assert.equal(a.aFrom.array[n],before[n]);
 for(let n=0;n<to.length;n++)if(n<latest*3||n>=latest*3+3)assert.equal(a.aTo.array[n],to[n]);
 assert.equal(p.getStats().contacts,1);p.update(.016);
 p.emit(request('travel',{origin:{x:0,y:.1,z:.8},target:{x:0,y:.1,z:1.2},emitter:{x:.8,y:1.8,z:1.2}}));const newest=p.getStats().records[0].pendingSegment;
 assert.deepEqual(Array.from(a.aFrom.array.slice(newest*3,newest*3+3)),[corrected.x,corrected.y,corrected.z].map(Math.fround));p.dispose();
});
check('Between-packet following preserves start/history/TTL; terminal tail expires before indefinite interpolation',()=>{
 const scene=new THREE.Scene(),p=createDashVfx({THREE,scene});p.emit(request('release'));p.update(0);p.emit(request('travel',{target:{x:0,y:.1,z:.8},emitter:{x:.5,y:1.7,z:.8}}));p.update(.016);
 const a=scene.getObjectByName('DashSteelRibbonArt2').geometry.attributes,i=p.getStats().records[0].headSegment,start=Array.from(a.aFrom.array.slice(i*3,i*3+3)),clocks=a.aClock.array.slice(),style=a.aStyle.array.slice();const samples=[];
 for(let n=0;n<4;n++){const v={x:.55+n*.05,y:1.8,z:.9+n*.08};assert.equal(p.updateDashTransform(castId,{emitter:v}),true);assert.deepEqual(Array.from(a.aTo.array.slice(i*3,i*3+3)),[v.x,v.y,v.z].map(Math.fround));assert.deepEqual(Array.from(a.aFrom.array.slice(i*3,i*3+3)),start);assert.deepEqual(a.aClock.array,clocks);assert.deepEqual(a.aStyle.array,style);samples.push(p.getStats().clock);p.update(.016);}
 p.emit(request('travel',{origin:{x:0,y:.1,z:.8},target:{x:0,y:.1,z:1.2},emitter:{x:.8,y:1.8,z:1.2},terminal:true}));p.emit(request('end'));p.update(.016);const terminalClocks=a.aClock.array.slice();
 for(let n=0;n<4;n++){assert.equal(p.updateDashTransform(castId,{emitter:{x:.8,y:1.8,z:1.3+n*.07}}),true);assert.deepEqual(a.aClock.array,terminalClocks);p.update(.016);}
 p.update(.02);assert.equal(p.updateDashTransform(castId,{emitter:{x:.8,y:1.8,z:1.8}}),false);assert.equal(p.getStats().kinds[1],0);assert.equal(p.getStats().contacts,0);report.betweenPackets={updates:samples.length,terminalUpdates:4,eventsAdded:0,expiryNotExtended:true};p.dispose();
});
check('Post-mixer teleport breaks only open bridge and cannot create impact or a stretched trail',()=>{
 const scene=new THREE.Scene(),p=createDashVfx({THREE,scene});p.emit(request('release'));p.update(0);p.emit(request('travel',{target:{x:0,y:.1,z:.5},emitter:{x:.5,y:1.7,z:.5}}));const i=p.getStats().records[0].headSegment;assert(i>=0);assert.equal(p.updateDashTransform(castId,{emitter:{x:30,y:2,z:30}}),true);assert.equal(p.getStats().records[0].headSegment,-1);assert.equal(p.getStats().breaks,1);assert.equal(p.getStats().contacts,0);assert.equal(scene.getObjectByName('DashSteelRibbonArt2').geometry.attributes.aClock.array[i*4+2],0);p.dispose();
});
const before=JSON.parse(fs.readFileSync(root+'/live-before.json')).files;
report.livePreserved=Object.entries(before).every(([f,h])=>sha256(fs.readFileSync(f))===h);assert.ok(report.livePreserved);
report.sourceHashes=Object.fromEntries(['class-skill-vfx.js','dash-vfx.js'].map(f=>[f,sha256(fs.readFileSync(root+'/candidate/'+f))]));report.passed=true;
fs.writeFileSync(root+'/cpu-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length,sourceHashes:report.sourceHashes},null,2));
