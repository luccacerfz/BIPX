/** Isolated candidate; no production imports. Original GLSL + MIT preserved beside this file. */
import {BILLBOARD_VERTEX,HORIZON_FRAGMENT,NEBULA_VERTEX,NEBULA_FRAGMENT} from './reference-shaders.js';

export function createGravityHorizonNebulaPrototype(THREE,scene){
  const group=new THREE.Group();group.name='IsolatedHorizonNebula';scene.add(group);
  const values=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,{value:v}]));
  const common={transparent:true,depthWrite:false,blending:THREE.NormalBlending,premultipliedAlpha:true,toneMapped:false};
  const horizonUniforms=values({uTime:0,uSize:3.1,uNudge:0,uHorizon:.8,uRingWidth:.052,uRingGlow:9,uBeam:.75,uBeamPhase:.5,uHalo:1.35,uHaloFalloff:2.4,uWind:2.4,uSpin:.3,uFilament:.7,uFilamentScale:2.2,uChurn:0,uSeed:7,uFade:1,uOpacity:1,uColorPhoton:new THREE.Color('#ffe9b8'),uColorHalo:new THREE.Color('#c98cff'),uColorCool:new THREE.Color('#3a1c72'),uGlobalGlow:1});
  const horizonMaterial=new THREE.ShaderMaterial({...common,depthTest:true,side:THREE.DoubleSide,uniforms:horizonUniforms,vertexShader:BILLBOARD_VERTEX,fragmentShader:HORIZON_FRAGMENT});
  const horizon=new THREE.Mesh(new THREE.PlaneGeometry(1,1),horizonMaterial);horizon.frustumCulled=false;horizon.renderOrder=20;group.add(horizon);
  const nebulaUniforms=values({uTime:0,uCentre:new THREE.Vector3(),uRadius:4.8,uHole:.8,uSteps:34,uDensity:2.4,uAbsorb:.5,uEmissive:1.8,uScale:.58,uDetail:2.3,uFilament:.62,uThreshold:.5,uCavity:.32,uEdge:.7,uFlatten:.22,uArms:3,uArmSharp:1.5,uArmWeight:.68,uWind:2.4,uTwist:1.6,uSpin:.2,uRise:.35,uSpikes:9,uSpikeSharp:9,uSpikeReach:.95,uSpikeGlow:.7,uHeatFalloff:2.1,uBeam:.3,uChurn:0,uDrain:0,uSeed:7,uFade:1,uOpacity:1,uColorEdge:new THREE.Color(.12,.018,.42),uColorBody:new THREE.Color(.48,.08,1.2),uColorHot:new THREE.Color(1,.58,.18),uColorCore:new THREE.Color(1,.96,.82),uResolution:new THREE.Vector2(1,1),uSceneDepth:null,uCameraNear:.1,uCameraFar:220,uGlobalGlow:1});
  const nebulaMaterial=new THREE.ShaderMaterial({...common,depthTest:false,side:THREE.BackSide,uniforms:nebulaUniforms,vertexShader:NEBULA_VERTEX,fragmentShader:NEBULA_FRAGMENT});
  const nebula=new THREE.Mesh(new THREE.IcosahedronGeometry(1,3),nebulaMaterial);nebula.frustumCulled=false;nebula.renderOrder=21;group.add(nebula);
  const debrisMaterial=new THREE.MeshBasicMaterial({color:0x6f468c,transparent:true,opacity:1,depthWrite:false,toneMapped:false});
  const debris=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.08,0),debrisMaterial,24);debris.frustumCulled=false;debris.renderOrder=22;group.add(debris);
  const sparkMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(2,1.05,2.8),transparent:true,opacity:.9,depthWrite:false,toneMapped:false});
  const sparks=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.022,0),sparkMaterial,64);sparks.frustumCulled=false;sparks.renderOrder=23;group.add(sparks);
  const edgeMaterial=new THREE.MeshBasicMaterial({color:0x9258ce,transparent:true,opacity:.23,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const boundary=new THREE.Mesh(new THREE.RingGeometry(.994,1,128),edgeMaterial);boundary.rotation.x=-Math.PI/2;boundary.position.y=.055;group.add(boundary);
  let time=0,remaining=0,duration=5,radius=5,reduced=false,quality='high',disposed=false,depthReady=false,growth=0,collapse=0;
  const dummy=new THREE.Object3D(),positions=[];
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function set(state){time=Math.max(0,state.duration-state.remaining);remaining=Math.max(0,state.remaining);duration=state.duration;radius=state.radius;reduced=!!state.reducedMotion;quality=state.quality||'high';group.position.copy(state.position);update(0);}
  function setSceneDepth({texture,width,height,near,far}){nebulaUniforms.uSceneDepth.value=texture;nebulaUniforms.uResolution.value.set(width,height);nebulaUniforms.uCameraNear.value=near;nebulaUniforms.uCameraFar.value=far;depthReady=!!texture;nebula.visible=depthReady;}
  function update(dt){if(disposed)return;dt=Math.max(0,dt);time+=dt;remaining=Math.max(0,remaining-dt);group.visible=remaining>0;
    growth=smooth(time/(reduced?.5:.42));collapse=smooth((.7-remaining)/.7);
    const envelope=growth*(1-collapse),shape=Math.max(.035,growth*(1-collapse*.9)),motionTime=reduced?0:time;
    const coreRadius=.82*Math.min(1,radius/5)*shape,centerHeight=.73;
    horizon.position.y=centerHeight;horizonUniforms.uTime.value=motionTime;horizonUniforms.uHorizon.value=coreRadius;
    horizonUniforms.uSize.value=Math.min(radius*.62,coreRadius*4.1);horizonUniforms.uNudge.value=coreRadius*.35;
    horizonUniforms.uFade.value=envelope;horizonUniforms.uOpacity.value=remaining<.1?remaining/.1:1;
    horizonUniforms.uBeamPhase.value=.5+motionTime*.25;horizonUniforms.uRingGlow.value=quality==='low'?8:9;
    nebula.position.y=centerHeight;nebula.scale.setScalar(radius*.96*1.17);
    nebulaUniforms.uCentre.value.copy(group.position).add(new THREE.Vector3(0,centerHeight,0));nebulaUniforms.uTime.value=motionTime;
    nebulaUniforms.uRadius.value=radius*.96*Math.max(.05,growth);nebulaUniforms.uHole.value=coreRadius;
    nebulaUniforms.uDrain.value=collapse;nebulaUniforms.uFade.value=envelope;
    nebulaUniforms.uSteps.value=quality==='low'?16:quality==='medium'?24:34;
    nebula.visible=depthReady;boundary.scale.setScalar(radius);edgeMaterial.opacity=.23*Math.min(1,time/.15,remaining/.2);
    debris.count=quality==='low'?8:quality==='medium'?14:24;sparks.count=quality==='low'?16:quality==='medium'?32:64;positions.length=0;
    function particles(mesh,isSpark){for(let i=0;i<mesh.count;i++){
      const phase=(i*.61803398875+motionTime*(isSpark?.36:.23))%1,r=.82+(radius*.91-.82)*(1-phase),angle=i*2.4+r*.97;
      dummy.position.set(Math.cos(angle)*r,.12+.74*phase+Math.sin(i*1.3)*.13,Math.sin(angle)*r);
      dummy.rotation.set(i+motionTime,i*2,phase*4);const fade=Math.min(1,phase*12,(1-phase)*12)*envelope;
      dummy.scale.set(isSpark?.65:1,isSpark?2.1:1,1).multiplyScalar(fade);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      if(!isSpark)positions.push({index:i,radius:r,phase,x:group.position.x+dummy.position.x,y:group.position.y+dummy.position.y,z:group.position.z+dummy.position.z});
    }mesh.instanceMatrix.needsUpdate=true;}
    particles(debris,false);particles(sparks,true);
  }
  function reset(){remaining=0;group.visible=false;}
  function dispose(){if(disposed)return;reset();group.removeFromParent();group.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});disposed=true;}
  return {group,set,setSceneDepth,update,reset,dispose,getStats:()=>({prototype:true,promoted:false,reference:'Horizon + AstralNebula original GLSL',radius,duration,remaining,time,reduced,quality,center:group.position.toArray(),growth,collapse,coreRadius:horizonUniforms.uHorizon.value,nebulaRadius:nebulaUniforms.uRadius.value,nebulaSteps:nebulaUniforms.uSteps.value,depthReady,depthEncoding:'RGBADepthPacking',drawCalls:group.visible?(depthReady?5:4):0,debris:positions.map(p=>({...p})),disposed})};
}
