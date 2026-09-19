import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import {installCPUFetch} from './enemy-locomotion-utils.mjs';
installCPUFetch();
const {loadEnemyLibrary}=await import('../src/assets/enemy-library.js');
const library=await loadEnemyLibrary({THREE}),scene=new THREE.Scene();
const report={scope:'CPU actual Orc controller; low toe drift is a contact proxy, not visual approval',checks:{},gaits:[],transitions:[]};
const q=(xs,n)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*n)]:null;
for(const speed of [.35,1,1.8,2.4,3.7,5.5]){
 const parent=new THREE.Group();scene.add(parent);const actor=library.create('orcPeon',{parent,height:2.5});
 for(let i=0;i<90;i++){parent.position.z-=speed/120;actor.update(1/120,{speed,velocity:{x:0,z:-speed}});}
 const clip=actor.stats.currentClip,rate=actor.stats.animationTimeScale,duration=actor.stats.clips.find(c=>c.name===clip).duration/rate;
 const count=Math.ceil(duration*2*120),dt=duration*2/count,frames=[];
 for(let i=0;i<count;i++){
  parent.position.z-=speed*dt;actor.update(dt,{speed,velocity:{x:0,z:-speed}});scene.updateMatrixWorld(true);
  const body=actor.model.getObjectByName('OrcBody');body.skeleton.update();
  const box=new THREE.Box3().setFromObject(body,true);
  frames.push({floor:box.min.y,feet:['L_ToeBase','R_ToeBase'].map(n=>actor.model.getObjectByName(n).getWorldPosition(new THREE.Vector3()).toArray())});
 }
 const minToe=[0,1].map(f=>Math.min(...frames.map(x=>x.feet[f][1]))),drift=[];
 for(let i=1;i<frames.length;i++)for(let f=0;f<2;f++){
  const a=frames[i-1].feet[f],b=frames[i].feet[f];
  if(Math.max(a[1],b[1])<minToe[f]+.065&&Math.abs(a[1]-b[1])/dt<.4)drift.push(Math.hypot(a[0]-b[0],a[2]-b[2])/dt);
 }
 report.gaits.push({speed,clip,timeScale:rate,nominalSpeed:actor.stats.nominalGaitSpeed[clip],gaitSpeedMismatch:actor.stats.gaitSpeedMismatch,samples:count,minFloor:Math.min(...frames.map(x=>x.floor)),maxFloor:Math.max(...frames.map(x=>x.floor)),minToe,contactProxySamples:drift.length,footDriftMedianMps:q(drift,.5),footDriftP90Mps:q(drift,.9)});
 actor.dispose();scene.remove(parent);
}
const actor=library.create('orcPeon',{parent:scene,height:2.5});const clips=new Set();let finite=true;
for(let i=0;i<480;i++){let speed=i<60?0:i<180?(i-60)/60:i<360?3.7:0;if(i===270)actor.attack({duration:.65});const dead=i>=420;actor.update(1/60,{speed,dead});clips.add(actor.stats.currentClip);actor.root.updateMatrixWorld(true);finite&&=actor.model.getObjectByName('L_Foot').matrixWorld.elements.every(Number.isFinite);}
actor.reset();report.transitions={observed:[...clips],finite,resetClip:actor.stats.currentClip};actor.dispose();
report.checks.realRunSelected=report.gaits.filter(g=>g.speed>=2.4).every(g=>g.clip==='Run');report.checks.walkNotOvercranked=report.gaits.filter(g=>g.clip==='Walk').every(g=>g.timeScale<=1.5);report.checks.finite=finite;report.checks.resetIdle=actor.stats.currentClip==='Idle';report.checks.groundedWithoutFlightFlattening=report.gaits.every(g=>g.minFloor>-.03&&g.maxFloor<.5);
report.hashes={};for(const f of ['src/assets/enemy-library.js','assets/models/orc-peon-locomotion-v1.glb','assets/models/orc-peon.glb'])report.hashes[f]=createHash('sha256').update(await fs.readFile(f)).digest('hex');
const reports=process.env.BIPX_EVIDENCE_DIR||'output/enemy-locomotion';await fs.mkdir(reports,{recursive:true});await fs.writeFile(`${reports}/controller-cpu.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));for(const[k,ok]of Object.entries(report.checks))assert.equal(ok,true,k);
