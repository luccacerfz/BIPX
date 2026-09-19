import fs from 'node:fs';
import {THREE,loadCPU,v} from './brute-motion-review-v6-utils.mjs';
import {refresh} from './brute-motion-review-v6-native-scene.mjs';
import {triangles,tree} from './brute-motion-review-v6-geometry.mjs';
const frozen=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/poses.json'));
const profiles=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/attack-profiles.json'));
export async function createTargets(id){
 const p=profiles.variants.find(p=>p.id===id),g=await loadCPU(p.nativeTargetCopy),model=g.scene,target=new THREE.Group(),root=new THREE.Group();
 target.add(root);root.add(model);model.rotation.y=id==='warrior'?Math.PI:Math.PI-.0653;target.rotation.y=Math.PI;
 const mixer=new THREE.AnimationMixer(model);mixer.clipAction(g.animations.find(c=>c.name==='Idle')).play();mixer.update(0);refresh(target);
 const box=new THREE.Box3().setFromObject(model,true);root.scale.setScalar(p.targetHeight/box.getSize(v()).y);model.position.y-=box.min.y;refresh(target);
 const cache=new Map();
 function sample({distance=1.89,clip='Idle',phase=0,yaw=0,x=0,blend=1}={}){
  const key=[distance,clip,phase,yaw,x,blend].join(':');if(cache.has(key))return cache.get(key);
  let meshes;
  if(clip==='Idle'&&phase===0){
   const rotation=new THREE.Matrix4().makeRotationY(yaw*Math.PI/180);
   meshes=frozen.heroes[id].map(m=>({name:m.name,indices:m.indices,points:m.positions.map(p=>v().fromArray(p).applyMatrix4(rotation).add(v().set(x,0,-distance)))}));
  }else{
   const c=g.animations.find(c=>c.name===clip);mixer.stopAllAction();
   if(blend<1){
    const idle=g.animations.find(c=>c.name==='Idle');
    mixer.clipAction(idle).reset().setEffectiveWeight(1-blend).play().time=0;
    let posed=g.animations.find(c=>c.name===`${clip}-review-pose`);if(!posed){posed=c.clone();posed.name=`${clip}-review-pose`;g.animations.push(posed);}
    mixer.clipAction(posed).reset().setEffectiveWeight(blend).play().time=c.duration*phase;mixer.update(0);
   }else{mixer.clipAction(c).reset().setEffectiveWeight(1).play();mixer.setTime(c.duration*phase);}
   target.position.set(x,0,-distance);target.rotation.y=Math.PI+yaw*Math.PI/180;refresh(target);meshes=[];
   model.traverse(m=>{if(m.isMesh)meshes.push({name:m.name,indices:Array.from(m.geometry.index.array),points:Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,v()).applyMatrix4(m.matrixWorld))});});
  }
  const result=meshes.map(m=>({...m,tree:tree(triangles(m))}));cache.set(key,result);return result;
 }
 function anatomy(meshName,triangle){
  const m=model.getObjectByName(meshName);if(!m?.isSkinnedMesh)return {rigidMesh:meshName};
  const w={};for(let k=0;k<3;k++){const i=m.geometry.index.getX(triangle*3+k);for(let j=0;j<4;j++){const name=m.skeleton.bones[m.geometry.attributes.skinIndex.getComponent(i,j)].name;w[name]=(w[name]||0)+m.geometry.attributes.skinWeight.getComponent(i,j)/3;}}
  return Object.fromEntries(Object.entries(w).sort((a,b)=>b[1]-a[1]).filter(([,w])=>w>.01));
 }
 return {sample,profile:p,anatomy};
}
