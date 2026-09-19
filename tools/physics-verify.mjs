import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createCollisionWorld, moveActor, stepActor, sweepStatic, separateActors, findFreePosition } from '../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(process.env.BIPX_PHYSICS_EVIDENCE || `output/physics/${stamp}-cpu`);
fs.mkdirSync(out, { recursive: true });
const hashes = () => Object.fromEntries(['src/physics/contacts.mjs', 'tools/physics-verify.mjs', 'src/render/environment-layout.js']
  .filter(file => fs.existsSync(file)).map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report = { evidenceKind: 'deterministic_cpu_fixture', syntheticFixture: true, startedAt: new Date().toISOString(),
  node: process.version, sourceHashes: hashes(), tests: [], limitations: ['No GPU/render evidence', 'Not a natural gameplay or network run'] };
function test(name, run) {
  const started = performance.now();
  try { const details = run(); report.tests.push({ name, status: 'passed', ms: performance.now() - started, details }); }
  catch (error) { report.tests.push({ name, status: 'failed', error: error.stack }); }
}
const near = (actual, expected, tolerance = 1e-4) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ±${tolerance}`);
const actor = (x = 0, z = 0, id = 'hero') => ({ id, x, z, radius: .5, height: 2, y: 0 });
const box = (id, x = 0, z = 0, halfX = .1, halfZ = 5, extra = {}) => ({ id, shape: 'box', x, z, halfX, halfZ, ...extra });
const circle = (id, x, z, radius, extra = {}) => ({ id, shape: 'circle', x, z, radius, ...extra });
const world = (...colliders) => createCollisionWorld({ colliders });
const wallWorld = world(box('thin-wall'));

test('long displacement cannot tunnel through a 20cm wall', () => {
  const result = moveActor(wallWorld, actor(-20), { x: 1000, z: 0 });
  near(result.x, -.6); assert.equal(result.blocked, true); assert.equal(result.unresolved, false);
  return { position: result.x, contacts: result.contacts.length };
});
test('slide preserves full tangential movement and blocked velocity becomes zero', () => {
  const w = world(box('wall', 0, 0, .1, 100));
  let body = actor(-2, -2);
  const move = moveActor(w, body, { x: 4, z: 4 });
  near(move.x, -.6); near(move.z, 2);
  body = { ...body, ...move };
  const step = stepActor(w, body, { x: 6.5, z: 0 }, 1 / 60);
  near(step.velocity.x, 0); near(step.velocity.z, 0);
});
test('bounded dt and substeps report discarded time without teleporting', () => {
  const step = stepActor(world(), actor(), { x: 6.5, z: 0 }, 5);
  near(step.x, .65); near(step.dt, .1); near(step.discardedDt, 4.9); assert.equal(step.substeps, 6);
  const limited = stepActor(world(), actor(), { x: 6.5, z: 0 }, 5, { maxDt: .25, maxStep: .01, maxSubsteps: 2 });
  near(limited.dt, .02); assert.equal(limited.substeps, 2);
  for (const dt of [-10, NaN, Infinity, 0]) near(stepActor(world(), actor(), { x: 5, z: 0 }, dt).x, 0);
  return { accepted: step.dt, discarded: step.discardedDt, substeps: step.substeps };
});
test('rotated box has the same contact and slide in its local frame', () => {
  const yaw = .73, c = Math.cos(yaw), s = Math.sin(yaw);
  const rotate = p => ({ x: c * p.x + s * p.z, z: -s * p.x + c * p.z });
  const original = moveActor(wallWorld, actor(-3, -1), { x: 6, z: 2 });
  const result = moveActor(world(box('rotated', 0, 0, .1, 5, { yaw })), { ...actor(), ...rotate({ x: -3, z: -1 }) }, rotate({ x: 6, z: 2 }));
  const expected = rotate(original); near(result.x, expected.x); near(result.z, expected.z);
});
test('rounded corners do not introduce expanded AABB invisible barriers', () => {
  const result = moveActor(world(box('square', 0, 0, 1, 1)), actor(1.49, 1.49), { x: -.09, z: -.09 });
  near(result.x, 1.4); near(result.z, 1.4); assert.equal(result.blocked, false);
  const hit = sweepStatic(world(box('square', 0, 0, 1, 1)), { x: 3, z: 3 }, { x: 0, z: 0 }, .5);
  near(hit.x, 1 + .5 / Math.sqrt(2)); near(hit.z, hit.x);
});
test('inside corner converges without stationary jitter under 240 push frames', () => {
  const w = world(box('x', 2, 0, .1, 5), box('z', 0, 2, 5, .1));
  let body = actor(); const tail = [];
  for (let i = 0; i < 240; i++) {
    const result = stepActor(w, body, { x: 6, z: 6 }, 1 / 60);
    assert.equal(result.unresolved, false); body = { ...body, ...result };
    if (i > 120) tail.push([body.x, body.z]);
  }
  near(body.x, 1.4); near(body.z, 1.4);
  assert.ok(tail.every(([x, z]) => Math.hypot(x - body.x, z - body.z) < 1e-8));
});
test('narrow legal corridor is traversable', () => {
  const result = moveActor(world(box('left', -.65, 0, .1, 100), box('right', .65, 0, .1, 100)), actor(0, -10), { x: 0, z: 20 });
  near(result.z, 10); assert.equal(result.blocked, false);
});
test('initial overlap, respawn and reconnect recover once without false velocity', () => {
  for (const w of [world(circle('pillar', 0, 0, 1)), world(box('tomb', 0, 0, 1, 2, { yaw: .5 }))]) {
    const body = actor(), before = JSON.stringify(body);
    const spawn = stepActor(w, body, { x: 0, z: 0 }, 1 / 60);
    assert.ok(Math.hypot(spawn.recovery.x, spawn.recovery.z) >= 1.5);
    near(spawn.velocity.x, 0); near(spawn.velocity.z, 0); assert.equal(spawn.unresolved, false);
    const reconnect = moveActor(w, { ...body, ...spawn }, { x: 0, z: 0 });
    near(reconnect.x, spawn.x, 1e-10); near(reconnect.z, spawn.z, 1e-10);
    assert.equal(JSON.stringify(body), before);
  }
});
test('circle arena accounts for body radius and permits tangential travel', () => {
  const w = createCollisionWorld({ bounds: { x: 0, z: 0, radius: 55 } });
  let body = actor(54.5, 0);
  for (let i = 0; i < 100; i++) {
    const result = stepActor(w, body, { x: 5, z: 5 }, 1 / 60);
    assert.ok(Math.hypot(result.x, result.z) <= 54.5 + 1e-7); body = { ...body, ...result };
  }
  assert.ok(body.z > 7);
  const outside = moveActor(w, actor(70, 70), { x: 0, z: 0 });
  near(Math.hypot(outside.x, outside.z), 54.5);
  assert.equal(outside.unresolved, false);
});
test('projectile resolves nearest solid, starting inside and exact endpoint', () => {
  const w = world(box('far', 5), box('near', 0));
  const hit = sweepStatic(w, { x: -10, z: 0 }, { x: 10, z: 0 }, .1);
  assert.equal(hit.colliderId, 'near'); near(hit.t, .49);
  assert.equal(sweepStatic(w, { x: 0, z: 0 }, { x: 10, z: 0 }, .1).t, 0);
  near(sweepStatic(w, { x: -10, z: 0 }, { x: -.2, z: 0 }, .1).t, 1);
  assert.equal(sweepStatic(w, { x: -10, z: 6 }, { x: 10, z: 6 }, .1), null);
});
test('height windows handle shots over props and falling into their top', () => {
  const w = world(box('low-prop', 0, 0, 1, 1, { minY: 0, maxY: 1 }));
  assert.equal(sweepStatic(w, { x: -5, y: 2, z: 0 }, { x: 5, y: 2, z: 0 }, .1), null);
  assert.ok(sweepStatic(w, { x: -5, y: .8, z: 0 }, { x: 5, y: .8, z: 0 }, .1));
  const fall = sweepStatic(w, { x: 0, y: 4, z: 0 }, { x: 0, y: 0, z: 0 }, .1);
  near(fall.t, .725); near(fall.y, 1.1);
  const actorBelow = moveActor(world(box('lintel', 0, 0, 1, 1, { minY: 3, maxY: 5 })), actor(-5), { x: 10, z: 0 });
  near(actorBelow.x, 5);
});
test('collision flags separate walking surfaces and projectile cover', () => {
  const w = world(box('decor', 0, 0, .1, 5, { blockingActors: false, blockingProjectiles: false }));
  assert.equal(moveActor(w, actor(-2), { x: 4, z: 0 }).blocked, false);
  assert.equal(sweepStatic(w, { x: -2, z: 0 }, { x: 2, z: 0 }), null);
});
test('world/body inputs remain unchanged and ids reject ambiguous ties', () => {
  const descriptions = [box('b', 2), box('a', -2)]; const before = JSON.stringify(descriptions);
  const w = createCollisionWorld({ colliders: descriptions });
  assert.equal(JSON.stringify(descriptions), before); assert.ok(Object.isFrozen(w));
  assert.throws(() => world(box('same'), box('same')), /Unique/);
  assert.throws(() => moveActor(w, { ...actor(), x: NaN }, { x: 0, z: 0 }), /finite/);
  assert.throws(() => separateActors(w, [actor(), actor()]), /Unique/);
  assert.throws(() => world(box('@bounds')), /reserved/);
});
test('impossible overlapping constraints are exposed rather than reported resolved', () => {
  const result = moveActor(world(box('left', -.4, 0, .1, 10), box('right', .4, 0, .1, 10)), actor(), { x: 0, z: 0 });
  assert.equal(result.unresolved, true); assert.ok(Number.isFinite(result.x));
  assert.ok(result.contacts.length <= 16);
});
test('coincident pair uses deterministic normal, settles and remains at rest', () => {
  const w = world(), initial = [actor(0, 0, 'a'), actor(0, 0, 'b')];
  let bodies = initial;
  for (let i = 0; i < 20; i++) bodies = separateActors(w, bodies).bodies;
  assert.ok(Math.hypot(bodies[0].x - bodies[1].x, bodies[0].z - bodies[1].z) >= .9989);
  const settled = JSON.stringify(bodies);
  for (let i = 0; i < 60; i++) bodies = separateActors(w, bodies).bodies;
  assert.equal(JSON.stringify(bodies), settled);
  assert.equal(JSON.stringify(initial), JSON.stringify([actor(0, 0, 'a'), actor(0, 0, 'b')]));
});
test('crowd ordering, fixed player and solid walls are respected', () => {
  const w = world(box('wall', -1, 0, .1, 10));
  const input = [actor(0, 0, 'player'), actor(.1, 0, 'enemy'), actor(.2, .1, 'enemy2')]; input[0].inverseMass = 0;
  const normal = separateActors(w, input), reversed = separateActors(w, [...input].reverse());
  assert.deepEqual(normal.bodies, [...reversed.bodies].reverse());
  near(normal.bodies[0].x, 0); near(normal.bodies[0].z, 0);
  let bodies = input;
  for (let i = 0; i < 60; i++) {
    const result = separateActors(w, bodies); bodies = result.bodies;
    assert.equal(result.unresolved, false); assert.ok(bodies.every(body => body.x >= -.40001));
  }
  assert.ok(separateActors(w, bodies).maxPenetration <= .00101);
});
test('packed 80 actor horde converges inside bounds without sustained jitter', () => {
  const w = createCollisionWorld({ bounds: { x: 0, z: 0, radius: 15 }, colliders: [box('tomb', -5, 0, .6, 3)] });
  let bodies = Array.from({ length: 80 }, (_, i) => actor((i % 10) * .7 - 3.15, Math.floor(i / 10) * .7 - 2.45, `enemy-${String(i).padStart(3, '0')}`));
  const start = performance.now(); let result;
  for (let frame = 0; frame < 360; frame++) {
    result = separateActors(w, bodies); bodies = result.bodies;
    assert.equal(result.unresolved, false);
    assert.ok(bodies.every(body => Math.hypot(body.x, body.z) + body.radius <= 15 + 1e-7));
  }
  assert.ok(result.maxPenetration < .0011, `Remaining penetration ${result.maxPenetration}`);
  const next = separateActors(w, bodies);
  const jitter = Math.max(...bodies.map((body, i) => Math.hypot(body.x - next.bodies[i].x, body.z - next.bodies[i].z)));
  assert.ok(jitter < 1e-6, `Jitter ${jitter}`);
  return { actors: bodies.length, frames: 360, maxPenetration: result.maxPenetration, restingDisplacement: jitter, simulationMs: performance.now() - start };
});
test('400 actor dispersed horde broad phase is bounded', () => {
  const w = createCollisionWorld({ bounds: { x: 0, z: 0, radius: 55 } });
  let bodies = Array.from({ length: 400 }, (_, i) => actor((i % 20) * 1.1 - 10.45, Math.floor(i / 20) * 1.1 - 10.45, i));
  const timings = [];
  for (let frame = 0; frame < 60; frame++) {
    const start = performance.now(); bodies = separateActors(w, bodies).bodies; timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  return { actors: 400, frames: 60, medianMs: timings[30], p95Ms: timings[57], note: 'CPU fixture, not a game frame budget assertion' };
});
test('seeded continuous sweeps agree with independent dense occupancy samples', () => {
  let seed = 1947;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  for (let n = 0; n < 200; n++) {
    const shape = box('rot', (random() - .5) * 2, (random() - .5) * 2, .1 + random() * 2, .1 + random() * 2, { yaw: random() * 6.28 });
    const w = world(shape), from = { x: (random() - .5) * 20, z: (random() - .5) * 20 }, to = { x: (random() - .5) * 20, z: (random() - .5) * 20 }, r = .05 + random();
    const hit = sweepStatic(w, from, to, r);
    const occupied = t => {
      const dx = from.x + (to.x - from.x) * t - shape.x, dz = from.z + (to.z - from.z) * t - shape.z;
      const x = Math.cos(shape.yaw) * dx - Math.sin(shape.yaw) * dz, z = Math.sin(shape.yaw) * dx + Math.cos(shape.yaw) * dz;
      return Math.hypot(Math.max(0, Math.abs(x) - shape.halfX), Math.max(0, Math.abs(z) - shape.halfZ)) <= r + 1e-7;
    };
    let sample = null;
    for (let i = 0; i <= 4000; i++) if (occupied(i / 4000)) { sample = i / 4000; break; }
    if (sample !== null) { assert.ok(hit, `Missed sample ${n}`); assert.ok(hit.t <= sample + 1e-6); }
    if (hit) { assert.ok(occupied(hit.t), `False contact ${n}`); if (hit.t > .001) assert.equal(occupied(hit.t - .0005), false); }
  }
  return { segments: 200, samplesPerSegment: 4001, seed: 1947 };
});

test('real environment descriptors preserve portal, four spawns and connected routes', () => {
  const colliders = getEnvironmentColliders();
  const w = createCollisionWorld({ colliders, bounds: ENVIRONMENT_GROUND, groundY: ENVIRONMENT_GROUND.y });
  for (const [x, z] of [[0, 0], [4, 0], [-4, 0], [0, 4]]) {
    const spawn = moveActor(w, { ...actor(x, z), radius: .64 }, { x: 0, z: 0 });
    near(spawn.x, x, 1e-10); near(spawn.z, z, 1e-10); assert.equal(spawn.blocked, false);
  }
  // One-metre navigation sample is QA only: runtime solver does not perform pathfinding.
  const key = (x, z) => `${x},${z}`, reached = new Set([key(0, 0)]), queue = [[0, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = x + dx, tz = z + dz, id = key(tx, tz);
      if (reached.has(id) || Math.hypot(tx, tz) > 53) continue;
      if (sweepStatic(w, { x, z }, { x: tx, z: tz }, .64, { kind: 'actor', y: 0, height: 2 })) continue;
      reached.add(id); queue.push([tx, tz]);
    }
  }
  for (const [x, z] of [[0, -30], [30, 0], [0, 30], [-30, 0], [40, 20], [-40, -20]]) assert.ok(reached.has(key(x, z)), `Unreachable route ${x},${z}`);
  assert.ok(reached.size > 7000);
  return { colliders: colliders.length, arenaRadius: ENVIRONMENT_GROUND.radius, connectedFreeSamples: reached.size,
    check: 'CPU collision-descriptor routes; visible asset bounds are Environment ownership' };
});
test('actual environment spawn recovery covers hero through largest boss radii', () => {
  const w = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND });
  let tested = 0, recovered = 0, searchRequired = 0;
  for (const radius of [.64, .78, 1.72]) for (let i = 0; i < 120; i++) {
    const angle = i * 2.39996, distance = i % 3 === 0 ? 60 : 20 + (i % 34);
    const body = { ...actor(Math.cos(angle) * distance, Math.sin(angle) * distance), radius };
    const local = moveActor(w, body, { x: 0, z: 0 });
    if (local.unresolved) searchRequired++;
    const result = findFreePosition(w, body, { maxDistance: 16 });
    assert.equal(result.found, true, `No safe spawn ${i} radius${radius}`);
    assert.equal(moveActor(w, { ...body, ...result }, { x: 0, z: 0 }).unresolved, false);
    assert.ok(Math.hypot(result.x, result.z) + radius <= 55 + 1e-7);
    if (result.relocated) recovered++;
    tested++;
  }
  return { tested, recovered, searchRequired };
});
test('spawn search avoids other players, reports no space and never exceeds bound', () => {
  const body = actor(), w = world();
  const options = { actors: [actor(0, 0, 'other')], maxDistance: 2 };
  const spawn = findFreePosition(w, body, options);
  assert.equal(spawn.found, true); assert.ok(spawn.distance >= 1 && spawn.distance <= 2);
  assert.deepEqual(findFreePosition(w, body, options), spawn);
  const trapped = findFreePosition(world(box('solid', 0, 0, 20, 20)), body, { maxDistance: 2 });
  assert.equal(trapped.found, false); near(trapped.distance, 0); assert.ok(trapped.attempts < 128);
});

report.sourceChangedDuringRun = JSON.stringify(report.sourceHashes) !== JSON.stringify(hashes());
report.finishedAt = new Date().toISOString();
report.passed = report.tests.filter(test => test.status === 'passed').length;
report.failed = report.tests.length - report.passed;
fs.writeFileSync(path.join(out, 'physics-cpu.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, sourceChanged: report.sourceChangedDuringRun, evidence: path.join(out, 'physics-cpu.json'), failures: report.tests.filter(test => test.status === 'failed') }, null, 2));
if (report.failed || report.sourceChangedDuringRun) process.exitCode = 1;
