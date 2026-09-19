import { heroFootProbes } from './hero-foot-probes.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';

const directionalPromises = new Map();
export async function loadHeroDirectionalClips(THREE, id) {
  if (!directionalPromises.has(id)) directionalPromises.set(id, fetch(new URL(`./${id}-locomotion-clips.json`, import.meta.url)).then(response => { if (!response.ok) throw new Error(`Directional motions unavailable: ${id}`); return response.json(); }).catch(error => { directionalPromises.delete(id); throw error; }));
  const data = await directionalPromises.get(id);
  return data.clips.map(item => ({ ...item, clip: THREE.AnimationClip.parse(item.clip) }));
}

const sides = ['Left', 'Right'];
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

function deformBones(model) {
  let skeleton;
  model.traverse(object => { if (object.isSkinnedMesh && !skeleton) skeleton = object.skeleton; });
  return Object.fromEntries((skeleton?.bones || []).map(bone => [bone.name.replace(/^mixamorig:?/, '').replace(/_\d+$/, ''), bone]));
}

/**
 * Mixamo gait measurement, independent leg playback and world-space toe plants.
 * This is visual correction only: the caller owns movement, collision and aim.
 * Existing GLBs/skins/upper-body animation and baked prop tracks stay untouched.
 */
export function createHeroLocomotion({ THREE, model, root, clips, directional = [], stats, height, characterId }) {
  const bones = deformBones(model);
  const driver = cloneSkeleton(model);
  // Never add this pose sampler to the rendered scene. Geometry is shared.
  driver.position.set(0, 0, 0); driver.quaternion.identity(); driver.scale.setScalar(1);
  const sourceBones = deformBones(driver);
  const driverMixer = new THREE.AnimationMixer(driver);
  const sourceNames = Object.fromEntries(Object.values(sourceBones).map(bone => [bone.name.replace(/_\d+$/, ''), bone.name]));
  for (const entry of directional) for (const track of entry.clip.tracks) {
    const [name, property] = track.name.split('.');
    track.name = `${sourceNames[name.replace(/_\d+$/, '')] || name}.${property}`;
  }
  const gaitClips = [...clips.filter(c => ['Idle', 'Walk', 'Run'].includes(c.name)), ...directional.filter(entry => entry.clip.name !== 'RunBackwardFast').map(entry => entry.clip)];
  const directions = Object.fromEntries(directional.map(entry => [entry.clip.name, entry.direction]));
  const actions = Object.fromEntries(gaitClips.map(c => [c.name, driverMixer.clipAction(c)]));
  const vector = () => new THREE.Vector3();
  const profiles = {};
  const sourceScale = root.scale.x;
  for (const name of Object.keys(actions).filter(name => name !== 'Idle')) {
    const direction = directions[name] || [0, 1];
    const type = name.startsWith('Walk') || (name.startsWith('Strafe') && actions[name].getClip().duration > .8) ? 'Walk' : 'Run';
    const action = actions[name];
    if (!action) throw new Error(`Missing real Mixamo ${name} clip`);
    driverMixer.stopAllAction(); action.reset().play();
    const count = 160, duration = action.getClip().duration, dt = duration / count;
    const samples = Array.from({ length: count }, (_, i) => {
      driverMixer.setTime(i * dt); driver.updateMatrixWorld(true);
      return sides.map(side => sourceBones[`${side}ToeBase`].getWorldPosition(vector()));
    });
    const velocities = [];
    const contacts = sides.map((_, foot) => {
      const floor = Math.min(...samples.map(sample => sample[foot].y));
      return samples.map((sample, i) => {
        const previous = samples[(i + count - 1) % count][foot];
        const velocity = -((sample[foot].x - previous.x) * direction[0] + (sample[foot].z - previous.z) * direction[1]) / dt;
        const low = (sample[foot].y - floor) * sourceScale < (type === 'Run' ? .075 : .055) * height / 2.4;
        if (low && velocity > .08) velocities.push(velocity);
        return { low, velocity };
      });
    });
    const nominalSourceSpeed = median(velocities);
    profiles[name] = {
      duration, direction, type, nominalSpeed: nominalSourceSpeed * sourceScale,
      strideMeters: nominalSourceSpeed * sourceScale * duration,
      contacts: contacts.map(foot => foot.map(sample => sample.low && sample.velocity > nominalSourceSpeed * .42)),
    };
    // Preserve the authored support intervals. A low Mixamo ankle is not a
    // clearance trajectory for the target's thick, deformed boot: calibrate a
    // smooth swing arc independently of contact classification.
    profiles[name].swingClearance = profiles[name].contacts.map(mask => mask.map((contact, i) => {
      if (contact) return 0;
      let before = 1, after = 1;
      while (before < count && !mask[(i - before + count) % count]) before++;
      while (after < count && !mask[(i + after) % count]) after++;
      if (before === count || after === count) return 0;
      const phase = before / (before + after);
      return Math.sin(Math.PI * phase) ** 2 * height * (type === 'Run' ? .065 : .025);
    }));
    profiles[name].swingCarry = profiles[name].contacts.map(mask => mask.map((contact, i) => {
      if (contact) return 0;
      let before = 1, after = 1;
      while (before < count && !mask[(i - before + count) % count]) before++;
      while (after < count && !mask[(i + after) % count]) after++;
      if (before === count || after === count) return 0;
      const t = before / (before + after);
      return 1 - t*t*t*(t*(t*6-15)+10);
    }));
  }
  driverMixer.stopAllAction(); actions.Idle.reset().play();
  let current = actions.Idle, gait = 'Idle', elapsedStill = 1, lastYaw = null;
  const lowerNames = Object.keys(bones).filter(name => /^(Left|Right)(UpLeg|Leg|Foot|Toe)/.test(name));
  const legs = sides.map(side => ({
    side, hip: bones[`${side}UpLeg`], knee: bones[`${side}Leg`], ankle: bones[`${side}Foot`], toe: bones[`${side}ToeBase`],
    anchor: vector(), lastToe: vector(), target: vector(), desiredFootQ: new THREE.Quaternion(), plantedFootQ: new THREE.Quaternion(), plantedAnkle: vector(), contact: false,
    authoredTarget: vector(), lastAuthoredTarget: vector(), lastSolvedAnkle: vector(), swingResidual: vector(), swingCarry: 0,
    toePose: Object.entries(bones).filter(([name]) => name.startsWith(`${side}Toe`)).map(([, bone]) => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() })),
    probes: heroFootProbes[characterId].feet[sides.indexOf(side)].map(p => ({ mesh: model.getObjectByName(p.mesh), vertex: p.vertex })), locked: false, serial: 0, previousContact: false, initialized: false,
  }));
  const q = () => new THREE.Quaternion();
  const tmp = { a: vector(), b: vector(), c: vector(), d: vector(), e: vector(), f: vector(), g: vector(), h: vector(), parentQ: q(), rotation: q(), footQ: q(), spineWorld: new THREE.Matrix4(), inverse: new THREE.Matrix4(), scale: vector() };
  const bodyForward = vector(), moveForward = vector(), bodyRight = vector(), moveRight = vector(), pelvis = vector();
  const parameters = { upperGait: 'Idle', gait: 'Idle', rate: 1, stride: 1, speed: 0 };
  const restoredBones = lowerNames.map(name => bones[name]);
  const baseRootY = root.position.y;
  const originalPose = restoredBones.map(bone => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }));
  let poseModified = false;
  stats.locomotion = {
    method: 'Measured directional Mixamo clips + continuous legs + two-bone IK + deformed sole witnesses and world support at actual sole patches with authored foot roll',
    nominalGaitSpeed: Object.fromEntries(Object.entries(profiles).map(([name, p]) => [name, p.nominalSpeed])),
    strideMeters: Object.fromEntries(Object.entries(profiles).map(([name, p]) => [name, p.strideMeters])),
    gait: 'Idle', timeScale: 1, strideScale: 1, speedMismatch: 0, footPlantSerial: 0,
    footContacts: [], recentFootPlants: [], reachLimitCount: 0, recentFootReleases: [],
  };
  const metrics = stats.locomotion;

  const localVelocity = vector();
  function prepare(speed, state = {}) {
    parameters.speed = speed;
    let direction = [0, 1];
    if (state.velocity && Math.hypot(state.velocity.x || 0, state.velocity.z || 0) > .05) {
      model.updateWorldMatrix(true, false);
      model.getWorldQuaternion(tmp.parentQ).invert();
      localVelocity.set(state.velocity.x, 0, state.velocity.z).applyQuaternion(tmp.parentQ).normalize();
      direction = Math.abs(localVelocity.x) > Math.abs(localVelocity.z) ? [Math.sign(localVelocity.x), 0] : [0, Math.sign(localVelocity.z)];
    }
    const candidates = Object.entries(profiles).filter(([, p]) => p.direction[0] === direction[0] && p.direction[1] === direction[1]);
    const walk = candidates.find(([, p]) => p.type === 'Walk') || ['Walk', profiles.Walk];
    const runs = candidates.filter(([, p]) => p.type === 'Run');
    const run = runs.sort((a, b) => Math.abs(Math.log(Math.max(speed, .1) / a[1].nominalSpeed)) - Math.abs(Math.log(Math.max(speed, .1) / b[1].nominalSpeed)))[0] || ['Run', profiles.Run];
    const walkLimit = walk[1].nominalSpeed * (profiles[gait]?.type === 'Run' ? 1.2 : 1.45);
    parameters.gait = speed < .08 ? 'Idle' : speed <= walkLimit ? walk[0] : run[0];
    parameters.upperGait = parameters.gait === 'Idle' ? 'Idle' : profiles[parameters.gait].type;
    if (parameters.gait === 'Idle') { parameters.rate = 1; parameters.stride = 1; return parameters; }
    const profile = profiles[parameters.gait];
    parameters.rate = THREE.MathUtils.clamp(speed / profile.nominalSpeed, .35, profile.type === 'Walk' ? 1.45 : 1.85);
    parameters.stride = THREE.MathUtils.clamp(speed / (profile.nominalSpeed * parameters.rate), .5, 1.06);
    parameters.rate = Math.min(2.2, speed / (profile.nominalSpeed * parameters.stride));
    return parameters;
  }
  function clearContacts() {
    for (const leg of legs) { leg.locked = false; leg.previousContact = false; leg.initialized = false; leg.swingResidual.set(0, 0, 0); }
  }
  function setWorldQuaternion(bone, world) {
    bone.parent.getWorldQuaternion(tmp.parentQ).invert();
    bone.quaternion.copy(tmp.parentQ).multiply(world);
    bone.updateMatrixWorld(true);
  }
  function aimBone(bone, from, to) {
    tmp.rotation.setFromUnitVectors(from.normalize(), to.normalize());
    bone.getWorldQuaternion(tmp.parentQ);
    tmp.rotation.multiply(tmp.parentQ);
    setWorldQuaternion(bone, tmp.rotation);
  }
  function solveLeg(leg, target) {
    const hip = leg.hip.getWorldPosition(tmp.a), knee = leg.knee.getWorldPosition(tmp.b), ankle = leg.ankle.getWorldPosition(tmp.c);
    tmp.footQ.copy(leg.desiredFootQ);
    const upperLength = hip.distanceTo(knee), lowerLength = knee.distanceTo(ankle);
    const targetDirection = tmp.d.copy(target).sub(hip), requestedDistance = targetDirection.length();
    const distance = THREE.MathUtils.clamp(requestedDistance, Math.abs(upperLength - lowerLength) + .001, (upperLength + lowerLength) * .998);
    const error = Math.max(0, requestedDistance - distance);
    targetDirection.normalize();
    const pole = tmp.e.copy(knee).sub(hip).addScaledVector(targetDirection, -tmp.e.dot(targetDirection));
    if (pole.lengthSq() < 1e-8) pole.copy(bodyForward).addScaledVector(targetDirection, -bodyForward.dot(targetDirection));
    pole.normalize();
    const along = (upperLength * upperLength + distance * distance - lowerLength * lowerLength) / (2 * distance);
    const bend = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
    const newKnee = tmp.f.copy(hip).addScaledVector(targetDirection, along).addScaledVector(pole, bend);
    const newAnkle = tmp.g.copy(hip).addScaledVector(targetDirection, distance);
    // Scratch vectors are distinct from the target chain data used below.
    aimBone(leg.hip, tmp.h.copy(knee).sub(hip), tmp.e.copy(newKnee).sub(hip));
    leg.knee.getWorldPosition(tmp.b); leg.ankle.getWorldPosition(tmp.c);
    aimBone(leg.knee, tmp.h.copy(tmp.c).sub(tmp.b), tmp.e.copy(newAnkle).sub(tmp.b));
    setWorldQuaternion(leg.ankle, tmp.footQ);
    return error;
  }
  const solePoint = vector(), lowestSole = vector();
  function sampleSole(leg) {
    const meshes = new Set(leg.probes.map(p => p.mesh));
    for (const mesh of meshes) mesh.skeleton.update();
    lowestSole.set(0, Infinity, 0);
    for (const { mesh, vertex } of leg.probes) {
      mesh.getVertexPosition(vertex, solePoint).applyMatrix4(mesh.matrixWorld);
      if (solePoint.y < lowestSole.y) { lowestSole.copy(solePoint); leg.lowestWitness = { mesh, vertex }; }
    }
    return lowestSole;
  }
  const reachHip = vector(), reachKnee = vector(), reachAnkle = vector();
  function constrainSwingTarget(leg, target) {
    // Limit only the added horizontal carry. Never extend a chain beyond the
    // authored target's reach requirement or change foot roll/contact masks.
    leg.hip.getWorldPosition(reachHip); leg.knee.getWorldPosition(reachKnee); leg.ankle.getWorldPosition(reachAnkle);
    const maximum = (reachHip.distanceTo(reachKnee) + reachKnee.distanceTo(reachAnkle)) * .997;
    const bx = leg.authoredTarget.x-reachHip.x, bz = leg.authoredTarget.z-reachHip.z;
    const dy = target.y-reachHip.y;
    const radiusSq = Math.max(bx*bx+bz*bz, maximum*maximum-dy*dy, 0);
    const dx = target.x-leg.authoredTarget.x, dz = target.z-leg.authoredTarget.z;
    const distanceSq = (bx+dx)**2+(bz+dz)**2, a = dx*dx+dz*dz;
    if (distanceSq <= radiusSq || a < 1e-12) return 1;
    const b = bx*dx+bz*dz, c = bx*bx+bz*bz-radiusSq;
    const fraction = THREE.MathUtils.clamp((-b+Math.sqrt(Math.max(0,b*b-a*c)))/a,0,1);
    target.x = leg.authoredTarget.x+dx*fraction;
    target.z = leg.authoredTarget.z+dz*fraction;
    return fraction;
  }
  const sourceFoot = vector(), sourceToe = vector(), targetFoot = vector(), targetToe = vector(), delta = vector(), currentToe = vector();
  return {
    prepare,
    restore() {
      root.position.y = baseRootY;
      if (!poseModified) return;
      for (const p of originalPose) { p.bone.position.copy(p.position); p.bone.quaternion.copy(p.quaternion); p.bone.scale.copy(p.scale); }
      poseModified = false;
    },
    update(dt, state, { dead = false } = {}) {
      if (dead) { clearContacts(); elapsedStill = 1; return; }
      const { speed, rate, stride } = parameters;
      const nextGait = parameters.gait;
      const oldGait = gait;
      if (nextGait !== gait) {
        const next = actions[nextGait];
        next.reset().setEffectiveWeight(1).play();
        // Preserve normalized phase between actual Walk and Run takes. Idle
        // transitions still retain their authored neutral contact.
        if (gait !== 'Idle' && nextGait !== 'Idle') next.time = current.time / current.getClip().duration * next.getClip().duration;
        current.fadeOut(.14); next.fadeIn(.14); current = next; gait = nextGait; clearContacts();
      }
      current.setEffectiveTimeScale(rate);
      driverMixer.update(dt); driver.updateMatrixWorld(true);
      elapsedStill = speed < .08 ? elapsedStill + dt : 0;
      model.updateWorldMatrix(true, true);
      // Reconnection/teleport must release stale anchors instead of stretching
      // legs across a network correction. The caller marks known discontinuities.
      if (state.teleport || dt > .12) clearContacts();
      metrics.gait = gait; metrics.timeScale = rate; metrics.strideScale = stride;
      metrics.speedMismatch = gait === 'Idle' ? 0 : speed - profiles[gait].nominalSpeed * rate * stride;
      if (elapsedStill > .2) { clearContacts(); metrics.footContacts = []; return; }
      for (const p of originalPose) { p.position.copy(p.bone.position); p.quaternion.copy(p.bone.quaternion); p.scale.copy(p.bone.scale); }
      poseModified = true;
      const spine = bones.Spine;
      tmp.spineWorld.copy(spine.matrixWorld);
      for (const name of lowerNames) {
        bones[name].position.copy(sourceBones[name].position);
        bones[name].quaternion.copy(sourceBones[name].quaternion);
        bones[name].scale.copy(sourceBones[name].scale);
      }
      model.updateMatrixWorld(true);
      // Hips and spine remain the authored full-body action. Only the leg
      // chains change, avoiding a translated spine stretching mixed cloth weights.
      model.getWorldQuaternion(tmp.parentQ);
      const authoredDirection = profiles[gait]?.direction || [0, 1];
      bodyForward.set(authoredDirection[0], 0, authoredDirection[1]).applyQuaternion(tmp.parentQ).setY(0).normalize();
      bodyRight.set(authoredDirection[1], 0, -authoredDirection[0]).applyQuaternion(tmp.parentQ).setY(0).normalize();
      moveForward.copy(bodyForward);
      if (state.velocity && Math.hypot(state.velocity.x || 0, state.velocity.z || 0) > .05) moveForward.set(state.velocity.x, 0, state.velocity.z).normalize();
      moveRight.set(moveForward.z, 0, -moveForward.x);
      const yaw = Math.atan2(moveForward.x, moveForward.z);
      if (lastYaw !== null && Math.abs(wrap(yaw - lastYaw)) > 1.15) clearContacts();
      lastYaw = yaw;
      bones.Hips.getWorldPosition(pelvis);
      const profile = profiles[gait], phase = current.time / current.getClip().duration;
      metrics.footContacts.length = 0;
      let pelvisDrop = 0;
      for (let f = 0; f < legs.length; f++) {
        const leg = legs[f];
        model.getWorldQuaternion(leg.desiredFootQ);
        sourceBones[`${leg.side}Foot`].getWorldQuaternion(tmp.rotation);
        leg.desiredFootQ.multiply(tmp.rotation);
        sourceBones[`${leg.side}Foot`].getWorldPosition(sourceFoot).applyMatrix4(model.matrixWorld);
        sourceBones[`${leg.side}ToeBase`].getWorldPosition(sourceToe).applyMatrix4(model.matrixWorld);
        sourceBones[`${leg.side}UpLeg`].getWorldPosition(pelvis).applyMatrix4(model.matrixWorld);
        delta.copy(sourceToe).sub(pelvis);
        const forward = delta.dot(bodyForward), lateral = delta.dot(bodyRight);
        targetToe.copy(pelvis).addScaledVector(moveForward, forward * stride).addScaledVector(moveRight, lateral); targetToe.y = sourceToe.y;
        targetFoot.copy(sourceFoot).add(delta.copy(targetToe).sub(sourceToe));
        const contact = gait !== 'Idle' && profile.contacts[f][Math.floor(phase * profile.contacts[f].length) % profile.contacts[f].length];
        const swing = profile?.swingClearance[f];
        const sample = phase * (swing?.length || 1), index = Math.floor(sample);
        leg.swingClearance = contact || !swing ? 0 : THREE.MathUtils.lerp(swing[index % swing.length], swing[(index + 1) % swing.length], sample - index);
        leg.authoredTarget.copy(targetFoot);
        leg.releasing = !contact && leg.previousContact && leg.initialized;
        if (leg.releasing) {
          // Preserve the last physical ankle correction when releasing the
          // world anchor. The authored swing subsequently absorbs this offset.
          leg.swingResidual.copy(leg.lastSolvedAnkle).sub(leg.lastAuthoredTarget).setY(0);
          metrics.recentFootReleases.push({ foot: leg.side.toLowerCase(), gait, phase,
            residual: leg.swingResidual.toArray(), magnitude: leg.swingResidual.length() });
          if (metrics.recentFootReleases.length > 8) metrics.recentFootReleases.shift();
        }
        const carry = profile?.swingCarry[f];
        leg.swingCarry = contact || !carry ? 0 : THREE.MathUtils.lerp(carry[index % carry.length], carry[(index + 1) % carry.length], sample - index);
        if (contact) leg.swingResidual.set(0, 0, 0);
        else targetFoot.addScaledVector(leg.swingResidual, leg.swingCarry);
        leg.carryReachFraction = contact ? 1 : constrainSwingTarget(leg, targetFoot);
        if (!contact) leg.locked = false;
        leg.target.copy(targetFoot); leg.contact = contact;
        const hip = leg.hip.getWorldPosition(tmp.a), knee = leg.knee.getWorldPosition(tmp.b), ankle = leg.ankle.getWorldPosition(tmp.c);
        const maximum = (hip.distanceTo(knee) + knee.distanceTo(ankle)) * .997;
        const horizontal = Math.hypot(hip.x - targetFoot.x, hip.z - targetFoot.z);
        if (horizontal < maximum) pelvisDrop = Math.max(pelvisDrop, hip.y - targetFoot.y - Math.sqrt(maximum * maximum - horizontal * horizontal));
      }
      // A small pelvis yield keeps a nearly straight supporting knee within
      // reach. The foot targets and upper-body/weapon poses stay in world space.
      pelvisDrop = THREE.MathUtils.clamp(pelvisDrop, 0, height * .045);
      metrics.pelvisDrop = pelvisDrop;
      if (pelvisDrop > 0) {
        root.position.y = baseRootY - pelvisDrop;
        root.updateMatrixWorld(true);
      }
      const groundY = Number.isFinite(state.groundY) ? state.groundY : root.parent.getWorldPosition(tmp.a).y;
      for (const leg of legs) {
        const contact = leg.contact;
        let reachError = solveLeg(leg, leg.target);
        let surface = sampleSole(leg);
        if (((contact && leg.locked) || leg.releasing) && leg.witness) {
          const { mesh, vertex } = leg.witness;
          mesh.skeleton.update();
          mesh.getVertexPosition(vertex, solePoint).applyMatrix4(mesh.matrixWorld);
          leg.target.x += leg.anchor.x - solePoint.x;
          leg.target.z += leg.anchor.z - solePoint.z;
          if (leg.releasing) leg.carryReachFraction = Math.min(leg.carryReachFraction,constrainSwingTarget(leg,leg.target));
          reachError = solveLeg(leg, leg.target);
          surface = sampleSole(leg);
          if (leg.releasing) {
            // Preserve the material witness at release: ankle continuity alone
            // ignores the displacement caused by authored foot roll.
            leg.ankle.getWorldPosition(leg.swingResidual).sub(leg.authoredTarget).setY(0);
            if (leg.swingCarry > 1e-5) leg.swingResidual.multiplyScalar(1 / leg.swingCarry);
            const release = metrics.recentFootReleases.at(-1);
            if (release) { release.resolvedResidual = leg.swingResidual.toArray(); release.witnessVertex = leg.witness.vertex; }
          }
        }
        // A released boot must clear the floor, not slide along a floor clamp.
        // This changes the solved knee/ankle path, never the authored support
        // mask, torso, skin weights, limb lengths, or ankle/toe roll.
        const minimumSoleY = groundY + .002 + leg.swingClearance;
        if (surface.y < minimumSoleY) {
          leg.target.y += minimumSoleY - surface.y;
          reachError = solveLeg(leg, leg.target);
          surface = sampleSole(leg);
        }
        if (contact && !leg.previousContact) {
          leg.anchor.copy(surface);
          leg.witness = leg.lowestWitness;
          leg.locked = true; leg.serial++; metrics.footPlantSerial++;
          metrics.recentFootPlants.push({ serial: metrics.footPlantSerial, foot: leg.side.toLowerCase(), position: leg.anchor.toArray(), gait });
          if (metrics.recentFootPlants.length > 4) metrics.recentFootPlants.shift();
        }
        if (contact && leg.locked && leg.witness) {
          const { mesh, vertex } = leg.witness;
          mesh.skeleton.update();mesh.getVertexPosition(vertex, solePoint).applyMatrix4(mesh.matrixWorld);
          // Heel-to-ball rollover changes the physical supporting patch. Keep
          // authored ankle/toe rotations and hand the anchor to the lower patch
          // only once the previous one has lifted clear of the sole plane.
          if (solePoint.y - surface.y > .012) { leg.anchor.copy(surface); leg.witness = leg.lowestWitness; }
        }
        if (reachError > .035) metrics.reachLimitCount++;
        leg.toe.getWorldPosition(currentToe);
        const drift = leg.initialized && contact && leg.previousContact ? Math.hypot(currentToe.x - leg.lastToe.x, currentToe.z - leg.lastToe.z) / Math.max(dt, 1e-6) : null;
        metrics.footContacts.push({ foot: leg.side.toLowerCase(), locked: leg.locked, contact, position: surface.toArray(), toePosition: currentToe.toArray(), horizontalDrift: drift, toeBoneHorizontalSpeed: drift, reachError, surfaceY: surface.y, minimumSwingClearance: leg.swingClearance,
          swingCarry: leg.swingCarry, carryReachFraction: leg.carryReachFraction, swingResidual: leg.swingResidual.toArray() });
        leg.ankle.getWorldPosition(leg.lastSolvedAnkle);
        leg.lastAuthoredTarget.copy(leg.authoredTarget);
        leg.lastToe.copy(currentToe); leg.initialized = true; leg.previousContact = contact;
      }
      metrics.upperBodyPoseError = Math.max(...spine.matrixWorld.elements.map((value, index) => Math.abs(value - tmp.spineWorld.elements[index] + (index === 13 ? pelvisDrop : 0))));
      if (oldGait !== gait && gait === 'Idle') clearContacts();
    },
    dispose() {
      driverMixer.stopAllAction(); driverMixer.uncacheRoot(driver);
      const skeletons = new Set(); driver.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
    },
  };
}
