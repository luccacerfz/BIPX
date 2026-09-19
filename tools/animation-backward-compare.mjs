import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'output/arpg-animation/backward-v5');
const read=async file=>JSON.parse(await fs.readFile(path.join(root,file)));
const hash=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const [original,donor,candidate]=await Promise.all(['original','donor','planned-bounded'].map(n=>read(`matrix/${n}.json`)));
let maximumProtectedMatrixDifference=0,maximumAddedReach=0,maximumAddedPenetration=0;
const matrix=candidate.results.map((r,i)=>{
  const b=donor.results[i],a=original.results[i];
  assert.equal(r.contactHash,b.contactHash,'Contact masks changed');
  assert.equal(r.frameCount,b.frameCount,'Frames removed');
  for(let f=0;f<r.frames.length;f++) {
    const x=r.frames[f],y=b.frames[f];
    assert.deepEqual(x.position,y.position,'Gameplay trajectory changed');
    assert.deepEqual(x.velocity,y.velocity,'Gameplay speed changed');
    for(let k=0;k<x.protectedPose.length;k++)maximumProtectedMatrixDifference=Math.max(maximumProtectedMatrixDifference,Math.abs(x.protectedPose[k]-y.protectedPose[k]));
    for(let side=0;side<2;side++) {
      maximumAddedReach=Math.max(maximumAddedReach,x.feet[side].reach-y.feet[side].reach);
      maximumAddedPenetration=Math.max(maximumAddedPenetration,Math.max(0,-x.feet[side].minimum)-Math.max(0,-y.feet[side].minimum));
    }
  }
  const compact=x=>({support:x.groups.all.support,transition:x.groups.all.transition,coverage:x.coverage,
    maximumReach:x.maximumReach,minimumSole:x.minimumSole,transient:x.groups.transient,
    allMaterialTransitionMax:Math.max(...x.frames.flatMap(f=>f.feet.map(t=>t.transitionMaterialMax))),
    worstPatch:x.worst[0]||null});
  return {hz:r.hz,speed:r.speed,scenario:r.scenario,frames:r.frameCount,original:compact(a),donor:compact(b),candidate:compact(r)};
});
assert(maximumProtectedMatrixDifference<1e-9,'Torso/props moved relative to the hips');
assert.equal(maximumAddedReach,0,'Prediction introduced reach regression');
const trace=[];
for(const [speed,frame]of [[6.5,433],[9.1,360]]) {
  const [a,b]=await Promise.all(['donor-foot-trace-toe','final-trace'].map(n=>read(`${n}/trace-${speed}.json`)));
  assert.equal(a.maxTracePerturbation,0);assert.equal(b.maxTracePerturbation,0);
  const diff=(x,y)=>x.map((n,i)=>(n-y[i])/a.dt);
  const sample=(t,index)=>{
    const current=t.frames[index].feet.Left,previous=t.frames[index-1].feet.Left;
    const stages=Object.fromEntries(Object.entries(current).map(([name,row])=>[name,{
      position:row.material,velocity:diff(row.material,previous[name].material),
      contact:row.contact,phase:row.phase,rate:row.rate,stride:row.stride,
      plan:row.landingPlan??null,reachFraction:row.landingReachFraction??null,
    }]));
    const components=Object.fromEntries(['parent','renderedHips','driverHips','driverAnkle','driverToe','driverMaterial','authoredTarget'].map(k=>[k,{
      position:current.layered[k],velocity:diff(current.layered[k],previous.layered[k]),
    }]));
    return {frame:index,time:t.frames[index].time,components,stages};
  };
  trace.push({speed,witness:{mesh:'DwarfBody',vertex:14493,foot:'Left'},auditorLandingFrame:frame,
    donor:[frame-1,frame,frame+1].map(f=>sample(a,f)),candidate:[frame-1,frame,frame+1].map(f=>sample(b,f))});
}
const controllerHash=await hash(path.join(root,'candidate/src/assets/hero-locomotion.js'));
const auditorDirectory=path.join(root,'candidate/output/qa/arpg-root-review');
let independent;
for(const name of (await fs.readdir(auditorDirectory)).sort()) {
  const report=JSON.parse(await fs.readFile(path.join(auditorDirectory,name)));
  if(report.results.length===8 && report.before['src/assets/hero-locomotion.js']===controllerHash) independent={file:path.join(auditorDirectory,name),...report};
}
assert(independent?.sourceStable,'Missing source-bound full independent audit');
assert.equal(independent.before['docs/arpg/review/sole-contact-audit.mjs'],await hash('docs/arpg/review/sole-contact-audit.mjs'),'Auditor changed');
const currentRuntime=await hash('src/assets/hero-locomotion.js');
assert.equal(currentRuntime,'07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5');
const result={generatedAt:new Date().toISOString(),scope:'Bounded staged landing correction, not approval of donor gait or global no-slide',
  runtimePreserved:currentRuntime,controllerHash,sidecarHash:candidate.before['src/assets/dwarf-locomotion-clips.json'],
  physicalAcceptance:false,promoted:false,gpuUsed:false,
  checks:{sourceStable:[original,donor,candidate].every(r=>r.sourceUnchanged),cases:matrix.length,contactFlagsIdentical:true,
    gameplayPathsIdentical:true,allFramesRetained:true,maximumProtectedMatrixDifference,maximumAddedReach,maximumAddedPenetration,
    diagnosticPerturbation:0},
  independentAudit:independent.file,independentResults:independent.results,trace,matrix};
await fs.writeFile(path.join(root,'comparison.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({controllerHash,checks:result.checks,runtimePreserved:currentRuntime,physicalAcceptance:false}));
