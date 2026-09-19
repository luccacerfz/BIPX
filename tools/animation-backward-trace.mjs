// Diagnostic-only copy, same material vertices at every solver stage.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const [sourceArg,outputArg]=process.argv.slice(2);
assert(sourceArg&&outputArg,'Pass source snapshot and a NEW trace output directory');
const source=path.resolve(sourceArg),out=path.resolve(outputArg),snapshot=path.join(out,'instrumented');
await fs.mkdir(out,{recursive:false});
await fs.cp(source,snapshot,{recursive:true,filter:file=>!['output','node_modules','.git'].some(n=>path.relative(source,file).split(path.sep)[0]===n)});
const modulePath=path.join(snapshot,'src/assets/hero-locomotion.js');
const original=await fs.readFile(modulePath,'utf8');let code=original;
const replace=(a,b)=>{assert.equal(code.split(a).length,2,`Expected one trace insertion: ${a}`);code=code.replace(a,b);};
replace('  const sourceFoot = vector(),',`  const traceStage = (stage, leg) => globalThis.__animationCausalTrace?.({stage, leg, driver, sourceBones, bones, model, root,
    gait, phase:current.time/current.getClip().duration, rate:parameters.rate, stride:parameters.stride});
  const sourceFoot = vector(),`);
replace('      // A small pelvis yield',`      for (const leg of legs) traceStage('layered',leg);
      // A small pelvis yield`);
replace('        let surface = sampleSole(leg);',`        let surface = sampleSole(leg);
        traceStage('ik',leg);`);
replace('        if (((contact && leg.locked)',`        traceStage('landing',leg);
        if (((contact && leg.locked)`);
replace('        // A released boot must clear',`        traceStage('anchor',leg);
        // A released boot must clear`);
replace('        if (contact && !leg.previousContact) {',`        traceStage('floor',leg);
        if (contact && !leg.previousContact) {`);
replace('        if (reachError > .035)',`        traceStage('final',leg);
        if (reachError > .035)`);
