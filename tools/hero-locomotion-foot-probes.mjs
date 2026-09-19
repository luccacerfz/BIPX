import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THREE } from './hero-locomotion-cpu-support.mjs';
import { loadHeroVisual } from '../src/assets/character-library.js';
import { loadDwarfVisual } from '../src/assets/dwarf-library.js';
const report={method:'Union of lowest actual skinned foot/toe vertices (weight >=75%) in forward, backward, lateral and diagonal authored motion samples. Full independent surface QA samples every eligible vertex.',characters:{}};
for(const [id,loader,height]of [['warrior',loadHeroVisual,2.7],['dwarf',loadDwarfVisual,2.55]]) {
 const parent=new THREE.Group(),actor=await loader({THREE,parent,height}),candidates=[[],[]],witnesses=[new Map(),new Map()];
 actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const idx=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;for(let i=0;i<idx.count;i++)for(let f=0;f<2;f++){let weight=0;for(let k=0;k<4;k++){const n=mesh.skeleton.bones[idx.getComponent(i,k)].name;if(n.includes(f?'RightFoot':'LeftFoot')||n.includes(f?'RightToe':'LeftToe'))weight+=w.getComponent(i,k);}if(weight>.75)candidates[f].push({mesh,vertex:i});}});
 for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4])for(let i=0;i<180;i++){
  const speed=6.5,velocity={x:Math.sin(angle)*speed,z:-Math.cos(angle)*speed};parent.position.x+=velocity.x/90;parent.position.z+=velocity.z/90;actor.update(1/90,{speed,velocity});parent.updateMatrixWorld(true);actor.model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  for(let f=0;f<2;f++){const points=candidates[f].map(probe=>({...probe,y:probe.mesh.getVertexPosition(probe.vertex,new THREE.Vector3()).applyMatrix4(probe.mesh.matrixWorld).y}));points.sort((a,b)=>a.y-b.y);for(const point of points.slice(0,3))witnesses[f].set(`${point.mesh.name}:${point.vertex}`,{mesh:point.mesh.name,vertex:point.vertex});}
 }
 report.characters[id]={sourceSha256:createHash('sha256').update(await fs.readFile(`assets/models/${id==='warrior'?'aldric-hero':'dwarf-rifleman'}.glb`)).digest('hex'),feet:witnesses.map(w=>[...w.values()])};actor.dispose();
}
await fs.writeFile('output/hero-locomotion/foot-surface-probes.json',JSON.stringify(report,null,2));console.log(Object.fromEntries(Object.entries(report.characters).map(([id,p])=>[id,p.feet.map(f=>f.length)])));
