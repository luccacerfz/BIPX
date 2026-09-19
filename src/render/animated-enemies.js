import { createVisualMotion, sampleVisualMotion } from './visual-motion.js';
import { getEnemyControlState } from '../assets/enemy-control-state.js';
import { captureDeathCutSnapshot, createEnemyDeathCut } from '../assets/enemy-death-cut.js';
import { createDeathCutBrowserWorker } from '../assets/death-cut-worker-client.js';
import { HIT_FEEDBACK } from './hit-feedback.js';

// A small skeleton pool sits above the existing horde LOD renderer. Gameplay
// entities retain their authoritative position, collision and damage rules.
export function createAnimatedEnemies({ THREE, scene, cutBudgets = null, deathCutWorker = null, asyncCuts = true }) {
  const libraries = new Map(), entries = [], attached = new Map(), corpses = [];
  const candidates = [], wanted = new Set();
  const cutCorpses = [];
  const ownsWorker = !deathCutWorker && asyncCuts;
  const browserRuntime = typeof window !== 'undefined' || typeof document !== 'undefined';
  let worker = deathCutWorker || (asyncCuts ? createDeathCutBrowserWorker() : null);
  const asyncQueueLimit = { high: 4, low: 2 };
  const pendingCuts = new Map();
  let asyncSequence = 0, asyncGeneration = 0, asyncSubmitted = 0, asyncAccepted = 0, asyncFallback = 0, asyncErrors = 0, asyncCancelled = 0, asyncCommitsThisWindow = 0, asyncLastError = null;
  let asyncLatency = [];
  const asyncResults = [];
  const cutResources = { triangles: 0, meshes: 0, geometries: 0, materials: 0, skeletons: 0 };
  const cutResourceKeys = Object.keys(cutResources);
  const defaultCutLimits = {
    high: { count: 24, triangles: 180000, meshes: 320, geometries: 320, materials: 640, skeletons: 160 },
    low: { count: 8, triangles: 60000, meshes: 120, geometries: 120, materials: 240, skeletons: 60 },
  };
  const cutLimits = {
    high: { ...defaultCutLimits.high, ...(cutBudgets?.high || {}) },
    low: { ...defaultCutLimits.low, ...(cutBudgets?.low || {}) },
  };
  const cutCreationLimits = { high: 2, low: 1 };
  let cutEvents = 0, cutEvictions = 0, cutRejected = 0, cutSequence = 0, cutQuality = 'high', cutCreationsThisWindow = 0;
  const profiles = {
    orcPeon: { library: 'orc', id: 'orcPeon', height: 2.5 },
    zombie: { library: 'monsters', id: 'zombie', height: 2.55 },
    runner: { library: 'monsters', id: 'zombie', height: 2.3 },
    brute: { library: 'monsters', id: 'brute', height: 3.3 },
    caster: { library: 'monsters', id: 'lich', height: 2.8, castProfileId: 'lich-mixamo-cast-v1' },
    visor: { library: 'monsters', id: 'lich', height: 3.5 },
  };
  let limit = 20;

  function cutBudget() { return cutLimits[cutQuality] || cutLimits.high; }
  function hasUsableCutBudget() { return cutResourceKeys.every(key => Number(cutBudget()[key]) > 0); }
  function changeCutResources(cost, direction) {
    for (const key of cutResourceKeys) cutResources[key] += direction * (Number(cost?.[key]) || 0);
  }
  function disposeCutEntry(entry) {
    entry.cut.dispose();
    changeCutResources(entry.resources, -1);
  }
  function trimCutsToBudget() {
    const budget = cutBudget();
    while (cutCorpses.length > budget.count || cutResourceKeys.some(key => cutResources[key] > budget[key])) {
      const oldest = cutCorpses.shift();
      if (!oldest) break;
      disposeCutEntry(oldest); cutEvictions++;
    }
  }
  function admitCut(cut, zombie, age = 0) {
    const resources = cut.diagnostics.resourceCost;
    const budget = cutBudget();
    if (cutResourceKeys.some(key => (Number(resources?.[key]) || 0) > budget[key])) {
      cutRejected++;
      cut.dispose();
      return false;
    }
    while (cutCorpses.length >= budget.count || cutResourceKeys.some(key => cutResources[key] + (Number(resources?.[key]) || 0) > budget[key])) {
      const oldest = cutCorpses.shift();
      if (!oldest) break;
      disposeCutEntry(oldest); cutEvictions++;
    }
    if (cutCorpses.length >= budget.count || cutResourceKeys.some(key => cutResources[key] + (Number(resources?.[key]) || 0) > budget[key])) {
      cutRejected++;
      cut.dispose();
      return false;
    }
    const entry = { cut, age: Math.max(0, Number(age) || 0), type: zombie.type, entityId: zombie.id, sequence: ++cutSequence, resources };
    cutCorpses.push(entry); changeCutResources(resources, 1); cutEvents++;
    return true;
  }

  function recordAsyncLatency(started) {
    const value = Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - started);
    asyncLatency.push(value);
    if (asyncLatency.length > 128) asyncLatency.shift();
    return value;
  }
  function snapshotTransferables(snapshot) {
    const transfer = [];
    for (const mesh of snapshot.meshes) {
      if (mesh.worldMatrix?.buffer) transfer.push(mesh.worldMatrix.buffer);
      if (mesh.boneMatrices?.buffer) transfer.push(mesh.boneMatrices.buffer);
    }
    return transfer;
  }
  function retainCorpse(entry, zombie, pendingKey = null) {
    scene.attach(entry.controller.root);
    restoreMaterials(entry);
    entry.corpse = true; entry.age = 0; entry.pendingCut = pendingKey;
    entry.duration = Math.min(5, entry.controller.stats.clips.find(clip => clip.name === 'Death')?.duration || 2.4);
    entry.controller.update(0, { dead: true, speed: 0 });
    corpses.push(entry);
    return entry;
  }
  function settleAsyncFallback(item, reason = 'fallback', error = null) {
    if (!item || item.settled) return;
    item.settled = true; pendingCuts.delete(item.key);
    if (item.entry) item.entry.pendingCut = null;
    asyncFallback++;
    if (reason === 'error') asyncErrors++;
    if (error) asyncLastError = String(error?.stack || error);
    if (reason === 'cancel') asyncCancelled++;
  }
  function finishAsyncCut(item, prepared) {
    if (!item || item.settled) return;
    item.settled = true; pendingCuts.delete(item.key);
    const entry = item.entry;
    if (item.generation !== asyncGeneration || !entry.corpse || !corpses.includes(entry)) { asyncLastError = `stale generation=${item.generation}/${asyncGeneration} corpse=${entry.corpse} listed=${corpses.includes(entry)}`; asyncFallback++; return; }
    if (entry.age >= (cutQuality === 'low' ? 4 : 8)) { asyncLastError = `expired age=${entry.age}`; asyncFallback++; entry.pendingCut = null; return; }
    let cut = null;
    try {
      cut = createEnemyDeathCut({ THREE, scene, source: item.snapshot.root, snapshot: item.snapshot,
        prepared, direction: item.snapshot.direction, hideSource: false, groundY: item.snapshot.groundY,
        lifetime: cutQuality === 'low' ? 4 : 8 });
      if (!cut) { asyncLastError = 'prepared result was not admissible to createEnemyDeathCut'; asyncFallback++; return; }
      if (!admitCut(cut, item.zombie, entry.age)) { asyncLastError = 'prepared cut rejected by resource budget'; asyncFallback++; return; }
      const corpseIndex = corpses.indexOf(entry);
      if (corpseIndex >= 0) corpses.splice(corpseIndex, 1);
      recycle(entry); entry.pendingCut = null; asyncAccepted++;
      recordAsyncLatency(item.started);
    } catch (error) {
      if (cut) cut.dispose();
      asyncFallback++; asyncErrors++;
    }
  }
  function submitAsyncCut(zombie, entry, snapshot) {
    if (!worker || pendingCuts.size >= asyncQueueLimit[cutQuality]) return false;
    const key = `${zombie.id}:${++asyncSequence}`;
    const item = { key, sequence: asyncSequence, generation: asyncGeneration, zombie, entry, snapshot, started: globalThis.performance?.now?.() ?? Date.now(), settled: false };
    pendingCuts.set(key, item); asyncSubmitted++;
    try {
      const payload = { meshes: snapshot.meshes, direction: snapshot.direction };
      const jobWorker = worker, jobGeneration = item.generation;
      const registrations = snapshot.topologies?.map(topology => jobWorker.registerTopology?.(topology) || Promise.resolve()) || [];
      Promise.all(registrations).then(() => {
        if (item.settled || jobGeneration !== asyncGeneration || worker !== jobWorker) { settleAsyncFallback(item, 'cancel'); return null; }
        return jobWorker.submit(payload, snapshotTransferables(snapshot));
      }).then(result => { if (result) asyncResults.push({ item, result, sequence: item.sequence }); }, error => { if (!item.settled) settleAsyncFallback(item, 'error', error); });
      return key;
    } catch (error) {
      settleAsyncFallback(item, 'error');
      return false;
    }
  }
  function expireAsyncCuts() {
    const now = globalThis.performance?.now?.() ?? Date.now();
    for (const item of [...pendingCuts.values()]) {
      if (now - item.started > 750) settleAsyncFallback(item, 'timeout');
    }
  }
  function drainAsyncResults() {
    if (!asyncResults.length || asyncCommitsThisWindow >= 1) return;
    asyncResults.sort((a, b) => a.sequence - b.sequence);
    const next = asyncResults.shift();
    finishAsyncCut(next.item, next.result); asyncCommitsThisWindow++;
  }

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
    entry.owner = null; entry.corpse = false; entry.pendingCut = null; entry.flashGain = 1;
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
      })), flash: 0, flashGain: 1, corpse: false, motion: createVisualMotion() };
      entries.push(entry);
    }
    entry.owner = zombie;
    entry.fallback = zombie.mesh.children.filter(child => child !== entry.controller.root).map(child => [child, child.visible]);
    entry.motion.initialized = false;
    entry.attackTimer = 0;
    zombie.mesh.add(entry.controller.root);
    zombie.mesh.userData.deathHandled = false;
    zombie.mesh.userData.animatedEnemy = entry.controller;
    zombie.mesh.position.y = 0;
    zombie.shadowEnabled = null;
    attached.set(zombie, entry);
    return entry;
  }
  function remove(zombie, { death = false, deathStyle = zombie.deathStyle, killedBySkillId = zombie.killedBySkillId, deathDirection = zombie.deathDirection, direction = deathDirection } = {}) {
    if (death) {
      if (zombie.mesh.userData.deathHandled) return null;
      zombie.mesh.userData.deathHandled = true;
    }
    const entry = detach(zombie);
    let forceVisibleFallback = false;
    const dashDeath = deathStyle === 'cleave' && (!killedBySkillId || killedBySkillId === 'warrior_cleaving_dash');
    if (death && (dashDeath || deathStyle === 'bisect' && killedBySkillId === 'warrior_cleaving_dash')) {
      if (!entry) return null;
      scene.attach(entry.controller.root); restoreMaterials(entry);
      // Capture actual rendered pose before the gameplay entity/pool is reused.
      // No corpse timer owns or mutates the original live rig after this point.
      const canCreateCut = hasUsableCutBudget();
      const canCreateNow = canCreateCut && cutCreationsThisWindow < cutCreationLimits[cutQuality];
      const canQueueAsync = canCreateNow && worker && pendingCuts.size < asyncQueueLimit[cutQuality];
      if (canQueueAsync) {
        scene.attach(entry.controller.root);
        let snapshot = null;
        try { snapshot = captureDeathCutSnapshot({ THREE, source: entry.controller.root, direction, groundY: 0 }); } catch { snapshot = null; }
        const key = snapshot ? submitAsyncCut(zombie, entry, snapshot) : null;
        if (key) { cutCreationsThisWindow++; retainCorpse(entry, zombie, key); return; }
        if (!canCreateNow || !canQueueAsync) cutRejected++;
        forceVisibleFallback = true;
      } else if (worker && canCreateNow) {
        // A configured worker never falls back to synchronous geometry work
        // merely because its bounded queue is full.
        cutRejected++; forceVisibleFallback = true;
      } else if (!(browserRuntime && asyncCuts && !worker && canCreateNow)) {
        if (canCreateNow) cutCreationsThisWindow++;
        const cut = canCreateNow ? createEnemyDeathCut({ THREE, scene, source: entry.controller.root, direction, hideSource: false,
          lifetime: cutQuality === 'low' ? 4 : 8 }) : null;
        if (!canCreateNow) cutRejected++;
        if (cut && admitCut(cut, zombie)) { recycle(entry); return; }
      } else {
        cutRejected++;
      }
      // A null/over-budget cut follows the ordinary visible corpse path below;
      // authoritative death is retained, but expensive visual work is not.
      forceVisibleFallback = true;
    }
    if (!entry) return;
    const corpseLimit = Math.max(2, Math.floor(limit / 5));
    if (death && (corpses.length < corpseLimit || forceVisibleFallback)) {
      if (forceVisibleFallback && corpses.length >= corpseLimit) {
        const evicted = corpses.shift();
        if (evicted?.pendingCut) settleAsyncFallback(pendingCuts.get(evicted.pendingCut), 'cancel');
        recycle(evicted);
      }
      retainCorpse(entry, zombie);
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
  function update(zombies, { dt, motionDt = dt, playerPosition, mobile = false, quality = 'high' }) {
    cutQuality = quality === 'low' ? 'low' : 'high';
    cutCreationsThisWindow = 0;
    asyncCommitsThisWindow = 0;
    expireAsyncCuts();
    drainAsyncResults();
    trimCutsToBudget();
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
      sampleVisualMotion(entry.motion, position, motionDt);
      entry.motion.dead = false;
      position.y = 0;
      const attack = zombie.type === 'caster' ? zombie.casterCastVisual : zombie.meleeAttack;
      if (dt === 0 && controller.stats.supportsPhaseAttack && attack) {
        controller.update(0, { ...entry.motion, ...control, attack, paused: attack.paused });
      }
      if (dt > 0) {
        entry.attackTimer -= dt;
        if (!control.paused && zombie.serverControlled && !controller.stats.supportsPhaseAttack && !zombie.meleeAttack && zombie.visualDistanceSq < (zombie.radius + 1.1) ** 2 && entry.attackTimer <= 0) {
          controller.attack({ duration: .65 }); entry.attackTimer = .9;
        }
        controller.update(dt, { ...entry.motion, ...control,
          ...(controller.stats.supportsPhaseAttack && attack ? { attack, paused: attack.paused } : {}),
        });
        // Hit flash: C1 hold/decay on animation time. Hit-stop holds the white frame.
        entry.flash = Math.max(0, entry.flash - dt);
        const glow = entry.flash > 0 ? Math.min(1, entry.flash / HIT_FEEDBACK.flash.decay) * entry.flashGain * HIT_FEEDBACK.flash.peak : 0;
        for (const state of entry.materials) if (state.emissive) {
          state.material.emissive.copy(state.emissive);
          if (glow > 0) { state.material.emissive.addScalar(glow); state.material.emissiveIntensity = 1; }
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
      if (entry.age >= entry.duration + .4) {
        if (entry.pendingCut) settleAsyncFallback(pendingCuts.get(entry.pendingCut), 'timeout');
        corpses.splice(i, 1); recycle(entry);
      }
    }
    for (let i = cutCorpses.length - 1; i >= 0; i--) {
      const entry = cutCorpses[i]; entry.age += Math.max(0, dt);
      entry.cut.update(dt, { quality });
      if (entry.age >= entry.cut.diagnostics.lifetime) { cutCorpses.splice(i, 1); disposeCutEntry(entry); }
    }
  }
  return {
    register(name, library) { libraries.set(name, library); },
    update, remove, syncCast, getCastEmitter,
    hit(zombie, gain = 1) { const entry = attached.get(zombie); if (!entry) return false;
      if (gain >= .5 && !getEnemyControlState(zombie).paused) entry.controller.hit();
      const time = HIT_FEEDBACK.flash.hold + HIT_FEEDBACK.flash.decay;
      if (!(entry.flash > 0) || gain >= entry.flashGain) { entry.flash = time; entry.flashGain = gain; }
      return true; },
    attack(zombie, duration = .65) { if (!getEnemyControlState(zombie).paused) attached.get(zombie)?.controller.attack({ duration }); },
    clear() {
      asyncGeneration++;
      for (const item of [...pendingCuts.values()]) settleAsyncFallback(item, 'cancel');
      asyncResults.length = 0;
      worker?.cancelAll?.({ terminate: true });
      worker = ownsWorker ? createDeathCutBrowserWorker() : null;
      for (const [zombie] of attached) remove(zombie);
      for (const entry of corpses) recycle(entry);
      corpses.length = 0;
      while (cutCorpses.length) disposeCutEntry(cutCorpses.pop());
      for (const key of cutResourceKeys) cutResources[key] = 0;
      cutEvents = 0; cutEvictions = 0; cutRejected = 0; cutCreationsThisWindow = 0;
      asyncSubmitted = 0; asyncAccepted = 0; asyncFallback = 0; asyncErrors = 0; asyncCancelled = 0; asyncLatency = [];
    },
    getStats() { return { loaded: libraries.size > 0, libraries: [...libraries.keys()], limit, allocated: entries.length,
      active: attached.size, corpses: corpses.length, cutCorpses: cutCorpses.length, cutEvents, cutEvictions, cutRejected,
      cutQuality, cutBudget: { ...cutBudget() }, cutCreationLimit: cutCreationLimits[cutQuality], cutCreationsThisWindow, cutResources: { ...cutResources },
      cutSettled: cutCorpses.filter(entry => entry.cut.getState?.().settled).length,
      asyncCuts: { enabled: Boolean(worker), pending: pendingCuts.size, resultQueue: asyncResults.length, commitsThisWindow: asyncCommitsThisWindow, queueLimit: asyncQueueLimit[cutQuality], submitted: asyncSubmitted,
        accepted: asyncAccepted, fallback: asyncFallback, errors: asyncErrors, lastError: asyncLastError, cancelled: asyncCancelled,
        latencyMs: asyncLatency.length ? { p50: [...asyncLatency].sort((a,b)=>a-b)[Math.floor(asyncLatency.length * .5)],
          p95: [...asyncLatency].sort((a,b)=>a-b)[Math.min(asyncLatency.length - 1, Math.floor(asyncLatency.length * .95))], max: Math.max(...asyncLatency) } : null },
      cutEntries: cutCorpses.map(entry => ({ entityId: entry.entityId, age: entry.age, sequence: entry.sequence, resources: { ...entry.resources } })),
      actors: [...attached].map(([zombie, entry]) => ({ ...entry.controller.stats, entityId: zombie.id, type: zombie.type,
        position: { x: zombie.mesh.position.x, y: zombie.mesh.position.y, z: zombie.mesh.position.z } })),
      corpseActors: corpses.map(entry => ({ type: entry.key, currentClip: entry.controller.stats.currentClip,
        animationTime: entry.controller.stats.animationTime, age: entry.age })),
    }; },
  };
}
