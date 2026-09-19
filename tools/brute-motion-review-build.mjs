// Brute v4 staging. Retarget primitives copied from preserved gesture pipeline.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../src/assets/vendor/GLTFLoader.js';
const BASE=path.resolve('output/brute-motion-v4');
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

const provenance=JSON.parse(await fs.readFile(path.join(BASE,'provenance.json')));
const sourceBytes=await fs.readFile(path.join(BASE,'source/brute-baseline.glb'));
assert.equal(hash(sourceBytes),'d1d58b1ae86045d9fa39dba9b4e87a0bd6d1a66b347d74624cf8095ce208c02a');
const configurations=[{id:'swipe',file:'mutant swipe.glb'},{id:'frontal',file:'zombie attack 2.glb'}];
const outcomes=[];
async function preserveWrite(file,bytes){
  try{assert.equal(hash(await fs.readFile(file)),hash(Buffer.from(bytes)),`Existing artifact differs: preserve it before revising ${file}`);}
  catch(e){if(e.code!=='ENOENT')throw e;await fs.writeFile(file,bytes);}
}
function appendClip(baseline,clip,metadata){
  const {json,bin}=unpack(baseline),parts=[bin];let offset=bin.length;
  function append(array,width){const padding=(-offset)&3;if(padding){parts.push(Buffer.alloc(padding));offset+=padding;}
    const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),view=json.bufferViews.length;
    json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});parts.push(bytes);offset+=bytes.length;
    const accessor=json.accessors.length;json.accessors.push({bufferView:view,componentType:5126,count:array.length/width,type:width===1?'SCALAR':`VEC${width}`,...(width===1?{min:[Math.min(...array)],max:[Math.max(...array)]}:{})});return accessor;}
  const channels=[],samplers=[];
  for(const track of clip.tracks){const split=track.name.lastIndexOf('.'),name=track.name.slice(0,split),property=track.name.slice(split+1),node=json.nodes.findIndex(n=>n.name===name);assert(node>=0);
    const index=samplers.length;samplers.push({input:append(track.times,1),output:append(track.values,property==='quaternion'?4:3),interpolation:'LINEAR'});channels.push({sampler:index,target:{node,path:property==='quaternion'?'rotation':'translation'}});}
  json.animations[3]={name:'Attack',channels,samplers,extras:metadata};json.buffers[0].byteLength=offset;
  json.scenes[json.scene||0].extras={...(json.scenes[json.scene||0].extras||{}),bruteMotionReview:{...metadata,stagingOnly:true}};
  const output=pack(json,Buffer.concat(parts)),parsed=unpack(output),original=unpack(baseline);
  assert(parsed.bin.subarray(0,original.bin.length).equals(original.bin));
  for(const key of ['nodes','skins','meshes','materials','images','textures','samplers'])assert.deepEqual(parsed.json[key],original.json[key],key);
  for(const i of [0,1,2,4])assert.deepEqual(parsed.json.animations[i],original.json.animations[i],`clip${i}`);
  return output;
}

