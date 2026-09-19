import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const out=path.resolve('output/playwright/monsters');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=metal']});
const report={syntheticFixture:true,evidenceKind:'Native Chrome rendering of isolated imported assets; not gameplay',errors:[],clips:{},screenshots:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${process.env.MONSTER_REVIEW_ORIGIN||'http://localhost:5276'}/tools/monster-preview.html?manual=1`);
 await page.waitForFunction(()=>window.monsterReview?.ready,{timeout:30000});
 async function capture(name){await page.screenshot({path:path.join(out,`${name}.png`)});report.screenshots.push(`${name}.png`);}
 const sample=()=>page.evaluate(()=>{
  const{THREE,actors}=window.monsterReview;
  return actors.map(a=>{
   a.root.updateMatrixWorld(true);let body;a.model.traverse(o=>{if(o.isSkinnedMesh){body=o;o.skeleton.update();}});
   const box=new THREE.Box3().setFromObject(a.root,true);
   return {id:a.stats.id,stats:structuredClone(a.stats),min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray(),
    pose:[0,100,500,1000,3000,5000].map(i=>body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(body.matrixWorld).toArray()),
    bones:body.skeleton.bones.map(b=>({name:b.name,position:b.getWorldPosition(new THREE.Vector3()).sub(a.root.position).toArray()}))};
  });
 });
 report.initial=await sample();await capture('idle-front');
 const states=[['Idle',{reset:true,speed:0},3.3],['Walk',{reset:true,speed:1.6},2.5],['Run',{reset:true,speed:4},1.5],['Attack',{reset:true,attack:true,duration:2.15},2.2],['Death',{reset:true,dead:true},3.4]];
 for(const[name,state,duration]of states){
  await page.evaluate(s=>window.monsterReview.setState({...s,label:s.dead?'Death':s.attack?'Attack':s.speed?'Locomotion':'Idle'}),state);
  const frames=[];
  for(let i=0;i<Math.ceil(duration*10);i++){
   await page.evaluate(()=>window.monsterReview.step(.1));frames.push(await sample());
   if((name==='Attack'&&[3,8,14].includes(i))||(name==='Death'&&[7,19,32].includes(i))||(name==='Run'&&[3,8].includes(i)))await capture(`${name.toLowerCase()}-${i}`);
  }
  report.clips[name]=frames;
 }
 report.isolation=await page.evaluate(()=>{
  const{library,actors,THREE,scene}=window.monsterReview;
  const a=actors[0],b=library.create('zombie',{parent:scene});b.root.position.set(20,0,0);
  const firstMesh=c=>{let m;c.model.traverse(o=>{if(o.isSkinnedMesh)m=o;});return m;};
  const ma=firstMesh(a),mb=firstMesh(b);a.reset();b.reset();
  const sharedGeometry=ma.geometry===mb.geometry,sharedTexture=ma.material.map===mb.material.map,uniqueMaterial=ma.material!==mb.material,uniqueSkeleton=ma.skeleton!==mb.skeleton;
  a.hit();a.update(.01);const flashIsolated=!ma.material.emissive.equals(mb.material.emissive);
  a.attack({duration:.5});for(let i=0;i<7;i++)a.update(.1,{speed:0});const attackReturnsIdle=a.stats.currentClip==='Idle';
  a.update(.1,{dead:true});for(let i=0;i<40;i++)a.update(.1,{dead:true});const deathHeld=a.stats.currentClip==='Death';
  a.reset();const resetReturnsIdle=a.stats.currentClip==='Idle'&&!a.stats.dead;
  const time=a.stats.animationTime;a.update(0,{speed:0});const pauseFrozen=a.stats.animationTime===time;
  const before=library.stats.activeActors;b.dispose();b.dispose();const disposeIdempotent=library.stats.activeActors===before-1;
  return{sharedGeometry,sharedTexture,uniqueMaterial,uniqueSkeleton,flashIsolated,attackReturnsIdle,deathHeld,resetReturnsIdle,disposeIdempotent,pauseFrozen};
 });
 report.pool=await page.evaluate(()=>{const{library,scene}=window.monsterReview;const extra=[];for(let i=library.stats.activeActors;i<20;i++)extra.push(library.create(library.ids[i%3],{parent:scene}));const total=library.stats.activeActors;for(const a of extra)a.dispose();return{total,after:library.stats.activeActors};});
 report.glError=await page.evaluate(()=>window.monsterReview.renderer.getContext().getError());
 report.cleanup=await page.evaluate(()=>{const{library,renderer,scene,camera}=window.monsterReview;library.dispose();library.dispose();renderer.render(scene,camera);return{active:library.stats.activeActors,loaded:library.stats.loaded};});
 assert.equal(report.errors.length,0,report.errors.join('\n'));assert.equal(report.glError,0);
 for(const value of Object.values(report.isolation))assert.equal(value,true,'Actor isolation or lifecycle failed');
 assert.equal(report.cleanup.active,0);assert.equal(report.cleanup.loaded,false);
 assert.equal(report.pool.total,20);assert.equal(report.pool.after,3);
 for(const frame of Object.values(report.clips).flat())for(const a of frame){assert([...a.min,...a.max,...a.pose.flat()].every(Number.isFinite));assert(Math.max(...a.size)<a.stats.runtimeHeight*3,'Exploding bounds');assert(Math.abs(a.min[1])<.025,`${a.id} floated or penetrated ground: ${a.min[1]}`);}
 for(const frames of Object.values(report.clips))for(let actor=0;actor<3;actor++)assert(frames.some(frame=>frame[actor].pose.some((v,i)=>Math.hypot(...v.map((x,k)=>x-frames[0][actor].pose[i][k]))>.015)),'Animation pose did not change');
 report.passed=true;
}catch(error){report.failure=String(error);throw error;}finally{
 report.hashes={};for(const file of ['src/assets/monster-library.js','assets/models/monsters/zombie.glb','assets/models/monsters/brute.glb','assets/models/monsters/lich.glb'])report.hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
 await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));await browser.close();
 console.log(JSON.stringify({passed:report.passed,errors:report.errors,failure:report.failure,isolation:report.isolation,report:path.join(out,'verification.json')}));
}
