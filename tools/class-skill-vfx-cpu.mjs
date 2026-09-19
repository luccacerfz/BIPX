import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { moduleUrl, sourceHashes } from './class-skill-vfx-support.mjs';
const THREE = await import(await moduleUrl('vendor/three/three.module.js'));
const { createClassSkillVfx, CLASS_SKILL_VFX } = await import(await moduleUrl('src/vfx/class-skill-vfx.js'));
const { createCombatVfx } = await import(await moduleUrl('src/vfx/combat-vfx.js'));
const { createElementalVfx } = await import(await moduleUrl('src/vfx/elemental-vfx.js'));
const checks=[],sources=await sourceHashes();
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
  vfx.update(0);const stats=vfx.getStats();assert.equal(stats.bodies.active,3);
  // Promoted cannon (docs/arpg/vfx-handoff.md, "Um batch de corpos"): its body lives in the cannon's own 8-cast pool, is counted in
  // bodies.cannonBodies and is never duplicated in the instanced batch. Budget: one instanced batch plus one draw per live cannon body.
  assert.equal(stats.bodies.cannonBodies,1);assert.equal(stats.bodies.drawCalls,1+stats.bodies.cannonBodies);
  const g=scene.getObjectByName('ClassSkillProjectileBodies').geometry;
  // Instanced slots follow cast order (cannon, frost, gravity): the cannon's slot stays hidden, the other two carry the exact endpoint.
  assert.equal(g.attributes.aStyle.getW(0),0,'Cannon must not leave a duplicate body in the instanced batch');
  for(let i=1;i<3;i++){assert.equal(g.attributes.aStyle.getW(i),1);assert.equal(g.attributes.aOrigin.getX(i),target.x);assert.ok(Math.abs(g.attributes.aOrigin.getY(i)-target.y)<1e-6);assert.equal(g.attributes.aOrigin.getZ(i),target.z);}
  const fire=stats.cannon.casts.filter(cast=>cast.body);assert.equal(fire.length,1);assert.equal(fire[0].phase,'travel');
  assert.equal(fire[0].authorityPosition[0],target.x);assert.ok(Math.abs(fire[0].authorityPosition[1]-target.y)<1e-6);assert.equal(fire[0].authorityPosition[2],target.z);
 }
});
check('Terminal travel and expiry remove bodies without fabricating an impact',()=>{
 vfx.reset();const id='dwarf_gravity_shot';vfx.emit(request(id,'travel'));vfx.update(0);const hits=vfx.getStats().events[id].impact;
 vfx.emit(request(id,'travel',{origin:target,target:{...target,x:6},terminal:true}));vfx.update(0);assert.equal(vfx.getStats().bodies.active,0);assert.equal(vfx.getStats().events[id].impact,hits);
 assert.equal(vfx.emit(request(id,'travel')),false);
 vfx.reset();vfx.emit(request(id,'travel'));vfx.update(0);for(let i=0;i<4;i++)vfx.update(.1);assert.equal(vfx.getStats().bodies.active,0);
});
check('A moving dash and an empty terminal release produce a path but never a contact',()=>{
 vfx.reset();vfx.setReducedMotion(false);const id='warrior_cleaving_dash',before=vfx.getStats().events[id].impact,contactsBefore=vfx.getStats().dash.contacts,segmentsBefore=vfx.getStats().dash.segments;
 // Promoted dash art2 (docs/arpg/vfx-handoff.md): the steel family is drawn by the dedicated dash pool from the published distinct
 // phases cast -> release -> travel..., no longer by combat glyphs. A moving dash must leave path segments in that single batch.
 const along=t=>({x:origin.x+(target.x-origin.x)*t,y:origin.y+(target.y-origin.y)*t,z:origin.z+(target.z-origin.z)*t});
 assert.equal(vfx.emit(request(id,'cast')),true);vfx.update(1/60);assert.equal(vfx.emit(request(id,'release')),true);vfx.update(1/60);
 for(let i=1;i<=4;i++){assert.equal(vfx.emit(request(id,'travel',{origin:along((i-1)/4),target:along(i/4),terminal:i===4})),true);vfx.update(1/60);}
 const dashStats=vfx.getStats().dash;assert.ok(dashStats.segments>segmentsBefore);assert.equal(dashStats.drawCalls,1);assert.equal(dashStats.contacts,contactsBefore,'Dash pool fabricated a contact');
 assert.equal(vfx.getStats().events[id].impact,before);assert.equal(vfx.getStats().bodies.active,0);
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
 // Promoted warcry art2-follow (docs/arpg/vfx-warcry-follow-contract.md): the aura is owned by the warcry pool and follows the
 // actor snapshot there; the shared status batch keeps freeze, stun and the fixed gravity area (kind 3), packed without the aura.
 const a=scene.getObjectByName('ClassSkillStatusFields').geometry.attributes,live=[...Array(a.aState.count).keys()].filter(i=>a.aState.getW(i)>0);
 assert.equal(live.length,3);const field=live.find(i=>a.aState.getX(i)===3);assert.notEqual(field,undefined);
 assert.equal(a.aOrigin.getX(field),12);assert.equal(a.aOrigin.getZ(field),-4);assert.ok(Math.abs(a.aState.getY(field)-5.2)<1e-6);
 const aura=()=>vfx.getStats().warcry.records.find(r=>r.id==='hero');assert.deepEqual(aura().position,[origin.x,origin.y,origin.z]);
 const moved={...state,buffs:[{...state.buffs[0],position:{...origin,x:9}}]};vfx.syncState(moved);vfx.update(0);
 assert.equal(aura().position[0],9);assert.equal(a.aOrigin.getX(field),12,'field must not follow caster');
});
check('Low/reduced preserves all essential state cues and projectile when toggled during flight',()=>{
 vfx.reset();vfx.setQuality('high');vfx.setReducedMotion(false);vfx.syncState(state);vfx.emit(request('dwarf_frost_shot','travel'));vfx.update(0);
 vfx.setQuality('low');vfx.setReducedMotion(true);vfx.update(0);const s=vfx.getStats();
 assert.equal(s.bodies.active,1);assert.deepEqual([s.states.buffs,s.states.frozen,s.states.stunned,s.states.fields],[1,1,1,1]);assert.equal(s.states.freezeCrystals,1);
});
check('Torso volumes and pooled Horizon preserve actor height, field centre and low/reduced silhouettes',()=>{
 vfx.reset();vfx.setQuality('low');vfx.setReducedMotion(true);vfx.syncState(state);vfx.update(0);
 const mesh=scene.getObjectByName('ClassSkillVolumes'),a=mesh.geometry.attributes;
 assert.equal(vfx.getStats().states.volumes.active,1);assert.equal(vfx.getStats().states.gravityDebris,8);
 assert.equal(a.aShape.getX(0),1);assert.ok(a.aShape.getZ(0)>2);
 const cry=vfx.getStats().warcry;assert.equal(cry.buffs,1);assert.ok(cry.instances>0);assert.equal(cry.drawCalls,1);assert.deepEqual(cry.records[0].position,[origin.x,origin.y,origin.z]);
 const gravity=vfx.getStats().states.gravity;
 assert.equal(gravity.fields.length,1);assert.deepEqual(gravity.fields[0].center,[12,0,-4]);assert.equal(gravity.fields[0].radius,5.2);assert.equal(gravity.fields[0].nebulaSteps,16);
 assert.equal(mesh.geometry.instanceCount,1,'Only torso surfaces remain in this batch');
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
 vfx.syncState(state);vfx.update(0);vfx.syncState({});vfx.update(0);
 const gone=vfx.getStats();assert.deepEqual([gone.states.buffs,gone.states.frozen,gone.states.stunned,gone.states.fields],[0,0,0,0]);assert.equal(gone.states.drawCalls-gone.warcry.drawCalls,0);
 for(let i=0;i<5;i++)vfx.update(.05);assert.equal(vfx.getStats().states.drawCalls,0,'Aura end flourish must finish within its 0.24 s fade');assert.equal(vfx.getStats().warcry.active,0);
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
  const s=f.vfx.getStats();const fire=s.cannon.casts[0];cadence.push({id,fps,fireSamples:s.fireTrailSamples,elementalEmitted:s.elemental.emitted,distance:s.pathDistance,cannonStream:fire?.flight.streamLength??null,cannonPosition:fire?.position??null});f.vfx.dispose();
 }
 for(const id of ['dwarf_explosive_cannon','dwarf_gravity_shot']){const rows=cadence.filter(c=>c.id===id);assert.equal(new Set(rows.map(c=>c.fireSamples+c.elementalEmitted)).size,1,JSON.stringify(rows));for(const r of rows)assert.ok(Math.abs(r.distance-8)<1e-7);}
 // The promoted cannon draws its fire as one continuous stream in its own pool, so the sample counters above are 0 at every rate;
 // without these lines the cannon half of this check would pass vacuously. Stream length and rendered endpoint must not depend on cadence.
 const cannonRows=cadence.filter(c=>c.id==='dwarf_explosive_cannon');assert.ok(cannonRows.every(r=>r.cannonStream>0));assert.equal(new Set(cannonRows.map(r=>r.cannonStream)).size,1,JSON.stringify(cannonRows));
 for(const r of cannonRows){assert.ok(Math.abs(r.cannonPosition[0]-8)<1e-6);assert.equal(r.cannonPosition[1],1);assert.equal(r.cannonPosition[2],0);}
 assert.ok(cadence.filter(c=>c.id==='dwarf_gravity_shot').every(r=>r.elementalEmitted>0));
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
assert.deepEqual(await sourceHashes(),sources);const out=`${process.env.BIPX_EVIDENCE_DIR||'output/qa'}/class-skill-vfx-v2-${new Date().toISOString().replace(/[:.]/g,'-')}-cpu.json`;
await fs.mkdir(process.env.BIPX_EVIDENCE_DIR||'output/qa',{recursive:true});await fs.writeFile(out,JSON.stringify({passed:true,version:2,scope:'CPU buffers/contact/status/lifecycle; not rendered gameplay',sourceChanged:false,sources,checks,cadence},null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:checks.length,out,cadence}));
