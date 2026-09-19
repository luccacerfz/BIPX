// CPU roundtrip of exported files plus the actual runtime ground probes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {THREE,loadCPU,meshGround,skin,unpack,hash,v} from './brute-motion-review-v6-utils.mjs';
import {createRig,DURATION} from './brute-motion-review-v6-rig.mjs';
import {triangles,tree,nearest} from './brute-motion-review-v6-geometry.mjs';
const base='output/brute-motion-v6',revision=process.argv[2]||'candidate-06',out=`${base}/${revision}`;
const manifest=JSON.parse(fs.readFileSync(`${base}/source-manifest.json`)),fit=JSON.parse(fs.readFileSync(`${out}/fit.json`)),posed=JSON.parse(fs.readFileSync(`${out}/poses.json`));
const baseline=unpack(fs.readFileSync(manifest.sources['assets/models/monsters/brute.glb'].snapshot)),rig=await createRig();
const probes=JSON.parse(fs.readFileSync(manifest.sources['assets/models/monsters/ground-probes.json'].snapshot)).brute.vertexIndices;
const results=[];
for(const variant of fit.results){
 const file=`${out}/brute-${variant.id}.glb`,bytes=fs.readFileSync(file),packed=unpack(bytes);
 assert(packed.bin.subarray(0,baseline.bin.length).equals(baseline.bin));
 for(const k of ['nodes','skins','meshes','materials','images','textures','samplers'])assert.deepEqual(packed.json[k],baseline.json[k]);
 for(const i of [0,1,2,4])assert.deepEqual(packed.json.animations[i],baseline.json.animations[i]);
 const g=await loadCPU(file),mixer=new THREE.AnimationMixer(g.scene);mixer.clipAction(g.animations[0]).play();mixer.update(0);
 const box=meshGround(g.scene),scale=3.3/box.getSize(v()).y,floor=box.min.y,mesh=skin(g.scene);mixer.stopAllAction();const a=mixer.clipAction(g.animations[3]).setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;a.play();
 const targets=Object.fromEntries([1.82,1.89].map(d=>[d,posed.heroes[variant.id].map(o=>({name:o.name,tree:tree(triangles({...o,points:o.positions.map(p=>v().set(p[0],p[1],p[2]-d))}))}))]));
 let maxRoundtrip=0,maxGroundDelta=0;const frames=[];
 for(const t of [0,.18,.29,.40,.53,.60,.65,.675,.69,.70,.7041666667,.72,.82,1.05,1.18,1.30,DURATION]){
  mixer.setTime(t);g.scene.updateMatrixWorld(true);skin(g.scene);const authored=rig.record(t,variant);
  const raw=Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,v()).applyMatrix4(mesh.matrixWorld));
  const probeMin=Math.min(...probes.map(i=>raw[i].y)),delta=(floor-probeMin)*scale;maxGroundDelta=Math.max(maxGroundDelta,Math.abs(delta));
  const positions=raw.map(p=>v().set(p.z*scale,(p.y-floor)*scale,-p.x*scale));
  const error=Math.max(...positions.map((p,i)=>p.distanceTo(v().fromArray(authored.positions[i]))));maxRoundtrip=Math.max(maxRoundtrip,error);
  const grounded=positions.map(p=>p.clone().add(v().set(0,delta,0))),hand=tree(triangles({points:grounded,indices:rig.indices},rig.regions.hand)),contacts={};
  for(const [d,list]of Object.entries(targets))contacts[d]=list.map(o=>({mesh:o.name,...nearest(hand,o.tree)})).sort((a,b)=>a.gap-b.gap)[0];
  frames.push({time:t,roundtripMaxVertexError:error,runtimeGroundDelta:delta,contacts});
 }
 // Off-key interpolation approximates the continuous authoring curves at 240 Hz.
 // Stored contact key must remain much tighter than the 0.5 mm surface clearance.
 assert(maxRoundtrip<.002,`Interpolated roundtrip ${maxRoundtrip}`);
 assert(frames.find(f=>f.time===.70).roundtripMaxVertexError<.00001,'Contact key roundtrip');
 assert(maxGroundDelta<.001,`Ground drift ${maxGroundDelta}`);
 results.push({variant:variant.id,file,sha256:hash(bytes),clipDuration:g.animations[3].duration,unchangedBinaryPrefix:baseline.bin.length,rigSkinMeshMaterialsTextures:true,otherFourClips:true,maxRoundtripVertexError:maxRoundtrip,maxRuntimeGroundDelta:maxGroundDelta,frames});
}
const body=await loadCPU(manifest.sources['assets/models/dwarf-rifleman.glb'].snapshot),heroMesh=body.scene.getObjectByName('DwarfBody');
const triangle=fit.results.find(r=>r.id==='dwarf').first.targetTriangle,lyraWitness=[];
for(let j=0;j<3;j++){const i=heroMesh.geometry.index.array[triangle*3+j];lyraWitness.push({vertex:i,weights:Array.from({length:4},(_,k)=>({bone:heroMesh.skeleton.bones[heroMesh.geometry.attributes.skinIndex.getComponent(i,k)].name,weight:heroMesh.geometry.attributes.skinWeight.getComponent(i,k)}))});}
const report={scope:'CPU exported-GLB roundtrip and runtime-probe replay, not native rendering or multiplayer',results,lyraContactTriangle:triangle,lyraWitness};
fs.writeFileSync(`${out}/roundtrip.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(results.map(({frames,...r})=>r),null,2));
