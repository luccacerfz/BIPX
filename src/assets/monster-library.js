import { LICH_CAST_PROFILE } from './lich-cast-profile.js';
import { loadGlb } from './load-glb.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';
import { getEnemyControlState } from './enemy-control-state.js';

const DEFINITIONS = {
  zombie: { file: 'zombie', height: 2.1, label: 'Grave Walker' },
  brute: { file: 'brute', height: 2.8, label: 'Crypt Brute' },
  lich: { file: 'lich', height: 3.0, label: 'Crowned Lich' },
};
const ROLES = ['Idle', 'Walk', 'Run', 'Attack', 'Death'];

/** Slice exact seconds, interpolating both boundary keys; leaves source intact. */
function sliceClip(THREE, source, from, to) {
 if(!(from>=0 && to>from && to<=source.duration))throw new RangeError('Invalid clip window');
 const tracks=source.tracks.map(track=>{
  const size=track.getValueSize(),interpolant=track.createInterpolant();
  const sourceTimes=[from,...Array.from(track.times).filter(t=>t>from&&t<to),to];
  const times=new Float32Array(sourceTimes.length),values=new Float32Array(sourceTimes.length*size);
  sourceTimes.forEach((time,i)=>{times[i]=time-from;values.set(interpolant.evaluate(time),i*size);});
  return new track.constructor(track.name,times,values,track.getInterpolation());
 });
 return new THREE.AnimationClip(source.name,to-from,tracks);
}


// Clip copies belong to the library; imported files/prototypes remain unchanged.
function normalizeClips(THREE, source, castProfile = null) {
  const retargeted = new Set(source.scene.userData.bipxMotion?.retargetedRoles || []);
  if (castProfile) retargeted.add('Attack');
  return source.animations.map((original, index) => {
    let clip = original.clone();
    const name = ROLES[index];
    if (name === 'Idle') clip = THREE.AnimationUtils.subclip(clip, name, 0, 96, 30);
    // Keep anticipation + the first complete swing, discard the later combo.
    if (name === 'Attack' && !retargeted.has(name)) clip = THREE.AnimationUtils.subclip(clip, name, 0, 65, 30);
    if(name==='Attack'&&retargeted.has(name)&&!castProfile) clip=sliceClip(THREE,clip,1/3,5/3);
    clip.name = name;
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf('.');
      const boneName = track.name.slice(0, dot);
      const property = track.name.slice(dot + 1);
      if (!/^(Root|Hip|Pelvis)$/i.test(boneName)) continue;
      const bone = source.scene.getObjectByName(boneName);
      if (!bone) continue;
      if (property === 'position') {
        // Retargeted clips already remove WORLD XZ. This rig's Hip local Z
        // carries vertical bob, so flattening local XZ would destroy that data.
        if (retargeted.has(name)) continue;
        for (let i = 0; i < track.values.length; i += 3) {
          track.values[i] = bone.position.x;
          track.values[i + 2] = bone.position.z;
        }
      }
      // Root-only facing stabilization; preserve Pelvis articulation. Death
      // retains the root tilt so the body can fall instead of staying upright.
      if (boneName === 'Root' && property === 'quaternion' && name !== 'Death') {
        for (let i = 0; i < track.values.length; i += 4) bone.quaternion.toArray(track.values, i);
      }
    }
    return clip;
  });
}

/**
 * Loads three shared prototypes only (no crowd skeletons).
 * create(id,{parent,height,yaw}) is synchronous; controllers own mixers,
 * skeletons and material clones. Caller owns movement/collision/pool limits.
 * The default mesh heading is -Z; yaw is an optional additional rotation.
 */
