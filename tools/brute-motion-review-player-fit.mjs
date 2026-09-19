// CPU fit diagnostic: immutable Brute07 and real hero meshes. No animation authoring.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,loadCPU,hash,v} from './brute-motion-review-v5-utils.mjs';
import {createHeroLocomotion} from '../src/assets/hero-locomotion.js';
const base='output/brute-motion-v5/player-fit-v1',manifest=JSON.parse(fs.readFileSync(`${base}/source-manifest.json`));
const src=f=>manifest.sources[f].snapshot;
const marker=19/30;
const out={scope:'CPU posed real meshes; no GPU, animation edits or authority',coordinates:'x=Brute right, y=up, forward=-z; Brute center(0,0,0); heroes on x=0,z=-distance, facing Brute',marker,distances:[1.82,1.89],heights:{brute:3.3,warrior:2.7,dwarf:2.55},brute:{},heroes:{},cases:[]};
function refresh(root){root.updateMatrixWorld(true);root.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});}
function meshes(root){const list=[];root.traverse(n=>{if(n.isMesh){const points=[];for(let i=0;i<n.geometry.attributes.position.count;i++)points.push(n.getVertexPosition(i,v()).applyMatrix4(n.matrixWorld));list.push({name:n.name,mesh:n,points,indices:n.geometry.index?Array.from(n.geometry.index.array):points.map((_,i)=>i)});}});return list;}
const plain=m=>({name:m.name,positions:m.points.map(p=>p.toArray()),indices:m.indices});
const bounds=points=>{const b=new THREE.Box3().setFromPoints(points);return {min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(v()).toArray()};};
const joint=(model,name)=>{let result;model.traverse(n=>{if(n.name.replace(/^mixamorig:?/,'').replace(/_\d+$/,'')===name)result=n.getWorldPosition(v());});assert(result,name);return result;};
const brute=await loadCPU(src('output/brute-motion-v5/candidate-07/brute.glb')),bruteRoot=new THREE.Group();bruteRoot.add(brute.scene);brute.scene.rotation.y=Math.PI/2;
const bm=new THREE.AnimationMixer(brute.scene);bm.clipAction(brute.animations[0]).play();bm.update(0);refresh(bruteRoot);
const bb=new THREE.Box3().setFromObject(brute.scene,true);bruteRoot.scale.setScalar(3.3/bb.getSize(v()).y);brute.scene.position.y=-bb.min.y;
const attack=bm.clipAction(brute.animations[3]).setLoop(THREE.LoopOnce,1);attack.clampWhenFinished=true;
const probes=JSON.parse(fs.readFileSync(src('assets/models/monsters/ground-probes.json'))).brute.vertexIndices;
let bruteMesh; brute.scene.traverse(n=>{if(n.isSkinnedMesh)bruteMesh=n;});
function seek(t){bm.stopAllAction();attack.reset().play();bm.setTime(t);refresh(bruteRoot);const inv=brute.scene.matrixWorld.clone().invert();let min=Infinity;for(const i of probes)min=Math.min(min,bruteMesh.getVertexPosition(i,v()).applyMatrix4(bruteMesh.matrixWorld).applyMatrix4(inv).y);brute.scene.position.y=-min;refresh(bruteRoot);return meshes(bruteRoot)[0];}
const skinIndex=bruteMesh.geometry.attributes.skinIndex,skinWeight=bruteMesh.geometry.attributes.skinWeight;
const regions={hand:[],forearm:[]};
for(let i=0;i<skinIndex.count;i++){let h=0,f=0;for(let j=0;j<4;j++){const n=bruteMesh.skeleton.bones[skinIndex.getComponent(i,j)].name,w=skinWeight.getComponent(i,j);if(n==='R_Hand')h+=w;if(/^R_Forearm/.test(n))f+=w;}if(h>.45)regions.hand.push(i);if(f>.45)regions.forearm.push(i);}
const poses=[];for(const t of [0,.35,.50,marker,.78,1.2]){const mesh=seek(t);poses.push({time:t,...plain(mesh)});}
const bMarker=seek(marker),qj=n=>brute.scene.getObjectByName(n).getWorldPosition(v());
out.brute={scale:bruteRoot.scale.x,heading:[0,0,-1],socket:qj('R_Hand').toArray(),shoulder:qj('R_Upperarm').toArray(),elbow:qj('R_Forearm').toArray(),limbLengths:{upper:qj('R_Upperarm').distanceTo(qj('R_Forearm')),forearm:qj('R_Forearm').distanceTo(qj('R_Hand'))},regions:Object.fromEntries(Object.entries(regions).map(([k,ids])=>[k,{count:ids.length,indices:ids,envelope:bounds(ids.map(i=>bMarker.points[i]))}])),trajectory:[]};
for(let f=0;f<=144;f++){const mesh=seek(f/120),hand=regions.hand.map(i=>mesh.points[i]);out.brute.trajectory.push({time:f/120,socket:qj('R_Hand').toArray(),hand:bounds(hand),forearm:bounds(regions.forearm.map(i=>mesh.points[i]))});}
seek(marker);
const velocity={};for(const name of ['R_Hand','vertex4337']){const samples=[];for(const t of [marker-1/240,marker+1/240]){const m=seek(t);samples.push(name==='R_Hand'?qj(name):m.points[4337]);}velocity[name]=samples[1].clone().sub(samples[0]).multiplyScalar(120).toArray();}seek(marker);out.brute.markerVelocity=velocity;
out.brute.socketAngleFromForwardDegrees=Math.atan2(out.brute.socket[0],-out.brute.socket[2])*180/Math.PI;

