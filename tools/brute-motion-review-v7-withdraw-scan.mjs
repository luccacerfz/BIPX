import fs from 'node:fs';
import {createRig} from './brute-motion-review-v7-rig.mjs';
import {v} from './brute-motion-review-v6-utils.mjs';
import {tree,triangles,crossings} from './brute-motion-review-v6-geometry.mjs';
import {makeEncounterPath,hermite,derivative} from './brute-motion-review-v7-path.mjs';
const rig=await createRig(),baseRig=await createRig();
const old=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/fit.json'));
const fits=JSON.parse(fs.readFileSync('output/brute-motion-v7/candidate-02/fit.json')).results;
const regions=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/warrior-cpu.json')).regions;
const rp=rig.record(0,old.results[0]).positions.map(p=>v().fromArray(p));
const results=[];
for(const id of ['warrior','dwarf']){
 const original=old.results.find(r=>r.id===id),fit=fits.find(r=>r.id===id&&r.distance===1.855&&r.phase===0);
 const base=t=>baseRig.pose(t,original).rightRequested.slice(),incoming=makeEncounterPath(base,fit.endpoint),p=incoming(.55),vel=derivative(incoming,.55);
 for(const x of [.65,.8,.95,1.1])for(const y of [2.45,2.60,2.75]){
  const keys=[{t:.55,p,v:vel},{t:.71,p:[x,y,p[2]-.22],v:[.5,.1,-.5]},{t:1.05,p:base(1.05),v:derivative(base,1.05)}];
  const path=t=>{if(t<=.55)return incoming(t);if(t>=1.05)return base(t);const i=keys.findIndex(k=>k.t>=t);return hermite(keys[i-1],keys[i],t);};
  let cap=0,hand=0,reach=0;
  for(let i=34;i<=63;i++){const info=rig.pose(i/60,{...original,rightPath:path});reach=Math.max(reach,info.reaches.RArm);const mesh={points:rig.points().map(p=>v().fromArray(p)),indices:rig.indices};
   const T=k=>tree(triangles(mesh,regions[k]));cap=Math.max(cap,crossings(T('caps'),T('chest'),rp).length);hand=Math.max(hand,crossings(T('hand'),T('torso'),rp).length);
  }
  const r={id,x,y,cap,hand,reach};results.push(r);console.log(JSON.stringify(r));
 }
}
fs.writeFileSync('output/brute-motion-v7/withdraw-scan.json',JSON.stringify({scope:'CPU wrist waypoint authoring scan, no approval by count',results},null,2)+'\n');
