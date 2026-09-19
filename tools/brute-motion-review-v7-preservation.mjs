// Compare actual v6/v7 deformation at the same age and supplied target pose.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadCPU,v} from './brute-motion-review-v6-utils.mjs';
import {makePair} from './brute-motion-review-v6-native-scene.mjs';
import {triangles,tree,crossings} from './brute-motion-review-v6-geometry.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
const out='output/brute-motion-v7/candidate-04',cases=JSON.parse(fs.readFileSync(`${out}/clips.json`)).results;
const old=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/poses.json'));
const regions=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/warrior-cpu.json')).regions;
const rp=old.variants.warrior.poses[0].positions.map(p=>v().fromArray(p));
const probes=JSON.parse(fs.readFileSync('output/brute-motion-v6/source/assets__models__monsters__ground-probes.json')).brute.vertexIndices;
const results=[];
for(const c of cases){
 const target=await createTargets(c.id),make=async file=>makePair({brute:await loadCPU(file),hero:await loadCPU(target.profile.nativeTargetCopy),id:c.id,probes,profile:target.profile});
 const pair=await make(c.file),baseline=await make(c.source),frames=JSON.parse(fs.readFileSync(`${out}/${c.name}-cpu.json`)).frames;
 let torsoDelta=0,pureTorsoDelta=0,newSelfPairs=0,baselineTorsoMax=0,armLengthVariation=0;const lengths=[],rows=[];
 const weights=pair.body.geometry.attributes,pureTorso=regions.torso.filter(i=>!Array.from({length:4},(_,j)=>j).some(j=>/^R_(Upperarm|Forearm|Hand)/.test(pair.body.skeleton.bones[weights.skinIndex.getComponent(i,j)].name)&&weights.skinWeight.getComponent(i,j)>0));
 for(const f of frames.filter((_,i)=>i%2===0)){
  pair.seek(f.t);baseline.seek(f.t);const p=pair.positions(pair.body).map(p=>v().fromArray(p)),b=baseline.positions(baseline.body).map(p=>v().fromArray(p));
  for(const i of regions.torso)torsoDelta=Math.max(torsoDelta,p[i].distanceTo(b[i]));
  for(const i of pureTorso)pureTorsoDelta=Math.max(pureTorsoDelta,p[i].distanceTo(b[i]));
  const T=(points,k)=>tree(triangles({points,indices:old.indices},regions[k]));
  const before=crossings(T(b,'forearm'),T(b,'chest'),rp),after=crossings(T(p,'forearm'),T(p,'chest'),rp),set=new Set(before.map(p=>p.slice().sort((a,b)=>a-b).join(':')));
  const extra=after.filter(p=>!set.has(p.slice().sort((a,b)=>a-b).join(':'))).length;newSelfPairs=Math.max(newSelfPairs,extra);
  const targets=target.sample(f.condition),torso=T(b,'torso'),counts=targets.map(m=>({mesh:m.name,pairs:crossings(torso,m.tree).length}));baselineTorsoMax=Math.max(baselineTorsoMax,...counts.map(c=>c.pairs));
  const j=pair.snapshot().joints,l=[v().fromArray(j.R_Upperarm).distanceTo(v().fromArray(j.R_Forearm)),v().fromArray(j.R_Forearm).distanceTo(v().fromArray(j.R_Hand))];if(!lengths.length)lengths.push(...l);armLengthVariation=Math.max(armLengthVariation,...l.map((x,i)=>Math.abs(x-lengths[i])));
  rows.push({t:f.t,newForearmChestPairs:extra,baselineTorso:counts});
 }
 const speeds=frames.slice(1).map((f,i)=>v().fromArray(f.wrist).distanceTo(v().fromArray(frames[i].wrist))/(f.t-frames[i].t));
 console.log(JSON.stringify({precision:c.name,pureTorsoDelta,newSelfPairs,armLengthVariation}));
 // Loaded Float32 quaternion keys introduce sub-micrometre matrix error.
 assert(pureTorsoDelta<1e-10,'Unweighted torso deformation changed');assert.equal(newSelfPairs,0,'New forearm/chest pairs');assert(armLengthVariation<1e-6,'Limb extension beyond Float32 roundtrip');
 const row={name:c.name,torsoIncludingArmBlendedVertexDelta:torsoDelta,pureTorsoVertexDelta:pureTorsoDelta,pureTorsoVertices:pureTorso.length,totalTorsoRegionVertices:regions.torso.length,newForearmChestPairs:newSelfPairs,baselineTorsoMax,armLengths:lengths,armLengthVariation,wristSpeedMax:Math.max(...speeds),samples:rows};results.push(row);
 console.log(JSON.stringify({...row,samples:undefined}));pair.dispose();baseline.dispose();
}
fs.writeFileSync(`${out}/preservation-comparison.json`,JSON.stringify({scope:'Actual exported pose comparison; torso baseline negatives and inherited self pairs retained',results},null,2)+'\n');
