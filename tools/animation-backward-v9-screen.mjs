// Project the captured native trace through the exact fixture cameras. CPU only.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
const out=path.resolve(process.argv[2]);
const report=JSON.parse(await fs.readFile(path.join(out,'report.json'),'utf8'));
const result={scope:'Discrete screen-space continuity of existing native witness; not a perceptual or contact gate',cases:[]};
for(const item of report.cases){
  const native=JSON.parse(await fs.readFile(path.join(out,item.trace),'utf8'));
  const camera=new THREE.PerspectiveCamera(item.view==='game'?48:38,1440/900,.05,3000);
  const gamePosition=new THREE.Vector3(0,17,20), rows=[];
  let previous;
  for(const row of native.trace){
    const root=new THREE.Vector3().fromArray(row.positions[0]);
    gamePosition.lerp(root.clone().add(new THREE.Vector3(0,17,20)),1-Math.pow(.001,1/item.hz));
    camera.position.copy(item.view==='game'?gamePosition:root.clone().add(new THREE.Vector3(4.8,2.4,-4.8)));
    camera.lookAt(root.clone().add(new THREE.Vector3(0,item.view==='game'?1.2:1.1,item.view==='game'?-2.6:0)));
    camera.updateMatrixWorld(true);
    const screen=row.samples.map(s=>Object.fromEntries(Object.entries(s.material).map(([v,p])=>{
      const ndc=new THREE.Vector3().fromArray(p).project(camera);
      return[v,[(ndc.x+1)*720,(1-ndc.y)*450]];
    })));
    if(row.frame>=(item.hz===30?49:103)){
      const step=screen.map((s,i)=>Object.fromEntries(Object.entries(s).map(([v,p])=>[v,p.map((x,k)=>x-previous[i][v][k])])));
      rows.push({frame:row.frame,time:row.time,screen,step,stepLength:step.map(s=>Math.hypot(...s['39'])),
        difference39:Math.hypot(...screen[0]['39'].map((x,k)=>x-screen[1]['39'][k])),
        stepDifference39:Math.hypot(...step[0]['39'].map((x,k)=>x-step[1]['39'][k]))});
    }
    previous=screen;
  }
  assert(Math.max(...camera.matrixWorld.elements.map((v,i)=>Math.abs(v-native.cameras[0].matrix[i])))<1e-12);
  result.cases.push({name:item.name,view:item.view,hz:item.hz,panel:[1440,900],rows});
  console.log(JSON.stringify({name:item.name,release:rows.find(r=>r.frame===(item.hz===30?56:112))}));
}
await fs.writeFile(path.join(out,'screen-continuity.json'),JSON.stringify(result,null,2));
