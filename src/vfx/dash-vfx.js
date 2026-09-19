// MIT source adaptations: Linear NeonTrail/PathTrail (taper, core/body ribbon),
// HandCast VoidSlashMaterials (lit hem), Samurai BladeImpact (directional drag).
// Exact originals, pins and licenses are in ../../vfx-dash-art-v1/originals and sources.json.
export function createDashVfx({THREE,scene,quality='medium',reducedMotion=false}) {
  const castCapacity=64,capacity=576,base=new THREE.PlaneGeometry(1,1,16,1);
  const geometry=new THREE.InstancedBufferGeometry();geometry.index=base.index;
  for(const [key,value] of Object.entries(base.attributes))geometry.setAttribute(key,value);
  const arrays={aFrom:new Float32Array(capacity*3),aTo:new Float32Array(capacity*3),aClock:new Float32Array(capacity*4),aStyle:new Float32Array(capacity*4)};
  for(const [key,array] of Object.entries(arrays))geometry.setAttribute(key,new THREE.InstancedBufferAttribute(array,key==='aFrom'||key==='aTo'?3:4).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({name:'DashSteelRibbonArt2',transparent:true,premultipliedAlpha:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTime:{value:0},uReduced:{value:reducedMotion?1:0}},
    vertexShader:/* glsl */`
      attribute vec3 aFrom;attribute vec3 aTo;attribute vec4 aClock;attribute vec4 aStyle;
      uniform float uTime;uniform float uReduced;
      varying vec2 vUv;varying vec4 vStyle;varying float vFade;
      void main(){
        float t=uv.x,v=uv.y*2.-1.,kind=aStyle.x;
        float birth=kind>1.5&&kind<2.5?mix(aClock.x,aClock.y,t):aClock.x;
        float age=max(0.,uTime-birth),life=aClock.z;
        vUv=vec2(t,v);vStyle=aStyle;vFade=life>0.?max(0.,1.-age/life):0.;
        if(vFade<=0.){gl_Position=vec4(2.,2.,2.,1.);return;}
        vec3 p,tangent;float width=aClock.w;
        if(kind<1.5){
          // A single authored blade arc at the supplied socket, not distance stamps.
          float theta=(t-.5)*2.05,r=aStyle.y;
          vec3 forward=normalize(aTo+vec3(0.,0.,.000001)),side=vec3(forward.z,0.,-forward.x);
          float sweep=kind<.5?.68:1.;
          p=aFrom+side*sin(theta)*r*sweep+forward*(cos(theta)-1.)*r*sweep;
          p.y+=sin(theta)*r*.18;
          tangent=side*cos(theta)-forward*sin(theta);tangent.y=cos(theta)*.18;
          width*=pow(max(sin(t*3.14159265),0.),.65);
        }else if(kind<2.5){
          // Both ends were observed. No extrapolation past contact or terminal.
          p=mix(aFrom,aTo,t);tangent=aTo-aFrom;
        }else{
          // Closed-form linear drag from Samurai BladeImpact, finite contact-only life.
          float k=5.,decay=exp(-k*age),flight=(1.-decay)/k;
          vec3 head=aFrom+aTo*flight+vec3(0.,-.5*age*age,0.);
          tangent=normalize(aTo+vec3(0.,.00001,0.));
          p=head-tangent*(1.-t)*(.22+.13*(1.-uReduced));
          width*=sin(t*3.14159265);
        }
        vec3 facing=cross(normalize(tangent+vec3(.000001)),normalize(cameraPosition-p));
        if(dot(facing,facing)<.00001)facing=vec3(0.,1.,0.);
        p+=normalize(facing)*v*width;
        gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
      }`,
    fragmentShader:/* glsl */`
      varying vec2 vUv;varying vec4 vStyle;varying float vFade;
      void main(){
        float av=abs(vUv.y),across=clamp(1.-av,0.,1.);
        // Linear core/body separation; HandCast lit hem retained without pulses.
        float body=pow(across,1.15),core=pow(across,6.);
        float hem=smoothstep(.70,.84,av)*(1.-smoothstep(.84,1.,av));
        float fibers=.95+.05*sin(vUv.x*43.+vUv.y*7.+vStyle.w);
        float fade=pow(vFade,.85);
        if(vStyle.x<.5){float age=1.-vFade;fade=(.38+.62*smoothstep(0.,.38,age))*(1.-smoothstep(.88,1.,age));}
        float cover=(body*.28+hem*.04)*fade;
        vec3 color=vec3(.10,.39,.57)*body*fade;
        color+=vec3(.80,1.38,1.70)*(core*1.5+hem*.55)*fade*fibers;
        if(vStyle.x>2.5){color=mix(vec3(.80,1.38,1.70),vec3(1.7,.95,.36),vStyle.w)*body*fade*1.2;cover=body*.18*fade;}
        if(vStyle.x<.5){color*=.78;cover*=.8;}
        if(vStyle.x>1.5&&vStyle.x<2.5){color*=.34*vFade;cover*=.55*vFade;}
        color*=vStyle.z;cover*=vStyle.z;
        if(max(color.r,max(color.g,color.b))<.004)discard;
        gl_FragColor=vec4(color,min(cover,.45));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='DashSteelRibbonArt2';mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  const owners=Array(capacity).fill(null),endTimes=new Float64Array(capacity);
  const records=Array.from({length:castCapacity},(_,index)=>({index,id:null,lastRoot:new THREE.Vector3(),lastEmitter:new THREE.Vector3(),lastAt:0,expiry:0,released:false,terminal:false,seen:false,pending:false,pendingSegment:-1,headSegment:-1,transformed:false}));
  let clock=0,cursor=castCapacity,disposed=false,segments=0,contacts=0,breaks=0,dropped=0,fallbacks=0,transformUpdates=0,lastCorrection=0;
  const point=new THREE.Vector3(),axis=new THREE.Vector3(),velocity=new THREE.Vector3();
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&(p.y==null||Number.isFinite(p.y));
  const copy=(to,p)=>to.set(p.x,p.y??.1,p.z);
  const distance=(a,b)=>Math.hypot(a.x-b.x,(a.y??.1)-(b.y??.1),a.z-b.z);
  function locate(p){if(valid(p.emitter))return copy(point,p.emitter);fallbacks++;copy(point,p.target??p.origin);point.y+=.95;return point;}
  function direction(p){axis.set(p.direction?.x??0,0,p.direction?.z??1);if(axis.lengthSq()<1e-9)axis.z=1;return axis.normalize();}
  function hide(i){endTimes[i]=0;arrays.aClock[i*4+2]=0;owners[i]=null;}
  function allocate(){const limit=quality==='low'?192:quality==='medium'?384:capacity;if(cursor>=limit)cursor=castCapacity;const i=cursor++;if(endTimes[i]>clock)dropped++;return i;}
  function write(i,id,kind,from,to,birth,lastBirth,life,width,radius=0,strength=1,seed=0){
    arrays.aFrom.set([from.x,from.y??.1,from.z],i*3);arrays.aTo.set([to.x,to.y??.1,to.z],i*3);
    arrays.aClock.set([birth,lastBirth,life,width],i*4);arrays.aStyle.set([kind,radius,strength,seed],i*4);
    owners[i]=id;endTimes[i]=Math.max(birth,lastBirth)+life;
  }
  function find(id,create){let r=records.find(r=>r.id===id);if(r||!create)return r;
    const count=quality==='low'?20:quality==='medium'?40:64;r=records.slice(0,count).find(r=>r.id===null||r.expiry<=clock);
    if(!r){dropped++;return null;}if(r.id!==null)cancel(r.id);
    Object.assign(r,{id,released:false,terminal:false,seen:false,pending:false,pendingSegment:-1,headSegment:-1,transformed:false,lastAt:clock,expiry:clock+1});return r;
  }
  function cancel(id){for(let i=0;i<capacity;i++)if(owners[i]===id)hide(i);const r=records.find(r=>r.id===id);if(r){r.id=null;r.expiry=0;r.pending=false;r.pendingSegment=-1;r.headSegment=-1;r.transformed=false;}}
  function emit(p={}){
    if(disposed||p.skillId!=='warrior_cleaving_dash'||p.castId==null)return false;
    const phase=p.phase,r=find(p.castId,['cast','release','travel','impact'].includes(phase));if(!r)return false;
    r.expiry=clock+1;
    if(phase==='end'){if(p.reason){cancel(r.id);return true;}if(!r.released)hide(r.index);r.terminal=true;return true;}
    if(phase==='impact'){
      if(!valid(p.target))return false;contacts++;direction(p);
      copy(point,p.target);point.y+=.65; // Visual contact streak above the same confirmed XZ; no hit/area change.
      for(let j=0,n=reducedMotion||quality==='low'?3:5;j<n;j++){
        const side=(j-(n-1)*.5)*.55,speed=reducedMotion?1.3:3.;
        velocity.set(axis.x*speed+axis.z*side,.4+j*.10,axis.z*speed-axis.x*side);
        write(allocate(),r.id,3,point,velocity,clock,clock,.22,j===0?.055:.037,0,j===0?1.25:1,j/(n-1));
      }return true;
    }
    if(!valid(p.origin)||(phase==='travel'&&!valid(p.target)))return false;
    if(phase==='cast'){
      r.pending=true;r.pendingSegment=-1;r.headSegment=-1;r.transformed=false;
      write(r.index,r.id,0,locate(p),direction(p),clock,clock,Math.max(.08,Math.min(.22,p.impactAt??.22)),.115,.62);
      return true;
    }
    if(phase==='release'){
      if(r.released)return false;r.released=true;r.pending=true;r.pendingSegment=-1;r.headSegment=-1;r.transformed=false;copy(r.lastEmitter,locate(p));copy(r.lastRoot,p.origin);r.lastAt=clock;r.seen=true;
      write(r.index,r.id,1,r.lastEmitter,direction(p),clock,clock,.13,reducedMotion?.145:.18,Math.min(.78,(p.radius??.85)*.9));return true;
    }
    if(phase!=='travel'||r.terminal)return false;
    r.pending=true;r.pendingSegment=-1;r.headSegment=-1;r.transformed=false;
    locate(p);const rootSpan=distance(p.origin,p.target);
    const continuous=rootSpan<=8&&(!r.seen||distance(r.lastRoot,p.origin)<=.12)&&(!r.seen||distance(r.lastEmitter,point)<=3.2)&&p.resetTrail!==true;
    // A remote event can arrive before its socket advances in the mixer.
    // Reserve an open segment for confirmed motion; the post-mixer hook fills
    // its endpoint without moving closed history or extending its lifetime.
    if(r.seen&&continuous&&(rootSpan>1e-6||distance(r.lastEmitter,point)>1e-6)){
      r.pendingSegment=allocate();r.headSegment=r.pendingSegment;write(r.pendingSegment,r.id,2,r.lastEmitter,point,r.lastAt,clock,reducedMotion?.12:.19,quality==='low'?.085:.10);segments++;
    }else if(r.seen&&!continuous)breaks++;
    copy(r.lastEmitter,point);copy(r.lastRoot,p.target);r.lastAt=clock;r.seen=true;
    if(p.terminal){write(r.index,r.id,1,point,direction(p),clock,clock,.09,reducedMotion?.13:.16,Math.min(.78,(p.radius??.85)*.9));r.terminal=true;}else write(r.index,r.id,1,point,direction(p),clock,clock,.10,reducedMotion?.145:.18,Math.min(.78,(p.radius??.85)*.9));
    return true;
  }
  function updateDashTransform(id,transform={}){
    const emitter=transform.emitter;
    if(disposed||!valid(emitter)||!Number.isFinite(emitter.y))return false;
    const r=records.find(r=>r.id===id);
    if(!r||r.expiry<=clock||owners[r.index]!==id||endTimes[r.index]<=clock)return false;
    // Keep the beginning/closed history fixed. The open endpoint and main arc
    // follow every drawn frame (also between packets), only within their old life.
    const offset=r.index*3;
    const changed=arrays.aFrom[offset]!==Math.fround(emitter.x)||arrays.aFrom[offset+1]!==Math.fround(emitter.y)||arrays.aFrom[offset+2]!==Math.fround(emitter.z);
    if(r.transformed&&!changed)return true;
    lastCorrection=distance({x:arrays.aFrom[offset],y:arrays.aFrom[offset+1],z:arrays.aFrom[offset+2]},emitter);
    arrays.aFrom.set([emitter.x,emitter.y,emitter.z],offset);
    let i=r.headSegment;
    if(i>=0&&distance(r.lastEmitter,emitter)>3.2){hide(i);r.headSegment=-1;r.pendingSegment=-1;i=-1;breaks++;}
    if(i>=0&&owners[i]===id&&arrays.aStyle[i*4]===2&&endTimes[i]>clock)arrays.aTo.set([emitter.x,emitter.y,emitter.z],i*3);
    copy(r.lastEmitter,emitter);if(!r.transformed||changed)transformUpdates++;r.transformed=true;
    geometry.attributes.aFrom.needsUpdate=true;geometry.attributes.aTo.needsUpdate=true;
    return true;
  }
  function update(dt){if(disposed)return;clock+=Math.max(0,Math.min(.15,Number.isFinite(dt)?dt:0));let highest=0;
    for(let i=0;i<capacity;i++){if(endTimes[i]<=clock)hide(i);else highest=i+1;}
    for(const r of records){r.pending=false;r.pendingSegment=-1;r.transformed=false;}
    for(const r of records)if(r.id!==null&&r.expiry<=clock){r.id=null;r.expiry=0;r.pending=false;r.pendingSegment=-1;r.headSegment=-1;r.transformed=false;}
    for(const a of Object.values(geometry.attributes))if(a.isInstancedBufferAttribute)a.needsUpdate=true;
    geometry.instanceCount=highest;mesh.visible=highest>0;material.uniforms.uTime.value=clock;material.uniforms.uReduced.value=reducedMotion?1:0;
  }
  function reset(){for(let i=0;i<capacity;i++)hide(i);for(const r of records){r.id=null;r.expiry=0;r.pending=false;r.pendingSegment=-1;r.headSegment=-1;r.transformed=false;}clock=0;cursor=castCapacity;geometry.instanceCount=0;mesh.visible=false;}
  function dispose(){if(disposed)return;reset();mesh.removeFromParent();geometry.dispose();material.dispose();disposed=true;}
  return {emit,update,updateDashTransform,cancel,reset,dispose,setQuality(v){quality=v;},setReducedMotion(v){reducedMotion=!!v;},getStats(){let active=0;const kinds=[0,0,0,0];for(let i=0;i<capacity;i++)if(endTimes[i]>clock){active++;kinds[arrays.aStyle[i*4]]++;}
    return {candidate:'dash-art2',clock,active,kinds,segments,contacts,breaks,dropped,fallbacks,transformUpdates,lastCorrection,capacity,drawCalls:mesh.visible?1:0,allocatedBytes:Object.values(arrays).reduce((n,a)=>n+a.byteLength,0),disposed,
      records:records.filter(r=>r.id!==null).map(r=>({id:r.id,released:r.released,terminal:r.terminal,preparing:!r.released&&!r.terminal&&endTimes[r.index]>clock,pending:r.pending,pendingSegment:r.pendingSegment,headSegment:r.headSegment,following:owners[r.index]===r.id&&endTimes[r.index]>clock,lastEmitter:r.lastEmitter.toArray(),lastRoot:r.lastRoot.toArray()}))};}};
}
