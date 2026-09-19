// Bounded replay derived from animation-backward-support-trace.mjs.
// Instrumentation exists only in a new output snapshot, never the input source.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [sourceArg,outArg]=process.argv.slice(2);assert(sourceArg&&outArg);
const source=path.resolve(sourceArg),out=path.resolve(outArg),snapshot=path.join(out,'instrumented');
await fs.mkdir(out,{recursive:false});await fs.cp(source,snapshot,{recursive:true});
const digest=b=>createHash('sha256').update(b).digest('hex');
const file='src/assets/hero-locomotion.js',original=await fs.readFile(path.join(source,file),'utf8');
let code=original;
const replace=(a,b)=>{assert.equal(code.split(a).length,2,a);code=code.replace(a,b);};
replace('  const sourceFoot = vector(),',`  const traceStage=(stage,leg)=>globalThis.__animationCausalTrace?.({stage,leg,sourceBones,bones,model,root,driver,
    gait,phase:current.time/current.getClip().duration,rate:parameters.rate,stride:parameters.stride,
    bodyForward,moveForward,actionWeights:Object.fromEntries(Object.entries(actions).map(([n,a])=>[n,a.getEffectiveWeight()]))});
  const sourceFoot = vector(),`);
replace('      // A small pelvis yield',`      for(const leg of legs)traceStage('layered',leg);
      // A small pelvis yield`);
replace('        let surface = sampleSole(leg);',`        let surface = sampleSole(leg);traceStage('ik',leg);`);
replace('        if (((contact && leg.locked)',`        traceStage('landing',leg);
        if (((contact && leg.locked)`);
replace('        // A released boot must clear',`        traceStage('anchor',leg);
        // A released boot must clear`);
replace('        if (contact && !leg.previousContact) {',`        traceStage('floor',leg);
        if (contact && !leg.previousContact) {`);
replace('        if (reachError > .035)',`        traceStage('final',leg);
        if (reachError > .035)`);
