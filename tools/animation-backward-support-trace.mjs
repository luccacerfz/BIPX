// Read-only diagnostic of an already instrumented snapshot; no auditor edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [sourceArg,outArg]=process.argv.slice(2);assert(sourceArg&&outArg);
const source=path.resolve(sourceArg),out=path.resolve(outArg);
await fs.mkdir(out,{recursive:false});
const {THREE,quantile}=await import(pathToFileURL(path.join(source,'tools/hero-locomotion-cpu-support.mjs')));
const {loadDwarfVisual}=await import(pathToFileURL(path.join(source,'src/assets/dwarf-library.js')));
const files=['src/assets/hero-locomotion.js','src/assets/dwarf-locomotion-clips.json','assets/models/dwarf-rifleman.glb'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(path.join(source,f))).digest('hex')])));
const before=await hashes(),results=[];
for(const config of [{speed:6.5,hz:120,scenario:'steady'},{speed:9.1,hz:120,scenario:'steady'},{speed:9.1,hz:60,scenario:'turn'}]) {
 const {speed,hz,scenario}=config,dt=1/hz;
 const parent=new THREE.Group(),actor=await loadDwarfVisual({THREE,parent,height:2.55}),probes=[[],[]];
 actor.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let vertex=0;vertex<skinIndex.count;vertex++)for(let side=0;side<2;side++) {
   let total=0;const weights=[];
   for(let k=0;k<4;k++){const bone=mesh.skeleton.bones[skinIndex.getComponent(vertex,k)],weight=skinWeight.getComponent(vertex,k);if(weight)weights.push({bone:bone.name,weight});if(bone.name.includes(side?'RightFoot':'LeftFoot')||bone.name.includes(side?'RightToe':'LeftToe'))total+=weight;}
   if(total>.75)probes[side].push({mesh,vertex,weights});
  }
 });
 const vec=()=>new THREE.Vector3(),position=b=>b.getWorldPosition(vec()).toArray();
 const quaternion=b=>b.getWorldQuaternion(new THREE.Quaternion()).toArray();
 const difference=(a,b)=>a.map((v,i)=>(v-b[i])/dt);
 const frames=[],previous=[null,null],support=[],transitions=[];
 let current,maximumReach=0,minimumSole=Infinity,patchFrames=0,observedFootFrames=0;
 globalThis.__animationCausalTrace=t=>{
  if(t.stage!=='final')return;
  const leg=t.leg,material=probe=>{probe.mesh.skeleton.update();return probe.mesh.getVertexPosition(probe.vertex,vec()).applyMatrix4(probe.mesh.matrixWorld).toArray();},driverP=n=>t.sourceBones[n].getWorldPosition(vec()).applyMatrix4(t.model.matrixWorld).toArray();
  current[leg.side==='Left'?0:1]={phase:t.phase,gait:t.gait,rate:t.rate,stride:t.stride,
   ankle:position(leg.ankle),ankleQ:quaternion(leg.ankle),toe:position(leg.toe),toeQ:quaternion(leg.toe),
   hip:position(leg.hip),knee:position(leg.knee),hips:position(t.bones.Hips),driverHips:driverP('Hips'),
   driverAnkle:driverP(leg.side+'Foot'),target:leg.target.toArray(),authoredTarget:leg.authoredTarget.toArray(),
   witness:leg.witness?.vertex??null,lowest:leg.lowestWitness?.vertex??null,anchor:leg.anchor.toArray(),
   witnessPosition:leg.witness?material(leg.witness):null,lowestPosition:leg.lowestWitness?material(leg.lowestWitness):null,
   contact:leg.contact,locked:leg.locked,rootY:t.root.position.y,swingResidual:leg.swingResidual.toArray(),
   carryFraction:leg.carryReachFraction,landingFraction:leg.landingReachFraction??null};
 };
 for(let frame=0;frame<(scenario==='steady'?4:5)*hz;frame++) {
  const time=frame*dt;let angle=0;
  if(scenario==='turn') {
   if(time>=1.5&&time<2.1)angle=(time-1.5)/.6*Math.PI/2;
   else if(time>=2.1&&time<3)angle=Math.PI/2;
   else if(time>=3&&time<3.6)angle=(1-(time-3)/.6)*Math.PI/2;
  }
  const velocity={x:Math.sin(angle)*speed,z:Math.cos(angle)*speed};
  current=[];parent.position.x+=velocity.x*dt;parent.position.z+=velocity.z*dt;
  actor.update(dt,{speed,velocity});parent.updateMatrixWorld(true);actor.model.traverse(m=>{if(m.isSkinnedMesh)m.skeleton.update();});
  assert.equal(current.length,2,'Snapshot lacks final-stage instrumentation');
  const row={frame,time:(frame+1)*dt,velocity,feet:[]};
  for(let side=0;side<2;side++) {
   const points=probes[side].map(({mesh,vertex})=>mesh.getVertexPosition(vertex,vec()).applyMatrix4(mesh.matrixWorld).toArray());
   const minimum=Math.min(...points.map(p=>p[1])),metric=actor.stats.locomotion.footContacts[side];
   const state=current[side],old=previous[side];let worst=null,patchCount=0;
   minimumSole=Math.min(minimumSole,minimum);maximumReach=Math.max(maximumReach,metric.reachError);
   if(old&&(scenario==='turn'||frame>=hz)) {
    observedFootFrames++;
    for(let n=0;n<points.length;n++) {
     const p=points[n],q=old.points[n],v=difference(p,q),horizontal=Math.hypot(v[0],v[2]);
     if(Math.abs(p[1])<=.008&&Math.abs(q[1])<=.008&&p[1]-minimum<=.003&&q[1]-old.minimum<=.003&&Math.abs(v[1])<=.05) {
      patchCount++;
      if(state.contact&&old.state.contact) {
       support.push(horizontal);
       if(!worst||horizontal>worst.horizontal) {
        const ankleVelocity=difference(state.ankle,old.state.ankle);
        const offsetVelocity=v.map((x,i)=>x-ankleVelocity[i]);
        const rotation=new THREE.Quaternion().fromArray(state.ankleQ).multiply(new THREE.Quaternion().fromArray(old.state.ankleQ).invert());
        const rigid=vec().fromArray(q).sub(vec().fromArray(old.state.ankle)).applyQuaternion(rotation).add(vec().fromArray(state.ankle));
        worst={vertex:probes[side][n].vertex,mesh:probes[side][n].mesh.name,weights:probes[side][n].weights,
         from:q,to:p,velocity:v,horizontal,ankleVelocity,offsetVelocity,
         rigidFootPrediction:rigid.toArray(),nonRigidResidual:rigid.distanceTo(vec().fromArray(p)),
         angularSpeed:2*Math.acos(Math.min(1,Math.abs(rotation.w)))/dt,
         witnessChanged:state.witness!==old.state.witness,
         previousWitness:old.state.witness,currentWitness:state.witness};
       }
      }
      if(state.contact!==old.state.contact)transitions.push(horizontal);
     }
    }
    if(patchCount)patchFrames++;
   }
   row.feet.push({...state,minimum,reach:metric.reachError,worstSupport:worst});
   previous[side]={state,points,minimum};
  }
  frames.push(row);
 }
 globalThis.__animationCausalTrace=null;
 const ranked=frames.flatMap(f=>f.feet.map((leg,side)=>({frame:f.frame,side,time:f.time,...leg.worstSupport})).filter(p=>p.horizontal!=null)).sort((a,b)=>b.horizontal-a.horizontal);
 const reachRanked=frames.flatMap(f=>f.feet.map((leg,side)=>({frame:f.frame,side,time:f.time,reach:leg.reach}))).sort((a,b)=>b.reach-a.reach);
 const distribution=a=>({count:a.length,p90:quantile(a,.9),max:a.length?Math.max(...a):null});
 const summary={...config,source,observedFootFrames,patchFrames,coverage:patchFrames/observedFootFrames,
  support:distribution(support),transitions:distribution(transitions),maximumReach,minimumSole,
  worstSupport:ranked.slice(0,12),worstReach:reachRanked.slice(0,5)};
 await fs.writeFile(path.join(out,`${scenario}-${speed}-${hz}.json`),JSON.stringify({...summary,frames}));
 results.push(summary);actor.dispose();
}
const after=await hashes();assert.deepEqual(after,before);
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({source,before,after,sourceStable:true,acceptedNoSliding:false,scope:'Diagnostic decomposition, all original patch criteria retained; source instrumentation in own copy only',results},null,2));
console.log(JSON.stringify({out,results:results.map(({speed,hz,scenario,support,transitions,maximumReach})=>({speed,hz,scenario,support,transitions,maximumReach}))}));
