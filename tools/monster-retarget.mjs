import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../src/assets/vendor/GLTFLoader.js';

const ROOT=path.resolve('output/monster-motion');
const ASSETS=path.resolve('assets/models/monsters');
await fs.mkdir(path.join(ROOT,'artifacts'),{recursive:true});
globalThis.ProgressEvent??=class ProgressEvent extends Event {constructor(type,options={}){super(type);Object.assign(this,options);}};
const hash=b=>createHash('sha256').update(b).digest('hex');
const MAP={Hips:'Hip',Spine:'Waist',Spine1:'Spine01',Spine2:'Spine02',Neck:'NeckTwist01',Head:'Head',
 LeftShoulder:'L_Clavicle',LeftArm:'L_Upperarm',LeftForeArm:'L_Forearm',LeftHand:'L_Hand',
 RightShoulder:'R_Clavicle',RightArm:'R_Upperarm',RightForeArm:'R_Forearm',RightHand:'R_Hand',
 LeftUpLeg:'L_Thigh',LeftLeg:'L_Calf',LeftFoot:'L_Foot',LeftToeBase:'L_ToeBase',
 RightUpLeg:'R_Thigh',RightLeg:'R_Calf',RightFoot:'R_Foot',RightToeBase:'R_ToeBase'};

function unpack(bytes){const length=bytes.readUInt32LE(12);return{json:JSON.parse(bytes.subarray(20,20+length)),bin:bytes.subarray(28+length,28+length+bytes.readUInt32LE(20+length))};}
function pack(json,bin){let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((-text.length)&3,32)]);bin=Buffer.concat([bin,Buffer.alloc((-bin.length)&3)]);const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+text.length+bin.length,8);head.writeUInt32LE(text.length,12);head.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([head,text,bh,bin]);}
async function loadCPU(file){const bytes=await fs.readFile(file);const{json,bin}=unpack(bytes);for(const m of json.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}delete json.images;delete json.textures;delete json.samplers;const cpu=pack(json,bin);return new GLTFLoader().parseAsync(cpu.buffer.slice(cpu.byteOffset,cpu.byteOffset+cpu.byteLength),'');}
const q=()=>new THREE.Quaternion(),v=()=>new THREE.Vector3();
const boneName=n=>n.replace(/^mixamorig[:_]?/i,'');
function rest(scene){scene.updateMatrixWorld(true);const states=new Map();scene.traverse(n=>states.set(n.name,{position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),worldQ:n.getWorldQuaternion(q()),worldP:n.getWorldPosition(v())}));return states;}
function reset(scene,states){scene.traverse(n=>{const s=states.get(n.name);n.position.copy(s.position);n.quaternion.copy(s.quaternion);n.scale.copy(s.scale);});scene.updateMatrixWorld(true);}
function skin(scene){let mesh;scene.traverse(n=>{if(n.isSkinnedMesh){mesh=n;n.skeleton.update();}});return mesh;}
function meshGround(scene){scene.updateMatrixWorld(true);const mesh=skin(scene),point=v(),box=new THREE.Box3();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);box.expandByPoint(point);}return box;}
function maxAngle(a,b){return 2*Math.acos(Math.min(1,Math.abs(a.dot(b))/Math.sqrt(a.lengthSq()*b.lengthSq())));}

const baselineBytes=await fs.readFile(path.join(ASSETS,'source/zombie-pre-mixamo.glb'));
const target=await loadCPU(path.join(ASSETS,'source/zombie-pre-mixamo.glb'));
const targetRest=rest(target.scene),targetMesh=skin(target.scene),targetBones=targetMesh.skeleton.bones;
const targetNodeByName=new Map();target.scene.traverse(n=>targetNodeByName.set(n.name,n));
const targetRestHeight=meshGround(target.scene).getSize(v()).y;
const runtimeScale=2.1/targetRestHeight;
const beforeGeometry=hash(Buffer.from(targetMesh.geometry.attributes.position.array.buffer));
const beforeBind=JSON.stringify(targetMesh.skeleton.boneInverses.map(m=>m.toArray()));
const clips=[],report={scope:'CPU retarget verification; not native rendering or artistic approval',runtimeHeight:2.1,targetRestHeight,runtimeScale,
 method:'Source animated WORLD rest delta, conjugated by +PI/2 facing alignment; desired target world orientation converted through ANIMATED target parent. Preserve local offsets/scales; map hip vertical displacement through parent inverse basis. Bake ground height on Armature translation.',
 map:MAP,clips:[],checks:{},restDeltaMaxRadians:0};
