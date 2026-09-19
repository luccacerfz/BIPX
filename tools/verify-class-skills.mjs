import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CLASS_SKILLS, createSkillState, beginSkill, advanceSkills, getSkillHud, getSkillModifiers, restoreSkillSnapshot, skillSnapshot, applySkillControl, tickSkillControl, cancelSkills } from '../src/combat/class-skills.mjs';
import { createCollisionWorld, moveActor, sweepStatic, separateActors } from '../src/physics/contacts.mjs';
const source = fs.readFileSync('src/combat/class-skills.mjs');
const checks = [];
function check(name, fn) { fn(); checks.push(name); console.log(name); }
function fixture(classId, targets = [], colliders = []) {
 const state = createSkillState(classId), actor = {x:0,z:0,radius:.64,playing:true,damageMultiplier:2,runId:'fixture'}, events=[],hits=[];
 const world=createCollisionWorld({colliders,bounds:{x:0,z:0,radius:55}});
 const options={actor,targets,emit:e=>events.push(e),sweepStatic:(a,b,r,kind)=>sweepStatic(world,a,b,r,{kind}),
  moveCaster:d=>{const m=moveActor(world,actor,d);actor.x=m.x;actor.z=m.z;return m;},
  moveTarget:(t,d)=>{const m=moveActor(world,t,d);Object.assign(t,{x:m.x,z:m.z});return m;},
  hit:(t,e)=>{hits.push({id:t.id,...e});applySkillControl(t,e);t.health=(t.health??100)-e.damage;t.dead=t.health<=0;return t.dead;}};
 return {state,actor,events,hits,targets,world,options,cast(slot){return beginSkill(state,{slot,aimX:1,aimZ:0},actor);},
  tick(seconds,dt=.02){for(let t=0;t<seconds-1e-8;t+=dt)advanceSkills(state,Math.min(dt,seconds-t),options);}};
}
const target=(id,x,z=0,extra={})=>({id,x,z,radius:.5,health:100,...extra});
check('V2 canonical six IDs, exactly three slots each and no old spell alias',()=>{
 assert.deepEqual(CLASS_SKILLS.map(s=>s.id),['warrior_war_cry','warrior_cleaving_dash','warrior_shield_charge','dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot']);
 for(const c of ['warrior','dwarf'])assert.deepEqual(CLASS_SKILLS.filter(s=>s.classId===c).map(s=>s.slot),[0,1,2]);
});
for(const def of CLASS_SKILLS)check(`${def.id}: real behavior, cost, anticipation and one hit per victim`,()=>{
 const f=fixture(def.classId,[target(1,3),target(2,3,1),target(3,40,20)]);
 assert.ok(f.cast(def.slot).ok);assert.equal(f.state.resource,100-def.cost);assert.equal(f.state.cooldowns[def.slot],def.cooldown);
 assert.equal(f.cast(def.slot).reason,'casting');f.tick(def.windup-.001);assert.equal(f.hits.length,0);
 f.tick(2);assert.equal(f.events.filter(e=>e.phase==='release').length,1);
 if(def.shape==='buff'){assert.ok(f.state.buff.remaining>5);assert.deepEqual(getSkillModifiers(f.state),{damage:1.35,speed:1.15});assert.equal(f.hits.length,0);}
 else {assert.equal(f.hits.filter(h=>h.id===1).length,1);assert.equal(f.hits[0].damage,def.damage*2);assert.ok(!f.hits.some(h=>h.id===3));}
 if(def.shape==='dash')assert.ok(Math.abs(f.actor.x-def.range)<1e-5);
 if(def.freeze)assert.equal(f.hits.filter(h=>h.freeze===3).length,2);
 if(def.stun)assert.equal(f.hits.filter(h=>h.stun===2.2).length,2);
 if(def.fieldDuration)assert.ok(f.state.fields.length===1&&f.targets[1].x<3);
 assert.equal(f.cast(def.slot).reason,'cooldown');
});
check('Buff modifies real subsequent damage and speed, expires, and death cancels all persistent state',()=>{
 const f=fixture('warrior',[target(1,4)]);f.cast(0);f.tick(.9);assert.ok(getSkillHud(f.state).statuses[0].remaining>7);
 assert.ok(f.cast(1).ok);f.tick(1);assert.equal(f.hits[0].damage,14*2*1.35);
 const snapshot=skillSnapshot(f.state);assert.deepEqual(skillSnapshot(restoreSkillSnapshot(snapshot)),snapshot);
 f.tick(8);assert.deepEqual(getSkillModifiers(f.state),{damage:1,speed:1});assert.ok(f.events.some(e=>e.status==='buff'&&e.phase==='end'));
 const g=fixture('dwarf');g.cast(2);g.tick(2);assert.equal(g.state.fields.length,1);advanceSkills(g.state,.02,{...g.options,dead:true});assert.equal(g.state.fields.length,0);assert.equal(g.state.active.length,0);
});
check('Dash/charge sweep thin wall, arena, large dt and all victims along actual corridor',()=>{
 for(const slot of [1,2]){
  const f=fixture('warrior',[target(1,1),target(2,1,1),target(3,4)], [{id:'thin',shape:'box',x:3,z:0,halfX:.05,halfZ:10}]);
  f.cast(slot);advanceSkills(f.state,5,f.options);assert.equal(f.actor.x,0);f.tick(1);
  assert.ok(f.actor.x<=2.310001);assert.ok(f.hits.some(h=>h.id===1));assert.ok(f.hits.some(h=>h.id===2));assert.ok(!f.hits.some(h=>h.id===3));
  const last=f.events.filter(e=>e.phase==='travel').at(-1);assert.equal(last.target.x,f.actor.x);assert.ok(last.terminal);
 }
 const edge=fixture('warrior');edge.actor.x=53;edge.cast(1);edge.tick(1);assert.ok(edge.actor.x<=54.36+1e-6);
});
check('Freeze and stun hit every valid target, use explicit boss resistance, expire and stop attacks',()=>{
 for(const [cls,slot,status,normal,bossDuration] of [['dwarf',1,'freeze',3,.8],['warrior',2,'stun',2.2,.65]]){
  const f=fixture(cls,[target(1,3),target(2,3,1,{boss:true,meleeAttack:{active:true}})]);f.cast(slot);f.tick(1.1);
  assert.equal(f.hits[0].statusDuration,normal);assert.equal(f.hits[1].statusDuration,bossDuration);assert.ok(f.hits[1].resisted);assert.equal(f.targets[1].meleeAttack.active,false);
  for(let t=0;t<normal+.2;t+=.02)for(const victim of f.targets)tickSkillControl(victim,.02,e=>f.events.push(e));
  assert.equal(f.targets[0][status==='freeze'?'freezeTimer':'stunTimer'],0);assert.equal(Object.keys(f.targets[0].skillStatuses).length,0);
  assert.equal(f.events.filter(e=>e.phase==='end'&&e.status===status).length,2);
 }
});
check('Gravity is fixed, pulls continuously with collisions and rest radius, then expires',()=>{
 const f=fixture('dwarf',[target(1,4)]);f.cast(2);f.tick(.7);assert.equal(f.state.fields.length,1);const field={...f.state.fields[0]};
 f.targets.push(target(2,field.x+4,1));const victim=f.targets[1], before=Math.hypot(victim.x-field.x,victim.z-field.z);f.actor.x=20;
 f.tick(1);assert.equal(f.state.fields[0].x,field.x);assert.ok(Math.hypot(victim.x-field.x,victim.z-field.z)<before-1);
 f.tick(4.5);assert.equal(f.state.fields.length,0);assert.ok(f.events.some(e=>e.phase==='end'&&e.status==='gravity'));
 const wall=fixture('dwarf',[],[{id:'wall',shape:'box',x:4,z:0,halfX:.1,halfZ:5}]);
 wall.state.fields=[{skillId:'dwarf_gravity_shot',castId:'field',status:'gravity',x:2,y:.08,z:0,radius:5,remaining:5,duration:5,origin:{x:2,y:.08,z:0}}];
 wall.targets.push(target(1,6));wall.tick(4);assert.ok(wall.targets[0].x>=4.6-1e-6);
});
check('Crowd pulled into gravity stays finite, separated and outside walls',()=>{
 const f=fixture('dwarf',Array.from({length:12},(_,i)=>target(i,2+Math.cos(i)*3,Math.sin(i)*3)));
 f.state.fields=[{skillId:'dwarf_gravity_shot',castId:'crowd',status:'gravity',x:2,y:.08,z:0,radius:5,remaining:5,duration:5,origin:{x:2,y:.08,z:0}}];
 for(let i=0;i<240;i++){f.tick(1/60,1/60);const separated=separateActors(f.world,f.targets,{iterations:2,maxTotalCorrection:.2});separated.bodies.forEach((b,j)=>Object.assign(f.targets[j],{x:b.x,z:b.z}));}
 assert.ok(f.targets.every(t=>Number.isFinite(t.x)&&Math.hypot(t.x,t.z)<10));
 for(let i=0;i<f.targets.length;i++)for(let j=i+1;j<f.targets.length;j++)assert.ok(Math.hypot(f.targets[i].x-f.targets[j].x,f.targets[i].z-f.targets[j].z)>.8);
});
check('Projectile wall wins tie, area cannot cross wall, moving release uses current actor',()=>{
 const f=fixture('dwarf',[target(1,4)], [{id:'wall',shape:'box',x:3,z:0,halfX:.1,halfZ:8}]);f.cast(0);f.tick(2);assert.equal(f.hits.length,0);
 const g=fixture('dwarf');g.cast(1);g.actor.x=2;g.tick(.3);assert.equal(g.events.find(e=>e.phase==='release').origin.x,2);assert.equal(g.events.find(e=>e.phase==='release').origin.y,1.05);
});
check('Only dash kills carry cleave; survivors are intact; callback owns single reward',()=>{
 const f=fixture('warrior',[target(1,2,0,{health:1}),target(2,4,0,{health:100})]);f.cast(1);f.tick(1);
 assert.equal(f.hits.filter(h=>h.id===1).length,1);const impacts=f.events.filter(e=>e.phase==='impact');assert.equal(impacts[0].killed,true);assert.equal(impacts[1].killed,false);assert.equal(f.hits[0].deathStyle,'cleave');
});
check('Opening-wave control leaves5HP enemies alive, then damage combo owns one reward',()=>{
 for(const [cls,slot,key] of [['warrior',2,'stunTimer'],['dwarf',1,'freezeTimer'],['dwarf',2,null]]) {
  const f=fixture(cls,[target(1,3,0,{health:5}),target(2,3,1,{health:5})]);f.cast(slot);f.tick(1.1);
  assert.ok(f.targets.every(t=>t.health>0));if(key)assert.ok(f.targets.every(t=>t[key]>0));
  if(cls==='warrior'){f.actor.x=0;assert.ok(f.cast(1).ok);f.tick(1);assert.ok(f.targets.every(t=>t.dead));assert.equal(f.events.filter(e=>e.phase==='impact'&&e.killed).length,2);}
 }
});
check('Zero dt emits nothing; input cannot grant cost/damage/attributes; pause/dead/invalid rejected',()=>{
 const f=fixture('warrior');const result=beginSkill(f.state,{slot:0,cost:0,damage:9999,buffDuration:999,aimX:NaN,aimZ:Infinity},f.actor);assert.ok(result.ok);assert.equal(f.state.resource,76);
 const before=skillSnapshot(f.state);advanceSkills(f.state,0,f.options);assert.deepEqual(skillSnapshot(f.state),before);assert.equal(f.events.length,0);
 for(const extra of [{dead:true},{paused:true},{playing:false}])assert.equal(beginSkill(createSkillState('warrior'),{slot:0},{...f.actor,...extra}).reason,'state');
 for(const slot of [-1,3,'0',1.2,null])assert.equal(beginSkill(createSkillState('warrior'),{slot},f.actor).reason,'slot');
 const weak=createSkillState('dwarf');weak.resource=1;assert.equal(beginSkill(weak,{slot:0},f.actor).reason,'resource');
 cancelSkills(f.state);assert.equal(f.state.active.length,0);
});
const report={passed:true,version:2,scope:'CPU fixtures using production skill core and physics; not visual gameplay',checks,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),sourceChanged:!source.equals(fs.readFileSync('src/combat/class-skills.mjs'))};
assert.equal(report.sourceChanged,false);fs.mkdirSync('output/qa/arpg-skills-v2',{recursive:true});fs.writeFileSync('output/qa/arpg-skills-v2/cpu.json',JSON.stringify(report,null,2));
