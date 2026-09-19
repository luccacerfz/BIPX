import fs from 'node:fs';
import {makeEncounterPath,makeWithdrawalPath} from './brute-motion-review-v7-path.mjs';
export const clips=JSON.parse(fs.readFileSync('output/brute-motion-v7/candidate-04/clips.json')).results;
const original=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/fit.json')).results;
export function makePlan(c,baseRig,{back=0,upperBack=0,chestForward=0,clavicleYaw=0}={}){
 const old=original.find(f=>f.id===c.id),base=t=>baseRig.pose(Math.max(0,Math.min(1.45,t)),old).rightRequested.slice();
 const incoming=makeEncounterPath(base,c.endpoint,c.surfaceNormal,c.approachLift||0),rightPath=c.mode==='encounter'?incoming:makeWithdrawalPath(incoming,base,c.cancelAt);
 const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*u*(10-15*u+6*u*u);};
 const bodyCorrection=t=>{const f=smooth(c.mode==='encounter'?.40:.55,c.mode==='encounter'?.62:.70,t)*(1-smooth(.95,1.30,t));return {back:back*f,upperBack:upperBack*f,chestForward:chestForward*f,clavicleYaw:clavicleYaw*f};};
 return {...old,rightPath,bodyCorrection};
}
