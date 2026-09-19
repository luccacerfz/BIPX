import assert from 'node:assert/strict';
import { createVisualMotion, sampleVisualMotion } from '../src/render/visual-motion.js';

const motion = createVisualMotion();
const step = (x, z, dt = .02, active = true) => sampleVisualMotion(motion, { x, z }, dt, active, 6.5);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
step(50, 20);
assert.equal(motion.teleport, true); near(motion.speed, 0);
step(50.12, 20.05);
near(motion.velocity.x, 6); near(motion.velocity.z, 2.5); near(motion.speed, 6.5);
// A blocked actor has no foot travel even when the control remains pressed.
step(50.12, 20.05); near(motion.speed, 0); assert.equal(motion.teleport, false);
step(50, 20); near(motion.velocity.x, -6); near(motion.velocity.z, -2.5);
// Paused/interrupted frames rebase position without storing a burst of motion.
step(50.1, 20, 0); near(motion.speed, 0);
step(50.2, 20, .02, false); near(motion.speed, 0);
step(50.3, 20); near(motion.speed, 5);
// Server correction releases the old contact, then resumes normally.
step(-20, 0); assert.equal(motion.teleport, true); near(motion.speed, 0);
step(-19.9, 0); assert.equal(motion.teleport, false); near(motion.speed, 5);
step(NaN, 0); assert.equal(motion.initialized, false); near(motion.speed, 0);
step(1, 2); assert.equal(motion.teleport, true); near(motion.speed, 0);
// Pool reuse and separate actors must not inherit another actor's stride.
motion.initialized = false; step(1.05, 2); near(motion.speed, 0);
const peer = createVisualMotion();
sampleVisualMotion(peer, { x: 100, z: 100 }, .02);
step(1.15, 2); near(motion.speed, 5); near(peer.speed, 0);
console.log(JSON.stringify({ passed: true, scope: 'Rendered displacement sampler: collision, reversal, pause, correction, invalid pose, pool reuse and independent actors. Does not prove bone contact or visual quality.' }));
