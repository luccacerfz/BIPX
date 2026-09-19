// CPU staging presentation API: outputs a wrist curve, never a hit or actor motion.
import {makeEncounterPath,makeWithdrawalPath} from './brute-motion-review-v7-path.mjs';
export function createArmPresentation({base,plan,targetKey}){
 let selected=structuredClone(plan),incoming=curve(selected),active=incoming,lastAge=0,mode='encounter',reason=null,cancelAt=null;
 function curve(p){return makeEncounterPath(base,p.endpoint,p.surfaceNormal,p.approachLift||0);}
 function withdraw(age,why){
  if(mode!=='encounter')return;
  reason=why;
  if(age>.70){mode='late-change-unresolved';return;}
  cancelAt=Math.max(.50,age);active=makeWithdrawalPath(incoming,base,cancelAt);mode='withdrawal';
 }
 function observe(age,state){
  if(!Number.isFinite(age)||age<lastAge)throw Error('Monotonic clip age required');
  if(state.paused)return sample(lastAge);
  lastAge=Math.min(1.45,age);
  if(mode==='encounter'){
   if(!state.present||state.targetKey!==targetKey)withdraw(lastAge,'target-lost-or-replaced');
   else if(!(state.distance>=1.82&&state.distance<=1.89))withdraw(lastAge,'outside-authored-near-range');
   else if(state.surfaceKey!==selected.surfaceKey)withdraw(lastAge,'first-surface-changed');
   else if(state.poseKey!==selected.poseKey)withdraw(lastAge,'guard-pose-changed');
   else if(Math.abs(state.distance-selected.distance)>.0005)withdraw(lastAge,'prepared-distance-changed');
  }
  return sample(lastAge);
 }
 function replacePreparedPlan(p){
  if(lastAge>=.50||mode!=='encounter')throw Error('Replan only before the common .50s arm departure');
  selected=structuredClone(p);incoming=curve(selected);active=incoming;
 }
 function sample(age=lastAge){return {age,mode,reason,cancelAt,rightWrist:active(Math.max(0,Math.min(1.45,age))),contactAt:null,appliesDamage:false};}
 return {observe,sample,replacePreparedPlan};
}
