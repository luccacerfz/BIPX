// Brute v4 staging. Retarget primitives copied from preserved gesture pipeline.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../src/assets/vendor/GLTFLoader.js';

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

export {THREE,hash,MAP,unpack,pack,loadCPU,rest,reset,skin,meshGround,maxAngle,appendClip,q,v};
