import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,loadCPU,appendClip,hash} from './brute-motion-review-v6-utils.mjs';
import {createRig} from './brute-motion-review-v8-rig.mjs';
import {clips,makePlan} from './brute-motion-review-v8-plan.mjs';
const out=`output/brute-motion-v8/${process.argv[2]||'candidate-03'}`;fs.mkdirSync(out,{recursive:true});
const rig=await createRig(),baseRig=await createRig(),results=[];
const selections=[{name:'warrior-withdraw-surface',back:0,upperBack:12,clavicleYaw:-12,chestForward:0},{name:'dwarf-1.820-idle0',back:12,chestForward:12},{name:'dwarf-1.855-idle0',back:12,chestForward:16}];
for(const s of selections){
 const c=clips.find(c=>c.name===s.name),g=await loadCPU(c.file),reference=g.animations[3],plan=makePlan(c,baseRig,s),tracks=reference.tracks.map(t=>t.clone());
 const modified=[...(s.back?['Waist']:[]),...((s.chestForward||s.upperBack)?['Spine01']:[]),...(s.clavicleYaw?['R_Clavicle']:[]),'R_Upperarm','R_Forearm','R_Hand'].map(n=>`${n}.quaternion`);
 let reach=0;const authored=[];
 for(let i=0;i<tracks[0].times.length;i++){
  const t=tracks[0].times[i],info=rig.pose(t,plan);reach=Math.max(reach,info.reach);
  if(Object.values(plan.bodyCorrection(t)).every(v=>v===0))continue;
  for(const tr of tracks.filter(t=>modified.includes(t.name)))rig.model.getObjectByName(tr.name.split('.')[0]).quaternion.toArray(tr.values,4*i);
 }
 assert(reach<1e-6,`Unreachable authoring: ${s.name} ${reach}`);
 for(const t of tracks.filter(t=>!modified.includes(t.name))){const ref=reference.tracks.find(r=>r.name===t.name);assert.deepEqual(t.times,ref.times);assert.deepEqual(t.values,ref.values);}
 const meta={stagingOnly:true,id:`brute-v8-${s.name}`,duration:1.45,contactAt:null,correction:s,source:c.file,method:'Torso/clavicle correction; right wrist target retained; left arm follows torso with original local tracks; feet/root/pelvis tracks exact',neverAppliesDamage:true};
 const bytes=appendClip(fs.readFileSync(c.file),new THREE.AnimationClip('Attack',1.45,tracks),meta),file=`${out}/${s.name}.glb`;assert(!fs.existsSync(file));fs.writeFileSync(file,bytes);
 const result={...c,sourceV7:c.file,sourceV7SHA:c.sha256,file,sha256:hash(bytes),correction:s,modifiedTracks:modified,preservedTrackCount:tracks.length-modified.length,maxUnreachable:reach,meta};results.push(result);console.log(JSON.stringify({name:c.name,sha256:result.sha256,preserved:result.preservedTrackCount,reach}));
}
fs.writeFileSync(`${out}/clips.json`,JSON.stringify({scope:'CPU body authoring candidates; no selected marker or native approval',results},null,2)+'\n');