for(const configuration of configurations){
  const folder=path.join(BASE,configuration.id);await fs.mkdir(folder,{recursive:true});
  const target=await loadCPU(path.join(BASE,'source/brute-baseline.glb')),targetRest=rest(target.scene),mesh=skin(target.scene);
  const source=await loadCPU(path.join(BASE,'source',configuration.file)),sourceRest=rest(source.scene);
  const sourceNodes=new Map();source.scene.traverse(n=>{if(/^mixamorig/i.test(n.name))sourceNodes.set(boneName(n.name),n);});
  const mapped=[];target.scene.traverse(n=>{const entry=Object.entries(MAP).find(([,t])=>t===n.name);if(entry&&sourceNodes.has(entry[0]))mapped.push({source:sourceNodes.get(entry[0]),target:n});});
  assert.equal(mapped.length,22);
  const nodes=Object.fromEntries(mapped.map(p=>[p.target.name,p.target])),height=meshGround(target.scene).getSize(v()).y,scale=3.3/height;
  const legLength=(states,names)=>states.get(names[0]).worldP.distanceTo(states.get(names[1]).worldP)+states.get(names[1]).worldP.distanceTo(states.get(names[2]).worldP);
  const ratio=legLength(targetRest,['L_Thigh','L_Calf','L_Foot'])/legLength(sourceRest,['LeftUpLeg','LeftLeg','LeftFoot'].map(n=>sourceNodes.get(n).name));
  const align=q().setFromAxisAngle(v().set(0,1,0),Math.PI/2),alignInv=align.clone().invert(),armature=target.scene.getObjectByName('Armature');
  function transfer(){
    source.scene.updateMatrixWorld(true);reset(target.scene,targetRest);
    // Full source motion, no hip counter-rotation, pinned feet or IK.
    for(const pair of mapped){const delta=pair.source.getWorldQuaternion(q()).multiply(sourceRest.get(pair.source.name).worldQ.clone().invert());
      const desired=align.clone().multiply(delta).multiply(alignInv).multiply(targetRest.get(pair.target.name).worldQ);
      pair.target.quaternion.copy(pair.target.parent.getWorldQuaternion(q()).invert().multiply(desired)).normalize();pair.target.updateMatrixWorld(true);}
    const vertical=(sourceNodes.get('Hips').getWorldPosition(v()).y-sourceRest.get(sourceNodes.get('Hips').name).worldP.y)*ratio;
    const position=targetRest.get('Hip').worldP.clone();position.y+=vertical;
    nodes.Hip.position.copy(position.applyMatrix4(nodes.Hip.parent.matrixWorld.clone().invert()));target.scene.updateMatrixWorld(true);
  }
  transfer();const restError=Math.max(...mapped.map(p=>maxAngle(p.target.quaternion,targetRest.get(p.target.name).quaternion)));assert(restError<1e-5);
  const original=source.animations[0],mixer=new THREE.AnimationMixer(source.scene),action=mixer.clipAction(original).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const count=Math.ceil(original.duration*30)+1,times=new Float32Array(count),rotations=new Map(mapped.map(p=>[p.target.name,new Float32Array(count*4)]));
  const hips=new Float32Array(count*3),roots=new Float32Array(count*3),frames=[];let normError=0,offsetError=0;
  for(let i=0;i<count;i++){
    const time=i/(count-1)*original.duration;times[i]=time;mixer.setTime(time);transfer();
    for(const pair of mapped){pair.target.quaternion.toArray(rotations.get(pair.target.name),i*4);normError=Math.max(normError,Math.abs(pair.target.quaternion.length()-1));}
    for(const bone of mesh.skeleton.bones)if(bone!==nodes.Hip)offsetError=Math.max(offsetError,bone.position.distanceTo(targetRest.get(bone.name).position));
    nodes.Hip.position.toArray(hips,i*3);const rawBox=meshGround(target.scene);armature.position.y-=rawBox.min.y;armature.position.toArray(roots,i*3);const box=meshGround(target.scene);
    const joints=Object.fromEntries(Object.keys(nodes).map(name=>[name,nodes[name].getWorldPosition(v()).multiplyScalar(scale).toArray()]));
    frames.push({time,phase:time/original.duration,joints,height:box.getSize(v()).y*scale,groundCorrection:-rawBox.min.y*scale});
  }
  assert(normError<1e-6&&offsetError<1e-10);
  const tracks=[...rotations].map(([name,values])=>new THREE.QuaternionKeyframeTrack(`${name}.quaternion`,times,values));
  tracks.push(new THREE.VectorKeyframeTrack('Hip.position',times,hips),new THREE.VectorKeyframeTrack('Armature.position',times,roots));
  const clip=new THREE.AnimationClip('Attack',original.duration,tracks);assert(tracks.every(t=>[...t.times,...t.values].every(Number.isFinite)));
  const metadata={id:`brute-v4-${configuration.id}`,source:configuration.file,method:'Full world rest delta; free legs; in-place hipXZ; baked whole-body groundY',sourceDuration:original.duration};
  const output=appendClip(sourceBytes,clip,metadata);await preserveWrite(path.join(folder,'brute.glb'),output);
  const loaded=await loadCPU(path.join(folder,'brute.glb')),body=skin(loaded.scene),rt=new THREE.AnimationMixer(loaded.scene),rtClip=loaded.animations[3];
  const act=rt.clipAction(rtClip).setLoop(THREE.LoopOnce,1);act.clampWhenFinished=true;act.play();
  const phases=[0,.15,.3,.45,.6,.8,1],poses=[];let floorMin=Infinity,floorMax=-Infinity,maxExtent=0;
  for(let i=0;i<=Math.ceil(original.duration*60);i++){
    const t=i/Math.ceil(original.duration*60)*original.duration;rt.setTime(t);const box=meshGround(loaded.scene);floorMin=Math.min(floorMin,box.min.y*scale);floorMax=Math.max(floorMax,box.min.y*scale);maxExtent=Math.max(maxExtent,...box.getSize(v()).multiplyScalar(scale).toArray());
  }
  for(const phase of phases){act.reset().play();rt.setTime(phase*rtClip.duration);loaded.scene.updateMatrixWorld(true);body.skeleton.update();
    const positions=[];for(let i=0;i<body.geometry.attributes.position.count;i++){const p=body.getVertexPosition(i,v()).applyMatrix4(body.matrixWorld).multiplyScalar(scale);assert(p.toArray().every(Number.isFinite));positions.push(p.toArray().map(x=>Math.round(x*1e5)/1e5));}
    poses.push({phase,positions});}
  await preserveWrite(path.join(folder,'cpu-poses.json'),JSON.stringify({label:'CPU skinned-pose geometry; not native/gameplay',indices:Array.from(body.geometry.index.array),poses}));
  const reach=side=>frames.reduce((a,b)=>b.joints[side+'_Hand'][0]>a.joints[side+'_Hand'][0]?b:a);
  const report={...metadata,sha256:hash(output),sourceSha256:hash(await fs.readFile(path.join(BASE,'source',configuration.file))),restError,normError,offsetError,runtimeHeight:3.3,scale,
    structural:{binaryPrefix:true,meshSkinNodesMaterialsBindsUnchanged:true,otherFourClipsUnchanged:true,finite:true,headingRootUnchanged:true,legIK:false,legFreeze:false},
    limits:'No artistic approval; raw full-take comparison before timing selection',floorMin,floorMax,maxExtent,
    minBodyHeight:Math.min(...frames.map(f=>f.height)),maxBodyHeight:Math.max(...frames.map(f=>f.height)),
    maxForwardHand:{left:{time:reach('L').time,phase:reach('L').phase,position:reach('L').joints.L_Hand},right:{time:reach('R').time,phase:reach('R').phase,position:reach('R').joints.R_Hand}},frames};
  await preserveWrite(path.join(folder,'cpu-report.json'),JSON.stringify(report,null,2)+'\n');outcomes.push({...report,frames:undefined});
}
for(const[file,expected]of Object.entries(provenance.preservedHashes))assert.equal(hash(await fs.readFile(file)),expected,`Preserved file ${file}`);
for(const[file,expected]of Object.entries(provenance.historicalSources))assert.equal(hash(await fs.readFile(file)),expected,`Historical source ${file}`);
await preserveWrite(path.join(BASE,'initial-comparison.json'),JSON.stringify(outcomes,null,2)+'\n');console.log(JSON.stringify(outcomes,null,2));
