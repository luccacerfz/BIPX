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
const base='/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX',sourceBytes=await fs.readFile(`${base}/assets/models/monsters/zombie.glb`);
const hash=b=>createHash('sha256').update(b).digest('hex');
const report={scope:'Installed controller CPU correctness. No native rendering or artistic approval.',baseline:{glb:hash(sourceBytes),controller:hash(await fs.readFile(`${base}/src/assets/monster-library.js`))},checks:{},lateJoins:[],events:[],bounds:[]};
const library=await loadMonsterLibrary({THREE}),scene=new THREE.Scene();
function actor(){return library.create('zombie',{parent:scene,height:2.55});}
function pose(a){a.root.updateMatrixWorld(true);let mesh;a.model.traverse(o=>{if(o.isSkinnedMesh){mesh=o;o.skeleton.update();}});const p=new THREE.Vector3(),box=new THREE.Box3();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);box.expandByPoint(p);}return{bones:mesh.skeleton.bones.map(b=>b.getWorldPosition(new THREE.Vector3()).toArray()),minY:box.min.y,size:box.getSize(new THREE.Vector3()).toArray()};}
function stepFor(a,t,state={}){while(t>1e-10){const dt=Math.min(1/120,t);a.update(dt,state);t-=dt;}}
const duration=.88,impactPhase=.523;
report.clip=library.stats.prototypes.zombie.clips.find(c=>c.name==='Attack');
for(const phase of [.1,.35,.523,.8,.99]){
 const continuous=actor(),late=actor();continuous.attack({id:1,elapsed:0,duration,impactPhase});stepFor(continuous,phase*duration);
 late.syncAttack({id:1,elapsed:phase*duration,duration,impactPhase});
 const a=pose(continuous),b=pose(late),maxBoneDistance=Math.max(...a.bones.map((p,i)=>Math.hypot(...p.map((v,k)=>v-b.bones[i][k]))));
 report.lateJoins.push({phase,maxBoneDistance,continuous:structuredClone(continuous.stats.attack),late:structuredClone(late.stats.attack),floor:[a.minY,b.minY]});continuous.dispose();late.dispose();
}
const a=actor();a.attack({id:10,elapsed:.2,duration,impactPhase});
const starts=a.stats.attack.startCount;
for(let i=0;i<12;i++)a.update(1/60,{attack:{id:10,elapsed:.2,duration,impactPhase}});
report.checks.repeatedSnapshotDoesNotRestart=a.stats.attack.startCount===starts;
report.checks.repeatedSnapshotStillPredicts=Math.abs(a.stats.attack.elapsed-.4)<1e-8;
const before=a.stats.attack.elapsed;a.syncAttack({id:10,elapsed:.1,duration,impactPhase});report.checks.staleElapsedDoesNotRewind=a.stats.attack.elapsed===before;
a.syncAttack({id:11,elapsed:.3,duration,impactPhase});a.syncAttack({id:10,elapsed:.5,duration,impactPhase});report.checks.oldSequenceIgnored=a.stats.attack.id===11;
a.syncAttack({id:11,active:false});a.syncAttack({id:11,elapsed:.4,duration,impactPhase});report.checks.cancelledNeverRestarts=!a.stats.attack.active&&a.stats.currentClip!=='Attack';
a.syncAttack({id:12,elapsed:1.5,duration,impactPhase});report.checks.expiredNeverStarts=!a.stats.attack.active&&a.stats.currentClip!=='Attack';
a.syncAttack({id:12,elapsed:.2,duration,impactPhase});report.checks.expiredIdNeverRestarts=!a.stats.attack.active;
a.root.position.set(3,0,5);a.root.userData.health=73;const position=a.root.position.clone();
a.syncAttack({id:15,active:false});a.syncAttack({id:15,elapsed:.2,duration,impactPhase});report.checks.cancelBeforeAttachBlocksReplay=a.stats.attack.id===15&&!a.stats.attack.active;
report.checks.cancelPreservesRootState=a.root.position.equals(position)&&a.root.userData.health===73;
a.syncAttack({id:16,elapsed:.88,duration,impactPhase,active:false});report.checks.completedSnapshotKeepsFullPhase=a.stats.attack.normalizedTime===1&&!a.stats.attack.cancelled;
a.root.position.set(0,0,0);
a.reset();a.update(0,{speed:3.3,attack:{id:1,phase:.523,duration,impactPhase}});report.checks.phaseAlternative=Math.abs(a.stats.attack.normalizedTime-.523)<1e-10;
report.checks.impactPhaseHonest=a.stats.attack.impactReached;
const frozen=a.stats.attack.elapsed;a.update(0);report.checks.dtZeroFrozen=a.stats.attack.elapsed===frozen;
a.update(.01,{dead:true});report.checks.deathCancels=!a.stats.attack.active&&a.stats.currentClip==='Death';
a.reset();report.checks.resetClearsAttack=a.stats.attack===null;
for(let i=0;i<180;i++){
 if(i===30)a.attack({id:1,duration,impactPhase});
 if(i===70)a.attack({id:2,elapsed:.31,duration,impactPhase});
 a.update(1/120,{speed:3.3});report.bounds.push(pose(a));
}
stepFor(a,1,{speed:3.3});report.checks.returnsToLocomotion=!a.stats.attack.active&&a.stats.currentClip==='Run';a.dispose();
for(const limit of [20,10]){const actors=Array.from({length:limit},()=>actor());actors.forEach((a,i)=>{a.syncAttack({id:1,phase:i/limit,duration,impactPhase});a.update(.01);});report.events.push({limit,created:actors.length,active:library.stats.activeActors});for(const a of actors)a.dispose();}
for(const id of ['brute','lich']){const actor=library.create(id,{parent:scene});const duration=actor.stats.clips.find(c=>c.name==='Attack').duration;actor.attack({duration:.65});stepFor(actor,.325);report.events.push({legacy:id,duration,clip:actor.stats.currentClip,time:actor.stats.animationTime,phaseApiAccepted:actor.syncAttack({id:1,elapsed:.2})});actor.dispose();}
report.checks.legacyUnchanged=report.events.filter(e=>e.legacy).every(e=>e.clip==='Attack'&&Math.abs(e.time/e.duration-.5)<1e-6&&!e.phaseApiAccepted);
report.checks.poolCountUnchanged=report.events.filter(e=>e.limit).every(e=>e.active===e.limit);
report.checks.exactCropDuration=Math.abs(report.clip.duration-4/3)<1e-10;
report.checks.latePoseMatches=report.lateJoins.every(j=>j.maxBoneDistance<.0001);
report.checks.finite=report.bounds.every(b=>[b.minY,...b.size,...b.bones.flat()].every(Number.isFinite));
report.maxFloorError=Math.max(...report.bounds.map(b=>Math.abs(b.minY)));report.checks.grounded=report.maxFloorError<.025;
report.bounds=report.bounds.map(({bones,...b})=>b);
library.dispose();report.checks.cleanup=library.stats.activeActors===0&&!library.stats.loaded;
report.checks.repoUnchanged=hash(await fs.readFile(`${base}/assets/models/monsters/zombie.glb`))===report.baseline.glb&&hash(await fs.readFile(`${base}/src/assets/monster-library.js`))===report.baseline.controller;
await fs.mkdir(path.resolve('output/monster-phase'),{recursive:true});
await fs.writeFile(path.resolve('output/monster-phase/controller-cpu.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks,lateJoins:report.lateJoins.map(j=>({phase:j.phase,maxBoneDistance:j.maxBoneDistance})),maxFloorError:report.maxFloorError,clip:report.clip},null,2));
for(const [key,value]of Object.entries(report.checks))assert.equal(value,true,key);
