// Compare ORIGINAL rig postures and preserved v4 only; no retarget or animation edits.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
const base = 'output/brute-motion-v4/source-triage-v1';
function graph(file) {
  const bytes=fs.readFileSync(file), length=bytes.readUInt32LE(12), json=JSON.parse(bytes.subarray(20,20+length)), bin=bytes.subarray(28+length);
  const nodes=json.nodes.map(n=>{const o=new THREE.Object3D();o.name=n.name||'';
    if(n.matrix)new THREE.Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);
    else {if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
  json.nodes.forEach((n,i)=>n.children?.forEach(child=>nodes[i].add(nodes[child])));
  const root=new THREE.Group();json.scenes[json.scene||0].nodes.forEach(i=>root.add(nodes[i]));root.updateMatrixWorld(true);
  function accessor(i){const a=json.accessors[i],b=json.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3,VEC4:4}[a.type];assert.equal(a.componentType,5126);const values=new Float32Array(a.count*width),start=(b.byteOffset||0)+(a.byteOffset||0),stride=b.byteStride||width*4;
    for(let k=0;k<a.count;k++)for(let j=0;j<width;j++)values[k*width+j]=bin.readFloatLE(start+k*stride+j*4);return values;}
  function clip(i){return new THREE.AnimationClip(json.animations[i].name,-1,json.animations[i].channels.map(c=>{const sampler=json.animations[i].samplers[c.sampler],quaternion=c.target.path==='rotation',type=quaternion?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;
    return new type(`${nodes[c.target.node].uuid}.${quaternion?'quaternion':c.target.path==='translation'?'position':c.target.path}`,accessor(sampler.input),accessor(sampler.output));}));}
  return {root,clip,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
const maps={Hips:'Hip',Head:'Head',LeftUpLeg:'L_Thigh',LeftLeg:'L_Calf',LeftFoot:'L_Foot',LeftToeBase:'L_ToeBase',RightUpLeg:'R_Thigh',RightLeg:'R_Calf',RightFoot:'R_Foot',RightToeBase:'R_ToeBase',LeftHand:'L_Hand',RightHand:'R_Hand'};
function posture(root){root.updateMatrixWorld(true);const joints=Object.fromEntries(Object.entries(maps).map(([name,target])=>[name,root.getObjectByName(target).getWorldPosition(new THREE.Vector3()).toArray()]));const p=n=>new THREE.Vector3().fromArray(joints[n]);
  const leg=p('LeftUpLeg').distanceTo(p('LeftLeg'))+p('LeftLeg').distanceTo(p('LeftFoot'));const floor=Math.min(joints.LeftFoot[1],joints.RightFoot[1],joints.LeftToeBase[1],joints.RightToeBase[1]);
  const knee=s=>p(s+'UpLeg').sub(p(s+'Leg')).angleTo(p(s+'Foot').sub(p(s+'Leg')))*180/Math.PI;
  return {joints,legLength:leg,hipHeightOverCurrentFootFloor:(joints.Hips[1]-floor)/leg,knees:[knee('Left'),knee('Right')],torsoLeanDegrees:p('Head').sub(p('Hips')).angleTo(new THREE.Vector3(0,1,0))*180/Math.PI};}
const output=[];
for(const file of ['assets/models/monsters/brute.glb','output/brute-motion-v4/frontal/brute.glb']){
 const loaded=graph(file),rest=posture(loaded.root),samples=[];
 for(const [label,index,times] of [['Idle',0,[0]],['Attack',3,[0,.5,1,1.5,2]]]){
  const g=graph(file),clip=g.clip(index),mixer=new THREE.AnimationMixer(g.root),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
  for(const time of times){if(time>clip.duration)continue;action.reset().play();mixer.setTime(time);samples.push({label,time,duration:clip.duration,...posture(g.root)});}
 }
 output.push({path:file,sha256:loaded.sha256,rest,samples});
}
fs.writeFileSync(`${base}/brute-compatibility.json`,JSON.stringify({scope:'Original rig/Idle versus preserved v4 posture; not a new retarget',records:output},null,2)+'\n');
console.log(JSON.stringify(output.map(({path,rest,samples})=>({path,rest:{knees:rest.knees,torso:rest.torsoLeanDegrees,hipOverLeg:rest.hipHeightOverCurrentFootFloor},samples:samples.map(({label,time,knees,torsoLeanDegrees,hipHeightOverCurrentFootFloor})=>({label,time,knees,torsoLeanDegrees,hipHeightOverCurrentFootFloor}))})),null,2));
