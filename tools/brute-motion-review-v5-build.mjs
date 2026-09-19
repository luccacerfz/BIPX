// Authored standing strike, staging only. Original binds and four clips remain byte-identical.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,hash,MAP,loadCPU,rest,reset,skin,meshGround,maxAngle,appendClip,q,v} from './brute-motion-review-v5-utils.mjs';
const base='output/brute-motion-v5', revision=process.argv[2]||'candidate-07', out=`${base}/${revision}`;
fs.mkdirSync(out,{recursive:true});
const original='assets/models/monsters/brute.glb';
const reference='output/brute-motion-v4/source/zombie attack 2.glb';
assert.equal(hash(fs.readFileSync(original)),'d1d58b1ae86045d9fa39dba9b4e87a0bd6d1a66b347d74624cf8095ce208c02a');
assert.equal(hash(fs.readFileSync(reference)),'d213f923971eb091af7e43078bf8477a3dd695cda74361305db6b19399a44d12');
const target=await loadCPU(original), source=await loadCPU(reference);
function atZero(g,index){const mixer=new THREE.AnimationMixer(g.scene);mixer.clipAction(g.animations[index]).play();mixer.update(0);return rest(g.scene);}
const idle=atZero(target,0), source0=atZero(source,0), body=skin(target.scene), bounds=meshGround(target.scene);
const scale=3.3/bounds.getSize(v()).y, floor=bounds.min.y;
const node=n=>target.scene.getObjectByName(n), wp=n=>node(n).getWorldPosition(v());
const bones=body.skeleton.bones, basis=q().setFromAxisAngle(v().set(0,1,0),Math.PI/2);
const degrees=x=>x*Math.PI/180;
function angle(a,b,c){return wp(a).sub(wp(b)).angleTo(wp(c).sub(wp(b)))*180/Math.PI;}
function posture(){return {knees:['L','R'].map(s=>angle(`${s}_Thigh`,`${s}_Calf`,`${s}_Foot`)),hip:wp('Hip').toArray(),torsoLean:wp('Head').sub(wp('Hip')).angleTo(v().set(0,1,0))*180/Math.PI,height:meshGround(target.scene).getSize(v()).y*scale};}
function worldQ(n,desired){const o=node(n);o.quaternion.copy(o.parent.getWorldQuaternion(q()).invert().multiply(desired)).normalize();o.updateMatrixWorld(true);}
function rotate(n,axis,angle){worldQ(n,q().setFromAxisAngle(axis,degrees(angle)).multiply(node(n).getWorldQuaternion(q())));}
const calibration=[];
// Store a per-joint world reference, not a modification to inverse bind matrices.
for(const [s,t]of Object.entries(MAP)){
 let sn;source.scene.traverse(n=>{if(n.name.replace(/^mixamorig[:_]?/i,'')===s)sn=n;});assert(sn);
 const sr=source0.get(sn.name),tr=idle.get(t),delta=sr.worldQ.clone().multiply(sr.worldQ.clone().invert());
 const reconstructed=basis.clone().multiply(delta).multiply(basis.clone().invert()).multiply(tr.worldQ);
 calibration.push({source:sn.name,target:t,source0WorldQuaternion:sr.worldQ.toArray(),targetIdle0WorldQuaternion:tr.worldQ.toArray(),sourceToTargetWorldOffset:tr.worldQ.clone().multiply(basis.clone().multiply(sr.worldQ).invert()).toArray(),identityErrorRadians:maxAngle(reconstructed,tr.worldQ)});
}
assert(Math.max(...calibration.map(x=>x.identityErrorRadians))<1e-6);
const initial=posture();
// Two-bone solve: anatomical bend frames for arms; shortest-arc support for legs.
// The fixed ankle is a support constraint; thigh/calf are free to articulate.
function ik(a,b,c,end,pole){
 const start=wp(a),mid=wp(b),finish=wp(c),l1=start.distanceTo(mid),l2=mid.distanceTo(finish);
 const delta=end.clone().sub(start),requested=delta.length(),distance=THREE.MathUtils.clamp(requested,Math.abs(l1-l2)+1e-7,l1+l2-1e-7),axis=delta.normalize();
 const bend=pole.clone().sub(start).addScaledVector(axis,-pole.clone().sub(start).dot(axis)).normalize();
 const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const desiredMid=start.clone().addScaledVector(axis,along).addScaledVector(bend,height);
 if(a.endsWith('_Thigh')){
  worldQ(a,q().setFromUnitVectors(mid.sub(start).normalize(),desiredMid.clone().sub(start).normalize()).multiply(node(a).getWorldQuaternion(q())));
  worldQ(b,q().setFromUnitVectors(wp(c).sub(wp(b)).normalize(),end.clone().sub(wp(b)).normalize()).multiply(node(b).getWorldQuaternion(q())));
  return Math.max(0,requested-l1-l2);
 }
 const desiredEnd=start.clone().addScaledVector(axis,distance);
 const desiredNormal=desiredMid.clone().sub(start).cross(desiredEnd.clone().sub(desiredMid)).normalize();
 const ra=idle.get(a).worldP,rb=idle.get(b).worldP,rc=idle.get(c).worldP;
 const referenceNormal=rb.clone().sub(ra).cross(rc.clone().sub(rb)).normalize();
 function frame(direction,normal){const x=direction.normalize(),y=normal.clone().normalize(),z=x.clone().cross(y).normalize();return q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));}
 worldQ(a,frame(desiredMid.clone().sub(start),desiredNormal).multiply(frame(rb.clone().sub(ra),referenceNormal).invert()).multiply(idle.get(a).worldQ));
 worldQ(b,frame(desiredEnd.clone().sub(desiredMid),desiredNormal).multiply(frame(rc.clone().sub(rb),referenceNormal).invert()).multiply(idle.get(b).worldQ));
 return Math.max(0,requested-l1-l2);
}
const idleRight=idle.get('R_Hand').worldP.toArray(),idleLeft=idle.get('L_Hand').worldP.toArray();
// Raw model +X is forward, +Z right. Values are authored in the original rig units.
const keys=[
 {t:0,hip:[0,0,0],yaw:0,chest:0,lean:0,right:idleRight,left:idleLeft,pivot:0},
 {t:.35,hip:[-.008,-.014,.010],yaw:-5,chest:-9,lean:-1,right:[-.060,.590,.240],left:[.032,.569,-.262],pivot:0},
 {t:.65,hip:[.014,-.016,-.007],yaw:6,chest:10,lean:4,right:[.1735,.635,.224],left:[.049,.603,-.263],pivot:3},
 {t:.78,hip:[.017,-.017,-.009],yaw:7,chest:10,lean:4,right:[.1725,.625,.228],left:[.041,.593,-.265],pivot:3.5},
 {t:1.2,hip:[0,0,0],yaw:0,chest:0,lean:0,right:idleRight,left:idleLeft,pivot:0}
];
function parameters(t){let i=keys.findIndex(k=>k.t>=t);if(i<=0)return keys[0];const a=keys[i-1],b=keys[i],x=(t-a.t)/(b.t-a.t),s=x*x*x*(10+x*(-15+6*x));const result={t};for(const k of Object.keys(a).filter(k=>k!=='t'))result[k]=Array.isArray(a[k])?a[k].map((v,j)=>THREE.MathUtils.lerp(v,b[k][j],s)):THREE.MathUtils.lerp(a[k],b[k],s);return result;}
let maxReach=0;
function pose(t){
 reset(target.scene,idle);const p=parameters(t),hip=idle.get('Hip').worldP.clone().add(v().fromArray(p.hip));node('Hip').position.copy(node('Hip').parent.worldToLocal(hip));target.scene.updateMatrixWorld(true);
 rotate('Hip',v().set(0,1,0),p.yaw);
 rotate('Waist',v().set(0,1,0),p.chest*.45);rotate('Spine01',v().set(0,1,0),p.chest*.55);rotate('Spine01',v().set(0,0,1),-p.lean);
 rotate('NeckTwist01',v().set(0,1,0),-(p.yaw+p.chest)*.45);
 for(const s of ['L','R']){
  const foot=idle.get(`${s}_Foot`),toe=idle.get(`${s}_ToeBase`),rotation=s==='R'?q().setFromAxisAngle(v().set(0,0,1),degrees(-p.pivot)):q();
  const ankle=foot.worldP.clone().sub(toe.worldP).applyQuaternion(rotation).add(toe.worldP);
  const plant=t<=.35?THREE.MathUtils.smoothstep(t,0,.35):t<=.78?1:1-THREE.MathUtils.smoothstep(t,.78,1.2);
  if(s==='L')ankle.y-=.0098*plant;
  maxReach=Math.max(maxReach,ik(`${s}_Thigh`,`${s}_Calf`,`${s}_Foot`,ankle,idle.get(`${s}_Calf`).worldP));
  worldQ(`${s}_Foot`,rotation.multiply(foot.worldQ));
 }
 const blend=Math.sin(Math.PI*t/1.2)**2;
 for(const s of ['L','R']){
  const shoulder=wp(`${s}_Upperarm`),refShoulder=idle.get(`${s}_Upperarm`).worldP,refHand=idle.get(`${s}_Hand`).worldP;
  const refAxis=refHand.clone().sub(refShoulder).normalize(),bend=idle.get(`${s}_Forearm`).worldP.clone().sub(refShoulder);bend.addScaledVector(refAxis,-bend.dot(refAxis)).normalize();
  const authored=v().set(-.8,-.22,s==='R'?.8:-.8).normalize();bend.lerp(authored,blend).normalize();
  const elbow=shoulder.clone().addScaledVector(bend,.3);
  maxReach=Math.max(maxReach,ik(`${s}_Upperarm`,`${s}_Forearm`,`${s}_Hand`,v().fromArray(s==='R'?p.right:p.left),elbow));
 }
 target.scene.updateMatrixWorld(true);skin(target.scene);
}
pose(0);
const identityErrors=bones.map(b=>({bone:b.name,rotation:maxAngle(b.quaternion,idle.get(b.name).quaternion),position:b.getWorldPosition(v()).distanceTo(idle.get(b.name).worldP)*scale}));
assert(Math.max(...identityErrors.map(x=>x.position))<1e-6);assert(Math.max(...identityErrors.map(x=>x.rotation))<1e-5);
const count=145,times=new Float32Array(count),rotations=new Map(bones.map(b=>[b.name,new Float32Array(count*4)])),hips=new Float32Array(count*3),frames=[];
// Choose a fixed pad before inspecting motion: 0.97m ahead, on the right strike line.
const pad={frontX:.97,centerY:2.45,centerZ:.70,width:.62,height:.52,depth:.20,scope:'stationary synthetic contact fixture, not damage authority'};
const handIndices=[];const index=body.geometry.attributes.skinIndex,weights=body.geometry.attributes.skinWeight;
for(let i=0;i<index.count;i++){let handWeight=0;for(let j=0;j<4;j++)if(bones[index.getComponent(i,j)]?.name==='R_Hand')handWeight+=weights.getComponent(i,j);if(handWeight>.45)handIndices.push(i);}
assert(handIndices.length>10);
let maxOffset=0;for(let i=0;i<count;i++){
 const time=i/120;times[i]=time;pose(time);
 for(const bone of bones){bone.quaternion.toArray(rotations.get(bone.name),i*4);if(bone.name!=='Hip')maxOffset=Math.max(maxOffset,bone.position.distanceTo(idle.get(bone.name).position));}
 node('Hip').position.toArray(hips,i*3);
 const box=meshGround(target.scene),hand=[];let maxForward=-Infinity,inPad=0;
 for(const id of handIndices){const point=body.getVertexPosition(id,v()).applyMatrix4(body.matrixWorld);point.y-=floor;point.multiplyScalar(scale);maxForward=Math.max(maxForward,point.x);if(Math.abs(point.y-pad.centerY)<=pad.height/2&&Math.abs(point.z-pad.centerZ)<=pad.width/2){inPad++;hand.push(point.x-pad.frontX);}}
 frames.push({time,...posture(),floor:(box.min.y-floor)*scale,maxForward,inPad,contactDepth:hand.length?Math.max(...hand):null,joints:Object.fromEntries(bones.map(b=>[b.name,b.getWorldPosition(v()).toArray()])),localQuaternions:Object.fromEntries(bones.map(b=>[b.name,b.quaternion.toArray()]))});
}
assert(maxOffset<1e-10);assert(maxReach*scale<.005,`Unreachable IK ${maxReach*scale}m`);
const tracks=[...rotations].map(([n,values])=>new THREE.QuaternionKeyframeTrack(`${n}.quaternion`,times,values));tracks.push(new THREE.VectorKeyframeTrack('Hip.position',times,hips));
assert(tracks.every(track=>[...track.times,...track.values].every(Number.isFinite)));
const clip=new THREE.AnimationClip('Attack',1.2,tracks),metadata={id:`brute-v5-${revision}`,method:'Authored Idle-relative posture and hand arc, articulated two-bone support, no source time mapping',duration:1.2,contactAt:null};
const bytes=appendClip(fs.readFileSync(original),clip,metadata);
function write(name,data){const file=`${out}/${name}`,bytes=Buffer.from(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data,null,2)+'\n');if(fs.existsSync(file)){assert.equal(hash(fs.readFileSync(file)),hash(bytes),`Preserve existing ${file}`);return;}fs.writeFileSync(file,bytes);}
write('brute.glb',bytes);
const poses=[];for(const t of [0,.2,.35,.5,.65,.78,1,1.2]){pose(t);const positions=[];for(let i=0;i<body.geometry.attributes.position.count;i++){const p=body.getVertexPosition(i,v()).applyMatrix4(body.matrixWorld);p.y-=floor;p.multiplyScalar(scale);positions.push(p.toArray());}poses.push({time:t,phase:t/1.2,positions});}
write('cpu-poses.json',{label:'CPU posed mesh, no textures, not native playback',indices:Array.from(body.geometry.index.array),poses,pad});
write('calibration.json',{original,originalHash:hash(fs.readFileSync(original)),reference,referenceHash:hash(fs.readFileSync(reference)),scale,rawFloor:floor,calibration,initial,identityErrors,first:frames[0],last:frames.at(-1)});
write('report.json',{metadata,sha256:hash(bytes),keys,pad,handIndices,scale,rawFloor:floor,maxReachMeters:maxReach*scale,maxBoneTranslationChange:maxOffset,structural:{originalBinaryPrefix:true,nodesBindsSkinMeshMaterialTexturesUnchanged:true,otherFourClipsUnchanged:true},floorRange:[Math.min(...frames.map(f=>f.floor)),Math.max(...frames.map(f=>f.floor))],frames});
console.log(JSON.stringify({out,sha256:hash(bytes),initial,maxReach:maxReach*scale,floorRange:[Math.min(...frames.map(f=>f.floor)),Math.max(...frames.map(f=>f.floor))],peakDepth:Math.max(...frames.map(f=>f.contactDepth??-99)),calibrationMax:Math.max(...identityErrors.map(x=>x.position))},null,2));
