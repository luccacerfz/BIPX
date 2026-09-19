import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadBody} from './brute-motion-review-v8-body.mjs';
import {loadCPU,unpack,hash,v} from './brute-motion-review-v6-utils.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
import {tree,triangles,crossings,nearest} from './brute-motion-review-v8-geometry.mjs';
const out=`output/brute-motion-v8/${process.argv[2]||'candidate-03'}`,cases=JSON.parse(fs.readFileSync(`${out}/clips.json`)).results;
const regions=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/warrior-cpu.json')).regions;
const times=[...new Set([...Array.from({length:175},(_,i)=>i/120),.4,.55,.60,.65,.70,.745,.82,.875,1.05,1.30,1.45])].sort((a,b)=>a-b);
const selectedTimes=[0,.40,.55,.65,.70,.745,.82,.875,1.05,1.45];
const results=[];
for(const c of cases){
 const body=await loadBody(c.file),base=await loadBody(c.sourceV7),target=await createTargets(c.id),rows=[],poses=[];
 const bytes=fs.readFileSync(c.file),src=fs.readFileSync(c.sourceV7),a=unpack(bytes),b=unpack(src);assert(a.bin.subarray(0,b.bin.length).equals(b.bin));
 for(const k of ['nodes','skins','meshes','materials','textures','images','samplers'])assert.deepEqual(a.json[k],b.json[k]);for(const i of [0,1,2,4])assert.deepEqual(a.json.animations[i],b.json.animations[i]);
 for(const t of body.g.animations[3].tracks)if(!c.modifiedTracks.includes(t.name)){const r=base.g.animations[3].tracks.find(r=>r.name===t.name);assert.deepEqual(t.times,r.times);assert.deepEqual(t.values,r.values);}
 base.seek(0);const rest=base.points(),weights=body.body.geometry.attributes,rootBone=n=>body.model.getObjectByName(n).getWorldPosition(v());
 let footDelta=0,hipDelta=0,lengthDelta=0;const lengths=[];
 for(let i=0;i<times.length;i++){
  const t=times[i];body.seek(t);base.seek(t);const points=body.points(),bp=base.points(),mesh={points,indices:body.indices};
  for(const k of [...regions.leftFoot,...regions.rightFoot])footDelta=Math.max(footDelta,points[k].distanceTo(bp[k]));
  hipDelta=Math.max(hipDelta,rootBone('Hip').distanceTo(base.model.getObjectByName('Hip').getWorldPosition(v())));
  const ls=['L','R'].flatMap(s=>[rootBone(`${s}_Upperarm`).distanceTo(rootBone(`${s}_Forearm`)),rootBone(`${s}_Forearm`).distanceTo(rootBone(`${s}_Hand`))]);if(!lengths.length)lengths.push(...ls);lengthDelta=Math.max(lengthDelta,...ls.map((x,i)=>Math.abs(x-lengths[i])));
  let condition={distance:c.distance,clip:'Idle',phase:0};if(c.mode==='withdraw-surface'&&t>.55)condition={...condition,clip:'Run',phase:.25,blend:Math.min(1,(t-.55)/.15)};
  const targets=target.sample(condition),T=tree(triangles(mesh)),contacts=targets.map(m=>({mesh:m.name,...nearest(T,m.tree),pairs:crossings(T,m.tree)}));
  const r={t,condition,contacts};
  const regional=k=>tree(triangles(mesh,regions[k]));
  if(i%2===0||selectedTimes.some(s=>Math.abs(s-t)<1e-8)){
   r.self=Object.fromEntries([['handTorso','hand','torso'],['leftHandTorso','leftHand','torso'],['forearmChest','forearm','chest'],['capChest','caps','chest'],['capHead','caps','head']].map(([k,x,y])=>[k,crossings(regional(x),regional(y),rest)]));
   r.hand=targets.map(m=>({mesh:m.name,...nearest(regional('hand'),m.tree)}));
  }
  rows.push(r);
  if(selectedTimes.some(s=>Math.abs(s-t)<1e-8)){
   const baseTree=tree(triangles({points:bp,indices:base.indices})),before=crossings(baseTree,baseTree,rest),after=crossings(T,T,rest),oldSet=new Set(before.map(p=>p.slice().sort((a,b)=>a-b).join(':')));
   r.fullSelf={before:before.length,after:after.length,added:after.filter(p=>!oldSet.has(p.slice().sort((a,b)=>a-b).join(':')))};
   poses.push({time:t,positions:points.map(p=>p.toArray()),baselinePositions:bp.map(p=>p.toArray()),targets:targets.map(m=>({name:m.name,indices:m.indices,positions:m.points.map(p=>p.toArray())})),condition});
  }
 }
 const summary={name:c.name,sha256:hash(bytes),preservedTracks:c.preservedTrackCount,rigMeshSkinMaterialsOther4Clips:true,footDelta,hipDelta,lengthDelta,frameCount:rows.length,maxWholeMeshPairs:Math.max(...rows.flatMap(r=>r.contacts.map(c=>c.pairs.length))),minimumWholeMeshGap:Math.min(...rows.flatMap(r=>r.contacts.map(c=>c.gap))),selfMax:Object.fromEntries(['handTorso','leftHandTorso','forearmChest','capChest','capHead'].map(k=>[k,Math.max(...rows.filter(r=>r.self).map(r=>r.self[k].length))])),maxFullSelfAdded:Math.max(...rows.filter(r=>r.fullSelf).map(r=>r.fullSelf.added.length)),fullSelf:rows.filter(r=>r.fullSelf).map(r=>({t:r.t,...r.fullSelf}))};
 assert(footDelta<1e-10);assert(hipDelta<1e-10);assert(lengthDelta<1e-6);
 fs.writeFileSync(`${out}/${c.name}-cpu.json`,JSON.stringify({summary,frames:rows},null,2)+'\n');fs.writeFileSync(`${out}/${c.name}-poses.json`,JSON.stringify({scope:'CPU posed mesh contours, no GPU/gameplay',indices:body.indices,regions,poses,name:c.name,id:c.id}));results.push(summary);console.log(JSON.stringify({...summary,fullSelf:undefined}));
}
fs.writeFileSync(`${out}/verification.json`,JSON.stringify({scope:'Full mesh/props and regional self; full self at10 explicit poses; finite temporal samples, not continuous manifold collision',results},null,2)+'\n');
