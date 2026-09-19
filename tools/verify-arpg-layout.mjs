import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createCollisionWorld,moveActor,stepActor,sweepStatic,findFreePosition,createActorIndex,pullActors} from '../src/physics/contacts.mjs';
import {getPursuitDirection} from '../src/physics/navigation.mjs';
import {getEnvironmentColliders,ENVIRONMENT_GROUND} from '../src/render/environment-layout.js';
import {createSkillState,beginSkill,advanceSkills} from '../src/combat/class-skills.mjs';
import {separateControlledActors} from '../src/combat/crowd-control.mjs';
const colliders=getEnvironmentColliders(),world=createCollisionWorld({colliders,bounds:ENVIRONMENT_GROUND});
const files=['src/main.js','server.mjs','src/physics/contacts.mjs','src/physics/navigation.mjs','src/combat/crowd-control.mjs','src/combat/class-skills.mjs','src/render/environment-layout.js','src/render/asset-dressing.js','src/render/cemetery.js','src/render/environment-composition-ground.js','tools/verify-arpg-layout.mjs','tools/baselines/environment-layout-153.json'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report={at:new Date().toISOString(),scope:'Deterministic synthetic CPU integration of current layout, shared class core, navigation and Physics. Actual browser/Node hooks and native gameplay are separate checks. No render or performance claim.',sourceHashes:hashes(),tests:[]};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
function safe(body){const p=moveActor(world,body,{x:0,z:0});assert.equal(p.unresolved,false);assert.ok(dist(p,body)<2e-4,'Position penetrates static layout');assert.ok(Math.hypot(body.x,body.z)+body.radius<=55+1e-5)}
function free(id,x,z,radius=.64,actors=[]){const p=findFreePosition(world,{id,x,z,radius},{actors,maxDistance:16});assert.ok(p.found,`No free setup for ${id}`);const body={id,x:p.x,z:p.z,radius};safe(body);return body}
const transform=(c,x,z)=>({x:c.x+Math.cos(c.yaw||0)*x+Math.sin(c.yaw||0)*z,z:c.z-Math.sin(c.yaw||0)*x+Math.cos(c.yaw||0)*z});
function check(name,run){try{report.tests.push({name,passed:true,details:run()})}catch(e){report.tests.push({name,passed:false,error:e.stack})}}
function cast(classId,slot,start,aim,targets=[],dt=.02){
 const actor={...start,playing:true,damageMultiplier:2,runId:'layout'},state=createSkillState(classId),events=[],hits=[];
 assert.ok(beginSkill(state,{slot,aimX:aim.x,aimZ:aim.z},actor).ok);
 for(let t=0;t<2;t+=Math.min(dt,.1))advanceSkills(state,dt,{actor,targets,emit:e=>events.push(e),hit:(target,e)=>{hits.push({id:target.id,...e});return false},sweepStatic:(a,b,r,kind)=>sweepStatic(world,a,b,r,{kind}),moveCaster:delta=>{const p=moveActor(world,actor,delta,{stopOnContact:true});actor.x=p.x;actor.z=p.z;safe(actor);return p}});
 return {actor,state,events,hits};
}
// The promoted layout is the 153-collider crypt+maintenance combination (docs/arpg/environment-combined-v1.md): over the former
// 143-collider runtime it adds the ten height-banded parts of the arch plus the west flank, removes the wide `crypt-entry-wall`
// proxy and changes five descriptors. The delta is versioned in tools/baselines so a clean clone can check it by value.
const baseline=JSON.parse(fs.readFileSync(new URL('./baselines/environment-layout-153.json',import.meta.url)));
check('promoted layout has153unique colliders,55m bounds,Y0 and exact11added/1removed/5changed over runtime143',()=>{
 assert.equal(baseline.colliders,153);assert.equal(colliders.length,153);assert.equal(new Set(colliders.map(c=>c.id)).size,153);assert.equal(ENVIRONMENT_GROUND.radius,55);assert.equal(ENVIRONMENT_GROUND.y,0);
 assert.equal(baseline.added.length,11);assert.equal(baseline.removed.length,1);assert.equal(baseline.changed.length,5);assert.equal(baseline.previousColliders+baseline.added.length-baseline.removed.length,colliders.length);
 for(const c of baseline.added)assert.deepEqual(colliders.find(x=>x.id===c.id),c);for(const c of baseline.changed)assert.deepEqual(colliders.find(x=>x.id===c.id),c.after);
 for(const id of [...baseline.removed,...baseline.removedEarlier])assert.ok(!colliders.some(c=>c.id===id),id);
 const layoutSha256=crypto.createHash('sha256').update(fs.readFileSync('src/render/environment-layout.js')).digest('hex');
 return {colliders:153,added:baseline.added.map(c=>c.id),removed:baseline.removed,changed:baseline.changed.map(c=>c.id),layoutSha256,matchesPromotedHash:layoutSha256===baseline.provenance.promotedLayoutSha256};
});
check('actor-aware spawn at all four slots and three new ensembles includes boss bodies and preserves prior positions',()=>{
 const results=[];
 for(const [x,z] of [[0,0],[4,0],[-4,0],[0,4],[12.3,-15.7],[-13.4,-11],[19.3,12.8]]){
  const actors=[];
  for(let i=0;i<12;i++){const before=JSON.stringify(actors),body=free(`body-${i}`,x,z,i%4===0?1.72:.64,actors);assert.equal(JSON.stringify(actors),before);assert.ok(actors.every(a=>dist(a,body)>=a.radius+body.radius-1e-6));actors.push(body)}
  results.push({origin:{x,z},count:actors.length,bosses:3,maxRelocation:Math.max(...actors.map(a=>dist(a,{x,z})))});
 }
 return results;
});
check('low beams block actors/ground projectiles while rifle.85 and class shots1.05 pass above; crypt wall/door block at1.05',()=>{
 const results=[];
 for(const c of colliders.filter(c=>/^fallen-beam-|^crypt-entry-door$/.test(c.id))){
  const isolated=createCollisionWorld({colliders:[c],bounds:ENVIRONMENT_GROUND}),a=transform(c,0,-c.halfZ-2),b=transform(c,0,c.halfZ+2);
  const low=sweepStatic(isolated,{...a,y:.08},{...b,y:.08},.02),rifle=sweepStatic(isolated,{...a,y:.85},{...b,y:.85},.12),skill=sweepStatic(isolated,{...a,y:1.05},{...b,y:1.05},.28);
  assert.ok(low);assert.ok(sweepStatic(isolated,a,b,.64,{kind:'actor'}));
  if(c.id.startsWith('fallen-beam')){assert.equal(rifle,null);assert.equal(skill,null)}else{assert.ok(rifle);assert.ok(skill)}
  results.push({id:c.id,lowBlocked:!!low,rifleBlocked:!!rifle,skillBlocked:!!skill});
 }
 assert.equal(results.length,5);
 // Compound arch: every part must block exactly the probes that overlap its declared height band (an arch is open below its
 // crown and its root feet start above the ground), and a probe through its own mid-height is always stopped.
 const parts=colliders.filter(c=>c.id.startsWith('crypt-entry-wall-')),probes={low:[.08,.02],rifle:[.85,.12],skill:[1.05,.28]};assert.equal(parts.length,10);
 for(const c of parts){
  const isolated=createCollisionWorld({colliders:[c],bounds:ENVIRONMENT_GROUND}),a=transform(c,0,-c.halfZ-2),b=transform(c,0,c.halfZ+2),mid=(c.minY+c.maxY)/2,entry={id:c.id,band:[c.minY,c.maxY]};
  assert.ok(sweepStatic(isolated,{...a,y:mid},{...b,y:mid},.02),`${c.id} mid-band`);
  for(const [name,[y,r]] of Object.entries(probes)){const expected=y+r>c.minY&&y-r<c.maxY,hit=!!sweepStatic(isolated,{...a,y},{...b,y},r);assert.equal(hit,expected,`${c.id} ${name}`);entry[name]=hit}
  entry.actor=!!sweepStatic(isolated,a,b,.64,{kind:'actor'});assert.equal(entry.actor,c.minY<2,`${c.id} actor`);results.push(entry);
 }
 // Facade: the old single box was probed on its centre line; the compound keeps that line closed at every height and, across
 // the whole former wall width, never lets a class shot or a body through. Rifle/ground slots beside the door are recorded.
 const facade=createCollisionWorld({colliders:colliders.filter(c=>/^crypt-/.test(c.id)),bounds:ENVIRONMENT_GROUND}),span={from:12.3-2.668,to:12.3+2.668},front=-13.8,back=-21.5,open={low:[],rifle:[]};
 const through=(x,y,r,options)=>sweepStatic(facade,{x,z:front,...(y===undefined?{}:{y})},{x,z:back,...(y===undefined?{}:{y})},r,options);
 for(const [y,r] of Object.values(probes))assert.ok(through(12.3,y,r),'centre line');assert.ok(through(12.3,undefined,.64,{kind:'actor'}));
 for(let x=span.from;x<=span.to+1e-9;x+=.01){assert.ok(through(x,1.05,.28),`class shot crossed facade at x${x.toFixed(2)}`);assert.ok(through(x,undefined,.64,{kind:'actor'}),`actor crossed facade at x${x.toFixed(2)}`);for(const name of ['low','rifle'])if(!through(x,...probes[name]))open[name].push(+x.toFixed(2))}
 results.push({id:'crypt-facade',span,classShotBlockedEverywhere:true,actorBlockedEverywhere:true,openTransects:{low:open.low.length,rifle:open.rifle.length},rifleOpenAt:open.rifle,note:'Promoted arch is height-banded by design (environment-crypt-entrance-v1.md); rifle/ground slots are reported, not asserted.'});
 return results;
});
check('actual dash8m and charge7m stop at new walls/doors/beams and fences at60/10Hz and oversized inputdt',()=>{
 const results=[],ids=['crypt-entry-wall-west-foot','crypt-entry-wall-east-foot','crypt-entry-wall-rear-low','crypt-west-return','crypt-entry-door','fallen-beam-0','fallen-beam-1','fallen-beam-2','fallen-beam-3','burial-rail-0'];
 for(const id of ids){const c=colliders.find(c=>c.id===id);assert.ok(c,id);
  for(const sign of [-1,1]){
   const requested=transform(c,0,sign*(c.halfZ+.64+1.5)),start=free('warrior',requested.x,requested.z),aim={x:c.x-start.x,z:c.z-start.z},length=Math.hypot(aim.x,aim.z);aim.x/=length;aim.z/=length;
   for(const slot of [1,2])for(const dt of [1/60,.1,2]){
    const result=cast('warrior',slot,start,aim,[],dt),travel=result.events.filter(e=>e.phase==='travel');assert.ok(travel.length);assert.ok(travel.at(-1).terminal);assert.ok(dist(result.actor,start)<(slot===1?8:7)-.1);
    for(const e of travel)assert.equal(sweepStatic(world,e.origin,e.target,.64,{kind:'actor'}),null,'Accepted path crossed static cover');
    results.push({id,sign,slot,dt,start,endpoint:{x:result.actor.x,z:result.actor.z},travel:dist(start,result.actor),segments:travel.length});
   }
  }
 }
 for(const slot of [1,2]){const r=cast('warrior',slot,{id:'free',x:0,z:0,radius:.64},{x:0,z:-1});near(dist(r.actor,{x:0,z:0}),slot===1?8:7)}
 return results;
});
check('actual cannon/frost/gravity contacts and area LOS stop at crypt wall with no behind-wall damage',()=>{
 const start=free('dwarf',12.3,-12.7),target={...free('victim',12.3,-19.7,.5),health:100},length=dist(start,target),aim={x:(target.x-start.x)/length,z:(target.z-start.z)/length};
 assert.ok(sweepStatic(world,{...start,y:1.05},{...target,y:1.05},0));const results=[];
 for(const slot of [0,1,2])for(const dt of [1/60,.1]){const r=cast('dwarf',slot,start,aim,[target],dt);assert.equal(r.hits.length,0);const impact=r.events.find(e=>e.phase==='impact');assert.ok(impact);assert.ok(dist(start,impact.target)<dist(start,target)-.5);results.push({slot,dt,impact:impact.target,hits:r.hits.length,fieldCount:r.state.fields.length})}
 return results;
});
check('pursuit from both sides of crypt/garden/maintenance corners, normal and boss radii, never cuts accepted segments',()=>{
 const results=[];
 for(const [name,a,b] of [['crypt',[8,-17.5],[16,-14]],['garden',[-18,-14],[-10,-8]],['maintenance',[16,9],[23,15]]])for(const reverse of [false,true])for(const radius of [.64,1.72]){
  const ends=reverse?[b,a]:[a,b],target=free('target',...ends[1],radius);let actor=free('pursuer',...ends[0],radius),navigation=null,plans=0,frames=0,maxStep=0;
  const arrival=radius+1;
  for(;frames<600&&dist(actor,target)>arrival;frames++){
   const p=getPursuitDirection(world,actor,target,navigation,.05,{speed:3.3,arrivalRadius:arrival});navigation=p.state;plans+=Number(p.state.planned);assert.ok(p.state.visited<=768);
   const m=stepActor(world,actor,{x:p.direction.x*3.3,z:p.direction.z*3.3},.05,{trace:true});assert.equal(m.unresolved,false);
   for(const s of m.trace)assert.equal(sweepStatic(world,s.from,s.to,radius,{kind:'actor'}),null);maxStep=Math.max(maxStep,dist(actor,m));actor={...actor,x:m.x,z:m.z};safe(actor);
  }
  assert.ok(dist(actor,target)<=arrival,`${name} r${radius} reverse${reverse} remained ${dist(actor,target)}`);assert.ok(maxStep<=.16501);
  results.push({name,reverse,radius,seconds:frames*.05,plans,remaining:dist(actor,target),maxStep});
 }
 return results;
});
check('control and gravity pull at three ensembles respect real corners/low beams, then remain statically valid',()=>{
 const results=[];
 for(const [name,x,z] of [['crypt',12.3,-14],['garden',-13.4,-11],['maintenance',19.3,12.8]]){
  const center=free('center',x,z,.1);let actors=[];
  for(let i=0;i<8;i++){const angle=i*Math.PI/4,body=free(`e${i}`,center.x+Math.cos(angle)*4,center.z+Math.sin(angle)*4,.5,actors);actors.push({...body,inverseMass:1,pullScale:i===0?.35:1,freezeTimer:i%2?3:0,stunTimer:i%2?0:3})}
  const initial=actors.reduce((sum,a)=>sum+dist(a,center),0)/actors.length;let maxPenetration=0,maxStep=0;
  for(let i=0;i<180;i++){
   const before=actors;const pulled=pullActors(world,actors,center,1/60,{radius:6,speed:4.5,coreRadius:.55,iterations:4,trace:true});assert.equal(pulled.unresolved,false);
   actors=separateControlledActors(world,pulled.bodies,1/60).bodies.map(a=>({...a,inverseMass:1}));
   for(let n=0;n<actors.length;n++){safe(actors[n]);maxStep=Math.max(maxStep,dist(actors[n],before[n]))}
   for(let a=0;a<actors.length;a++)for(let b=a+1;b<actors.length;b++)maxPenetration=Math.max(maxPenetration,actors[a].radius+actors[b].radius-dist(actors[a],actors[b]));
  }
  const final=actors.reduce((sum,a)=>sum+dist(a,center),0)/actors.length;assert.ok(final<initial-.3);assert.ok(maxPenetration<.081);
  results.push({name,initialMean:initial,finalMean:final,maxPenetration,maxStep,center});
 }
 return results;
});
report.sourceStable=JSON.stringify(report.sourceHashes)===JSON.stringify(hashes());report.passed=report.tests.every(t=>t.passed)&&report.sourceStable;
const dir=process.env.BIPX_EVIDENCE_DIR?path.resolve(process.env.BIPX_EVIDENCE_DIR):path.join('output/qa/arpg-environment-integrated-20260919',report.at.replace(/[:.]/g,'-'));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'layout-integration.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({dir,passed:report.passed,sourceStable:report.sourceStable,checks:report.tests.length,failures:report.tests.filter(t=>!t.passed)},null,2));if(!report.passed)process.exitCode=1;
