import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { getEnvironmentColliders, getEnvironmentLayout, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';
const out=path.resolve('output/qa/environment-20260918');fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const manifest=JSON.parse(fs.readFileSync('assets/environment/cemetery-v1/provenance.json'));
const checks=[];const check=(name,condition)=>{assert(condition,name);checks.push(name)};
const assets=[];
for(const a of manifest.assets){
 const file=`assets/environment/cemetery-v1/${a.id}.glb`, b=fs.readFileSync(file);
 check(`${a.id}: unchanged source`,a.sourceSha256Before===hash(a.source)&&a.sourceSha256After===hash(a.source));
 check(`${a.id}: output provenance`,a.sha256===hash(file)&&a.bytes===b.length);
 check(`${a.id}: binary GLB`,b.toString('utf8',0,4)==='glTF'&&b.readUInt32LE(4)===2&&b.readUInt32LE(8)===b.length);
 const gltf=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 check(`${a.id}: embedded textures`,gltf.images.length>0&&gltf.images.every(i=>Number.isInteger(i.bufferView)&&!i.uri));
 check(`${a.id}: bounded texture budget`,a.textures.every(t=>t.runtime[0]<=768&&t.runtime[1]<=768));
 check(`${a.id}: geometry budget`,a.runtimeTriangles<=4800);
 for(const m of gltf.meshes)for(const p of m.primitives){
  const acc=gltf.accessors[p.attributes.POSITION];
  check(`${a.id}: finite geometry bounds`,[...acc.min,...acc.max].every(Number.isFinite));
  check(`${a.id}: material present`,Number.isInteger(p.material)&&gltf.materials[p.material].pbrMetallicRoughness.baseColorTexture);
 }
 assets.push({id:a.id,bytes:a.bytes,triangles:a.runtimeTriangles,sha256:a.sha256});
}
const colliders=getEnvironmentColliders(), layout=getEnvironmentLayout();
check('Ground remains radius 55 at y=0',ENVIRONMENT_GROUND.radius===55&&ENVIRONMENT_GROUND.y===0);
check('Unique collider ids',new Set(colliders.map(c=>c.id)).size===colliders.length);
check('Finite collider coordinates',colliders.every(c=>[c.x,c.z,c.minY,c.maxY,c.shape==='circle'?c.radius:c.halfX,c.shape==='circle'?c.radius:c.halfZ,c.yaw??0].every(Number.isFinite)));
check('Valid heights and positive extents',colliders.every(c=>c.maxY>c.minY&&(c.radius??c.halfX)>0&&(c.radius??c.halfZ)>0));
const distanceToCollider=(x,z,c)=>{
 const dx=x-c.x,dz=z-c.z;
 if(c.shape==='circle')return Math.hypot(dx,dz)-c.radius;
 const co=Math.cos(c.yaw),si=Math.sin(c.yaw);
 return Math.hypot(Math.max(0,Math.abs(co*dx-si*dz)-c.halfX),Math.max(0,Math.abs(si*dx+co*dz)-c.halfZ));
};
check('Spawn/portal clear for radius4',colliders.every(c=>distanceToCollider(0,0,c)>4));
check('Every new solid has matching collider id',layout.props.filter(p=>p.solid).every(p=>colliders.some(c=>c.id===p.id)));
check('Decoration and portal remain nonblocking',layout.props.filter(p=>!p.solid).every(p=>!colliders.some(c=>c.id===p.id)));
const copy=getEnvironmentColliders();copy[0].x=Infinity;
check('Callers cannot mutate subsequent layouts',Number.isFinite(getEnvironmentColliders()[0].x));
check('New courts retain cardinal travel routes', [...layout.tombs,...layout.fences,...layout.props.filter(p=>p.solid)].every(p=>Math.abs(p.x)>4&&Math.abs(p.z)>3));
const result={passed:true,checks,assets,totalBytes:assets.reduce((s,a)=>s+a.bytes,0),colliders:colliders.length,ground:ENVIRONMENT_GROUND,sourceHashes:Object.fromEntries(['src/render/environment-layout.js','src/render/environment-library.js','src/render/asset-dressing.js','src/render/cemetery.js','src/render/atmosphere.js','tools/environment-export.py','tools/environment-cpu.mjs'].map(p=>[p,hash(p)])),scope:'CPU binary/source/layout validation; not visual acceptance or integrated collision gameplay.'};
fs.writeFileSync(path.join(out,'cpu.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:checks.length,colliders:colliders.length,totalBytes:result.totalBytes}));