// Triangle BVH and exact feature distances, diagnostic only (never gameplay hit logic).
function triangles(mesh,ids){const selected=ids&&new Set(ids),list=[];for(let i=0;i<mesh.indices.length;i+=3){const ii=mesh.indices.slice(i,i+3);if(selected&&!ii.some(j=>selected.has(j)))continue;const p=ii.map(j=>mesh.points[j]),tri=new THREE.Triangle(...p);list.push({tri,points:p,indices:ii,index:i/3,box:new THREE.Box3().setFromPoints(p)});}return list;}
function tree(ts){const box=new THREE.Box3();ts.forEach(t=>box.union(t.box));if(ts.length<=8)return {box,ts,count:ts.length};const s=box.getSize(v()),axis=s.x>=s.y&&s.x>=s.z?'x':s.y>=s.z?'y':'z';ts.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const m=ts.length>>1;return {box,count:ts.length,left:tree(ts.slice(0,m)),right:tree(ts.slice(m))};}
function gap2(a,b){let d=0;for(const k of ['x','y','z'])d+=Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])**2;return d;}
function segment(a,b,c,d){const u=b.clone().sub(a),w=d.clone().sub(c),r=a.clone().sub(c),A=u.dot(u),E=w.dot(w),F=w.dot(r);let s=0,t=0;if(A<1e-15&&E<1e-15)return [a,c];if(A<1e-15)t=THREE.MathUtils.clamp(F/E,0,1);else{const C=u.dot(r);if(E<1e-15)s=THREE.MathUtils.clamp(-C/A,0,1);else{const B=u.dot(w),den=A*E-B*B;s=den>1e-15?THREE.MathUtils.clamp((B*F-C*E)/den,0,1):0;t=(B*s+F)/E;if(t<0){t=0;s=THREE.MathUtils.clamp(-C/A,0,1);}else if(t>1){t=1;s=THREE.MathUtils.clamp((B-C)/A,0,1);}}}return [a.clone().addScaledVector(u,s),c.clone().addScaledVector(w,t)];}
function triDistance(a,b,best){
 function accept(p,q){const d=p.distanceToSquared(q);if(d<best.d){best.d=d;best.a=p.clone();best.b=q.clone();best.ta=a.index;best.tb=b.index;}}
 for(const p of a.points)accept(p,b.tri.closestPointToPoint(p,v()));for(const p of b.points)accept(a.tri.closestPointToPoint(p,v()),p);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){const[p,q]=segment(a.points[i],a.points[(i+1)%3],b.points[j],b.points[(j+1)%3]);accept(p,q);}
 for(const [first,other,flip]of [[a,b,false],[b,a,true]])for(let i=0;i<3;i++){const p=first.points[i],delta=first.points[(i+1)%3].clone().sub(p),length=delta.length();if(length<1e-12)continue;const hit=new THREE.Ray(p,delta.divideScalar(length)).intersectTriangle(...other.points,false,v());if(hit&&hit.distanceTo(p)<=length+1e-10)accept(hit,hit);}
}
function nearest(A,B){const best={d:Infinity};function visit(a,b){if(gap2(a.box,b.box)>=best.d)return;if(a.ts&&b.ts){for(const ta of a.ts)for(const tb of b.ts)if(gap2(ta.box,tb.box)<best.d)triDistance(ta,tb,best);return;}const pairs=(!a.ts&&(b.ts||a.count>b.count))?[[a.left,b],[a.right,b]]:[[a,b.left],[a,b.right]];pairs.sort((x,y)=>gap2(x[0].box,x[1].box)-gap2(y[0].box,y[1].box));for(const [x,y]of pairs)visit(x,y);}visit(A,B);return {gap:Math.sqrt(best.d),brutePoint:best.a.toArray(),targetPoint:best.b.toArray(),bruteTriangle:best.ta,targetTriangle:best.tb};}
// Parallel planes1m apart and an edge piercing a face exercise the distance primitive.
const t0={tri:new THREE.Triangle(v().set(0,0,0),v().set(1,0,0),v().set(0,1,0)),index:0};t0.points=[t0.tri.a,t0.tri.b,t0.tri.c];
const t1={tri:new THREE.Triangle(v().set(0,0,1),v().set(1,0,1),v().set(0,1,1)),index:1};t1.points=[t1.tri.a,t1.tri.b,t1.tri.c];let test={d:Infinity};triDistance(t0,t1,test);assert.equal(test.d,1);
const t2={tri:new THREE.Triangle(v().set(.2,.2,-1),v().set(.2,.2,1),v().set(.6,.2,1)),index:2};t2.points=[t2.tri.a,t2.tri.b,t2.tri.c];test={d:Infinity};triDistance(t0,t2,test);assert(test.d<1e-12);
const regionTrees=Object.fromEntries(Object.entries(regions).map(([k,ids])=>[k,tree(triangles(bMarker,ids))]));
const geometry={scope:out.scope,brute:poses,heroes:{},marker,coordinateDescription:out.coordinates};
for(const [id,file,height,yaw]of [['warrior','assets/models/aldric-hero.glb',2.7,Math.PI],['dwarf','assets/models/dwarf-rifleman.glb',2.55,Math.PI-.0653]]){
 const g=await loadCPU(src(file)),parent=new THREE.Group(),root=new THREE.Group(),model=g.scene;parent.add(root);root.add(model);model.rotation.y=yaw;parent.rotation.y=Math.PI;
 const mixer=new THREE.AnimationMixer(model);mixer.clipAction(g.animations.find(c=>c.name==='Idle')).play();mixer.update(0);refresh(parent);
 const box=new THREE.Box3().setFromObject(model,true),h=box.getSize(v()).y;root.scale.setScalar(height/h);model.position.y-=box.min.y;refresh(parent);
 const motion=createHeroLocomotion({THREE,model,root,clips:g.animations,directional:[],stats:{},height,characterId:id}),state={velocity:{x:0,z:0},groundY:0};motion.prepare(0,state);motion.restore();mixer.update(0);motion.update(0,state,{dead:false});refresh(parent);
 const neutral=meshes(parent),body=neutral.find(m=>m.name===(id==='warrior'?'HeroBody':'DwarfBody'));
 const joints=Object.fromEntries(['Hips','Spine','Spine1','Spine2','Neck','Head','LeftArm','RightArm'].map(n=>[n,joint(model,n).toArray()]));
 out.heroes[id]={file,sha256:manifest.sources[file].sha256,callerHeight:height,scale:root.scale.x,localYaw:yaw,parentYaw:Math.PI,bodyBounds:bounds(body.points),allMeshBounds:bounds(neutral.flatMap(m=>m.points)),joints,pose:'Idle0 + actual createHeroLocomotion.update(0), speed0; no directional motion or skill',meshes:neutral.map(m=>({name:m.name,vertices:m.points.length,triangles:m.indices.length/3,bounds:bounds(m.points)}))};
 geometry.heroes[id]=neutral.map(plain);
 for(const distance of out.distances){
  parent.position.z=-distance;refresh(parent);const all=meshes(parent),cases={id,distance,center:[0,0,-distance],directionToBrute:[0,0,1],reachLegal:distance<1.9,collisionNonoverlap:distance>=1.82,regions:{}};
  for(const [name,T]of Object.entries(regionTrees)){cases.regions[name]={};for(const m of all){cases.regions[name][m.name]=nearest(T,tree(triangles(m)));}}
  const targetBody=all.find(m=>m.name===body.name);cases.centerlineSurface=[];
  const coreIds=[];for(let i=0;i<targetBody.mesh.geometry.attributes.skinIndex.count;i++){let w=0;for(let j=0;j<4;j++){const bi=targetBody.mesh.geometry.attributes.skinIndex.getComponent(i,j);if(/Spine|Neck/.test(targetBody.mesh.skeleton.bones[bi].name))w+=targetBody.mesh.geometry.attributes.skinWeight.getComponent(i,j);}if(w>.45)coreIds.push(i);}
  const fullTriangles=triangles(targetBody),coreTriangles=triangles(targetBody,coreIds);
  for(const y of [1.4,1.6,1.7,1.8,2.0,2.2,2.4]){const row={height:y};for(const [key,ts]of [['allBody',fullTriangles],['torso',coreTriangles],...all.filter(m=>m!==targetBody).map(m=>[m.name,triangles(m)])]){const ray=new THREE.Ray(v().set(0,y,0),v().set(0,0,-1));let hit=null;for(const t of ts){const p=ray.intersectTriangle(...t.points,false,v());if(p&&(!hit||p.length()<hit.length()))hit=p.clone();}row[key]=hit?.toArray()||null;}cases.centerlineSurface.push(row);}
  out.cases.push(cases);
 }
 motion.dispose();
}
fs.writeFileSync(`${base}/measurements.json`,JSON.stringify(out,null,2)+'\n');fs.writeFileSync(`${base}/geometry.json`,JSON.stringify(geometry));
for(const [f,r]of Object.entries(manifest.sources))assert.equal(hash(fs.readFileSync(r.snapshot)),r.sha256,f);
for(const [f,h]of Object.entries(manifest.frozenV5Files))assert.equal(hash(fs.readFileSync(f)),h,f);
console.log(JSON.stringify({brute:{...out.brute,trajectory:undefined,regions:Object.fromEntries(Object.entries(out.brute.regions).map(([k,r])=>[k,{...r,indices:undefined}]))},heroes:out.heroes,cases:out.cases},null,2));
