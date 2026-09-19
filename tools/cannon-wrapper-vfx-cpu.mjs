import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { moduleUrl, sourceHashes } from './class-skill-vfx-support.mjs';
const THREE = await import(await moduleUrl('vendor/three/three.module.js'));
const { createClassSkillVfx, CLASS_SKILL_VFX } = await import(await moduleUrl('assets/vfx/source-history/cannon-wrapper-integration-20260919/class-skill-vfx.js'));
const { createCombatVfx } = await import(await moduleUrl('assets/vfx/source-history/cannon-wrapper-integration-20260919/combat-vfx.js'));
const { createElementalVfx } = await import(await moduleUrl('assets/vfx/source-history/cannon-wrapper-integration-20260919/elemental-vfx.js'));
const stage='assets/vfx/source-history/cannon-wrapper-integration-20260919';
const stagedFiles=(await fs.readdir(stage)).filter(n=>n.endsWith('.js')).map(n=>`${stage}/${n}`);
const checks=[],sources=await sourceHashes(stagedFiles);
const check=(name,run)=>{run();checks.push({name,pass:true});};
const make=(quality='high',reducedMotion=false)=>{const scene=new THREE.Scene();return {scene,vfx:createClassSkillVfx({THREE,scene,quality,reducedMotion})};};
const origin={x:3,y:1.5,z:-2},target={x:5,y:.7,z:-1},direction={x:2,y:-.8,z:1};
const request=(skillId,phase,extra={})=>({skillId,phase,origin,target,direction,castId:skillId,...extra});
const {scene,vfx}=make();
const meshes=()=>{const list=[];scene.traverse(n=>{if(n.isMesh)list.push(n);});return list;};
check('Only the six canonical v2 skills emit finite instance buffers',()=>{
 assert.deepEqual(Object.keys(CLASS_SKILL_VFX),['warrior_war_cry','warrior_cleaving_dash','warrior_shield_charge','dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot']);
 for(const id of Object.keys(CLASS_SKILL_VFX))for(const phase of ['cast','release','impact'])assert.equal(vfx.emit(request(id,phase)),true);
 assert.equal(vfx.emit(request('dwarf_arcane_shot','cast')),false);vfx.update(0);
 for(const mesh of meshes())for(const attr of Object.values(mesh.geometry.attributes))for(const n of attr.array)assert.ok(Number.isFinite(n));
});
check('Malformed contact, phases, absent travel IDs and nonfinite emitters cannot emit',()=>{
 const before=vfx.getStats().elemental.emitted+vfx.getStats().combat.totalEmitted;
 for(const data of [null,{},request('constructor','cast'),request('dwarf_gravity_shot','unknown'),request('dwarf_gravity_shot','impact',{target:null}),request('dwarf_gravity_shot','travel',{castId:null}),request('dwarf_gravity_shot','cast',{emitter:{x:NaN,z:0}})])assert.equal(vfx.emit(data),false);
 assert.equal(vfx.getStats().elemental.emitted+vfx.getStats().combat.totalEmitted,before);
});
check('Cast/release dedup and multiple contacts preserve one event per actual target',()=>{
 vfx.reset();const id='warrior_shield_charge';
 for(const phase of ['cast','release']){assert.equal(vfx.emit(request(id,phase)),true);assert.equal(vfx.emit(request(id,phase)),false);}
 for(let i=0;i<9;i++){assert.equal(vfx.emit(request(id,'impact',{contactId:`enemy${i}`})),true);assert.equal(vfx.emit(request(id,'impact',{contactId:`enemy${i}`})),false);}
});
check('Three bodies retain exact real endpoint in high/medium/low and reduced motion',()=>{
 for(const quality of ['high','medium','low'])for(const reduced of [false,true]){
  vfx.reset();vfx.setQuality(quality);vfx.setReducedMotion(reduced);
  for(const id of ['dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot'])assert.equal(vfx.emit(request(id,'travel')),true);
  vfx.update(0);assert.equal(vfx.getStats().bodies.active,3);assert.equal(vfx.getStats().bodies.drawCalls,2);assert.deepEqual(vfx.getStats().cannon.casts.find(c=>c.body).position,[target.x,target.y,target.z]);
  const g=scene.getObjectByName('ClassSkillProjectileBodies').geometry;
  for(let i=1;i<3;i++){assert.equal(g.attributes.aStyle.getW(i),1);assert.equal(g.attributes.aOrigin.getX(i),target.x);assert.ok(Math.abs(g.attributes.aOrigin.getY(i)-target.y)<1e-6);assert.equal(g.attributes.aOrigin.getZ(i),target.z);}
 }
});
check('Terminal travel and expiry remove bodies without fabricating an impact',()=>{
 vfx.reset();const id='dwarf_gravity_shot';vfx.emit(request(id,'travel'));vfx.update(0);const hits=vfx.getStats().events[id].impact;
 vfx.emit(request(id,'travel',{origin:target,target:{...target,x:6},terminal:true}));vfx.update(0);assert.equal(vfx.getStats().bodies.active,0);assert.equal(vfx.getStats().events[id].impact,hits);
 assert.equal(vfx.emit(request(id,'travel')),false);
 vfx.reset();vfx.emit(request(id,'travel'));vfx.update(0);for(let i=0;i<4;i++)vfx.update(.1);assert.equal(vfx.getStats().bodies.active,0);
});
check('A moving dash and an empty terminal release produce a path but never a contact',()=>{
 vfx.reset();vfx.setReducedMotion(false);const id='warrior_cleaving_dash',before=vfx.getStats().events[id].impact;
 vfx.emit(request(id,'travel',{release:true,terminal:true}));vfx.update(0);
 assert.ok(vfx.getStats().combat.activeGlyphs>0);assert.equal(vfx.getStats().events[id].impact,before);assert.equal(vfx.getStats().bodies.active,0);
});
check('Glacial detonation writes exact supplied contact, ground and radius across quality/motion',()=>{
 for(const quality of ['high','medium','low'])for(const reduced of [false,true]){
  vfx.reset();vfx.setQuality(quality);vfx.setReducedMotion(reduced);vfx.emit(request('dwarf_frost_shot','impact',{radius:4.3,groundY:2.35}));vfx.update(0);
  const a=scene.getObjectByName('ElementalImpactSurfaces').geometry.attributes;
  assert.equal(a.aLook.getX(0),4);assert.equal(a.aOrigin.getX(0),target.x);assert.ok(Math.abs(a.aOrigin.getY(0)-2.35)<1e-6);assert.ok(Math.abs(a.aParams.getZ(0)-4.3)<1e-6);
 }
});
const state={buffs:[{id:'hero',position:origin,remaining:3,duration:5}],statuses:[{id:'frozen',position:target,freezeRemaining:2,stunRemaining:0,radius:.7},{id:'stunned',position:{x:8,y:0,z:2},freezeRemaining:0,stunRemaining:1,height:2.7}],fields:[{id:'gravity',position:{x:12,y:0,z:-4},remaining:4,duration:4,radius:5.2}]};
check('Authoritative status snapshot creates aura, individual freeze/stun and fixed gravity area',()=>{
 vfx.reset();vfx.setQuality('high');vfx.syncState(state);vfx.update(0);const s=vfx.getStats().states;
 assert.deepEqual([s.buffs,s.frozen,s.stunned,s.fields,s.freezeCrystals],[1,1,1,1,3]);
 const a=scene.getObjectByName('ClassSkillStatusFields').geometry.attributes;
 assert.equal(a.aOrigin.getX(3),12);assert.equal(a.aOrigin.getZ(3),-4);assert.ok(Math.abs(a.aState.getY(3)-5.2)<1e-6);
 const moved={...state,buffs:[{...state.buffs[0],position:{...origin,x:9}}]};vfx.syncState(moved);vfx.update(0);
 assert.equal(a.aOrigin.getX(0),9);assert.equal(a.aOrigin.getX(3),12,'field must not follow caster');
});
check('Low/reduced preserves all essential state cues and projectile when toggled during flight',()=>{
 vfx.reset();vfx.setQuality('high');vfx.setReducedMotion(false);vfx.syncState(state);vfx.emit(request('dwarf_frost_shot','travel'));vfx.update(0);
 vfx.setQuality('low');vfx.setReducedMotion(true);vfx.update(0);const s=vfx.getStats();
 assert.equal(s.bodies.active,1);assert.deepEqual([s.states.buffs,s.states.frozen,s.states.stunned,s.states.fields],[1,1,1,1]);assert.equal(s.states.freezeCrystals,1);
});
check('Torso volumes and pooled Horizon preserve actor height, field centre and low/reduced silhouettes',()=>{
 vfx.reset();vfx.setQuality('low');vfx.setReducedMotion(true);vfx.syncState(state);vfx.update(0);
 const mesh=scene.getObjectByName('ClassSkillVolumes'),a=mesh.geometry.attributes;
 assert.equal(vfx.getStats().states.volumes.active,2);assert.equal(vfx.getStats().states.gravityDebris,8);
 assert.equal(a.aShape.getX(0),0);assert.ok(a.aShape.getZ(0)>2);
 assert.equal(a.aShape.getX(1),1);assert.ok(a.aShape.getZ(1)>2);
 const gravity=vfx.getStats().states.gravity;
 assert.equal(gravity.fields.length,1);assert.deepEqual(gravity.fields[0].center,[12,0,-4]);assert.equal(gravity.fields[0].radius,5.2);assert.equal(gravity.fields[0].nebulaSteps,16);
 assert.equal(mesh.geometry.instanceCount,2,'Only torso surfaces remain in this batch');
 assert.equal(mesh.material.uniforms.uMotion.value,0);
});
check('Shield front follows resolved travel, keeps collision width and disappears at terminal',()=>{
 vfx.reset();const id='warrior_shield_charge',at={x:6,y:.1,z:-3};
 vfx.emit(request(id,'travel',{origin:{x:5,y:.1,z:-3},target:at,direction:{x:1,y:0,z:0},radius:.91}));vfx.update(0);
 const a=scene.getObjectByName('ClassSkillVolumes').geometry.attributes;
 assert.equal(vfx.getStats().states.volumes.active,1);assert.equal(a.aShape.getX(0),6);assert.equal(a.aOrigin.getX(0),6);assert.equal(a.aOrigin.getZ(0),-3);assert.ok(Math.abs(a.aShape.getY(0)-.91)<1e-6);
 assert.equal(scene.getObjectByName('ClassSkillVolumes').geometry.instanceCount,1);
 const impacts=vfx.getStats().events[id].impact;
 vfx.emit(request(id,'travel',{origin:at,target:at,terminal:true}));vfx.update(0);
 assert.equal(vfx.getStats().states.volumes.active,0);assert.equal(vfx.getStats().events[id].impact,impacts);
});
check('Pause freezes all statuses/fields and physics-free expiry produces fracture/collapse',()=>{
 vfx.reset();vfx.syncState(state);vfx.update(0);
 const before=vfx.getStats();for(let i=0;i<50;i++)vfx.update(0);assert.deepEqual(vfx.getStats(),before);
 for(let i=0;i<50;i++)vfx.update(.1);const s=vfx.getStats();assert.equal(s.states.buffs+s.states.frozen+s.states.stunned+s.states.fields,0);
 assert.ok(s.elemental.events.glacialImpact>before.elemental.events.glacialImpact);assert.equal(s.elemental.events.arcaneImpact,before.elemental.events.arcaneImpact,'Gravity must not emit a second detonation after expiry');assert.equal(s.states.gravity.drawCalls,0);
});
check('Snapshot removal/reset clears statuses without leaving persistent fields',()=>{
 vfx.syncState(state);vfx.update(0);vfx.syncState({});vfx.update(0);assert.equal(vfx.getStats().states.drawCalls,0);
 vfx.syncState(state);vfx.reset();vfx.update(0);assert.equal(vfx.getStats().states.drawCalls,0);
});
check('Status events and matching snapshots share slots; status end does not kill another body',()=>{
 vfx.reset();vfx.emit(request('dwarf_frost_shot','travel'));
 const status=request('dwarf_frost_shot','status',{status:'freeze',targetId:17,remaining:3,statusDuration:3});
 assert.equal(vfx.emit(status),true);vfx.update(0);assert.equal(vfx.getStats().states.frozen,1);
 vfx.syncState({statuses:[{id:17,position:target,freezeRemaining:3}]});vfx.update(0);assert.equal(vfx.getStats().states.frozen,1);
 assert.equal(vfx.emit({...status,phase:'end',remaining:0}),true);vfx.update(0);
 assert.equal(vfx.getStats().states.frozen,0);assert.equal(vfx.getStats().bodies.active,1);
});
const cadence=[];
check('Distance-based fire and purple trails agree at 30/60/144 Hz',()=>{
 for(const id of ['dwarf_explosive_cannon','dwarf_gravity_shot'])for(const fps of [30,60,144]){
  const f=make();for(let i=0;i<fps;i++)f.vfx.emit(request(id,'travel',{origin:{x:i/fps*8,y:1,z:0},target:{x:(i+1)/fps*8,y:1,z:0}}));
  const s=f.vfx.getStats();cadence.push({id,fps,fireSamples:s.fireTrailSamples,elementalEmitted:s.elemental.emitted,distance:s.pathDistance});f.vfx.dispose();
 }
 for(const id of ['dwarf_explosive_cannon','dwarf_gravity_shot']){const rows=cadence.filter(c=>c.id===id);assert.equal(new Set(rows.map(c=>c.fireSamples+c.elementalEmitted)).size,1,JSON.stringify(rows));for(const r of rows)assert.ok(Math.abs(r.distance-8)<1e-7);}
});
check('2000 casts and saturated statuses preserve meshes/buffers; overload is observable',()=>{
 vfx.reset();vfx.setQuality('high');const original=meshes(),arrays=original.flatMap(m=>Object.values(m.geometry.attributes).map(a=>a.array));
 for(let i=0;i<2000;i++)vfx.emit(request('dwarf_frost_shot','impact',{castId:i}));vfx.update(0);assert.equal(vfx.getStats().activeCasts,64);assert.ok(vfx.getStats().overwritten>0);
 vfx.syncState({statuses:Array.from({length:300},(_,id)=>({id,position:target,freezeRemaining:2}))});vfx.update(0);assert.equal(vfx.getStats().states.frozen,256);assert.equal(vfx.getStats().states.dropped,44);
 vfx.setQuality('low');vfx.update(0);assert.ok(vfx.getStats().activeCasts<=20);vfx.reset();assert.deepEqual(meshes(),original);
 const after=meshes().flatMap(m=>Object.values(m.geometry.attributes).map(a=>a.array));for(let i=0;i<arrays.length;i++)assert.equal(arrays[i],after[i]);
});
check('Borrowed combat/elemental pools are never advanced, reset, configured or disposed',()=>{
 const s=new THREE.Scene(),c=createCombatVfx({THREE,scene:s,ambient:false}),e=createElementalVfx({THREE,scene:s});const original=s.children.slice();
 const f=createClassSkillVfx({THREE,scene:s,combatVfx:c,elementalVfx:e});e.emit('toxicImpact',target);e.update(.1);const before=e.getStats();
 f.update(.1);f.reset();f.setQuality('low');f.setReducedMotion(true);f.dispose();f.dispose();assert.deepEqual(s.children,original);assert.deepEqual(e.getStats(),before);assert.equal(c.getStats().disposed,false);c.dispose();e.dispose();
});
check('Owned disposal releases actual geometry/material resources exactly once',()=>{
 let g=0,m=0;const geometries=new Set(meshes().map(o=>o.geometry)),materials=new Set(meshes().map(o=>o.material));
 for(const x of geometries)x.addEventListener('dispose',()=>g++);for(const x of materials)x.addEventListener('dispose',()=>m++);
 vfx.dispose();vfx.dispose();assert.equal(scene.children.length,0);assert.equal(g,geometries.size);assert.equal(m,materials.size);assert.equal(vfx.emit(request('dwarf_gravity_shot','impact')),false);
});
assert.deepEqual(await sourceHashes(stagedFiles),sources);const out=`output/qa/cannon-wrapper-vfx-v2-${new Date().toISOString().replace(/[:.]/g,'-')}-cpu.json`;
await fs.mkdir('output/qa',{recursive:true});await fs.writeFile(out,JSON.stringify({passed:true,version:2,scope:'Isolated staged wrapper CPU buffers/contact/status/lifecycle; not runtime promotion or gameplay',sourceChanged:false,sources,checks,cadence},null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:checks.length,out,cadence}));
