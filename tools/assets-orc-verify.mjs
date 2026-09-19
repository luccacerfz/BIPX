import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='output/playwright/orc';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://localhost:5276/tools/assets-orc-preview.html?manual=1');await page.waitForFunction(()=>window.assetReview?.ready);
 const sample=()=>page.evaluate(()=>{const{hero,THREE}=window.assetReview;hero.root.updateMatrixWorld(true);const body=hero.model.getObjectByName('OrcBody');body.skeleton.update();return{stats:structuredClone(hero.stats),bounds:new THREE.Box3().setFromObject(body,true).getSize(new THREE.Vector3()).toArray(),vertices:[0,100,500,1000,5000,10000].map(i=>body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(body.matrixWorld).toArray())};});
 const idle=await sample();await page.screenshot({path:`${out}/idle.png`});
 await page.evaluate(()=>{window.assetReview.setState({speed:1.5});for(let i=0;i<4;i++)window.assetReview.step(.1);});
 const walkA=await sample();await page.screenshot({path:`${out}/walk-a.png`});
 await page.evaluate(()=>{for(let i=0;i<6;i++)window.assetReview.step(.1);});const walkB=await sample();await page.screenshot({path:`${out}/walk-b.png`});
 await page.evaluate(()=>{window.assetReview.setState({speed:0,attack:true,duration:1.1667});for(let i=0;i<4;i++)window.assetReview.step(.1);});
 const attack=await sample();await page.screenshot({path:`${out}/attack.png`});
 await page.evaluate(()=>{window.assetReview.setState({dead:true});for(let i=0;i<6;i++)window.assetReview.step(.1);});
 await page.screenshot({path:`${out}/death-mid.png`});
 await page.evaluate(()=>{for(let i=0;i<10;i++)window.assetReview.step(.1);});const death=await sample();await page.screenshot({path:`${out}/death.png`});
 const raw=await page.evaluate(async()=>{
  const{THREE}=window.assetReview;const{GLTFLoader}=await import('/src/assets/vendor/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/assets/models/orc-peon.glb');
  const model=gltf.scene,mixer=new THREE.AnimationMixer(model),body=model.getObjectByName('OrcBody'),weapon=model.getObjectByName('OrcSickle'),right=body.skeleton.bones.find(b=>b.name==='R_Hand');const clips=[];
  for(const clip of gltf.animations){mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();let bind,maxWeaponDrift=0,maxExtent=0,minGround=Infinity,finite=true;const frames=Math.round(clip.duration*24)+1;let first,maxVertexMotion=0;
   for(let f=0;f<frames;f++){mixer.setTime(f/24);model.updateMatrixWorld(true);body.skeleton.update();const relative=right.matrixWorld.clone().invert().multiply(weapon.matrixWorld);bind??=relative.clone();maxWeaponDrift=Math.max(maxWeaponDrift,...relative.elements.map((v,i)=>Math.abs(v-bind.elements[i])));const box=new THREE.Box3().setFromObject(body,true),size=box.getSize(new THREE.Vector3());maxExtent=Math.max(maxExtent,size.x,size.y,size.z);minGround=Math.min(minGround,box.min.y);finite&&=[...box.min.toArray(),...box.max.toArray()].every(Number.isFinite);const verts=[100,1000,5000].map(i=>body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(body.matrixWorld));first??=verts.map(v=>v.clone());maxVertexMotion=Math.max(maxVertexMotion,...verts.map((v,i)=>v.distanceTo(first[i])));}
   clips.push({name:clip.name,frames,maxWeaponDrift,maxExtent,minGround,finite,maxVertexMotion});
  }
  const materials=[];model.traverse(o=>{if(o.isMesh)materials.push({name:o.name,triangles:o.geometry.index.count/3,texture:o.material.map?{width:o.material.map.image.width,height:o.material.map.image.height}:null})});return{clips,materials,bones:body.skeleton.bones.length};
 });
 const pool=await page.evaluate(()=>{
  const{library,hero,THREE,scene}=window.assetReview;const parent=new THREE.Group();scene.add(parent);const clone=library.create('orcPeon',{parent});const a=hero.model.getObjectByName('OrcBody'),b=clone.model.getObjectByName('OrcBody');const shared={geometry:a.geometry===b.geometry,material:a.material===b.material,texture:a.material.map===b.material.map,independentSkeleton:a.skeleton!==b.skeleton,independentBones:a.skeleton.bones[0]!==b.skeleton.bones[0]};hero.reset();hero.attack({duration:.85});for(let i=0;i<12;i++)hero.update(.1);const afterAttack=hero.stats.currentClip;for(let i=0;i<20;i++)hero.update(.1,{dead:true});const afterDeath=hero.stats.currentClip;hero.reset({phase:.4});const afterReset=hero.stats.currentClip;clone.dispose();return{shared,afterAttack,afterDeath,afterReset,removed:parent.children.length===0};
 });
 const report={errors,idle,walkA,walkB,attack,death,raw,pool,sha256:createHash('sha256').update(await fs.readFile('assets/models/orc-peon.glb')).digest('hex')};await fs.writeFile(`${out}/verification.json`,JSON.stringify(report,null,2));
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(raw.bones,41);assert.equal(raw.clips.length,6);assert(raw.clips.every(c=>c.finite&&c.maxExtent<2&&c.maxWeaponDrift<.001&&c.minGround>.0004));assert(raw.clips.filter(c=>c.name!=='Idle').every(c=>c.maxVertexMotion>.01),'Animations are frozen');assert(raw.materials.filter(m=>m.texture).every(m=>m.texture.width<=1024));assert.deepEqual(pool,{shared:{geometry:true,material:false,texture:true,independentSkeleton:true,independentBones:true},afterAttack:'Idle',afterDeath:'Death',afterReset:'Idle',removed:true});assert(Math.abs(idle.bounds[1]-2.2)<.01);assert(walkA.vertices.some((v,i)=>Math.hypot(...v.map((x,j)=>x-walkB.vertices[i][j]))>.02));
 console.log(JSON.stringify({passed:true,sha256:report.sha256,clips:raw.clips,pool}));
}finally{await browser.close()}
