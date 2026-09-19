// CPU camera-only visibility check; original clips/actors remain unchanged.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,loadCPU,hash} from './brute-motion-review-v6-utils.mjs';
import {makePair,refresh} from './brute-motion-review-v6-native-scene.mjs';
const base='output/brute-motion-v6',out=`${base}/contact-followup-v1`;
const profiles=JSON.parse(fs.readFileSync(`${base}/handoff-01/attack-profiles.json`));
const poses=JSON.parse(fs.readFileSync(`${base}/handoff-01/poses.json`));
const probes=JSON.parse(fs.readFileSync(`${base}/source/assets__models__monsters__ground-probes.json`)).brute.vertexIndices;
const v=()=>new THREE.Vector3();
const cameraDefinitions=[
 {id:'previous-occluded',position:[5,3.7,5],lookAt:[0,1.45,-.945],fov:40},
 {id:'reverse-lateral',position:[-5.8,1.4,-.2],lookAt:[0,1.55,-.945],fov:40},
];
const report={scope:'CPU ray visibility of frozen hand/guard and framing, not native validation',
 targetDistance:1.89,selectedCamera:cameraDefinitions[1],cameraDefinitions,cases:[]};
for(const p of profiles.variants){
 const pair=makePair({brute:await loadCPU(p.asset),hero:await loadCPU(p.nativeTargetCopy),id:p.id,probes,profile:p});
 pair.stage.rotation.y=Math.PI;pair.stage.position.z=-1.89;refresh(pair.stage);
 for(const t of [.65,.70,.745]){
  pair.seek(t);
  const realMeshes=[];pair.stage.traverse(m=>{if(m.isMesh)realMeshes.push(m);});
  const pickMeshes=realMeshes.map(m=>{
   const positions=Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,v()).applyMatrix4(m.matrixWorld));
   const g=new THREE.BufferGeometry().setFromPoints(positions);g.setIndex(Array.from(m.geometry.index.array));
   const pick=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));pick.name=m.name;pick.updateMatrixWorld(true);return pick;
  });
  const hand=poses.regions.hand.filter((_,i)=>i%8===0).map(i=>pair.body.getVertexPosition(i,v()).applyMatrix4(pair.body.matrixWorld));
  const contact=v().fromArray(p.firstSurface.brutePoint).applyMatrix4(pair.stage.matrixWorld);
  const targetContact=v().fromArray(p.firstSurface.targetPoint).applyMatrix4(pair.stage.matrixWorld);
  const row={variant:p.id,time:t,cameras:[]};
  for(const c of cameraDefinitions){
   const camera=new THREE.PerspectiveCamera(c.fov,1440/900,.1,120);camera.position.fromArray(c.position);camera.lookAt(...c.lookAt);camera.updateMatrixWorld(true);
   const ray=new THREE.Raycaster();
   function visibility(point){const d=point.distanceTo(camera.position);ray.set(camera.position,point.clone().sub(camera.position).normalize());
    const first=ray.intersectObjects(pickMeshes,false)[0];return{visible:!first||first.distance>=d-.002,firstMesh:first?.object.name,blockedByMeters:first?d-first.distance:0};}
   const visible=hand.filter(p=>visibility(p).visible).length;
   const near=hand.filter(x=>x.distanceTo(contact)<.25),nearVisible=near.filter(x=>visibility(x).visible).length;
   const ndc=hand.map(x=>x.clone().project(camera));
   row.cameras.push({id:c.id,handVisible:visible,handSamples:hand.length,nearContactHandVisible:nearVisible,nearContactHandSamples:near.length,
    contactWitness:t===.7?visibility(contact):null,guardWitness:t===.7?visibility(targetContact):null,
    handInsideFrame:ndc.every(p=>Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&p.z>=-1&&p.z<=1)});
  }
  report.cases.push(row);for(const m of pickMeshes){m.geometry.dispose();m.material.dispose();}
 }
 pair.dispose();
}
for(const p of profiles.variants)assert.equal(hash(fs.readFileSync(p.asset)),p.sha256);
fs.writeFileSync(`${out}/camera-cpu.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
