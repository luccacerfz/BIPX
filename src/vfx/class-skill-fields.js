import { latticeGLSL } from './elemental-source-glsl.js';
import { createClassSkillBodies } from './class-skill-bodies.js';
import { createClassSkillVolumes } from './class-skill-volumes.js';
import { createGravityFieldPool } from './gravity-field-pool.js';

/** Authoritative status snapshots only. Source HandCast lattice + Linear inward
 * differential winding, adapted to bounded status/field instances. MIT retained.
 */
export function createClassSkillFields(THREE, scene, { onEnd, capacity = 256 } = {}) {
  const group = new THREE.Group(); group.name = 'ClassSkillStates'; scene.add(group);
  const gravity = createGravityFieldPool(THREE, group);
  const ice = createClassSkillBodies(THREE, group, capacity * 5, 'ClassSkillFreezeCrystals');
  const volumes = createClassSkillVolumes(THREE, group, capacity * 2 + 64);
  const motions = Array.from({length:64},()=>({kind:6,until:0,birth:0,radius:1,height:1.8,position:new THREE.Vector3(),direction:new THREE.Vector3()}));
  const icePoint = new THREE.Vector3(), iceAxis = new THREE.Vector3();
  const base = new THREE.PlaneGeometry(2, 2), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index; for (const [name, attr] of Object.entries(base.attributes)) geometry.setAttribute(name, attr);
  const arrays = { aOrigin: new Float32Array(capacity * 3), aState: new Float32Array(capacity * 4), aClock: new Float32Array(capacity * 4) };
  for (const [name, data] of Object.entries(arrays)) geometry.setAttribute(name, new THREE.InstancedBufferAttribute(data, name === 'aOrigin' ? 3 : 4).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({ name: 'ClassSkillStatusFields', transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;attribute vec3 aOrigin;attribute vec4 aState;attribute vec4 aClock;
      varying vec2 vLocal;varying vec4 vState;varying vec4 vClock;
      void main(){
        vLocal=position.xy;vState=aState;vClock=aClock;
        if(aState.w<.0001){gl_Position=vec4(2.,2.,2.,1.);return;}
        vec2 p=position.xy*aState.y;vec3 world=aOrigin+vec3(p.x,.055,p.y);
        vec4 view=viewMatrix*vec4(world,1.);
        if(aState.x>1.5&&aState.x<2.5){view=viewMatrix*vec4(aOrigin+vec3(0.,aState.z,0.),1.);view.xy+=p;}
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader: /* glsl */ `
      #define TAU 6.28318530718
      uniform float uTime;uniform float uMotion;
      varying vec2 vLocal;varying vec4 vState;varying vec4 vClock;
      float hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
      ${latticeGLSL}
      float ring(float r,float center,float width){float aa=max(fwidth(r),.003);return 1.-smoothstep(width,width+aa,abs(r-center));}
      void main(){
        float r=length(vLocal);if(r>1.||vState.w<=0.)discard;
        float remaining=clamp(vState.w/max(vClock.y,.001),0.,1.);
        float age=max(0.,uTime-vClock.x),motion=age*uMotion,angle=atan(vLocal.y,vLocal.x);
        float alpha=0.;vec3 color;
        if(vState.x<.5){
          float glyph=pow(max(cos(angle*8.),0.),22.)*ring(r,.77,.11);
          float progress=step(fract(angle/TAU+1.),remaining);
          alpha=ring(r,.90,.012)*(.2+.45*progress)+glyph*.4+ring(r,.64,.007)*.22;
          color=vec3(1.35,.64,.14); // lasting war-cry status, not another ice nova
        }else if(vState.x<1.5){
          float d=snowflakeSDF(vLocal*1.08,vClock.z),aa=max(fwidth(d),.008);
          alpha=(1.-smoothstep(-aa,aa,d))*.63+ring(r,.89,.012)*.25;
          color=vec3(.33,.83,1.1);
        }else if(vState.x<2.5){
          // Three stars remain above every truly stunned actor, including reduced motion.
          for(int i=0;i<3;i++){
            float a=float(i)*TAU/3.+motion*1.4;
            vec2 q=vLocal-vec2(cos(a)*.55,sin(a)*.22);
            float star=abs(q.x)+abs(q.y);alpha+=1.-smoothstep(.065,.18,star);
          }
          color=vec3(1.55,1.12,.3);
        }else{
          // Exact authoritative boundary; pooled Horizon owns the interior.
          alpha=ring(r,.995,.004)*.23;color=vec3(.40,.14,.65);
          // Capacity overflow still retains a centre/area cue; counted explicitly.
          if(vClock.w<.5)alpha+=ring(r,.12,.016)*.7;
        }
        alpha*=smoothstep(0.,.15,vState.w);if(alpha<.004)discard;
        gl_FragColor=vec4(color,min(alpha,.85));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'ClassSkillStatusFields'; mesh.frustumCulled = false; mesh.visible = false; group.add(mesh);
  const records = Array.from({ length: capacity }, () => ({ id: null, kind: 0, remaining: 0, duration: 1, radius: 1, height: 2.3, position: new THREE.Vector3(), birth: 0, seen: false, refreshed: false }));
  let time = 0, disposed = false, rejected = 0, dropped = 0, dirty = true, frozenCrystals=0, gravityDebris=0;
  const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && (p.y == null || Number.isFinite(p.y));
  function retire(record, feedback) { if (record.id !== null && feedback) onEnd?.(record); record.id = null; record.remaining = 0; dirty = true; }
  function apply(kind, item, remaining) {
    if (!valid(item.position) || !Number.isFinite(remaining) || remaining <= 0 || item.id == null) { rejected++; return; }
    const key = `${kind}:${String(item.id).slice(0,160)}`;
    let record = records.find(r => r.id === key);
    if (!record) {
      record = records.find(r => r.id === null);
      if (!record) { dropped++; return; }
      record.id = key; record.birth = time;
    }
    record.kind = kind; record.seen = true; record.refreshed = true; record.remaining = Math.min(remaining, 60);
    record.duration = Math.max(.1, Number.isFinite(item.duration) ? item.duration : record.remaining);
    record.radius = Math.min(18, Math.max(.15, Number.isFinite(item.radius) ? item.radius : kind === 0 ? 1.3 : kind === 2 ? .45 : kind === 3 ? 5 : .65));
    record.height = Number.isFinite(item.height) ? item.height : 2.4;
    record.position.set(item.position.x,item.position.y ?? 0,item.position.z); dirty = true;
  }
  function syncState({ buffs = [], statuses = [], fields = [] } = {}) {
    if (disposed) return;
    for (const record of records) record.seen = false;
    for (const item of buffs) apply(0,item,item.remaining);
    for (const item of statuses) {
      if (item.freezeRemaining > 0) apply(1,item,item.freezeRemaining);
      if (item.stunRemaining > 0) apply(2,{ ...item, radius: .46 },item.stunRemaining);
    }
    for (const item of fields) apply(3,item,item.remaining);
    for (const record of records) if (record.id !== null && !record.seen) retire(record,true);
  }
  function event(payload) {
    if(disposed)return false;
    const kind={buff:0,freeze:1,stun:2,gravity:3}[payload.status];
    if(kind===undefined)return false;
    const id=kind===1||kind===2?payload.targetId??payload.contactId:payload.castId;
    if(id==null)return false;
    if(payload.phase==='end'||!(payload.remaining>0)){
      const record=records.find(r=>r.id===`${kind}:${String(id).slice(0,160)}`);
      if(record)retire(record,true);return true;
    }
    const at=payload.target??payload.origin;
    if(!valid(at))return false;
    apply(kind,{id,position:{x:at.x,y:payload.groundY??0,z:at.z},remaining:payload.remaining,
      duration:payload.statusDuration??payload.duration,radius:kind===1?.65:kind===2?.46:kind===0?1.3:payload.radius,height:payload.height??2.4},payload.remaining);
    return true;
  }
  function update(dt, reduced, quality = 'high') {
    if (disposed) return;
    time += dt; const counts = [0,0,0,0]; let written = 0;
    ice.reset();volumes.begin();frozenCrystals=0;gravityDebris=0;
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (record.id !== null) {
        // A fresh snapshot already contains the simulation's elapsed step.
        if(!record.refreshed)record.remaining = Math.max(0, record.remaining - dt);
        record.refreshed=false;
        if (record.remaining <= 0) retire(record,true);
      }
      arrays.aState[i*4+3] = record.remaining;
      if (record.id === null) continue;
      written = i+1;counts[record.kind]++;
      arrays.aOrigin.set(record.position.toArray(),i*3);
      arrays.aState.set([record.kind,record.radius,record.height,record.remaining],i*4);
      arrays.aClock.set([record.birth,record.duration,i*2.713,0],i*4);
      if(record.kind!==2&&record.kind!==3)volumes.set(i*2,record.kind,record.position,record.radius,record.kind===3?Math.min(.92,record.radius*.20):record.height,record.birth,record.remaining,i*2.713);
      if(record.kind===1)for(let j=0,n=quality==='low'?1:quality==='medium'?2:3;j<n;j++){
        const a=j*Math.PI*2/3.+.3;
        icePoint.set(record.position.x+Math.cos(a)*record.radius*.67,record.position.y+record.height*(j===0?.42:j===1?.20:.60),record.position.z+Math.sin(a)*record.radius*.67);
        iceAxis.set(Math.cos(a)*.35,1,Math.sin(a)*.35);ice.set(i*5+j,icePoint,iceAxis,'glacial',{width:Math.min(.23,record.radius*.28),length:record.height*.32});frozenCrystals++;
      }
    }
    for(let i=0;i<motions.length;i++){
      const m=motions[i];if(m.until>time)volumes.set(capacity*2+i,m.kind,m.position,m.radius,m.height,m.birth,m.until-time,0,m.direction);
    }
    gravity.sync(records,quality,reduced);syncGravityFlags();gravityDebris=gravity.getStats().debris;
    material.uniforms.uTime.value=time;material.uniforms.uMotion.value=reduced?0:1;
    if (dirty || written) for (const key of Object.keys(arrays)) geometry.attributes[key].needsUpdate=true;
    dirty=false;geometry.instanceCount=written;mesh.visible=written>0;
    ice.update(time,true);
    volumes.update(time,reduced,quality);
    return counts;
  }
  function syncGravityFlags(){for(let i=0;i<records.length;i++)if(records[i].kind===3)arrays.aClock[i*4+3]=gravity.has(records[i].id)?1:0;geometry.attributes.aClock.needsUpdate=true;}
  function prepareSceneDepth(camera){const request=gravity.prepareSceneDepth(camera);syncGravityFlags();gravityDebris=gravity.getStats().debris;return request;}
  function setMotion(index,kind,position,direction,radius){const m=motions[index];if(!m||disposed)return;if(m.until<=time)m.birth=time;m.until=time+.20;m.kind=kind;m.position.copy(position);m.direction.copy(direction);m.radius=radius;m.height=1.8;}
  function endMotion(index){if(motions[index])motions[index].until=0;}
  function reset() { for (const record of records) retire(record,false);for(const m of motions)m.until=0;time=0;arrays.aState.fill(0);geometry.instanceCount=0;mesh.visible=false;ice.reset();volumes.reset();gravity.reset();frozenCrystals=0;gravityDebris=0; }
  function dispose(){if(disposed)return;reset();ice.dispose();volumes.dispose();gravity.dispose();group.removeFromParent();geometry.dispose();material.dispose();disposed=true;}
  function getStats(){const counts=[0,0,0,0];for(const r of records)if(r.id!==null)counts[r.kind]++;return {buffs:counts[0],frozen:counts[1],stunned:counts[2],fields:counts[3],capacity,rejected,dropped,drawCalls:(mesh.visible?1:0)+ice.getStats().drawCalls+volumes.getStats().drawCalls+gravity.getStats().drawCalls,freezeCrystals:frozenCrystals,gravityDebris,volumes:volumes.getStats(),gravity:gravity.getStats(),disposed};}
  return { getCompositionDescriptors:gravity.getCompositionDescriptors, syncState, event, update, reset, dispose, getShaderWarmupRoots:()=>[group], getStats, setMotion, endMotion, prepareSceneDepth, setSceneDepth:gravity.setSceneDepth };
}
