// Prepare a reviewable Animation-owned take package. No runtime promotion.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {THREE} from './hero-locomotion-cpu-support.mjs';
import {loadGlb} from '../src/assets/load-glb.js';
import {clone} from '../src/assets/vendor/SkeletonUtils.js';
const out=path.resolve(process.argv[2]||'output/arpg-animation/lich-profile-plan');
await fs.mkdir(out,{recursive:false});
const files=['src/assets/monster-library.js','src/render/animated-enemies.js',
 'src/assets/enemy-death-cut.js','src/assets/hero-locomotion.js',
 'assets/models/monsters/lich.glb','assets/models/monsters/zombie.glb','assets/models/monsters/brute.glb',
 'output/lich-cast-v1/assets/lich.glb','output/lich-cast-v1/lich-cast-profile.js',
 'output/lich-cast-v1/monster-library-staged.js',
 'output/lich-cast-v1/combat-proposal/caster-cast.mjs',
 'output/lich-cast-v1/combat-proposal/caster-caller-boundary.mjs'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await fs.readFile(f))])));
const before=await hashes();
assert.equal(before['output/lich-cast-v1/assets/lich.glb'],'d47d9a13ab7d3df9b1df1018735d56075fdedeb32b266c3ffcb9d3ca3a576599');
const open=f=>loadGlb(new URL(f,`file://${process.cwd()}/`));
const [baseline,candidate]=await Promise.all([open('assets/models/monsters/lich.glb'),open('output/lich-cast-v1/assets/lich.glb')]);
const full=candidate.animations[3];assert.equal(full.name,'Attack');assert.equal(full.tracks.length,24);
const data={profileId:'lich-mixamo-cast-v1',actorType:'caster',visualId:'lich',
 source:{file:'output/lich-cast-v1/assets/lich.glb',sha256:before['output/lich-cast-v1/assets/lich.glb'],clipIndex:3},
 clip:THREE.AnimationClip.toJSON(full)};
// This is an exact clip serialization, not another retarget or GLB export.
const encoded=JSON.stringify(data),round=THREE.AnimationClip.parse(JSON.parse(encoded).clip);
assert.equal(round.duration,full.duration);
for(let i=0;i<full.tracks.length;i++) {
 const a=full.tracks[i],b=round.tracks[i];assert.equal(b.name,a.name);
 assert.equal(b.getInterpolation(),a.getInterpolation());
 assert.deepEqual([...b.times],[...a.times]);assert.deepEqual([...b.values],[...a.values]);
}
const {LICH_CAST_PROFILE:profile}=await import('../output/lich-cast-v1/lich-cast-profile.js');
assert.equal(round.duration,profile.sourceDuration);assert.equal(profile.crop,null);
// Reuse exactly the reviewed SFX normalization for this compatibility proof.
// The future runtime patch must make this profile opt-in per caster instance.
const loader=await fs.readFile('output/lich-cast-v1/monster-library-staged.js','utf8');
const start=loader.indexOf('function sliceClip('),end=loader.indexOf('export async function loadMonsterLibrary');
assert(start>=0&&end>start);
const normalize=vm.runInNewContext("const ROLES=['Idle','Walk','Run','Attack','Death'];\n"+loader.slice(start,end)+'\nnormalizeClips;');
const normalizeSource=(source,attack)=>normalize(THREE,{scene:source.scene,animations:source.animations.map((c,i)=>i===3?attack:c)},profile)[3];
const normalized=[normalizeSource(candidate,full),normalizeSource(baseline,round)];
const models=[clone(candidate.scene),clone(baseline.scene)];
const bones=models.map(m=>{const list=[];m.traverse(o=>{if(o.isBone)list.push(o);});return list;});
assert.deepEqual(bones[0].map(b=>b.name),bones[1].map(b=>b.name));
const mixers=models.map((m,i)=>{const x=new THREE.AnimationMixer(m);const a=x.clipAction(normalized[i]);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();return x;});
let maximumBoneMatrixDifference=0;const samples=[];
for(const elapsed of [0,.225,.565,profile.releaseAt,.63,.8,1.05,profile.duration]) {
 const clipTime=elapsed/profile.duration*profile.sourceDuration;
 models.forEach((m,i)=>{mixers[i].setTime(clipTime);m.updateMatrixWorld(true);});
 for(let i=0;i<bones[0].length;i++)for(let j=0;j<16;j++)maximumBoneMatrixDifference=Math.max(maximumBoneMatrixDifference,Math.abs(bones[0][i].matrixWorld.elements[j]-bones[1][i].matrixWorld.elements[j]));
 samples.push({elapsed,clipTime,socketRawWorld:models.map(m=>m.getObjectByName(profile.socketName).getWorldPosition(new THREE.Vector3()).toArray())});
}
assert(maximumBoneMatrixDifference<1e-9,'Sidecar on the preserved rig differs from the reviewed GLB');
const after=await hashes();assert.deepEqual(after,before);
await fs.writeFile(path.join(out,'lich-cast-clips.json'),encoded+'\n');
await fs.copyFile('output/lich-cast-v1/lich-cast-profile.js',path.join(out,'lich-cast-profile.js'));
await fs.copyFile('src/assets/monster-library.js',path.join(out,'monster-library.before.js'));
await fs.copyFile('src/render/animated-enemies.js',path.join(out,'animated-enemies.before.js'));
await fs.copyFile('tools/animation-lich-plan.mjs',path.join(out,'prepare-source.mjs'));
const report={createdAt:new Date().toISOString(),scope:'CPU take serialization and raw bone/socket parity only; no loader/pool integration or native/gameplay/network acceptance',
 before,after,sourceStable:true,profile,clipTracks:round.tracks.length,sourceDuration:round.duration,
 sidecarBytes:Buffer.byteLength(encoded+'\n'),sidecarSha256:sha(encoded+'\n'),profileSha256:before['output/lich-cast-v1/lich-cast-profile.js'],
 maximumBoneMatrixDifference,samples,perInstanceSelectionRequired:true,excludedAuthorityTypes:['visor'],
 preservedRuntimeAssets:['lich','zombie','brute'],runtimeEdited:false,promoted:false,gpuUsed:false};
await fs.writeFile(path.join(out,'preparation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,sourceStable:true,sourceDuration:round.duration,sidecarBytes:report.sidecarBytes,sidecarSha256:report.sidecarSha256,maximumBoneMatrixDifference,promoted:false}));
