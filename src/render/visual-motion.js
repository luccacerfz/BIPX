// Sample the rendered actor, after movement limits/interpolation. Input intent
// cannot describe a blocked actor or a peer's actual interpolated foot travel.
export function createVisualMotion() {
  return { initialized: false, x: 0, z: 0, speed: 0,
    velocity: { x: 0, z: 0 }, teleport: true, dead: false };
}

export function sampleVisualMotion(motion, position, dt, active = true, maxSpeed = 30) {
  const valid = Number.isFinite(position.x) && Number.isFinite(position.z);
  const dx = position.x - motion.x, dz = position.z - motion.z;
  const advancing = active && Number.isFinite(dt) && dt > 0;
  // A discontinuity resets contact anchors; it must not become a giant stride.
  motion.teleport = !motion.initialized || !valid ||
    Math.hypot(dx, dz) > Math.max(1, Math.max(0, maxSpeed) * Math.max(0, dt || 0) * 3);
  const sample = advancing && !motion.teleport;
  motion.velocity.x = sample ? dx / dt : 0;
  motion.velocity.z = sample ? dz / dt : 0;
  motion.speed = Math.hypot(motion.velocity.x, motion.velocity.z);
  if (valid) { motion.x = position.x; motion.z = position.z; }
  motion.initialized = valid;
  return motion;
}
