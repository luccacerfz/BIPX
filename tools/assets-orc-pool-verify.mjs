import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// CPU-only contract check: no renderer or WebGL context is constructed.
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-gpu']});
try {
 const page=await browser.newPage();await page.goto('http://localhost:5276/docs/orc-peon.md');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/vendor/three/three.module.js');const{loadEnemyLibrary}=await import('/src/assets/enemy-library.js');const library=await loadEnemyLibrary({THREE});const parent=new THREE.Group();const a=library.create('orcPeon',{parent}),b=library.create('orcPeon',{parent});const ab=a.model.getObjectByName('OrcBody'),bb=b.model.getObjectByName('OrcBody');
  const originalColor=bb.material.color.getHex();ab.material.color.set(0xff0000);ab.material.opacity=.2;ab.material.transparent=true;ab.material.depthWrite=false;
  const isolated=bb.material.color.getHex()===originalColor&&bb.material.opacity===1&&!bb.material.transparent&&bb.material.depthWrite;
  a.reset();const reset=ab.material.color.getHex()===originalColor&&ab.material.opacity===1&&!ab.material.transparent&&ab.material.depthWrite;
  const mats=new Set();a.model.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m))});let materialDisposals=0,geometryDisposals=0,textureDisposals=0;for(const m of mats)m.addEventListener('dispose',()=>materialDisposals++);ab.geometry.addEventListener('dispose',()=>geometryDisposals++);ab.material.map.addEventListener('dispose',()=>textureDisposals++);
  const sharedGeometry=ab.geometry===bb.geometry,sharedTexture=ab.material.map===bb.material.map,independentMaterials=ab.material!==bb.material,independentSkeletons=ab.skeleton!==bb.skeleton;a.dispose();
  b.attack({duration:.85});for(let i=0;i<12;i++)b.update(.1);const attackToIdle=b.stats.currentClip==='Idle';for(let i=0;i<20;i++)b.update(.1,{dead:true});const deathClamped=b.stats.currentClip==='Death';b.reset();const revived=b.stats.currentClip==='Idle';
  return{isolated,reset,sharedGeometry,sharedTexture,independentMaterials,independentSkeletons,materialDisposals,materialCount:mats.size,geometryDisposals,textureDisposals,remainingActors:parent.children.length,attackToIdle,deathClamped,revived};
 });
 const sha256=createHash('sha256').update(await fs.readFile('assets/models/orc-peon.glb')).digest('hex');await fs.writeFile('output/playwright/orc/pool-materials.json',JSON.stringify({sha256,...result},null,2));
 for(const key of ['isolated','reset','sharedGeometry','sharedTexture','independentMaterials','independentSkeletons','attackToIdle','deathClamped','revived'])assert(result[key],key);
 assert.equal(result.materialDisposals,result.materialCount);assert.equal(result.geometryDisposals,0);assert.equal(result.textureDisposals,0);assert.equal(result.remainingActors,1);console.log(JSON.stringify({passed:true,sha256,...result}));
}finally{await browser.close()}
