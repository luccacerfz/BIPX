import * as THREE from '../vendor/three/three.module.js';
import {createAnimatedEnemies} from '../src/render/animated-enemies.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// CPU lifecycle tests: real Object3D transforms/materials, deliberately small
// controllers. No WebGL, game debug fixtures, browser, or source mutations.
const mainSource=await fs.readFile('src/main.js','utf8');
const lodBody=mainSource.match(/function setZombieLod\(mesh, useProxy\) \{([\s\S]*?)\n\}/)?.[1];
assert(lodBody,'Cannot find main setZombieLod integration');
const setZombieLod=new Function('mesh','useProxy',lodBody);
const results=[];
function harness(){
 const scene=new THREE.Scene(),pool=createAnimatedEnemies({THREE,scene}),controllers=[];
 const counters={created:0,disposed:0,resets:0};let nextId=1;
 const library={create(id,{parent,height}){
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({emissive:0x111111}),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);root.scale.setScalar(height);parent.add(root);
  const stats={currentClip:'Idle',clips:[{name:'Death',duration:1}],animationTime:0};let dead=false,disposed=false;const controller={root,mesh,material,stats,
   update(dt,state={}){if(disposed)throw new Error('Updating disposed actor');dead=Boolean(state.dead);stats.currentClip=dead?'Death':state.speed>0?'Walk':'Idle';stats.animationTime+=dt;},
   attack(){stats.currentClip='Attack';},hit(){},reset(){counters.resets++;dead=false;stats.currentClip='Idle';stats.animationTime=0;root.visible=true;},
   dispose(){assert(!disposed,'Double disposal');disposed=true;counters.disposed++;root.removeFromParent();material.dispose();mesh.geometry.dispose();},
  };controllers.push(controller);counters.created++;return controller;
 }};
 pool.register('orc',library);pool.register('monsters',library);
 function zombie(type='orcPeon',x=1){const mesh=new THREE.Group(),body=new THREE.Group(),proxy=new THREE.Group();body.name='fallback-detail';proxy.name='fallback-proxy';proxy.visible=false;mesh.add(body,proxy);mesh.position.x=x;mesh.userData={detailChildren:[body],lodProxy:proxy,lodState:'detail'};scene.add(mesh);return{id:nextId++,type,mesh,body,proxy,renderMode:'detail',radius:.85,wobble:.3,shadowEnabled:null};}
 function tick(zombies,options={}){pool.update(zombies,{dt:.016,playerPosition:new THREE.Vector3(),quality:'high',...options});}
 return{scene,pool,controllers,counters,zombie,tick};
}
async function test(name,fn){let details;try{details=await fn();results.push({name,passed:true,details});}catch(error){results.push({name,passed:false,message:error.message,details:error.details});}}
function expect(condition,message,details){if(!condition){const error=new Error(message);error.details=details;throw error;}}
await test('desktop/mobile limits and actor disposal',()=>{const h=harness(),z=Array.from({length:45},(_,i)=>h.zombie(i%2?'orcPeon':'zombie',i+1));h.tick(z);assert.equal(h.pool.getStats().active,20);assert.equal(h.counters.created,20);h.tick(z,{mobile:true});assert.equal(h.pool.getStats().active,10);assert.equal(h.pool.getStats().allocated,10);assert.equal(h.counters.disposed,10);return h.pool.getStats();});
await test('corpse keeps world transform after gameplay mesh is recycled',()=>{const h=harness(),z=h.zombie();z.mesh.position.set(3,0,4);z.mesh.rotation.y=.8;z.mesh.scale.set(1.3,1.3,1.3);h.tick([z]);const controller=z.mesh.userData.animatedEnemy;h.scene.updateMatrixWorld(true);const before=controller.root.matrixWorld.clone();h.pool.remove(z,{death:true});z.mesh.position.set(9999,9999,9999);h.scene.remove(z.mesh);h.scene.updateMatrixWorld(true);const delta=Math.max(...before.elements.map((v,i)=>Math.abs(v-controller.root.matrixWorld.elements[i])));assert(delta<1e-9);assert.equal(controller.root.parent,h.scene);assert(!z.mesh.userData.animatedEnemy);return{maximumMatrixDrift:delta};});
await test('pause freezes corpse animation and lifetime',()=>{const h=harness(),z=h.zombie();h.tick([z]);const c=z.mesh.userData.animatedEnemy;h.pool.remove(z,{death:true});const time=c.stats.animationTime;for(let i=0;i<100;i++)h.tick([],{dt:0});assert.equal(c.stats.animationTime,time);assert.equal(h.pool.getStats().corpses,1);return{animationTime:time,corpses:1};});
await test('death fade restores materials and supports repeated clears/restarts',()=>{const h=harness(),z=Array.from({length:20},(_,i)=>h.zombie('orcPeon',i+1));h.tick(z);const c=z[0].mesh.userData.animatedEnemy,base=c.material.emissive.clone();h.pool.hit(z[0]);h.tick(z);h.pool.remove(z[0],{death:true});for(let i=0;i<12;i++)h.tick(z.slice(1),{dt:.1});assert(c.material.opacity<1);h.pool.clear();assert.equal(h.pool.getStats().active,0);assert.equal(h.pool.getStats().corpses,0);assert.equal(c.root.parent,null);assert.equal(c.material.opacity,1);assert.equal(c.material.transparent,false);assert(c.material.emissive.equals(base));for(let cycle=0;cycle<40;cycle++){h.tick(z);h.pool.clear();}assert.equal(h.counters.created,20);assert.equal(h.counters.disposed,0);return h.counters;});
await test('LOD detach preserves the newly selected proxy in the same frame',()=>{const h=harness(),z=h.zombie();h.tick([z]);z.renderMode='proxy';setZombieLod(z.mesh,true);h.tick([z]);const details={detailVisible:z.body.visible,proxyVisible:z.proxy.visible,lodState:z.mesh.userData.lodState,active:h.pool.getStats().active};expect(!z.body.visible&&z.proxy.visible,'Animated detach overwrites the current proxy visibility with the old detail snapshot',details);return details;});
await test('tiny distance oscillation does not rebuild a skeleton every frame',()=>{const h=harness(),steady=Array.from({length:19},(_,i)=>h.zombie('orcPeon',i*.1+1)),a=h.zombie('orcPeon',10),b=h.zombie('zombie',10.01);for(let frame=0;frame<120;frame++){a.mesh.position.x=frame%2?10.01:10;b.mesh.position.x=frame%2?10:10.01;h.tick([...steady,a,b]);}const details={...h.counters,allocated:h.pool.getStats().allocated,frames:120};expect(h.counters.created<=22,'Crossing the final slot by 1 cm repeatedly destroys and rebuilds actor resources',details);return details;});
await test('corpse obeys low-quality shadow policy after death',()=>{const h=harness(),z=h.zombie();h.tick([z]);const c=z.mesh.userData.animatedEnemy;assert(c.mesh.castShadow);h.pool.remove(z,{death:true});h.tick([],{quality:'low'});const details={castShadow:c.mesh.castShadow,receiveShadow:c.mesh.receiveShadow,corpses:h.pool.getStats().corpses};expect(!c.mesh.castShadow,'Corpse retains high-quality shadow casting after quality drops to low',details);return details;});
await test('hit flash decays after an already flashing enemy dies',()=>{const h=harness(),z=h.zombie();h.tick([z]);const c=z.mesh.userData.animatedEnemy,base=c.material.emissive.clone();h.pool.hit(z);h.tick([z]);h.pool.remove(z,{death:true});for(let i=0;i<5;i++)h.tick([],{dt:.1});const details={base:base.toArray(),afterHalfSecond:c.material.emissive.toArray(),corpses:h.pool.getStats().corpses};expect(c.material.emissive.equals(base),'Orc corpse retains the last bright hit emissive until it is recycled',details);return details;});
const paths=['src/render/animated-enemies.js','src/main.js'];const hashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const report={passed:results.every(r=>r.passed),evidence:'CPU lifecycle; real Three.js scene/materials and lightweight controllers, no GPU',hashes,results};await fs.mkdir('output/qa',{recursive:true});await fs.writeFile('output/qa/enemy-pool-lifecycle.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
