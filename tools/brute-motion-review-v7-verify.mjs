// CPU actual exported GLBs + runtime ground probes. No GPU, damage or network.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,loadCPU,unpack,hash,v} from './brute-motion-review-v6-utils.mjs';
import {makePair} from './brute-motion-review-v6-native-scene.mjs';
import {triangles,tree,nearest,crossings} from './brute-motion-review-v6-geometry.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
import {ARM_TRACKS} from './brute-motion-review-v7-path.mjs';
const out=`output/brute-motion-v7/${process.argv[2]||'candidate-04'}`,cases=JSON.parse(fs.readFileSync(`${out}/clips.json`)).results;
const old=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/poses.json'));
const regions=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/warrior-cpu.json')).regions;
const probes=JSON.parse(fs.readFileSync('output/brute-motion-v6/source/assets__models__monsters__ground-probes.json')).brute.vertexIndices;
const restPoints=old.variants.warrior.poses[0].positions.map(p=>v().fromArray(p));
const results=[];
const times=[...new Set([...Array.from({length:175},(_,i)=>i/120),.18,.4,.55,.58,.60,.65,.70,.745,.82,1.05,1.30,1.45])].sort((a,b)=>a-b);
const poseTimes=[0,.40,.55,.60,.65,.70,.82,1.05,1.45];
for(const c of cases){
 const target=await createTargets(c.id),bytes=fs.readFileSync(c.file),src=fs.readFileSync(c.source),packed=unpack(bytes),original=unpack(src);
 assert.equal(hash(bytes),c.sha256);assert(packed.bin.subarray(0,original.bin.length).equals(original.bin));
 for(const k of ['nodes','skins','meshes','materials','images','textures','samplers'])assert.deepEqual(packed.json[k],original.json[k]);
 for(const i of [0,1,2,4])assert.deepEqual(packed.json.animations[i],original.json.animations[i]);
 const g=await loadCPU(c.file),reference=await loadCPU(c.source);
 for(const t of g.animations[3].tracks)if(!ARM_TRACKS.includes(t.name)){const r=reference.animations[3].tracks.find(r=>r.name===t.name);assert.deepEqual(t.times,r.times);assert.deepEqual(t.values,r.values);}
 const make=async b=>makePair({brute:b,hero:await loadCPU(target.profile.nativeTargetCopy),id:c.id,probes,profile:target.profile});
 const pair=await make(g),basePair=await make(reference);let maxFeet=0,maxFixedJoints=0;const frames=[],poses=[];
 let endpointAnatomy;
 for(let i=0;i<times.length;i++){
  const t=times[i];pair.seek(t);basePair.seek(t);
  const pp=pair.positions(pair.body),bp=basePair.positions(basePair.body),points=pp.map(p=>v().fromArray(p)),mesh={points,indices:old.indices};
  for(const j of [...regions.leftFoot,...regions.rightFoot])maxFeet=Math.max(maxFeet,points[j].distanceTo(v().fromArray(bp[j])));
  for(const n of ['Hip','Head','L_Foot','R_Foot'])maxFixedJoints=Math.max(maxFixedJoints,v().fromArray(pair.snapshot().joints[n]).distanceTo(v().fromArray(basePair.snapshot().joints[n])));
  let condition={distance:c.distance,clip:c.clip,phase:c.phase};
  if(c.mode==='withdraw-away'&&t>c.cancelAt)condition={...condition,distance:c.distance+6.5*(t-c.cancelAt)};
  if(c.mode==='withdraw-surface'&&t>c.cancelAt)condition={...condition,clip:'Run',phase:.25,blend:Math.min(1,(t-c.cancelAt)/.15)};
  const targets=target.sample(condition),contact={};
  for(const k of ['hand','forearm','caps']){
   const T=tree(triangles(mesh,regions[k]));contact[k]=targets.map(o=>({mesh:o.name,...nearest(T,o.tree),pairs:crossings(T,o.tree).length})).sort((a,b)=>a.gap-b.gap);
  }
  const r={t,condition,contact,wrist:pair.snapshot().joints.R_Hand};
  if(i%2===0||Math.abs(t-.7)<1e-8){
   const trees=Object.fromEntries(['hand','forearm','torso','chest','caps','head'].map(k=>[k,tree(triangles(mesh,regions[k]))]));
   r.self=Object.fromEntries([['handTorso','hand','torso'],['forearmChest','forearm','chest'],['capChest','caps','chest'],['capHead','caps','head']].map(([k,a,b])=>[k,crossings(trees[a],trees[b],restPoints).length]));
   const torso=trees.torso;r.torsoTarget=targets.map(o=>({mesh:o.name,...nearest(torso,o.tree),pairs:crossings(torso,o.tree).length}));
  }
  if(Math.abs(t-.7)<1e-8)endpointAnatomy=target.anatomy(contact.hand[0].mesh,contact.hand[0].targetTriangle);
  frames.push(r);
  if(poseTimes.some(p=>Math.abs(p-t)<1e-8))poses.push({time:t,positions:pp,targets:targets.map(m=>({name:m.name,indices:m.indices,positions:m.points.map(p=>p.toArray())})),condition,joints:pair.snapshot().joints});
 }
 const summary={name:c.name,mode:c.mode,id:c.id,sha256:c.sha256,all42Tracks:42,unchanged39Tracks:true,originalBinaryPrefix:original.bin.length,rigMeshSkinMaterialsTexturesOther4Clips:true,duration:g.animations[3].duration,maxFeetVertexDelta:maxFeet,maxFixedJointsDelta:maxFixedJoints,
  minimumGap:Object.fromEntries(['hand','forearm','caps'].map(k=>[k,Math.min(...frames.flatMap(r=>r.contact[k].map(c=>c.gap)))])),maxCrossingPairs:Object.fromEntries(['hand','forearm','caps'].map(k=>[k,Math.max(...frames.flatMap(r=>r.contact[k].map(c=>c.pairs)))])),
  selfMax:Object.fromEntries(['handTorso','forearmChest','capChest','capHead'].map(k=>[k,Math.max(...frames.filter(r=>r.self).map(r=>r.self[k]))])),torsoTargetMinGap:Math.min(...frames.flatMap(r=>(r.torsoTarget||[]).map(c=>c.gap))),torsoTargetMaxCrossingPairs:Math.max(...frames.flatMap(r=>(r.torsoTarget||[]).map(c=>c.pairs))),
  endpoint:frames.find(r=>Math.abs(r.t-.7)<1e-8).contact.hand[0],endpointAnatomy,frameCount:frames.length};
 assert(maxFeet<1e-10);assert(maxFixedJoints<1e-10);
 fs.writeFileSync(`${out}/${c.name}-cpu.json`,JSON.stringify({summary,frames},null,2)+'\n');
 fs.writeFileSync(`${out}/${c.name}-poses.json`,JSON.stringify({scope:'CPU real posed mesh projection inputs, not native playback',indices:old.indices,regions,poses,name:c.name,id:c.id}));
 results.push(summary);console.log(JSON.stringify(summary));pair.dispose();basePair.dispose();
}
fs.writeFileSync(`${out}/verification.json`,JSON.stringify({scope:'CPU roundtrip, samples at120Hz plus exact story poses, self at~60Hz; not swept watertight contact or runtime authority',results},null,2)+'\n');