await fs.writeFile(modulePath,code);
const {THREE}=await import(pathToFileURL(path.join(snapshot,'tools/hero-locomotion-cpu-support.mjs')));
const {loadDwarfVisual}=await import(pathToFileURL(path.join(snapshot,'src/assets/dwarf-library.js')));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const witness={Left:14493,Right:53};
const sourceFiles=['src/assets/hero-locomotion.js','src/assets/dwarf-locomotion-clips.json','src/assets/dwarf-library.js','assets/models/dwarf-rifleman.glb'];
const fingerprints=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,digest(await fs.readFile(path.join(source,f)))])));
const before=await fingerprints(),summaries=[];
for(const speed of [6.5,9.1]) {
  const parent=new THREE.Group(),controlParent=new THREE.Group();
  const actor=await loadDwarfVisual({THREE,parent,height:2.55});
  const control=await loadDwarfVisual({THREE,parent:controlParent,height:2.55});
  const frames=[];let frameIndex=0,maxTracePerturbation=0;
  const v=()=>new THREE.Vector3();
  const p=bone=>bone.getWorldPosition(v()).toArray();
  const q=bone=>bone.getWorldQuaternion(new THREE.Quaternion()).toArray();
  const material=(mesh,vertex,transform)=>{
    mesh.skeleton.update();const point=mesh.getVertexPosition(vertex,v()).applyMatrix4(mesh.matrixWorld);
    if(transform)point.applyMatrix4(transform);return point.toArray();
  };
  const callback=t=>{
    const side=t.leg.side,vertex=witness[side],mesh=t.model.getObjectByName('DwarfBody'),driverMesh=t.driver.getObjectByName('DwarfBody');
    const transform=t.model.matrixWorld;
    const fromDriver=bone=>bone.getWorldPosition(v()).applyMatrix4(transform).toArray();
    (frames[frameIndex].feet[side]??={})[t.stage]={
      vertex,material:material(mesh,vertex),driverMaterial:material(driverMesh,vertex,transform),
      parent:parent.position.toArray(),rootY:t.root.position.y,renderedHips:p(t.bones.Hips),driverHips:fromDriver(t.sourceBones.Hips),
      renderedHip:p(t.leg.hip),driverHip:fromDriver(t.sourceBones[side+'UpLeg']),
      renderedHipsQuaternion:q(t.bones.Hips),driverHipsQuaternion:q(t.sourceBones.Hips),
      ankle:p(t.leg.ankle),driverAnkle:fromDriver(t.sourceBones[side+'Foot']),
      toe:p(t.leg.toe),driverToe:fromDriver(t.sourceBones[side+'ToeBase']),
      ankleWorldQuaternion:q(t.leg.ankle),driverFootWorldQuaternion:q(t.sourceBones[side+'Foot']),
      target:t.leg.target.toArray(),authoredTarget:t.leg.authoredTarget.toArray(),
      gait:t.gait,phase:t.phase,rate:t.rate,stride:t.stride,contact:t.leg.contact,previousContact:t.leg.previousContact,
      locked:t.leg.locked,anchor:t.leg.anchor.toArray(),anchorVertex:t.leg.witness?.vertex??null,
      swingCarry:t.leg.swingCarry,swingResidual:t.leg.swingResidual.toArray(),clearance:t.leg.swingClearance,
      landingWeight:t.leg.landingWeight??0,landingReachFraction:t.leg.landingReachFraction??null,
      landingPlan:t.leg.landingPlan?{point:t.leg.landingPlan.point.toArray(),vertex:t.leg.landingPlan.witness.vertex}:null,
    };
  };
  const dt=1/120,velocity={x:0,z:speed};
  for(frameIndex=0;frameIndex<480;frameIndex++) {
    frames.push({frame:frameIndex,time:(frameIndex+1)*dt,feet:{}});
    parent.position.z+=speed*dt;controlParent.position.z+=speed*dt;
    globalThis.__animationCausalTrace=callback;actor.update(dt,{speed,velocity});parent.updateMatrixWorld(true);
    globalThis.__animationCausalTrace=null;control.update(dt,{speed,velocity});controlParent.updateMatrixWorld(true);
    const a=actor.model.getObjectByName('DwarfBody'),b=control.model.getObjectByName('DwarfBody');
    for(const vertex of Object.values(witness)) {
      const x=material(a,vertex),y=material(b,vertex);
      maxTracePerturbation=Math.max(maxTracePerturbation,Math.hypot(...x.map((n,i)=>n-y[i])));
    }
    frames[frameIndex].metrics=JSON.parse(JSON.stringify(actor.stats.locomotion.footContacts));
  }
  assert(maxTracePerturbation<1e-9,'Trace perturbed output pose');
  const stages=['layered','ik','landing','anchor','floor','final'];
  const difference=(a,b)=>a.map((x,i)=>(x-b[i])/dt);
  const touchdown=[];
  for(let i=1;i<frames.length;i++)for(const side of ['Left','Right']) {
    const now=frames[i].feet[side],old=frames[i-1].feet[side];
    if(!now?.final||!old?.final||!now.final.contact||old.final.contact)continue;
    const decomposition={};
    for(const stage of stages) {
      const velocity=difference(now[stage].material,old[stage].material);
      decomposition[stage]={velocity,horizontal:Math.hypot(velocity[0],velocity[2]),from:old[stage].material,to:now[stage].material};
    }
    for(const key of ['parent','driverHips','renderedHips','driverAnkle','driverToe','driverMaterial','authoredTarget']) {
      const velocity=difference(now.layered[key],old.layered[key]);
      decomposition[key]={velocity,horizontal:Math.hypot(velocity[0],velocity[2])};
    }
    touchdown.push({frame:i,time:frames[i].time,side,vertex:witness[side],decomposition,
      window:frames.slice(Math.max(0,i-2),i+3).map(f=>({frame:f.frame,time:f.time,stages:f.feet[side],metric:f.metrics.find(m=>m.foot===side.toLowerCase())}))});
  }
  await fs.writeFile(path.join(out,`trace-${speed}.json`),JSON.stringify({speed,dt,maxTracePerturbation,witness,frames}));
  await fs.writeFile(path.join(out,`touchdown-${speed}.json`),JSON.stringify({speed,dt,maxTracePerturbation,witness,touchdown},null,2));
  const representative=touchdown.filter(t=>t.time>1).sort((a,b)=>b.decomposition.final.horizontal-a.decomposition.final.horizontal)[0];
  summaries.push({speed,maxTracePerturbation,touchdowns:touchdown.length,representative});
  actor.dispose();control.dispose();
}
const after=await fingerprints();assert.deepEqual(after,before);
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({source,sourceHashes:before,instrumentedHash:digest(code),sourceUnchanged:true,scope:'Same fixed material witnesses through solver stages; diagnostic hook output equals unobserved twin',summaries},null,2));
console.log(JSON.stringify({out,sourceUnchanged:true,cases:summaries.map(s=>({speed:s.speed,touchdowns:s.touchdowns,perturbation:s.maxTracePerturbation,frame:s.representative.frame,stages:s.representative.decomposition}))}));
