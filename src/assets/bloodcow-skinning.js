import * as THREE from '../../vendor/three/three.module.js';
const patchedMaterials=new WeakMap();
export function cloneSkinMaterial(source){
 const clone=source.clone(),p=patchedMaterials.get(source);
 clone.onBeforeCompile=p?.prior??source.onBeforeCompile;clone.customProgramCacheKey=p?.priorKey??source.customProgramCacheKey;return clone;
}
// Native Three LBS extended to three vec4 influence sets. No weight truncation.
export function installFullInfluences(mesh) {
 const a=mesh.geometry.attributes, sets=[[a.skinIndex,a.skinWeight]];
 for(let i=1;i<=2;i++) if(a['joints_'+i]&&a['weights_'+i])sets.push([a['joints_'+i],a['weights_'+i]]);
 if(sets.length===1)return;
 if(!mesh.geometry.userData.fullWeightsRestored){
  for(let v=0;v<a.skinWeight.count;v++){
   let extra=0;for(const [,w] of sets.slice(1))for(let k=0;k<4;k++)extra+=w.getComponent(v,k);
   // GLTFLoader normalized WEIGHTS_0 only. Restore its original share of the TOTAL.
   for(let k=0;k<4;k++)a.skinWeight.setComponent(v,k,a.skinWeight.getComponent(v,k)*(1-extra));
  }
  a.skinWeight.needsUpdate=true;mesh.geometry.userData.fullWeightsRestored=true;
 }
 const base=new THREE.Vector3(),tmp=new THREE.Vector3(),matrix=new THREE.Matrix4();
 mesh.applyBoneTransform=function(index,vector){
  base.copy(vector).applyMatrix4(this.bindMatrix);vector.set(0,0,0);
  for(const [indices,weights] of sets)for(let k=0;k<4;k++){
   const w=weights.getComponent(index,k);if(w===0)continue;
   const b=indices.getComponent(index,k);
   matrix.multiplyMatrices(this.skeleton.bones[b].matrixWorld,this.skeleton.boneInverses[b]);
   vector.addScaledVector(tmp.copy(base).applyMatrix4(matrix),w);
  }
  return vector.applyMatrix4(this.bindMatrixInverse);
 };
 const patch=(material)=>{
  const installed=patchedMaterials.get(material);
  if(installed){if(installed.sets!==sets.length)throw Error('Shared material has incompatible influence sets');return;}
  const prior=material.onBeforeCompile, priorKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
   prior.call(this,shader,renderer);
   let declarations='',matrices='',position='',normal='';
   for(let i=1;i<sets.length;i++){
    declarations+=`attribute vec4 joints_${i};\nattribute vec4 weights_${i};\n`;
    for(const c of ['x','y','z','w']){
     const n=`bcBone${i}${c}`;matrices+=`mat4 ${n}=getBoneMatrix(joints_${i}.${c});\n`;
     position+=`skinned += ${n} * skinVertex * weights_${i}.${c};\n`;
     normal+=`skinMatrix += weights_${i}.${c} * ${n};\n`;
    }
   }
   shader.vertexShader=shader.vertexShader.replace('#include <skinning_pars_vertex>',`#include <skinning_pars_vertex>\n#ifdef USE_SKINNING\n${declarations}#endif`)
    .replace('#include <skinbase_vertex>',`#include <skinbase_vertex>\n#ifdef USE_SKINNING\n${matrices}#endif`)
    .replace('#include <skinning_vertex>',THREE.ShaderChunk.skinning_vertex.replace('transformed =',position+'transformed ='))
    .replace('#include <skinnormal_vertex>',THREE.ShaderChunk.skinnormal_vertex.replace('skinMatrix = bindMatrixInverse',normal+'skinMatrix = bindMatrixInverse'));
  };
  material.customProgramCacheKey=function(){return priorKey.call(this)+'|bloodcow12:'+sets.length;};
  patchedMaterials.set(material,{prior,priorKey,sets:sets.length});material.userData.bloodcowFullSkin=true;material.needsUpdate=true;
 };
 for(const mat of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))patch(mat);
 const baseMaterial=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
 const props={};for(const name of ['map','alphaMap','alphaTest','displacementMap','displacementScale','displacementBias','side','wireframe'])if(baseMaterial[name]!==undefined)props[name]=baseMaterial[name];
 mesh.customDepthMaterial??=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,...props});
 const distanceProps={...props};delete distanceProps.wireframe;
 mesh.customDistanceMaterial??=new THREE.MeshDistanceMaterial(distanceProps);
 patch(mesh.customDepthMaterial);patch(mesh.customDistanceMaterial);
 mesh.userData.bloodcowInfluenceSets=sets.length;
}
