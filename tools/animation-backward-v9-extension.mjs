// Summarize the bounded, unchanged trajectory. The original audit stays read-only.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {quantile} from './hero-locomotion-cpu-support.mjs';
const base=path.resolve('output/arpg-animation/backward-v9'), out=path.join(base,'extended-history');
const read=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const sha=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const distribution=a=>({count:a.length,p90:quantile(a,.9),max:a.length?Math.max(...a):null});
function measure(rows){
  const support=[],transition=[],released=[],all=[],events=[];
  let patchFrames=0,declaredFrames=0,declaredWithoutPatch=0;
  for(const row of rows)for(const [side,f]of row.feet.entries()){
    patchFrames+=Number(f.patch.length>0);declaredFrames+=Number(f.contact);
    declaredWithoutPatch+=Number(f.contact&&!f.patch.length);
    for(const p of f.patch){
      all.push(p.horizontal);
      if(f.contact&&f.previousContact)support.push(p.horizontal);
      if(f.contact!==f.previousContact)transition.push(p.horizontal);
      if(!f.contact&&!f.previousContact)released.push(p.horizontal);
    }
    if(f.contact!==f.previousContact)events.push({frame:row.frame,time:row.time,side,
      event:f.contact?'landing':'release',minimum:f.minimum,patchCount:f.patch.length,
      patchSpeed:distribution(f.patch.map(p=>p.horizontal)),reach:f.reach,
      gait:row.stages[side].final.gait});
  }
  return {frames:rows.length,footFrames:rows.length*2,support:distribution(support),
    transition:distribution(transition),releasedBoth:distribution(released),allPatch:distribution(all),
    patchFrames,coverage:patchFrames/(rows.length*2),declaredFrames,declaredWithoutPatch,
    minimumSole:Math.min(...rows.flatMap(r=>r.feet.map(f=>f.minimum))),
    maximumReach:Math.max(...rows.flatMap(r=>r.feet.map(f=>f.reach))),events};
}
const result={scope:'Same6.5m/s trajectory,30/60Hz,0–5s; two full Strafe cycles plus following reverse landings. No new pose search or candidate.',
  acceptedNoSliding:false,promoted:false,gpuUsed:false,cases:[],sources:{},
  selection:{groundBand:.008,lowestBand:.003,verticalSpeed:.05,skinWeight:.75,
    note:'Unchanged predicates from existing witness/auditor; zero qualifying patches remain null, not PASS.'}};