const align=q().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2),alignInv=align.clone().invert();
const armature=target.scene.getObjectByName('Armature');
const floorWitnesses=new Set();

for(const[name,file]of[['Walk','Zombie Walk.glb'],['Run','Zombie Running.glb'],['Attack','Zombie Attack.glb']]){
 const source=await loadCPU(path.join(ASSETS,'source/mixamo',file)),sourceRest=rest(source.scene);
 const sourceNodes=new Map();source.scene.traverse(n=>{if(/^mixamorig/i.test(n.name))sourceNodes.set(boneName(n.name),n);});
 const mapped=[];target.scene.traverse(n=>{const entry=Object.entries(MAP).find(([,t])=>t===n.name);if(entry&&sourceNodes.has(entry[0]))mapped.push({source:sourceNodes.get(entry[0]),target:n});});
 assert.equal(mapped.length,22);
 const srcHip=sourceNodes.get('Hips'),tgtHip=targetNodeByName.get('Hip');
 const srcLength=sourceRest.get(sourceNodes.get('LeftUpLeg').name).worldP.distanceTo(sourceRest.get(sourceNodes.get('LeftLeg').name).worldP)+sourceRest.get(sourceNodes.get('LeftLeg').name).worldP.distanceTo(sourceRest.get(sourceNodes.get('LeftFoot').name).worldP);
 const tgtLength=targetRest.get('L_Thigh').worldP.distanceTo(targetRest.get('L_Calf').worldP)+targetRest.get('L_Calf').worldP.distanceTo(targetRest.get('L_Foot').worldP);
 const ratio=tgtLength/srcLength;
 function transfer(){
  source.scene.updateMatrixWorld(true);reset(target.scene,targetRest);
  for(const pair of mapped){
   const sRest=sourceRest.get(pair.source.name),tRest=targetRest.get(pair.target.name);
   const delta=pair.source.getWorldQuaternion(q()).multiply(sRest.worldQ.clone().invert());
   const desired=align.clone().multiply(delta).multiply(alignInv).multiply(tRest.worldQ);
   const parentWorld=pair.target.parent.getWorldQuaternion(q());
   pair.target.quaternion.copy(parentWorld.invert().multiply(desired)).normalize();
   pair.target.updateMatrixWorld(true);
  }
  const vertical=(srcHip.getWorldPosition(v()).y-sourceRest.get(srcHip.name).worldP.y)*ratio;
  const parentInverse=tgtHip.parent.matrixWorld.clone().invert();
  const origin=targetRest.get('Hip').worldP.clone(),withBob=origin.clone();withBob.y+=vertical;
  tgtHip.position.copy(withBob.applyMatrix4(parentInverse));
  // The hip parent is unmoving Root; XZ world displacement is removed here.
  target.scene.updateMatrixWorld(true);
  return vertical;
 }
 // Rest -> rest must preserve every target's local rotation, including twist chains.
 transfer();for(const pair of mapped)report.restDeltaMaxRadians=Math.max(report.restDeltaMaxRadians,maxAngle(pair.target.quaternion,targetRest.get(pair.target.name).quaternion));
 const original=source.animations[0],mixer=new THREE.AnimationMixer(source.scene),action=mixer.clipAction(original).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 mixer.update(0);const cycleStart=rest(source.scene);
 const sourceForwardStart=srcHip.getWorldPosition(v()).z;
 mixer.setTime(original.duration);source.scene.updateMatrixWorld(true);
 const sourceForwardDistance=srcHip.getWorldPosition(v()).z-sourceForwardStart;
 action.reset().play();mixer.setTime(0);
 const loopClosure=name==='Walk'?.28:name==='Run'?.08:0;
 const frameCount=Math.ceil(original.duration*30)+1,times=new Float32Array(frameCount);
 const arrays=new Map(mapped.map(({target:n})=>[n.name,new Float32Array(frameCount*4)]));
 const hipPositions=new Float32Array(frameCount*3),rootPositions=new Float32Array(frameCount*3);
 const frameSummaries=[];let maxNormError=0,maxOffsetError=0,maxWorldMappingError=0;
 for(let frame=0;frame<frameCount;frame++){
  const time=frame/(frameCount-1)*original.duration;times[frame]=time;
  mixer.setTime(time);
  // Source walk has a ~5 cm foot seam after retarget. Close the final 280 ms
  // continuously against its own first pose; source files remain immutable.
  if(loopClosure&&time>original.duration-loopClosure){
   const u=THREE.MathUtils.clamp((time-(original.duration-loopClosure))/loopClosure,0,1),blend=u*u*(3-2*u);
   for(const node of sourceNodes.values()){
    node.quaternion.slerp(cycleStart.get(node.name).quaternion,blend);
    node.position.lerp(cycleStart.get(node.name).position,blend);
   }
  }
  const vertical=transfer();
  for(const pair of mapped){
   const a=arrays.get(pair.target.name);pair.target.quaternion.toArray(a,frame*4);
   maxNormError=Math.max(maxNormError,Math.abs(pair.target.quaternion.length()-1));
   const srcWorld=pair.source.getWorldQuaternion(q());
   const desired=align.clone().multiply(srcWorld.multiply(sourceRest.get(pair.source.name).worldQ.clone().invert())).multiply(alignInv).multiply(targetRest.get(pair.target.name).worldQ);
   maxWorldMappingError=Math.max(maxWorldMappingError,maxAngle(desired,pair.target.getWorldQuaternion(q())));
  }
  for(const bone of targetBones)if(bone!==tgtHip)maxOffsetError=Math.max(maxOffsetError,bone.position.distanceTo(targetRest.get(bone.name).position));
  tgtHip.position.toArray(hipPositions,frame*3);
  const rawBox=meshGround(target.scene);
  armature.position.y-=rawBox.min.y;
  armature.position.toArray(rootPositions,frame*3);
  const grounded=meshGround(target.scene),body=skin(target.scene),point=v();
  let min=Infinity,minIndex=-1;
  for(let i=0;i<body.geometry.attributes.position.count;i++){body.getVertexPosition(i,point).applyMatrix4(body.matrixWorld);if(point.y<min){min=point.y;minIndex=i;}}
  floorWitnesses.add(minIndex);
  const feet=['L_Foot','L_ToeBase','R_Foot','R_ToeBase'].map(n=>targetNodeByName.get(n).getWorldPosition(v()).multiplyScalar(runtimeScale).toArray());
  const hands=['L_Hand','R_Hand'].map(n=>targetNodeByName.get(n).getWorldPosition(v()).multiplyScalar(runtimeScale).toArray());
  frameSummaries.push({time,groundedMinY:grounded.min.y*runtimeScale,extent:grounded.getSize(v()).multiplyScalar(runtimeScale).toArray(),vertical:vertical*runtimeScale,feet,hands});
 }
 const tracks=[...arrays].map(([n,values])=>new THREE.QuaternionKeyframeTrack(`${n}.quaternion`,times,values));
 tracks.push(new THREE.VectorKeyframeTrack('Hip.position',times,hipPositions),new THREE.VectorKeyframeTrack('Armature.position',times,rootPositions));
 const clip=new THREE.AnimationClip(name,original.duration,tracks);clips.push(clip);
 report.clips.push({name,sourceFile:file,sourceSha256:hash(await fs.readFile(path.join(ASSETS,'source/mixamo',file))),duration:clip.duration,frames:frameCount,tracks:tracks.length,mappedBones:mapped.length,sourceLegLength:srcLength,targetLegLength:tgtLength,verticalScale:ratio,sourceForwardDistance,targetForwardStride:sourceForwardDistance*ratio,loopClosureSeconds:loopClosure,maxNormError,maxOffsetError,maxWorldMappingError,framesDetail:frameSummaries});
 mixer.stopAllAction();reset(source.scene,sourceRest);reset(target.scene,targetRest);
}

