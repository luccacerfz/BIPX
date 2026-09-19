import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,hash,unpack,loadCPU,skin,meshGround,q,v,maxAngle} from './brute-motion-review-v5-utils.mjs';
const base='output/brute-motion-v5',dir=`${base}/candidate-07`,file=`${dir}/brute.glb`;
const report=JSON.parse(fs.readFileSync(`${dir}/report.json`)),original=fs.readFileSync('assets/models/monsters/brute.glb'),candidate=fs.readFileSync(file);
const a=unpack(original),b=unpack(candidate);
assert(b.bin.subarray(0,a.bin.length).equals(a.bin));
for(const k of ['nodes','skins','meshes','materials','images','textures','samplers'])assert.deepEqual(b.json[k],a.json[k]);
for(const i of [0,1,2,4])assert.deepEqual(b.json.animations[i],a.json.animations[i]);
const g=await loadCPU(file),model=g.scene,body=skin(model),bones=body.skeleton.bones,mixer=new THREE.AnimationMixer(model);
const attack=mixer.clipAction(g.animations[3]).setLoop(THREE.LoopOnce,1);attack.clampWhenFinished=true;
const idle=mixer.clipAction(g.animations[0]);idle.play();mixer.update(0);model.updateMatrixWorld(true);body.skeleton.update();
const {scale,rawFloor:floor,pad}=report;
function vertex(i){const p=body.getVertexPosition(i,v()).applyMatrix4(body.matrixWorld);p.y-=floor;return p.multiplyScalar(scale);}
const restVertices=Array.from({length:body.geometry.attributes.position.count},(_,i)=>vertex(i));
const restQ=new Map(bones.map(b=>[b.name,b.quaternion.clone()]));
const attr=body.geometry.attributes,patches={};
for(const s of ['L','R']){
 const ids=[];for(let i=0;i<attr.skinIndex.count;i++){let weight=0;for(let j=0;j<4;j++)if([`${s}_Foot`,`${s}_ToeBase`].includes(bones[attr.skinIndex.getComponent(i,j)]?.name))weight+=attr.skinWeight.getComponent(i,j);if(weight>.65)ids.push(i);}
 const minimum=Math.min(...ids.map(i=>restVertices[i].y));patches[s]={minimum,all:ids,patch:ids.filter(i=>restVertices[i].y<minimum+.012)};
}
const probes=JSON.parse(fs.readFileSync('assets/models/monsters/ground-probes.json')).brute.vertexIndices;
const samples=[];let firstError=0,lastError=0,maxQnorm=0,maxBoneAngleStep=0,previousQ=null;
for(let f=0;f<=288;f++){
 const time=f/240;mixer.stopAllAction();attack.reset().play();mixer.setTime(Math.min(time,g.animations[3].duration));model.updateMatrixWorld(true);body.skeleton.update();
 const positions=Array.from({length:attr.position.count},(_,i)=>vertex(i));
 if(f===0)firstError=Math.max(...positions.map((p,i)=>p.distanceTo(restVertices[i])));
 if(f===288)lastError=Math.max(...positions.map((p,i)=>p.distanceTo(restVertices[i])));
 const localQ=bones.map(b=>b.quaternion.clone());for(let i=0;i<bones.length;i++){maxQnorm=Math.max(maxQnorm,Math.abs(localQ[i].length()-1));if(previousQ)maxBoneAngleStep=Math.max(maxBoneAngleStep,maxAngle(localQ[i],previousQ[i]));}previousQ=localQ;
 let contactDepth=-Infinity,witness=null;for(const id of report.handIndices){const p=positions[id];if(Math.abs(p.y-pad.centerY)<=pad.height/2&&Math.abs(p.z-pad.centerZ)<=pad.width/2&&p.x-pad.frontX>contactDepth){contactDepth=p.x-pad.frontX;witness={vertex:id,position:p.toArray()};}}
 const probeMin=Math.min(...probes.map(i=>positions[i].y));
 samples.push({time,contactDepth:Number.isFinite(contactDepth)?contactDepth:null,witness,fullMeshMin:Math.min(...positions.map(p=>p.y)),runtimeProbeMin:probeMin,feet:Object.fromEntries(Object.entries(patches).map(([s,p])=>[s,{minY:Math.min(...p.all.map(i=>positions[i].y)),patchMaxXZ:Math.max(...p.patch.map(i=>Math.hypot(positions[i].x-restVertices[i].x,positions[i].z-restVertices[i].z))),patchY:p.patch.map(i=>positions[i].y)}]))});
}
assert(firstError<2e-6&&lastError<2e-6);assert(maxQnorm<1e-6);
const contacts=samples.filter(s=>s.contactDepth!==null&&s.contactDepth>=0);
assert(contacts.length>0&&contacts[0].time>.60&&contacts[0].time<.70);
const marker=contacts[0];
const preservation=JSON.parse(fs.readFileSync(`${base}/preserved-before.json`));for(const [file,h]of Object.entries(preservation))assert.equal(hash(fs.readFileSync(file)),h,file);
const result={scope:'CPU structural/calibration/contact fixture, no gameplay/AAA',candidateHash:hash(candidate),preservedCount:Object.keys(preservation).length,firstMeshErrorMeters:firstError,lastMeshErrorMeters:lastError,maxQuaternionNormError:maxQnorm,maxBoneStepAt240HzDegrees:maxBoneAngleStep*180/Math.PI,patches,contact:{firstAt:marker.time,lastAt:contacts.at(-1).time,maximumPenetration:Math.max(...contacts.map(c=>c.contactDepth)),witness:marker.witness,markerStatus:'CPU contact candidate, pending native target pose'},support:Object.fromEntries(Object.keys(patches).map(s=>[s,{floorRange:[Math.min(...samples.map(f=>f.feet[s].minY)),Math.max(...samples.map(f=>f.feet[s].minY))],patchMaxXZ:Math.max(...samples.map(f=>f.feet[s].patchMaxXZ))}])),probeCorrectionRange:[Math.min(...samples.map(s=>s.runtimeProbeMin)),Math.max(...samples.map(s=>s.runtimeProbeMin))],samples};
fs.writeFileSync(`${dir}/verification.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,samples:undefined,patches:undefined},null,2));
