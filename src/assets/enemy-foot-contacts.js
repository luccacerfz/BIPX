import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';

// These are actual ball-of-foot sole vertices, fully weighted to Foot/ToeBase.
// Their identity is checked against the loaded skin rather than a guessed axis.
const SOLES = { L: 9061, R: 9060 };
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export function measureOrcSupport({ THREE, source, motion }) {
  const model = cloneSkeleton(source.scene), body = model.getObjectByName('OrcBody');
  const mixer = new THREE.AnimationMixer(model), point = new THREE.Vector3();
  const skinIndex = body.geometry.attributes.skinIndex, skinWeight = body.geometry.attributes.skinWeight;
  for (const [side, index] of Object.entries(SOLES)) {
    let footWeight = 0;
    for (let slot = 0; slot < 4; slot++) {
      const bone = body.skeleton.bones[skinIndex.getComponent(index, slot)];
      if ([`${side}_Foot`, `${side}_ToeBase`].includes(bone.name)) footWeight += skinWeight.getComponent(index, slot);
    }
    if (footWeight < .999) throw new Error(`Orc ${side} sole is not rigidly foot weighted`);
    const hip = model.getObjectByName(`${side}_Thigh`), knee = model.getObjectByName(`${side}_Calf`), ankle = model.getObjectByName(`${side}_Foot`);
    if (knee.parent !== hip || ankle.parent !== knee) throw new Error('Unsupported Orc deform chain');
  }
  const profiles = {};
  for (const name of ['Walk', 'Run']) {
    const clip = source.animations.find(clip => clip.name === name), count = 240, dt = clip.duration / count;
    mixer.stopAllAction(); mixer.clipAction(clip).reset().play();
    const samples = Array.from({ length: count }, (_, i) => {
      mixer.setTime(i * dt); model.updateMatrixWorld(true); body.skeleton.update();
      return Object.values(SOLES).map(index => body.getVertexPosition(index, point).applyMatrix4(body.matrixWorld).toArray());
    });
    const nominal = name === 'Walk' ? motion.walkSpeed : motion.runStride / clip.duration;
    const minima = [0, 1].map(foot => Math.min(...samples.map(frame => frame[foot][1])));
    const contacts = [0, 1].map(foot => samples.map((frame, i) => {
      const before = samples[(i + count - 1) % count][foot], after = samples[(i + 1) % count][foot];
      const backward = -(after[2] - before[2]) / (2 * dt);
      // Surface proximity plus backwards stance sweep excludes a lifted toe
      // that briefly pauses at the top of its swing. Keep the airborne phase.
      return frame[foot][1] < minima[foot] + .018 && backward > nominal * .4;
    }));
    profiles[name] = { duration: clip.duration, contacts, soleMinima: minima,
      contactFractions: contacts.map(foot => foot.filter(Boolean).length / count) };
  }
  mixer.stopAllAction(); mixer.uncacheRoot(model);
  const skeletons = new Set(); model.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
  for (const skeleton of skeletons) skeleton.dispose();
  return profiles;
}