report.checks.restDeltaIdentity=report.restDeltaMaxRadians<1e-5;
report.checks.meshUnchanged=beforeGeometry===hash(Buffer.from(targetMesh.geometry.attributes.position.array.buffer));
report.checks.inverseBindUnchanged=beforeBind===JSON.stringify(targetMesh.skeleton.boneInverses.map(m=>m.toArray()));
report.checks.finite=clips.every(c=>c.tracks.every(t=>[...t.times,...t.values].every(Number.isFinite)));
report.checks.localOffsetsPreserved=report.clips.every(c=>c.maxOffsetError<1e-10);
report.checks.unitQuaternions=report.clips.every(c=>c.maxNormError<1e-6);
report.checks.worldRotationMapping=report.clips.every(c=>c.maxWorldMappingError<1e-5);
report.checks.groundedSamples=report.clips.every(c=>c.framesDetail.every(f=>Math.abs(f.groundedMinY)<1e-5));
report.proposedContactWitnesses=[...floorWitnesses].sort((a,b)=>a-b);
await fs.writeFile(path.join(ROOT,'artifacts/cpu-report-progress.json'),JSON.stringify(report,null,2)+'\n');
for(const[k,value]of Object.entries(report.checks))assert.equal(value,true,`${k}; rest error=${report.restDeltaMaxRadians}`);

