import fs from 'node:fs';
import {THREE,v} from './brute-motion-review-v6-utils.mjs';
import {loadBody} from './brute-motion-review-v8-body.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
import {tree,triangles,crossings} from './brute-motion-review-v8-geometry.mjs';
const body=await loadBody('output/brute-motion-v7/candidate-04/warrior-withdraw-surface.glb'),target=await createTargets('warrior');body.seek(0);const rest=body.points();
const frames=[];for(const t of [.65,.70,.745,.875,1.05]){body.seek(t);const points=body.points(),T=tree(triangles({points,indices:body.indices})),self=crossings(T,T,rest);frames.push({t,self:new Set(self.map(p=>p.slice().sort((a,b)=>a-b).join(':'))),targets:target.sample({distance:1.855,clip:'Run',phase:.25,blend:Math.min(1,(t-.55)/.15)})});}
const smooth=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*u*(10-15*u+6*u*u);};
function rotate(name,axis,deg){const n=body.model.getObjectByName(name),q=new THREE.Quaternion().setFromAxisAngle(axis,deg*Math.PI/180).multiply(n.getWorldQuaternion(new THREE.Quaternion()));n.quaternion.copy(n.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));body.ground();}
const results=[];
for(const back of [12,20,28,36])for(const clavicleYaw of [0,-8]){
 const rows=[];for(const f of frames){body.seek(f.t);const w=smooth(.55,.70,f.t)*(1-smooth(.95,1.3,f.t));rotate('Spine02',v().set(1,0,0),back*w);if(clavicleYaw)rotate('R_Clavicle',v().set(0,1,0),clavicleYaw*w);const T=tree(triangles({points:body.points(),indices:body.indices})),self=crossings(T,T,rest);rows.push({t:f.t,targetPairs:Math.max(...f.targets.map(m=>crossings(T,m.tree).length)),selfAdded:self.filter(p=>!f.self.has(p.slice().sort((a,b)=>a-b).join(':'))).length});}
 const row={back,clavicleYaw,targetPairs:Math.max(...rows.map(r=>r.targetPairs)),selfAdded:Math.max(...rows.map(r=>r.selfAdded)),rows};results.push(row);console.log(JSON.stringify(row));
}
fs.writeFileSync('output/brute-motion-v8/upper-follow-scan.json',JSON.stringify({results},null,2)+'\n');
