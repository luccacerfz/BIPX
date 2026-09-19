import {THREE,loadCPU,v} from './brute-motion-review-v6-utils.mjs';
import {refresh} from './brute-motion-review-v6-native-scene.mjs';
import fs from 'node:fs';
const probes=JSON.parse(fs.readFileSync('output/brute-motion-v6/source/assets__models__monsters__ground-probes.json')).brute.vertexIndices;
export async function loadBody(file){
 const g=await loadCPU(file),model=g.scene,root=new THREE.Group();root.add(model);model.rotation.y=Math.PI/2;
 const mixer=new THREE.AnimationMixer(model);let body;model.traverse(o=>{if(o.isSkinnedMesh)body=o;});
 mixer.clipAction(g.animations[0]).play();mixer.update(0);refresh(root);
 const box=new THREE.Box3().setFromObject(model,true);root.scale.setScalar(3.3/box.getSize(v()).y);model.position.y=-box.min.y;
 function ground(){refresh(root);const inv=model.matrixWorld.clone().invert();let min=Infinity;for(const i of probes)min=Math.min(min,body.getVertexPosition(i,v()).applyMatrix4(body.matrixWorld).applyMatrix4(inv).y);model.position.y=-min;refresh(root);}
 function seek(t,clip=3){mixer.stopAllAction();const a=mixer.clipAction(g.animations[clip]).setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.reset().play();mixer.setTime(t);ground();}
 function points(){refresh(root);return Array.from({length:body.geometry.attributes.position.count},(_,i)=>body.getVertexPosition(i,v()).applyMatrix4(body.matrixWorld));}
 function weights(triangle){
  const indices=Array.from(body.geometry.index.array).slice(triangle*3,triangle*3+3),sum={},vertices=[];
  for(const i of indices){const w={};for(let j=0;j<4;j++){const n=body.skeleton.bones[body.geometry.attributes.skinIndex.getComponent(i,j)].name,x=body.geometry.attributes.skinWeight.getComponent(i,j);if(x>0){w[n]=(w[n]||0)+x;sum[n]=(sum[n]||0)+x/3;}}vertices.push({vertex:i,weights:w});}
  const mixed=Object.keys(sum).some(n=>/^R_(Upperarm|Forearm|Hand)/.test(n));
  return {indices,region:mixed?'torso/right-arm mixed':'torso without right-arm weights',weights:sum,vertices};
 }
 seek(0);return {g,model,root,body,seek,points,ground,weights,indices:Array.from(body.geometry.index.array)};
}
