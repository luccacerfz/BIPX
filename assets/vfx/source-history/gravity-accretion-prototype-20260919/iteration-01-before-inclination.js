/** ISOLATED ART PROTOTYPE. Not imported by runtime.
 * Linear SingularityMaterial: dark shadow / asymmetric photon edge / differential winding.
 * Rebuilt without refraction or screen warping; original MIT in src/vfx/ELEMENTAL-LICENSE.txt.
 */
export function createGravityAccretionPrototype(THREE, scene) {
  const group=new THREE.Group();group.name='GravityAccretionPrototype';scene.add(group);
  const uniforms={uTime:{value:0},uMotion:{value:1},uRadius:{value:5},uFade:{value:1}};
  const common={transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide};
  const coreMaterial=new THREE.ShaderMaterial({...common,uniforms,
    vertexShader:`varying vec3 vWorld;varying vec3 vNormal;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:`uniform float uFade;varying vec3 vWorld;varying vec3 vNormal;
      void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld))),4.);
      vec3 c=mix(vec3(.008,.002,.018),vec3(.98,.14,1.75),rim);gl_FragColor=vec4(c,.96*uFade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const core=new THREE.Mesh(new THREE.SphereGeometry(.46,32,20),coreMaterial);core.position.y=.58;group.add(core);
  const diskMaterial=new THREE.ShaderMaterial({...common,uniforms,
    vertexShader:`varying vec2 vLocal;void main(){vLocal=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uTime;uniform float uMotion;uniform float uFade;varying vec2 vLocal;
      void main(){float r=length(vLocal);float a=atan(vLocal.y,vLocal.x);float time=uTime*uMotion;
      float inward=pow(max(cos(a*3.+r*21.+time*3.1),0.),13.);
      float shear=pow(max(cos(a*8.-time*2.4/max(r,.4)+r*17.),0.),5.);
      float brightSide=.52+.48*cos(a-.7);
      float edge=exp(-abs(r-.56)*48.);float band=exp(-pow((r-.82)/.29,2.));
      float alpha=(edge*.92+band*(.10+inward*.44+shear*.16))*brightSide*smoothstep(1.5,1.10,r)*uFade;
      if(alpha<.005)discard;vec3 c=mix(vec3(.22,.015,.56),vec3(1.6,.46,2.1),edge+inward*.64);
      gl_FragColor=vec4(c,min(alpha,.82));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const disk=new THREE.Mesh(new THREE.RingGeometry(.49,1.48,96,8),diskMaterial);
  disk.rotation.set(-Math.PI/2+.42,.08,.22);disk.position.y=.62;group.add(disk);
  const ribbons=new THREE.InstancedBufferGeometry(),plane=new THREE.PlaneGeometry(1,1,64,1);
  ribbons.index=plane.index;for(const [key,attr]of Object.entries(plane.attributes))ribbons.setAttribute(key,attr);
  ribbons.setAttribute('aSeed',new THREE.InstancedBufferAttribute(new Float32Array([0,1.7,3.4,5.1,6.8,8.5]),1));ribbons.instanceCount=6;
  const ribbonMaterial=new THREE.ShaderMaterial({...common,uniforms,
    vertexShader:`uniform float uRadius;attribute float aSeed;varying vec2 vUv;varying float vSeed;
      vec3 curve(float u){float r=.55+(uRadius*.88-.55)*u;float a=aSeed+u*4.8;
      return vec3(cos(a)*r,.12+.72*pow(1.-u,1.3)+sin(a*1.8)*.08,sin(a)*r);}
      void main(){vUv=uv;vSeed=aSeed;vec3 p=curve(uv.x);vec3 tangent=normalize(curve(min(1.001,uv.x+.001))-p);
      vec3 world=(modelMatrix*vec4(p,1.)).xyz;vec3 side=normalize(cross(tangent,normalize(cameraPosition-world)));
      world+=side*(uv.y-.5)*.105;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader:`uniform float uTime;uniform float uMotion;uniform float uFade;varying vec2 vUv;varying float vSeed;
      void main(){float packet=pow(max(cos(vUv.x*23.+uTime*uMotion*4.6+vSeed),0.),20.);
      float width=pow(max(sin(vUv.y*3.14159),0.),1.5);
      float alpha=width*(.12+.62*packet)*smoothstep(0.,.06,vUv.x)*(1.-smoothstep(.78,1.,vUv.x))*uFade;
      if(alpha<.004)discard;gl_FragColor=vec4(mix(vec3(.32,.025,.67),vec3(.84,.19,1.6),packet),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const filament=new THREE.Mesh(ribbons,ribbonMaterial);filament.frustumCulled=false;group.add(filament);
  const edgeMaterial=new THREE.MeshBasicMaterial({...common,color:0x9258ce,opacity:.32});
  const boundary=new THREE.Mesh(new THREE.RingGeometry(.992,1,128),edgeMaterial);boundary.rotation.x=-Math.PI/2;boundary.position.y=.055;group.add(boundary);
  const debrisMaterial=new THREE.MeshBasicMaterial({color:0xa486c7,transparent:true,opacity:.85,depthWrite:false});
  const debris=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.075,0),debrisMaterial,12);debris.frustumCulled=false;group.add(debris);
  const dummy=new THREE.Object3D(),positions=[];
  let time=0,remaining=0,duration=5,radius=5,reduced=false,quality='high',disposed=false;
  function set(state){time=0;remaining=state.remaining;duration=state.duration;radius=state.radius;reduced=!!state.reducedMotion;quality=state.quality||'high';group.position.copy(state.position);group.visible=remaining>0;update(0);}
  function update(dt){if(disposed)return;time+=Math.max(0,dt);remaining=Math.max(0,remaining-dt);group.visible=remaining>0;
    uniforms.uTime.value=time;uniforms.uMotion.value=reduced?0:1;uniforms.uRadius.value=radius;uniforms.uFade.value=Math.min(1,remaining/.22);
    const scale=Math.min(1,radius/3);disk.scale.setScalar(scale);core.scale.setScalar(scale);boundary.scale.setScalar(radius);edgeMaterial.opacity=.32*uniforms.uFade.value;
    ribbons.instanceCount=quality==='low'?3:quality==='medium'?4:6;debris.count=quality==='low'?5:quality==='medium'?8:12;positions.length=0;
    for(let i=0;i<debris.count;i++){
      const phase=(i*.618+(reduced?0:time*.23))%1,r=.63+(radius*.84-.63)*(1-phase),a=i*2.4+r*.9;
      dummy.position.set(Math.cos(a)*r,.18+.72*phase,Math.sin(a)*r);dummy.rotation.set(i+(reduced?0:time),i*2,phase*4);
      dummy.scale.setScalar(Math.min(1,phase*15,(1-phase)*15));dummy.updateMatrix();debris.setMatrixAt(i,dummy.matrix);
      positions.push({index:i,radius:r,x:group.position.x+dummy.position.x,y:group.position.y+dummy.position.y,z:group.position.z+dummy.position.z,phase});
    }debris.instanceMatrix.needsUpdate=true;
  }
  function reset(){remaining=0;group.visible=false;}
  function dispose(){if(disposed)return;reset();group.removeFromParent();group.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});disposed=true;}
  return {group,set,update,reset,dispose,getStats:()=>({prototype:true,promoted:false,radius,duration,remaining,time,reduced,quality,center:group.position.toArray(),drawCalls:group.visible?5:0,filaments:ribbons.instanceCount,debris:positions.map(p=>({...p})),disposed})};
}
