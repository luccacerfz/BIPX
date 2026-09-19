// Bounded CPU contact key study, fixed players; no runtime output.
import fs from 'node:fs';import {createRig} from './brute-motion-review-v6-rig.mjs';import {v} from './brute-motion-review-v6-utils.mjs';import {triangles,tree,nearest,crossings} from './brute-motion-review-v6-geometry.mjs';
const rig=await createRig(),g=JSON.parse(fs.readFileSync('output/brute-motion-v6/candidate-02/poses.json')),ref=rig.record(0).positions.map(p=>v().fromArray(p)),chest=rig.regions.torso.filter(i=>Math.abs(ref[i].x)<.28&&ref[i].y>1.9&&ref[i].y<2.72),rows=[];
for(const id of ['warrior','dwarf']){
 const targets=g.heroes[id].map(m=>({name:m.name,tree:tree(triangles({...m,points:m.positions.map(p=>v().set(p[0],p[1],p[2]-1.89))}))}));
 for(const x of [0,.18,.30,.40])for(const y of [2.04,2.16,2.28]){
  let found;
  function get(f){rig.pose(.7,{wrist:[x,y,f]});const mesh={points:rig.points().map(p=>v().fromArray(p)),indices:rig.indices},h=tree(triangles(mesh,rig.regions.hand)),first=targets.map(t=>({mesh:t.name,...nearest(h,t.tree)})).sort((a,b)=>a.gap-b.gap)[0];return {mesh,h,first};}
  for(let f=.16;f<=1.25;f+=.025){const r=get(f);if(r.first.gap<.0005){let lo=f-.025,hi=f;for(let j=0;j<12;j++){const mid=(lo+hi)/2;if(get(mid).first.gap<.0005)hi=mid;else lo=mid;}found=lo;break;}}
  if(found===undefined){rows.push({id,x,y,found:false});continue;}
  const r=get(found),torso=tree(triangles(r.mesh,rig.regions.torso)),fore=tree(triangles(r.mesh,rig.regions.forearm)),ch=tree(triangles(r.mesh,chest));const info=rig.pose(.7,{wrist:[x,y,found]});
  const row={id,wrist:[x,y,found],first:r.first,handTorso:nearest(r.h,torso).gap,handTorsoCrossings:crossings(r.h,torso,ref).length,forearmChest:nearest(fore,ch).gap,forearmChestCrossings:crossings(fore,ch,ref).length,reach:info.reach};rows.push(row);console.log(JSON.stringify(row));
 }
}
fs.writeFileSync('output/brute-motion-v6/pose-search.json',JSON.stringify(rows,null,2)+'\n');
