import { getEnemyControlState } from './enemy-control-state.js';
import { getMeleeTiming } from '../combat/melee-timing.mjs';
import { applyMeleeVisualSnapshot } from '../combat/melee-visual-phase.mjs';
import { createBloodCow, BLOODCOW_ROLES } from './bloodcow-runtime.js';

const TIMING = getMeleeTiming('bloodCow');
const CONTACT_CLIP_TIME = 41 / 60;
const RECOVERY_CLIP_TIME = 1.2;

// The 95th percentile of the left forearm/hand surface (sum of all 12 skin
// weights >= .25) reaches its forward +Z extension at 41/60 s in this authored
// clip. The shared impact at .4 s maps to that authored contact frame.
export const BLOODCOW_PHASE_ATTACK = Object.freeze({
  duration: TIMING.duration,
  impactTime: TIMING.impactTime,
  impactPhase: TIMING.impactTime / TIMING.duration,
  cooldown: TIMING.cooldown,
  reach: TIMING.reach,
  clip: BLOODCOW_ROLES.Attack,
  contactClipTime: CONTACT_CLIP_TIME,
  recoveryClipTime: RECOVERY_CLIP_TIME,
  witness: 'left forearm and hand surface +Z p95; summed authored influence >= 0.25',
  map: [
    { elapsed: 0, clipTime: 0 },
    { elapsed: TIMING.impactTime, clipTime: CONTACT_CLIP_TIME },
    { elapsed: TIMING.duration, clipTime: RECOVERY_CLIP_TIME },
  ],
});

function mappedClipTime(attack) {
  const duration = Math.max(.1, Number(attack?.duration) || TIMING.duration);
  const impactTime = Math.min(duration - .001, Math.max(.001, Number(attack?.impactTime) || TIMING.impactTime));
  const elapsed = Math.min(duration, Math.max(0, Number(attack?.elapsed) || 0));
  if (elapsed <= impactTime) return CONTACT_CLIP_TIME * elapsed / impactTime;
  return CONTACT_CLIP_TIME + (RECOVERY_CLIP_TIME - CONTACT_CLIP_TIME) * (elapsed - impactTime) / (duration - impactTime);
}

function currentStats(core, stats, current, attackState, speed) {
  core.stats(stats);
  stats.currentClip = current;
  stats.animationTimeScale = stats.timeScale;
  const impactTime = attackState ? Number(attackState.impactTime) || attackState.impactPhase * attackState.duration : null;
  stats.attack = attackState ? { id: attackState.id, elapsed: attackState.elapsed, duration: attackState.duration,
    active: attackState.active, clipTime: core.actions.Attack.time, impactTime,
    impactReached: attackState.elapsed >= impactTime, startCount: attackState.startCount || 0 } : null;
  stats.speed = speed;
}

