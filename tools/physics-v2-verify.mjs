import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createCollisionWorld, moveActor, stepActor, pullActors, sweepStatic, findFreePosition } from '../src/physics/contacts.mjs';
import { findNavigationPath, getPursuitDirection } from '../src/physics/navigation.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';

const out = path.resolve(`output/physics/${new Date().toISOString().replace(/[:.]/g, '-')}-v2-cpu`);
fs.mkdirSync(out, { recursive: true });
const files = ['src/physics/contacts.mjs', 'src/physics/navigation.mjs', 'src/render/environment-layout.js', 'tools/physics-v2-verify.mjs'];
const hashes = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report = { scope: 'V2 physical primitives, explicit deterministic CPU fixtures, not class-skill integration or real gameplay',
  syntheticFixture: true, sourceHashes: hashes(), tests: [] };
const near = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const body = (id, x, z, radius = .64) => ({ id, x, z, radius });
const wall = { id: 'solid', shape: 'box', x: 0, z: 0, halfX: .1, halfZ: 6, minY: 0, maxY: 3 };
const wallWorld = createCollisionWorld({ colliders: [wall] });
const realWorld = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND });
function test(name, run) {
  const start = performance.now();
  try { report.tests.push({ name, passed: true, details: run(), ms: performance.now() - start }); }
  catch (error) { report.tests.push({ name, passed: false, error: error.stack }); }
}

