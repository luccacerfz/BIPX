// Replay the complete transient input matrix against the two staged controllers.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base=path.resolve('output/arpg-animation/backward-v5');
const sourceRoots=['output/arpg-animation/backward-v4/candidate','output/arpg-animation/backward-v5/candidate'].map(p=>path.resolve(p));
const {THREE}=await import(pathToFileURL(path.join(sourceRoots[0],'tools/hero-locomotion-cpu-support.mjs')));
const loaders=await Promise.all(sourceRoots.map(async r=>(await import(pathToFileURL(path.join(r,'src/assets/dwarf-library.js')))).loadDwarfVisual));
const {HERO_SKILL_MOTIONS}=await import(pathToFileURL(path.join(sourceRoots[0],'src/assets/hero-skill-motion.js')));
const matrix=JSON.parse(await fs.readFile(path.join(base,'matrix/donor.json')));
const hashes=async()=>Promise.all(sourceRoots.map(async r=>Object.fromEntries(await Promise.all(['src/assets/hero-locomotion.js','src/assets/dwarf-locomotion-clips.json','assets/models/dwarf-rifleman.glb'].map(async f=>[f,createHash('sha256').update(await fs.readFile(path.join(r,f))).digest('hex')])))));
const before=await hashes(),results=[];
for(const test of matrix.results) {
  const parents=[new THREE.Group(),new THREE.Group()];
  const actors=await Promise.all(loaders.map((loader,i)=>loader({THREE,parent:parents[i],height:2.55})));
  const objects=actors.map(a=>{const list=[];a.model.traverse(o=>list.push(o));return list;});
  assert.deepEqual(objects[0].map(o=>o.name),objects[1].map(o=>o.name));
  const hipIndices=objects.map(list=>list.findIndex(o=>o.isBone&&/Hips/.test(o.name)));
  let maxProtectedWorld=0,maxProtectedHipRelative=0,maxLocalBoneLengthDifference=0,maxLocalBoneScaleDifference=0,castStarted=false,worstWorld=null;
  let maxSharedVerticalTranslation=0,maxWorldAfterSharedVerticalTranslation=0;
  const protectedNames=objects[0].filter(o=>!o.isBone||!/^(mixamorig:?)?(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(o.name)).map(o=>({name:o.name,type:o.type}));
  for(const frame of test.frames) {
    if(test.scenario.startsWith('dwarf_')&&!castStarted&&frame.time>=1.5) {
      const motion=HERO_SKILL_MOTIONS[test.scenario];
      for(const actor of actors)assert(actor.cast({skillId:test.scenario,castId:'paired',duration:motion.duration,impactAt:motion.impactAt}));
      castStarted=true;
    }
    for(let i=0;i<2;i++) {
      parents[i].position.fromArray(frame.position);
      actors[i].update(1/test.hz,{speed:frame.speed,velocity:frame.velocity});parents[i].updateMatrixWorld(true);
    }
    const inverseHips=objects.map((list,i)=>list[hipIndices[i]].matrixWorld.clone().invert());
    const sharedVertical=objects[1][hipIndices[1]].matrixWorld.elements[13]-objects[0][hipIndices[0]].matrixWorld.elements[13];
    maxSharedVerticalTranslation=Math.max(maxSharedVerticalTranslation,Math.abs(sharedVertical));
    for(let i=0;i<objects[0].length;i++) {
      const [a,b]=objects.map(list=>list[i]);
      if(a.isBone) {
        maxLocalBoneLengthDifference=Math.max(maxLocalBoneLengthDifference,a.position.distanceTo(b.position));
        maxLocalBoneScaleDifference=Math.max(maxLocalBoneScaleDifference,a.scale.distanceTo(b.scale));
      }
      if(a.isBone&&/^(mixamorig:?)?(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(a.name))continue;
      const rel=[a,b].map((o,k)=>o.matrixWorld.clone().premultiply(inverseHips[k]));
      for(let k=0;k<16;k++) {
        const difference=Math.abs(a.matrixWorld.elements[k]-b.matrixWorld.elements[k]);
        if(difference>maxProtectedWorld) worstWorld={name:a.name,type:a.type,frame:frame.frame,event:frame.event,index:k,from:a.matrixWorld.elements[k],to:b.matrixWorld.elements[k]};
        maxProtectedWorld=Math.max(maxProtectedWorld,difference);
        maxWorldAfterSharedVerticalTranslation=Math.max(maxWorldAfterSharedVerticalTranslation,
          Math.abs(b.matrixWorld.elements[k]-a.matrixWorld.elements[k]-(k===13?sharedVertical:0)));
        maxProtectedHipRelative=Math.max(maxProtectedHipRelative,Math.abs(rel[0].elements[k]-rel[1].elements[k]));
      }
    }
  }
  assert(maxProtectedHipRelative<1e-9);
  assert.equal(maxLocalBoneLengthDifference,0);assert.equal(maxLocalBoneScaleDifference,0);
  results.push({hz:test.hz,speed:test.speed,scenario:test.scenario,frames:test.frames.length,protectedNames,
    maxProtectedWorld,maxProtectedHipRelative,maxLocalBoneLengthDifference,maxLocalBoneScaleDifference,
    maxSharedVerticalTranslation,maxWorldAfterSharedVerticalTranslation,worstWorld,
    absoluteWorldParityPassed:maxProtectedWorld<1e-9});
  actors.forEach(a=>a.dispose());
}
const after=await hashes();assert.deepEqual(after,before);
await fs.writeFile(path.join(base,'pose-parity.json'),JSON.stringify({sourceRoots,before,after,sourceStable:true,
  scope:'All upper bones and non-bone transforms, including rifle/props; original rig local positions/scales; 20 paired CPU input paths',results},null,2),{flag:'wx'});
console.log(JSON.stringify({cases:results.length,maxWorld:Math.max(...results.map(r=>r.maxProtectedWorld)),maxHipRelative:Math.max(...results.map(r=>r.maxProtectedHipRelative)),sourceStable:true}));
assert(results.every(r=>r.absoluteWorldParityPassed),'Absolute world parity failed; report retained, limit unchanged');
