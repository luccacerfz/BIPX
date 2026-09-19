/** Bounded presentation surfaces: HandCast facet/crust language and Linear
 * inward winding, rebuilt as world-space volumes. MIT notices remain adjacent.
 * These surfaces never choose targets, change radii or move gameplay actors.
 */
export function createClassSkillVolumes(THREE, scene, capacity) {
  const base = new THREE.PlaneGeometry(1, 1, 24, 12);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  for (const [name, attr] of Object.entries(base.attributes)) geometry.setAttribute(name, attr);
  const arrays = { aOrigin: new Float32Array(capacity * 3), aShape: new Float32Array(capacity * 4), aClock: new Float32Array(capacity * 4) };
  for (const [name, data] of Object.entries(arrays)) geometry.setAttribute(name, new THREE.InstancedBufferAttribute(data, name === 'aOrigin' ? 3 : 4).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({ name: 'ClassSkillVolumes', transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 }, uDetail: { value: 1 } },
    vertexShader: /* glsl */ `
      #define TAU 6.28318530718
      attribute vec3 aOrigin;attribute vec4 aShape;attribute vec4 aClock;
      varying vec2 vUv;varying vec4 vShape;varying vec4 vClock;varying vec3 vWorld;
      void main(){
        vUv=uv;vShape=aShape;vClock=aClock;
        if(aClock.w<=0.){gl_Position=vec4(2.,2.,2.,1.);return;}
        float angle=uv.x*TAU,r=aShape.y,h=aShape.z;vec3 p;
        if(aShape.x<.5){
          r*=.56*(.84+.16*sin(uv.y*3.14159));
          p=vec3(cos(angle)*r,.16+uv.y*h*.91,sin(angle)*r);
        }else if(aShape.x<1.5){
          // Low-poly shell has broken, uneven shoulders instead of a solid ice statue.
          float shoulder=.76+.13*sin(angle*3.)+.11*cos(angle*5.);
          r*=.68+.16*sin(uv.y*3.14159);
          p=vec3(cos(angle)*r,.12+uv.y*h*.9*shoulder,sin(angle)*r);
        }else if(aShape.x<3.5){
          float radial=.06+.46*uv.y;
          p=vec3(cos(angle)*r*radial,.14+h*pow(1.-uv.y,1.8),sin(angle)*r*radial);
          p.y+=p.x*.16; // Low tilted funnel, entirely inside the authoritative ground area.
        }else if(aShape.x<4.5){
          float latitude=uv.y*3.14159;
          p=vec3(cos(angle)*sin(latitude)*r,.52+cos(latitude)*r,sin(angle)*sin(latitude)*r);
        }else if(aShape.x<6.5){
          angle=(uv.x-.5)*2.35;
          p=vec3(sin(angle)*r,.22+uv.y*h,.16+cos(angle)*r*.48);
        }else{
          angle=(uv.x-.5)*2.8;
          float blade=r*(.84+.16*uv.y);
          p=vec3(sin(angle)*blade,.06+sin(angle)*.22,cos(angle)*blade);
        }
        float c=cos(aShape.w),s=sin(aShape.w);
        p.xz=mat2(c,-s,s,c)*p.xz;vWorld=aOrigin+p;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
      }`,
    fragmentShader: /* glsl */ `
      #define TAU 6.28318530718
      uniform float uTime;uniform float uMotion;uniform float uDetail;
      varying vec2 vUv;varying vec4 vShape;varying vec4 vClock;varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float narrow(float x,float width){return 1.-smoothstep(width,width+max(fwidth(x),.008),abs(x));}
      void main(){
        float t=max(0.,uTime-vClock.x)*uMotion,angle=vUv.x*TAU,v=vUv.y;
        vec3 normal=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
        float rim=pow(1.-abs(dot(normal,normalize(cameraPosition-vWorld))),2.);
        float alpha=0.;vec3 color=vec3(1.);
        if(vShape.x<.5){
          float bands=pow(max(cos(angle*3.-v*7.+t*1.5),0.),25.);
          float shoulders=narrow(v-.65,.08)*pow(max(cos(angle*4.+.6),0.),10.);
          float motes=0.;
          for(int i=0;i<6;i++){
            float seed=float(i)*1.618+vClock.z;
            vec2 q=vec2(fract(seed*.37),.15+.7*fract(seed*.23+t*.14));
            vec2 d=abs(vUv-q);d.x=min(d.x,1.-d.x);
            motes+=(1.-smoothstep(.012,.033,length(d*vec2(2.,1.))));
          }
          alpha=(bands*.46+shoulders*.62+motes*.8+rim*.10)*smoothstep(.02,.2,v)*(1.-smoothstep(.78,1.,v));
          color=mix(vec3(.85,.32,.035),vec3(1.75,1.0,.31),bands+shoulders);
        }else if(vShape.x<1.5){
          vec2 cell=floor(vUv*vec2(12.,7.));float shard=hash(cell+vClock.z);
          vec2 f=fract(vUv*vec2(12.,7.));
          float crack=max(narrow(f.x-.02,.022),narrow(f.y-f.x,.025));
          float coverage=step(.43,shard)*smoothstep(.02,.12,v)*(1.-smoothstep(.79,.98,v));
          // Partial translucent crust: facets cover the torso but keep the rig readable.
          alpha=coverage*(.20+rim*.16+crack*.15);
          float mist=pow(max(cos(angle*4.+v*11.+t*.3),0.),10.)*(1.-smoothstep(.1,.45,v));
          alpha+=mist*.075;color=mix(vec3(.055,.34,.57),vec3(.48,.85,1.04),shard*.65+crack*.3);
        }else if(vShape.x<3.5){
          float wound=angle*3.+v*17.+t*3.6;
          float filaments=pow(max(cos(wound),0.),22.);
          float converging=pow(max(cos(v*22.+t*4.),0.),30.);
          float veil=(.025+filaments*.29+converging*.07*uDetail)*smoothstep(0.,.12,v)*(1.-smoothstep(.78,1.,v));
          alpha=veil+rim*.04;color=mix(vec3(.15,.01,.35),vec3(.55,.08,1.15),filaments);
        }else if(vShape.x<4.5){
          color=mix(vec3(.014,.004,.028),vec3(.72,.09,1.3),rim);
          alpha=.82; // Small core only; its diameter never exceeds .76 metres.
        }else if(vShape.x<6.5){
          float edge=max(narrow(vUv.x-.035,.025),max(narrow(vUv.x-.965,.025),narrow(v-.94,.025)));
          float crest=narrow(abs(vUv.x-.5)-(.07+abs(v-.55)*.2),.016)*smoothstep(.17,.30,v)*(1.-smoothstep(.70,.82,v));
          float compressed=pow(max(cos(v*23.+t*8.),0.),35.)*.08;
          alpha=(edge*.65+crest*.60+rim*.12+compressed+.065)*smoothstep(0.,.10,v)*(1.-smoothstep(.97,1.,v));
          color=mix(vec3(.15,.46,.63),vec3(1.4,1.13,.53),max(crest,edge*.8));
        }else{
          alpha=pow(sin(vUv.x*3.14159),.6)*sin(v*3.14159)*.78;
          color=mix(vec3(.32,.62,.78),vec3(1.5,1.7,1.75),v);
        }
        alpha*=smoothstep(0.,.12,vClock.y);if(alpha<.004)discard;
        gl_FragColor=vec4(color,min(alpha,.85));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);mesh.name='ClassSkillVolumes';mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  let written=0,active=0,disposed=false;
  function begin(){arrays.aClock.fill(0);written=0;active=0;}
  function set(index,kind,at,radius,height,birth,remaining,seed=0,direction){
    if(disposed||index<0||index>=capacity||written>=capacity)return;
    // Stable caller slots do not imply sparse GPU instances: pack only visible surfaces.
    const slot=written++;
    arrays.aOrigin.set([at.x,at.y??0,at.z],slot*3);
    arrays.aShape.set([kind,radius,height,direction?Math.atan2(direction.x,direction.z):0],slot*4);
    arrays.aClock.set([birth,remaining,seed,1],slot*4);active++;
  }
  function update(time,reduced,quality){if(disposed)return;material.uniforms.uTime.value=time;material.uniforms.uMotion.value=reduced?0:1;material.uniforms.uDetail.value=quality==='low'?.5:quality==='medium'?.75:1;
    for(const name of Object.keys(arrays))geometry.attributes[name].needsUpdate=true;geometry.instanceCount=written;mesh.visible=active>0;
  }
  function reset(){begin();geometry.instanceCount=0;mesh.visible=false;}
  function dispose(){if(disposed)return;reset();mesh.removeFromParent();geometry.dispose();material.dispose();disposed=true;}
  return {begin,set,update,reset,dispose,getStats:()=>({active,capacity,drawCalls:mesh.visible?1:0,allocatedBytes:Object.values(arrays).reduce((n,a)=>n+a.byteLength,0),disposed})};
}
