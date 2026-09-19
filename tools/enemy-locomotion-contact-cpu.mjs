import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.js';
import {installCPUFetch} from './enemy-locomotion-utils.mjs';
installCPUFetch();const {loadEnemyLibrary}=await import('../src/assets/enemy-library.js');
const library=await loadEnemyLibrary({THREE,contactCandidate:process.argv.includes('--candidate'),assetVersion:process.argv.includes('--asset-v2')?2:1}),q=(xs,p)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*p)]:null;
const report={scope:'Paired actual-controller CPU comparison on identical authored clips and paths. Contacts use real skinned sole vertices; perceptual acceptance separate.',cases:[],checks:{}};
const p=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),qa=new THREE.Quaternion(),qb=new THREE.Quaternion();
for(const config of [{name:'walk',speed:1},{name:'run',speed:3.7},{name:'fast-run',speed:5.5},{name:'curved-run',speed:3.7,curve:.25},{name:'hard-turn',speed:3.7,turn:true},{name:'teleport',speed:3.7,teleport:true}]){
 const scene=new THREE.Scene(),pa=new THREE.Group(),pb=new THREE.Group();scene.add(pa,pb);
 const before=library.create('orcPeon',{parent:pa,height:2.5,footContacts:false}),after=library.create('orcPeon',{parent:pb,height:2.5,footContacts:true});
 const bodies=[before,after].map(a=>a.model.getObjectByName('OrcBody'));
 const skin=bodies[0].geometry.attributes.skinIndex,weights=bodies[0].geometry.attributes.skinWeight,positions=bodies[0].geometry.attributes.position,seen=new Set(),surfaceIndices=[];
 for(let vi=0;vi<skin.count;vi++){let weight=0;for(let slot=0;slot<4;slot++)if(/^[LR]_(Foot|ToeBase)$/.test(bodies[0].skeleton.bones[skin.getComponent(vi,slot)].name))weight+=weights.getComponent(vi,slot);if(weight<.5)continue;const key=[positions.getX(vi),positions.getY(vi),positions.getZ(vi)].map(x=>x.toFixed(5)).join(',');if(!seen.has(key)){seen.add(key);surfaceIndices.push(vi);}}
 const lastSurface=surfaceIndices.map(()=>null),surfaceBefore=[],surfaceAfter=[],beforeOwn=[],afterOwn=[];
 const data={...config,beforeDrift:[],afterDrift:[],lockedDrift:[],supportSamples:0,lockedSamples:0,maxGeometryDelta:0,maxUpperBodyDelta:0,maxWeaponMatrixDelta:0,maxFloorPenetration:0,maxFootYDelta:0,maxBoneLengthDelta:0,releaseReasons:{},finite:true};
 const dt=1/120;for(let i=0;i<720;i++){
  const t=i*dt,yaw=(config.curve||0)*t+(config.turn&&i>=360?Math.PI/2:0),velocity={x:-Math.sin(yaw)*config.speed,z:-Math.cos(yaw)*config.speed};
  pa.position.x+=velocity.x*dt;pa.position.z+=velocity.z*dt;pa.rotation.y=yaw;const teleport=config.teleport&&i===360;if(teleport)pa.position.x+=10;pb.position.copy(pa.position);pb.rotation.copy(pa.rotation);
  before.update(dt,{speed:config.speed,velocity,teleport});after.update(dt,{speed:config.speed,velocity,teleport});scene.updateMatrixWorld(true);for(const body of bodies)body.skeleton.update();
  for(let k=0;k<surfaceIndices.length;k++){
   const vi=surfaceIndices[k];bodies[0].getVertexPosition(vi,b).applyMatrix4(bodies[0].matrixWorld);bodies[1].getVertexPosition(vi,c).applyMatrix4(bodies[1].matrixWorld);
   const last=lastSurface[k];
   // Independent geometric contact window, including source phases where the
   // solver's ball-of-foot mask is false. Never cherry-pick locked samples.
   if(last&&i>=60&&!teleport&&!(config.turn&&i===360)&&Math.max(last[1],b.y,last[4],c.y)<.035&&Math.abs(b.y-last[1])/dt<.35){surfaceBefore.push(Math.hypot(b.x-last[0],b.z-last[2])/dt);surfaceAfter.push(Math.hypot(c.x-last[3],c.z-last[5])/dt);}
   if(last&&i>=60&&!teleport&&!(config.turn&&i===360)) {
    if(Math.max(last[1],b.y)<.035&&Math.abs(b.y-last[1])/dt<.35)beforeOwn.push(Math.hypot(b.x-last[0],b.z-last[2])/dt);
    if(Math.max(last[4],c.y)<.035&&Math.abs(c.y-last[4])/dt<.35)afterOwn.push(Math.hypot(c.x-last[3],c.z-last[5])/dt);
   }
   lastSurface[k]=[b.x,b.y,b.z,c.x,c.y,c.z];
  }
  if(i<60)continue;
  const base=before.stats.footSupport.contacts,solved=after.stats.footSupport.contacts;
  for(let f=0;f<solved.length;f++){
   const a=base[f],z=solved[f];if(z.releaseReason)data.releaseReasons[z.releaseReason]=(data.releaseReasons[z.releaseReason]||0)+1;
   if(a.contact&&a.drift!==null&&z.drift!==null){data.supportSamples++;data.beforeDrift.push(a.drift);data.afterDrift.push(z.drift);if(z.locked){data.lockedSamples++;data.lockedDrift.push(z.drift);}}
   if(a.position&&z.position)data.maxFootYDelta=Math.max(data.maxFootYDelta,Math.abs(a.position[1]-z.position[1]));
  }
  for(const name of ['Head','R_Hand','L_Hand','Waist']){
   const a=before.model.getObjectByName(name),z=after.model.getObjectByName(name);data.maxUpperBodyDelta=Math.max(data.maxUpperBodyDelta,...a.matrixWorld.elements.map((value,k)=>Math.abs(value-z.matrixWorld.elements[k])));
  }
  const aw=before.weapon.matrixWorld.elements,zw=after.weapon.matrixWorld.elements;data.maxWeaponMatrixDelta=Math.max(data.maxWeaponMatrixDelta,...aw.map((x,k)=>Math.abs(x-zw[k])));
  for(const side of ['L','R'])for(const [start,end]of [['Thigh','Calf'],['Calf','Foot']]){
   const length=actor=>actor.model.getObjectByName(`${side}_${start}`).getWorldPosition(b).distanceTo(actor.model.getObjectByName(`${side}_${end}`).getWorldPosition(c));data.maxBoneLengthDelta=Math.max(data.maxBoneLengthDelta,Math.abs(length(before)-length(after)));
  }
  if(i%8===0){
   let min=Infinity;for(let vi=0;vi<bodies[0].geometry.attributes.position.count;vi++){
    bodies[0].getVertexPosition(vi,b).applyMatrix4(bodies[0].matrixWorld);bodies[1].getVertexPosition(vi,c).applyMatrix4(bodies[1].matrixWorld);data.maxGeometryDelta=Math.max(data.maxGeometryDelta,b.distanceTo(c));min=Math.min(min,c.y);data.finite&&=Number.isFinite(c.x+c.y+c.z);
   }data.maxFloorPenetration=Math.max(data.maxFloorPenetration,-min);
  }
 }
 const summary=values=>({samples:values.length,median:q(values,.5),p90:q(values,.9),maximum:Math.max(0,...values)});
 data.independentContactSurface={before:summary(beforeOwn),after:summary(afterOwn),criterion:'Each actor independently: Foot/Toe-weighted vertices at<=35mm world Y and vertical speed<=0.35m/s; includes all its contact phases'};
 data.geometricSurface={vertices:surfaceIndices.length,before:summary(surfaceBefore),after:summary(surfaceAfter),criterion:'Foot/Toe weighted vertices at <=35mm world Y, vertical speed <=0.35m/s, independent of solver phase/locked state'};
 data.beforeDrift=summary(data.beforeDrift);data.afterDrift=summary(data.afterDrift);data.lockedDrift=summary(data.lockedDrift);data.solver=structuredClone(after.stats.footSupport);delete data.solver.contacts;
 after.reset();data.resetClearsContacts=after.stats.footSupport.contacts.length===0;before.dispose();after.dispose();report.cases.push(data);
}
report.checks.finite=report.cases.every(c=>c.finite);report.checks.worldPlantsStable=report.cases.every(c=>c.lockedDrift.p90<.005);report.checks.usefulCoverage=report.cases.every(c=>c.lockedSamples/c.supportSamples>.8);report.checks.allSupportImproves=report.cases.every(c=>c.afterDrift.p90<c.beforeDrift.p90*.2);report.checks.upperBodyWeaponPreserved=report.cases.every(c=>c.maxUpperBodyDelta<1e-6&&c.maxWeaponMatrixDelta<1e-6);report.checks.boneLengthsPreserved=report.cases.every(c=>c.maxBoneLengthDelta<1e-6);report.checks.noExcessDeformation=report.cases.every(c=>c.maxGeometryDelta<.3);report.checks.noVerticalFootWarp=report.cases.every(c=>c.maxFootYDelta<.005&&c.maxFloorPenetration<.03);report.checks.reset=report.cases.every(c=>c.resetClearsContacts);
report.checks.actualGroundSurfaceImproves=report.cases.every(c=>c.independentContactSurface.after.p90<c.independentContactSurface.before.p90*.7);
report.accepted=Object.values(report.checks).every(Boolean);report.variant=process.argv.includes('--candidate')?'donor-stance-XYZ-candidate':'ball-marker-XZ-candidate';
report.hashes={};for(const file of ['src/assets/enemy-library.js','src/assets/enemy-foot-contacts.js','src/assets/enemy-foot-contacts-candidate.js','src/assets/enemy-run-support.js',process.argv.includes('--asset-v2')?'assets/models/orc-peon-locomotion-v2.glb':'assets/models/orc-peon-locomotion-v1.glb'])report.hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');await fs.mkdir(process.env.BIPX_EVIDENCE_DIR||'output/enemy-locomotion',{recursive:true});await fs.writeFile(`${process.env.BIPX_EVIDENCE_DIR||'output/enemy-locomotion'}/contact${process.argv.includes('--candidate')?'-candidate':''}${process.argv.includes('--asset-v2')?'-v2':''}-cpu.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));for(const[k,ok]of Object.entries(report.checks))assert.equal(ok,true,k);
