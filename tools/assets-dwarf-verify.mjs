import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const out=path.resolve('output/playwright/dwarf');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${process.env.ASSET_REVIEW_ORIGIN || 'http://localhost:5276'}/tools/assets-dwarf-preview.html?manual=1`);
 await page.waitForFunction(()=>window.assetReview?.ready,{timeout:30000});
 const sample=()=>page.evaluate(()=>{
  const{hero,THREE}=window.assetReview;hero.root.updateMatrixWorld(true);const body=hero.model.getObjectByName('DwarfBody');body.skeleton.update();
  return{stats:structuredClone(hero.stats),bounds:new THREE.Box3().setFromObject(hero.root,true).getSize(new THREE.Vector3()).toArray(),vertices:[0,100,500,1000,5000,10000].map(i=>body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(body.matrixWorld).toArray()),muzzle:hero.muzzle.getWorldPosition(new THREE.Vector3()).toArray(),muzzleDirection:hero.getMuzzleDirection().toArray()};
 });
 const idle=await sample();await page.screenshot({path:path.join(out,'idle.png')});
 await page.evaluate(()=>{window.assetReview.setState({speed:5});for(let i=0;i<4;i++)window.assetReview.step(.1);});
 const runA=await sample();await page.screenshot({path:path.join(out,'run-a.png')});
 await page.evaluate(()=>{for(let i=0;i<3;i++)window.assetReview.step(.1);});
 const runB=await sample();await page.screenshot({path:path.join(out,'run-b.png')});
 await page.evaluate(()=>{window.assetReview.setState({speed:0,attack:true,duration:.267});window.assetReview.step(.1);});
 const shoot=await sample();await page.screenshot({path:path.join(out,'shoot.png')});
 await page.evaluate(()=>{window.assetReview.setState({dead:true});for(let i=0;i<10;i++)window.assetReview.step(.1);});
 const deathMid=await sample();await page.screenshot({path:path.join(out,'death-mid.png')});
 await page.evaluate(()=>{for(let i=0;i<15;i++)window.assetReview.step(.1);});
 const death=await sample();await page.screenshot({path:path.join(out,'death.png')});
 const raw=await page.evaluate(async()=>{
  const{THREE}=window.assetReview;const{GLTFLoader}=await import('/src/assets/vendor/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/assets/models/dwarf-rifleman.glb');
  const model=gltf.scene,mixer=new THREE.AnimationMixer(model),body=model.getObjectByName('DwarfBody'),rifle=model.getObjectByName('DwarfRifle'),foregrip=model.getObjectByName('DwarfForegrip');
  const right=body.skeleton.bones.filter(b=>b.name.includes('RightHand')).sort((a,b)=>a.name.length-b.name.length)[0],left=body.skeleton.bones.filter(b=>b.name.includes('LeftHand')).sort((a,b)=>a.name.length-b.name.length)[0];
  const clips=[];
  for(const clip of gltf.animations){
   mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
   let bind,maxRifleDrift=0,maxSupportError=0,maxExtent=0,minGround=Infinity,finite=true;const frames=Math.round(clip.duration*30)+1;
   for(let f=0;f<frames;f++){
    mixer.setTime(f/30);model.updateMatrixWorld(true);body.skeleton.update();
    const relative=right.matrixWorld.clone().invert().multiply(rifle.matrixWorld);bind??=relative.clone();maxRifleDrift=Math.max(maxRifleDrift,...relative.elements.map((v,i)=>Math.abs(v-bind.elements[i])));
    maxSupportError=Math.max(maxSupportError,left.getWorldPosition(new THREE.Vector3()).distanceTo(foregrip.getWorldPosition(new THREE.Vector3())));
    const box=new THREE.Box3().setFromObject(body,true),size=box.getSize(new THREE.Vector3());maxExtent=Math.max(maxExtent,size.x,size.y,size.z);minGround=Math.min(minGround,box.min.y);finite&&=[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite);
   }
   clips.push({name:clip.name,frames,maxRifleDrift,maxSupportError,maxExtent,minGround,finite});
  }
  const materials=[];model.traverse(o=>{if(o.isMesh)materials.push({name:o.name,triangles:o.geometry.index.count/3,texture:o.material.map?{width:o.material.map.image.width,height:o.material.map.image.height}:null})});
  return{clips,materials,bones:body.skeleton.bones.length};
 });
 const transitions=await page.evaluate(()=>{const{hero}=window.assetReview;hero.update(.1,{dead:false});hero.attack({duration:.267});for(let i=0;i<5;i++)hero.update(.1,{speed:0});const afterShot=hero.stats.currentClip;for(let i=0;i<30;i++)hero.update(.1,{dead:true});return{afterShot,afterDeath:hero.stats.currentClip};});
 const report={errors,idle,runA,runB,shoot,deathMid,death,raw,transitions,sha256:createHash('sha256').update(await fs.readFile('assets/models/dwarf-rifleman.glb')).digest('hex')};
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));
 assert(errors.length===0,errors.join('\n'));assert(raw.bones===65);assert(raw.clips.length===6);assert(raw.clips.every(c=>c.finite&&c.maxExtent<2));
 assert(raw.clips.every(c=>c.maxRifleDrift<.003),'Primary rifle grip alignment failed');
 assert(raw.clips.filter(c=>c.name!=='Death').every(c=>c.maxSupportError<.003),'Two-hand rifle grip alignment failed');
 assert(Math.abs(idle.muzzleDirection[0])<.02 && idle.muzzleDirection[2]<-.99,'Idle barrel is not aligned with -Z aim');
 assert(Math.abs(shoot.muzzleDirection[0])<.02 && shoot.muzzleDirection[2]<-.99,'Shooting barrel is not aligned with -Z aim');
 assert(raw.materials.every(m=>m.texture?.width<=1024));assert.deepEqual(transitions,{afterShot:'Idle',afterDeath:'Death'});
 assert(Math.abs(idle.bounds[1]-2.2)<.01);assert(runA.vertices.some((v,i)=>Math.hypot(...v.map((x,j)=>x-runB.vertices[i][j]))>.1));
 console.log(JSON.stringify({passed:true,sha256:report.sha256,clips:raw.clips,transitions,muzzleDirection:idle.muzzleDirection}));
} finally {await browser.close();}
