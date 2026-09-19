import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import {loadCPU,pack,unpack} from './enemy-locomotion-utils.mjs';
async function buildGait(role, ORIGINAL, SOURCE, OUTPUT) {
const hash=b=>createHash('sha256').update(b).digest('hex');
const MAP={Hips:'Hip',Spine:'Waist',Spine1:'Spine01',Spine2:'Spine02',Neck:'NeckTwist01',Head:'Head',LeftShoulder:'L_Clavicle',LeftArm:'L_Upperarm',LeftForeArm:'L_Forearm',LeftHand:'L_Hand',RightShoulder:'R_Clavicle',RightArm:'R_Upperarm',RightForeArm:'R_Forearm',RightHand:'R_Hand',LeftUpLeg:'L_Thigh',LeftLeg:'L_Calf',LeftFoot:'L_Foot',LeftToeBase:'L_ToeBase',RightUpLeg:'R_Thigh',RightLeg:'R_Calf',RightFoot:'R_Foot',RightToeBase:'R_ToeBase'};
const v=()=>new THREE.Vector3(),q=()=>new THREE.Quaternion();
function rest(scene){scene.updateMatrixWorld(true);const map=new Map();scene.traverse(n=>map.set(n.name,{p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone(),wp:n.getWorldPosition(v()),wq:n.getWorldQuaternion(q())}));return map;}
function reset(scene,map){scene.traverse(n=>{const r=map.get(n.name);n.position.copy(r.p);n.quaternion.copy(r.q);n.scale.copy(r.s);});scene.updateMatrixWorld(true);}
const target=await loadCPU(ORIGINAL),source=await loadCPU(SOURCE),tr=rest(target.scene),sr=rest(source.scene);
const body=target.scene.getObjectByName('OrcBody'),rig=target.scene.getObjectByName('OrcRig'),hip=target.scene.getObjectByName('Hip');
const src=new Map();source.scene.traverse(n=>{if(/^mixamorig/i.test(n.name))src.set(n.name.replace(/^mixamorig[:_]?/i,''),n);});
const pairs=[];target.scene.traverse(n=>{const sourceName=Object.keys(MAP).find(k=>MAP[k]===n.name);if(src.has(sourceName))pairs.push({s:src.get(sourceName),t:n});});
assert.equal(pairs.length,22);
function length(map,names){return map.get(names[0]).wp.distanceTo(map.get(names[1]).wp)+map.get(names[1]).wp.distanceTo(map.get(names[2]).wp);}
const ratio=length(tr,['L_Thigh','L_Calf','L_Foot'])/length(sr,['LeftUpLeg','LeftLeg','LeftFoot'].map(n=>src.get(n).name));
const clip=source.animations[0],mixer=new THREE.AnimationMixer(source.scene),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.update(0);source.scene.updateMatrixWorld(true);
const srcHip=src.get('Hips'),start=srcHip.getWorldPosition(v());mixer.setTime(clip.duration);source.scene.updateMatrixWorld(true);const displacement=srcHip.getWorldPosition(v()).sub(start);action.reset().play();mixer.setTime(0);const cycleStart=rest(source.scene);
const frames=Math.ceil(clip.duration*120)+1,times=new Float32Array(frames),arrays=new Map(pairs.map(({t})=>[t.name,new Float32Array(frames*4)])),hips=new Float32Array(frames*3),roots=new Float32Array(frames*3),probes=new Set(),samples=[];
let maxNormError=0;const point=v();
function floor(){target.scene.updateMatrixWorld(true);body.skeleton.update();let min=Infinity,index=-1;for(let i=0;i<body.geometry.attributes.position.count;i++){body.getVertexPosition(i,point).applyMatrix4(body.matrixWorld);if(point.y<min){min=point.y;index=i;}}probes.add(index);return min;}
for(let i=0;i<frames;i++){
  const time=clip.duration*i/(frames-1);times[i]=time;mixer.setTime(time);
  // Close the donor's small endpoint mismatch over the last 80 ms; keep its
  // forward displacement for stride measurement, not for gameplay movement.
  const blend=THREE.MathUtils.smoothstep(time,clip.duration-.08,clip.duration);
  for(const n of src.values())n.quaternion.slerp(cycleStart.get(n.name).q,blend);
  source.scene.updateMatrixWorld(true);reset(target.scene,tr);
  for(const {s,t} of pairs){
    const delta=s.getWorldQuaternion(q()).multiply(sr.get(s.name).wq.clone().invert());
    const desired=delta.multiply(tr.get(t.name).wq);
    t.quaternion.copy(t.parent.getWorldQuaternion(q()).invert().multiply(desired)).normalize();t.updateMatrixWorld(true);
    maxNormError=Math.max(maxNormError,Math.abs(t.quaternion.length()-1));
  }
  // The two deform joints are direct parents. Their twist bones are side
  // branches, so these rotations carry the twist geometry without reparenting.
  // Match donor leg DIRECTIONS, not a world delta preserving Orc bind flexion.
  for(const [side,donor]of [['L','Left'],['R','Right']]) {
    const upper=target.scene.getObjectByName(`${side}_Thigh`),lower=target.scene.getObjectByName(`${side}_Calf`),ankle=target.scene.getObjectByName(`${side}_Foot`);
    const footWorld=ankle.getWorldQuaternion(q());
    for(const [bone,child,sbone,schild]of [[upper,lower,src.get(`${donor}UpLeg`),src.get(`${donor}Leg`)],[lower,ankle,src.get(`${donor}Leg`),src.get(`${donor}Foot`)]]) {
      const from=child.getWorldPosition(v()).sub(bone.getWorldPosition(v())).normalize(),to=schild.getWorldPosition(v()).sub(sbone.getWorldPosition(v())).normalize();
      const desired=q().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(q()));
      bone.quaternion.copy(bone.parent.getWorldQuaternion(q()).invert().multiply(desired)).normalize();bone.updateMatrixWorld(true);
    }
    ankle.quaternion.copy(ankle.parent.getWorldQuaternion(q()).invert().multiply(footWorld)).normalize();ankle.updateMatrixWorld(true);
  }
  for(const {t}of pairs)t.quaternion.toArray(arrays.get(t.name),i*4);
  const bob=(srcHip.getWorldPosition(v()).y-sr.get(srcHip.name).wp.y)*ratio;
  const world=tr.get('Hip').wp.clone();world.y+=bob;hip.position.copy(hip.parent.worldToLocal(world));hip.position.toArray(hips,i*3);
  // A single constant support plane is calibrated below; retain flight phase.
  rig.position.toArray(roots,i*3);
  const min=floor();samples.push({time,minY:min,feet:['L_Foot','L_ToeBase','R_Foot','R_ToeBase'].map(n=>target.scene.getObjectByName(n).getWorldPosition(v()).toArray())});
}
// Preserve the donor's flight: lift all samples equally instead of pinning
// whichever foot is lowest to the ground on every airborne frame.
const lift=-Math.min(...samples.map(s=>s.minY));for(let i=0;i<frames;i++)roots[i*3+1]+=lift;
const tracks=[...arrays].map(([n,values])=>new THREE.QuaternionKeyframeTrack(`${n}.quaternion`,times,values));tracks.push(new THREE.VectorKeyframeTrack('Hip.position',times,hips),new THREE.VectorKeyframeTrack('OrcRig.position',times,roots));
const generated=new THREE.AnimationClip(role,clip.duration,tracks),original=await fs.readFile(ORIGINAL),{json,bin}=unpack(original);let parts=[bin],offset=bin.length;
function append(array,width){const pad=(-offset)&3;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});parts.push(bytes);offset+=bytes.length;const idx=json.accessors.length;json.accessors.push({bufferView:view,componentType:5126,count:array.length/width,type:width===1?'SCALAR':`VEC${width}`,...(width===1?{min:[0],max:[clip.duration]}:{})});return idx;}
const channels=[],samplers=[];for(const track of generated.tracks){const dot=track.name.lastIndexOf('.'),node=json.nodes.findIndex(n=>n.name===track.name.slice(0,dot)),rotation=track.name.endsWith('.quaternion');assert(node>=0);const sampler=samplers.length;samplers.push({input:append(track.times,1),output:append(track.values,rotation?4:3),interpolation:'LINEAR'});channels.push({sampler,target:{node,path:rotation?'rotation':'translation'}});}
if(role==='Walk'){const old=json.animations.find(a=>a.name==='Walk');if(old)old.name='Walk_Original';}
json.animations.push({name:role,channels,samplers,extras:{source:`Local Adobe Mixamo ${role==='Walk'?'walking':'running'}.fbx`,retarget:'World rest delta, animated parent inverse',inPlace:true}});
const previous=json.scenes[json.scene||0].extras?.bipxMotion||{};
const stride=Math.hypot(displacement.x,displacement.z)*ratio;
const motion={...previous,version:2,source:'Local Mixamo Action Adventure Walking/Running, direct deform-leg alignment',
  ...(role==='Walk'?{walkSpeed:stride/clip.duration,walkStride:stride,walkCycleSeconds:clip.duration}:{runStride:stride,runCycleSeconds:clip.duration}),
  retargetedRoles:[...new Set([...(previous.retargetedRoles||[]),role])],contactProbes:[...new Set([...(previous.contactProbes||[]),...probes])].sort((a,b)=>a-b),[`${role.toLowerCase()}FloorLift`]:lift};
