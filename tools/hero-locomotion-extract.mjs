import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THREE, bonesOf, quantile } from './hero-locomotion-cpu-support.mjs';
import { loadGlb } from '../src/assets/load-glb.js';
for(const [id,file] of [['warrior','aldric-directional'],['dwarf','lyra-directional']]) {
 const sourceUrl = new URL(`../output/hero-locomotion/export/${file}.glb`,import.meta.url);
 const {scene,animations}=await loadGlb(sourceUrl),bones=Object.fromEntries(Object.entries(bonesOf(scene)).map(([k,v])=>[k.replace(/_\d+$/,''),v])),mixer=new THREE.AnimationMixer(scene);
 const list=[];
 for(const clip of animations.filter(c=>c.name!=='Idle')) {
  mixer.stopAllAction();const action=mixer.clipAction(clip).reset().play(),dt=clip.duration/240;
  const frames=[];
  for(let i=0;i<240;i++){mixer.setTime(i*dt);scene.updateMatrixWorld(true);frames.push(['Left','Right'].map(s=>bones[`${s}ToeBase`].getWorldPosition(new THREE.Vector3())));}
  const floors=[0,1].map(f=>Math.min(...frames.map(s=>s[f].y))),velocities=[];
  for(let i=1;i<240;i++)for(let f=0;f<2;f++){
   const curr=frames[i][f],prev=frames[i-1][f],v=curr.clone().sub(prev).divideScalar(dt);
   if(curr.y<floors[f]+.035&&prev.y<floors[f]+.035&&Math.abs(v.y)<.25)velocities.push(v);
  }
  const x=quantile(velocities.map(v=>-v.x),.5),z=quantile(velocities.map(v=>-v.z),.5);
  const direction=Math.abs(x)>Math.abs(z)?[Math.sign(x),0]:[0,Math.sign(z)];
  console.log(id,clip.name,'duration',clip.duration.toFixed(3),'speed source',Math.hypot(x,z).toFixed(3),'direction',direction,'vector',[x,z].map(x=>x.toFixed(3)));
  // Only the independently sampled lower-body tracks are shipped. Current
  // full-body/weapon clips and current skin remain in the original GLBs.
  const tracks=clip.tracks.filter(t=>/^mixamorig(Hips|Left(UpLeg|Leg|Foot|Toe)|Right(UpLeg|Leg|Foot|Toe))/.test(t.name));
  const output=THREE.AnimationClip.toJSON(new THREE.AnimationClip(clip.name,clip.duration,tracks));
  output.uuid = `bipx-${id}-${clip.name}`;list.push({direction,clip:output});
 }
 const artifact={source:`output/hero-locomotion/export/${file}.glb`,sourceSha256:createHash('sha256').update(await fs.readFile(sourceUrl)).digest('hex'),method:'Authored local Mixamo directional actions evaluated on original deform rig; horizontal root motion stripped on action copies; lower-body tracks only.',clips:list};
 await fs.writeFile(`src/assets/${id}-locomotion-clips.json`,JSON.stringify(artifact));
}
