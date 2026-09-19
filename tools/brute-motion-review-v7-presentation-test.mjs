import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRig} from './brute-motion-review-v7-rig.mjs';
import {createArmPresentation} from './brute-motion-review-v7-presentation.mjs';
const rig=await createRig(),clips=JSON.parse(fs.readFileSync('output/brute-motion-v7/candidate-04/clips.json')).results;
const old=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/fit.json')).results;
const checks=[];
for(const id of ['warrior','dwarf']){
 const f=clips.find(c=>c.id===id&&c.distance===1.855&&c.phase===0&&c.mode==='encounter');
 const base=t=>rig.pose(t,old.find(c=>c.id===id)).rightRequested.slice();
 const plan={...f,surfaceKey:f.first.mesh,poseKey:'Idle0'};
 const state={present:true,targetKey:id,distance:1.855,surfaceKey:plan.surfaceKey,poseKey:'Idle0'};
 const create=()=>createArmPresentation({base,plan,targetKey:id});
 for(const [name,change]of [['leaves',{distance:1.99833}],['moves-near',{distance:1.82001}],['surface-changes',{surfaceKey:id==='warrior'?'HeroBody':'DwarfRifle'}],['pose-changes',{poseKey:'Run25'}],['removed',{present:false}],['other-actor',{targetKey:'other'}]]){
  const a=create(),b=create();a.observe(.55,state);const before=a.sample(.55);const after=a.observe(.55,{...state,...change});assert.equal(after.mode,'withdrawal');assert.deepEqual(before.rightWrist,after.rightWrist);
  const h=1e-5,left=a.sample(.55-h).rightWrist,right=a.sample(.55+h).rightWrist;
  const vin=b.sample(.55).rightWrist.map((x,i)=>(x-b.sample(.55-h).rightWrist[i])/h),vout=right.map((x,i)=>(x-after.rightWrist[i])/h);
  const jump=Math.hypot(...right.map((x,i)=>x-left[i])),dv=Math.hypot(...vout.map((x,i)=>x-vin[i]));assert(jump<.0003);assert(dv<.02);
  assert.equal(a.sample(.7).appliesDamage,false);assert.equal(a.sample(.7).contactAt,null);assert.deepEqual(a.sample(1.45).rightWrist,base(1.45));checks.push({id,name,passed:true,joinPositionWindow:jump,finiteVelocityDifference:dv});
 }
 const a=create();a.observe(.6,state);assert.equal(a.observe(.65,{...state,paused:true}).age,.6);checks.push({id,name:'pause-freezes-visual-age',passed:true});
 const late=create();assert.equal(late.observe(.72,{...state,surfaceKey:'different'}).mode,'late-change-unresolved');checks.push({id,name:'late-change-explicitly-unresolved-no-snap',passed:true});
 assert.throws(()=>a.observe(.5,state),/Monotonic/);checks.push({id,name:'old-age-rejected',passed:true});
 assert.throws(()=>a.replacePreparedPlan(plan),/Replan only/);checks.push({id,name:'no-mid-descent-replan',passed:true});
 const pre=create(),prePose=pre.sample(.4).rightWrist;pre.replacePreparedPlan({...plan,endpoint:plan.endpoint.map((x,i)=>x+(i===1?.03:0))});assert.deepEqual(pre.sample(.4).rightWrist,prePose);checks.push({id,name:'early-replan-common-preparation-preserved',passed:true});
 assert.equal(state.distance,1.855);assert.equal(plan.endpoint[1],f.endpoint[1]);checks.push({id,name:'input-actor-and-plan-not-mutated',passed:true});
}
fs.writeFileSync('output/brute-motion-v7/presentation-checks.json',JSON.stringify({scope:'CPU actual authored curve branches, no runtime/FSM/authority',checks},null,2)+'\n');console.log(`${checks.length} checks passed`);
