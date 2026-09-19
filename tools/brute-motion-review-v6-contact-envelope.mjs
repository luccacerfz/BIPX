// Bounded CPU counterexamples for the frozen clip. No runtime, actor or clip edits.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,loadCPU,hash,v} from './brute-motion-review-v6-utils.mjs';
import {makePair,refresh} from './brute-motion-review-v6-native-scene.mjs';
import {triangles,tree,nearest,crossings} from './brute-motion-review-v6-geometry.mjs';
const base='output/brute-motion-v6',out=`${base}/contact-followup-v1`;
const profiles=JSON.parse(fs.readFileSync(`${base}/handoff-01/attack-profiles.json`));
const poses=JSON.parse(fs.readFileSync(`${base}/handoff-01/poses.json`));
const probes=JSON.parse(fs.readFileSync(`${base}/source/assets__models__monsters__ground-probes.json`)).brute.vertexIndices;
const report={scope:'CPU frozen Brute vs real source hero pose counterexamples. Raw Run/Idle phases are not exact blended live locomotion; no positive dynamic-fit certification.',
  duration:1.45,marker:null,worldPositionsAreFixtureInputs:true,rootSnapping:false,rangeExpansion:false,
  distances:[1.82,1.855,1.89],sourceHashes:{},results:[]};
const cases=[
 ...[1.82,1.855,1.89].flatMap(distance=>[.65,.7,.75].map(time=>({name:'Idle0',clip:'Idle',phase:0,distance,time,yaw:0}))),
 ...[1.82,1.89].flatMap(distance=>[
  {name:'Idle-quarter',clip:'Idle',phase:.25,distance,time:.7,yaw:0},
  {name:'Run-quarter',clip:'Run',phase:.25,distance,time:.7,yaw:0},
  {name:'Run-half',clip:'Run',phase:.5,distance,time:.7,yaw:0},
 ]),
 ...[-15,15].map(yaw=>({name:`Idle-yaw${yaw}`,clip:'Idle',phase:0,distance:1.89,time:.7,yaw})),
];
for(const p of profiles.variants){
 assert.equal(hash(fs.readFileSync(p.asset)),p.sha256);
 const pair=makePair({brute:await loadCPU(p.asset),hero:await loadCPU(p.nativeTargetCopy),id:p.id,probes,profile:p});
 const source=await loadCPU(p.nativeTargetCopy),target=new THREE.Group(),root=new THREE.Group(),model=source.scene;
 target.add(root);root.add(model);model.rotation.y=p.id==='warrior'?Math.PI:Math.PI-.0653;target.rotation.y=Math.PI;
 const mixer=new THREE.AnimationMixer(model);mixer.clipAction(source.animations.find(c=>c.name==='Idle')).play();mixer.update(0);refresh(target);
 const bounds=new THREE.Box3().setFromObject(model,true);root.scale.setScalar(p.targetHeight/bounds.getSize(v()).y);model.position.y-=bounds.min.y;refresh(target);
 report.sourceHashes[p.id]={brute:p.sha256,hero:p.nativeTargetSHA};
 const caches=new Map();
 for(const c of cases){
  pair.seek(c.time);
  const hand=tree(triangles({points:pair.positions(pair.body).map(p=>v().fromArray(p)),indices:poses.indices},poses.regions.hand));
  const cacheKey=[c.clip,c.phase,c.distance,c.yaw].join(':');
  if(!caches.has(cacheKey)){
   let meshes;
   if(c.clip==='Idle'&&c.phase===0){
    const rotation=new THREE.Matrix4().makeRotationY(c.yaw*Math.PI/180);
    meshes=poses.heroes[p.id].map(m=>({name:m.name,indices:m.indices,
      points:m.positions.map(q=>v().fromArray(q).applyMatrix4(rotation).add(v().set(0,0,-c.distance)))}));
   }else{
    const clip=source.animations.find(a=>a.name===c.clip);mixer.stopAllAction();mixer.clipAction(clip).reset().play();mixer.setTime(clip.duration*c.phase);
    target.position.z=-c.distance;target.rotation.y=Math.PI+c.yaw*Math.PI/180;refresh(target);meshes=[];
    model.traverse(m=>{if(m.isMesh)meshes.push({name:m.name,indices:Array.from(m.geometry.index.array),
      points:Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,v()).applyMatrix4(m.matrixWorld))});});
   }
   caches.set(cacheKey,meshes.map(m=>({name:m.name,tree:tree(triangles(m))})));
  }
  const contacts=caches.get(cacheKey).map(m=>({mesh:m.name,...nearest(hand,m.tree),properCrossingPairs:crossings(hand,m.tree).length})).sort((a,b)=>a.gap-b.gap);
  const result={variant:p.id,...c,allContacts:contacts,first:contacts[0],intersects:contacts.some(x=>x.properCrossingPairs>0)};
  report.results.push(result);console.log(JSON.stringify({variant:p.id,name:c.name,d:c.distance,t:c.time,first:result.first.mesh,gap:result.first.gap,crossings:contacts.reduce((s,x)=>s+x.properCrossingPairs,0)}));
 }
 pair.dispose();
}
for(const p of profiles.variants)assert.equal(hash(fs.readFileSync(p.asset)),p.sha256);
fs.writeFileSync(`${out}/envelope-cpu.json`,JSON.stringify(report,null,2)+'\n');
