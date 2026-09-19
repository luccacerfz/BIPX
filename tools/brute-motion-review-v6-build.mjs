// Export only Attack into two staging GLBs, plus dense CPU deformation/contact evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRig,DURATION} from './brute-motion-review-v6-rig.mjs';
import {THREE,hash,appendClip,unpack,v} from './brute-motion-review-v6-utils.mjs';
import {triangles,tree,nearest,crossings} from './brute-motion-review-v6-geometry.mjs';
const base='output/brute-motion-v6',revision=process.argv[2]||'candidate-02',out=`${base}/${revision}`;
const rig=await createRig(),fit=JSON.parse(fs.readFileSync(`${out}/fit.json`)),poses=JSON.parse(fs.readFileSync(`${out}/poses.json`));
const original=fs.readFileSync(rig.source),reference=rig.record(0,{wrist:fit.results[0].wrist}),restPoints=reference.positions.map(p=>v().fromArray(p));
const chest=rig.regions.torso.filter(i=>Math.abs(restPoints[i].x)<.28&&restPoints[i].y>1.9&&restPoints[i].y<2.72);
const caps=rig.regions.shoulder.filter(i=>restPoints[i].x>.36&&restPoints[i].y>2.55);
const head=restPoints.map((p,i)=>{
 let w=0;for(let j=0;j<4;j++){const n=rig.bones[rig.body.geometry.attributes.skinIndex.getComponent(i,j)].name;if(/^(Head|Neck)/.test(n))w+=rig.body.geometry.attributes.skinWeight.getComponent(i,j);}
 return w>.45?i:-1;
}).filter(i=>i>=0);
const sole=Object.fromEntries(['leftFoot','rightFoot'].map(k=>{const min=Math.min(...rig.regions[k].map(i=>restPoints[i].y));return [k,rig.regions[k].filter(i=>restPoints[i].y<min+.025)];}));
const regions={...rig.regions,chest,caps,head,sole};
const summaries=[];
for(const variant of fit.results){
 const targets=poses.heroes[variant.id].map(m=>({name:m.name,tree:tree(triangles({...m,points:m.positions.map(p=>v().set(p[0],p[1],p[2]-variant.distance))}))}));
 const frames=[],count=Math.round(DURATION*240)+1,times=new Float32Array(count),rots=new Map(rig.bones.map(b=>[b.name,new Float32Array(count*4)])),hip=new Float32Array(count*3);let maxBonePositionDelta=0;
 for(let i=0;i<count;i++){
  const t=i/240,r=rig.record(t,variant),pts=r.positions.map(p=>v().fromArray(p)),mesh={points:pts,indices:rig.indices};times[i]=t;
  for(const b of rig.bones){b.quaternion.toArray(rots.get(b.name),i*4);if(b.name!=='Hip')maxBonePositionDelta=Math.max(maxBonePositionDelta,b.position.distanceTo(rig.idle.get(b.name).position));}rig.model.getObjectByName('Hip').position.toArray(hip,i*3);
  const hand=tree(triangles(mesh,regions.hand)),contacts=targets.map(o=>({mesh:o.name,...nearest(hand,o.tree)})).sort((a,b)=>a.gap-b.gap);
  const otherContacts={};for(const key of ['forearm','torso']){const T=tree(triangles(mesh,regions[key]));otherContacts[key]=targets.map(o=>({mesh:o.name,...nearest(T,o.tree)}));}
  const feet=Object.fromEntries(['leftFoot','rightFoot'].map(k=>{const pp=regions[k].map(j=>pts[j]),bottom=Math.min(...pp.map(p=>p.y));const support=pp.filter(p=>p.y<.012),solePoints=sole[k].map(j=>pts[j].toArray());return [k,{minY:bottom,maxY:Math.max(...pp.map(p=>p.y)),supportVertexCount:support.length,supportPoints:support.map(p=>[p.x,p.z]),solePoints}];}));
  // Mass-weighted anatomical landmarks are explicitly a visual COM proxy, not physics.
  const com=v();let mass=0;for(const[n,w]of [['Hip',.30],['Spine01',.30],['Head',.10],['L_Forearm',.06],['R_Forearm',.06],['L_Thigh',.06],['R_Thigh',.06],['L_Calf',.03],['R_Calf',.03]]){com.addScaledVector(v().fromArray(r.joints[n]),w);mass+=w;}com.divideScalar(mass);
  const row={time:t,reach:r.info.reach,knees:r.knees,height:r.height,torsoLean:r.torsoLean,hip:r.joints.Hip,shoulder:r.joints.R_Upperarm,wrist:r.joints.R_Hand,feet,comProxy:com.toArray(),first:contacts[0],allContacts:contacts,otherContacts};
  if(i%4===0||Math.abs(t-.70)<1e-8){
   const torso=tree(triangles(mesh,regions.torso)),forearm=tree(triangles(mesh,regions.forearm)),cap=tree(triangles(mesh,caps)),ch=tree(triangles(mesh,chest)),hd=tree(triangles(mesh,head));
   const leftHand=tree(triangles(mesh,regions.leftHand));
   row.self={handTorso:nearest(hand,torso),leftHandTorso:nearest(leftHand,torso),forearmChest:nearest(forearm,ch),capChest:nearest(cap,ch),capHead:nearest(cap,hd),handTorsoCrossings:crossings(hand,torso,restPoints),leftHandTorsoCrossings:crossings(leftHand,torso,restPoints),forearmChestCrossings:crossings(forearm,ch,restPoints),capChestCrossings:crossings(cap,ch,restPoints),capHeadCrossings:crossings(cap,hd,restPoints)};
  }
  frames.push(row);
 }
 const tracks=[...rots].map(([n,a])=>new THREE.QuaternionKeyframeTrack(`${n}.quaternion`,times,a));tracks.push(new THREE.VectorKeyframeTrack('Hip.position',times,hip));
 const meta={id:`brute-v6-${revision}-${variant.id}`,method:'Authored Idle-relative pose/weight-shift/step; two-bone support; whole-hand first-surface endpoint',duration:DURATION,contactAt:null,storyboardIntent:.70,staticEncounterTarget:variant.id,targetCenter:variant.center,stagingOnly:true};
 const clip=new THREE.AnimationClip('Attack',DURATION,tracks),bytes=appendClip(original,clip,meta);
 assert(maxBonePositionDelta<1e-10);assert(tracks.every(t=>[...t.times,...t.values].every(Number.isFinite)));
 const path=`${out}/brute-${variant.id}.glb`;assert(!fs.existsSync(path),'Version staging artifacts, do not overwrite');fs.writeFileSync(path,bytes);
 const endpoint=rig.record(DURATION,variant),identityDelta=Math.max(...endpoint.positions.map((p,i)=>v().fromArray(p).distanceTo(restPoints[i])));
 const summary={id:variant.id,sha256:hash(bytes),meta,identityDelta,maxBonePositionDelta,maxUnreachableMeters:Math.max(...frames.map(f=>f.reach)),minimumHandGap:Math.min(...frames.map(f=>f.first.gap)),nearFrames:frames.filter(f=>f.first.gap<.003).map(f=>({time:f.time,mesh:f.first.mesh,gap:f.first.gap})),selfMax:Object.fromEntries(['handTorsoCrossings','forearmChestCrossings','capChestCrossings','capHeadCrossings'].map(k=>[k,Math.max(...frames.filter(f=>f.self).map(f=>f.self[k].length))])),heightRange:[Math.min(...frames.map(f=>f.height)),Math.max(...frames.map(f=>f.height))],kneeRanges:[0,1].map(i=>[Math.min(...frames.map(f=>f.knees[i])),Math.max(...frames.map(f=>f.knees[i]))])};
 fs.writeFileSync(`${out}/${variant.id}-cpu.json`,JSON.stringify({summary,regions,frames},null,2)+'\n');summaries.push(summary);console.log(JSON.stringify(summary));
}
fs.writeFileSync(`${out}/summary.json`,JSON.stringify({scope:'CPU only; no native playback, physics or authority proof',summaries},null,2)+'\n');
