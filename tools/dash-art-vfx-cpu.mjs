import {requireStagingArtefacts} from './quality-staging.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {moduleUrl,sha256} from './class-skill-vfx-support.mjs';
import {createSkillState,beginSkill,advanceSkills,skillSnapshot} from '../src/combat/class-skills.mjs';
const root='output/vfx-dash-art-v1';
// Gate of the rejected dash art1 candidate: candidate, baseline and the recorded native input all live in the untracked output/ tree.
requireStagingArtefacts([root+'/candidate/class-skill-vfx.js',root+'/baseline/class-skill-vfx.js',root+'/candidate/dash-vfx.js','output/playwright/2026-09-19T03-35-43-992Z-verify-arpg-combos/combo-warrior-high.json']);
const THREE=await import(await moduleUrl('vendor/three/three.module.js'));
const {createClassSkillVfx}=await import(await moduleUrl(root+'/candidate/class-skill-vfx.js'));
const baseline=await import(await moduleUrl(root+'/baseline/class-skill-vfx.js'));
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
  for(const attr of Object.values(scene.getObjectByName('DashSteelRibbonArt1').geometry.attributes))assert.ok([...attr.array].every(Number.isFinite));
  report.runs.push({dt,quality,reduced,phases:stats.events[skillId],pool:stats.dash,authority:skillSnapshot(state)});vfx.dispose();
 }
});
function capacityBytes(){return 576*(3+3+4+4)*4;}
check('Ribbon endpoints are the two observed sockets; no teleport bridge or extrapolation',()=>{
 const scene=new THREE.Scene(),pool=createDashVfx({THREE,scene});pool.emit(request('release'));pool.update(.02);const next={x:.4,y:1.6,z:.5};pool.emit(request('travel',{target:{x:0,y:.1,z:.5},emitter:next}));pool.update(0);
 const a=scene.getObjectByName('DashSteelRibbonArt1').geometry.attributes;assert.deepEqual(Array.from(a.aFrom.array.slice(64*3,64*3+3)),[Math.fround(emitter.x),Math.fround(emitter.y),0]);assert.deepEqual(Array.from(a.aTo.array.slice(64*3,64*3+3)),[Math.fround(next.x),Math.fround(next.y),.5]);
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
const before=JSON.parse(fs.readFileSync(root+'/live-before.json')).files;
report.livePreserved=Object.entries(before).every(([f,h])=>sha256(fs.readFileSync(f))===h);assert.ok(report.livePreserved);
report.sourceHashes=Object.fromEntries(['class-skill-vfx.js','dash-vfx.js'].map(f=>[f,sha256(fs.readFileSync(root+'/candidate/'+f))]));report.passed=true;
fs.writeFileSync(root+'/cpu-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length,sourceHashes:report.sourceHashes},null,2));
