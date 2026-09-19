import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const workspace='/Users/luccacerf/Projetos/Pessoal/Gaming/BIPX',output='/tmp/bipx-enemy-lods';
const{chromium}=createRequire(`${workspace}/package.json`)('playwright');
const browser=await chromium.launch({headless:true,channel:'chrome',args:['--disable-gpu']});
try{
 const page=await browser.newPage();await page.goto('http://localhost:5276/docs/orc-peon.md');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/vendor/three/three.module.js');
  const{loadEnemyLibrary}=await import('/src/assets/enemy-library.js');const{loadMonsterLibrary}=await import('/src/assets/monster-library.js');
  const orc=await loadEnemyLibrary({THREE}),monsters=await loadMonsterLibrary({THREE});const result={};
  for(const id of ['orcPeon','zombie','brute','lich']){
   const parent=new THREE.Group(),actor=(id==='orcPeon'?orc:monsters).create(id,{parent,height:1});actor.update(0,{speed:0});parent.updateMatrixWorld(true);
   const meshes=[];actor.root.traverse(o=>{
    if(!o.isMesh)return;if(o.isSkinnedMesh)o.skeleton.update();const pos=[],v=new THREE.Vector3();for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);pos.push(...v.toArray());}
    meshes.push({name:o.name,positions:pos,indices:o.geometry.index?Array.from(o.geometry.index.array):null,uv:o.geometry.attributes.uv?Array.from(o.geometry.attributes.uv.array):null,groups:o.geometry.groups,materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,color:m.color.toArray(),metalness:m.metalness,roughness:m.roughness,map:m.map?.name||null}))});
   });
   result[id]={id,stats:actor.stats,meshes};actor.dispose();
  }return result;
 });
 const sources={orcPeon:'assets/models/orc-peon.glb',zombie:'assets/models/monsters/zombie.glb',brute:'assets/models/monsters/brute.glb',lich:'assets/models/monsters/lich.glb'};
 for(const[id,data]of Object.entries(result)){data.source=`${workspace}/${sources[id]}`;data.sourceSha256=createHash('sha256').update(await fs.readFile(data.source)).digest('hex');await fs.writeFile(`${output}/posed/${id}.json`,JSON.stringify(data));console.log(JSON.stringify({id,sourceSha256:data.sourceSha256,meshes:data.meshes.map(m=>({name:m.name,vertices:m.positions.length/3,triangles:(m.indices?.length??m.positions.length/3)/3,materials:m.materials}))}));}
}finally{await browser.close()}