json.scenes[json.scene||0].extras={...(json.scenes[json.scene||0].extras||{}),bipxMotion:motion};json.buffers[0].byteLength=offset;
const bytes=pack(json,Buffer.concat(parts));await fs.writeFile(OUTPUT,bytes);const after=unpack(bytes),before=unpack(original);
const checks={originalPreserved:hash(await fs.readFile(ORIGINAL))===hash(original),binaryPrefixPreserved:after.bin.subarray(0,bin.length).equals(bin),rigSkinGeometryMaterialsPreserved:['nodes','skins','meshes','materials','textures','images'].every(k=>JSON.stringify(before.json[k])===JSON.stringify(after.json[k])),oldClipsPreserved:JSON.stringify(after.json.animations.slice(0,before.json.animations.length).map(a=>({...a,name:a.name==='Walk_Original'?'Walk':a.name})))===JSON.stringify(before.json.animations.map(a=>({...a,name:a.name==='Walk_Original'?'Walk':a.name}))),unitQuaternions:maxNormError<1e-6,finite:tracks.every(t=>[...t.values].every(Number.isFinite)),realDonorTranslation:stride>.1,runFootExcursion:Math.max(...samples.map(s=>s.feet[0][2]))-Math.min(...samples.map(s=>s.feet[0][2]))>.15};
const report={scope:'CPU retarget and source preservation, visual review pending',original:ORIGINAL,originalSha256:hash(original),source:SOURCE,sourceSha256:hash(await fs.readFile(SOURCE)),output:OUTPUT,outputSha256:hash(bytes),checks,ratio,displacement:displacement.toArray(),motion,maxNormError,samples};await fs.writeFile(`output/enemy-locomotion/build-v2-${role.toLowerCase()}.json`,JSON.stringify(report,null,2)+'\n');await fs.writeFile(OUTPUT.replace('.glb','.provenance.json'),JSON.stringify({...report,samples:undefined},null,2)+'\n');console.log(JSON.stringify({...report,samples:undefined},null,2));for(const[k,ok]of Object.entries(checks))assert.equal(ok,true,k);

}
await buildGait('Walk','assets/models/orc-peon.glb','assets/models/orc-peon-source/mixamo-walking.glb','assets/models/orc-peon-source/orc-peon-walk-v2.glb');
await buildGait('Run','assets/models/orc-peon-source/orc-peon-walk-v2.glb','assets/models/orc-peon-source/mixamo-running.glb','assets/models/orc-peon-locomotion-v2.glb');
