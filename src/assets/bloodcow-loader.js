import {GLTFLoader} from './vendor/GLTFLoader.js';
import {installFullInfluences} from './bloodcow-skinning.js';
// cpuTextures=false is the real material path; CPU QA deliberately omits texture decoding.
export async function parseBloodCow(bytes,{cpuTextures=false,fullInfluences=true}={}){
 const header=new DataView(bytes);if(header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2||header.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid GLB');
 const loader=new GLTFLoader();if(cpuTextures)loader.register(()=>({name:'BLOODCOW_CPU_TEXTURES_OMITTED',loadTexture:()=>Promise.resolve(null)}));
 const gltf=await loader.parseAsync(bytes,'');
 gltf.scene.traverse(o=>{if(o.isSkinnedMesh&&fullInfluences)installFullInfluences(o);});
 return gltf;
}

export async function loadBloodCow(url,options={}){
 const response=await fetch(url);if(!response.ok)throw Error('BloodCow GLB request failed: '+response.status);
 const bytes=await response.arrayBuffer();return parseBloodCow(bytes,options);
}

function disposeGltf(gltf){
 if(!gltf?.scene)return;
 const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 gltf.scene.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);if(o.isSkinnedMesh)skeletons.add(o.skeleton);for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 for(const resource of [...geometries,...materials,...textures,...skeletons])resource.dispose?.();
}

export async function loadBloodCowAsset({modelUrl=new URL('../../assets/models/bloodcow/BloodCow_Runtime_v014_distribution.glb',import.meta.url),bindingUrl=new URL('../../assets/models/bloodcow/runtime-binding.json',import.meta.url),options={}}={}){
 const [modelResponse,bindingResponse]=await Promise.all([fetch(modelUrl),fetch(bindingUrl)]);
 if(!modelResponse.ok)throw Error(`BloodCow GLB request failed: ${modelResponse.status}`);
 if(!bindingResponse.ok)throw Error(`BloodCow binding request failed: ${bindingResponse.status}`);
 const [bytes,qa]=await Promise.all([modelResponse.arrayBuffer(),bindingResponse.json()]);
 let gltf=null;
 try{
  gltf=await parseBloodCow(bytes,options);
  const names=new Set(gltf.animations.map(clip=>clip.name));
  for(const name of ['Idle_v014_Corrected','Walk_v014_Corrected','Attack_v014_Corrected','Death_v014_Weighted'])if(!names.has(name))throw Error(`BloodCow missing required clip ${name}`);
  let mesh=null;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
  if(!mesh)throw Error('BloodCow GLB has no skinned render mesh');
  for(let set=1;set<=2;set++)if(!mesh.geometry.attributes[`joints_${set}`]||!mesh.geometry.attributes[`weights_${set}`])throw Error(`BloodCow is missing influence set ${set}`);
  const sourceIds=mesh.geometry.attributes._source_id;
  if(!sourceIds||sourceIds.count!==mesh.geometry.attributes.position.count)throw Error('BloodCow render-to-source map is missing');
  const seen=new Uint8Array(qa.vertexCount);
  for(let i=0;i<sourceIds.count;i++){const id=sourceIds.getX(i);if(id>=qa.vertexCount)throw Error(`BloodCow source vertex id ${id} exceeds the binding`);seen[id]=1;}
  if(seen.some(value=>value===0))throw Error('BloodCow render-to-source map does not cover every authored vertex');
  return {gltf,qa,modelUrl:String(modelUrl),bindingUrl:String(bindingUrl),influenceSets:3,
    renderVertexCount:mesh.geometry.attributes.position.count,dispose(){disposeGltf(gltf);}};
 }catch(error){disposeGltf(gltf);throw error;}
}