await fs.writeFile(path.join(snapshot,file),code);
const {THREE,quantile,bonesOf}=await import(pathToFileURL(path.join(snapshot,'tools/hero-locomotion-cpu-support.mjs')));
const {loadDwarfVisual}=await import(pathToFileURL(path.join(snapshot,'src/assets/dwarf-library.js')));
const {loadDwarfVisual:loadUnobserved}=await import(pathToFileURL(path.join(source,'src/assets/dwarf-library.js')));
const summaries=[],vec=()=>new THREE.Vector3(),pos=b=>b.getWorldPosition(vec()).toArray();
const quat=b=>b.getWorldQuaternion(new THREE.Quaternion()).toArray();
const distribution=a=>({count:a.length,p90:quantile(a,.9),max:a.length?Math.max(...a):null});
for(const {speed,hz,scenario,end} of [{speed:6.5,hz:120,scenario:'steady',end:480},{speed:9.1,hz:120,scenario:'steady',end:400},{speed:9.1,hz:60,scenario:'turn',end:218}]) {
 const dt=1/hz,parent=new THREE.Group(),twinParent=new THREE.Group();
 const actor=await loadDwarfVisual({THREE,parent,height:2.55}),twin=await loadUnobserved({THREE,parent:twinParent,height:2.55});
 const bones=bonesOf(actor.model),protectedBones=Object.values(bones).filter(b=>!/^(mixamorig:?)?(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(b.name));
 const probes=[[],[]],rows=[],previous=[null,null];
 actor.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let vertex=0;vertex<skinIndex.count;vertex++)for(let side=0;side<2;side++) {
   let weight=0;for(let k=0;k<4;k++){const n=mesh.skeleton.bones[skinIndex.getComponent(vertex,k)].name;if(n.includes(side?'RightFoot':'LeftFoot')||n.includes(side?'RightToe':'LeftToe'))weight+=skinWeight.getComponent(vertex,k);}
   if(weight>.75)probes[side].push({mesh,vertex});
  }
 });
 let row,frameIndex,maxPerturbation=0;
 const material=(mesh,vertex,transform)=>{mesh.skeleton.update();const p=mesh.getVertexPosition(vertex,vec()).applyMatrix4(mesh.matrixWorld);if(transform)p.applyMatrix4(transform);return p.toArray();};
 const watch=[14493,217,99,94,53];
 const trace=t=>{
  const leg=t.leg,side=leg.side==='Left'?0:1,mesh=t.model.getObjectByName('DwarfBody');
  const driverMesh=t.driver.getObjectByName('DwarfBody');
  (row.stages[side]??={})[t.stage]={phase:t.phase,gait:t.gait,actionWeights:t.actionWeights,rootY:t.root.position.y,
   bodyForward:t.bodyForward.toArray(),moveForward:t.moveForward.toArray(),hips:pos(t.bones.Hips),hip:pos(leg.hip),ankle:pos(leg.ankle),ankleQ:quat(leg.ankle),toe:pos(leg.toe),toeQ:quat(leg.toe),
   target:leg.target.toArray(),authored:leg.authoredTarget.toArray(),anchor:leg.anchor.toArray(),witness:leg.witness?.vertex??null,
   lowest:leg.lowestWitness?.vertex??null,locked:leg.locked,contact:leg.contact,previousContact:leg.previousContact,
   landingWeight:leg.landingWeight,landingPlan:leg.landingPlan?.point.toArray()??null,
   driverHip:t.sourceBones[leg.side+'UpLeg'].getWorldPosition(vec()).applyMatrix4(t.model.matrixWorld).toArray(),
   driverAnkle:t.sourceBones[leg.side+'Foot'].getWorldPosition(vec()).applyMatrix4(t.model.matrixWorld).toArray(),
   material:Object.fromEntries(watch.map(v=>[v,material(mesh,v)])),
   driverMaterial:Object.fromEntries(watch.map(v=>[v,material(driverMesh,v,t.model.matrixWorld)]))};
 };
 for(frameIndex=0;frameIndex<end;frameIndex++) {
  const time=frameIndex*dt;let angle=0;
  if(scenario==='turn'){if(time>=1.5&&time<2.1)angle=(time-1.5)/.6*Math.PI/2;else if(time>=2.1&&time<3)angle=Math.PI/2;else if(time>=3&&time<3.6)angle=(1-(time-3)/.6)*Math.PI/2;}
  const velocity={x:Math.sin(angle)*speed,z:Math.cos(angle)*speed};
  row={frame:frameIndex,time:(frameIndex+1)*dt,velocity,stages:[],feet:[]};
  for(const p of [parent,twinParent]){p.position.x+=velocity.x*dt;p.position.z+=velocity.z*dt;}
  globalThis.__animationCausalTrace=trace;actor.update(dt,{speed,velocity});parent.updateMatrixWorld(true);
  globalThis.__animationCausalTrace=null;twin.update(dt,{speed,velocity});twinParent.updateMatrixWorld(true);
  assert.equal(row.stages.length,2);
  for(const vertex of watch){const a=material(actor.model.getObjectByName('DwarfBody'),vertex),b=material(twin.model.getObjectByName('DwarfBody'),vertex);maxPerturbation=Math.max(maxPerturbation,Math.hypot(...a.map((v,i)=>v-b[i])));}
  row.position=parent.position.toArray();row.protectedPose=protectedBones.flatMap(b=>b.matrixWorld.elements);
  row.legSpan=vec().fromArray(row.stages[0].final.ankle).distanceTo(vec().fromArray(row.stages[1].final.ankle));
  for(let side=0;side<2;side++) {
   const points=probes[side].map(({mesh,vertex})=>material(mesh,vertex));const minimum=Math.min(...points.map(p=>p[1]));
   const metric=actor.stats.locomotion.footContacts[side],old=previous[side],patch=[];
   if(old)for(let n=0;n<points.length;n++){
    const p=points[n],q=old.points[n],velocity=p.map((v,i)=>(v-q[i])/dt);
    if(Math.abs(p[1])<=.008&&Math.abs(q[1])<=.008&&p[1]-minimum<=.003&&q[1]-old.minimum<=.003&&Math.abs(velocity[1])<=.05)
     patch.push({vertex:probes[side][n].vertex,velocity,horizontal:Math.hypot(velocity[0],velocity[2]),from:q,to:p});
   }
   row.feet.push({minimum,reach:metric.reachError,contact:metric.contact,previousContact:old?.contact??false,patch});
   previous[side]={points,minimum,contact:metric.contact};
  }
  rows.push(row);
 }
 assert(maxPerturbation<1e-9,'Diagnostic instrumentation altered output');
 // Exactly one full take cycle ending after the known landing witness.
 const endFrame=scenario==='turn'?217:speed===6.5?449:376;
 const cycleStart=scenario==='turn'?195:endFrame-Math.ceil(.5333333611488342/actor.stats.locomotion.timeScale*hz);
 const focus=rows.filter(r=>r.frame>=cycleStart&&r.frame<=endFrame),support=[],transition=[];
 let patchFrames=0;
 for(const r of focus)for(const f of r.feet){if(f.patch.length)patchFrames++;for(const p of f.patch){if(f.contact&&f.previousContact)support.push(p.horizontal);if(f.contact!==f.previousContact)transition.push(p.horizontal);}}
 const summary={scenario,speed,hz,sourceHash:digest(original),focus:[cycleStart,endFrame],frames:rows.length,maxPerturbation,
  support:distribution(support),transition:distribution(transition),coverage:patchFrames/(focus.length*2),
  maximumReach:Math.max(...focus.flatMap(r=>r.feet.map(f=>f.reach))),minimumSole:Math.min(...focus.flatMap(r=>r.feet.map(f=>f.minimum))),
  maximumLegSpan:Math.max(...focus.map(r=>r.legSpan)),acceptedNoSliding:false};
 await fs.writeFile(path.join(out,`${scenario}-${speed}.json`),JSON.stringify({summary,rows}));summaries.push(summary);
 actor.dispose();twin.dispose();
}
assert.equal(await fs.readFile(path.join(source,file),'utf8'),original);
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({source,snapshot,sourceStable:true,instrumentedHash:digest(code),summaries},null,2));
console.log(JSON.stringify(summaries));