/** Visual only: no root translation, skin/prop changes or authoritative movement. */
export function createOrcFootContacts({ THREE, model, root, stats, profiles, enabled = true }) {
  const body = model.getObjectByName('OrcBody'), v = () => new THREE.Vector3(), q = () => new THREE.Quaternion();
  const legs = Object.entries(SOLES).map(([side, index]) => ({ side, index,
    hip: model.getObjectByName(`${side}_Thigh`), knee: model.getObjectByName(`${side}_Calf`), ankle: model.getObjectByName(`${side}_Foot`),
    anchor: v(), lastPoint: v(), correction: v(), release: v(), locked: false, previousContact: false, initialized: false, serial: 0,
  }));
  const originals = legs.flatMap(leg => [leg.hip, leg.knee, leg.ankle]).map(bone => ({ bone, quaternion: q() }));
  let modified = false, previousClip = null, settle = 0, lastYaw = null, lastBodyYaw = null;
  const tmp = { hip:v(), knee:v(), ankle:v(), direction:v(), pole:v(), newKnee:v(), newAnkle:v(), from:v(), to:v(), target:v(), sole:v(), after:v(), forward:v(),
    parent:q(), world:q(), delta:q(), foot:q(), root:q() };
  const metrics = stats.footSupport = { enabled, method:'Skinned sole phase contacts + world XZ plants + direct deform-chain IK; twist branches inherit rotation',
    soleVertices: SOLES, profiles: Object.fromEntries(Object.entries(profiles).map(([name,p]) => [name,{ contactFractions:p.contactFractions, soleMinima:p.soleMinima }])),
    contacts: [], plantCount: 0, reachReleaseCount: 0, discontinuityReleaseCount: 0, maxCorrection: 0, maxReachError: 0 };
  function restore() { if (!modified) return; for (const saved of originals) saved.bone.quaternion.copy(saved.quaternion); modified = false; }
  function clear(discontinuity = false) {
    for (const leg of legs) { leg.locked = false; leg.previousContact = false; leg.initialized = false; leg.correction.set(0,0,0); leg.release.set(0,0,0); }
    metrics.contacts = [];
    if (discontinuity) metrics.discontinuityReleaseCount++;
  }
  function worldQuaternion(bone, desired) {
    bone.parent.getWorldQuaternion(tmp.parent).invert(); bone.quaternion.copy(tmp.parent).multiply(desired).normalize(); bone.updateMatrixWorld(true);
  }
  function aim(bone, from, to) {
    tmp.delta.setFromUnitVectors(from.normalize(),to.normalize()); bone.getWorldQuaternion(tmp.world);
    tmp.delta.multiply(tmp.world); worldQuaternion(bone,tmp.delta);
  }
  function solve(leg, target) {
    leg.hip.getWorldPosition(tmp.hip); leg.knee.getWorldPosition(tmp.knee); leg.ankle.getWorldPosition(tmp.ankle); leg.ankle.getWorldQuaternion(tmp.foot);
    const upper = tmp.hip.distanceTo(tmp.knee), lower = tmp.knee.distanceTo(tmp.ankle), requested = tmp.hip.distanceTo(target);
    const maximum = (upper + lower) * .9995, minimum = Math.abs(upper - lower) + .0001;
    const error = Math.max(0,requested-maximum,minimum-requested);
    metrics.maxReachError = Math.max(metrics.maxReachError,error);
    if (error > .004 * stats.runtimeHeight / 2.5) return error;
    const distance = THREE.MathUtils.clamp(requested,minimum,maximum);
    tmp.direction.copy(target).sub(tmp.hip).normalize();
    tmp.pole.copy(tmp.knee).sub(tmp.hip); tmp.pole.addScaledVector(tmp.direction,-tmp.pole.dot(tmp.direction));
    if (tmp.pole.lengthSq() < 1e-8) { tmp.pole.copy(tmp.forward); tmp.pole.addScaledVector(tmp.direction,-tmp.pole.dot(tmp.direction)); }
    tmp.pole.normalize();
    const along = (upper*upper + distance*distance - lower*lower)/(2*distance);
    const bend = Math.sqrt(Math.max(0,upper*upper-along*along));
    tmp.newKnee.copy(tmp.hip).addScaledVector(tmp.direction,along).addScaledVector(tmp.pole,bend);
    tmp.newAnkle.copy(tmp.hip).addScaledVector(tmp.direction,distance);
    aim(leg.hip,tmp.from.copy(tmp.knee).sub(tmp.hip),tmp.to.copy(tmp.newKnee).sub(tmp.hip));
    leg.knee.getWorldPosition(tmp.knee); leg.ankle.getWorldPosition(tmp.ankle);
    aim(leg.knee,tmp.from.copy(tmp.ankle).sub(tmp.knee),tmp.to.copy(tmp.newAnkle).sub(tmp.knee));
    worldQuaternion(leg.ankle,tmp.foot); // Preserve authored foot roll and toe articulation.
    return error;
  }
  return {
    restore,
    reset() { restore(); clear(); previousClip=null; settle=0; lastYaw=null; lastBodyYaw=null; },
    update(dt, state, { clip, time, active }) {
      model.updateWorldMatrix(true,true); body.skeleton.update();
      model.getWorldQuaternion(tmp.root); tmp.forward.set(0,0,1).applyQuaternion(tmp.root).setY(0).normalize();
      const bodyYaw = Math.atan2(tmp.forward.x,tmp.forward.z);
      const velocity = state.velocity, moving = velocity && Math.hypot(velocity.x||0,velocity.z||0)>.05;
      const yaw = moving ? Math.atan2(velocity.x,velocity.z) : bodyYaw;
      const discontinuity = state.teleport || dt > .12 || (lastYaw!==null && Math.abs(wrap(yaw-lastYaw))>.35) || (lastBodyYaw!==null && Math.abs(wrap(bodyYaw-lastBodyYaw))>.35);
      lastYaw=yaw; lastBodyYaw=bodyYaw;
      if (clip!==previousClip) { clear(); settle=.16; previousClip=clip; }
      if (discontinuity) { clear(true); settle=.08; }
      settle=Math.max(0,settle-dt);
      const profile=profiles[clip];
      if (!active || !profile || dt<=0 || settle>0 || Math.abs(wrap(yaw-bodyYaw))>.7) { clear(); return; }
      const phase=((time/profile.duration)%1+1)%1, sample=Math.floor(phase*profile.contacts[0].length);
      for (const saved of originals) saved.quaternion.copy(saved.bone.quaternion);
      modified=enabled;
      metrics.contacts.length=0;
      for (let i=0;i<legs.length;i++) {
        const leg=legs[i], contact=profile.contacts[i][sample];
        body.getVertexPosition(leg.index,tmp.sole).applyMatrix4(body.matrixWorld);
        if (contact && !leg.previousContact) { leg.anchor.copy(tmp.sole); leg.anchorYaw=yaw; leg.locked=true; leg.serial++; metrics.plantCount++; leg.release.set(0,0,0); }
        let reason=null;
        if (!contact && leg.locked) { leg.release.copy(leg.correction); leg.locked=false; reason='toe-off'; }
        if (leg.locked && Math.abs(wrap(yaw-leg.anchorYaw))>.28) { leg.locked=false; leg.release.copy(leg.correction); reason='turn'; }
        leg.correction.set(0,0,0);
        if (leg.locked) leg.correction.set(leg.anchor.x-tmp.sole.x,0,leg.anchor.z-tmp.sole.z);
        else if (leg.release.lengthSq()>1e-9) { leg.release.multiplyScalar(Math.max(0,1-dt/.035)); leg.correction.copy(leg.release); }
        const magnitude=leg.correction.length(), limit=.16 * stats.runtimeHeight/2.5;
        let reachError=0;
        if (magnitude>limit) { leg.locked=false; leg.correction.set(0,0,0); leg.release.set(0,0,0); reason='correction-limit'; metrics.reachReleaseCount++; }
        if (enabled && leg.correction.lengthSq()>1e-12) {
          leg.ankle.getWorldPosition(tmp.target); tmp.target.add(leg.correction); reachError=solve(leg,tmp.target);
          if (reachError>.004 * stats.runtimeHeight/2.5) { leg.locked=false; leg.correction.set(0,0,0); leg.release.set(0,0,0); reason='reach'; metrics.reachReleaseCount++; }
        }
        metrics.maxCorrection=Math.max(metrics.maxCorrection,leg.correction.length());
        model.updateMatrixWorld(true); body.skeleton.update(); body.getVertexPosition(leg.index,tmp.after).applyMatrix4(body.matrixWorld);
        const drift=leg.initialized && contact && leg.previousContact ? Math.hypot(tmp.after.x-leg.lastPoint.x,tmp.after.z-leg.lastPoint.z)/dt : null;
        metrics.contacts.push({ side:leg.side, vertex:leg.index, contact, locked:enabled&&leg.locked, serial:leg.serial, position:tmp.after.toArray(), drift, reachError, correction:leg.correction.length(), releaseReason:reason });
        leg.lastPoint.copy(tmp.after); leg.initialized=true; leg.previousContact=contact;
      }
    },
  };
}
