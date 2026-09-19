// Staging only. Rebuild from evaluated Mixamo joint directions, never from the
// rejected RunBackwardFast sidecar or its unconverted default hip position.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { THREE, bonesOf } from './hero-locomotion-cpu-support.mjs';
import { loadGlb } from '../src/assets/load-glb.js';

const stage = path.resolve('output/arpg-animation/backward-v4/candidate');
const footReference = process.argv.includes('--target-foot') ? 'target' : 'donor';
const destination = path.join(stage, 'src/assets/dwarf-locomotion-clips.json');
const files = {
  donor: 'output/hero-locomotion/export/aldric-directional.glb',
  target: 'assets/models/dwarf-rifleman.glb',
  evaluatedTarget: 'output/hero-locomotion/export/lyra-directional.glb',
};
const hash = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const hashesBefore = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([k,f]) => [k,await hash(f)])));
const open = file => loadGlb(new URL(file, `file://${process.cwd()}/`));
const donor = await open(files.donor), target = await open(files.target);
const evaluatedTarget = await open(files.evaluatedTarget);
const normalized = scene => Object.fromEntries(Object.entries(bonesOf(scene)).map(([n,b]) => [n.replace(/_\d+$/,''),b]));
const sb = normalized(donor.scene), tb = normalized(target.scene);
donor.scene.updateMatrixWorld(true); target.scene.updateMatrixWorld(true);
const lower = Object.keys(tb).filter(n => n === 'Hips' || /^(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(n));
// These assemblies store default bone positions in the Blender Z-up basis;
// evaluated animations are Y-up. Rotation references must use the same basis.
const zToY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
const bind = bones => Object.fromEntries(Object.entries(bones).map(([n,b]) => [n,{
  position:b.position.clone(), scale:b.scale.clone(),
  q:zToY.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())),
}]));
const sr = bind(sb), tr = bind(tb);
const sourceClip = donor.animations.find(c => c.name === 'RunAlternate');
const targetClip = evaluatedTarget.animations.find(c => c.name === 'RunBackward').clone();
for (const track of targetClip.tracks) {
  const dot=track.name.lastIndexOf('.');
  const name=track.name.slice(0,dot).replace(/^mixamorig:?/,'').replace(/_\d+$/,'');
  if (tb[name]) track.name=tb[name].name+track.name.slice(dot);
}
const sm = new THREE.AnimationMixer(donor.scene), tm = new THREE.AnimationMixer(target.scene);
for (const [m,c] of [[sm,sourceClip],[tm,targetClip]]) {
  const a=m.clipAction(c).setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true; a.play();
}
const count=Math.round(sourceClip.duration*60)+1;
const times=Float32Array.from({length:count},(_,i)=>sourceClip.duration*i/(count-1));
const values=Object.fromEntries(lower.map(n=>[n,{position:[],quaternion:[],scale:[]}]));
const rows=[];
const worldP=b=>b.getWorldPosition(new THREE.Vector3());
function aim(bone, child, desiredDirection) {
  const from=worldP(child).sub(worldP(bone)).normalize();
  const world=new THREE.Quaternion().setFromUnitVectors(from,desiredDirection.clone().normalize())
    .multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world)).normalize();
  bone.updateMatrixWorld(true);
}
function rotation(name) {
  const desired=sb[name].getWorldQuaternion(new THREE.Quaternion()).multiply(sr[name].q.clone().invert()).multiply(tr[name].q);
  tb[name].quaternion.copy(tb[name].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired)).normalize();
  tb[name].updateMatrixWorld(true);
}
let maxLocalOffsetError=0,maxAuthoredBindOffset=0,maxHipPlanar=0,maxDirectionError=0;
for (let frame=0;frame<count;frame++) {
  sm.setTime(times[frame]); tm.setTime(targetClip.duration*frame/(count-1));
  donor.scene.updateMatrixWorld(true); target.scene.updateMatrixWorld(true);
  const evaluatedPositions=Object.fromEntries(lower.map(n=>[n,tb[n].position.clone()]));
  const evaluatedRotations=Object.fromEntries(['LeftFoot','RightFoot','LeftToeBase','RightToeBase'].map(n=>[n,tb[n].getWorldQuaternion(new THREE.Quaternion())]));
  const authoredHip=worldP(tb.Hips);
  maxHipPlanar=Math.max(maxHipPlanar,Math.hypot(authoredHip.x,authoredHip.z));
  for (const side of ['Left','Right']) {
    for (const [parent,child] of [['UpLeg','Leg'],['Leg','Foot']]) {
      const direction=worldP(sb[side+child]).sub(worldP(sb[side+parent])).normalize();
      aim(tb[side+parent],tb[side+child],direction);
      const result=worldP(tb[side+child]).sub(worldP(tb[side+parent])).normalize();
      maxDirectionError=Math.max(maxDirectionError,result.distanceTo(direction));
    }
    for (const part of ['Foot','ToeBase']) {
      const n=side+part;
      if(footReference==='donor') rotation(n);
      else {
        tb[n].quaternion.copy(tb[n].parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(evaluatedRotations[n])).normalize();
        tb[n].updateMatrixWorld(true);
      }
    }
  }
  for (const name of lower) {
    maxLocalOffsetError=Math.max(maxLocalOffsetError,tb[name].position.distanceTo(evaluatedPositions[name]));
    if(name!=='Hips') maxAuthoredBindOffset=Math.max(maxAuthoredBindOffset,tb[name].position.distanceTo(tr[name].position));
    for(const prop of ['position','quaternion','scale']) values[name][prop].push(...tb[name][prop].toArray());
  }
  rows.push({time:times[frame],hips:worldP(tb.Hips).toArray(),feet:['Left','Right'].map(s=>({
    hip:worldP(tb[s+'UpLeg']).toArray(),knee:worldP(tb[s+'Leg']).toArray(),
    ankle:worldP(tb[s+'Foot']).toArray(),toe:worldP(tb[s+'ToeBase']).toArray(),
  }))});
}
assert(maxHipPlanar<1e-5,`Planar reference is not centered: ${maxHipPlanar}`);
assert(maxLocalOffsetError<1e-6,`Target bone lengths/offsets changed: ${maxLocalOffsetError}`);
assert(maxDirectionError<1e-6);
const name='RunBackwardRetargetV2';
const tracks=lower.flatMap(n=>['position','quaternion','scale'].map(p=>new (p==='quaternion'?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack)(`${tb[n].name}.${p}`,times,values[n][p])));
const clip=THREE.AnimationClip.toJSON(new THREE.AnimationClip(name,sourceClip.duration,tracks));
clip.uuid='bipx-staged-dwarf-backward-direction-retarget-v2';
const data=JSON.parse(await fs.readFile(destination));
data.clips=data.clips.filter(c=>c.clip.name!==name);
data.clips.push({direction:[0,-1],clip});
data.stagedBackwardRetarget={method:'Evaluated target backward hip reference, source joint directions with original target local offsets and lengths; foot/toe rotation reference recorded separately',footReference,files,hashesBefore,sourceClip:sourceClip.name,name,maxHipPlanar,maxLocalOffsetError,maxAuthoredBindOffset,maxDirectionError,approved:false};
await fs.writeFile(destination,JSON.stringify(data));
const hashesAfter=Object.fromEntries(await Promise.all(Object.entries(files).map(async([k,f])=>[k,await hash(f)])));
assert.deepEqual(hashesAfter,hashesBefore);
const out='output/arpg-animation/backward-v4/retarget.json';
await fs.writeFile(out,JSON.stringify({...data.stagedBackwardRetarget,hashesAfter,outputHash:await hash(destination),rows},null,2)+'\n');
console.log(JSON.stringify({out,name,maxHipPlanar,maxLocalOffsetError,maxDirectionError,sourceUnchanged:true,runtimeChanged:false}));
