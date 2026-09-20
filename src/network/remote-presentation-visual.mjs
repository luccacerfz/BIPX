// Testable consumer of remote presentation for animation/trace. No THREE.
import { sampleVisualMotion } from '../render/visual-motion.js';

export function applyRemoteVisualStep(visualMotion, position, dt, playing, stepped = {}) {
  const reset = Boolean(stepped.reset);
  const reason = stepped.reason ?? stepped.reconcile?.reason ?? null;
  if (reset) visualMotion.initialized = false;
  sampleVisualMotion(visualMotion, position, dt, Boolean(playing) && !reset);
  const walking = reset
    ? { x: 0, z: 0, speed: 0 }
    : { x: visualMotion.velocity.x, z: visualMotion.velocity.z, speed: visualMotion.speed };
  const reconciliation = reset
    ? { reason, distance: Number(stepped.reconcile?.distance) || 0, reset: true }
    : null;
  return {
    reset,
    reason,
    walking,
    reconciliation,
    teleport: Boolean(visualMotion.teleport),
  };
}
