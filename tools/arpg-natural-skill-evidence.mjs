import assert from 'node:assert/strict';
import {getClassSkill,CLASS_RESOURCES} from '../src/combat/class-skills.mjs';

// Validate observed input receipts only; never write gameplay state.
export function verifyNaturalSkillInput(skillId,before,after) {
 const def=getClassSkill(skillId);assert.ok(def,'Unknown natural skill input');
 assert.equal(before.skills.classId,def.classId);assert.equal(after.skills.classId,def.classId);
 const wallElapsed=(after.at-before.at)/1000;
 const simulationElapsed=after.simulationTime-before.simulationTime;
 assert.ok(Number.isFinite(wallElapsed)&&wallElapsed>=0&&Number.isFinite(simulationElapsed)&&simulationElapsed>=0,'Invalid observation interval');
 // getState rounds simulation time to 0.01s: the difference can lose <0.01s.
 // Wall time is not the bound because an RAF tick can span the first snapshot.
 const elapsed=simulationElapsed+.01;
 const previousIds=new Set(before.events.filter(e=>e.phase==='cast').map(e=>e.castId));
 const receipts=after.events.filter(e=>e.phase==='cast'&&!previousIds.has(e.castId));
 if(after.skills.sequence===before.skills.sequence){
  assert.equal(receipts.length,0,'Cast receipt without authority sequence');
  return {confirmed:false,reason:'No accepted cast observed; input may have been rejected',wallElapsed,simulationElapsed};
 }
 assert.equal(after.skills.sequence,before.skills.sequence+1,'One input accepted more than one cast');
 assert.equal(receipts.length,1,'Accepted input must have exactly one new cast receipt');
 const event=receipts[0];assert.equal(event.skillId,skillId);
 assert.equal(event.duration,def.duration);assert.equal(event.impactAt,def.windup);
 const tolerance=.002; // Floating-point and sub-millisecond snapshot boundary only.
 const minimumResource=before.skills.resource-def.cost;
 const maximumResource=Math.min(100,minimumResource+CLASS_RESOURCES[def.classId].regeneration*elapsed);
 assert.ok(after.skills.resource>=minimumResource-tolerance&&after.skills.resource<=maximumResource+tolerance,'Accepted cast resource delta disagrees with cost/regeneration');
 const cooldown=after.skills.cooldowns[def.slot];
 assert.ok(cooldown>0&&cooldown<=def.cooldown+tolerance&&cooldown>=def.cooldown-elapsed-tolerance,'Accepted cast cooldown disagrees with elapsed authority time');
 return {confirmed:true,castId:event.castId,event,wallElapsed,simulationElapsed,simulationPrecision:.01,resourceBefore:before.skills.resource,resourceAfter:after.skills.resource,cooldownAfter:cooldown};
}