export async function loadMonsterLibrary({ THREE } = {}) {
  if (!THREE) throw new TypeError('loadMonsterLibrary requires THREE');
  const probeResponse = await fetch(new URL('../../assets/models/monsters/ground-probes.json', import.meta.url));
  if (!probeResponse.ok) throw new Error(`Monster ground probes failed: ${probeResponse.status}`);
  const groundProbes = await probeResponse.json();
  const castResponse = await fetch(new URL('./lich-cast-clips.json', import.meta.url));
  if (!castResponse.ok) throw new Error(`Lich sidecar failed: ${castResponse.status}`);
  const castData = await castResponse.json();
  const castClip = THREE.AnimationClip.parse(castData.clip);
  if (castData.profileId !== LICH_CAST_PROFILE.id || castData.actorType !== 'caster' ||
      castClip.name !== LICH_CAST_PROFILE.sourceClip || castClip.duration !== LICH_CAST_PROFILE.sourceDuration ||
      castClip.tracks.length !== 24) throw new Error('Lich profile requires the exact full Attack sidecar');
  const entries = await Promise.all(Object.entries(DEFINITIONS).map(async ([id, definition]) => {
    const url = new URL(`../../assets/models/monsters/${definition.file}.glb`, import.meta.url).href;
    const source = await loadGlb(url);
    if (source.animations.length !== 5) throw new Error(`${id}: expected five Tripo animation clips`);
    const clips = normalizeClips(THREE, source);
    const castClips = id === 'lich' ? normalizeClips(THREE, {
      scene: source.scene, animations: source.animations.map((clip, i) => i === LICH_CAST_PROFILE.sourceIndex ? castClip : clip),
    }, LICH_CAST_PROFILE) : null;
    if (castClips && !source.scene.getObjectByName(LICH_CAST_PROFILE.socketName)) throw new Error('Missing Lich cast socket');
    let vertices = 0, triangles = 0, bones = 0, skinnedMeshes = 0;
    const textures = new Set();
    source.scene.traverse(object => {
      if (!object.isMesh) return;
      vertices += object.geometry.attributes.position.count;
      triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      if (object.isSkinnedMesh) { skinnedMeshes++; bones += object.skeleton.bones.length; }
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material.map) textures.add(material.map);
    });
    if (!skinnedMeshes) throw new Error(`${id}: model has no skinned mesh`);
    const motion = source.scene.userData.bipxMotion || null;
    const attackWindow = motion?.retargetedRoles?.includes('Attack') ? { from: 1/3, to: 5/3, fullDuration: source.animations[3].duration, defaultDuration: .88, impactPhase: .523 } : null;
    const stats = { id, label: definition.label, url, vertices, triangles, bones, skinnedMeshes, motion, attackWindow,
      textures: [...textures].map(t => ({ width: t.image.width, height: t.image.height })),
      clips: clips.map(c => ({ name: c.name, duration: c.duration, tracks: c.tracks.length })) };
    return [id, { source, clips, castClips, definition, stats, motion }];
  }));
  const prototypes = Object.fromEntries(entries);
  const actors = new Set();
  let disposed = false;
  const stats = { loaded: true, activeActors: 0, createdActors: 0, prototypes: Object.fromEntries(entries.map(([id, p]) => [id, p.stats])) };

  function create(id, { parent, height = DEFINITIONS[id]?.height, yaw = 0, castProfileId = null } = {}) {
    if (disposed) throw new Error('Monster library has been disposed');
    const entry = prototypes[id];
    if (!entry) throw new RangeError(`Unknown monster: ${id}`);
    if (castProfileId !== null && (id !== 'lich' || castProfileId !== LICH_CAST_PROFILE.id)) throw new RangeError('Unsupported monster cast profile');
    const castProfile = castProfileId ? LICH_CAST_PROFILE : null;
    const selectedClips = castProfile ? entry.castClips : entry.clips;
    const supportsPhaseAttack=Boolean(castProfile)
      || entry.motion?.retargetedRoles?.includes('Attack')===true
      || (id==='brute' && selectedClips.some(clip => clip.name === 'Attack'));
    const model = cloneSkeleton(entry.source.scene);
    const root = new THREE.Group();
    root.name = `Monster:${id}`;
    root.add(model);
    model.rotation.y = Math.PI / 2 + yaw;
    const materialClones = new Map();
    const skeletons = new Set();
    const baseMaterials = [];
    const groundMesh = model.getObjectByName(groundProbes[id].meshName);
    const probes = groundProbes[id].vertexIndices;
    const contact = new THREE.Vector3(), inverseModel = new THREE.Matrix4();
    const hitColor = new THREE.Color(0xff4c2f);
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.isSkinnedMesh) { object.frustumCulled = false; skeletons.add(object.skeleton); }
      const copy = material => {
        if (!materialClones.has(material)) {
          const cloned = material.clone();
          materialClones.set(material, cloned);
          baseMaterials.push({ material: cloned, emissive: cloned.emissive?.clone(), intensity: cloned.emissiveIntensity ?? 1, opacity: cloned.opacity });
        }
        return materialClones.get(material);
      };
      object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(selectedClips.map(c => [c.name, mixer.clipAction(c)]));
    let current = actions.Idle;
    current.play();
    mixer.update(0);
    model.updateMatrixWorld(true);
    for (const skeleton of skeletons) skeleton.update();
    const bounds = new THREE.Box3().setFromObject(model, true);
    const sourceHeight = Math.max(bounds.max.y - bounds.min.y, .001);
    root.scale.setScalar(Math.max(.1, Number(height) || entry.definition.height) / sourceHeight);
    model.position.y -= bounds.min.y;
    const baseY = model.position.y;
    parent?.add(root);
    let dead = false, oneShot = false, speed = 0, flash = 0, released = false;
    let attackState=null, attackStarts=0, localAttackId=0, lastSequence=-Infinity;
    const actorStats = { ...entry.stats, loaded: true, sourceHeight, runtimeHeight: height, supportsPhaseAttack,
      currentClip: 'Idle', animationTime: 0, dead: false, floorCorrection: 0, attack: null };
    actorStats.castProfile = castProfile;
    if (castProfile) {
      actorStats.clips = selectedClips.map(c => ({ name: c.name, duration: c.duration, tracks: c.tracks.length }));
      actorStats.attackWindow = { from: 0, to: castProfile.sourceDuration, fullDuration: castProfile.sourceDuration,
        defaultDuration: castProfile.duration, impactPhase: castProfile.releasePhase, profileId: castProfile.id };
    }
    actorStats.groundProbes = probes.length;
    const stride = { Walk: (entry.motion?.walkStride || 0) * root.scale.x,
      Run: (entry.motion?.runStride || 0) * root.scale.x };
    const gaitSpeed = { Walk: stride.Walk / actions.Walk.getClip().duration,
      Run: stride.Run / actions.Run.getClip().duration };
    Object.assign(actorStats, { strideMeters: stride, nominalGaitSpeed: gaitSpeed,
      animationTimeScale: 1, gaitSpeedMismatch: 0 });
    function ground() {
      root.updateWorldMatrix(true, false);
      root.updateMatrixWorld(true);
      for (const skeleton of skeletons) skeleton.update();
      inverseModel.copy(model.matrixWorld).invert();
      let minimum = Infinity;
      for (const index of probes) {
        groundMesh.getVertexPosition(index, contact).applyMatrix4(groundMesh.matrixWorld).applyMatrix4(inverseModel);
        minimum = Math.min(minimum, contact.y);
      }
      if (Number.isFinite(minimum)) model.position.y = -minimum;
      actorStats.floorCorrection = (model.position.y - baseY) * root.scale.y;
    }
    ground();
    // Walk is deliberately capped at 1.8x. A separate zombie running take
    // provides a suitable stride for normal zombie/runner gameplay speeds.
    const locomotion = () => speed > .1 ? (speed > (gaitSpeed.Walk ? gaitSpeed.Walk * 1.8 : 2.4) ? 'Run' : 'Walk') : 'Idle';
    function transition(name, fade = .14, once = false, duration) {
      const next = actions[name];
      if (next === current && !once) return;
      next.reset().setEffectiveWeight(1).setEffectiveTimeScale(duration ? next.getClip().duration / Math.max(.1, duration) : 1);
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      next.clampWhenFinished = once;
      if (next !== current) current.fadeOut(fade);
      if (castProfile && fade <= 0) next.stopFading().setEffectiveWeight(1).play();
      else next.fadeIn(fade).play();
      current = next;
      oneShot = once;
      actorStats.currentClip = name;
    }
    // Visual-only protocol. The gameplay authority owns damage/cancellation.
    function publishAttack() {
      actorStats.attack = attackState ? { ...attackState, normalizedTime: THREE.MathUtils.clamp(attackState.elapsed/attackState.duration,0,1),
        impactReached: attackState.elapsed/attackState.duration >= attackState.impactPhase,
        clipTime: Math.min(attackState.elapsed/attackState.duration,1)*actions.Attack.getClip().duration,
        startCount: attackStarts } : null;
    }
    function syncAttack(snapshot) {
      if (!supportsPhaseAttack || released || dead || (actorStats.control?.paused && (!castProfile || snapshot?.active !== false)) || !snapshot || snapshot.id == null) return false;
      const sequence=Number.isFinite(snapshot.sequence)?snapshot.sequence:Number.isFinite(snapshot.id)?snapshot.id:null;
      if(sequence!==null && sequence<lastSequence) return false;
      const same=attackState?.id===snapshot.id;
      if(same && !attackState.active) return false; // Completed/cancelled IDs never restart.
      if(!same && sequence!==null && sequence===lastSequence) return false;
      const duration=Math.max(.1,Number(snapshot.duration)||castProfile?.duration||.88);
      const explicitElapsed=Number.isFinite(snapshot.elapsed)?snapshot.elapsed:
        Number.isFinite(snapshot.phase)?snapshot.phase*duration:0;
      const elapsed=THREE.MathUtils.clamp(explicitElapsed,0,duration);
      const impactPhase=THREE.MathUtils.clamp(Number.isFinite(snapshot.impactPhase)?snapshot.impactPhase:(castProfile?.releasePhase??.523),0,1);
      if(snapshot.active===false) {
        if(sequence!==null)lastSequence=sequence;
        if(!same)attackState={id:snapshot.id,sequence,duration,elapsed,lastReceivedElapsed:elapsed,impactPhase,active:false,cancelled:elapsed<duration};
        else{
          attackState.elapsed=Math.max(attackState.elapsed,elapsed);
          attackState.duration=duration;attackState.impactPhase=impactPhase;
          attackState.active=false;attackState.cancelled=attackState.elapsed<duration;
        }
        if (castProfile) attackState.cancelReason = snapshot.cancelReason || null;
        if(current===actions.Attack && !(castProfile && actorStats.control?.paused)){oneShot=false;transition(locomotion(),.1);}
        actorStats.animationTime=current.time;actorStats.animationTimeScale=current.getEffectiveTimeScale();
        publishAttack();return true;
      }
      if(same && elapsed<=attackState.lastReceivedElapsed && duration===attackState.duration) return false;
      if(sequence!==null)lastSequence=sequence;
      if(!same){
        attackState={id:snapshot.id,sequence,duration,elapsed,lastReceivedElapsed:elapsed,impactPhase,active:elapsed<duration,cancelled:false};
        if(attackState.active){
          attackStarts++;
          // A newly allocated actor arriving mid-swing must display its actual
          // phase immediately. Blending in from Idle would hide the windup.
          if(elapsed>0){mixer.stopAllAction();transition('Attack',0,true,duration);}
          else transition('Attack',.065,true,duration);
        }
      }else{
        attackState.lastReceivedElapsed=elapsed;
        attackState.elapsed=Math.max(attackState.elapsed,elapsed); // Ignore stale elapsed snapshots.
        attackState.duration=duration;attackState.impactPhase=impactPhase;
        attackState.active=attackState.elapsed<duration;
      }
      if(attackState.active){
        actions.Attack.paused=true;
        actions.Attack.time=attackState.elapsed/attackState.duration*actions.Attack.getClip().duration;
        oneShot=true;mixer.update(0);ground();
      }else if(current===actions.Attack){oneShot=false;transition(locomotion(),.1);}
      actorStats.animationTime=current.time;actorStats.animationTimeScale=attackState.active?actions.Attack.getClip().duration/attackState.duration:current.getEffectiveTimeScale();
      publishAttack();return true;
    }
    function onFinished({ action }) {
      if (action === current && !dead && !released) { oneShot = false; transition(locomotion()); }
    }
    mixer.addEventListener('finished', onFinished);
    const actor = {
      root, model, stats: actorStats, syncAttack,
      castSocket: castProfile ? model.getObjectByName(castProfile.socketName) : null,
      cast(options = {}) {
        if (!castProfile) return false;
        return syncAttack({ id: options.castId ?? options.id ?? `cast:${++localAttackId}`,
          duration: castProfile.duration, impactPhase: castProfile.releasePhase,
          ...options, elapsed: options.elapsed ?? Math.max(0, options.ageMs || 0) / 1000 });
      },
      cancelCast(reason = 'cancelled') {
        if (!castProfile || !attackState?.active) return false;
        return syncAttack({ ...attackState, active: false, cancelReason: reason });
      },
      update(dt, state = {}) {
        if (released) return;
        actorStats.control = getEnemyControlState(state);
        if (castProfile && (state.dead || actorStats.control.paused)) {
          actor.cancelCast(state.dead ? 'death' : actorStats.control.frozen ? 'freeze' : 'stun');
        }
        if (!state.dead && (actorStats.control.paused || (castProfile && state.paused))) {
          if (castProfile && state.attack?.active === false) syncAttack(state.attack);
          return;
        }
        if (castProfile && attackState && !attackState.active && current === actions.Attack) {
          oneShot = false; transition(locomotion(), .1);
        }
        const delta = Math.min(.1, Math.max(0, Number(dt) || 0));
        speed = Math.max(0, Number(state.speed) || 0);
        const receivedAttack=state.attack && !state.dead ? syncAttack(state.attack) : false;
        // A repeated authoritative age is still a clock sample, not permission
        // to predict another dt (offline and paused dt0 paths repeat samples).
        const authoritativeAttack=receivedAttack || Boolean(castProfile && state.attack?.id === attackState?.id);
        if (Boolean(state.dead) !== dead) {
          dead = Boolean(state.dead);
          actorStats.dead = dead;
          if(dead&&attackState){attackState.active=false;attackState.cancelled=true;publishAttack();}
          transition(dead ? 'Death' : locomotion(), .12, dead);
          if (!dead) { oneShot = false; model.position.y = baseY; }
        }
        if (!dead && !oneShot) {
          transition(locomotion());
          const gait = actorStats.currentClip;
          if (gaitSpeed[gait]) {
            const rate = THREE.MathUtils.clamp(speed / gaitSpeed[gait], .15, gait === 'Walk' ? 1.8 : 2);
            current.setEffectiveTimeScale(rate);
            // This is speed/stride mismatch, not measured foot sliding.
            actorStats.gaitSpeedMismatch = speed - gaitSpeed[gait] * rate;
          } else {
            if (gait === 'Walk') current.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 1.6, .65, 1.35));
            if (gait === 'Run') current.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 4, .75, 1.5));
            actorStats.gaitSpeedMismatch = 0;
          }
        }
        if(!dead&&attackState?.active){
          // An incoming elapsed is already evaluated for this rendered frame;
          // do not advance it by dt a second time. Between snapshots predict.
          if(!authoritativeAttack)attackState.elapsed=Math.min(attackState.duration,attackState.elapsed+delta);
          actions.Attack.time=attackState.elapsed/attackState.duration*actions.Attack.getClip().duration;
          if(attackState.elapsed>=attackState.duration){attackState.active=false;oneShot=false;transition(locomotion(),.1);}
          publishAttack();
        }
        mixer.update(delta);
        ground();
        flash = Math.max(0, flash - delta * 5.5);
        for (const base of baseMaterials) {
          if (base.emissive) base.material.emissive.copy(base.emissive).lerp(hitColor, flash * .8);
          base.material.emissiveIntensity = base.intensity + flash * 1.4;
        }
        actorStats.animationTime = current.time;
        actorStats.animationTimeScale = attackState?.active ? actions.Attack.getClip().duration/attackState.duration : current.getEffectiveTimeScale();
      },
      attack(options = {}) {
        if (actorStats.control?.paused) return false;
        if(!supportsPhaseAttack){if(!released&&!dead){transition('Attack',.065,true,options.duration??.9);return true;}return false;}
        return syncAttack({ id: options.id ?? `local:${++localAttackId}`, duration:castProfile?.duration??.88, ...options });
      },
      hit() { if (!released && !dead) flash = 1; },
      reset() {
        if (released) return;
        dead = false; oneShot = false; speed = 0; flash = 0;
        actorStats.control = getEnemyControlState();
        attackState=null;attackStarts=0;lastSequence=-Infinity;actorStats.attack=null;
        mixer.stopAllAction();
        current = actions.Idle;
        current.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopRepeat, Infinity).play();
        mixer.update(0);
        model.position.y = baseY;
        root.visible = true;
        for (const base of baseMaterials) {
          if (base.emissive) base.material.emissive.copy(base.emissive);
          base.material.emissiveIntensity = base.intensity;
          base.material.opacity = base.opacity;
        }
        Object.assign(actorStats, { currentClip: 'Idle', animationTime: 0, dead: false, floorCorrection: 0, animationTimeScale: 1, gaitSpeedMismatch: 0 });
        ground();
      },
      dispose() {
        if (released) return;
        released = true;
        mixer.removeEventListener('finished', onFinished);
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
        for (const material of materialClones.values()) material.dispose();
        for (const skeleton of skeletons) skeleton.dispose();
        root.removeFromParent();
        actors.delete(actor);
        stats.activeActors = actors.size;
      },
    };
    actors.add(actor);
    stats.activeActors = actors.size;
    stats.createdActors++;
    return actor;
  }

  return {
    ready: true, ids: Object.keys(DEFINITIONS), stats, create,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const actor of [...actors]) actor.dispose();
      const geometry = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
      for (const { source } of Object.values(prototypes)) source.scene.traverse(object => {
        if (!object.isMesh) return;
        geometry.add(object.geometry);
        if (object.isSkinnedMesh) skeletons.add(object.skeleton);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
      for (const resource of [...geometry, ...materials, ...textures, ...skeletons]) resource.dispose();
      stats.loaded = false;
    },
  };
}
