import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createCollisionWorld,createActorIndex,moveActor,stepActor,sweepStatic} from '../output/physics/pursuit-native-20260919/game/src/physics/contacts.mjs';
import {getPursuitDirection} from '../output/physics/pursuit-native-20260919/game/src/physics/navigation.mjs';
import {separateControlledActors} from '../output/physics/pursuit-native-20260919/game/src/combat/crowd-control.mjs';
import {getEnvironmentColliders,ENVIRONMENT_GROUND} from '../output/physics/pursuit-native-20260919/game/src/render/environment-layout.js';
const input=process.argv[2];assert.ok(input,'evidence directory required');const world=createCollisionWorld({colliders:getEnvironmentColliders(),bounds:ENVIRONMENT_GROUND,groundY:0});
const report={at:new Date().toISOString(),scope:'Post-capture CPU replay of observed native dt/player history using exact staged steering, index, stepActor and crowd; original failing audit retained. No new browser or gameplay injection.',results:[]};
for(const name of ['north-fixed','south-fixed','north-moving']) {
 const file=path.join(input,name+'.json'),r=JSON.parse(fs.readFileSync(file)),initial=r.initial;let nav=null;
 const metrics={name,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),frames:0,maxReplayError:0,maxVoluntaryStep:0,maxVoluntaryExcess:0,maxCrowdCorrection:0,maxInputOverlap:0,maxFinalOverlap:0,maxStaticInvalid:0,traceSegments:0,correctedFrames:0,plans:[],hits:r.runtime.hits,marks:r.runtime.marks};
 for(const s of r.runtime.samples){
  const a=s.before[0],body={id:`monster:${a.id}`,x:a.x,z:a.z,radius:a.radius,freezeTimer:0,stunTimer:0};
  const target={id:'player:local',x:s.player.x,z:s.player.z,radius:initial.player.radius,inverseMass:0};
  const result=getPursuitDirection(world,body,target,nav,s.dt,{speed:initial.speed,arrivalRadius:body.radius+.72,attackRegion:{range:body.radius+target.radius+.74,minDistance:body.radius+target.radius,losY:.9},allowPlanning:true});nav=result.state;
  if(result.state.planned)metrics.plans.push({time:s.time-s.dt,target:{x:target.x,z:target.z},visited:result.state.visited,waypoints:result.state.waypoints});
  const m=stepActor(world,body,{x:result.direction.x*initial.speed,z:result.direction.z*initial.speed},s.dt,{bodies:createActorIndex([body,target]),trace:true});
  const voluntary=Math.hypot(m.x-body.x-m.recovery.x,m.z-body.z-m.recovery.z);metrics.maxVoluntaryStep=Math.max(metrics.maxVoluntaryStep,voluntary);metrics.maxVoluntaryExcess=Math.max(metrics.maxVoluntaryExcess,voluntary-initial.speed*s.dt);
  const crowd=separateControlledActors(world,[{...body,x:m.x,z:m.z},target],s.dt,{trace:true}),b=crowd.bodies[0],observed=s.bodies[0];
  const correction=Math.hypot(b.x-m.x,b.z-m.z);metrics.maxCrowdCorrection=Math.max(metrics.maxCrowdCorrection,correction);if(correction>1e-7)metrics.correctedFrames++;
  metrics.maxReplayError=Math.max(metrics.maxReplayError,Math.hypot(b.x-observed.x,b.z-observed.z));
  metrics.maxInputOverlap=Math.max(metrics.maxInputOverlap,body.radius+target.radius-Math.hypot(body.x-target.x,body.z-target.z));
  metrics.maxFinalOverlap=Math.max(metrics.maxFinalOverlap,body.radius+target.radius-Math.hypot(b.x-target.x,b.z-target.z));
  const valid=moveActor(world,b,{x:0,z:0});assert.equal(valid.unresolved,false);metrics.maxStaticInvalid=Math.max(metrics.maxStaticInvalid,Math.hypot(valid.x-b.x,valid.z-b.z));
  for(const segment of [...m.trace,...crowd.trace]){assert.equal(sweepStatic(world,segment.from,segment.to,body.radius,{kind:'actor'}),null);metrics.traceSegments++;}
  metrics.frames++;
 }
 assert.ok(metrics.maxReplayError<1e-8,JSON.stringify(metrics));assert.ok(metrics.maxVoluntaryExcess<1e-8);assert.ok(metrics.maxCrowdCorrection<=.2+1e-8);assert.ok(metrics.maxFinalOverlap<=.001+1e-8);assert.ok(metrics.maxStaticInvalid<1e-8);
 for(const hit of metrics.hits){assert.ok(hit.after<hit.before);for(const b of hit.bosses){assert.ok(b.clearLos);assert.ok(Math.hypot(b.x-hit.player.x,b.z-hit.player.z)<=b.radius+initial.player.radius+.74+1e-6);}}
 if(name==='north-moving') {const [a,b]=metrics.marks;metrics.playerDisplacement=Math.hypot(b.player.x-a.player.x,b.player.z-a.player.z);assert.ok(metrics.playerDisplacement>1.5);metrics.movedTargetPlans=metrics.plans.filter(p=>p.time>=a.time&&Math.hypot(p.target.x-initial.player.x,p.target.z-initial.player.z)>.1);assert.ok(metrics.movedTargetPlans.length>0);}
 metrics.passed=true;report.results.push(metrics);
}
report.passed=true;fs.writeFileSync(path.join(input,'post-capture-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.results.map(({name,frames,maxReplayError,maxVoluntaryExcess,maxCrowdCorrection,maxInputOverlap,maxFinalOverlap,traceSegments,correctedFrames,playerDisplacement})=>({name,frames,maxReplayError,maxVoluntaryExcess,maxCrowdCorrection,maxInputOverlap,maxFinalOverlap,traceSegments,correctedFrames,playerDisplacement})),null,2));
