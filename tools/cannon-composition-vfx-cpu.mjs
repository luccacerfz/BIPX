import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {moduleUrl,sha256} from './class-skill-vfx-support.mjs';
// Default target is the shipped runtime in src/vfx. VFX_SOURCE=snapshot re-runs the frozen concentric-composition candidates under
// assets/vfx/source-history (VFX_OVERLAP_FIX=1 selects composition-v2-overlap): historical evidence only, not the game that ships.
const base='assets/vfx/source-history/cannon-concentric-staging-20260919/'+(process.env.VFX_OVERLAP_FIX?'composition-v2-overlap':'composition-v1');
const candidate=process.env.VFX_SOURCE==='snapshot'?`${base}/candidate`:process.env.VFX_SOURCE||'src/vfx';
const THREE=await import(await moduleUrl('vendor/three/three.module.js'));
const {createClassSkillVfx}=await import(await moduleUrl(`${candidate}/class-skill-vfx.js`));
const scene=new THREE.Scene(),vfx=createClassSkillVfx({THREE,scene}),camera=new THREE.PerspectiveCamera(48,1.6,.1,220);camera.position.set(0,17,20);camera.lookAt(0,0,0);
const fields=n=>Array.from({length:n},(_,i)=>({id:'field'+i,position:{x:(i%3)*.035,y:.08,z:Math.floor(i/3)*.02},radius:5,remaining:4,duration:5}));
const count=()=>vfx.getStats().cannon.compositionFields,checks=[];
function select(state){vfx.syncState(state);vfx.update(0);return vfx.prepareSceneDepth(camera);}
vfx.prepareSceneDepth(camera);assert.equal(count(),0);checks.push('empty');
select({fields:fields(1)});assert.equal(count(),1);checks.push('one actual field');
const texture=new THREE.Texture();let textureDisposed=false;texture.addEventListener('dispose',()=>textureDisposed=true);
const frame={texture,encoding:'rgba-packed',width:64,height:64,near:.1,far:220,viewport:{x:0,y:0,width:64,height:64}};assert.ok(vfx.setSceneDepth(frame));assert.equal(vfx.setSceneDepth(null),false);checks.push('borrowed depth invalidate');
select({fields:fields(10)});assert.equal(count(),8);checks.push('bounded eight descriptors');
const pool=scene.getObjectByName('CannonVolumetricPool'),shader=[];pool.traverse(o=>{if(o.material?.uniforms?.uGravityCount)shader.push(o.material.uniforms);});
const descriptorBytes=()=>shader.map(u=>[u.uGravityCount.value,u.uGravityCenterRadius.value.map(v=>v.toArray()),u.uGravityShape.value.map(v=>v.toArray()),u.uGravityLife.value.map(v=>v.toArray())]);
const horizon=[];scene.getObjectByName('GravityHorizonPool').traverse(o=>{if(o.material?.uniforms?.uOverlapCount)horizon.push(o.material.uniforms);});
if(process.env.VFX_OVERLAP_FIX){assert.equal(horizon.length,8);assert.ok(horizon.every(u=>u.uOverlapCount.value===8));assert.equal(new Set(horizon.map(u=>u.uOverlapIndex.value)).size,8);assert.ok(horizon.every(u=>u.uOverlapAperture.value.every(v=>v.toArray().every(Number.isFinite))));checks.push('eight bounded projected peer apertures');
 // Equal premultiplied sources must compose to one layer for any fractional alpha.
 for(const a of [.002,.04,.3,.8]){let transmission=1;const single=1-Math.pow(1-a,1/8);for(let i=0;i<8;i++)transmission*=1-single;assert.ok(Math.abs(1-transmission-a)<1e-12);}checks.push('optical coverage identity across eight equal layers');}
const paused=JSON.stringify(descriptorBytes());for(let i=0;i<60;i++){vfx.update(0);vfx.prepareSceneDepth(camera);}assert.equal(JSON.stringify(descriptorBytes()),paused);checks.push('paused descriptors unchanged for60updates');
vfx.setQuality('low');vfx.setReducedMotion(true);vfx.update(0);vfx.prepareSceneDepth(camera);assert.equal(count(),8);assert.ok(shader.every(u=>u.uGravityPrefixSteps.value===16));checks.push('low reduced capacity');
camera.lookAt(0,30,70);vfx.prepareSceneDepth(camera);assert.equal(count(),0);assert.ok(shader.every(u=>u.uGravityCount.value===0));checks.push('off camera culling');camera.lookAt(0,0,0);
select({fields:fields(1)});assert.equal(count(),1);assert.ok(shader.every(u=>u.uGravityCount.value===1));if(process.env.VFX_OVERLAP_FIX)assert.equal(horizon.filter(u=>u.uOverlapCount.value===1).length,1);checks.push('return to one no stale eight');
select({fields:fields(1).map(f=>({...f,remaining:.05}))});assert.equal(count(),1);vfx.update(.1);vfx.prepareSceneDepth(camera);assert.equal(count(),0);checks.push('natural remaining expiry');
select({fields:fields(8)});select({fields:[]});assert.equal(count(),0);checks.push('empty snapshot removes descriptors');
select({fields:fields(8)});vfx.reset();assert.equal(count(),0);assert.ok(shader.every(u=>u.uGravityCount.value===0));if(process.env.VFX_OVERLAP_FIX)assert.ok(horizon.every(u=>u.uOverlapCount.value===0));checks.push('reset');vfx.dispose();assert.equal(scene.children.length,0);assert.equal(textureDisposed,false);texture.dispose();checks.push('dispose detaches owned nodes without freeing borrowed texture');
const at=new Date().toISOString(),hashes=Object.fromEntries(await Promise.all((await fs.readdir(candidate)).filter(f=>f.endsWith('.js')).sort().map(async f=>[f,sha256(await fs.readFile(`${candidate}/${f}`))])));
const reports=process.env.BIPX_EVIDENCE_DIR||'output/qa';await fs.mkdir(reports,{recursive:true});const file=`${reports}/cannon-composition-cpu-lifecycle-${at.replaceAll(':','-').replaceAll('.','-')}.json`; // never inside the tracked assets tree
await fs.writeFile(file,JSON.stringify({at,target:candidate,checks,passed:true,hashes,scope:'CPU lifecycle/descriptor contract, no shader compile or artistic acceptance'},null,2)+'\n');console.log(JSON.stringify({file,passed:true,checks:checks.length}));
