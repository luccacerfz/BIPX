// Additional CPU transient coverage; the independent root auditor is untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const [sourceArg, outputArg] = process.argv.slice(2);
assert(sourceArg && outputArg, 'Pass snapshot and new report path');
const source = path.resolve(sourceArg), output = path.resolve(outputArg);
await fs.access(output).then(() => { throw Error('Refusing to overwrite evidence'); }, () => {});
const files = ['src/assets/hero-locomotion.js','src/assets/dwarf-locomotion-clips.json',
  'src/assets/dwarf-library.js','src/assets/hero-skill-motion.js','src/assets/dwarf-skill-clips.json',
  'src/assets/hero-foot-probes.js','assets/models/dwarf-rifleman.glb','docs/arpg/review/sole-contact-audit.mjs'];
const fingerprints = async () => Object.fromEntries(await Promise.all(files.map(async f =>
  [f,createHash('sha256').update(await fs.readFile(path.join(source,f))).digest('hex')])));
const before = await fingerprints();
const {THREE,quantile,bonesOf} = await import(pathToFileURL(path.join(source,'tools/hero-locomotion-cpu-support.mjs')));
const {loadDwarfVisual} = await import(pathToFileURL(path.join(source,'src/assets/dwarf-library.js')));
const {HERO_SKILL_MOTIONS} = await import(pathToFileURL(path.join(source,'src/assets/hero-skill-motion.js')));
const ids = ['dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot'];
const thresholds = {groundBandMeters:.008,localLowestBandMeters:.003,verticalSpeedMaxMetersPerSecond:.05};
const distribution = a => ({count:a.length,p90:quantile(a,.9),max:a.length?Math.max(...a):null});
const results=[];
for(const hz of [30,60]) for(const speed of [6.5,9.1]) for(const scenario of ['start-stop','turn',...ids]) {
  const parent = new THREE.Group(), actor = await loadDwarfVisual({THREE,parent,height:2.55});
  const bones = bonesOf(actor.model), protectedBones = Object.values(bones).filter(b => !/^(mixamorig:?)?(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(b.name));
  const hip = Object.values(bones).find(b=>/Hips/.test(b.name));
  const probes=[[],[]];
  actor.model.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const {skinIndex,skinWeight}=mesh.geometry.attributes;
    for(let vertex=0;vertex<skinIndex.count;vertex++)for(let side=0;side<2;side++) {
      let weight=0;
      for(let k=0;k<4;k++) {
        const name=mesh.skeleton.bones[skinIndex.getComponent(vertex,k)].name;
        if(name.includes(side?'RightFoot':'LeftFoot') || name.includes(side?'RightToe':'LeftToe'))weight+=skinWeight.getComponent(vertex,k);
      }
      if(weight>.75)probes[side].push({mesh,vertex});
    }
  });
  const dt=1/hz, duration=5, frames=[], previous=[null,null];
  const groups={all:{patch:[],support:[],transition:[],released:[]},steady:{patch:[],support:[],transition:[],released:[]},transient:{patch:[],support:[],transition:[],released:[]}};
  let maximumReach=0, minimumSole=Infinity, maximumUpperError=0, finite=true, castStarted=false, observedFootFrames=0, patchFrames=0;
  const matricesHash=createHash('sha256'),contactHash=createHash('sha256'),worst=[];
  for(let frame=0;frame<duration*hz;frame++) {
    const time=frame*dt;
    // Same physical seconds and input paths at both rates; no warmup/sample exclusion.
    let actualSpeed=speed, angle=0, event='steady';
    if(scenario==='start-stop') {
      if(time<.5){actualSpeed=0;event='idle-before';}
      else if(time<.8){actualSpeed=speed*(time-.5)/.3;event='start';}
      else if(time>=2.8&&time<3.1){actualSpeed=speed*(3.1-time)/.3;event='stop';}
      else if(time>=3.1){actualSpeed=0;event='idle-after';}
    } else if(scenario==='turn') {
      if(time>=1.5&&time<2.1){angle=(time-1.5)/.6*Math.PI/2;event='turn';}
      else if(time>=2.1&&time<3){angle=Math.PI/2;}
      else if(time>=3&&time<3.6){angle=(1-(time-3)/.6)*Math.PI/2;event='turn-return';}
    } else if(time>=1.5 && time<1.5+HERO_SKILL_MOTIONS[scenario].duration+.3)event='cast';
    if(ids.includes(scenario)&&!castStarted&&time>=1.5) {
      const motion=HERO_SKILL_MOTIONS[scenario];
      assert(actor.cast({skillId:scenario,castId:`${scenario}-${speed}-${hz}`,duration:motion.duration,impactAt:motion.impactAt}));
      castStarted=true;
    }
    const velocity={x:Math.sin(angle)*actualSpeed,z:Math.cos(angle)*actualSpeed};
    parent.position.x+=velocity.x*dt;parent.position.z+=velocity.z*dt;
    actor.update(dt,{speed:actualSpeed,velocity});parent.updateMatrixWorld(true);
    actor.model.traverse(mesh=>{if(mesh.isSkinnedMesh)mesh.skeleton.update();});
    const inverseHip=new THREE.Matrix4().copy(hip.matrixWorld).invert();
    const protectedPose=protectedBones.flatMap(b=>b.matrixWorld.clone().premultiply(inverseHip).elements);
    // Preserve numerical data for paired comparison; hashes alone are too strict for roundoff.
    matricesHash.update(JSON.stringify(protectedPose));
    finite &&= protectedPose.every(Number.isFinite);
    maximumUpperError=Math.max(maximumUpperError,actor.stats.locomotion.upperBodyPoseError||0);
    const row={frame,time,event,speed:actualSpeed,velocity,position:parent.position.toArray(),gait:actor.stats.locomotion.gait,
      cast:actor.stats.cast?.phase||null,protectedPose,feet:[]};
    for(let side=0;side<2;side++) {
      const points=probes[side].map(({mesh,vertex})=>mesh.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      finite &&= points.every(p=>p.toArray().every(Number.isFinite));
      const minimum=Math.min(...points.map(p=>p.y)),c=actor.stats.locomotion.footContacts[side],contact=!!c?.contact,old=previous[side];
      minimumSole=Math.min(minimumSole,minimum);maximumReach=Math.max(maximumReach,c?.reachError||0);
      contactHash.update(`${contact?1:0}`);
      let patches=0,patchMax=0,materialMax=0,transitionMaterialMax=0;
      if(old) {
        observedFootFrames++;
        for(let n=0;n<points.length;n++) {
          const p=points[n],q=old.points[n],v=Math.hypot(p.x-q.x,p.z-q.z)/dt;
          materialMax=Math.max(materialMax,v);
          if(contact!==old.contact)transitionMaterialMax=Math.max(transitionMaterialMax,v);
          if(Math.abs(p.y)<=thresholds.groundBandMeters && Math.abs(q.y)<=thresholds.groundBandMeters
            &&p.y-minimum<=thresholds.localLowestBandMeters &&q.y-old.minimum<=thresholds.localLowestBandMeters
            &&Math.abs(p.y-q.y)/dt<=thresholds.verticalSpeedMaxMetersPerSecond) {
            patches++;patchMax=Math.max(patchMax,v);
            for(const group of [groups.all,groups[event==='steady'?'steady':'transient']]) {
              group.patch.push(v);
              if(contact&&old.contact)group.support.push(v);
              if(contact!==old.contact)group.transition.push(v);
              if(!contact&&!old.contact)group.released.push(v);
            }
            worst.push({frame,time,event,side,vertex:probes[side][n].vertex,velocity:v,from:q.toArray(),to:p.toArray(),contact,previousContact:old.contact});
          }
        }
        if(patches)patchFrames++;
      }
      row.feet.push({contact,previousContact:old?.contact??false,minimum,reach:c?.reachError||0,patches,patchMax,materialMax,transitionMaterialMax});
      previous[side]={points,minimum,contact};
    }
    frames.push(row);
  }
  assert(finite,'Nonfinite pose');assert(maximumUpperError<1e-5,'Upper-body chain continuity failed');
  results.push({hz,speed,scenario,probes:probes.map(p=>p.length),frameCount:frames.length,observedFootFrames,patchFrames,coverage:patchFrames/observedFootFrames,
    maximumReach,minimumSole,maximumUpperError,finite,castStarted,contactHash:contactHash.digest('hex'),protectedPoseHash:matricesHash.digest('hex'),
    groups:Object.fromEntries(Object.entries(groups).map(([k,g])=>[k,Object.fromEntries(Object.entries(g).map(([n,v])=>[n,distribution(v)]))])),
    worst:worst.sort((a,b)=>b.velocity-a.velocity).slice(0,12),frames});
  actor.dispose();
}
const after=await fingerprints();assert.deepEqual(after,before);
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify({scope:'CPU actual skinned mesh; all frames retained; transient matrix, not native/gameplay or no-slide acceptance',source,sourceUnchanged:true,before,after,thresholds,acceptedNoSliding:false,results}));
console.log(JSON.stringify({output,sourceUnchanged:true,cases:results.length,finite:results.every(r=>r.finite),maxReach:Math.max(...results.map(r=>r.maximumReach))}));