test('v2 dash and shield charge stop at first contact, no wall slide or tunneling', () => {
  const result = moveActor(wallWorld, body('warrior', -5, -2), { x: 100, z: 40 }, { stopOnContact: true });
  near(result.x, -.74); near(result.z, -.296);
  const step = stepActor(wallWorld, body('warrior', -2, 0), { x: 40, z: 0 }, 3, { stopOnContact: true });
  near(step.x, -.74); assert.equal(step.blocked, true); assert.equal(step.unresolved, false);
  assert.ok(step.dt <= .1);
});
test('dash path damage endpoints cannot reach victims behind the prop', () => {
  const origin = body('warrior', -3, 0), direction = { x: 30, z: 0 };
  const result = stepActor(wallWorld, origin, direction, .1, { stopOnContact: true });
  assert.ok(result.x <= -.73999);
  assert.equal(sweepStatic(wallWorld, origin, result, .64, { kind: 'actor' }), null);
  return { from: { x: origin.x, z: origin.z }, to: { x: result.x, z: result.z }, wall: result.contacts[0].colliderId };
});
test('attraction moves all nearby actors, preserves centre and cannot tunnel through a wall', () => {
  const center = { x: 3, z: 0 }, frozenCenter = JSON.stringify(center);
  const bodies = [body('near', -2, 0), body('near2', -2, 2), body('far', -20, 0), { ...body('fixed', -2, -2), inverseMass: 0 }];
  let current = bodies, result;
  for (let i = 0; i < 120; i++) { result = pullActors(wallWorld, current, center, 1 / 60, { radius: 8, speed: 5 }); current = result.bodies; }
  assert.equal(JSON.stringify(center), frozenCenter);
  assert.deepEqual(result.affectedIds, ['near', 'near2']);
  assert.ok(current[0].x > -2 && current[0].x <= -.73999);
  assert.ok(current[1].x > -2 && current[1].x <= -.73999);
  near(current[2].x, -20); near(current[3].x, -2);
  assert.equal(result.unresolved, false);
});
test('pull saturates without centre crossing, and dt0 has no movement', () => {
  const w = createCollisionWorld();
  let actors = [body('one', 1, 0)];
  for (let i = 0; i < 600; i++) actors = pullActors(w, actors, { x: 0, z: 0 }, .1, { speed: 100 }).bodies;
  near(actors[0].x, .7); near(actors[0].z, 0);
  const stopped = pullActors(w, actors, { x: 0, z: 0 }, 0);
  assert.deepEqual(stopped.bodies, actors);
});
test('authority supplied pullScale preserves explicit resistance without UI deciding force', () => {
  const w = createCollisionWorld(), center = { x: 0, z: 0 };
  const full = pullActors(w, [body('one', 10, 0)], center, .1, { radius: 12, speed: 4 });
  const resisted = pullActors(w, [{ ...body('one', 10, 0), pullScale: .35 }], center, .1, { radius: 12, speed: 4 });
  near(10 - resisted.bodies[0].x, (10 - full.bodies[0].x) * .35);
  assert.ok(pullActors(w, [{ ...body('one', 10, 0), pullScale: 0 }], center, .1, { radius: 12 }).affectedIds.length === 0);
});
test('persistent pull towards an external centre preserves circular bounds under long frames', () => {
  const w = createCollisionWorld({ bounds: { x: 0, z: 0, radius: 5 } }), center = { x: 7, z: 0 };
  let actors = [body('one', 3.8, 0, .58), body('two', 3.2, 1.5, .58), body('three', 3.2, -1.5, .58)];
  let maximumStep = 0, maximumPenetration = 0;
  for (let frame = 0; frame < 120; frame++) {
    const result = pullActors(w, actors, center, 4, { radius: 12, speed: 4.5 });
    near(result.dt, .1); assert.equal(result.unresolved, false);
    maximumPenetration = Math.max(maximumPenetration, result.maxPenetration);
    result.bodies.forEach((a, i) => {
      assert.ok(Math.hypot(a.x, a.z) + a.radius <= 5 + 1e-5, 'Attraction escaped map boundary');
      maximumStep = Math.max(maximumStep, Math.hypot(a.x - actors[i].x, a.z - actors[i].z));
    });
    actors = result.bodies;
  }
  assert.ok(maximumStep <= .45 + 1e-4, `Unbounded pull displacement ${maximumStep}`);
  assert.ok(maximumPenetration < .002); near(actors[0].x, 4.42);
  assert.deepEqual(center, { x: 7, z: 0 });
  return { maximumStep, maximumPenetration, final: actors.map(({ id, x, z }) => ({ id, x, z })) };
});
test('24 attracted enemies have bounded crowd density and settle after field expiry', () => {
  const w = createCollisionWorld({ bounds: { x: 0, z: 0, radius: 20 } });
  let actors = Array.from({ length: 24 }, (_, i) => body(`e${String(i).padStart(2, '0')}`, Math.cos(i * 2.39996) * (4 + i % 3), Math.sin(i * 2.39996) * (4 + i % 3), .58));
  const initialMean = actors.reduce((sum, a) => sum + Math.hypot(a.x, a.z), 0) / actors.length;
  let result, maxPenetration = 0;
  const centroids = [];
  for (let frame = 0; frame < 360; frame++) {
    result = pullActors(w, actors, { x: 0, z: 0 }, 1 / 60, { radius: 8, speed: 4 }); actors = result.bodies;
    maxPenetration = Math.max(maxPenetration, result.maxPenetration);
    if (frame > 300) centroids.push(actors.map(a => ({ x: a.x, z: a.z })));
    assert.equal(result.unresolved, false);
  }
  const finalMean = actors.reduce((sum, a) => sum + Math.hypot(a.x, a.z), 0) / actors.length;
  assert.ok(finalMean < initialMean - 1.5);
  assert.ok(result.maxPenetration < .08, `Excess crowd overlap ${result.maxPenetration}`);
  const drift = Math.max(...centroids.slice(1).flatMap((frame, i) => frame.map((a, j) => Math.hypot(a.x - centroids[i][j].x, a.z - centroids[i][j].z))));
  assert.ok(drift < .03, `Sustained per-frame jitter ${drift}`);
  const before = structuredClone(actors);
  const stopped = pullActors(w, actors, { x: 0, z: 0 }, 0);
  assert.deepEqual(stopped.bodies, before);
  return { initialMean, finalMean, maxPenetrationDuringPull: maxPenetration, finalPenetration: result.maxPenetration, lateMaxStep: drift };
});
test('real blocked pursuit cases route around rocks and rails using actual post-collision positions', () => {
  const results = [];
  for (const scenario of [
    { id: 'rocks-0', start: [-19, -20], target: [-19, -12] },
    { id: 'burial-rail-2', start: [-14, 22], target: [-14, 17.1] },
  ]) {
    let actor = body('walker', ...scenario.start, .78), state = null;
    const target = { x: scenario.target[0], z: scenario.target[1] };
    let frames = 0, plans = 0, maxVisited = 0;
    for (; frames < 400 && Math.hypot(actor.x - target.x, actor.z - target.z) > 1.6; frames++) {
      const pursuit = getPursuitDirection(realWorld, actor, target, state, .05, { speed: 3.3, arrivalRadius: 1.6 }); state = pursuit.state;
      if (state.visited) plans++;
      maxVisited = Math.max(maxVisited, state.visited);
      const moved = stepActor(realWorld, actor, { x: pursuit.direction.x * 3.3, z: pursuit.direction.z * 3.3 }, .05);
      assert.equal(moved.unresolved, false); actor = { ...actor, x: moved.x, z: moved.z };
    }
    const remaining = Math.hypot(actor.x - target.x, actor.z - target.z);
    assert.ok(remaining <= 1.6, `${scenario.id} stuck at ${remaining}`);
    assert.ok(maxVisited <= 768);
    results.push({ obstacle: scenario.id, seconds: frames * .05, remaining, plans, maxVisited });
  }
  return results;
});
test('path planning is deterministic, radius aware, and every returned segment clears props', () => {
  const target = { x: -19, z: -12 };
  const paths = [];
  for (const radius of [.58, .78, 1.72]) {
    const requested = body('actor', -19, -22, radius), spawn = findFreePosition(realWorld, requested);
    const actor = { ...requested, ...spawn };
    const a = findNavigationPath(realWorld, actor, target, { arrivalRadius: 2.5 });
    const b = findNavigationPath(realWorld, actor, target, { arrivalRadius: 2.5 });
    assert.deepEqual(a, b); assert.equal(a.reached, true);
    let previous = actor;
    for (const next of a.waypoints) { assert.equal(sweepStatic(realWorld, previous, next, radius, { kind: 'actor' }), null); previous = next; }
    paths.push({ radius, waypoints: a.waypoints.length, visited: a.visited });
  }
  return paths;
});
test('pursuit replans moving targets and exits navigation when the direct line clears', () => {
  let actor = body('actor', -3, 0), state = null, routed = false, direct = false;
  for (let frame = 0; frame < 240; frame++) {
    const target = { x: 3, z: Math.min(9, frame * .08) };
    const result = getPursuitDirection(wallWorld, actor, target, state, .05, { speed: 4 }); state = result.state;
    routed ||= result.mode === 'waypoint'; direct ||= result.mode === 'direct';
    const moved = stepActor(wallWorld, actor, { x: result.direction.x * 4, z: result.direction.z * 4 }, .05);
    assert.equal(moved.unresolved, false); actor = { ...actor, x: moved.x, z: moved.z };
  }
  assert.ok(routed && direct); assert.ok(Math.hypot(actor.x - 3, actor.z - 9) < .3);
});
test('sealed room does not teleport actor or exceed planner budget', () => {
  const w = createCollisionWorld({ colliders: [
    { ...wall, id: 'left', x: -2 }, { ...wall, id: 'right', x: 2 },
    { ...wall, id: 'top', halfX: 3, halfZ: .1, z: 2 }, { ...wall, id: 'bottom', halfX: 3, halfZ: .1, z: -2 },
  ] });
  const actor = body('one', 0, 0), before = JSON.stringify(actor);
  const result = findNavigationPath(w, actor, { x: 8, z: 8 }, { maxVisited: 64 });
  assert.equal(result.reached, false); assert.ok(result.visited <= 64); assert.equal(JSON.stringify(actor), before);
});
test('120 actor pursuit obeys global four-plan budget without changing valid routes', () => {
  const actors = Array.from({ length: 120 }, (_, i) => {
    const angle = i * 2.39996, radius = 15 + i % 35;
    const original = body(i, Math.cos(angle) * radius, Math.sin(angle) * radius, .78);
    return { ...original, ...findFreePosition(realWorld, original) };
  });
  const frameTimes = []; let planned = 0, peakPlans = 0, maxVisited = 0, deferred = 0;
  for (let frame = 0; frame < 80; frame++) {
    let budget = 4;
    const start = performance.now(), target = { x: Math.sin(frame * .03) * 4, z: Math.cos(frame * .03) * 4 };
    for (const actor of actors) {
      const route = getPursuitDirection(realWorld, actor, target, actor.navigation, .05,
        { speed: 3.3, arrivalRadius: 1.6, allowPlanning: budget > 0 });
      actor.navigation = route.state;
      if (route.state.planned) { budget--; planned++; maxVisited = Math.max(maxVisited, route.state.visited); }
      if (route.state.needsPlan) deferred++;
      const moved = stepActor(realWorld, actor, { x: route.direction.x * 3.3, z: route.direction.z * 3.3 }, .05);
      assert.equal(moved.unresolved, false); actor.x = moved.x; actor.z = moved.z;
    }
    peakPlans = Math.max(peakPlans, 4 - budget); assert.ok(budget >= 0);
    frameTimes.push(performance.now() - start);
  }
  assert.ok(planned > 20); assert.ok(deferred > 0); assert.ok(maxVisited <= 768);
  frameTimes.sort((a, b) => a - b);
  return { actors: 120, frames: 80, planned, peakPlans, maxVisited, deferred, medianMs: frameTimes[40], p95Ms: frameTimes[76], worstMs: frameTimes[79],
    limit: 'CPU fixture only; global game frame time and GPU are not measured' };
});

report.sourceChangedDuringRun = JSON.stringify(report.sourceHashes) !== JSON.stringify(hashes());
report.passed = report.tests.filter(test => test.passed).length; report.failed = report.tests.length - report.passed;
fs.writeFileSync(path.join(out, 'physics-v2.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ evidence: path.join(out, 'physics-v2.json'), passed: report.passed, failed: report.failed, sourceChanged: report.sourceChangedDuringRun,
  tests: report.tests.map(test => test.passed ? { name: test.name, details: test.details } : test) }, null, 2));
if (report.failed || report.sourceChangedDuringRun) process.exitCode = 1;
