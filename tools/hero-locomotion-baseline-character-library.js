import { loadGlb } from '../src/assets/load-glb.js';
import { clone as cloneSkeleton } from '../src/assets/vendor/SkeletonUtils.js';

const heroUrl = new URL('../../assets/models/aldric-hero.glb', new URL('../src/assets/character-library.js', import.meta.url).href).href;
let heroPromise;

/** Visual-only character: the caller retains ownership of collision and movement. */
export async function loadHeroVisual({ THREE, parent, height = 2.4, yaw = Math.PI } = {}) {
  if (!THREE || !parent) throw new TypeError('loadHeroVisual requires THREE and a parent Object3D');
  heroPromise ??= loadGlb(heroUrl).catch(error => { heroPromise = null; throw error; });
  const source = await heroPromise;
  const model = cloneSkeleton(source.scene);
  const root = new THREE.Group();
  root.name = 'AldricHeroVisual';
  root.add(model);
  model.rotation.y = yaw;
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    // Skeleton bounds change with motion; a small hero must not disappear mid-swing.
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(source.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
  if (!actions.Idle || !actions.Run || !actions.Attack || !actions.Death) {
    throw new Error('Hero GLB is missing required runtime animations');
  }
  let current = actions.Idle;
  current.play();
  mixer.update(0);
  model.updateMatrixWorld(true);
  model.traverse(object => { if (object.isSkinnedMesh) object.skeleton.update(); });
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = height / size.y;
  root.scale.setScalar(scale);
  model.position.y -= bounds.min.y;
  parent.add(root);

  let oneShot = false;
  let dead = false;
  let speed = 0;
  let disposed = false;
  const stats = {
    loaded: true,
    url: heroUrl,
    source: 'Aldric Leonguard / evaluated Mixamo skeleton',
    clips: source.animations.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length })),
    sourceHeight: size.y,
    runtimeHeight: height,
    currentClip: 'Idle',
    animationTime: 0,
    skinnedMeshes: 0,
    bones: 0,
  };
  model.traverse(object => { if (object.isSkinnedMesh) { stats.skinnedMeshes++; stats.bones += object.skeleton.bones.length; } });

  function transition(name, duration = .16, { once = false, playbackDuration } = {}) {
    const next = actions[name] || actions.Idle;
    if (next === current && !once) return;
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(playbackDuration ? next.getClip().duration / playbackDuration : 1);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    if (next !== current) current.fadeOut(duration);
    next.fadeIn(duration).play();
    current = next;
    stats.currentClip = name;
    oneShot = once;
  }
  const locomotion = () => speed > .12 ? (speed < 2.3 ? 'Walk' : 'Run') : 'Idle';
  const finished = ({ action }) => {
    if (action !== current || dead || disposed) return;
    oneShot = false;
    transition(locomotion(), .14);
  };
  mixer.addEventListener('finished', finished);
  return {
    root,
    model,
    weapon: model.getObjectByName('HeroSword'),
    shield: model.getObjectByName('HeroShield'),
    stats,
    attack({ duration = .48, heavy = false } = {}) {
      if (!dead && !disposed) transition(heavy ? 'AttackHeavy' : 'Attack', .065, { once: true, playbackDuration: duration });
    },
    hit() {
      if (!dead && !disposed && !oneShot) transition('Hit', .07, { once: true, playbackDuration: .32 });
    },
    update(dt, state = {}) {
      if (disposed) return;
      speed = Math.max(0, Number(state.speed) || 0);
      if (Boolean(state.dead) !== dead) {
        dead = Boolean(state.dead);
        transition(dead ? 'Death' : locomotion(), .12, { once: dead });
        if (!dead) oneShot = false;
      }
      if (!oneShot && !dead) {
        transition(locomotion());
        if (stats.currentClip === 'Run') current.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 5, .8, 1.6));
        if (stats.currentClip === 'Walk') current.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 1.8, .7, 1.3));
      }
      mixer.update(Math.min(Math.max(Number(dt) || 0, 0), .1));
      stats.animationTime = current.time;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.removeEventListener('finished', finished);
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      const skeletons = new Set();
      model.traverse(object => { if (object.isSkinnedMesh) skeletons.add(object.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
      root.removeFromParent();
      // Mesh geometry and textures are shared by cached prototypes.
    },
  };
}

const environmentNames = ['cedar-tree', 'lantern-post', 'rune-portal', 'ruined-wall'];
let environmentPromise;

/** Shared geometry, textures and material variants keep repeated props lightweight. */
export async function loadEnvironmentLibrary({ THREE } = {}) {
  if (!THREE) throw new TypeError('loadEnvironmentLibrary requires THREE');
  environmentPromise ??= Promise.all(environmentNames.map(async name => {
    const gltf = await loadGlb(new URL(`../../assets/models/${name}.glb`, new URL('../src/assets/character-library.js', import.meta.url).href).href);
    return [name, gltf.scene];
  })).then(Object.fromEntries).catch(error => { environmentPromise = null; throw error; });
  const prototypes = await environmentPromise;
  const tintMaterials = new Map();
  return {
    ready: true,
    names: [...environmentNames],
    instantiate(name, { height, width, tint, castShadow = true } = {}) {
      const prototype = prototypes[name];
      if (!prototype) throw new Error(`Unknown environment asset: ${name}`);
      const model = prototype.clone(true);
      const root = new THREE.Group();
      root.name = name;
      root.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(box.getCenter(new THREE.Vector3()));
      model.position.y += size.y / 2;
      // The supplied rune portal is a horizontal ground disc, not a vertical arch.
      const desiredHeight = height ?? (name === 'ruined-wall' ? 2 : 4);
      const desiredWidth = width ?? (name === 'rune-portal' ? 4 : undefined);
      root.scale.setScalar(desiredWidth ? desiredWidth / Math.max(size.x, size.z, .001) : desiredHeight / Math.max(size.y, .001));
      model.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = castShadow;
        object.receiveShadow = true;
        if (tint !== undefined) {
          const tintMaterial = material => {
            const tintColor = new THREE.Color(tint);
            const key = `${material.uuid}:${tintColor.getHexString()}`;
            if (!tintMaterials.has(key)) {
              const copy = material.clone();
              copy.color.multiply(tintColor);
              tintMaterials.set(key, copy);
            }
            return tintMaterials.get(key);
          };
          object.material = Array.isArray(object.material) ? object.material.map(tintMaterial) : tintMaterial(object.material);
        }
      });
      return root;
    },
  };
}
