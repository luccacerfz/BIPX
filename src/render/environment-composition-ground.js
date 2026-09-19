// Isolated surface-life candidate; shares existing maps, never adds collision.
export function applyCompositionGround(material, layout, { stoneColor } = {}) {
  const prior=material.onBeforeCompile, key=material.customProgramCacheKey();
  const zones=layout.grounds.flatMap((p,i)=>i!==1?[]:[`{
    vec2 q=(vCompositionWorld.xz-vec2(${p.x.toFixed(3)},${p.z.toFixed(3)}))/vec2(${p.rx.toFixed(3)},${p.rz.toFixed(3)});
    float edge=length(q)+(compositionNoise(vCompositionWorld.xz*1.1)-.5)*.18;
    float areaBlend=(1.-smoothstep(.64,1.14,edge))*.78;
    diffuseColor.rgb*=mix(vec3(1.),${['vec3(.55,.75,.39)','vec3(1.48,1.32,1.06)','vec3(1.42,.94,.49)'][i]},areaBlend);
  }`]).join('\n');
  material.onBeforeCompile=function(shader,renderer){
    prior.call(this,shader,renderer);
    shader.uniforms.uSurfaceStone={value:stoneColor};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCompositionWorld;').replace('#include <project_vertex>','#include <project_vertex>\nvCompositionWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vCompositionWorld;
      uniform sampler2D uSurfaceStone;
      float compositionHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float compositionNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(compositionHash(i),compositionHash(i+vec2(1,0)),f.x),mix(compositionHash(i+vec2(0,1)),compositionHash(i+vec2(1,1)),f.x),f.y);}
      float surfaceStrip(vec2 p,vec2 a,vec2 b,float width){vec2 d=b-a;float t=clamp(dot(p-a,d)/dot(d,d),0.,1.);return 1.-smoothstep(width*.35,width,length(p-a-t*d));}
    `).replace('#include <map_fragment>',`#include <map_fragment>
      float macro=compositionNoise(vCompositionWorld.xz*.19);
      float protectedCross=1.-smoothstep(2.6,4.,min(abs(vCompositionWorld.x),abs(vCompositionWorld.z)));
      float protectCenter=1.-smoothstep(4.,6.,length(vCompositionWorld.xz));
      diffuseColor.rgb*=mix(.72+macro*.42,1.,max(protectedCross,protectCenter));
      ${zones}
      vec2 surfaceP=vCompositionWorld.xz;
      float surfaceBroad=compositionNoise(surfaceP*.46+vec2(13.,-7.));
      float surfaceFine=compositionNoise(surfaceP*1.6);
      vec2 gardenP=(surfaceP-vec2(-13.4,-11.))/vec2(6.5,8.);
      vec2 workP=(surfaceP-vec2(19.3,12.8))/vec2(6.,5.8);
      float gardenEdge=length(gardenP)+(surfaceBroad-.5)*.29;
      float workEdge=length(workP)+(surfaceBroad-.5)*.34;
      float gardenMask=1.-smoothstep(.66,1.09,gardenEdge);
      float workMask=1.-smoothstep(.62,1.10,workEdge);
      float surfaceMask=max(gardenMask,workMask)*(1.-max(protectedCross,protectCenter));
      float gardenWear=surfaceStrip(surfaceP,vec2(-9.7,-7.2),vec2(-13.1,-13.8),1.12);
      float workWear=surfaceStrip(surfaceP,vec2(17.5,16.5),vec2(20.5,10.3),1.3);
      float surfaceWear=max(gardenWear*gardenMask,workWear*workMask);
      vec3 stoneGrain=texture2D(uSurfaceStone,surfaceP*.61).rgb;
      float terrainLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      vec3 loam=terrainLuma*vec3(1.62,1.02,.56)*(.83+surfaceFine*.32);
      vec3 drySoil=terrainLuma*vec3(2.1,1.38,.73)*(.83+surfaceFine*.32);
      vec3 moss=terrainLuma*vec3(.85,1.12,.51)*(.84+surfaceFine*.3);
      float mossIslands=smoothstep(.30,.72,surfaceBroad)*(1.-surfaceWear*.86);
      vec3 gardenSoil=mix(loam,moss,mossIslands*.82);
      vec3 workSoil=mix(drySoil,moss,mossIslands*.12);
      vec3 surfaceColor=mix(gardenSoil,workSoil,workMask);
      float stoneDetail=clamp(dot(stoneGrain,vec3(.2126,.7152,.0722))*3.,0.,.6);
      vec3 crushedStone=terrainLuma*vec3(1.85,1.52,1.03)*(.7+stoneDetail);
      surfaceColor=mix(surfaceColor,crushedStone,surfaceWear*(.35+surfaceFine*.25));
      diffuseColor.rgb=mix(diffuseColor.rgb,surfaceColor,surfaceMask*.91);
    `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.97,surfaceMask*(1.-surfaceWear*.3));
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      normal=normalize(mix(normal,nonPerturbedNormal,surfaceMask*.16));
    `);
  };
  material.customProgramCacheKey=()=>key+':surface-life-v1';
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
    const garden=Math.hypot((p.x+13.4)/6.5,(p.z+11)/8)<1.1,work=Math.hypot((p.x-19.3)/6,(p.z-12.8)/5.8)<1.1;
    const tint=work?[.046,.028,.012]:garden?[.028,.030,.014]:[.035,.027,.019];
    positions.push(p.x,.013,p.z);colors.push(...tint,work?.68:garden?.62:.50);
    for(let i=0;i<=16;i++){
      const a=i/16*Math.PI*2,variation=1+(garden||work ? .18 : .07)*Math.sin(i*2.31+p.x);
      const x=Math.cos(a)*p.rx*variation,z=Math.sin(a)*p.rz*variation;
      positions.push(p.x+c*x+s*z,.013,p.z-s*x+c*z);colors.push(...tint,0);
      if(i>0)indices.push(start,start+i,start+i+1);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const contacts=new THREE.Mesh(geometry,material);contacts.name='composition soil contacts — ground surface, not solid';contacts.renderOrder=1;group.add(contacts);
  group.userData.compositionContacts={patches:patches.length,triangles:indices.length/3,textures:0,draws:1,y:.013,physicalGroundY:0};
}
