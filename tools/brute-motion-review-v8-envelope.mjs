// Directional support bounds computed from fixed geometry. No actor repositioning.
import fs from 'node:fs';
import {loadBody} from './brute-motion-review-v8-body.mjs';
import {createTargets} from './brute-motion-review-v7-targets.mjs';
const name='dwarf-withdraw-surface',base='output/brute-motion-v7/candidate-04';
const body=await loadBody(`${base}/${name}.glb`),target=await createTargets('dwarf');
const reg=JSON.parse(fs.readFileSync('output/brute-motion-v6/handoff-01/warrior-cpu.json')).regions;
const frames=JSON.parse(fs.readFileSync(`${base}/${name}-cpu.json`)).frames,rows=[];
for(const f of frames){
 body.seek(f.t);const p=body.points(),rifle=target.sample(f.condition).find(m=>m.name==='DwarfRifle');
 const rifleTowardBrute=Math.max(...rifle.points.map(p=>p.z))+f.condition.distance;
 const torsoForward=-Math.min(...reg.torso.map(i=>p[i].z)),wholeForward=-Math.min(...p.map(p=>p.z));
 rows.push({t:f.t,centerDistance:f.condition.distance,rifleTowardBrute,torsoForward,wholeForward,
  sufficientSeparationTorso:rifleTowardBrute+torsoForward+.005,sufficientSeparationWholeMesh:rifleTowardBrute+wholeForward+.005});
}
const peak=rows.reduce((a,b)=>b.sufficientSeparationTorso>a.sufficientSeparationTorso?b:a);
fs.writeFileSync('output/brute-motion-v8/diagnosis/approach-envelope.json',JSON.stringify({scope:'Conservative sufficient axial separating-plane bound, NOT minimum necessary distance, legal reach or permitted target move. Actor positions unchanged.',nominalLegalReach:1.90,clearance:.005,peak,rows},null,2)+'\n');console.log(JSON.stringify(peak));
