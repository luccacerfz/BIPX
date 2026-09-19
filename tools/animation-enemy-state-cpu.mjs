import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THREE } from './hero-locomotion-cpu-support.mjs';
import { loadEnemyLibrary } from '../src/assets/enemy-library.js';
import { loadMonsterLibrary } from '../src/assets/monster-library.js';
import { createEnemyDeathCut } from '../src/assets/enemy-death-cut.js';
import { createAnimatedEnemies } from '../src/render/animated-enemies.js';

const orcs=await loadEnemyLibrary({THREE}),monsters=await loadMonsterLibrary({THREE});
const result={scope:'CPU actual skinned rigs, frozen pose, complement clipping, ownership and pool reuse. Not render/gameplay proof.',actors:[],pool:{},hashes:{}};
const pose=root=>{root.updateWorldMatrix(true,true);const data=[];root.traverse(o=>{if(o.isBone)data.push(...o.matrixWorld.elements);});return data;};
for(const [id,library] of [['orcPeon',orcs],['zombie',monsters],['brute',monsters],['lich',monsters]]){
 const scene=new THREE.Scene(),parent=new THREE.Group();scene.add(parent);const actor=library.create(id,{parent,height:2.6});
 for(let i=0;i<60;i++)actor.update(1/60,{speed:3.7});
 for(const status of ['freezeTimer','stunTimer']){
  const before=pose(actor.root),time=actor.stats.animationTime;
  for(let i=0;i<45;i++){actor.update(1/60,{speed:3.7,[status]:1});actor.attack({duration:.5});actor.hit();}
  assert.deepEqual(pose(actor.root),before,`${id} moved during ${status}`);assert.equal(actor.stats.animationTime,time);
  actor.update(1/60,{speed:3.7});assert.notEqual(actor.stats.animationTime,time,`${id} did not resume`);
 }
 scene.attach(actor.root);actor.root.updateMatrixWorld(true);
 const sourceMaterials=[],geometries=new Set();let sourceMesh;
 actor.root.traverse(o=>{if(o.isMesh){sourceMaterials.push(...(Array.isArray(o.material)?o.material:[o.material]));geometries.add(o.geometry);if(o.isSkinnedMesh&&!sourceMesh)sourceMesh=o;}});
 let geometryDisposals=0;for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++);
 const before=pose(actor.root),cut=createEnemyDeathCut({THREE,scene,source:actor.root,direction:{x:1,z:0},hideSource:false});assert(cut);assert.equal(cut.parts.length,2);
 const frozen=pose(cut.parts[0].root);assert.equal(frozen.length,before.length);assert(Math.max(...frozen.map((v,i)=>Math.abs(v-before[i])))<1e-5);
 const planes=cut.parts.map(p=>p.plane);assert(planes[0].normal.clone().add(planes[1].normal).length()<1e-10);assert(Math.abs(planes[0].constant+planes[1].constant)<1e-10);
 sourceMesh.skeleton.update();let top=0,bottom=0;
 for(let v=0;v<sourceMesh.geometry.attributes.position.count;v++){
  const point=sourceMesh.getVertexPosition(v,new THREE.Vector3()).applyMatrix4(sourceMesh.matrixWorld),a=planes[0].distanceToPoint(point),b=planes[1].distanceToPoint(point);
  assert(a>=-1e-8||b>=-1e-8);if(a>0)top++;if(b>0)bottom++;
 }
 assert(top>0&&bottom>0,`${id}: bisection has an empty half`);
 for(let i=0;i<30;i++)cut.update(1/60);
 assert(cut.parts[0].pivot.position.distanceTo(cut.parts[1].pivot.position)>.1);
 assert.deepEqual(pose(actor.root),before,'Corpse effect changed live source');
 for(const m of sourceMaterials)assert.equal(m.clippingPlanes,null);
 actor.update(.016,{dead:true,freezeRemaining:5,stunRemaining:5});assert.equal(actor.stats.currentClip,'Death');assert(!actor.stats.control.paused);
 cut.dispose();cut.dispose();assert.equal(geometryDisposals,0);assert(cut.parts.every(p=>!p.pivot.parent));
 actor.reset();assert(!actor.stats.control.paused);actor.dispose();
 result.actors.push({id,statusPoseFrozen:true,resumes:true,deathOverridesStatus:true,sourceUntouched:true,sharedGeometryPreserved:geometryDisposals===0,topVertices:top,bottomVertices:bottom});
}
const scene=new THREE.Scene(),pool=createAnimatedEnemies({THREE,scene});pool.register('orc',orcs);pool.register('monsters',monsters);
let serial=0;const entity=()=>{const mesh=new THREE.Group();mesh.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial()));scene.add(mesh);return{id:++serial,type:'orcPeon',mesh,renderMode:'detail',radius:.85};};
const tick=(z,dt=.016)=>pool.update(z,{dt,playerPosition:new THREE.Vector3(),quality:'low'});
let z=entity();tick([z]);const source=z.mesh.userData.animatedEnemy;
z.freezeTimer=2;tick([z]);assert(source.stats.control.frozen);
pool.remove(z,{death:false,deathStyle:'bisect',killedBySkillId:'warrior_cleaving_dash'});assert.equal(pool.getStats().cutCorpses,0);
tick([z]);pool.remove(z,{death:true,deathStyle:'bisect',killedBySkillId:'other'});assert.equal(pool.getStats().cutCorpses,0);pool.clear();
z=entity();tick([z]);pool.remove(z,{death:true,deathStyle:'cleave',direction:{x:1,z:0}});assert.equal(pool.getStats().cutCorpses,1);
const reused=entity();tick([reused]);assert(reused.mesh.userData.animatedEnemy.root.visible);reused.mesh.userData.animatedEnemy.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])assert.equal(m.clippingPlanes,null);});
const count=pool.getStats().cutCorpses;for(let i=0;i<100;i++)tick([reused],0);assert.equal(pool.getStats().cutCorpses,count);
for(let i=0;i<18;i++)tick([reused],.1);assert.equal(pool.getStats().cutCorpses,0);
const fallback=entity();pool.remove(fallback,{death:true,deathStyle:'bisect',killedBySkillId:'warrior_cleaving_dash'});assert.equal(pool.getStats().cutCorpses,1);pool.clear();assert.equal(pool.getStats().cutCorpses,0);
result.pool={onlyDashDeaths:true,reuseUncut:true,pauseLifetime:true,expiry:true,fallback:true,clear:true};
for(const file of ['src/assets/enemy-control-state.js','src/assets/enemy-death-cut.js','src/assets/enemy-library.js','src/assets/monster-library.js','src/render/animated-enemies.js'])result.hashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
const reportFile=process.env.ANIMATION_ENEMY_CPU_OUTPUT || `${process.env.BIPX_EVIDENCE_DIR||'output/arpg-animation'}/enemy-state-v2-cpu.json`;await fs.mkdir(reportFile.replace(/\/[^/]*$/,''),{recursive:true});await fs.writeFile(reportFile,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
