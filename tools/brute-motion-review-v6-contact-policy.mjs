import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createCollisionWorld,stepActor} from '../src/physics/contacts.mjs';
import {assessBruteContactEvidence} from '../output/brute-motion-v6/contact-followup-v1/contact-policy-proposal.mjs';
const out='output/brute-motion-v6/contact-followup-v1',world=createCollisionWorld();
const source={worldId:'fixture',id:'monster:one',x:0,z:0,radius:1.18,alive:true};
const target={worldId:'fixture',id:'player:one',x:0,z:-1.89,radius:.64,alive:true};
const prepared={worldId:'fixture',sourceId:source.id,targetId:target.id,guardMesh:'HeroShield',directionX:0,directionZ:-1};
const base={source,target,prepared,clearLOS:true,legalReach:1.90,minimumFacingDot:.35,now:0,poseSampleTime:0,relativeSpeedBound:0,
 fit:{mesh:'HeroShield',gap:.0005,crossingPairs:0}};
const checks=[];
function check(name,input,decision){const before=JSON.stringify(input),actual=assessBruteContactEvidence(input);
 assert.equal(actual.decision,decision,name);assert.equal(JSON.stringify(input),before,'Input mutation');
 assert.equal(actual.appliesDamage,false);assert.equal(actual.movesActor,false);assert.equal(actual.extendsRange,false);assert.equal(actual.selectsMarker,false);
 checks.push({name,actual});}
check('reference is not hit approval',base,'reference-only');
check('1.82m real negative remains authoring requirement',{...base,target:{...target,z:-1.82},fit:{...base.fit,gap:0,crossingPairs:54}},'authoring-required');
check('moving guard in old sample cannot certify contact',{...base,now:.1,relativeSpeedBound:6.5},'unresolved');
check('current outside range never extends reach',{...base,target:{...target,z:-1.90001}},'miss');
check('target behind locked preparation',{...base,target:{...target,z:1.89}},'miss');
check('15degree turn gap is a geometric miss',{...base,fit:{...base.fit,gap:.08594128}},'geometric-miss');
check('guard changes to rifle',{...base,fit:{...base.fit,mesh:'DwarfRifle'}},'authoring-required');
check('pause',{...base,paused:true},'hold');
check('freeze',{...base,source:{...source,frozen:true}},'cancel');
check('target removed',{...base,target:{...target,removed:true}},'cancel');
check('other player cannot inherit strike',{...base,target:{...target,id:'player:two'}},'cancel');
check('old world snapshot',{...base,target:{...target,worldId:'old'}},'cancel');
check('occluded release',{...base,clearLOS:false},'blocked');
check('future pose timestamp',{...base,poseSampleTime:1},'unresolved');
check('missing geometry',{...base,fit:undefined},'unresolved');
const trajectories=[];
for(const [name,velocity]of [['toward',{x:0,z:6.5}],['away',{x:0,z:-6.5}],['strafe',{x:6.5,z:0}]]){
 let body={...target};const frames=[];
 for(let i=1;i<=6;i++){
  const moved=stepActor(world,body,velocity,1/60,{bodies:[source,body]});
  body={...body,x:moved.x,z:moved.z};const distance=Math.hypot(body.x,body.z);
  assert(distance>=1.82-1e-8,'Body non-overlap maintained');
  frames.push({age:i/60,x:body.x,z:body.z,distance,legal:distance<=1.90});
 }
 trajectories.push({name,velocity,frames});
}
assert(trajectories[0].frames.at(-1).distance<1.821);
assert(trajectories[1].frames.at(-1).legal===false);
assert(trajectories[2].frames.at(-1).legal===false);
const result={scope:'Pure review policy + real contacts stepActor in empty fixture. No runtime authority patch, marker or resimulation claim.',
 checks,trajectories,clearanceBudget:{referenceGap:.0005,speedBound:6.5,
  timeToConsumeClearance:.0005/6.5,at60Hz:6.5/60,at10Hz:6.5/10,
  note:'Worst-direction bound only, not predicted motion; never a radius/range increase'},passed:true};
fs.writeFileSync(`${out}/policy-cpu.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,trajectories,passed:true},null,2));
