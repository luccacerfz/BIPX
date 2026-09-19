import {requireStagingArtefacts} from './quality-staging.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {getEnvironmentColliders,ENVIRONMENT_GROUND} from '../src/render/environment-layout.js';
import {selectEnvironmentSkillAreas,ENVIRONMENT_SKILL_IDS} from '../src/render/environment-skill-focus.js';
import {createCollisionWorld,sweepStatic,moveActor,stepActor} from '../src/physics/contacts.mjs';
import {createSkillState,beginSkill,advanceSkills,getClassSkills} from '../src/combat/class-skills.mjs';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['src/render/environment-layout.js','src/render/environment-skill-focus.js','src/render/asset-dressing.js','src/physics/contacts.mjs','src/combat/class-skills.mjs'];
const sourceHashes=Object.fromEntries(files.map(p=>[p,hash(p)]));
const checks=[],check=(name,fn)=>{fn();checks.push(name)};
const world=createCollisionWorld({colliders:getEnvironmentColliders(),bounds:ENVIRONMENT_GROUND,groundY:0});
const routes=[];
for(const degrees of [135,210,270,345])for(const radius of [.64,1.3]){
 const radians=degrees*Math.PI/180,to={x:Math.sin(radians)*14,z:-Math.cos(radians)*14};
 check(`14m route ${degrees} degrees with radius ${radius}`,()=>{
  assert.equal(sweepStatic(world,{x:0,z:0},to,radius,{kind:'actor',y:0,height:2}),null);
  const movement=moveActor(world,{x:0,z:0,radius,height:2},to);
  assert.equal(movement.blocked,false);assert.equal(movement.unresolved,false);assert(Math.hypot(movement.x-to.x,movement.z-to.z)<1e-6);
 });
 routes.push({degrees,radius,from:{x:0,z:0},to,length:14});
}
// A dense sampling audit supplements the named launch corridors; no guarantee all headings are open.
const directions=[];
for(let degrees=0;degrees<360;degrees+=5){const radians=degrees*Math.PI/180;const hit=sweepStatic(world,{x:0,z:0},{x:Math.sin(radians)*14,z:-Math.cos(radians)*14},.64,{kind:'actor',y:0,height:2});directions.push({degrees,clearDistance:hit?hit.t*14:14,collider:hit?.colliderId??null})}
check('Solid mausoleum stops long displacement on its exact front face',()=>{
 const contact=moveActor(world,{x:0,z:-35,radius:.64,height:2},{x:0,z:-100});
 assert(contact.contacts.some(c=>c.colliderId==='mausoleum-foundation'));assert(contact.z>=-37.36-.001);assert(!contact.unresolved);
});
check('Long frame keeps movement bounded on real map',()=>{
 const move=stepActor(world,{x:0,z:0,radius:.64,height:2},{x:-100,z:0},2);
 assert.equal(move.dt,.1);assert(move.discardedDt>=1.9);assert(Math.hypot(move.displacement.x,move.displacement.z)<=10.001);assert(!move.unresolved);
});
const integratedMovements=[];
for(const slot of [1,2])for(const wall of [false,true]){
 const def=getClassSkills('warrior')[slot],actor={x:0,z:wall?-35:0,playing:true},state=createSkillState('warrior');
 const direction=wall?{x:0,z:-1}:{x:Math.SQRT1_2,z:Math.SQRT1_2};
 check(`${def.id} real core ${wall?'stops at mausoleum':'follows clear 135 degree route'}`,()=>{
  assert(beginSkill(state,{slot,aimX:direction.x,aimZ:direction.z},actor).ok);
  const from={...actor},events=[];
  for(let i=0;i<200;i++)advanceSkills(state,1/120,{actor,
   sweepStatic:(a,b,r,kind)=>sweepStatic(world,a,b,r,{kind,y:0,height:2}),
   moveCaster:delta=>{const moved=moveActor(world,{...actor,radius:.64,height:2},delta);assert(!moved.unresolved);actor.x=moved.x;actor.z=moved.z;return moved},
   emit:event=>events.push(event)});
  const distance=Math.hypot(actor.x-from.x,actor.z-from.z);
  if(wall){assert(actor.z>=-37.36-.001);assert(distance>2&&distance<2.361)}
  else assert(Math.abs(distance-def.range)<.002);
  assert.equal(state.active.length,0);assert(events.some(e=>e.phase==='travel'));
  const final=moveActor(world,{...actor,radius:.64,height:2},{x:0,z:0});assert(!final.blocked);assert(!final.unresolved);
  integratedMovements.push({skillId:def.id,wall,from:{x:from.x,z:from.z},to:{x:actor.x,z:actor.z},distance,range:def.range,events:events.map(e=>({phase:e.phase,terminal:e.terminal,target:e.target}))});
 });
}
const area=(id,x=0,radius=4,remaining=2)=>({id,skillId:'dwarf_gravity_shot',position:{x,y:0,z:0},radius,remaining});
check('Only six canonical v2 skill IDs',()=>assert.deepEqual(ENVIRONMENT_SKILL_IDS,['warrior_war_cry','warrior_cleaving_dash','warrior_shield_charge','dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot']));
check('Selection rejects expired, invalid and historical skill areas',()=>{
 const input=[area('live'),area('expired',0,4,0),area('negative',0,-1),area('far',100),{...area('old'),skillId:'dwarf_arcane_shot'},{...area('nan'),position:{x:NaN,z:0}},area('missing-time',0,4,Infinity)];
 assert.deepEqual(selectEnvironmentSkillAreas(input,{x:0,z:0}).map(a=>a.id),['live']);
});
check('Combat v2 flat gravity snapshots normalize without mutating authority state',()=>{
 const field={skillId:'dwarf_gravity_shot',castId:'authority:1',x:9,y:.08,z:-7,radius:5,remaining:4.5,duration:5};
 const encoded=JSON.stringify(field),selected=selectEnvironmentSkillAreas([field],{x:0,z:0});
 assert.equal(selected.length,1);assert.deepEqual(selected[0].position,{x:9,y:.08,z:-7});
 assert.equal(selected[0].radius,5);assert.equal(selected[0].remaining,4.5);assert.equal(JSON.stringify(field),encoded);
 assert.equal(selectEnvironmentSkillAreas([{...field,skillId:'warrior_war_cry'}],{x:0,z:0}).length,0);
 assert.equal(selectEnvironmentSkillAreas([{...field,remaining:0}],{x:0,z:0}).length,0);
});
check('Bounded selection uses nearest area edge and retains large overlapping field',()=>{
 const input=[area('edge',12,14),...Array.from({length:9},(_,i)=>area(String(i),i+1,1))];
 const before=JSON.stringify(input),output=[];
 assert.equal(selectEnvironmentSkillAreas(input,{x:0,z:0},output),output);assert.equal(output.length,4);assert.equal(output[0].id,'edge');assert.equal(JSON.stringify(input),before);
});
check('No retained focus after empty update/reset',()=>{
 const output=selectEnvironmentSkillAreas([area('live')],{x:0,z:0});selectEnvironmentSkillAreas([],{x:0,z:0},output);assert.equal(output.length,0);
});
// Compares against the pre-change hash manifest recorded in the untracked output/ tree.
requireStagingArtefacts(['output/qa/environment-skills-v2/before/hashes.json']);
const prior=JSON.parse(fs.readFileSync('output/qa/environment-skills-v2/before/hashes.json'));
check('Layout and all good exports are unchanged',()=>{for(const [p,h]of Object.entries(prior))if(p.includes('environment-layout')||p.startsWith('assets/'))assert.equal(hash(p),h,p)});
const report={passed:true,checks,routes,integratedMovements,directions,full14mDirections:directions.filter(d=>!d.collider).length,sourceHashes,sourceChangedDuringRun:files.some(p=>sourceHashes[p]!==hash(p)),scope:'CPU real-map corridors, authoritative dash/charge movement callbacks against this layout, and presentation selection. Not browser input, damage/status, network or crowd pathfinding proof.'};
assert.equal(report.sourceChangedDuringRun,false);
const out=path.resolve('output/qa/environment-skills-v2');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cpu.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:checks.length,full14mDirections:report.full14mDirections,testedDirections:directions.length}));
