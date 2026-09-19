import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THREE, bonesOf, quantile } from './hero-locomotion-cpu-support.mjs';
import { loadGlb } from '../src/assets/load-glb.js';
const report = {};
for (const [id, file, height] of [['warrior', 'aldric-hero', 2.4], ['dwarf', 'dwarf-rifleman', 2.2]]) {
  const url = new URL(`../assets/models/${file}.glb`, import.meta.url);
  const {scene:model, animations} = await loadGlb(url);
  const root = new THREE.Group(); root.add(model); model.rotation.y = Math.PI;
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(animations.map(a => [a.name,mixer.clipAction(a)]));
  actions.Idle.play(); mixer.update(0); root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true), scale = height / box.getSize(new THREE.Vector3()).y;
  root.scale.setScalar(scale); model.position.y -= box.min.y;
  const bones = Object.fromEntries(Object.entries(bonesOf(model)).map(([k,v])=>[k.replace(/_\d+$/,''),v]));
  const gaits = {};
  for (const name of ['Walk','Run']) {
    mixer.stopAllAction();const a=actions[name];a.reset().play();
    const samples=[],count=240,dt=a.getClip().duration/count;
    for(let i=0;i<count;i++) {
      mixer.setTime(i*dt);root.updateMatrixWorld(true);
      samples.push(['Left','Right'].map(side=>({foot:bones[`${side}Foot`].getWorldPosition(new THREE.Vector3()).toArray(),toe:bones[`${side}ToeBase`].getWorldPosition(new THREE.Vector3()).toArray(),end:bones[`${side}Toe_End`].getWorldPosition(new THREE.Vector3()).toArray()})));
    }
    const feet=['Left','Right'].map((side,f)=>{
      const minToeY=Math.min(...samples.map(s=>s[f].toe[1]));
      const velocities=[];
      for(let i=1;i<count;i++) {
        const prev=samples[i-1][f].toe,cur=samples[i][f].toe;
        if(cur[1]<minToeY+.09 && (cur[2]-prev[2])/dt>0)velocities.push((cur[2]-prev[2])/dt);
      }
      return {side,minToeY,maxToeY:Math.max(...samples.map(s=>s[f].toe[1])),velocity:quantile(velocities,.5),sampled:samples.filter((_,i)=>i%20===0).map(s=>s[f].toe.map(v=>+v.toFixed(3)))};
    });
    gaits[name]={duration:a.getClip().duration,feet};
  }
  report[id]={file,sha256:createHash('sha256').update(await fs.readFile(url)).digest('hex'),height,scale,gaits};
}
await fs.mkdir('output/hero-locomotion',{recursive:true});await fs.writeFile('output/hero-locomotion/source-analysis.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
