import { loadGlb } from './load-glb.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';
import { measureOrcSupport, createOrcFootContacts } from './enemy-foot-contacts.js';
import { getEnemyControlState } from './enemy-control-state.js';

const orcUrl = new URL('../../assets/models/orc-peon-locomotion-v1.glb', import.meta.url).href;
const libraryPromises = new Map(), supportProfileCache = new Map();

/** Load once; each actor owns its skeleton/materials and shares geometry/textures. */
export async function loadEnemyLibrary({ THREE, contactCandidate = false, assetVersion = 1 } = {}) {
  if (!THREE) throw new TypeError('loadEnemyLibrary requires THREE');
  if (![1,2].includes(assetVersion)) throw new RangeError('Unknown Orc candidate version');
  const url = assetVersion === 2 ? new URL('../../assets/models/orc-peon-locomotion-v2.glb',import.meta.url).href : orcUrl;
  if (!libraryPromises.has(url)) libraryPromises.set(url,loadGlb(url).catch(error => { libraryPromises.delete(url); throw error; }));
  const source = await libraryPromises.get(url);
  for (const name of ['Idle', 'Walk', 'Run', 'Attack', 'Hit', 'Death']) {
    if (!source.animations.some(clip => clip.name === name)) throw new Error(`Orc GLB is missing ${name}`);
  }
  const contactImplementation = contactCandidate ? await import('./enemy-foot-contacts-candidate.js') : { measureOrcSupport, createOrcFootContacts };
  const profileKey=`${url}:${contactCandidate}`;
  if (!supportProfileCache.has(profileKey)) supportProfileCache.set(profileKey,contactImplementation.measureOrcSupport({ THREE, source, motion: source.scene.userData.bipxMotion }));
  const supportProfiles=supportProfileCache.get(profileKey);
  return {
    ids: ['orcPeon'],
    stats: { loaded: true, url, assetVersion, sharedGeometry: true, sharedMaterials: false, sharedTextures: true, clips: source.animations.map(clip => clip.name) },
    create(id, { parent, height = 2.35, yaw = Math.PI, phase = 0, footContacts = false } = {}) {
      if (id !== 'orcPeon') throw new RangeError(`Unknown enemy visual: ${id}`);
      if (!parent) throw new TypeError('Enemy visual requires a parent Object3D');
      const model = cloneSkeleton(source.scene), root = new THREE.Group();
      const materialCopies = new Map();
      const actorMaterial = material => {
        if (!materialCopies.has(material)) materialCopies.set(material, material.clone());
        return materialCopies.get(material);
      };
      root.name = 'OrcPeonVisual'; root.add(model); model.rotation.y = yaw;
      model.traverse(object => {
        if (!object.isMesh) return;
        object.material = Array.isArray(object.material) ? object.material.map(actorMaterial) : actorMaterial(object.material);
        object.castShadow = true; object.receiveShadow = true;
        if (object.isSkinnedMesh) object.frustumCulled = false;
      });
      const mixer = new THREE.AnimationMixer(model);
      const actions = Object.fromEntries(source.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
      let current = actions.Idle, dead = false, oneShot = false, speed = 0, disposed = false;
      current.play(); mixer.update(0); model.updateMatrixWorld(true);
      const body = model.getObjectByName('OrcBody'); body.skeleton.update();
      const bounds = new THREE.Box3().setFromObject(body, true), size = bounds.getSize(new THREE.Vector3());
      root.scale.setScalar(height / size.y); model.position.y -= bounds.min.y; parent.add(root);
      const stats = { loaded: true, id, source: 'OrcPeasantMiner Animation Master', currentClip: 'Idle', animationTime: 0, bones: body.skeleton.bones.length, sourceHeight: size.y, runtimeHeight: height, clips: source.animations.map(clip => ({ name: clip.name, duration: clip.duration })) };
      const motion = source.scene.userData.bipxMotion;
      const gaitSpeed = { Walk: motion.walkSpeed * root.scale.x,
        Run: motion.runStride * root.scale.x / actions.Run.getClip().duration };
      Object.assign(stats, { nominalGaitSpeed: gaitSpeed, motionSource: motion.source,
        animationTimeScale: 1, gaitSpeedMismatch: 0 });
      const footSupport = contactImplementation.createOrcFootContacts({ THREE, model, root, stats, profiles: supportProfiles, enabled: footContacts });
      // Hysteresis avoids toggling at the walk/run boundary during steering.
      const locomotion = () => {
        if (speed <= .08) return 'Idle';
        const threshold = gaitSpeed.Walk * (stats.currentClip === 'Run' ? 1.25 : 1.5);
        return speed > threshold ? 'Run' : 'Walk';
      };
      function transition(name, fade = .12, { once = false, duration } = {}) {
        const next = actions[name];
        if (next === current && !once) return;
        next.reset().setEffectiveWeight(1).setEffectiveTimeScale(duration ? next.getClip().duration / duration : 1);
        next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); next.clampWhenFinished = once;
        if (next !== current) current.fadeOut(fade);
        next.fadeIn(fade).play(); current = next; oneShot = once; stats.currentClip = name;
      }
      function finished({ action }) {
        if (disposed || dead || action !== current) return;
        oneShot = false; transition(locomotion());
      }
      mixer.addEventListener('finished', finished);
      const controller = {
        root, model, weapon: model.getObjectByName('OrcSickle'), stats,
        update(dt, state = {}) {
          if (disposed) return;
          stats.control = getEnemyControlState(state);
          if (stats.control.paused) return;
          footSupport.restore();
          speed = Math.max(0, Number(state.speed) || 0);
          if (Boolean(state.dead) !== dead) {
            dead = Boolean(state.dead); transition(dead ? 'Death' : locomotion(), .1, { once: dead });
            if (!dead) oneShot = false;
          }
          if (!dead && !oneShot) {
            transition(locomotion());
            const nominal = gaitSpeed[stats.currentClip];
            if (nominal) {
              const rate = THREE.MathUtils.clamp(speed / nominal, .05, stats.currentClip === 'Walk' ? 1.5 : 2);
              current.setEffectiveTimeScale(rate);
              stats.gaitSpeedMismatch = speed - nominal * rate;
            } else stats.gaitSpeedMismatch = 0;
          }
          mixer.update(THREE.MathUtils.clamp(Number(dt) || 0, 0, .1)); stats.animationTime = current.time;
          stats.animationTimeScale = current.getEffectiveTimeScale();
          footSupport.update(Math.max(0, Number(dt) || 0), state, { clip: stats.currentClip, time: current.time, active: !dead && !oneShot && speed > .08 });
        },
        attack({ duration = .85 } = {}) { if (!dead && !disposed && !stats.control?.paused) transition('Attack', .06, { once: true, duration }); },
        hit() { if (!dead && !disposed && !oneShot && !stats.control?.paused) transition('Hit', .055, { once: true, duration: .3 }); },
        reset({ phase: startPhase = 0 } = {}) {
          if (disposed) return;
          footSupport.reset();
          mixer.stopAllAction(); dead = false; oneShot = false; speed = 0;
          stats.control = getEnemyControlState();
          current = actions.Idle.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopRepeat, Infinity);
          current.clampWhenFinished = false; current.time = Math.max(0, startPhase) % current.getClip().duration;
          for (const [original, material] of materialCopies) {
            material.color?.copy(original.color);
            material.emissive?.copy(original.emissive);
            material.emissiveIntensity = original.emissiveIntensity;
            material.opacity = original.opacity;
            material.transparent = original.transparent;
            material.depthWrite = original.depthWrite;
          }
          current.play(); mixer.update(0); root.visible = true; stats.currentClip = 'Idle'; stats.animationTime = current.time; stats.animationTimeScale = 1; stats.gaitSpeedMismatch = 0;
        },
        dispose() {
          if (disposed) return;
          footSupport.reset();
          disposed = true; mixer.removeEventListener('finished', finished); mixer.stopAllAction(); mixer.uncacheRoot(model);
          model.traverse(object => { if (object.isSkinnedMesh) object.skeleton.dispose(); });
          for (const material of materialCopies.values()) material.dispose();
          materialCopies.clear();
          root.removeFromParent(); // Shared prototype geometry/textures remain cached.
        },
      };
      controller.reset({ phase });
      return controller;
    },
  };
}
