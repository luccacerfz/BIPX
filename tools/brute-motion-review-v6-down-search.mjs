import fs from 'node:fs';import {createRig} from './brute-motion-review-v6-rig.mjs';import {v} from './brute-motion-review-v6-utils.mjs';import {triangles,tree,nearest,crossings} from './brute-motion-review-v6-geometry.mjs';
const rig=await createRig(),g=JSON.parse(fs.readFileSync('output/brute-motion-v6/candidate-02/poses.json')),ref=rig.record(0).positions.map(p=>v().fromArray(p)),chest=rig.regions.torso.filter(i=>Math.abs(ref[i].x)<.28&&ref[i].y>1.9&&ref[i].y<2.72),rows=[];
for(const id of ['warrior','dwarf']){
 const targets=g.heroes[id].map(m=>({name:m.name,tree:tree(triangles({...m,points:m.positions.map(p=>v().set(p[0],p[1],p[2]-1.89))}))}));
 for(const x of [.08,.18,.28])for(const f of [.65,.80,.95]){
  function get(y){const info=rig.pose(.7,{wrist:[x,y,f]}),mesh={points:rig.points().map(p=>v().fromArray(p)),indices:rig.indices},h=tree(triangles(mesh,rig.regions.hand)),first=targets.map(t=>({mesh:t.name,...nearest(h,t.tree)})).sort((a,b)=>a.gap-b.gap)[0];return {mesh,h,first,info};}
  let found;
  for(let y=2.95;y>=1.90;y-=.025){if(get(y).first.gap<.0005){let hi=y+.025,lo=y;for(let j=0;j<12;j++){const mid=(lo+hi)/2;if(get(mid).first.gap<.0005)lo=mid;else hi=mid;}found=hi;break;}}
  if(found===undefined){rows.push({id,x,f,found:false});continue;}
  const r=get(found),torso=tree(triangles(r.mesh,rig.regions.torso)),fore=tree(triangles(r.mesh,rig.regions.forearm)),ch=tree(triangles(r.mesh,chest));
  const row={id,wrist:[x,found,f],first:r.first,handTorso:nearest(r.h,torso).gap,handTorsoCrossings:crossings(r.h,torso,ref).length,forearmChest:nearest(fore,ch).gap,forearmChestCrossings:crossings(fore,ch,ref).length,reach:r.info.reach};rows.push(row);console.log(JSON.stringify(row));
 }
}
fs.writeFileSync('output/brute-motion-v6/down-search.json',JSON.stringify(rows,null,2)+'\n');
