import {requireStagingArtefacts} from './quality-staging.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {moduleUrl,sha256} from './class-skill-vfx-support.mjs';

const base='output/vfx-warcry-art-v1',stage=process.argv.includes('--art2')?`${base}/art2`:base;
// Promotion gate of the warcry art candidates against their frozen baseline (untracked output/ tree). The shipped warcry pool is covered by class-skill-vfx-cpu.
requireStagingArtefacts([`${stage}/candidate/class-skill-vfx.js`,`${base}/baseline/source/src/combat/class-skills.mjs`]);
const THREE=await import(await moduleUrl('vendor/three/three.module.js'));
const {createClassSkillVfx}=await import(await moduleUrl(`${stage}/candidate/class-skill-vfx.js`));
const {createSkillState,beginSkill,advanceSkills}=await import(await moduleUrl(`${base}/baseline/source/src/combat/class-skills.mjs`));
const sources=Object.fromEntries(await Promise.all((await fs.readdir(`${stage}/candidate`)).filter(f=>f.endsWith('.js')).map(async f=>[f,sha256(await fs.readFile(`${stage}/candidate/${f}`))])));
const checks=[],scene=new THREE.Scene(),vfx=createClassSkillVfx({THREE,scene,quality:'high'});
const origin={x:0,y:.1,z:0},emitter={x:.6,y:1.4,z:0},id='warrior_war_cry';
const packet=(phase,extra={})=>({skillId:id,castId:'cry',phase,origin,emitter,radius:3,impactAt:.38,...extra});
const stats=()=>vfx.getStats().warcry;
const tick=t=>{while(t>1e-8){const d=Math.min(.1,t);vfx.update(d);t-=d;}};
const check=(name,fn)=>{fn();checks.push({name,passed:true});};
const report={at:new Date().toISOString(),stage:'CPU_ONLY_NO_VISUAL_ACCEPTANCE',sources,checks};
try {
 check('Cast and release alone never grant a buff; duplicate release is ignored',()=>{
  vfx.emit(packet('cast'));tick(.2);assert.equal(stats().buffs,0);assert.equal(stats().instances,4);
  vfx.emit(packet('release'));assert.equal(vfx.emit(packet('release')),false);tick(.1);assert.equal(stats().buffs,0);assert.ok(stats().instances>4);
  tick(.8);assert.equal(stats().instances,0);
 });
 check('Literal core owns .38 release, 8s buff, movement and expiry at10/60Hz',()=>{
  for(const hz of [10,60]){
   vfx.reset();const state=createSkillState('warrior'),actor={x:0,z:0},events=[];
   const emit=e=>{const before=JSON.stringify(e);events.push(structuredClone(e));vfx.emit({...e,emitter});assert.equal(JSON.stringify(e),before);};
   const started=beginSkill(state,{slot:0,aimX:0,aimZ:-1},{...actor,playing:true,runId:`cry-${hz}`});assert.ok(started.ok);emit(started.event);
   for(let n=0;n<hz*9;n++){
    actor.x+=.025;vfx.update(1/hz);advanceSkills(state,1/hz,{actor,emit,targets:[]});
    const buffs=state.buff?.remaining>0?[{id:state.buff.castId,position:{...actor,y:0},remaining:state.buff.remaining,duration:8}]:[];
    vfx.syncState({buffs});vfx.update(0);
    assert.equal(stats().buffs,buffs.length);
    if(buffs.length){assert.equal(stats().records[0].remaining,state.buff.remaining);assert.equal(stats().records[0].position[0],actor.x);}
   }
   assert.equal(events.filter(e=>e.phase==='release').length,1);assert.equal(events.filter(e=>e.phase==='impact').length,0);
   assert.equal(stats().instances,0);assert.equal(stats().buffs,0);
  }
 });
 check('Pause freezes authored clocks and state buffers; low/reduced retain essential identity',()=>{
  vfx.reset();vfx.emit(packet('cast'));tick(.2);vfx.setQuality('low');vfx.setReducedMotion(true);vfx.update(0);
  const mesh=scene.getObjectByName('WarCryArt1Surfaces'),a=mesh.geometry.attributes;
  assert.equal(stats().instances,2);assert.equal(a.aShape.getY(1),3,'Low still includes weapon-directed strand');
  const before=JSON.stringify(stats());const bytes=Array.from(a.aClock.array);for(let i=0;i<60;i++)vfx.update(0);
  assert.equal(JSON.stringify(stats()),before);assert.deepEqual(Array.from(a.aClock.array),bytes);
  vfx.emit(packet('release'));vfx.syncState({buffs:[{id:'cry',position:origin,remaining:8,duration:8}]});tick(.8);
  assert.equal(stats().buffs,1);assert.equal(stats().instances,4);assert.equal(stats().drawCalls,1);assert.equal(mesh.material.uniforms.uMotion.value,0);
 });
 check('Snapshots remove only the expired aura; freeze and gravity stay in existing pools',()=>{
  vfx.syncState({buffs:[],statuses:[{id:'ice',position:{x:3,y:0,z:0},freezeRemaining:2}],fields:[{id:'field',position:{x:4,y:0,z:0},remaining:4,duration:5,radius:5}]});vfx.update(0);
  assert.equal(stats().buffs,0);assert.equal(vfx.getStats().states.frozen,1);assert.equal(vfx.getStats().states.fields,1);
  tick(.3);assert.equal(stats().instances,0);assert.equal(vfx.getStats().states.frozen,1);
 });
 check('Single shared packed-depth request unions roots, invalidates stale data and culls off-camera cry',()=>{
  vfx.reset();vfx.syncState({buffs:[{id:'cry',position:origin,remaining:4,duration:8}]});vfx.update(0);
  const camera=new THREE.PerspectiveCamera(48,16/9,.1,220);camera.position.set(0,7,10);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  const request=vfx.prepareSceneDepth(camera);assert.ok(request.required);assert.equal(request.warcryActors,1);assert.equal(new Set(request.excludeRoots).size,request.excludeRoots.length);
  const texture=new THREE.Texture(),frame={texture,encoding:'rgba-packed',width:1280,height:720,viewport:{x:0,y:0,width:1280,height:720},near:.1,far:220};
  assert.equal(vfx.setSceneDepth(frame),true);assert.equal(stats().depthValid,true);
  assert.equal(vfx.setSceneDepth({...frame,encoding:'depth-texture'}),false);assert.equal(stats().depthValid,false);
  assert.equal(vfx.setSceneDepth(frame),true);vfx.prepareSceneDepth(camera);assert.equal(stats().depthValid,false);
  vfx.syncState({buffs:[{id:'cry',position:{x:1000,y:0,z:0},remaining:4,duration:8}]});vfx.update(0);assert.equal(vfx.prepareSceneDepth(camera).required,false);assert.equal(vfx.setSceneDepth(frame),false);texture.dispose();
 });
 check('Bounded32actor pool keeps allocations constant and exposes overflow',()=>{
  vfx.reset();const bytes=stats().allocatedBytes;vfx.syncState({buffs:Array.from({length:40},(_,i)=>({id:`actor-${i}`,position:{x:i,y:0,z:0},remaining:8,duration:8}))});vfx.update(0);
  assert.equal(stats().active,32);assert.ok(stats().dropped>=8);assert.equal(stats().allocatedBytes,bytes);
  for(const a of Object.values(scene.getObjectByName('WarCryArt1Surfaces').geometry.attributes))for(const x of a.array)assert.ok(Number.isFinite(x));
 });
 check('Reset/death cleanup leaves no end particles or depth request; dispose detaches owned mesh',()=>{
  vfx.reset();assert.equal(stats().instances,0);assert.equal(stats().active,0);assert.equal(stats().depthValid,false);
  vfx.dispose();assert.equal(stats().disposed,true);assert.equal(scene.getObjectByName('WarCryArt1Surfaces'),undefined);assert.equal(vfx.emit(packet('cast')),false);
 });
 const baseline=JSON.parse(await fs.readFile(`${base}/baseline/manifest.json`,'utf8'));
 report.runtimeVfxUnchanged=Object.entries(baseline.sourceHashes).filter(([p])=>p.startsWith('src/vfx/')).every(([p,hash])=>sources[p.slice(8)]===hash||p.endsWith('/class-skill-vfx.js'));
 const live=await Promise.all(Object.entries(baseline.sourceHashes).filter(([p])=>p.startsWith('src/vfx/')).map(async([p,hash])=>({p,equal:sha256(await fs.readFile(p))===hash})));
 report.runtimeVfxUnchanged=live.every(r=>r.equal);assert.ok(report.runtimeVfxUnchanged);
 report.passed=true;
}catch(error){report.passed=false;report.error={message:error.message,stack:error.stack?.split('\n').filter(s=>!s.includes('data:text/javascript'))};process.exitCode=1;}
finally{vfx.dispose();const file=`${stage}/cpu-${report.at.replaceAll(':','-').replaceAll('.','-')}.json`;await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({file,passed:report.passed,checks:checks.length,error:report.error?.message}));}
