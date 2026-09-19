import { createElementalCrystalGeometry } from './elemental-geometry.js';

/** One fixed batch for the three actual projectile bodies. HandCast facet topology;
 * retained MIT notice in ELEMENTAL-LICENSE.txt. No predicted position or collision.
 */
export function createClassSkillBodies(THREE, scene, capacity = 64, name = 'ClassSkillProjectileBodies') {
  const base = createElementalCrystalGeometry(THREE), geometry = new THREE.InstancedBufferGeometry();
  for (const [key, value] of Object.entries(base.attributes)) geometry.setAttribute(key, value);
  const arrays = { aOrigin: new Float32Array(capacity * 3), aQuaternion: new Float32Array(capacity * 4), aStyle: new Float32Array(capacity * 4) };
  for (const [key, array] of Object.entries(arrays)) geometry.setAttribute(key, new THREE.InstancedBufferAttribute(array, key === 'aOrigin' ? 3 : 4).setUsage(THREE.DynamicDrawUsage));
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    name: 'ClassSkillBodies', transparent: true, depthTest: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uMotion: { value: 1 } },
    vertexShader: /* glsl */ `
      uniform float uTime;uniform float uMotion;
      attribute vec3 aOrigin; attribute vec4 aQuaternion; attribute vec4 aStyle; attribute vec3 aBary;
      varying vec3 vNormal; varying vec3 vBary; varying vec3 vLocal; varying float vKind;
      vec3 rotateQ(vec3 p,vec4 q){return p+2.*cross(q.xyz,cross(q.xyz,p)+q.w*p);}
      void main(){
        vKind=aStyle.x;vBary=aBary;vLocal=position;
        if(aStyle.w<.5){gl_Position=vec4(2.,2.,2.,1.);vNormal=vec3(0.,1.,0.);return;}
        vec3 scale=vec3(aStyle.z,aStyle.y,aStyle.y);
        vec3 p=(position-vec3(.5,0.,0.))*scale;
        if(aStyle.x<.5)p.yz*=.88+.12*sin(position.x*14.-uTime*12.*uMotion+position.y*3.);
        vec3 n=normal/scale;vNormal=rotateQ(normalize(n),aQuaternion);
        gl_Position=projectionMatrix*viewMatrix*vec4(aOrigin+rotateQ(p,aQuaternion),1.);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;uniform float uMotion;
      varying vec3 vNormal;varying vec3 vBary;varying vec3 vLocal;varying float vKind;
      void main(){
        float edge=min(min(vBary.x,vBary.y),vBary.z);edge=1.-smoothstep(0.,max(fwidth(edge),.001),edge);
        float facet=.45+.55*abs(dot(normalize(vNormal),normalize(vec3(-.4,.8,.5))));
        vec3 color;
        if(vKind<.5){
          float heat=.5+.5*sin(vLocal.x*18.-uTime*15.*uMotion+vLocal.y*6.);
          color=mix(vec3(1.2,.065,.006),vec3(2.2,.85,.13),heat)*(.75+facet*.3);
        }else if(vKind<1.5){
          color=mix(vec3(.045,.29,.52),vec3(.40,.83,1.05),facet)+edge*vec3(.22,.50,.6);
        }else{
          color=mix(vec3(.36,.025,.82),vec3(.92,.15,1.5),facet*.7)+edge*vec3(.20,.025,.25);
        }
        gl_FragColor=vec4(color,.98);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
  mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 3; scene.add(mesh);
  const axis = new THREE.Vector3(-1, 0, 0), direction = new THREE.Vector3(), rotation = new THREE.Quaternion();
  let dirty = false, active = 0, disposed = false, highWater = 0;
  function set(index, at, velocity, family) {
    if (disposed || index < 0 || index >= capacity) return false;
    const kind = family === 'fire' ? 0 : family === 'glacial' ? 1 : 2;
    direction.copy(velocity); if (direction.lengthSq() < 1e-8) direction.copy(axis); direction.normalize();
    rotation.setFromUnitVectors(axis, direction);
    arrays.aOrigin.set([at.x, at.y ?? 1.2, at.z], index * 3);
    arrays.aQuaternion.set([rotation.x, rotation.y, rotation.z, rotation.w], index * 4);
    arrays.aStyle.set([kind, kind === 0 ? .29 : kind === 1 ? .24 : .15, kind === 0 ? 1.1 : kind === 1 ? .7 : .85, 1], index * 4);
    highWater = Math.max(highWater, index + 1); dirty = true; return true;
  }
  function hide(index) { arrays.aStyle[index * 4 + 3] = 0; dirty = true; }
  function update(time, reduced) {
    if (disposed) return;
    material.uniforms.uTime.value = time; material.uniforms.uMotion.value = reduced ? 0 : 1;
    if (dirty) { for (const key of Object.keys(arrays)) geometry.attributes[key].needsUpdate = true; dirty = false; }
    active = 0; for (let i = 0; i < highWater; i++) active += arrays.aStyle[i * 4 + 3] > .5 ? 1 : 0;
    geometry.instanceCount = highWater; mesh.visible = active > 0;
  }
  function reset() { arrays.aStyle.fill(0); highWater = 0; active = 0; dirty = true; geometry.instanceCount = 0; mesh.visible = false; }
  function dispose() { if (disposed) return; reset(); mesh.removeFromParent(); geometry.dispose(); material.dispose(); disposed = true; }
  return { set, hide, update, reset, dispose, getStats: () => ({ active, capacity, drawCalls: mesh.visible ? 1 : 0, allocatedBytes: Object.values(arrays).reduce((n, a) => n + a.byteLength, 0), disposed }) };
}
