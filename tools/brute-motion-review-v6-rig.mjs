// Authored key poses, immutable rig and bindings. Coordinates: right/up/forward in metres.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,loadCPU,rest,reset,skin,meshGround,q,v,maxAngle} from './brute-motion-review-v6-utils.mjs';
const base='output/brute-motion-v6';
const manifest=JSON.parse(fs.readFileSync(`${base}/source-manifest.json`));
const source=manifest.sources['assets/models/monsters/brute.glb'].snapshot;
export const DURATION=1.45;
export async function createRig(){
 const g=await loadCPU(source),model=g.scene,mix=new THREE.AnimationMixer(model);
 mix.clipAction(g.animations[0]).play();mix.update(0);const idle=rest(model),body=skin(model),box=meshGround(model),scale=3.3/box.getSize(v()).y,floor=box.min.y;
 const node=n=>model.getObjectByName(n),wp=n=>node(n).getWorldPosition(v()),bones=body.skeleton.bones;
 const world=p=>v().set(p.z*scale,(p.y-floor)*scale,p.x*scale);
 const raw=p=>v().set(p[2]/scale,p[1]/scale+floor,p[0]/scale);
 function worldQ(n,desired){const o=node(n);o.quaternion.copy(o.parent.getWorldQuaternion(q()).invert().multiply(desired)).normalize();o.updateMatrixWorld(true);}
 function rotate(n,axis,deg){worldQ(n,q().setFromAxisAngle(axis,deg*Math.PI/180).multiply(node(n).getWorldQuaternion(q())));}
 function ik(a,b,c,end,pole){
  const start=wp(a),mid=wp(b),finish=wp(c),l1=start.distanceTo(mid),l2=mid.distanceTo(finish),delta=end.clone().sub(start),requested=delta.length();
  const distance=THREE.MathUtils.clamp(requested,Math.abs(l1-l2)+1e-7,l1+l2-1e-7),axis=delta.normalize(),bend=pole.clone().sub(start);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along)),desiredMid=start.clone().addScaledVector(axis,along).addScaledVector(bend,height);
  if(a.endsWith('_Thigh')){
   worldQ(a,q().setFromUnitVectors(mid.sub(start).normalize(),desiredMid.clone().sub(start).normalize()).multiply(node(a).getWorldQuaternion(q())));
   worldQ(b,q().setFromUnitVectors(wp(c).sub(wp(b)).normalize(),end.clone().sub(wp(b)).normalize()).multiply(node(b).getWorldQuaternion(q())));
  }else{
   const desiredEnd=start.clone().addScaledVector(axis,distance),desiredNormal=desiredMid.clone().sub(start).cross(desiredEnd.clone().sub(desiredMid)).normalize();
   const ra=idle.get(a).worldP,rb=idle.get(b).worldP,rc=idle.get(c).worldP,referenceNormal=rb.clone().sub(ra).cross(rc.clone().sub(rb)).normalize();
   function frame(direction,normal){const x=direction.normalize(),y=normal.clone().normalize(),z=x.clone().cross(y).normalize();return q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));}
   worldQ(a,frame(desiredMid.clone().sub(start),desiredNormal).multiply(frame(rb.clone().sub(ra),referenceNormal).invert()).multiply(idle.get(a).worldQ));
   worldQ(b,frame(desiredEnd.clone().sub(desiredMid),desiredNormal).multiply(frame(rc.clone().sub(rb),referenceNormal).invert()).multiply(idle.get(b).worldQ));
  }
  return Math.max(0,requested-l1-l2)*scale;
 }
 const regions={hand:[],leftHand:[],forearm:[],upperarm:[],torso:[],leftFoot:[],rightFoot:[],shoulder:[]};
 const si=body.geometry.attributes.skinIndex,sw=body.geometry.attributes.skinWeight;
 for(let i=0;i<si.count;i++){
  const weights={};for(let j=0;j<4;j++){const n=bones[si.getComponent(i,j)].name;weights[n]=(weights[n]||0)+sw.getComponent(i,j);}
  const sum=re=>Object.entries(weights).reduce((s,[n,w])=>s+(re.test(n)?w:0),0);
  for(const [k,re]of Object.entries({hand:/^R_Hand$/,leftHand:/^L_Hand$/,forearm:/^R_Forearm/,upperarm:/^R_Upperarm/,torso:/^(Spine|Waist|Hip)/,leftFoot:/^L_(Foot|Toe)/,rightFoot:/^R_(Foot|Toe)/,shoulder:/^R_(Clavicle|Upperarm)/}))if(sum(re)>.45)regions[k].push(i);
 }
 const vertex=i=>body.getVertexPosition(i,v()).applyMatrix4(body.matrixWorld);
 const footMin=s=>Math.min(...regions[s==='L'?'leftFoot':'rightFoot'].map(i=>vertex(i).y));
 const footBase={L:footMin('L'),R:footMin('R')};
 const initialRight=world(idle.get('R_Hand').worldP).toArray(),initialLeft=world(idle.get('L_Hand').worldP).toArray();
 const initialContact=vertex(4337).sub(wp('R_Hand')).normalize();
 const desiredDirection=v().set(.6,-.8,0).normalize(); // Raw forward/down; no invented fingers.
 const desiredHandQ=q().setFromUnitVectors(initialContact,desiredDirection).multiply(idle.get('R_Hand').worldQ);
 function smooth(a,b,t){const u=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return u*u*u*(10+u*(-15+6*u));}
 function hermite(keys,t){
  let i=keys.findIndex(k=>k.t>=t);if(i<=0)return keys[0].v.slice();const a=keys[i-1],b=keys[i],u=(t-a.t)/(b.t-a.t),dt=b.t-a.t;
  const h0=2*u*u*u-3*u*u+1,h1=u*u*u-2*u*u+u,h2=-2*u*u*u+3*u*u,h3=u*u*u-u*u;
  return a.v.map((x,j)=>h0*x+h1*dt*((a.out||a.d)?.[j]||0)+h2*b.v[j]+h3*dt*((b.in||b.d)?.[j]||0));
 }
 const common=[
  {t:0,hip:[0,0,0],yaw:0,chest:0,lean:0},
  {t:.18,hip:[.27,-.10,-.04],yaw:-5,chest:-9,lean:-1},
  {t:.32,hip:[.27,-.11,-.02],yaw:-4,chest:-8,lean:0},
  {t:.40,hip:[.20,-.11,.02],yaw:-3,chest:-7,lean:1},
  {t:.62,hip:[-.035,-.15,.08],yaw:8,chest:12,lean:7},
  {t:.70,hip:[-.035,-.15,.10],yaw:10,chest:13,lean:8},
  {t:.82,hip:[-.035,-.15,.11],yaw:10,chest:11,lean:7},
  {t:1.05,hip:[.27,-.10,.07],yaw:4,chest:4,lean:2},
  {t:1.30,hip:[.27,-.09,.01],yaw:1,chest:1,lean:0},
  {t:1.45,hip:[0,0,0],yaw:0,chest:0,lean:0}
 ];
 function params(t){let i=common.findIndex(k=>k.t>=t);if(i<=0)return common[0];const a=common[i-1],b=common[i],u=smooth(a.t,b.t,t),p={};for(const k of ['hip','yaw','chest','lean'])p[k]=Array.isArray(a[k])?a[k].map((x,j)=>THREE.MathUtils.lerp(x,b[k][j],u)):THREE.MathUtils.lerp(a[k],b[k],u);return p;}
 function pose(t,variant={wrist:[0,1.95,.53]}){
  reset(model,idle);const p=params(t),offset=v().set(p.hip[2],p.hip[1],p.hip[0]).divideScalar(scale),hip=idle.get('Hip').worldP.clone().add(offset);node('Hip').position.copy(node('Hip').parent.worldToLocal(hip));model.updateMatrixWorld(true);
  rotate('Hip',v().set(0,1,0),p.yaw);rotate('Waist',v().set(0,1,0),p.chest*.45);rotate('Spine01',v().set(0,1,0),p.chest*.55);rotate('Spine01',v().set(0,0,1),-p.lean);
  rotate('NeckTwist01',v().set(0,1,0),-(p.yaw+p.chest)*.4);
  const step=smooth(.18,.40,t)-smooth(1.05,1.30,t),lift=t<.40?Math.sin(Math.PI*THREE.MathUtils.clamp((t-.18)/.22,0,1))**2*.07:t>1.05?Math.sin(Math.PI*THREE.MathUtils.clamp((t-1.05)/.25,0,1))**2*.065:0;
  const plantar=smooth(.03,.16,t)*(1-smooth(1.30,1.45,t)),pivot=(smooth(.45,.68,t)-smooth(.86,1.05,t))*.5;
  let reach=0;const reaches={};
  for(const s of ['L','R']){
   const f=idle.get(`${s}_Foot`),toe=idle.get(`${s}_ToeBase`),pitch=(variant.footPitch?.[s]??(s==='L'?.05581808090209961:9.397037982940674))*plantar+(s==='R'?pivot:0),rot=q().setFromAxisAngle(v().set(0,0,1),-pitch*Math.PI/180);
   const ankle=f.worldP.clone().sub(toe.worldP).applyQuaternion(rot).add(toe.worldP);if(s==='L')ankle.x+=.28*step/scale;
   const desiredY=THREE.MathUtils.lerp(footBase[s],floor,plantar)+(s==='L'?lift/scale:0);
   const pole=idle.get(`${s}_Calf`).worldP.clone().add(v().set(.16*plantar,0,0));
   for(let j=0;j<3;j++){
    const e=ik(`${s}_Thigh`,`${s}_Calf`,`${s}_Foot`,ankle,pole);reaches[`${s}Leg`]=Math.max(reaches[`${s}Leg`]||0,e);reach=Math.max(reach,e);worldQ(`${s}_Foot`,rot.clone().multiply(f.worldQ));skin(model);ankle.y+=desiredY-footMin(s);
   }
  }
  const wrist=variant.wrist;
  const rightKeys=[{t:0,v:initialRight},{t:.18,v:[.80,2.38,-.21]},{t:.40,v:[.92,2.82,0]},
   {t:.50,v:[.78,2.85,.45],d:[-2,-.5,4.5]},
   {t:.60,v:[.48,Math.max(wrist[1]+.30,2.60),wrist[2]-.06],d:[-3,-3,2]},
   {t:.70,v:wrist,in:variant.contactVelocity||[-1,-1.5,.35],out:[.15,.4,-.2]},
   {t:.745,v:[wrist[0]+.018,wrist[1]+.025,wrist[2]-.035]},
   {t:.82,v:[wrist[0]+.22,wrist[1]+.12,wrist[2]-.04]},
   {t:1.05,v:[.86,2.35,.08]},{t:1.30,v:[.76,2.24,.04]},{t:1.45,v:initialRight}];
  const right=hermite(rightKeys,t),left=hermite([{t:0,v:initialLeft},{t:.18,v:[-1.04,2.25,.07]},{t:.40,v:[-1.04,2.30,.09]},{t:.70,v:[-1.04,2.30,.24]},{t:.82,v:[-1.04,2.28,.24]},{t:1.05,v:[-1.04,2.26,.10]},{t:1.30,v:[-1.04,2.20,.04]},{t:1.45,v:initialLeft}],t);
  right[0]+=.16*(smooth(0,.18,t)-smooth(.40,.62,t)+smooth(.82,1.05,t)-smooth(1.30,1.45,t));
  const blend=smooth(0,.18,t)*(1-smooth(1.30,1.45,t));
  for(const s of ['L','R']){
   const sh=wp(`${s}_Upperarm`),ref=idle.get(`${s}_Upperarm`).worldP,axis=idle.get(`${s}_Hand`).worldP.clone().sub(ref).normalize(),bend=idle.get(`${s}_Forearm`).worldP.clone().sub(ref);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
   bend.lerp(v().set(-.45,-.55,s==='R'?.8:-.8).normalize(),blend).normalize();
   const e=ik(`${s}_Upperarm`,`${s}_Forearm`,`${s}_Hand`,raw(s==='R'?right:left),sh.clone().addScaledVector(bend,.3));reaches[`${s}Arm`]=e;reach=Math.max(reach,e);
  }
  const orient=smooth(.40,.64,t)*(1-smooth(.82,1.45,t));
  worldQ('R_Hand',node('R_Hand').getWorldQuaternion(q()).slerp(desiredHandQ,orient));
  worldQ('L_Hand',node('L_Hand').getWorldQuaternion(q()).slerp(idle.get('L_Hand').worldQ,blend));
  model.updateMatrixWorld(true);skin(model);
  return {reach,reaches,p,step,lift,pivot,rightRequested:right,handOrient:orient};
 }
 function points(){return Array.from({length:body.geometry.attributes.position.count},(_,i)=>{const p=world(vertex(i));return [p.x,p.y,-p.z];});}
 function joints(){return Object.fromEntries(bones.map(b=>{const p=world(wp(b.name));return [b.name,[p.x,p.y,-p.z]];}));}
 function angle(a,b,c){return wp(a).sub(wp(b)).angleTo(wp(c).sub(wp(b)))*180/Math.PI;}
 function record(t,variant){const info=pose(t,variant),js=joints(),pts=points();return {time:t,info,joints:js,positions:pts,knees:['L','R'].map(s=>angle(`${s}_Thigh`,`${s}_Calf`,`${s}_Foot`)),torsoLean:wp('Head').sub(wp('Hip')).angleTo(v().set(0,1,0))*180/Math.PI,height:Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1])),localQuaternions:Object.fromEntries(bones.map(b=>[b.name,b.quaternion.toArray()])),hipLocal:node('Hip').position.toArray()};}
 pose(0);const identity=bones.map(b=>({bone:b.name,rotation:maxAngle(b.quaternion,idle.get(b.name).quaternion),position:b.getWorldPosition(v()).distanceTo(idle.get(b.name).worldP)*scale}));
 assert(Math.max(...identity.map(x=>x.position))<.0001,'Idle identity');
 return {g,model,body,bones,idle,regions,scale,floor,pose,points,joints,record,identity,common,indices:Array.from(body.geometry.index.array),source};
}
