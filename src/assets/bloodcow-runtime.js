import * as THREE from '../../vendor/three/three.module.js';
import {clone} from './vendor/SkeletonUtils.js';
import {installFullInfluences,cloneSkinMaterial} from './bloodcow-skinning.js';
export const BLOODCOW_ROLES={Idle:'Idle_v014_Corrected',Walk:'Walk_v014_Corrected',Run:'Walk_v014_Corrected',Attack:'Attack_v014_Corrected',Death:'Death_v014_Weighted'};
export function createBloodCow(gltf,qa,{bridge=true}={}){
 const model=clone(gltf.scene);let mesh;const owned=new Set(),clones=new Map();
 const own=m=>{if(!clones.has(m)){const c=cloneSkinMaterial(m);clones.set(m,c);owned.add(c);}return clones.get(m);};
 model.traverse(o=>{if(o.isSkinnedMesh){mesh=o;o.material=Array.isArray(o.material)?o.material.map(own):own(o.material);if(o.customDepthMaterial)o.customDepthMaterial=own(o.customDepthMaterial);if(o.customDistanceMaterial)o.customDistanceMaterial=own(o.customDistanceMaterial);installFullInfluences(o);owned.add(o.customDepthMaterial);owned.add(o.customDistanceMaterial);}});
 const mixer=new THREE.AnimationMixer(model),actions={};
 for(const [role,name] of Object.entries(BLOODCOW_ROLES)) {const c=gltf.animations.find(c=>c.name===name).clone();c.name=role;actions[role]=mixer.clipAction(c);}
 const bones=Object.fromEntries(mesh.skeleton.bones.map((b,i)=>[b.name,{bone:b,index:i}]));
 const defaults=[];model.traverse(o=>defaults.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone(),o.morphTargetInfluences?.slice()]));
 const sourceIds=mesh.geometry.attributes._source_id, exportIds=new Int32Array(qa.vertexCount).fill(-1);
 for(let i=0;i<sourceIds.count;i++)exportIds[sourceIds.getX(i)]=i;
 const v=new THREE.Vector3(),axis=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),quat=new THREE.Quaternion(),mp=new THREE.Matrix4(),skin=new THREE.Matrix4(),desired=new THREE.Matrix4();
 const parentQ=new THREE.Quaternion(),footQ=new THREE.Quaternion(),legQ=new THREE.Quaternion(),targetQ=new THREE.Quaternion(),footPos=new THREE.Vector3(),legPos=new THREE.Vector3();
 const fit=qa.helperFit,fitDelta=new Float64Array(18),fitMatrices=fit?Object.keys(fit.terms).map(name=>({name:name.replace(/[:.]/g,''),coeff:fit.terms[name],matrix:new THREE.Matrix4()})):[];
 const beforePose=mesh.skeleton.bones.map(()=>[new THREE.Vector3(),new THREE.Quaternion(),new THREE.Vector3()]);
 let current=actions.Idle,dead=false,elapsed=0,role='Idle',entryRole='Idle',fadeRemaining=0;current.play();mixer.update(0);
 const updateWorld=()=>{model.updateMatrixWorld(true);mesh.skeleton.update();};
 function surface(){updateWorld();const out=new Float32Array(qa.vertexCount*3);for(let i=0;i<qa.vertexCount;i++){mesh.getVertexPosition(exportIds[i],v).applyMatrix4(mesh.matrixWorld);out.set([v.x,-v.z,v.y],i*3);}return out;}
 function minimum(ids){updateWorld();let z=Infinity;for(const id of ids){mesh.getVertexPosition(exportIds[id],v).applyMatrix4(mesh.matrixWorld);z=Math.min(z,v.y);}return z;}
 function worldRotate(b,q){const local=b.parent.getWorldQuaternion(parentQ).invert().multiply(q);b.quaternion.copy(local);updateWorld();}
 function parentCancel(){
  updateWorld();const hip=bones.mixamorigHips;skin.multiplyMatrices(hip.bone.matrixWorld,mesh.skeleton.boneInverses[hip.index]);
  fitDelta.fill(0);const attackWeight=actions.Attack.isScheduled()&&actions.Attack.enabled?actions.Attack.getEffectiveWeight():0;
  if(fit&&attackWeight>0){for(const term of fitMatrices){const b=bones[term.name];term.matrix.multiplyMatrices(b.bone.matrixWorld,mesh.skeleton.boneInverses[b.index]);const h=skin.elements,m=term.matrix.elements;for(let j=0;j<6;j++){const c=term.coeff[j],x=c[0],y=c[2],z=-c[1],w=c[3];for(let k=0;k<3;k++)fitDelta[j*3+k]+=((h[k]-m[k])*x+(h[4+k]-m[4+k])*y+(h[8+k]-m[8+k])*z+(h[12+k]-m[12+k])*w)*fit.strength*attackWeight;}}}
  let helperIndex=0;
  for(const side of ['l','r'])for(const name of ['c_thigh_out_01','c_knee_in_01','c_knee_in_02']){
   const {bone,index}=bones[name+side];desired.copy(mesh.skeleton.boneInverses[index]).invert().premultiply(skin);desired.elements[12]+=fitDelta[helperIndex*3];desired.elements[13]+=fitDelta[helperIndex*3+1];desired.elements[14]+=fitDelta[helperIndex*3+2];helperIndex++;mp.copy(bone.parent.matrixWorld).invert().multiply(desired);mp.decompose(bone.position,bone.quaternion,bone.scale);bone.updateMatrixWorld(true);
  }mesh.skeleton.update();
 }
 function correct(){
  // Post-mix local hoof contact on live locomotion and entry; helpers follow evaluated Hips. No root lift or retiming.
  if((dead&&elapsed>.12+1e-8)||(!dead&&fadeRemaining<=0))return;
  const strength=1;
  const before=beforePose;if(strength<1)mesh.skeleton.bones.forEach((b,i)=>{before[i][0].copy(b.position);before[i][1].copy(b.quaternion);before[i][2].copy(b.scale);});
  for(const side of ['Left','Right']){
   const leg=bones['mixamorig'+side+'Leg'].bone,foot=bones['mixamorig'+side+'Foot'].bone,ids=qa['hoofWitness'+side[0]]||qa['hoof'+side[0]],fq=foot.getWorldQuaternion(footQ);
   for(let i=0;i<12;i++){
    const gap=minimum(ids);if(gap>=.0003)break;
    const lever=foot.getWorldPosition(footPos).sub(leg.getWorldPosition(legPos));axis.crossVectors(lever,up);const norm=axis.lengthSq();if(norm<1e-9)break;
    const angle=Math.min(.08,(.0008-gap)/Math.sqrt(norm));axis.normalize();quat.setFromAxisAngle(axis,angle).multiply(leg.getWorldQuaternion(legQ));worldRotate(leg,quat);worldRotate(foot,fq);
   }
  }
  parentCancel();
  if(strength<1)mesh.skeleton.bones.forEach((b,i)=>{b.position.lerpVectors(before[i][0],b.position,strength);b.quaternion.slerpQuaternions(before[i][1],targetQ.copy(b.quaternion),strength);b.scale.lerpVectors(before[i][2],b.scale,strength);});
  updateWorld();
 }
 // Same reset/fade/LoopOnce/clamp/timeScale semantics as 574bcdb transition().
 function transition(name,fade=.12,once=false,duration){fadeRemaining=fade;const next=actions[name];next.reset().setEffectiveWeight(1).setEffectiveTimeScale(duration?next.getClip().duration/Math.max(.1,duration):1);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;for(const outgoing of Object.values(actions)){if(outgoing!==next&&outgoing.isScheduled()){const w=outgoing.getEffectiveWeight();outgoing.stopFading().setEffectiveWeight(w).fadeOut(fade);}}next.fadeIn(fade).play();current=next;role=name;}
 function reset(origin='Idle',phase=0){mixer.stopAllAction();for(const [o,p,q,s,m] of defaults){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);if(m)o.morphTargetInfluences.splice(0,m.length,...m);}for(const a of Object.values(actions))a.stopFading().stopWarping().reset();dead=false;elapsed=0;fadeRemaining=0;role=origin;current=actions[origin];const once=origin==='Attack'||origin==='Death';current.clampWhenFinished=once;current.setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity).play();current.time=once?Math.min(phase,current.getClip().duration):phase;mixer.update(0);if(bridge)correct();updateWorld();}
 function die(){if(dead)return;mixer.update(0);entryRole=role;dead=true;elapsed=0;transition('Death',.12,true);mixer.update(0);if(bridge)correct();updateWorld();}
 function seek(name,time){const action=actions[name];if(!action)throw new RangeError(`Unknown BloodCow role: ${name}`);action.time=Math.max(0,Math.min(action.getClip().duration,Number(time)||0));mixer.update(0);if(bridge)correct();updateWorld();return action.time;}
 function update(dt){const delta=Math.min(.1,Math.max(0,Number(dt)||0));if(dead)elapsed+=delta;mixer.update(delta);if(bridge)correct();fadeRemaining=Math.max(0,fadeRemaining-delta);updateWorld();}
 function dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);for(const m of owned)m.dispose();mesh.skeleton.dispose();model.removeFromParent();}
 if(bridge)correct();updateWorld();
 return {model,mesh,mixer,actions,surface,reset,die,update,transition,seek,dispose,stats:(out={})=>{out.role=role;out.dead=dead;out.elapsed=elapsed;out.clipTime=current.time;out.timeScale=current.getEffectiveTimeScale();out.corpseDuration=Math.min(5,actions.Death.getClip().duration);out.bridge=bridge;out.runFallback='Walk at timeScale 1; no independent Run take';return out;},parentCancel};
}
