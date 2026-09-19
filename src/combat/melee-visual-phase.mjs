// Visual consumption of authoritative meleeAttack. Does not apply damage.
// Clip contact is only claimed when family metadata exists; otherwise the pose is timing-normalized.

export const SKINNED_PHASE_TYPES = Object.freeze(['zombie', 'runner', 'orcPeon', 'brute']);
export const PROCEDURAL_PHASE_TYPES = Object.freeze(['cowWalker', 'cowCharger', 'cowBrute', 'bloodCow']);
export const TIMED_MELEE_TYPES = Object.freeze([...SKINNED_PHASE_TYPES, ...PROCEDURAL_PHASE_TYPES]);

export const MELEE_VISUAL_FAMILIES = Object.freeze({
  zombie: { library: 'monsters', prototype: 'zombie', clip: 'Attack', contact: { kind: 'retarget-window', impactPhase: 0.523, window: [1 / 3, 5 / 3] } },
  runner: { library: 'monsters', prototype: 'zombie', clip: 'Attack', contact: { kind: 'retarget-window', impactPhase: 0.523, window: [1 / 3, 5 / 3] } },
  brute: { library: 'monsters', prototype: 'brute', clip: 'Attack', contact: { kind: 'timing-normalized', reason: 'brute Attack has no bipxMotion retarget/contact extras' } },
  orcPeon: { library: 'orc', prototype: 'orcPeon', clip: 'Attack', contact: { kind: 'timing-normalized', reason: 'orc Attack clip has no contact frame metadata' } },
  cowWalker: { library: null, prototype: null, clip: null, contact: { kind: 'procedural-fallback', reason: 'procedural mesh, no Attack GLB' } },
  cowCharger: { library: null, prototype: null, clip: null, contact: { kind: 'procedural-fallback', reason: 'procedural mesh, no Attack GLB' } },
  cowBrute: { library: null, prototype: null, clip: null, contact: { kind: 'procedural-fallback', reason: 'procedural mesh, no Attack GLB' } },
  bloodCow: { library: null, prototype: null, clip: null, contact: { kind: 'procedural-fallback', reason: 'procedural mesh, no Attack GLB' } },
  caster: { library: 'monsters', prototype: 'lich', clip: 'Attack', contact: { kind: 'cast-profile', preserved: true } },
});

export function meleeVisualFamily(type) {
  return MELEE_VISUAL_FAMILIES[type] ?? null;
}

export function meleeVisualHasSkinnedPhase(type) {
  return SKINNED_PHASE_TYPES.includes(type);
}

export function meleeVisualHasProceduralPhase(type) {
  return PROCEDURAL_PHASE_TYPES.includes(type);
}

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

