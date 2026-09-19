// Shared CPU/browser fixture. Only reads the frozen handoff-01 full clips.
import * as THREE from '../vendor/three/three.module.js';
import {createHeroLocomotion} from '../src/assets/hero-locomotion.js';

export const DURATION = 1.45;
export function refresh(root) {
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
}

export function makePair({brute, hero, id, probes, profile}) {
  const stage = new THREE.Group(), bruteRoot = new THREE.Group(), model = brute.scene;
  bruteRoot.add(model); model.rotation.y = Math.PI / 2;
  let body; model.traverse(o => { if (o.isSkinnedMesh) body = o; });
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(brute.animations[0]).play();
  mixer.update(0); refresh(bruteRoot);
  const box = new THREE.Box3().setFromObject(model, true);
  bruteRoot.scale.setScalar(3.3 / box.getSize(new THREE.Vector3()).y);
  model.position.y = -box.min.y;
  const clip = brute.animations.find(c => c.name === 'Attack');
  if (Math.abs(clip.duration - DURATION) > 1e-6) throw Error('Full Attack duration mismatch');
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;

  // Same normalization/Idle0/foot-probe call sequence as the CPU fit fixture.
  const target = new THREE.Group(), heroRoot = new THREE.Group(), heroModel = hero.scene;
  target.add(heroRoot); heroRoot.add(heroModel);
  heroModel.rotation.y = id === 'warrior' ? Math.PI : Math.PI - .0653;
  target.rotation.y = Math.PI;
  const hm = new THREE.AnimationMixer(heroModel);
  hm.clipAction(hero.animations.find(c => c.name === 'Idle')).play(); hm.update(0); refresh(target);
  const hb = new THREE.Box3().setFromObject(heroModel, true);
  heroRoot.scale.setScalar(profile.targetHeight / hb.getSize(new THREE.Vector3()).y);
  heroModel.position.y -= hb.min.y; refresh(target);
  const motion = createHeroLocomotion({THREE, model: heroModel, root: heroRoot,
    clips: hero.animations, directional: [], stats: {}, height: profile.targetHeight, characterId: id});
  const state = {velocity: {x: 0, z: 0}, groundY: 0};
  motion.prepare(0, state); motion.restore(); hm.update(0); motion.update(0, state, {dead: false});
  target.position.fromArray(profile.fixedTargetCenter);
  stage.add(bruteRoot, target);
  stage.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  let time = 0;
  function ground() {
    refresh(stage);
    const inv = model.matrixWorld.clone().invert(), p = new THREE.Vector3(); let min = Infinity;
    for (const i of probes) {
      body.getVertexPosition(i, p).applyMatrix4(body.matrixWorld).applyMatrix4(inv);
      min = Math.min(min, p.y);
    }
    model.position.y = -min; refresh(stage);
  }
  function seek(t) {
    time = Math.max(0, Math.min(DURATION, t));
    mixer.stopAllAction(); action.reset().play(); mixer.setTime(time); ground();
  }
  function advance(dt) {
    const step = Math.min(Math.max(0, dt), DURATION - time);
    time += step; mixer.update(step); ground();
  }
  function positions(mesh, neutralTarget = false) {
    refresh(stage); const inv = stage.matrixWorld.clone().invert();
    return Array.from({length: mesh.geometry.attributes.position.count}, (_, i) => {
      const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
      if (neutralTarget) p.z += 1.89;
      return p.toArray();
    });
  }
  function snapshot() {
    const inv = stage.matrixWorld.clone().invert();
    const bone = n => model.getObjectByName(n).getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).toArray();
    return {time, centerDistance: bruteRoot.position.distanceTo(target.position),
      targetCenter: target.position.toArray(), targetWorldCenter: target.getWorldPosition(new THREE.Vector3()).toArray(),
      bruteWorldCenter: bruteRoot.getWorldPosition(new THREE.Vector3()).toArray(),
      bruteScale: bruteRoot.scale.x, heroScale: heroRoot.scale.x, modelY: model.position.y,
      joints: Object.fromEntries(['Hip','Head','R_Upperarm','R_Forearm','R_Hand','L_Foot','R_Foot'].map(n => [n, bone(n)]))};
  }
  seek(0);
  return {stage, model, body, target, heroModel, clip, seek, advance, positions, snapshot,
    dispose() { motion.dispose(); mixer.stopAllAction(); hm.stopAllAction(); }};
}
