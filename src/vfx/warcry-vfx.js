// Isolated art2. MIT sources copied under ../references: Linear NeonTrail,
// HandCast ChaosRibbon and Samurai BladeImpact. Presentation only.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const point=p=>p&&[p.x,p.y??0,p.z].every(Number.isFinite);
const validId=id=>(typeof id==='string'&&id.length>0&&id.length<=160)||(typeof id==='number'&&Number.isFinite(id));
export function createWarCryVfx({THREE,scene,quality='high',reducedMotion=false,capacity=32}){
 const group=new THREE.Group();group.name='WarCryArt1';group.userData.excludeFromSceneDepth=true;scene.add(group);
 const slots=capacity*32,base=new THREE.PlaneGeometry(1,1,32,1),geometry=new THREE.InstancedBufferGeometry();geometry.index=base.index;for(const [k,v]of Object.entries(base.attributes))geometry.setAttribute(k,v);
 const arrays={aRoot:new Float32Array(slots*3),aTip:new Float32Array(slots*3),aShape:new Float32Array(slots*4),aClock:new Float32Array(slots*4)};
 for(const [k,v]of Object.entries(arrays))geometry.setAttribute(k,new THREE.InstancedBufferAttribute(v,k==='aRoot'||k==='aTip'?3:4).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.ShaderMaterial({name:'WarCryAuthoredRibbons',transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
 uniforms:{uMotion:{value:1},uDepthReady:{value:0},uDepth:{value:null},uResolution:{value:new THREE.Vector2(1,1)},uNear:{value:.1},uFar:{value:220}},
 vertexShader:`
 #define TAU 6.28318530718
 attribute vec3 aRoot;attribute vec3 aTip;attribute vec4 aShape;attribute vec4 aClock;uniform float uMotion;
 varying vec2 vUv;varying vec4 vShape;varying vec4 vClock;varying float vDepth;
 float roll(float x){return fract(sin(x*12.9898)*43758.5453);}
 vec3 ribbon(float u){
  float kind=aShape.x,seed=aShape.y,age=aClock.x,phase=aClock.y;
  float turn=seed*2.39996+u*(2.1+roll(seed)*1.7)+age*.28*uMotion;
  float taper=sin(pow(clamp(u,0.,1.),.85)*3.14159);
  if(kind<.5){
   vec3 chest=aRoot+vec3(cos(seed*2.39996)*.43,1.90,sin(seed*2.39996)*.43);vec3 tip=mix(chest,aTip,step(2.5,seed));
   float gather=1.-.25*phase;
   vec3 start=aRoot+vec3(cos(turn)*.86*gather,.65+roll(seed)*.45,sin(turn)*.86*gather);
   vec3 p=mix(start,tip,u);
   p+=vec3(cos(turn),.16*sin(u*5.+seed),sin(turn))*.14*taper;return p;
  }
  if(kind<1.5){
   float side=mod(seed,2.)<.5?-1.:1.;
   // Open side ribbons; no glowing cylinder across the chest/face.
   float x=side*(.68+.32*taper),z=.20*sin(turn)+.13;
   return aRoot+vec3(x,.65+u*1.85,z)+vec3(.05*sin(u*9.+seed+age*.4*uMotion),0.,0.)*taper;
  }
  if(kind<2.5){
   float angle=(seed+u*.82)*TAU;
   float wave=min(1.,phase*1.7);float radial=min(aClock.w,aClock.w*(1.-pow(1.-wave,2.4)));
   return aRoot+vec3(cos(angle)*radial,.09+sin(u*3.14159)*.16*(1.-phase),sin(angle)*radial);
  }
  // Release plumes occupy gaps around the body; asymmetric shallow arcs.
  float angle=seed*2.39996+.55*sin(u*3.14159);
  float advance=smoothstep(0.,.24,age),radial=.48+u*(.65+1.25*advance);
  float lift=sin(u*3.14159)*(.82+.33*roll(seed))*(1.-phase*.35);
  return aRoot+vec3(cos(angle)*radial,.55+lift+u*.22,sin(angle)*radial);
 }
 void main(){
  vUv=uv;vShape=aShape;vClock=aClock;vec3 p;float kind=aShape.x;
  if(kind>1.5&&kind<2.5){
   // A low radial pressure sheet: real ground plane, not a camera-facing hoop.
   float phase=aClock.y,wave=min(1.,phase*1.7),radius=aClock.w*(1.-pow(1.-wave,2.4));
   float radial=clamp(radius+(uv.y-.5)*aShape.z,0.,aClock.w),angle=(aShape.y+uv.x*.82)*TAU;
   p=aRoot+vec3(cos(angle)*radial,.15+sin(uv.x*3.14159)*.09*(1.-phase),sin(angle)*radial);
  }else if(kind<3.5){
   float u=uv.x;vec3 p0=ribbon(u),p1=ribbon(min(.9999,u+.012));
   vec3 tangent=normalize(p1-p0+vec3(.00001));vec3 side=cross(tangent,normalize(cameraPosition-p0));if(dot(side,side)<.000001)side=vec3(1.,0.,0.);side=normalize(side);
   float taper=smoothstep(0.,.06,u)*(1.-smoothstep(.78,1.,u));
   p=p0+side*((uv.y-.5)*aShape.z*taper);
  }else{
   // Samurai's exact linear drag trajectory, adapted to restrained warm motes.
   float age=aClock.x,seed=aShape.y,drag=2.8,fall=-1.8;
   float f=(1.-exp(-drag*age))/drag,angle=seed*2.39996;
   vec3 velocity=vec3(cos(angle),1.5+roll(seed),sin(angle))*(kind>4.5?.26:1.15);
   p=aRoot+velocity*f+vec3(0.,fall*(age-f)/drag,0.);
   vec4 view=viewMatrix*vec4(p,1.);view.xy+=(uv-.5)*vec2(aShape.z,aShape.z*(kind>4.5?1.:2.5));
   vDepth=-view.z;gl_Position=projectionMatrix*view;return;
  }
  vec4 view=viewMatrix*vec4(p,1.);vDepth=-view.z;gl_Position=projectionMatrix*view;
 }`,
 fragmentShader:`
 #include <packing>
 uniform float uDepthReady;uniform sampler2D uDepth;uniform vec2 uResolution;uniform float uNear;uniform float uFar;
 varying vec2 vUv;varying vec4 vShape;varying vec4 vClock;varying float vDepth;
 float noise(vec2 p){return fract(sin(dot(floor(p),vec2(127.1,311.7)))*43758.5453);}
 void main(){
  float kind=vShape.x,across=1.-abs(vUv.y*2.-1.);float alpha;vec3 color;
  if(kind<3.5){
   float core=pow(max(across,0.),kind<.5?3.4:kind<1.5?6.:4.),body=pow(max(across,0.),1.8);
   float broken=mix(.52,1.,smoothstep(.1,.8,noise(vec2(vUv.x*36.+vShape.y*7.,vShape.y))));
   alpha=(body*.50+core*.44)*vShape.w*broken;
   color=mix(vec3(.92,.32,.055),vec3(3.8,1.8,.40),core*.75+vUv.x*.20);
   if(kind>.5&&kind<1.5)color*=.68;
   if(kind>1.5&&kind<2.5){alpha*=.72;color=mix(vec3(.48,.31,.14),vec3(1.55,.83,.24),core*.45);}
  }else{
   vec2 q=(vUv-.5)*2.;float d=length(q);alpha=(1.-smoothstep(.12,1.,d))*vShape.w;
   color=kind>4.5?vec3(.43,.30,.16):vec3(1.65,.83,.20);
  }
  if(uDepthReady>.5){float z=-perspectiveDepthToViewZ(unpackRGBAToDepth(texture2D(uDepth,gl_FragCoord.xy/uResolution)),uNear,uFar);alpha*=smoothstep(0.,.10,z-vDepth);}
  if(alpha<.004)discard;gl_FragColor=vec4(color,min(.68,alpha));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const mesh=new THREE.Mesh(geometry,material);mesh.name='WarCryArt1Surfaces';mesh.frustumCulled=false;mesh.visible=false;group.add(mesh);
 const records=Array.from({length:capacity},()=>({id:null,origin:new THREE.Vector3(),emitter:new THREE.Vector3(),releaseOrigin:new THREE.Vector3(),castAt:-1,releaseAt:-1,endAt:-1,remaining:0,duration:8,radius:3,windup:.38,seen:false,fresh:false}));
 let clock=0,disposed=false,written=0,dropped=0,rejected=0,duplicates=0,prepared=false,depthValid=false,near=.1,far=220;
 const matrix=new THREE.Matrix4(),frustum=new THREE.Frustum(),sphere=new THREE.Sphere(),temp=new THREE.Vector3();let visibleActors=0;
 function clear(r){r.id=null;r.castAt=r.releaseAt=r.endAt=-1;r.remaining=0;}
 function find(id,create=false){let r=records.find(r=>r.id===id);if(!r&&create){r=records.find(r=>r.id===null);if(r){clear(r);r.id=id;}else dropped++;}return r;}
 function locate(r,p){if(point(p))r.origin.set(p.x,p.y??0,p.z);}
 function finish(r){if(r.remaining>0){r.remaining=0;r.endAt=clock;}}
 function status(item){if(!validId(item.id)||!point(item.position)||!Number.isFinite(item.remaining)){rejected++;return false;}if(item.remaining<=0){const old=find(item.id);if(old)finish(old);return true;}const r=find(item.id,true);if(!r)return false;locate(r,item.position);r.remaining=Math.min(60,item.remaining);r.duration=Number.isFinite(item.duration)?Math.max(.01,item.duration):8;r.fresh=true;r.seen=true;r.endAt=-1;return true;}
 function emit(p={}){if(disposed||!p||p.skillId!=='warrior_war_cry'||!validId(p.castId)){rejected++;return false;}
  if(p.phase==='status')return status({id:p.castId,position:p.target??p.origin,remaining:p.remaining,duration:p.statusDuration??p.duration});
  const r=find(p.castId,p.phase==='cast'||p.phase==='release');if(!r)return false;
  if(p.phase==='end'){if(p.status==='buff')finish(r);else clear(r);return true;}
  if(!point(p.origin)){rejected++;return false;}locate(r,p.origin);if(point(p.emitter))r.emitter.set(p.emitter.x,p.emitter.y??0,p.emitter.z);else r.emitter.copy(r.origin).add(new THREE.Vector3(.5,1.4,0));
  if(p.phase==='cast'){if(r.castAt>=0){duplicates++;return false;}r.castAt=clock;r.windup=Math.max(.01,Number.isFinite(p.impactAt)?p.impactAt:.38);return true;}
  if(p.phase==='release'){if(r.releaseAt>=0){duplicates++;return false;}r.releaseAt=clock;r.releaseOrigin.copy(r.origin);r.radius=clamp(Number.isFinite(p.radius)?p.radius:3,.1,18);return true;}
  return false;
 }
 // Presentation-only: never creates a record or changes clocks/status/release origin.
 function updateCastTransform(id,transform={}){
  if(disposed||!validId(id)||!point(transform.origin)||(transform.emitter!=null&&!point(transform.emitter)))return false;
  const r=find(id);if(!r||r.castAt<0||r.releaseAt>=0||clock-r.castAt>r.windup+.2)return false;
  if(point(transform.emitter))r.emitter.set(transform.emitter.x,transform.emitter.y??0,transform.emitter.z);
  else r.emitter.add(temp.set(transform.origin.x,transform.origin.y??0,transform.origin.z).sub(r.origin));
  locate(r,transform.origin);return true;
 }
 function syncState(buffs=[]){if(disposed)return;for(const r of records)r.seen=false;for(const b of buffs)status(b);for(const r of records)if(r.remaining>0&&!r.seen)finish(r);}
 function write(r,kind,seed,width,opacity,age,progress,at=r.origin){if(written>=slots)return;const i=written++;arrays.aRoot.set(at.toArray(),i*3);arrays.aTip.set(r.emitter.toArray(),i*3);arrays.aShape.set([kind,seed,width,opacity],i*4);arrays.aClock.set([age,progress,r.remaining,r.radius],i*4);}
 function refresh(){written=0;
  for(const r of records){if(r.id===null)continue;const age=clock-r.castAt,post=r.releaseAt>=0?clock-r.releaseAt:-1;const strands=quality==='low'?2:quality==='medium'?3:4;
   if(r.castAt>=0&&r.releaseAt<0&&age<r.windup+.2){const p=clamp(age/r.windup),fade=Math.sin(Math.min(1,p)*Math.PI*.5);for(let i=0;i<strands;i++)write(r,0,i===strands-1?3:i,.30+.20*p,fade*.90,age,p);}
   if(post>=0&&post<.58){const p=clamp(post/.58),fade=Math.pow(1.-p,1.5);write(r,2,0,reducedMotion?.42:.72,fade,post,p,r.releaseOrigin);for(let i=0;i<(reducedMotion?2:4);i++)write(r,3,i,.30,fade*.90,post,p,r.releaseOrigin);
    if(!reducedMotion)for(let i=0;i<8;i++){temp.copy(r.releaseOrigin).add(new THREE.Vector3(Math.cos(i*2.4)*.45,1.0+((i*7)%5)*.13,Math.sin(i*2.4)*.45));write(r,4,i,.075,fade*.8,post,p,temp);}
    for(let i=0;i<(quality==='low'?4:8);i++){const a=i*Math.PI/4,wave=Math.min(1,p*1.7),front=r.radius*(1-Math.pow(1-wave,2.4));temp.copy(r.releaseOrigin).add(new THREE.Vector3(Math.cos(a)*front,.19+.10*Math.sin(p*Math.PI),Math.sin(a)*front));write(r,5,i,.50+.45*p,fade*.42,post,p,temp);}
   }
   if(r.remaining>0){const fade=clamp(r.remaining/.24);for(let i=0;i<2;i++)write(r,1,i,.17,fade*.72,clock,0);
    for(let i=0;i<(quality==='low'?2:4);i++){const t=reducedMotion?.5:((clock*.18+i*.29)%1);temp.copy(r.origin).add(new THREE.Vector3((i%2?1:-1)*.62,.65+t*1.35,.10));write(r,4,i,.043,fade*.36,0,0,temp);}
   }else if(r.endAt>=0&&clock-r.endAt<.24){const p=(clock-r.endAt)/.24;for(let i=0;i<2;i++){temp.copy(r.origin).add(new THREE.Vector3(i?.5:-.5,1.2-p*.30,.1));write(r,4,i,.06,(1.-p)*.5,0,p,temp);}}
   else if((r.releaseAt>=0&&post>.7)||(r.castAt>=0&&age>r.windup+.3)||r.endAt>=0)clear(r);
  }
  for(const a of Object.values(geometry.attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;geometry.instanceCount=written;mesh.visible=written>0;material.uniforms.uMotion.value=reducedMotion?0:1;
 }
 function update(dt){if(disposed)return;dt=clamp(Number.isFinite(dt)?dt:0,0,.15);clock+=dt;for(const r of records){if(r.remaining>0&&!r.fresh){r.remaining=Math.max(0,r.remaining-dt);if(r.remaining===0)r.endAt=clock;}r.fresh=false;}refresh();}
 function prepareSceneDepth(camera){setSceneDepth(null);prepared=false;visibleActors=0;if(disposed||!camera?.isPerspectiveCamera)return {required:false,visibleFields:0,excludeRoots:[group]};camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);near=camera.near;far=camera.far;prepared=true;
  if(mesh.visible)for(const r of records)if(r.id!==null){sphere.center.copy(r.origin).y+=1.3;sphere.radius=Math.max(1.6,r.releaseAt>=0&&clock-r.releaseAt<.58?r.radius:1.6);if(frustum.intersectsSphere(sphere))visibleActors++;}
  return {required:visibleActors>0,visibleFields:visibleActors,excludeRoots:[group]};}
 function setSceneDepth(frame){const v=frame?.viewport;depthValid=!!(prepared&&visibleActors&&frame?.texture?.isTexture&&frame.encoding==='rgba-packed'&&frame.near===near&&frame.far===far&&Number.isInteger(frame.width)&&frame.width>0&&Number.isInteger(frame.height)&&frame.height>0&&v&&[v.x,v.y,v.width,v.height].every(Number.isFinite)&&v.x>=0&&v.y>=0&&v.width>0&&v.height>0&&v.x+v.width<=frame.width&&v.y+v.height<=frame.height);material.uniforms.uDepthReady.value=depthValid?1:0;material.uniforms.uDepth.value=depthValid?frame.texture:null;if(depthValid){material.uniforms.uResolution.value.set(frame.width,frame.height);material.uniforms.uNear.value=near;material.uniforms.uFar.value=far;}return depthValid;}
 function reset(){records.forEach(clear);clock=0;prepared=false;visibleActors=0;setSceneDepth(null);refresh();}
 function dispose(){if(disposed)return;reset();geometry.dispose();material.dispose();group.removeFromParent();disposed=true;}
 return {emit,syncState,updateCastTransform,update,prepareSceneDepth,setSceneDepth,reset,dispose,setQuality(q){if(disposed)return;quality=['high','medium','low'].includes(q)?q:'medium';refresh();},setReducedMotion(v){if(disposed)return;reducedMotion=!!v;refresh();},getStats(){return {candidate:'warcry-art2',capacity,active:records.filter(r=>r.id!==null).length,buffs:records.filter(r=>r.remaining>0).length,instances:written,drawCalls:mesh.visible?1:0,allocatedBytes:Object.values(arrays).reduce((n,a)=>n+a.byteLength,0),clock,depthValid,visibleActors,dropped,rejected,duplicates,disposed,records:records.filter(r=>r.id!==null).map(r=>({id:r.id,remaining:r.remaining,castAt:r.castAt,releaseAt:r.releaseAt,releaseOrigin:r.releaseOrigin.toArray(),radius:r.radius,position:r.origin.toArray(),emitter:r.emitter.toArray()}))};}};
}
