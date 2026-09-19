import fs from 'node:fs/promises';
import { THREE, quantile } from './hero-locomotion-cpu-support.mjs';
import { loadHeroVisual } from '../src/assets/character-library.js';
import { loadDwarfVisual } from '../src/assets/dwarf-library.js';
const results=[];
for(const [id,loader,height]of [['warrior',loadHeroVisual,2.7],['dwarf',loadDwarfVisual,2.55]])for(const [label,angle,speed]of [['forward',0,6.5],['strafe',Math.PI/2,6.5],['backward',Math.PI,6.5],['diagonal',Math.PI/4,6.5],['upgraded-backward',Math.PI,9.1]]) {
 const parent=new THREE.Group(),actor=await loader({THREE,parent,height});const probes=[[],[]];
 actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const skinIndex=mesh.geometry.attributes.skinIndex,skinWeight=mesh.geometry.attributes.skinWeight;
 for(let v=0;v<skinIndex.count;v++)for(let f=0;f<2;f++){let weight=0;for(let k=0;k<4;k++){const name=mesh.skeleton.bones[skinIndex.getComponent(v,k)].name;if(name.includes(f?'RightFoot':'LeftFoot')||name.includes(f?'RightToe':'LeftToe'))weight+=skinWeight.getComponent(v,k);}if(weight>.75)probes[f].push({mesh,vertex:v});}});
 const dt=1/120,velocity={x:Math.sin(angle)*speed,z:-Math.cos(angle)*speed};const floors=[],supportFloors=[],drifts=[],reach=[],plantDrifts=[];let previous=[null,null];
 for(let i=0;i<480;i++){
  parent.position.x+=velocity.x*dt;parent.position.z+=velocity.z*dt;actor.update(dt,{speed,velocity});parent.updateMatrixWorld(true);actor.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  for(let f=0;f<2;f++){
   const points=probes[f].map(({mesh,vertex})=>mesh.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)),floor=Math.min(...points.map(p=>p.y));
   const contact=actor.stats.locomotion.footContacts[f];
   if(i>120){floors.push(floor);reach.push(contact.reachError);if(contact.contact){supportFloors.push(floor);if(contact.horizontalDrift!==null)plantDrifts.push(contact.horizontalDrift);
    if(previous[f]?.contact)for(let n=0;n<points.length;n++){const p=points[n],old=previous[f].points[n];if(Math.abs(p.y)<.04&&Math.abs(old.y)<.04)drifts.push(Math.hypot(p.x-old.x,p.z-old.z)/dt);}
   }}previous[f]={points,contact:contact.contact};
  }
 }
 results.push({id,label,speed,probes:probes.map(p=>p.length),minimumFootSurfaceY:Math.min(...floors),supportSamples:supportFloors.length,supportSurfaceYMedian:quantile(supportFloors,.5),supportSurfaceYMin:Math.min(...supportFloors),supportSurfaceYMax:Math.max(...supportFloors),supportNearGroundFraction:supportFloors.filter(y=>y>=-.02&&y<=.04).length/supportFloors.length,nearGroundDeformedVertexSamples:drifts.length,deformedSurfaceDriftP90:quantile(drifts,.9),toePlantDriftP90:quantile(plantDrifts,.9),maximumReachError:Math.max(...reach)});actor.dispose();
}
await fs.writeFile('output/hero-locomotion/deformed-contact-surface.json',JSON.stringify({scope:'CPU foot surface witnesses with >75% foot/toe weights. These are actual skinned vertices, not the toe anchor. A 4cm ground band counts sole drift only when the same vertex remains near the ground in consecutive support frames. No visual acceptance.',results},null,2));console.table(results);
