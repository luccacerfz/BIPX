// Isolated ARPG adaptation of pinned HandCast/Linear FireAbility and VolumetricFireMaterial.
// Originals/MIT: assets/vfx/source-history/cannon-volumetric-staging-20260919/originals. No gameplay authority.
import {createCannonOriginBridge} from './cannon-origin-bridge.js';
import {FIRE_VERTEX,CANNON_FRAGMENT} from './cannon-source-glsl.js';
import {FIRE_DEFAULTS} from './cannon-defaults.js';
import {blackbodyGLSL} from './fire-blackbody.glsl.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const profile=(u,head,wake)=>(.34+.66*Math.pow(u,.55))*(1+wake*Math.pow(1-u,1.8))*(1+(head-1)*smooth((u-.62)/.38));

function createFireVolume(THREE,parent){
  const sections=34,vertices=sections*2;
  const geometry=new THREE.BufferGeometry();
  for(const [name,size]of [['position',3],['aCenter',3],['aTangent',3],['aDist',1],['aRandom',1]])geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(vertices*size),size).setUsage(THREE.DynamicDrawUsage));
  const indices=[];for(let i=0;i<sections-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}geometry.setIndex(indices);
  const uniforms=Object.fromEntries(Object.entries(FIRE_DEFAULTS).map(([k,v])=>[k,{value:Array.isArray(v)?new THREE.Color(...v):v}]));
  Object.assign(uniforms,{uTime:{value:0},uSceneDepth:{value:null},uResolution:{value:new THREE.Vector2(1,1)},uCameraNear:{value:.1},uCameraFar:{value:220},uShaderIntensity:{value:1},uGlobalGlow:{value:1},uInverseViewProjection:{value:new THREE.Matrix4()},uGroundY:{value:0},uBlastCenter:{value:new THREE.Vector3()},uBlastRadius:{value:3.4},uBlastMode:{value:0},uBlastAge:{value:0},uBlastMotion:{value:0}});
  const material=new THREE.ShaderMaterial({name:'CannonReferenceRaymarch',uniforms,vertexShader:FIRE_VERTEX,fragmentShader:CANNON_FRAGMENT,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.visible=false;mesh.renderOrder=12;parent.add(mesh);
  const points=Array.from({length:36},()=>new THREE.Vector3()),cumulative=new Float32Array(36),center=new THREE.Vector3(),tangent=new THREE.Vector3(),view=new THREE.Vector3(),side=new THREE.Vector3(),at=new THREE.Vector3(),up=new THREE.Vector3(),middle=new THREE.Vector3();
  let count=0,wanted=false;
  function set(path,options){
    count=Math.min(path.length,34);wanted=count>1&&options.opacity>.001;
    if(!wanted){mesh.visible=false;return;}
    for(const [key,value]of Object.entries(options))if(uniforms[key])uniforms[key].value=value;
    uniforms.uOpacity.value=options.opacity;
    for(let i=0;i<count;i++)points[i+1].copy(path[i]);
    const radius=uniforms.uRadius.value,head=uniforms.uHeadSize.value,wake=uniforms.uWakeSpread.value;
    // FireAbility's conservative padding/profile: the raymarch must fit inside its proxy.
    const reach=1.55*(1+uniforms.uBulge.value)*1.3;
    const tailPad=radius*profile(0,1,wake)*reach,headPad=radius*head*reach;
    tangent.copy(path[0]).sub(path[1]).normalize();points[0].copy(path[0]).addScaledVector(tangent,tailPad);
    tangent.copy(path[count-1]).sub(path[count-2]).normalize();points[count+1].copy(path[count-1]).addScaledVector(tangent,headPad);
    const rise=options.wakeRise??0;for(let i=0;i<=count;i++)points[i].y+=rise*Math.pow(1-clamp((i-1)/(count-1)),1.5);
    count+=2;cumulative[0]=0;for(let i=1;i<count;i++)cumulative[i]=cumulative[i-1]+points[i].distanceTo(points[i-1]);
    uniforms.uTailPad.value=tailPad;uniforms.uStreamLength.value=Math.max(.015,cumulative[count-1]-tailPad-headPad);uniforms.uArcLength.value=cumulative[count-1];
    center.copy(path[Math.floor((path.length-1)/2)]);
  }
  function prepare(camera,inverse){
    mesh.visible=false;if(!wanted)return false;
    uniforms.uInverseViewProjection.value.copy(inverse);
    const total=cumulative[count-1],u=uniforms,reach=1.55*(1+u.uBulge.value)*1.3;
    if(u.uBlastMode.value>.5){
      // Short expanding blasts need a full billboard bound. A ribbon's axial
      // caps can slice rising gas when the camera looks down the launch axis.
      middle.lerpVectors(points[1],points[count-2],.5);tangent.subVectors(points[count-2],points[1]).normalize();
      side.setFromMatrixColumn(camera.matrixWorld,0);up.setFromMatrixColumn(camera.matrixWorld,1);
      const cover=u.uRadius.value*u.uHeadSize.value*reach*Math.max(1,u.uPlume.value)*1.15;
      const distance=(u.uTailPad.value+u.uStreamLength.value*.5)/total;
      for(let i=0;i<4;i++){at.copy(middle).addScaledVector(side,(i%2?1:-1)*cover).addScaledVector(up,(i>1?1:-1)*cover);geometry.attributes.position.setXYZ(i,at.x,at.y,at.z);geometry.attributes.aCenter.setXYZ(i,middle.x,middle.y,middle.z);geometry.attributes.aTangent.setXYZ(i,tangent.x,tangent.y,tangent.z);geometry.attributes.aDist.setX(i,distance);geometry.attributes.aRandom.setX(i,.37);}
      geometry.setDrawRange(0,6);for(const a of Object.values(geometry.attributes))a.needsUpdate=true;return true;
    }
    geometry.setDrawRange(0,indices.length);
    for(let i=0;i<sections;i++){
      const t=i/(sections-1),distance=t*total;let j=0;while(j<count-2&&cumulative[j+1]<distance)j++;
      center.lerpVectors(points[j],points[j+1],clamp((distance-cumulative[j])/Math.max(.0001,cumulative[j+1]-cumulative[j])));
      tangent.copy(points[j+1]).sub(points[j]).normalize();view.copy(camera.position).sub(center).normalize();side.crossVectors(tangent,view);if(side.lengthSq()<1e-8)side.set(1,0,0);else side.normalize();
      const phase=clamp((distance-u.uTailPad.value)/u.uStreamLength.value);
      const halfWidth=u.uRadius.value*profile(phase,u.uHeadSize.value,u.uWakeSpread.value)*1.08*reach*Math.max(1,u.uPlume.value);
      for(let e=0;e<2;e++){const n=i*2+e;at.copy(center).addScaledVector(side,(e?1:-1)*halfWidth);geometry.attributes.position.setXYZ(n,at.x,at.y,at.z);geometry.attributes.aCenter.setXYZ(n,center.x,center.y,center.z);geometry.attributes.aTangent.setXYZ(n,tangent.x,tangent.y,tangent.z);geometry.attributes.aDist.setX(n,t);geometry.attributes.aRandom.setX(n,.37);}
    }
    for(const a of Object.values(geometry.attributes))a.needsUpdate=true;
    return true;
  }
  return {mesh,uniforms,set,prepare,clear(){wanted=false;mesh.visible=false;},depth(frame){mesh.visible=wanted&&!!frame;uniforms.uSceneDepth.value=frame?.texture??null;if(frame){uniforms.uResolution.value.set(frame.width,frame.height);uniforms.uCameraNear.value=frame.near;uniforms.uCameraFar.value=frame.far;}},dispose(){geometry.dispose();material.dispose();mesh.removeFromParent();},stats:()=>({wanted,visible:mesh.visible,radius:uniforms.uRadius.value,opacity:uniforms.uOpacity.value,steps:uniforms.uSteps.value,temperature:uniforms.uTempCore.value,time:uniforms.uTime.value,streamLength:uniforms.uStreamLength.value})};
}

/** Event-driven pooled presentation; body/volume belong here, never to the caller. */
export function createCannonVfx({THREE,scene,quality='high',reducedMotion=false,capacity=8,sweepVisual}){
  const group=new THREE.Group();group.name='CannonVolumetricPool';group.userData.excludeFromSceneDepth=true;scene.add(group);
  const sphere=new THREE.SphereGeometry(1,16,10),emberGeometry=new THREE.PlaneGeometry(1,1);
  const thermalMaterial=new THREE.ShaderMaterial({uniforms:{uKelvin:{value:3400},uOpacity:{value:1}},vertexShader:'varying vec3 vNormal;void main(){vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float uKelvin;uniform float uOpacity;varying vec3 vNormal;${blackbodyGLSL}void main(){float hot=.5+.5*abs(vNormal.z);vec3 c=thermal(mix(1400.,uKelvin,hot),3400.,2.6)*3.;gl_FragColor=vec4(c,uOpacity);}`,transparent:true,depthWrite:false,toneMapped:false});
  const emberMaterial=new THREE.ShaderMaterial({uniforms:{uDepthReady:{value:0},uSceneDepth:{value:null},uResolution:{value:new THREE.Vector2(1,1)},uInverseViewProjection:{value:new THREE.Matrix4()}},vertexShader:'attribute vec4 aData;varying vec2 vUv;varying vec4 vData;void main(){vUv=uv;vData=aData;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;varying vec4 vData;uniform float uDepthReady;uniform sampler2D uSceneDepth;uniform vec2 uResolution;uniform mat4 uInverseViewProjection;
    #include <packing>
    ${blackbodyGLSL}void main(){float d=length((vUv-.5)*2.);float a=(1.-smoothstep(.1,1.,d))*vData.y;if(a<.005)discard;float keep=1.;if(uDepthReady>.5){vec2 uv=gl_FragCoord.xy/uResolution;float packed=unpackRGBAToDepth(texture2D(uSceneDepth,uv));vec4 world=uInverseViewProjection*vec4(uv*2.-1.,packed*2.-1.,1.);if(packed<.99999)keep=1.-.999*smoothstep(.75,1.25,world.y/world.w-vData.z);}gl_FragColor=vec4(thermal(vData.x,3300.,2.6)*3.,a*keep);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide});
  const records=Array.from({length:capacity},(_,index)=>{
    const root=new THREE.Group();group.add(root);const flight=createFireVolume(THREE,root),muzzle=createFireVolume(THREE,root),blast=createFireVolume(THREE,root);
    const core=new THREE.Mesh(sphere,thermalMaterial);core.name='CannonThermalBody';core.renderOrder=14;root.add(core);
    const eg=emberGeometry.clone();eg.setAttribute('aData',new THREE.InstancedBufferAttribute(new Float32Array(80*4),4).setUsage(THREE.DynamicDrawUsage));const embers=new THREE.InstancedMesh(eg,emberMaterial,80);embers.frustumCulled=false;embers.renderOrder=15;root.add(embers);
    return {index,root,flight,muzzle,blast,core,embers,bridge:createCannonOriginBridge({THREE,sweepVisual}),authorityPosition:new THREE.Vector3(),id:null,points:Array.from({length:32},()=>new THREE.Vector3()),count:0,debt:0,pathDistance:0,position:new THREE.Vector3(),emitter:new THREE.Vector3(),direction:new THREE.Vector3(0,0,-1),hit:new THREE.Vector3(),castAt:0,releaseAt:-1,impactAt:-1,lastTravel:-1,terminalAt:-1,ended:false,groundY:0,radius:3.4,prepareDuration:.3,burstEnd:0};
  });
  const path=[new THREE.Vector3(),new THREE.Vector3()],trail=[],matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),frustum=new THREE.Frustum(),bound=new THREE.Sphere(),dummy=new THREE.Object3D(),offset=new THREE.Vector3();
  let clock=0,disposed=false,depthValid=false,prepared=false,cameraNear=.1,cameraFar=220,visible=0,rejected=0,duplicates=0,overwritten=0;
  const selected=new Set();
  function clear(r){r.bridge.reset();r.id=null;r.count=0;r.debt=0;r.pathDistance=0;r.root.visible=false;r.core.visible=false;r.embers.count=0;r.flight.clear();r.muzzle.clear();r.blast.clear();r.releaseAt=r.impactAt=r.lastTravel=r.terminalAt=-1;r.ended=false;}
  for(const r of records)clear(r);
  function record(id){let r=records.find(r=>r.id===id);if(r)return r;r=records.find(r=>r.id===null)??records.reduce((a,b)=>a.castAt<b.castAt?a:b);if(r.id!==null)overwritten++;clear(r);r.id=id;r.castAt=clock;r.root.visible=true;return r;}
  function emit(p={}){
    if(disposed||p.skillId!=='dwarf_explosive_cannon'||!((typeof p.castId==='string'&&p.castId.length>0)||(typeof p.castId==='number'&&Number.isFinite(p.castId)))||!['cast','release','travel','impact','end'].includes(p.phase)||(['cast','release','travel'].includes(p.phase)&&!valid(p.origin))||(['travel','impact'].includes(p.phase)&&!valid(p.target))){rejected++;return false;}
    const r=record(p.castId);r.groundY=Number.isFinite(p.groundY)?p.groundY:r.groundY;r.radius=Number.isFinite(p.radius)?clamp(p.radius,.1,18):3.4;
    if(valid(p.direction)&&new THREE.Vector3(p.direction.x,p.direction.y,p.direction.z).lengthSq()>1e-8)r.direction.copy(p.direction).normalize();
    if(p.phase==='cast'){r.emitter.copy(valid(p.emitter)?p.emitter:p.origin);r.position.copy(r.emitter);r.prepareDuration=Number.isFinite(p.impactAt)?Math.max(.01,p.impactAt):.3;r.bridge.prepare(p);}
    if(p.phase==='release'){if(r.releaseAt>=0){duplicates++;return false;}r.releaseAt=clock;r.emitter.copy(valid(p.emitter)?p.emitter:p.origin);r.position.copy(r.emitter);r.bridge.release(p);}
    if(p.phase==='travel'){
      if(r.terminalAt>=0||r.ended){duplicates++;return false;}
      r.authorityPosition.copy(p.target);const mapped=r.bridge.travel(p);if(mapped.resetTrail){r.count=0;r.debt=0;}
      p={...p,origin:mapped.origin,target:mapped.target};
      const span=offset.subVectors(p.target,p.origin).length();
      if(r.lastTravel>=0&&r.position.distanceTo(p.origin)>.15||span>8){r.count=0;r.debt=0;}
      if(!r.count)r.points[r.count++].copy(p.origin);
      if(span<=8){
        for(let d=.18-r.debt;d<=span+1e-8;d+=.18){if(r.count===32){for(let i=1;i<32;i++)r.points[i-1].copy(r.points[i]);r.count=31;}r.points[r.count++].copy(p.origin).addScaledVector(offset,clamp(d/Math.max(span,1e-8)));}
        const total=r.debt+span;r.debt=Math.max(0,total-Math.floor((total+1e-8)/.18)*.18);r.pathDistance+=span;
      }else{r.points[0].copy(p.target);r.count=1;}
      r.direction.copy(offset);if(r.direction.lengthSq()>1e-8)r.direction.normalize();else r.direction.set(0,0,-1);
      r.position.copy(p.target);r.lastTravel=clock;if(p.terminal)r.terminalAt=clock;
    }
    if(p.phase==='impact'){if(r.impactAt>=0){duplicates++;return false;}r.hit.copy(p.target);r.impactAt=clock;r.terminalAt=clock;r.burstEnd=clock+2.2;}
    if(p.phase==='end'){clear(r);return true;}
    refresh();return true;
  }
  function thermalOptions(r,options){return {uTime:reducedMotion?.37:clock*.85,uSteps:quality==='high'?32:quality==='medium'?24:16,uOctaves:quality==='high'?5:quality==='medium'?4:3,uGroundY:r.groundY,uBulge:.38,uBulgeScale:1.1,uNoiseFrequency:2.35,uNoiseStrength:.84,uWarp:.22,uVortex:1.05,uFlicker:reducedMotion?0:.18,uEmission:4.8,uSoot:1.7,uCoreClarity:.62,uTempCore:3400,uTempEdge:1250,uHeatFollow:.2,uTailFade:.035,uHeadFade:0,uTailHeat:.6,uPalette:0,uSeed:7.7+r.index*.91,...options};}
  function refresh(){
    for(const r of records){if(r.id===null)continue;
      if((r.impactAt>=0&&clock>r.burstEnd)||(r.impactAt<0&&(r.ended||r.lastTravel>=0&&clock-r.lastTravel>.55||r.releaseAt>=0&&r.lastTravel<0&&clock-r.releaseAt>.6||r.releaseAt<0&&clock-r.castAt>2))){clear(r);continue;}
      r.flight.clear();r.muzzle.clear();r.blast.clear();r.root.visible=true;r.core.visible=false;r.embers.count=0;
      const live=r.lastTravel>=0&&r.terminalAt<0&&clock-r.lastTravel<=.3;
      if(r.count>0&&(live||r.terminalAt>=0&&clock-r.terminalAt<.26)){
        trail.length=0;let length=0;for(let i=r.count-1;i>=0;i--){if(i<r.count-1)length+=r.points[i].distanceTo(r.points[i+1]);if(length>4.8)break;trail.unshift(r.points[i]);}
        if(trail.length&&trail[trail.length-1].distanceToSquared(r.position)>1e-10)trail.push(r.position);
        const fade=live?1:1-clamp((clock-r.terminalAt)/.26);
        r.flight.set(trail,thermalOptions(r,{uRadius:reducedMotion?.21:.28,uHeadSize:1.7,uPlume:1.6,uWakeSpread:1.5,uDetachment:.7,uNoiseFrequency:7.2,uNoiseStrength:1.3,uBulge:.55,uBulgeScale:3.,uShred:1.65,uWisp:.4,opacity:fade*(reducedMotion?.7:.9),wakeRise:reducedMotion?0:.22}));
      }
      if(live){r.core.visible=true;r.core.position.copy(r.position);r.core.scale.setScalar(.19);}
      const age=clock-r.castAt,releaseAge=r.releaseAt<0?-1:clock-r.releaseAt;
      if(r.releaseAt<0&&r.impactAt<0&&r.lastTravel<0&&!r.ended&&!r.bridge.launchBlocked){const heat=clamp(age/r.prepareDuration);path[0].copy(r.emitter).addScaledVector(r.direction,-.05);path[1].copy(r.emitter).addScaledVector(r.direction,.13);r.muzzle.set(path,thermalOptions(r,{uRadius:.07+.09*heat,uHeadSize:1.15,uPlume:1.5,uWakeSpread:.5,opacity:.45+.4*heat,uEmission:2.2+heat*1.4}));}
      else if(releaseAge>=0&&releaseAge<.3&&!r.ended&&!r.bridge.launchBlocked){const pulse=(1-smooth(releaseAge/.3));path[0].copy(r.emitter);path[1].copy(r.emitter).addScaledVector(r.direction,.25+1.1*smooth(releaseAge/.08));r.muzzle.set(path,thermalOptions(r,{uRadius:.2*pulse+.05,uHeadSize:1.2,uPlume:1.35,uWakeSpread:.6,opacity:pulse*(reducedMotion?.65:1),uEmission:reducedMotion?3.2:6.2}));}
      if(r.impactAt>=0){const a=clock-r.impactAt,growth=smooth(a/(reducedMotion?.22:.14)),cool=smooth((a-.17)/.65),rise=smooth((a-.14)/.85),fade=1-smooth((a-.35)/1.0),temperature=3500-cool*1850;
        path[0].copy(r.hit).addScaledVector(r.direction,-.28);path[1].copy(r.hit).addScaledVector(r.direction,.28);for(const p of path)p.y+=.10+rise*.85;
        r.blast.set(path,thermalOptions(r,{uRadius:(.18+1.12*growth)*(1-rise*.22),uHeadSize:1.15,uWakeSpread:.5,uPlume:1.25+rise*1.2,uBulge:.68,uBulgeScale:.9,uWisp:.5,uTempCore:temperature,uTempEdge:1150,uEmission:5.8*Math.pow(temperature/3500,2.6),uDensity:1.8*(1-cool*.65),uNoiseStrength:1.15+cool*.85,uDetachment:.25+cool*1.2,opacity:fade*(reducedMotion?.8:.95)*(1-cool*.3),uBlastMode:1,uBlastRadius:r.radius,uBlastAge:a,uBlastMotion:reducedMotion?.37:a}));
        r.blast.uniforms.uBlastCenter.value.copy(r.hit);
        const n=reducedMotion?12:quality==='low'?24:quality==='medium'?42:72;r.embers.count=a<2.2?n:0;
        for(let i=0;i<n;i++){const seed=(i*.61803398875)%1,angle=i*2.39996,life=.85+seed*1.3,t=reducedMotion?.2:a,progress=clamp(a/life),rad=Math.min(r.radius*.96,(.1+(2.8+seed*2)*t)/(1+t*.35));
          dummy.position.set(r.hit.x+Math.cos(angle)*rad,r.hit.y+.1+(1.1+seed*2)*t-(reducedMotion?0:.8*t*t),r.hit.z+Math.sin(angle)*rad);dummy.position.y=Math.max(r.groundY+.08,dummy.position.y);dummy.rotation.set(-Math.PI/2,0,angle);const size=(.035+seed*.07)*(1-progress*.5);dummy.scale.set(size,size*(1+seed),size);dummy.updateMatrix();r.embers.setMatrixAt(i,dummy.matrix);r.embers.geometry.attributes.aData.setXYZW(i,3000-progress*1700,(1-progress)*(reducedMotion?.5:1),r.groundY,0);}
        r.embers.instanceMatrix.needsUpdate=true;r.embers.geometry.attributes.aData.needsUpdate=true;
      }
      r.embers.visible=r.embers.count>0;
    }
  }
  function update(dt){if(disposed)return;dt=Number.isFinite(dt)?clamp(dt,0,.15):0;if(!dt)return;clock+=dt;refresh();}
  function prepareSceneDepth(camera){
    setSceneDepth(null);prepared=false;visible=0;selected.clear();if(disposed||!camera?.isPerspectiveCamera)return {required:false,visibleFields:0,excludeRoots:[group]};prepared=true;cameraNear=camera.near;cameraFar=camera.far;camera.updateMatrixWorld();matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);inverse.copy(matrix).invert();frustum.setFromProjectionMatrix(matrix);emberMaterial.uniforms.uInverseViewProjection.value.copy(inverse);
    let enabled=true;for(let o=group;o;o=o.parent)enabled&&=o.visible;
    for(const r of records){if(r.id===null)continue;bound.center.copy(r.impactAt>=0?r.hit:r.position);bound.radius=r.impactAt>=0?r.radius*2:7;r.root.visible=enabled&&frustum.intersectsSphere(bound);if(!r.root.visible)continue;let any=r.embers.visible&&r.embers.count>0;for(const v of [r.flight,r.muzzle,r.blast])if(v.prepare(camera,inverse)){selected.add(v);any=true;}if(any)visible++;}
    return {required:visible>0,visibleFields:visible,excludeRoots:[group]};
  }
  function setSceneDepth(frame){
    const v=frame?.viewport;
    depthValid=!!(!disposed&&prepared&&visible&&frame?.texture?.isTexture&&frame.encoding==='rgba-packed'&&Number.isInteger(frame.width)&&frame.width>0&&Number.isInteger(frame.height)&&frame.height>0&&frame.near===cameraNear&&frame.far===cameraFar&&v&&[v.x,v.y,v.width,v.height].every(Number.isFinite)&&v.x>=0&&v.y>=0&&v.width>0&&v.height>0&&v.x+v.width<=frame.width&&v.y+v.height<=frame.height);
    emberMaterial.uniforms.uDepthReady.value=depthValid?1:0;emberMaterial.uniforms.uSceneDepth.value=depthValid?frame.texture:null;if(depthValid)emberMaterial.uniforms.uResolution.value.set(frame.width,frame.height);
    for(const r of records)for(const volume of [r.flight,r.muzzle,r.blast])volume.depth(depthValid&&selected.has(volume)?frame:null);return depthValid;
  }
  function reset(){clock=0;for(const r of records)clear(r);selected.clear();visible=0;prepared=false;setSceneDepth(null);}
  function dispose(){if(disposed)return;reset();for(const r of records){for(const v of [r.flight,r.muzzle,r.blast])v.dispose();r.embers.geometry.dispose();r.embers.dispose();}sphere.dispose();emberGeometry.dispose();thermalMaterial.dispose();emberMaterial.dispose();group.removeFromParent();disposed=true;}
  function getStats(){return {source:'HandCast/Linear fire + Samurai thermal',time:clock,quality,reducedMotion,capacity,depthValid,visibleCasts:visible,disposed,rejected,duplicates,overwritten,drawCalls:records.reduce((n,r)=>n+(r.root.visible?(r.core.visible?1:0)+(r.embers.visible&&r.embers.count?1:0)+[r.flight,r.muzzle,r.blast].filter(v=>v.mesh.visible).length:0),0),casts:records.filter(r=>r.id!==null).map(r=>({id:r.id,phase:r.impactAt>=0?'impact':r.lastTravel>=0?'travel':r.releaseAt>=0?'release':'cast',radius:r.radius,position:r.position.toArray(),authorityPosition:r.authorityPosition.toArray(),originBridge:r.bridge.getStats(),hit:r.hit.toArray(),age:clock-r.castAt,impactAge:r.impactAt>=0?clock-r.impactAt:null,body:r.core.visible,flight:r.flight.stats(),muzzle:r.muzzle.stats(),blast:r.blast.stats(),embers:r.embers.count}))};}
  return {group,emit,update,prepareSceneDepth,setSceneDepth,reset,dispose,getStats,cancel(id){const r=records.find(r=>r.id===id);if(r)clear(r);},setQuality(q){quality=['high','medium','low'].includes(q)?q:'medium';refresh();},setReducedMotion(r){reducedMotion=!!r;refresh();}};
}