const plan=await read(path.join(out,'plan.json'));
assert.equal(await sha('src/assets/hero-locomotion.js'),plan.runtimeHash);
assert.equal(await sha('docs/arpg/review/sole-contact-audit.mjs'),plan.auditorHash);
for(const hz of [30,60]){
  const sets={},prefixLength=hz===30?61:121;
  for(const v of ['before','candidate']){
    const file=path.join(out,v,`turn-6.5-${hz}.json`),full=await read(file);
    sets[v]=full.rows;result.sources[path.relative(process.cwd(),file)]=await sha(file);
    const old=await read(path.join(base,`${v}-final/turn-6.5-${hz}.json`));
    assert.deepEqual(full.rows.slice(0,prefixLength),old.rows,'Original prefix must be exact');
    assert.equal(full.summary.maxPerturbation,0);
  }
  const a=sets.before,b=sets.candidate,wraps=[],switches=[];
  let maximumProtectedDifference=0,maximumLegLocalDifference=0,maximumMaterialDifference=0;
  const changedFrames=[],worst=[];
  for(let i=0;i<a.length;i++){
    assert.deepEqual(a[i].position,b[i].position);assert.deepEqual(a[i].velocity,b[i].velocity);
    assert.deepEqual(a[i].feet.map(f=>f.contact),b[i].feet.map(f=>f.contact));
    maximumProtectedDifference=Math.max(maximumProtectedDifference,...a[i].protectedObjects.map((v,k)=>Math.abs(v-b[i].protectedObjects[k])));
    maximumLegLocalDifference=Math.max(maximumLegLocalDifference,...a[i].legLocalPositionScale.map((v,k)=>Math.abs(v-b[i].legLocalPositionScale[k])));
    const materialDifference=Math.max(...Object.keys(a[i].stages[1].final.material).flatMap(v=>a[i].stages[1].final.material[v].map((x,k)=>Math.abs(x-b[i].stages[1].final.material[v][k]))));
    maximumMaterialDifference=Math.max(maximumMaterialDifference,materialDifference);
    if(materialDifference>1e-9)changedFrames.push({frame:i,time:b[i].time,materialDifference});
    for(const [side,f]of b[i].feet.entries())for(const p of f.patch)worst.push({frame:i,time:b[i].time,side,vertex:p.vertex,speed:p.horizontal,contact:f.contact,previousContact:f.previousContact,from:p.from,to:p.to});
    if(i){const s=b[i].stages[1].final,old=b[i-1].stages[1].final;
      if(s.gait!==old.gait)switches.push({frame:i,time:b[i].time,gait:s.gait});
      else if(s.phase<old.phase-.5)wraps.push({frame:i,time:b[i].time,gait:s.gait});
    }
  }
  const cycles=[];
  for(let i=1;i<wraps.length;i++){
    const start=wraps[i-1],end=wraps[i];
    if(start.time<1.5||start.gait!==end.gait||switches.some(s=>s.frame>start.frame&&s.frame<=end.frame))continue;
    const rows=b.slice(start.frame,end.frame);
    cycles.push({from:start,to:end,before:measure(a.slice(start.frame,end.frame)),candidate:measure(rows)});
  }
  assert(cycles.filter(c=>c.from.gait==='StrafeA').length>=2,'Two full cycles after first direction change');
  const common=[],added=[],lost=[];
  for(let i=prefixLength;i<a.length;i++)for(let side=0;side<2;side++){
    const old=new Map(a[i].feet[side].patch.map(p=>[p.vertex,p])),now=new Map(b[i].feet[side].patch.map(p=>[p.vertex,p]));
    for(const [v,p]of now){const q=old.get(v);if(q)common.push({frame:i,side,vertex:v,before:q.horizontal,candidate:p.horizontal});else added.push({frame:i,side,vertex:v,speed:p.horizontal});}
    for(const [v,p]of old)if(!now.has(v))lost.push({frame:i,side,vertex:v,speed:p.horizontal});
  }
  const windows={};
  for(const [name,start,end]of [['complete',0,a.length],['newExtension',prefixLength,a.length],['afterTurnStart',Math.ceil(1.5*hz),a.length]])
    windows[name]={range:[start,end-1],before:measure(a.slice(start,end)),candidate:measure(b.slice(start,end))};
  result.cases.push({hz,prefixExact:true,prefixLength,frames:a.length,switches,wraps,cycles,windows,
    commonExtensionPatch:{count:common.length,before:distribution(common.map(p=>p.before)),candidate:distribution(common.map(p=>p.candidate)),maximumSpeedDifference:Math.max(0,...common.map(p=>Math.abs(p.before-p.candidate))),added,lost},
    maximumProtectedDifference,maximumLegLocalDifference,maximumMaterialDifference,changedFrames,
    worstPatchSamples:worst.sort((a,b)=>b.speed-a.speed).slice(0,20)});
}
result.runtimeUnchanged=true;result.auditorUnchanged=true;
await fs.writeFile(path.join(out,'comparison.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result.cases.map(c=>({hz:c.hz,frames:c.frames,lastMaterialChange:c.changedFrames.at(-1),
  extension:c.windows.newExtension,cycles:c.cycles.map(x=>({from:x.from,to:x.to,before:x.before.support,candidate:x.candidate.support,coverage:[x.before.coverage,x.candidate.coverage]})),common:c.commonExtensionPatch})),null,2));
