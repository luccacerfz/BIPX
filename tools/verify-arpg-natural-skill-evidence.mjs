import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {CLASS_SKILLS,beginSkill,createSkillState,skillSnapshot,advanceSkills} from '../src/combat/class-skills.mjs';
import {verifyNaturalSkillInput} from './arpg-natural-skill-evidence.mjs';
const paths=['src/combat/class-skills.mjs','tools/arpg-natural-skill-evidence.mjs','tools/verify-natural-runs.mjs','tools/verify-arpg-natural-skill-evidence.mjs'];
const hash=()=>Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceHashes=hash(),checks=[];
function check(name,fn){fn();checks.push({name,passed:true})}
function accepted(def){const state=createSkillState(def.classId),events=[],before={at:1000,simulationTime:1,skills:skillSnapshot(state),events:[]};const result=beginSkill(state,{slot:def.slot,aimX:1,aimZ:0},{runId:'proof',playing:true,x:0,z:0});assert.ok(result.ok);events.push(result.event);advanceSkills(state,.016,{emit:e=>events.push(e)});return {before,after:{at:1016,simulationTime:1.02,skills:skillSnapshot(state),events}}}
for(const def of CLASS_SKILLS)check(`${def.id}: production receipt/cost/cooldown/timing accepted`,()=>{const p=accepted(def);assert.equal(verifyNaturalSkillInput(def.id,p.before,p.after).confirmed,true)});
const def=CLASS_SKILLS[0];
check('Simulation tick spanning first snapshot does not create false resource failure',()=>{const p=accepted(def);p.after.at=1001;assert.equal(verifyNaturalSkillInput(def.id,p.before,p.after).confirmed,true)});
for(const [name,mutate] of [
 ['request alone is not a cast',p=>{p.after=structuredClone(p.before);p.after.at=1016}],
])check(name,()=>{const p=accepted(def);mutate(p);assert.equal(verifyNaturalSkillInput(def.id,p.before,p.after).confirmed,false)});
for(const [name,mutate] of [
 ['missing receipt rejected',p=>p.after.events=[]],
 ['free cast rejected',p=>p.after.skills.resource=p.before.skills.resource],
 ['double cost rejected',p=>p.after.skills.resource-=def.cost],
 ['missing cooldown rejected',p=>p.after.skills.cooldowns[def.slot]=0],
 ['duplicate accepted input rejected',p=>p.after.skills.sequence++],
 ['wrong skill receipt rejected',p=>p.after.events[0].skillId='dwarf_explosive_cannon'],
 ['wrong authoritative release rejected',p=>p.after.events[0].impactAt=.9],
 ['wrong authoritative duration rejected',p=>p.after.events[0].duration=2],
])check(name,()=>{const p=accepted(def);mutate(p);assert.throws(()=>verifyNaturalSkillInput(def.id,p.before,p.after))});
assert.deepEqual(hash(),sourceHashes);
const report={createdAt:new Date().toISOString(),passed:true,scope:'CPU using production beginSkill/advanceSkills and mutations of observed evidence. Validates the stronger harness, not a new natural/browser run.',checks,sourceHashes,sourceStable:true};
fs.mkdirSync('output/qa/arpg-contract-reconciliation-20260919',{recursive:true});
fs.writeFileSync('output/qa/arpg-contract-reconciliation-20260919/natural-evidence-cpu.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,sourceStable:true}));
