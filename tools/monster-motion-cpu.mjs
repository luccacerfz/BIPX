import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';

// Exercise the actual controller on CPU. Remove image references only from
// fetch's in-memory response; disk assets and all geometry/skin data stay intact.
const nativeFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 const location=new URL(url);if(location.protocol!=='file:')return nativeFetch(url);
 let bytes=await fs.readFile(location);
 if(location.pathname.endsWith('.glb')){
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
  for(const m of json.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
  delete json.images;delete json.textures;delete json.samplers;
  let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((-text.length)&3,32)]);
  const head=Buffer.alloc(20);head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+text.length+bin.length,8);head.writeUInt32LE(text.length,12);head.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);bytes=Buffer.concat([head,text,bh,bin]);
 }
 return new Response(bytes,{status:200,headers:{'Content-Length':String(bytes.length)}});
};
globalThis.ProgressEvent??=class ProgressEvent extends Event{constructor(type,options={}){super(type);Object.assign(this,options);}};
const {loadMonsterLibrary}=await import('../src/assets/monster-library.js');
const library=await loadMonsterLibrary({THREE}),scene=new THREE.Scene(),point=new THREE.Vector3();
const report={scope:'Actual controller CPU test. Low-toe drift proxy is not a planted-contact solver or artistic approval.',checks:{},gaits:[],blends:[],hashes:{}};
function sample(a){a.root.updateMatrixWorld(true);const box=new THREE.Box3();a.model.traverse(o=>{if(!o.isSkinnedMesh)return;o.skeleton.update();for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,point).applyMatrix4(o.matrixWorld);box.expandByPoint(point);}});return{minY:box.min.y,extent:box.getSize(new THREE.Vector3()).toArray(),feet:['L_ToeBase','R_ToeBase'].map(n=>a.model.getObjectByName(n).getWorldPosition(new THREE.Vector3()).toArray())};}
const quantile=(values,q)=>values.length?[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)]:null;
for(const {height,speed,label} of [{height:2.55,speed:.5,label:'slow walker'},{height:2.55,speed:3.3,label:'game zombie'},{height:2.3,speed:6.1,label:'game runner'}]){
 const actor=library.create('zombie',{parent:scene,height});for(let i=0;i<30;i++)actor.update(1/60,{speed});
 const rate=actor.stats.animationTimeScale,clip=actor.stats.currentClip,duration=actor.stats.clips.find(c=>c.name===clip).duration/rate;
 const count=Math.ceil(duration*2*120),dt=duration*2/count,frames=[];
 for(let i=0;i<count;i++){actor.root.position.z-=speed*dt;actor.update(dt,{speed});frames.push(sample(actor));}
 const drifts=[];for(let i=1;i<frames.length;i++)for(let f=0;f<2;f++){const a=frames[i-1].feet[f],b=frames[i].feet[f];if(a[1]<.075&&b[1]<.075&&Math.abs(b[1]-a[1])/dt<.35)drifts.push(Math.hypot(b[0]-a[0],b[2]-a[2])/dt);}
 report.gaits.push({label,height,speed,clip,timeScale:rate,strideMeters:actor.stats.strideMeters[clip],nominalSpeed:actor.stats.nominalGaitSpeed[clip],speedMismatch:actor.stats.gaitSpeedMismatch,samples:count,maxFloorError:Math.max(...frames.map(f=>Math.abs(f.minY))),lowToeSamples:drifts.length,lowToeDriftMedianMetersPerSecond:quantile(drifts,.5),lowToeDriftP90MetersPerSecond:quantile(drifts,.9),maxExtent:Math.max(...frames.flatMap(f=>f.extent))});
 actor.dispose();
}
for(const label of ['Idle-Walk-Attack-Run','Run-Attack-Run','Run-Death-Reset']){
 const a=library.create('zombie',{parent:scene,height:2.55}),frames=[];
 for(let i=0;i<360;i++){
  let speed=label.startsWith('Idle')?(i<60?0:i<120?.5:3.3):3.3;
  if(i===120&&label.includes('Attack'))a.attack({duration:.65});
  const dead=label.includes('Death')&&i>=120&&i<300;
  if(i===300&&label.includes('Death'))a.reset();
  a.update(1/60,{speed,dead});frames.push({...sample(a),clip:a.stats.currentClip,time:a.stats.animationTime});
 }
 report.blends.push({label,samples:frames.length,maxFloorError:Math.max(...frames.map(f=>Math.abs(f.minY))),maxExtent:Math.max(...frames.flatMap(f=>f.extent)),finite:frames.every(f=>[f.minY,...f.extent,...f.feet.flat()].every(Number.isFinite)),clipsObserved:[...new Set(frames.map(f=>f.clip))]});a.dispose();
}
report.checks.attackFullPreserved=library.stats.prototypes.zombie.attackWindow.fullDuration===2.625;
report.checks.attackWindow=Math.abs(library.stats.prototypes.zombie.clips.find(c=>c.name==='Attack').duration-4/3)<1e-10;
report.checks.rateBounded=report.gaits.every(g=>g.timeScale<=2);
report.checks.correctRoles=report.gaits.map(g=>g.clip).join(',')==='Walk,Run,Run';
report.checks.grounded=report.gaits.every(g=>g.maxFloorError<.025)&&report.blends.every(b=>b.maxFloorError<.025);
report.checks.blendsFinite=report.blends.every(b=>b.finite&&b.maxExtent<4);
library.dispose();report.checks.cleanup=library.stats.activeActors===0&&!library.stats.loaded;
for(const file of ['src/assets/monster-library.js','assets/models/monsters/zombie.glb'])report.hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
const out=path.resolve('output/monster-motion/artifacts/controller-cpu.json');await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
for(const [key,value]of Object.entries(report.checks))assert.equal(value,true,key);
