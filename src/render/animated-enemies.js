import { createVisualMotion, sampleVisualMotion } from './visual-motion.js';
import { getEnemyControlState } from '../assets/enemy-control-state.js';
import { createEnemyDeathCut } from '../assets/enemy-death-cut.js';

// A small skeleton pool sits above the existing horde LOD renderer. Gameplay
// entities retain their authoritative position, collision and damage rules.
export function createAnimatedEnemies({ THREE, scene }) {
  const libraries = new Map(), entries = [], attached = new Map(), corpses = [];
  const candidates = [], wanted = new Set();
  const cutCorpses = [];
  let cutEvents = 0;
  const profiles = {
    orcPeon: { library: 'orc', id: 'orcPeon', height: 2.5 },
    zombie: { library: 'monsters', id: 'zombie', height: 2.55 },
    runner: { library: 'monsters', id: 'zombie', height: 2.3 },
    brute: { library: 'monsters', id: 'brute', height: 3.3 },
    caster: { library: 'monsters', id: 'lich', height: 2.8, castProfileId: 'lich-mixamo-cast-v1' },
    visor: { library: 'monsters', id: 'lich', height: 3.5 },
  };
  let limit = 20;

  function restoreMaterials(entry) {
    for (const state of entry.materials) {
      const material = state.material;
      material.opacity = state.opacity;
      if (material.transparent !== state.transparent) {
        material.transparent = state.transparent; material.needsUpdate = true;
      }
      if (state.emissive) material.emissive.copy(state.emissive);
    }
    entry.flash = 0;
  }
  function recycle(entry) {
    entry.controller.root.removeFromParent();
    entry.controller.root.position.set(0, 0, 0);
    entry.controller.root.quaternion.identity();
    entry.controller.root.scale.copy(entry.scale);
    entry.controller.reset(); restoreMaterials(entry);
    entry.owner = null; entry.corpse = false;
  }
  function detach(zombie) {
    const entry = attached.get(zombie);
    if (!entry) return null;
    attached.delete(zombie);
    delete zombie.mesh.userData.animatedEnemy;
    const proxy = zombie.mesh.userData.lodProxy;
    const useProxy = zombie.renderMode === 'proxy';
    for (const [child, visible] of entry.fallback) {
      if (child === proxy) child.visible = useProxy;
      else if (zombie.mesh.userData.detailChildren?.includes(child)) child.visible = !useProxy && (!child.userData.eliteMarker || child.userData.eliteActive);
      else child.visible = visible;
    }
    zombie.mesh.userData.lodState = proxy ? (useProxy ? 'proxy' : 'detail') : null;
    zombie.shadowEnabled = null;
    entry.owner = null;
    return entry;
  }
  function acquire(zombie) {
    const profile = profiles[zombie.type], library = libraries.get(profile?.library);
    if (!library) return null;
    let entry = entries.find(item => !item.owner && !item.corpse && item.key === zombie.type);
    if (!entry) {
      if (entries.length >= limit) {
        const obsolete = entries.findIndex(item => !item.owner && !item.corpse);
        if (obsolete < 0) return null;
        entries.splice(obsolete, 1)[0].controller.dispose();
      }
      const controller = library.create(profile.id, { parent: zombie.mesh, height: profile.height, phase: zombie.wobble, castProfileId: profile.castProfileId || null });
      const materials = new Set();
      controller.root.traverse(mesh => {
        if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
      });
      entry = { controller, key: zombie.type, scale: controller.root.scale.clone(), materials: [...materials].map(material => ({
        material, opacity: material.opacity, transparent: material.transparent, emissive: material.emissive?.clone(),
      })), flash: 0, corpse: false, motion: createVisualMotion() };
      entries.push(entry);
    }
    entry.owner = zombie;
    entry.fallback = zombie.mesh.children.filter(child => child !== entry.controller.root).map(child => [child, child.visible]);
    entry.motion.initialized = false;
    entry.attackTimer = 0;
    zombie.mesh.add(entry.controller.root);
    zombie.mesh.userData.animatedEnemy = entry.controller;
    zombie.mesh.position.y = 0;
    zombie.shadowEnabled = null;
    attached.set(zombie, entry);
    return entry;
  }
  function remove(zombie, { death = false, deathStyle = zombie.deathStyle, killedBySkillId = zombie.killedBySkillId, deathDirection = zombie.deathDirection, direction = deathDirection } = {}) {
    const entry = detach(zombie);
    const dashDeath = deathStyle === 'cleave' && (!killedBySkillId || killedBySkillId === 'warrior_cleaving_dash');
    if (death && (dashDeath || deathStyle === 'bisect' && killedBySkillId === 'warrior_cleaving_dash')) {
      if (entry) { scene.attach(entry.controller.root); restoreMaterials(entry); }
      // Capture actual rendered pose before the gameplay entity/pool is reused.
      // No corpse timer owns or mutates the original live rig after this point.
      const cut = createEnemyDeathCut({ THREE, scene, source: entry?.controller.root || zombie.mesh, direction, hideSource: false });
      if (cut) {
        if (cutCorpses.length >= 24) cutCorpses.shift().cut.dispose();
        cutCorpses.push({ cut, age: 0, type: zombie.type, entityId: zombie.id });
        cutEvents++;
      }
      if (entry) recycle(entry);
      return;
    }
    if (!entry) return;
    if (death && corpses.length < Math.max(2, Math.floor(limit / 5))) {
      scene.attach(entry.controller.root);
      restoreMaterials(entry);
      entry.corpse = true; entry.age = 0;
      entry.duration = Math.min(5, entry.controller.stats.clips.find(clip => clip.name === 'Death')?.duration || 2.4);
      entry.controller.update(0, { dead: true, speed: 0 });
      corpses.push(entry);
    } else recycle(entry);
  }
  function syncCast(zombie, attack = zombie.casterCastVisual) {
    const entry = attached.get(zombie);
    if (zombie.type !== 'caster' || !entry?.controller.stats.castProfile) return false;
    entry.controller.update(0, { ...entry.motion, ...getEnemyControlState(zombie), attack, paused: attack?.paused });
    return true;
  }
  function getCastEmitter(zombie, { castId } = {}) {
    const controller = attached.get(zombie)?.controller;
    if (castId == null || !controller?.castSocket || !controller.stats.attack || controller.stats.attack.id !== castId || zombie.type !== 'caster') return null;
    controller.root.updateWorldMatrix(true, true);
    const position = controller.castSocket.getWorldPosition(new THREE.Vector3());
    return { profileId: controller.stats.castProfile.id, castId, socket: 'L_Hand',
      position: { x: position.x, y: position.y, z: position.z }, elapsed: controller.stats.attack.elapsed };
  }
  function update(zombies, { dt, playerPosition, mobile = false, quality = 'high' }) {
    limit = mobile ? 10 : 20;
    candidates.length = 0; wanted.clear();
    for (const zombie of zombies) {
      const profile = profiles[zombie.type];
      if (!profile || !libraries.has(profile.library) || zombie.renderMode !== 'detail' || !zombie.mesh.visible) continue;
      const dx = zombie.mesh.position.x - playerPosition.x, dz = zombie.mesh.position.z - playerPosition.z;
      zombie.visualDistanceSq = dx * dx + dz * dz;
      candidates.push(zombie);
    }
    // Incumbents retain their slot until a newcomer is meaningfully closer.
    // Centimetre-scale ordering changes must not rebuild skinned actors.
    candidates.sort((a, b) => a.visualDistanceSq * (attached.has(a) ? .72 : 1) - b.visualDistanceSq * (attached.has(b) ? .72 : 1));
    for (let i = 0; i < Math.min(candidates.length, limit - corpses.length); i++) wanted.add(candidates[i]);
    for (const [zombie] of attached) if (!wanted.has(zombie)) remove(zombie);
    while (entries.length > limit) {
      const index = entries.findIndex(entry => !entry.owner && !entry.corpse);
      if (index < 0) break;
      entries.splice(index, 1)[0].controller.dispose();
    }
    for (const zombie of wanted) {
      const entry = attached.get(zombie) || acquire(zombie);
      if (!entry) continue;
      for (const [child] of entry.fallback) child.visible = Boolean(child.userData.eliteMarker && child.userData.eliteActive);
      const controller = entry.controller;
      const control = getEnemyControlState(zombie);
      entry.control = control;
      controller.root.visible = true;
      const position = zombie.mesh.position;
      sampleVisualMotion(entry.motion, position, dt);
      entry.motion.dead = false;
      position.y = 0;
      const attack = zombie.type === 'caster' ? zombie.casterCastVisual : zombie.meleeAttack;
      if (dt === 0 && controller.stats.supportsPhaseAttack && attack) {
        controller.update(0, { ...entry.motion, ...control, attack, paused: attack.paused });
      }
      if (dt > 0) {
        entry.attackTimer -= dt;
        if (!control.paused && zombie.serverControlled && !controller.stats.supportsPhaseAttack && zombie.visualDistanceSq < (zombie.radius + 1.1) ** 2 && entry.attackTimer <= 0) {
          controller.attack({ duration: .65 }); entry.attackTimer = .9;
        }
        controller.update(dt, { ...entry.motion, ...control,
          ...(controller.stats.supportsPhaseAttack && attack ? { attack, paused: attack.paused } : {}),
        });
        entry.flash = Math.max(0, entry.flash - dt);
        for (const state of entry.materials) if (state.emissive) {
          state.material.emissive.copy(state.emissive);
          if (entry.flash > 0) state.material.emissive.addScalar(entry.flash * 1.8);
        }
      }
      const shadows = quality !== 'low' && zombie.visualDistanceSq < (quality === 'high' ? 24 : 13) ** 2;
      controller.root.traverse(mesh => {
        if (mesh.isMesh) { mesh.castShadow = shadows; mesh.receiveShadow = shadows && quality === 'high'; }
      });
    }
    for (let i = corpses.length - 1; i >= 0; i--) {
      const entry = corpses[i]; entry.age += dt;
      entry.controller.update(dt, { speed: 0, dead: true });
      const position = entry.controller.root.position;
      const distanceSq = (position.x - playerPosition.x) ** 2 + (position.z - playerPosition.z) ** 2;
      const shadows = quality !== 'low' && distanceSq < (quality === 'high' ? 24 : 13) ** 2;
      entry.controller.root.traverse(mesh => {
        if (mesh.isMesh) { mesh.castShadow = shadows; mesh.receiveShadow = shadows && quality === 'high'; }
      });
      const opacity = Math.max(0, Math.min(1, (entry.duration + .4 - entry.age) / .4));
      if (opacity < 1) for (const state of entry.materials) {
        if (!state.material.transparent) { state.material.transparent = true; state.material.needsUpdate = true; }
        state.material.opacity = state.opacity * opacity;
      }
      if (entry.age >= entry.duration + .4) { corpses.splice(i, 1); recycle(entry); }
    }
    for (let i = cutCorpses.length - 1; i >= 0; i--) {
      const entry = cutCorpses[i]; entry.age += Math.max(0, dt);
      entry.cut.update(dt, { quality });
      if (entry.age >= 1.65) { entry.cut.dispose(); cutCorpses.splice(i, 1); }
    }
  }
  return {
    register(name, library) { libraries.set(name, library); },
    update, remove, syncCast, getCastEmitter,
    hit(zombie) { const entry = attached.get(zombie); if (entry) { if (!getEnemyControlState(zombie).paused) entry.controller.hit(); entry.flash = .12; } },
    attack(zombie, duration = .65) { if (!getEnemyControlState(zombie).paused) attached.get(zombie)?.controller.attack({ duration }); },
    clear() { for (const [zombie] of attached) remove(zombie); for (const entry of corpses) recycle(entry); corpses.length = 0; for (const entry of cutCorpses) entry.cut.dispose(); cutCorpses.length = 0; },
    getStats() { return { loaded: libraries.size > 0, libraries: [...libraries.keys()], limit, allocated: entries.length,
      active: attached.size, corpses: corpses.length, cutCorpses: cutCorpses.length, cutEvents,
      actors: [...attached].map(([zombie, entry]) => ({ ...entry.controller.stats, entityId: zombie.id, type: zombie.type,
        position: { x: zombie.mesh.position.x, y: zombie.mesh.position.y, z: zombie.mesh.position.z } })),
      corpseActors: corpses.map(entry => ({ type: entry.key, currentClip: entry.controller.stats.currentClip,
        animationTime: entry.controller.stats.animationTime, age: entry.age })),
    }; },
  };
}
