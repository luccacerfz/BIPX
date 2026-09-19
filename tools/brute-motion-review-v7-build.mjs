// Offline authored arm clips. Non-arm Attack tracks are cloned byte-for-byte.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRig} from './brute-motion-review-v7-rig.mjs';
import {THREE,loadCPU,hash,appendClip,unpack} from './brute-motion-review-v6-utils.mjs';
import {makeEncounterPath,makeWithdrawalPath,ARM_TRACKS,DURATION,derivative} from './brute-motion-review-v7-path.mjs';
const out=`output/brute-motion-v7/${process.argv[2]||'candidate-04'}`;
const fits=JSON.parse(fs.readFileSync(`${out}/fit.json`)).results;
const old=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/fit.json'));
const rig=await createRig(),baseRig=await createRig();
const inputs=Object.fromEntries(await Promise.all(['warrior','dwarf'].map(async id=>[id,await loadCPU(`output/brute-motion-v6/handoff-01/brute-${id}.glb`)])));
const cases=fits.map(f=>({...f,mode:'encounter'}));
for(const id of ['warrior','dwarf']){
 const f=fits.find(f=>f.id===id&&f.distance===1.855&&f.phase===0);
 for(const mode of ['withdraw-away','withdraw-surface'])cases.push({...f,name:`${id}-${mode}`,mode,cancelAt:.55});
}
const results=[];
for(const c of cases){
 const original=old.results.find(f=>f.id===c.id),source=`output/brute-motion-v6/handoff-01/brute-${c.id}.glb`,bytes=fs.readFileSync(source);
 const base=t=>baseRig.pose(Math.max(0,Math.min(DURATION,t)),original).rightRequested.slice();
 const normal=c.first.brutePoint.map((x,i)=>(x-c.first.targetPoint[i])*(i===2?-1:1));
 const approachLift=c.id==='warrior'&&c.phase===.25?.04:0;
 const incoming=makeEncounterPath(base,c.endpoint,normal,approachLift),path=c.mode==='encounter'?incoming:makeWithdrawalPath(incoming,base,c.cancelAt);
 const reference=inputs[c.id].animations[3],tracks=reference.tracks.map(t=>t.clone());
 const arm=tracks.filter(t=>ARM_TRACKS.includes(t.name));assert.equal(arm.length,3);
 for(let i=0;i<arm[0].times.length;i++){
  rig.pose(arm[0].times[i],{...original,rightPath:path});
  for(const t of arm)rig.model.getObjectByName(t.name.split('.')[0]).quaternion.toArray(t.values,4*i);
 }
 for(const t of tracks)if(!ARM_TRACKS.includes(t.name)){
  const ref=reference.tracks.find(r=>r.name===t.name);assert.deepEqual(t.times,ref.times);assert.deepEqual(t.values,ref.values);
 }
 const meta={id:c.name,stagingOnly:true,duration:DURATION,contactAt:null,storyboardIntent:.7,method:'Whole-hand first-surface endpoint + C1 wrist encounter / withdrawal; only three arm quaternion tracks changed',target:{id:c.id,distance:c.distance,clip:c.clip,phase:c.phase},mode:c.mode,cancelAt:c.cancelAt??null,neverAppliesDamage:true};
 const output=appendClip(bytes,new THREE.AnimationClip('Attack',DURATION,tracks),meta),file=`${out}/${c.name}.glb`;
 assert(!fs.existsSync(file),'Preserve previous build');fs.writeFileSync(file,output);
 const joins=c.mode==='encounter'?[.5,.6,.7,.76,.84,1.05]:[.5,c.cancelAt,c.cancelAt+.16,1.05];
 const continuity=joins.map(t=>{const h=1e-6,l=path(t-h),p=path(t),r=path(t+h);return {t,positionStep:Math.hypot(...r.map((x,i)=>x-l[i])),velocityDifference:Math.hypot(...r.map((x,i)=>(x-p[i])/h-(p[i]-l[i])/h))};});
 results.push({...c,frames:undefined,approachLift,surfaceNormal:normal,file,sha256:hash(output),source,sourceSHA:hash(bytes),preservedTrackCount:tracks.length-arm.length,modifiedTracks:ARM_TRACKS,continuity,meta});
 console.log(JSON.stringify({name:c.name,sha256:hash(output),unchangedTracks:tracks.length-3,maxJoinVelocityDifference:Math.max(...continuity.map(c=>c.velocityDifference))}));
}
fs.writeFileSync(`${out}/clips.json`,JSON.stringify({scope:'CPU authored candidates only, no native review or integration',duration:DURATION,contactAt:null,results},null,2)+'\n');
