import fs from 'node:fs';
import {createRig} from './brute-motion-review-v8-rig.mjs';
import {clips,makePlan} from './brute-motion-review-v8-plan.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
import {triangles,tree,crossings,nearest} from './brute-motion-review-v8-geometry.mjs';
import {v} from './brute-motion-review-v6-utils.mjs';
const rig=await createRig(),base=await createRig();const out='output/brute-motion-v8';
const reg=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/warrior-cpu.json')).regions;
const rest=rig.record(0).positions.map(p=>v().fromArray(p)),results=[];
for(const name of ['warrior-withdraw-surface']){
 const c=clips.find(c=>c.name===name),target=await createTargets(c.id),times=c.mode==='encounter'?[.60,.70,.80,.875,.95]:[.60,.65,.70,.745,.85,.95,1.10];
 for(const upperBack of [12,20,28])for(const clavicleYaw of [-12,0,12]){const back=0;
  const plan=makePlan(c,base,{back,upperBack,clavicleYaw}),rows=[];
  for(const t of times){const r=rig.record(t,plan),mesh={points:r.positions.map(p=>v().fromArray(p)),indices:rig.indices},T=k=>tree(triangles(mesh,k?reg[k]:undefined));
   const condition=c.mode==='encounter'?{distance:c.distance,clip:c.clip,phase:c.phase}:{distance:c.distance,clip:'Run',phase:.25,blend:Math.min(1,Math.max(0,(t-.55)/.15))};const targets=target.sample(condition);
   const contacts={};for(const k of ['torso','hand','forearm','caps']){const A=T(k);contacts[k]=targets.map(m=>({mesh:m.name,pairs:crossings(A,m.tree).length,gap:nearest(A,m.tree).gap}));}
   const self=Object.fromEntries([['handTorso','hand','torso'],['leftHandTorso','leftHand','torso'],['forearmChest','forearm','chest'],['capChest','caps','chest'],['capHead','caps','head']].map(([k,a,b])=>[k,crossings(T(a),T(b),rest).length]));
   rows.push({t,reach:r.info.reach,contacts,self});
  }
  const summary={name,back,upperBack,clavicleYaw,reach:Math.max(...rows.map(r=>r.reach)),contacts:Object.fromEntries(['torso','hand','forearm','caps'].map(k=>[k,Math.max(...rows.flatMap(r=>r.contacts[k].map(x=>x.pairs)))])),self:Object.fromEntries(Object.keys(rows[0].self).map(k=>[k,Math.max(...rows.map(r=>r.self[k]))]))};
  results.push({summary,rows});console.log(JSON.stringify(summary));
 }
}
fs.writeFileSync(`${out}/upper-scan.json`,JSON.stringify({scope:'CPU causal pose scan, not selection by pair count alone',results},null,2)+'\n');
