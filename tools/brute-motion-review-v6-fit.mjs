// CPU whole-hand first-surface endpoint search, fixed hero centers. No hit authority.
import fs from 'node:fs';
import {createRig,DURATION} from './brute-motion-review-v6-rig.mjs';
import {v} from './brute-motion-review-v6-utils.mjs';
import {triangles,tree,nearest} from './brute-motion-review-v6-geometry.mjs';
const base='output/brute-motion-v6',revision=process.argv[2]||'candidate-01';
const rig=await createRig(),manifest=JSON.parse(fs.readFileSync(`${base}/source-manifest.json`));
const heroes=JSON.parse(fs.readFileSync(manifest.sources['output/brute-motion-v5/player-fit-v1/geometry.json'].snapshot)).heroes;
const out=`${base}/${revision}`;fs.mkdirSync(out,{recursive:true});
const distance=1.89,results=[];
for(const id of ['warrior','dwarf']){
 const targets=heroes[id].map(m=>{const mesh={...m,points:m.positions.map(p=>v().set(p[0],p[1],p[2]-distance))};return {name:m.name,tree:tree(triangles(mesh))};});
 const [x,forward]=id==='warrior'?[.18,.80]:[.08,.95];
 function sample(height){
  const wrist=[x,height,forward],info=rig.pose(.70,{wrist}),pts=rig.points().map(p=>v().fromArray(p)),mesh={points:pts,indices:rig.indices},hand=tree(triangles(mesh,rig.regions.hand));
  const hits=targets.map(t=>({mesh:t.name,...nearest(hand,t.tree)})).sort((a,b)=>a.gap-b.gap);
  return {wrist,reach:info.reach,first:hits[0],all:hits};
 }
 let previous=sample(2.95),contact=null;const scan=[previous];
 for(let h=2.925;h>=1.9;h-=.025){const s=sample(h);scan.push(s);if(s.first.gap<.0005){contact={low:h,high:previous.wrist[1]};break;}previous=s;}
 if(!contact)throw Error(`No encounter ${id}`);
 for(let i=0;i<15;i++){const mid=(contact.low+contact.high)/2,s=sample(mid);if(s.first.gap<.0005)contact.low=mid;else contact.high=mid;}
 const final=sample(contact.high);results.push({id,distance,center:[0,0,-distance],intentTime:.70,markerSelected:false,...final,scan});
 console.log(JSON.stringify({id,wrist:final.wrist,first:final.first,reach:final.reach}));
}
fs.writeFileSync(`${out}/fit.json`,JSON.stringify({scope:'Authored key pose whole-hand first-surface endpoint; not a selected timing marker',results},null,2)+'\n');
const poses={indices:rig.indices,regions:rig.regions,heroes,variants:{}};
for(const r of results){poses.variants[r.id]={distance,endpoint:r.wrist,poses:[0,.18,.40,.58,.65,.70,.745,.82,1.05,1.30,DURATION].map(t=>rig.record(t,{wrist:r.wrist}))};}
fs.writeFileSync(`${out}/poses.json`,JSON.stringify(poses));