export function createBloodCowActor(THREE, gltf, qa, { parent, height = 2.8, yaw = 0, bridge = true } = {}) {
  const core = createBloodCow(gltf, qa, { bridge });
  const root = new THREE.Group();
  root.name = 'Monster:bloodcow:v015';
  root.add(core.model);
  root.rotation.y = yaw;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(core.model, true);
  const sourceHeight = bounds.max.y - bounds.min.y;
  const parentScale = new THREE.Vector3(1, 1, 1);
  parent?.updateWorldMatrix(true, false);
  parent?.getWorldScale(parentScale);
  if (Math.max(parentScale.x, parentScale.y, parentScale.z) - Math.min(parentScale.x, parentScale.y, parentScale.z) > 1e-3) {
    core.dispose();
    throw new Error('BloodCow actor requires a uniformly scaled gameplay parent');
  }
  root.scale.setScalar(height / Math.max(.001, sourceHeight) / Math.max(.001, parentScale.y));
  parent?.add(root);
  root.updateMatrixWorld(true);

  let dead = false, released = false, current = 'Idle', speed = 0;
  let phaseState = null, ownerToken = null, manualId = 0;
  const stats = {
    id: 'bloodcow', loaded: true, sourceHeight, runtimeHeight: height,
    clips: Object.entries(BLOODCOW_ROLES).map(([name, source]) => ({ name, source,
      duration: core.actions[name].getClip().duration, tracks: core.actions[name].getClip().tracks.length })),
    runFallback: 'Walk corrected, timeScale 1', artisticAccepted: false, runtimeAccepted: false,
    failedInvariantOrigins: [], technicalSurfaceCandidate: true, supportsPhaseAttack: true,
    phaseAttack: BLOODCOW_PHASE_ATTACK, phaseSyncReason: 'waiting-for-authoritative-meleeAttack',
    contactWitness: BLOODCOW_PHASE_ATTACK.witness,
  };
  const locomotion = value => value > .1 ? (value > 2.4 ? 'Run' : 'Walk') : 'Idle';

  function transition(name, fade = .14) {
    if (current === name) return;
    core.transition(name, fade, false);
    current = name;
  }

  function syncPhase(snapshot, control) {
    if (!snapshot || snapshot.id == null) {
      if (phaseState?.active) phaseState = { ...phaseState, active: false, cancelled: true };
      return false;
    }
    // Freeze/stun cancels the authoritative melee in the game loop; consume
    // that ID as inactive here so a delayed active snapshot cannot revive it.
    const incoming = control.paused && snapshot.active !== false ? { ...snapshot, active: false } : snapshot;
    const result = applyMeleeVisualSnapshot(phaseState, incoming, {
      defaultDuration: TIMING.duration, defaultImpactPhase: BLOODCOW_PHASE_ATTACK.impactPhase,
    });
    if (!result.ok) { stats.phaseSyncReason = result.reason; return false; }
    const previous = phaseState;
    phaseState = result.state;
    if (previous?.id === phaseState.id && previous.duration !== phaseState.duration) {
      // Server duration correction is allowed to move a phase forward, never backward.
      const oldProgress = previous.elapsed / Math.max(.001, previous.duration);
      const newProgress = phaseState.elapsed / Math.max(.001, phaseState.duration);
      const progress = Math.max(oldProgress, newProgress);
      phaseState.elapsed = Math.min(phaseState.duration, progress * phaseState.duration);
    }
    if (phaseState.active && !control.paused) {
      if (result.restart || current !== 'Attack') {
        core.transition('Attack', result.fade || .065, true);
        core.actions.Attack.setEffectiveTimeScale(0);
        current = 'Attack';
      }
      core.actions.Attack.setEffectiveTimeScale(0);
      core.seek('Attack', mappedClipTime(phaseState));
      stats.phaseSyncReason = result.restart ? 'started-from-authoritative-phase' : 'advanced-or-corrected-authoritative-phase';
    } else if (!phaseState.active) {
      stats.phaseSyncReason = phaseState.cancelled ? 'cancelled-id-retired' : 'authoritative-attack-complete';
    }
    return true;
  }

  const actor = {
    root, model: core.model, stats,
    update(dt, state = {}) {
      if (released) return false;
      const nextOwner = state.ownerToken ?? state.entityId ?? null;
      if (ownerToken !== null && nextOwner !== null && nextOwner !== ownerToken) {
        core.reset('Idle'); phaseState = null; dead = false; current = 'Idle';
      }
      if (nextOwner !== null) ownerToken = nextOwner;
      speed = Number(state.speed) || 0;
      const control = getEnemyControlState(state);
      stats.control = control;
      const attack = state.attack ?? state.meleeAttack ?? null;
      if (state.dead) {
        if (!dead) {
          if (attack) syncPhase({ ...attack, active: false }, control);
          if (phaseState) phaseState = { ...phaseState, active: false, cancelled: true };
          dead = true; core.die(); current = 'Death';
        }
        core.update(dt); currentStats(core, stats, current, phaseState, speed);
        return true;
      }
      if (dead) { currentStats(core, stats, current, phaseState, speed); return false; }
      if (attack) syncPhase(attack, control);
      else if (phaseState?.active) syncPhase({ ...phaseState, active: false }, control);
      if (!control.paused) {
        if (!phaseState?.active && current !== 'Death') transition(locomotion(speed));
        if (phaseState?.active && current === 'Attack') core.seek('Attack', mappedClipTime(phaseState));
        core.update(dt);
      } else core.update(0);
      currentStats(core, stats, current, phaseState, speed);
      return true;
    },
    attack() {
      if (dead || released || stats.control?.paused) return false;
      manualId += 1;
      return actor.update(0, { ownerToken, speed, attack: { id: `preview-${manualId}`, elapsed: 0, duration: TIMING.duration,
        impactTime: TIMING.impactTime, impactPhase: BLOODCOW_PHASE_ATTACK.impactPhase, active: true } });
    },
    hit() {},
    reset() {
      if (released) return;
      dead = false; current = 'Idle'; speed = 0; phaseState = null; ownerToken = null;
      core.reset(); root.visible = true; currentStats(core, stats, current, phaseState, speed);
    },
    dispose() {
      if (released) return;
      released = true; core.dispose(); root.removeFromParent(); stats.loaded = false;
    },
    qaCore: core,
  };
  return actor;
}
