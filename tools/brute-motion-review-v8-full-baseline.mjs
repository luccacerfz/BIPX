import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadBody} from './brute-motion-review-v8-body.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
import {clips} from './brute-motion-review-v8-plan.mjs';
import {tree,triangles,crossings,nearest} from './brute-motion-review-v8-geometry.mjs';
import {crossings as legacy} from './brute-motion-review-v6-geometry.mjs';
import {v} from './brute-motion-review-v6-utils.mjs';
const results=[];
for(const name of ['dwarf-1.820-idle0','dwarf-1.855-idle0','dwarf-1.890-idle0','warrior-withdraw-surface','dwarf-withdraw-surface']){
 const c=clips.find(c=>c.name===name),body=await loadBody(c.file),target=await createTargets(c.id),rows=[];
 for(const [label,t,clip]of [['actual-Idle0',0,0],['Attack-start',0,3],['Attack-prepare',.4,3],['Attack-return',1.05,3],['Attack-end',1.45,3]]){
  body.seek(t,clip);let condition={distance:c.distance,clip:'Idle',phase:0};if(c.mode==='withdraw-surface'&&t>.55)condition={...condition,clip:'Run',phase:.25,blend:Math.min(1,(t-.55)/.15)};
  const points=body.points(),T=tree(triangles({points,indices:body.indices})),all=target.sample(condition).map(m=>({mesh:m.name,pairs:crossings(T,m.tree),...nearest(T,m.tree)}));
  rows.push({label,t,condition,all});
 }
 results.push({name,rows});console.log(JSON.stringify({name,rows:rows.map(r=>({label:r.label,all:r.all.map(m=>({mesh:m.mesh,pairs:m.pairs.length,gap:m.gap}))}))}));
}
// Distinct meshes can have the same triangle index; self-pair filtering must not hide them.
const A=tree(triangles({points:[v().set(-1,0,-1),v().set(1,0,-1),v().set(0,0,1)],indices:[0,1,2]}));
const B=tree(triangles({points:[v().set(0,-1,0),v().set(0,1,0),v().set(.8,0,.8)],indices:[0,1,2]}));
assert.equal(legacy(A,B).length,0);assert.equal(crossings(A,B).length,1);
fs.writeFileSync('output/brute-motion-v8/diagnosis/full-baseline.json',JSON.stringify({scope:'Whole mesh at real Idle0 and attack entry/return; different-mesh triangle ids ordered in new detector',independentEqualTriangleIndexRegressionPassed:true,results},null,2)+'\n');
