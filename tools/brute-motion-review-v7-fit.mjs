import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRig} from './brute-motion-review-v7-rig.mjs';
import {v} from './brute-motion-review-v6-utils.mjs';
import {triangles,tree,nearest,crossings} from './brute-motion-review-v6-geometry.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
import {makeEncounterPath} from './brute-motion-review-v7-path.mjs';
const out=`output/brute-motion-v7/${process.argv[2]||'candidate-02'}`;fs.mkdirSync(out,{recursive:true});
assert(!fs.existsSync(`${out}/fit.json`),'Versioned output already exists');
const rig=await createRig(),baseRig=await createRig(),old=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/fit.json'));
const results=[];
for(const id of ['warrior','dwarf']){
 const target=await createTargets(id),original=old.results.find(r=>r.id===id);
 const base=t=>baseRig.pose(Math.max(0,Math.min(1.45,t)),original).rightRequested.slice();
 for(const c of [...[1.82,1.855,1.89].map(distance=>({distance,clip:'Idle',phase:0})),{distance:1.89,clip:'Idle',phase:.25}]){
  const targets=target.sample(c),[x,,forward]=original.wrist;
  const name=`${id}-${c.distance.toFixed(3)}-${c.phase?'idle25':'idle0'}`;
  function query(y){
   const endpoint=[x,y,forward],info=rig.pose(.70,{...original,rightPath:()=>endpoint});
   const mesh={points:rig.points().map(p=>v().fromArray(p)),indices:rig.indices},hand=tree(triangles(mesh,rig.regions.hand));
   return {endpoint,reach:info.reaches.RArm,all:targets.map(o=>({mesh:o.name,...nearest(hand,o.tree)})).sort((a,b)=>a.gap-b.gap)};
  }
  let last=query(2.95),bracket;for(let y=2.925;y>=1.9;y-=.025){const s=query(y);if(s.all[0].gap<.002){bracket=[y,last.endpoint[1]];break;}last=s;}
  assert(bracket,`${name}: no real first surface`);
  for(let i=0;i<16;i++){const mid=(bracket[0]+bracket[1])/2;if(query(mid).all[0].gap<.002)bracket[0]=mid;else bracket[1]=mid;}
  const result=query(bracket[1]),normal=result.all[0].brutePoint.map((x,i)=>(x-result.all[0].targetPoint[i])*(i===2?-1:1));
  const path=makeEncounterPath(base,result.endpoint,normal,id==='warrior'&&c.phase===.25?.04:0),frames=[];
  for(let i=30;i<=63;i++){
   const t=i/60,info=rig.pose(t,{...original,rightPath:path}),mesh={points:rig.points().map(p=>v().fromArray(p)),indices:rig.indices};
   const regions={};for(const k of ['hand','forearm']){const T=tree(triangles(mesh,rig.regions[k]));regions[k]=targets.map(o=>({mesh:o.name,...nearest(T,o.tree),pairs:crossings(T,o.tree).length}));}
   frames.push({t,reach:info.reaches.RArm,regions});
  }
  const row={name,id,...c,endpoint:result.endpoint,first:result.all[0],reach:result.reach,frames};results.push(row);
  console.log(JSON.stringify({name,endpoint:result.endpoint,first:result.all[0].mesh,gap:result.all[0].gap,maxPairs:Math.max(...frames.flatMap(f=>Object.values(f.regions).flat().map(c=>c.pairs))),reach:Math.max(...frames.map(f=>f.reach))}));
 }
}
fs.writeFileSync(`${out}/fit.json`,JSON.stringify({scope:'CPU authored first-surface fit, fixed real targets; 2mm visual clearance, not damage or selected marker',results},null,2)+'\n');
