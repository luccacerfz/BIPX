import {createGravityFieldVisual} from './gravity-field-visual.js';

/** Fixed allocation; authoritative records are borrowed for one update only.
 * Color/depth rendering belongs to Combat. No renderer, targets or timers here.
 */
export function createGravityFieldPool(THREE,scene,{capacity=8}={}){
  const group=new THREE.Group();group.name='GravityHorizonPool';group.userData.excludeFromSceneDepth=true;scene.add(group);
  const resources={horizon:new THREE.PlaneGeometry(1,1),nebula:new THREE.IcosahedronGeometry(1,3),debris:new THREE.DodecahedronGeometry(.08,0),sparks:new THREE.OctahedronGeometry(.022,0)};
  const slots=Array.from({length:capacity},()=>({id:null,generation:-1,record:null,visual:createGravityFieldVisual(THREE,group,resources)}));
  for(const slot of slots)slot.visual.reset();
  const frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),inverse=new THREE.Matrix4(),sphere=new THREE.Sphere(),world=new THREE.Vector3();
  const states=[],eligible=[],selectedIds=new Set(),distances=new WeakMap();
  let generation=0,disposed=false,reduced=false,quality='high',visibleFields=0,overflow=0,prepared=false,depthValid=false,near=0,far=0;
  function invalidate(){prepared=false;depthValid=false;for(const s of slots)s.visual.setSceneDepth(null);}
  function choose(items){
    selectedIds.clear();for(let i=0;i<Math.min(items.length,capacity);i++)selectedIds.add(items[i].id);
    for(const slot of slots)if(!selectedIds.has(slot.id)){slot.id=null;slot.generation=-1;slot.record=null;slot.visual.reset();}
    for(let i=0;i<Math.min(items.length,capacity);i++){
      const item=items[i],slot=slots.find(s=>s.id===item.id)||slots.find(s=>s.id===null);slot.id=item.id;
      if(slot.generation!==generation||slot.record!==item){slot.visual.set({position:item.position,radius:item.radius,remaining:item.remaining,duration:item.duration,quality,reducedMotion:reduced});slot.generation=generation;slot.record=item;}
      // Far fields submitted first; layer sequence stays together rather than all halos over all cores.
      slot.visual.setRenderOrder(20+(Math.min(items.length,capacity)-i)*4);
    }
    overflow=Math.max(0,items.length-capacity);
  }
  function sync(records,q='high',rm=false){if(disposed)return;generation++;quality=q;reduced=rm;invalidate();states.length=0;
    for(const r of records)if(r.id!==null&&r.kind===3&&r.remaining>0)states.push(r);
    visibleFields=0;choose(states);group.visible=states.length>0;
  }
  function prepareSceneDepth(camera){
    invalidate();eligible.length=0;visibleFields=0;
    if(disposed||!camera?.isPerspectiveCamera||!group.visible)return {required:false,visibleFields:0,excludeRoots:[group]};
    let parent=group.parent;while(parent){if(!parent.visible){choose([]);return {required:false,visibleFields:0,excludeRoots:[group]};}parent=parent.parent;}
    camera.updateMatrixWorld();group.updateWorldMatrix(true,false);matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(matrix);inverse.copy(matrix).invert();for(const s of slots)s.visual.setViewProjectionInverse(inverse);
    const scale=group.matrixWorld.getMaxScaleOnAxis();
    for(const state of states){sphere.center.copy(state.position).applyMatrix4(group.matrixWorld);sphere.center.y+=.73*scale;sphere.radius=state.radius*1.17*scale;
      if(frustum.intersectsSphere(sphere)){distances.set(state,camera.position.distanceToSquared(sphere.center));eligible.push(state);}}
    eligible.sort((a,b)=>distances.get(a)-distances.get(b));choose(eligible);visibleFields=Math.min(eligible.length,capacity);prepared=true;near=camera.near;far=camera.far;
    return {required:visibleFields>0,visibleFields,excludeRoots:[group]};
  }
  function setSceneDepth(frame){
    depthValid=false;for(const slot of slots)slot.visual.setSceneDepth(null);
    if(disposed||!prepared||!visibleFields||!frame)return false;
    const {texture,encoding,width,height,viewport}=frame;
    if(!texture?.isTexture||encoding!=='rgba-packed'||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||frame.near!==near||frame.far!==far||!viewport
      ||![viewport.x,viewport.y,viewport.width,viewport.height].every(Number.isFinite)||viewport.x<0||viewport.y<0||viewport.width<=0||viewport.height<=0||viewport.x+viewport.width>width||viewport.y+viewport.height>height)return false;
    for(const slot of slots)if(slot.id!==null)slot.visual.setSceneDepth(frame);depthValid=true;return true;
  }
  function has(id){return selectedIds.has(id);}
  function reset(){states.length=0;eligible.length=0;selectedIds.clear();visibleFields=0;overflow=0;group.visible=false;invalidate();for(const s of slots){s.id=null;s.visual.reset();}}
  function dispose(){if(disposed)return;reset();for(const s of slots)s.visual.dispose();for(const geometry of Object.values(resources))geometry.dispose();group.removeFromParent();disposed=true;}
  function getStats(){const active=slots.filter(s=>s.id!==null);return {capacity,allocatedSlots:slots.length,allocatedGeometries:4,trackedFields:states.length,visibleFields,activeSlots:active.length,overflow,prepared,depthValid,quality,reduced,drawCalls:active.reduce((n,s)=>n+s.visual.getStats().drawCalls,0),debris:active.reduce((n,s)=>n+s.visual.getStats().debris.length,0),disposed,fields:active.map(s=>({id:s.id,...s.visual.getStats()}))};}
  return {group,sync,prepareSceneDepth,setSceneDepth,has,reset,dispose,getStats};
}