// Append new channels to a COPY of the GLB; binary ranges for mesh/skin/texture
// remain byte-identical. Original Idle/Death clips are retained.
const{json,bin}=unpack(baselineBytes);let parts=[bin],offset=bin.length;
function append(array,width){const padding=(-offset)&3;if(padding){parts.push(Buffer.alloc(padding));offset+=padding;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});parts.push(bytes);offset+=bytes.length;const accessor=json.accessors.length;json.accessors.push({bufferView:view,componentType:5126,count:array.length/width,type:width===1?'SCALAR':`VEC${width}`,...(width===1?{min:[Math.min(...array)],max:[Math.max(...array)]}:{})});return accessor;}
for(const clip of clips){const channels=[],samplers=[];for(const track of clip.tracks){const split=track.name.lastIndexOf('.'),name=track.name.slice(0,split),property=track.name.slice(split+1);const node=json.nodes.findIndex(n=>n.name===name);assert(node>=0);const width=property==='quaternion'?4:3;const sampler=samplers.length;samplers.push({input:append(track.times,1),output:append(track.values,width),interpolation:'LINEAR'});channels.push({sampler,target:{node,path:property==='quaternion'?'rotation':'translation'}});}const index={Walk:1,Run:2,Attack:3}[clip.name];json.animations[index]={name:clip.name,channels,samplers,extras:{retarget:'Mixamo world rest delta',groundCompensation:'Armature Y baked',source:report.clips.find(c=>c.name===clip.name).sourceFile}};}
json.buffers[0].byteLength=offset;json.asset.extras={...(json.asset.extras||{}),BIPX_motion:'Mixamo zombie Walk/Run/Attack retarget; source rig/mesh unchanged'};
json.scenes[json.scene||0].extras={...(json.scenes[json.scene||0].extras||{}),bipxMotion:{version:2,source:'Local Mixamo Zombie Walk / Zombie Running / Zombie Attack',retargetedRoles:['Walk','Run','Attack'],inPlaceWorldXZ:true,walkStride:Math.abs(report.clips.find(c=>c.name==='Walk').targetForwardStride),walkCycleSeconds:4,runStride:Math.abs(report.clips.find(c=>c.name==='Run').targetForwardStride),runCycleSeconds:report.clips.find(c=>c.name==='Run').duration,grounding:'Baked Armature Y plus bounded runtime contact probes',license:'Adobe Mixamo motions; underlying Tripo mesh provenance is unchanged'}};
const output=pack(json,Buffer.concat(parts));await fs.writeFile(path.join(ROOT,'artifacts/walker-zombie-motion.glb'),output);
await fs.writeFile(path.join(ROOT,'artifacts/clips.json'),JSON.stringify(clips.map(c=>THREE.AnimationClip.toJSON(c))));
report.outputSha256=hash(output);report.outputBytes=output.length;
const reparsed=unpack(output),originalDoc=unpack(baselineBytes);
report.checks.originalBinaryPrefixPreserved=reparsed.bin.subarray(0,originalDoc.bin.length).equals(originalDoc.bin);
report.checks.meshRigMaterialsNodesUnchanged=['meshes','skins','materials','nodes','images','textures'].every(key=>JSON.stringify(reparsed.json[key])===JSON.stringify(originalDoc.json[key]));
const roundtrip=await loadCPU(path.join(ROOT,'artifacts/walker-zombie-motion.glb'));
const roundtripRest=rest(roundtrip.scene),rtMixer=new THREE.AnimationMixer(roundtrip.scene);
report.roundtrip=[];
for(const name of ['Walk','Run','Attack']){
 reset(roundtrip.scene,roundtripRest);rtMixer.stopAllAction();
 const clip=roundtrip.animations.find(c=>c.name===name),action=rtMixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
 let maxGroundError=0,maxExtent=0,minGround=Infinity,maxGround=-Infinity;
 const count=Math.ceil(clip.duration*120)+1;let firstPose,lastPose;
 for(let frame=0;frame<count;frame++){
  rtMixer.setTime(frame/(count-1)*clip.duration);
  const box=meshGround(roundtrip.scene);const minimum=box.min.y*runtimeScale;
  maxGroundError=Math.max(maxGroundError,Math.abs(minimum));minGround=Math.min(minGround,minimum);maxGround=Math.max(maxGround,minimum);
  maxExtent=Math.max(maxExtent,...box.getSize(v()).multiplyScalar(runtimeScale).toArray());
  const body=skin(roundtrip.scene);const pose=['L_Hand','R_Hand','L_Foot','R_Foot'].map(n=>roundtrip.scene.getObjectByName(n).getWorldPosition(v()).multiplyScalar(runtimeScale).toArray());
  if(frame===0)firstPose=pose;if(frame===count-1)lastPose=pose;
 }
 const seam=firstPose.map((p,i)=>Math.hypot(...p.map((n,k)=>n-lastPose[i][k])));
 report.roundtrip.push({name,samples:count,maxGroundError,minGround,maxGround,maxExtent,endpointJointDistanceMeters:seam});
}
report.checks.roundtripInterpolationGround=report.roundtrip.every(c=>c.maxGroundError<.02);
report.checks.roundtripExtent=report.roundtrip.every(c=>c.maxExtent<3.2);
// World heading is intentionally unchanged: Root and top-level orientation
// have no animation channel in the new clips; only Armature Y translates.
report.checks.rootHeadingPreserved=clips.every(c=>!c.tracks.some(t=>t.name==='Root.quaternion'||t.name==='Armature.quaternion'));
for(const[k,value]of Object.entries(report.checks))assert.equal(value,true,k);
await fs.writeFile(path.join(ROOT,'artifacts/cpu-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:report.checks,roundtrip:report.roundtrip,restDeltaMaxRadians:report.restDeltaMaxRadians,outputSha256:report.outputSha256,clips:report.clips.map(({framesDetail,...c})=>({...c,maxFootHeight:Math.max(...framesDetail.flatMap(f=>f.feet.map(p=>p[1]))),maxExtent:Math.max(...framesDetail.flatMap(f=>f.extent))}))},null,2));

if(process.argv.includes('--install')){
 const probesPath=path.join(ASSETS,'ground-probes.json'),probes=JSON.parse(await fs.readFile(probesPath));
 probes.zombie.vertexIndices=[...new Set([...probes.zombie.vertexIndices,...report.proposedContactWitnesses])].sort((a,b)=>a-b);
 probes.zombie.retargetAdditionalCoverage='Mixamo Zombie Walk/Running/Attack sampled minimum vertices';
 await fs.writeFile(probesPath,JSON.stringify(probes,null,2)+'\n');
 await fs.writeFile(path.join(ASSETS,'zombie.glb'),output);
 const provenancePath=path.join(ASSETS,'provenance.json'),provenance=JSON.parse(await fs.readFile(provenancePath));
 provenance.derivation='Pillow LANCZOS1024 JPEG90; geometry/skin preserved. Walker Walk/Run/Attack retargeted from local Mixamo files; Idle/Death preserved.';
 const entry=provenance.entries.find(e=>e.id==='zombie');
 Object.assign(entry,{runtimeSha256:report.outputSha256,runtimeBytes:report.outputBytes,preservedPreviousRuntime:{path:'source/zombie-pre-mixamo.glb',sha256:hash(baselineBytes)},motionSources:report.clips.map(c=>({role:c.name,path:'source/mixamo/'+c.sourceFile,sha256:c.sourceSha256,duration:c.duration})),motionLicense:'Adobe Mixamo motion files copied from user local quake project; provider use terms apply. This does not change or establish Tripo mesh commercial license.'});
 await fs.writeFile(provenancePath,JSON.stringify(provenance,null,2)+'\n');
}
