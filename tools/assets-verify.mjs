import { suiteUrl } from './quality-target.mjs';
import { chromium, browserLaunchOptions, attachQualityTelemetry, evidenceDir } from './quality-browser.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const out=path.resolve(evidenceDir);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(browserLaunchOptions);
const page=await browser.newPage({viewport:{width:1200,height:900}});
const telemetry=attachQualityTelemetry(page,'imported-assets');
telemetry.markFixture();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try {
await page.goto(await suiteUrl('/src/assets/asset-preview.html?manual=1'));
await page.waitForFunction(()=>window.assetReview?.ready,{timeout:30000});
await page.evaluate(()=>window.assetReview.pause());
const sample=async()=>page.evaluate(()=>{
 const {hero,THREE}=window.assetReview;
 hero.root.updateMatrixWorld(true);
 const body=hero.model.getObjectByName('HeroBody');
 body.skeleton.update();
 const vertices=[0,100,500,1000,1500,2000].map(i=>body.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(body.matrixWorld).toArray());
 const bones={};for(const bone of body.skeleton.bones)if(/Hand$|Foot$|Hips$/.test(bone.name))bones[bone.name]=bone.getWorldPosition(new THREE.Vector3()).toArray();
 const maps=[];hero.model.traverse(o=>{if(o.isMesh){const m=o.material;maps.push({name:o.name,vertices:o.geometry.attributes.position.count,texture:m.map?{width:m.map.image.width,height:m.map.image.height}:null});}});
 return {stats:structuredClone(hero.stats),bounds:new THREE.Box3().setFromObject(hero.root,true).getSize(new THREE.Vector3()).toArray(),vertices,bones,weapon:hero.weapon.getWorldPosition(new THREE.Vector3()).toArray(),maps};
});
const idle=await sample();
await page.screenshot({path:path.join(out,'hero-idle.png')});
await page.evaluate(()=>{window.assetReview.setState({speed:5});for(let i=0;i<4;i++)window.assetReview.setTime(.1);});
const runA=await sample();
await page.screenshot({path:path.join(out,'hero-run-a.png')});
await page.evaluate(()=>{for(let i=0;i<3;i++)window.assetReview.setTime(.1);});
const runB=await sample();
await page.screenshot({path:path.join(out,'hero-run-b.png')});
await page.evaluate(()=>{window.assetReview.setState({speed:0,attack:true,duration:1.5});for(let i=0;i<5;i++)window.assetReview.setTime(.1);});
const attack=await sample();
await page.screenshot({path:path.join(out,'hero-attack.png')});
for(const name of ['cedar-tree','lantern-post','rune-portal','ruined-wall']){
 await page.evaluate(name=>window.assetReview.show(name),name);
 await page.screenshot({path:path.join(out,name+'.png')});
}
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const motion=runA.vertices.map((v,i)=>distance(v,runB.vertices[i]));
await fs.writeFile(path.join(out,'debug-samples.json'),JSON.stringify({idle,runA,runB,attack,motion,errors},null,2));
const fullClips=await page.evaluate(async()=>{
 const {THREE}=window.assetReview;
 const {GLTFLoader}=await import('/src/assets/vendor/GLTFLoader.js');
 const gltf=await new GLTFLoader().loadAsync('/assets/models/aldric-hero.glb');
 const model=gltf.scene, mixer=new THREE.AnimationMixer(model);
 const body=model.getObjectByName('HeroBody'), sword=model.getObjectByName('HeroSword'), shield=model.getObjectByName('HeroShield');
 const right=body.skeleton.bones.filter(b=>b.name.includes('RightHand')).sort((a,b)=>a.name.length-b.name.length)[0];
 const left=body.skeleton.bones.filter(b=>b.name.includes('LeftHand')).sort((a,b)=>a.name.length-b.name.length)[0];
 const clips=[];
 for(const clip of gltf.animations){
  mixer.stopAllAction();
  const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  let swordBind,shieldBind,maxSwordDrift=0,maxShieldDrift=0,maxExtent=0,minGround=Infinity,maxGround=-Infinity,finite=true;
  const frames=Math.round(clip.duration*30)+1;
  for(let frame=0;frame<frames;frame++){
   mixer.setTime(frame/30);model.updateMatrixWorld(true);body.skeleton.update();
   const swordRelative=right.matrixWorld.clone().invert().multiply(sword.matrixWorld);
   const shieldRelative=left.matrixWorld.clone().invert().multiply(shield.matrixWorld);
   swordBind??=swordRelative.clone();shieldBind??=shieldRelative.clone();
   maxSwordDrift=Math.max(maxSwordDrift,...swordRelative.elements.map((v,i)=>Math.abs(v-swordBind.elements[i])));
   maxShieldDrift=Math.max(maxShieldDrift,...shieldRelative.elements.map((v,i)=>Math.abs(v-shieldBind.elements[i])));
   const box=new THREE.Box3().setFromObject(body,true),size=box.getSize(new THREE.Vector3());
   maxExtent=Math.max(maxExtent,size.x,size.y,size.z);
   minGround=Math.min(minGround,box.min.y);maxGround=Math.max(maxGround,box.min.y);
   finite&&=[...box.min.toArray(),...box.max.toArray(),...swordRelative.elements,...shieldRelative.elements].every(Number.isFinite);
  }
  clips.push({name:clip.name,frames,maxSwordDrift,maxShieldDrift,maxExtent,minGround,maxGround,finite});
 }
 const treeA=window.assetReview.env.instantiate('cedar-tree',{tint:0x89aeba}),treeB=window.assetReview.env.instantiate('cedar-tree',{tint:0x89aeba});
 const meshesA=[],meshesB=[];treeA.traverse(o=>{if(o.isMesh)meshesA.push(o)});treeB.traverse(o=>{if(o.isMesh)meshesB.push(o)});
 return {boneNames:{right:right.name,left:left.name},clips,treeResourcesShared:meshesA.every((a,i)=>a.geometry===meshesB[i].geometry&&a.material===meshesB[i].material)};
});
await fs.writeFile(path.join(out,'all-clips.json'),JSON.stringify(fullClips,null,2));
const transitions=await page.evaluate(()=>{
 const {hero}=window.assetReview;
 hero.attack({duration:.2});for(let i=0;i<5;i++)hero.update(.1,{speed:0});const afterAttack=hero.stats.currentClip;
 for(let i=0;i<30;i++)hero.update(.1,{dead:true});const afterDeath=hero.stats.currentClip;
 hero.update(.1,{dead:false,speed:0});const afterRevive=hero.stats.currentClip;
 return {afterAttack,afterDeath,afterRevive};
});
assert(errors.length===0,errors.join('\n'));
assert(idle.stats.bones===65);
assert(idle.stats.clips.length===7);
assert(Math.abs(idle.bounds[1]-2.4)<.04,`Bad runtime height ${idle.bounds[1]}`);
assert(motion.some(v=>v>.1),'No skinned vertex movement between run frames');
assert(idle.maps.every(m=>m.texture&&m.texture.width<=1024),'Missing/oversized runtime texture');
assert(fullClips.treeResourcesShared,'Repeated tree instances duplicate geometry or material');
assert(fullClips.clips.every(c=>c.finite&&c.maxExtent<2),'Nonfinite/exploded skinned geometry');
assert(fullClips.clips.every(c=>c.maxSwordDrift<.003&&c.maxShieldDrift<.003),'Weapon contact drift detected');
assert.deepEqual(transitions,{afterAttack:'Idle',afterDeath:'Death',afterRevive:'Idle'});
const report={errors,idle,runA,runB,attack,motion,fullClips,transitions,assetBytes:(await fs.readdir('assets/models')).filter(n=>n.endsWith('.glb')).map(async n=>[n,(await fs.stat('assets/models/'+n)).size])};
report.assetBytes=await Promise.all(report.assetBytes);
report.assetSha256=Object.fromEntries(await Promise.all(report.assetBytes.map(async([name])=>[name,createHash('sha256').update(await fs.readFile('assets/models/'+name)).digest('hex')])));
await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2));
telemetry.report.assetHashes=report.assetSha256;
telemetry.report.measurements={motion,fullClips,transitions,assetBytes:report.assetBytes};
telemetry.assertClean();
console.log(JSON.stringify({errors,bones:idle.stats.bones,clips:idle.stats.clips.map(c=>c.name),runtimeHeight:idle.bounds[1],vertexMotion:motion,assetBytes:report.assetBytes}));
} catch(error) {
  telemetry.fail(error);
  throw error;
} finally {
  await telemetry.save();
  await browser.close();
}