export function applyMeleeVisualSnapshot(prev, snapshot, { defaultDuration = 0.88, defaultImpactPhase = 0.523 } = {}) {
  if (!snapshot || snapshot.id == null) return { ok: false, reason: 'missing', state: prev, restart: false, fade: 0 };
  const sequence = Number.isFinite(Number(snapshot.sequence)) ? Number(snapshot.sequence) : (Number.isFinite(Number(snapshot.id)) ? Number(snapshot.id) : null);
  if (sequence != null && prev && sequence < prev.lastSequence) return { ok: false, reason: 'stale_sequence', state: prev, restart: false, fade: 0 };
  const same = prev?.id === snapshot.id;
  if (same && prev && !prev.active) return { ok: false, reason: 'id_complete', state: prev, restart: false, fade: 0 };
  if (!same && sequence != null && prev && sequence === prev.lastSequence) return { ok: false, reason: 'seq_complete', state: prev, restart: false, fade: 0 };
  const duration = Math.max(0.1, Number(snapshot.duration) || defaultDuration);
  const explicitElapsed = Number.isFinite(Number(snapshot.elapsed)) ? Number(snapshot.elapsed)
    : Number.isFinite(Number(snapshot.phase)) ? Number(snapshot.phase) * duration : 0;
  const elapsed = clamp(explicitElapsed, 0, duration);
  const impactPhase = clamp(Number.isFinite(Number(snapshot.impactPhase)) ? Number(snapshot.impactPhase) : defaultImpactPhase, 0, 1);
  const lastSequence = sequence != null ? sequence : (prev?.lastSequence ?? -Infinity);

  if (snapshot.active === false) {
    const cancelled = elapsed < duration;
    if (!same) {
      return { ok: true, reason: null, restart: false, fade: 0, state: {
        id: snapshot.id, sequence, lastSequence, duration, elapsed, lastReceivedElapsed: elapsed, impactPhase,
        active: false, cancelled, startCount: prev?.startCount ?? 0,
      } };
    }
    return { ok: true, reason: null, restart: false, fade: 0, state: {
      ...prev, lastSequence, elapsed: Math.max(prev.elapsed, elapsed), duration, impactPhase,
      lastReceivedElapsed: elapsed, active: false, cancelled: Math.max(prev.elapsed, elapsed) < duration,
    } };
  }

  if (same && elapsed <= prev.lastReceivedElapsed && duration === prev.duration) {
    return { ok: false, reason: 'duplicate_elapsed', state: prev, restart: false, fade: 0 };
  }

  if (!same) {
    const active = elapsed < duration;
    return {
      ok: true, reason: null, restart: active, fade: elapsed > 0 ? 0 : 0.065,
      state: {
        id: snapshot.id, sequence, lastSequence, duration, elapsed, lastReceivedElapsed: elapsed, impactPhase,
        active, cancelled: false, startCount: (prev?.startCount ?? 0) + (active ? 1 : 0),
      },
    };
  }

  const nextElapsed = Math.max(prev.elapsed, elapsed);
  return {
    ok: true, reason: null, restart: false, fade: 0,
    state: {
      ...prev, lastSequence, lastReceivedElapsed: elapsed, elapsed: nextElapsed, duration, impactPhase,
      active: nextElapsed < duration,
    },
  };
}

export function predictMeleeVisual(state, dt) {
  if (!state?.active) return state;
  const elapsed = Math.min(state.duration, state.elapsed + Math.max(0, Number(dt) || 0));
  return { ...state, elapsed, active: elapsed < state.duration };
}

export function meleeVisualNormalized(state) {
  if (!state) return 0;
  return clamp(state.elapsed / state.duration, 0, 1);
}

export function meleeVisualClipTime(state, clipDuration) {
  if (!state || !(clipDuration > 0)) return 0;
  return meleeVisualNormalized(state) * clipDuration;
}

function hermite(a, b, t) {
  const s = clamp(t, 0, 1);
  const h = s * s * (3 - 2 * s);
  return a + (b - a) * h;
}

/** Procedural cow/BloodCow pose. Continuous prepare/strike/recover. Not a clip-contact proof. */
export function proceduralMeleePose(attack, wobble = 0) {
  const restL = -0.42, restR = -0.42;
  if (!attack || attack.active === false || !(attack.duration > 0)) {
    return { mode: 'locomotion', leftArm: restL, rightArm: restR, head: 0, windup: 0, impact: 0, phase: 'locomotion' };
  }
  const u = clamp(Number(attack.elapsed) / attack.duration, 0, 1);
  const impact = clamp(Number.isFinite(Number(attack.impactPhase)) ? Number(attack.impactPhase) : 0.5, 0.08, 0.92);
  const windL = -1.22, windR = -1.38;
  const hitL = -0.88, hitR = -2.02;
  let leftArm, rightArm, phase;
  if (u <= impact) {
    const t = u / impact;
    phase = t < 0.62 ? 'prepare' : 'strike';
    if (t < 0.62) {
      leftArm = hermite(restL, windL, t / 0.62);
      rightArm = hermite(restR, windR, t / 0.62);
    } else {
      leftArm = hermite(windL, hitL, (t - 0.62) / 0.38);
      rightArm = hermite(windR, hitR, (t - 0.62) / 0.38);
    }
  } else {
    phase = 'recover';
    const t = (u - impact) / (1 - impact);
    leftArm = hermite(hitL, restL, t);
    rightArm = hermite(hitR, restR, t);
  }
  const windup = u <= impact ? u / impact : 1 - (u - impact) / (1 - impact);
  return {
    mode: 'melee',
    leftArm, rightArm,
    head: Math.sin(wobble) * 0.04 + (u - impact) * 0.08,
    windup,
    impact: u >= impact ? 1 : 0,
    phase,
  };
}
