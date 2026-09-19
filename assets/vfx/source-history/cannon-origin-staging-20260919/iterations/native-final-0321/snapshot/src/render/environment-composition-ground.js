// Isolated art candidate. No new textures, lights or collision volumes.
export function applyCompositionGround(material, layout) {
  const prior=material.onBeforeCompile, key=material.customProgramCacheKey();
  const zones=layout.grounds.map((p,i)=>`{
    vec2 q=(vCompositionWorld.xz-vec2(${p.x.toFixed(3)},${p.z.toFixed(3)}))/vec2(${p.rx.toFixed(3)},${p.rz.toFixed(3)});
    float edge=length(q)+(compositionNoise(vCompositionWorld.xz*1.1)-.5)*.18;
    float areaBlend=(1.-smoothstep(.64,1.14,edge))*.78;
    diffuseColor.rgb*=mix(vec3(1.),${['vec3(.55,.75,.39)','vec3(1.48,1.32,1.06)','vec3(1.42,.94,.49)'][i]},areaBlend);
  }`).join('\n');
  material.onBeforeCompile=function(shader,renderer){
    prior.call(this,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCompositionWorld;').replace('#include <project_vertex>','#include <project_vertex>\nvCompositionWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vCompositionWorld;
      float compositionHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float compositionNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(compositionHash(i),compositionHash(i+vec2(1,0)),f.x),mix(compositionHash(i+vec2(0,1)),compositionHash(i+vec2(1,1)),f.x),f.y);}
    `).replace('#include <map_fragment>',`#include <map_fragment>
      float macro=compositionNoise(vCompositionWorld.xz*.19);
      float protectedCross=1.-smoothstep(2.6,4.,min(abs(vCompositionWorld.x),abs(vCompositionWorld.z)));
      float protectCenter=1.-smoothstep(4.,6.,length(vCompositionWorld.xz));
      diffuseColor.rgb*=mix(.72+macro*.42,1.,max(protectedCross,protectCenter));
      ${zones}
    `);
  };
  material.customProgramCacheKey=()=>key+':composition-ground-v2';
  material.needsUpdate=true;
}

export function addCompositionContacts({THREE,group,layout}) {
  const positions=[],colors=[],indices=[];
  // Feathered, zero-volume soil contacts. The physical ground remains y=0.
  const patches=[...layout.tombs.map(p=>({x:p.x,z:p.z,rx:p.width*.83,rz:p.depth*.69,yaw:p.yaw})),
    ...layout.props.filter(p=>p.solid).map(p=>({x:p.x,z:p.z,rx:p.width*.7,rz:p.asset==='timber-beam'?p.width*.19:p.width*.56,yaw:p.yaw})),
    ...layout.trees.map(p=>({x:p.x,z:p.z,rx:p.height*.27,rz:p.height*.22,yaw:p.yaw}))];
  for(const p of patches){
    const start=positions.length/3,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
    positions.push(p.x,.013,p.z);colors.push(.035,.027,.019,.50);
    for(let i=0;i<=16;i++){
      const a=i/16*Math.PI*2,variation=1+.07*Math.sin(i*2.31+p.x);
      const x=Math.cos(a)*p.rx*variation,z=Math.sin(a)*p.rz*variation;
      positions.push(p.x+c*x+s*z,.013,p.z-s*x+c*z);colors.push(.035,.027,.019,0);
      if(i>0)indices.push(start,start+i,start+i+1);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const contacts=new THREE.Mesh(geometry,material);contacts.name='composition soil contacts — ground surface, not solid';contacts.renderOrder=1;group.add(contacts);
  group.userData.compositionContacts={patches:patches.length,triangles:indices.length/3,textures:0,draws:1,y:.013,physicalGroundY:0};
}
