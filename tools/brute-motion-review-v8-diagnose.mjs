import fs from 'node:fs';
import {loadBody} from './brute-motion-review-v8-body.mjs';
import {tree,triangles,crossings,nearest} from './brute-motion-review-v6-geometry.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
const base='output/brute-motion-v7/candidate-04',out='output/brute-motion-v8/diagnosis';
const clips=JSON.parse(fs.readFileSync(`${base}/clips.json`)).results;
const regions=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/warrior-cpu.json')).regions;
const selected=['dwarf-1.820-idle0','dwarf-1.855-idle0','dwarf-1.890-idle0','warrior-withdraw-surface','dwarf-withdraw-surface'];
const results=[];
for(const name of selected){
 const c=clips.find(c=>c.name===name),body=await loadBody(c.file),old=await loadBody(c.source),target=await createTargets(c.id);
 const previous=JSON.parse(fs.readFileSync(`${base}/${name}-cpu.json`)),frames=previous.frames;const dictionary={},rows=[];
 function query(B,targets,label){
  const pts=B.points(),T=tree(triangles({points:pts,indices:B.indices},regions.torso)),all=[];
  for(const m of targets){const hits=crossings(T,m.tree);for(const [a,b]of hits){const key=`${m.name}:${a}:${b}`;all.push(key);
    if(!dictionary[key])dictionary[key]={targetMesh:m.name,bruteTriangle:a,targetTriangle:b,brute:B.weights(a),targetAnatomy:target.anatomy(m.name,b),targetKind:m.name.endsWith('Body')?'skinned body/armor':'rigid prop'};
   }}return all.sort();
 }
 for(const f of frames){
  body.seek(f.t);old.seek(f.t);const targets=target.sample(f.condition),now=query(body,targets),before=query(old,targets),A=new Set(before),B=new Set(now);
  rows.push({t:f.t,condition:f.condition,now,before,added:now.filter(x=>!A.has(x)),removed:before.filter(x=>!B.has(x))});
 }
 const initialTargets=target.sample({distance:c.distance,clip:'Idle',phase:0});body.seek(0,0);const trueIdle=query(body,initialTargets);
 const byMesh={};for(const m of new Set(Object.values(dictionary).map(v=>v.targetMesh))){const active=rows.filter(f=>f.now.some(k=>dictionary[k].targetMesh===m));byMesh[m]={first:active[0]?.t??null,last:active.at(-1)?.t??null,maximum:Math.max(0,...rows.map(f=>f.now.filter(k=>dictionary[k].targetMesh===m).length)),atStart:rows[0].now.filter(k=>dictionary[k].targetMesh===m).length,atEnd:rows.at(-1).now.filter(k=>dictionary[k].targetMesh===m).length,trueIdle0:trueIdle.filter(k=>dictionary[k].targetMesh===m).length};}
 const peak=rows.reduce((a,b)=>b.now.length>a.now.length?b:a),maxAdded=rows.reduce((a,b)=>b.added.length>a.added.length?b:a);
 const summary={name,byMesh,peak:{t:peak.t,now:peak.now.length,before:peak.before.length,added:peak.added,removed:peak.removed},maxAdded:{t:maxAdded.t,count:maxAdded.added.length,added:maxAdded.added},distinctAdded:[...new Set(rows.flatMap(f=>f.added))],trueIdle0:trueIdle,allPairs:Object.keys(dictionary).length};
 fs.writeFileSync(`${out}/${name}.json`,JSON.stringify({scope:'Frozen legacy detector reproduced, ordered mesh/source/target triangle identities retained; counts are not penetration depth',summary,dictionary,frames:rows},null,2)+'\n');results.push(summary);console.log(JSON.stringify(summary));
}
fs.writeFileSync(`${out}/summary.json`,JSON.stringify({results},null,2)+'\n');
