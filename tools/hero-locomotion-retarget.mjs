import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { THREE, bonesOf } from './hero-locomotion-cpu-support.mjs';
import { loadGlb } from '../src/assets/load-glb.js';
// A faster backward take already owned in the Aldric Mixamo package. Transfer
// only lower-body world rest rotation deltas onto Lyra's original limb lengths.
const srcUrl=new URL('../output/hero-locomotion/export/aldric-directional.glb',import.meta.url);
const tgtUrl=new URL('../assets/models/dwarf-rifleman.glb',import.meta.url);
const source=await loadGlb(srcUrl),target=await loadGlb(tgtUrl);
function idleFloor(doc) {
 const mixer=new THREE.AnimationMixer(doc.scene);mixer.clipAction(doc.animations.find(c=>c.name==='Idle')).play();mixer.update(0);doc.scene.updateMatrixWorld(true);doc.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const floor=new THREE.Box3().setFromObject(doc.scene,true).min.y;mixer.stopAllAction();doc.scene.updateMatrixWorld(true);return floor;
}
const sourceFloor=idleFloor(source),targetFloor=idleFloor(target);
const normalize=model=>Object.fromEntries(Object.entries(bonesOf(model)).map(([n,b])=>[n.replace(/_\d+$/,''),b]));
for(const doc of [source,target]) doc.scene.updateMatrixWorld(true);
const sb=normalize(source.scene),tb=normalize(target.scene),names=Object.keys(tb).filter(n=>n==='Hips'||/^(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(n));
const rest=bones=>Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone(),worldP:b.getWorldPosition(new THREE.Vector3()),worldQ:b.getWorldQuaternion(new THREE.Quaternion())}]));
const sr=rest(sb),tr=rest(tb),legLength=r=>r.LeftUpLeg.worldP.distanceTo(r.LeftLeg.worldP)+r.LeftLeg.worldP.distanceTo(r.LeftFoot.worldP);
const ratio=legLength(tr)/legLength(sr),original=source.animations.find(c=>c.name==='RunAlternate'),mixer=new THREE.AnimationMixer(source.scene),action=mixer.clipAction(original).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
const count=Math.round(original.duration*30)+1,times=Float32Array.from({length:count},(_,i)=>i/(count-1)*original.duration);
const values=Object.fromEntries(names.map(n=>[n,{quaternion:new Float32Array(count*4),position:new Float32Array(count*3),scale:new Float32Array(count*3)}]));
let maxOffsetError=0,maxRotationError=0,maxGroundAdjustment=0;
for(let i=0;i<count;i++) {
 mixer.setTime(times[i]);source.scene.updateMatrixWorld(true);
 for(const n of names){tb[n].position.copy(tr[n].position);tb[n].quaternion.copy(tr[n].quaternion);tb[n].scale.copy(tr[n].scale);}
 target.scene.updateMatrixWorld(true);
 for(const n of names) {
  const desired=sb[n].getWorldQuaternion(new THREE.Quaternion()).multiply(sr[n].worldQ.clone().invert()).multiply(tr[n].worldQ);
  tb[n].quaternion.copy(tb[n].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired)).normalize();
  if(n==='Hips') {const world=tr.Hips.worldP.clone();world.y+=(sb.Hips.getWorldPosition(new THREE.Vector3()).y-sr.Hips.worldP.y)*ratio;tb.Hips.position.copy(tb.Hips.parent.worldToLocal(world));}
  tb[n].updateMatrixWorld(true);
  maxRotationError=Math.max(maxRotationError,desired.clone().normalize().angleTo(tb[n].getWorldQuaternion(new THREE.Quaternion()).normalize()));
  if(n!=='Hips')maxOffsetError=Math.max(maxOffsetError,tb[n].position.distanceTo(tr[n].position));
  for(const property of ['quaternion','position','scale'])tb[n][property].toArray(values[n][property],i*(property==='quaternion'?4:3));
 }
 const sourceToeY=Math.min(...['LeftToeBase','RightToeBase'].map(n=>sb[n].getWorldPosition(new THREE.Vector3()).y));
 const targetToeY=Math.min(...['LeftToeBase','RightToeBase'].map(n=>tb[n].getWorldPosition(new THREE.Vector3()).y));
 const lift=targetFloor+Math.max(.006,(sourceToeY-sourceFloor)*ratio)-targetToeY;
 maxGroundAdjustment=Math.max(maxGroundAdjustment,Math.abs(lift));
 const hip=tb.Hips.getWorldPosition(new THREE.Vector3());hip.y+=lift;tb.Hips.position.copy(tb.Hips.parent.worldToLocal(hip));tb.Hips.updateMatrixWorld(true);tb.Hips.position.toArray(values.Hips.position,i*3);
}

assert(maxOffsetError<1e-8);assert(maxRotationError<1e-5);
const tracks=names.flatMap(n=>['quaternion','position','scale'].map(p=>new (p==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack)(`${tb[n].name}.${p}`,times,values[n][p])));
const clip=THREE.AnimationClip.toJSON(new THREE.AnimationClip('RunBackwardFast',original.duration,tracks));clip.uuid='bipx-dwarf-RunBackwardFast';
const file='src/assets/dwarf-locomotion-clips.json',doc=JSON.parse(await fs.readFile(file));doc.clips=doc.clips.filter(c=>c.clip.name!=='RunBackwardFast');doc.clips.push({direction:[0,-1],clip});
doc.backwardRetarget={source:'Aldric Mixamo sword and shield run (2), lower body only',sourceSha256:createHash('sha256').update(await fs.readFile(srcUrl)).digest('hex'),targetSha256:createHash('sha256').update(await fs.readFile(tgtUrl)).digest('hex'),method:'World rotation from source rest to animated source, then target rest; target local offsets/scales unchanged. Hip vertical scaled by target/source leg length; no planar root motion.',legLengthRatio:ratio,sourceFloor,targetFloor,maxGroundAdjustment,maxOffsetError,maxRotationError};
await fs.writeFile(file,JSON.stringify(doc));await fs.writeFile('output/hero-locomotion/lyra-backward-retarget.json',JSON.stringify(doc.backwardRetarget,null,2));console.log(doc.backwardRetarget);
