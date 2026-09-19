import {RIFLE_COLLISION_HEIGHT,enemyProjectileCollisionHeight} from '../src/combat/collision-heights.mjs';
import {createCollisionWorld,sweepStatic} from '../src/physics/contacts.mjs';
const collisionWorld=createCollisionWorld({bounds:{x:0,z:0,radius:55}});
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {segmentCircleContact} from '../src/combat/projectile-sweep.mjs';
import { emitProjectileTrail, emitProjectileImpact } from '../src/vfx/elemental-projectiles.js';
const productionServer = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const productionClient = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Actual production function missing: ${name}`);
  const end = source.indexOf('\n}', start);
  return source.slice(start, end + 2);
}
const serverSource = extract(productionServer, 'updateServerProjectiles');
const soloSource = extract(productionClient, 'updateEnemyProjectiles') + '\n' + extract(productionClient, 'getProjectileHitTarget');
const checks = [];
const definitions = [
  { name: 'grazing crossing', from: [-.55, 1], speed: [22, 0], dt: .05, targets: [[0, 0]], expected: 0 },
  { name: 'grazing near miss', from: [-.55, 1.061], speed: [22, 0], dt: .05, targets: [[0, 0]], expected: null },
  { name: 'nearest wins over reversed iteration', from: [-3, 0], speed: [100, 0], dt: .05, targets: [[2, 0], [0, 0]], expected: 1 },
  { name: 'expired before target', from: [-3, 0], speed: [100, 0], dt: .05, life: .01, targets: [[0, 0]], expected: null },
  { name: 'hit within final partial step', from: [-2, 0], speed: [100, 0], dt: .05, life: .015, targets: [[0, 0]], expected: 0 },
  { name: 'initial overlap', from: [0, 0], speed: [10, 0], dt: .05, targets: [[0, 0]], expected: 0 },
  { name: 'paused step no impact', from: [0, 0], speed: [10, 0], dt: 0, targets: [[0, 0]], expected: null },
  { name: 'already expired no impact', from: [0, 0], speed: [10, 0], dt: .05, life: 0, targets: [[0, 0]], expected: null },
  { name: 'target behind moving shot', from: [2, 0], speed: [30, 0], dt: .05, targets: [[0, 0]], expected: null },
];
for (const mode of ['server', 'solo']) {
  for (const test of definitions) {
    const hits = [], positions = [], visualEvents = [];
    const base = { id: 1, age: 0, lifespan: test.life ?? 1.9, radius: .42, damage: 10, homing: false, sourceType: 'caster', impactRadius: 2.2 };
    let retained;
    if (mode === 'server') {
      const projectile = { ...base, x: test.from[0], z: test.from[1], vx: test.speed[0], vz: test.speed[1] };
      const room = { world: { projectiles: new Map([[1, projectile]]) } };
      const players = test.targets.map(([x, z], id) => ({ id, state: { x, z, health: 200, state: 'playing' } }));
      const update = new Function('segmentCircleContact', 'damageServerPlayer', 'getProjectileSpeed', 'serverWorldLimit', 'sweepStatic', 'collisionWorld', serverSource + ';return updateServerProjectiles;')(segmentCircleContact, (r, client) => { hits.push(client.id); positions.push({x:projectile.x,z:projectile.z}); }, p => Math.hypot(p.vx, p.vz), 55, sweepStatic, collisionWorld);
      update(room, players, test.dt); update(room, players, 0);
      retained = room.world.projectiles.has(1);
    } else {
      const projectile = { ...base, mesh: { position: new THREE.Vector3(test.from[0], 1, test.from[1]) }, velocity: new THREE.Vector3(test.speed[0], 0, test.speed[1]) };
      const projectiles = [projectile];
      const targets = test.targets.map(([x, z], id) => ({ id, radius: .64, position: new THREE.Vector3(x, 0, z) }));
      const visualSink = {
        emit: (kind, position) => visualEvents.push({ kind, position: position.toArray() }),
        emitTrail: (kind, from, to) => visualEvents.push({ kind: `${kind}Trail`, from: from.toArray(), position: to.toArray() }),
      };
      const update = new Function('THREE', 'segmentCircleContact', 'enemyProjectiles', 'livingPlayerTargets', 'updateProjectileHoming', 'animateEnemyProjectileVisual', 'damagePlayerTarget', 'spawnExplosion', 'removeEnemyProjectile', 'elementalVfx', 'emitProjectileTrail', 'emitProjectileImpact', 'sweepStatic', 'collisionWorld', 'enemyProjectileCollisionHeight', soloSource + ';return updateEnemyProjectiles;')(THREE, segmentCircleContact, projectiles, targets, () => {}, () => {}, target => { hits.push(target.id); positions.push({x:projectile.mesh.position.x,z:projectile.mesh.position.z}); }, () => {}, i => projectiles.splice(i, 1), visualSink, emitProjectileTrail, emitProjectileImpact, sweepStatic, collisionWorld, enemyProjectileCollisionHeight);
      update(test.dt); update(0);
      retained = projectiles.includes(projectile);
      const impacts = visualEvents.filter(event => event.kind === 'voidImpact');
      assert.equal(impacts.length, test.expected === null ? 0 : 1, `${test.name}: impact must require real contact`);
      if (impacts.length) {
        near(impacts[0].position[0], positions[0].x);
        near(impacts[0].position[2], positions[0].z);
        assert.deepEqual(visualEvents[0].position, impacts[0].position, 'Trail must end at the contact, not pass through it');
      }
    }
    assert.deepEqual(hits, test.expected === null ? [] : [test.expected], `${mode}: ${test.name}`);
    if (hits.length) assert.equal(retained, false);
    if (test.name === 'grazing crossing') assert.ok(Math.abs(positions[0].x + Math.sqrt(1.06 ** 2 - 1)) < 1e-9);
    checks.push({ mode, name: test.name, hits, positions, retained, visualEvents, passed: true });
  }
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9); }
const deadProjectile = { id: 1, x: -3, z: 0, vx: 100, vz: 0, age: 0, lifespan: 1, radius: .42, damage: 10 };
const deadRoom = { world: { projectiles: new Map([[1, deadProjectile]]) } };
const deadHits = [];
const deadUpdate = new Function('segmentCircleContact', 'damageServerPlayer', 'getProjectileSpeed', 'serverWorldLimit', 'sweepStatic', 'collisionWorld', serverSource + ';return updateServerProjectiles;')(segmentCircleContact, (r,c) => deadHits.push(c.id), p => Math.hypot(p.vx,p.vz), 55, sweepStatic, collisionWorld);
deadUpdate(deadRoom, [{ id: 'dead', state: { x: -1, z: 0, health: 0, state: 'dead' } }, { id: 'alive', state: { x: 1, z: 0, health: 200, state: 'playing' } }], .05);
assert.deepEqual(deadHits, ['alive']);
checks.push({ name: 'server dead target does not intercept', passed: true });
const profilesStart = productionServer.indexOf('const serverCharacterProfiles = ');
const profilesEnd = productionServer.indexOf('\n};', profilesStart) + 3;
const profiles = new Function(productionServer.slice(profilesStart, profilesEnd) + ';return serverCharacterProfiles;')();
const rifleHits = new Function('segmentCircleContact', 'distanceSq', 'sweepStatic', 'collisionWorld', 'RIFLE_COLLISION_HEIGHT', extract(productionServer, 'getServerAttackHits') + ';return getServerAttackHits;')(
  segmentCircleContact, (x, z, a, b) => (x - a) ** 2 + (z - b) ** 2, sweepStatic, collisionWorld, RIFLE_COLLISION_HEIGHT,
);
const rifleCases = [
  { name: 'nearby collider grazing the rifle centerline', targets: [{ id: 'near', x: .5, z: -3, radius: .58 }], expected: ['near'] },
  { name: 'distant off-line target formerly hit by the cone', targets: [{ id: 'off-line', x: 1, z: -20, radius: .58 }], expected: [] },
  { name: 'nearest contact wins regardless of iteration', targets: [{ id: 'far', x: 0, z: -10, radius: .58 }, { id: 'near', x: 0, z: -3, radius: .58 }], expected: ['near'] },
  { name: 'first collider surface wins over nearest center', targets: [{ id: 'small', x: 0, z: -4, radius: .4 }, { id: 'large', x: 0, z: -5, radius: 2 }], expected: ['large'] },
  { name: 'area improvement widens projectile collider', area: 4, targets: [{ id: 'wide', x: .75, z: -3, radius: .58 }], expected: ['wide'] },
  { name: 'same target remains outside base projectile', targets: [{ id: 'wide', x: .75, z: -3, radius: .58 }], expected: [] },
  { name: 'area improvement does not extend rifle range', area: 4, targets: [{ id: 'beyond', x: 0, z: -30, radius: .58 }], expected: [] },
  { name: 'behind-the-player target cannot intercept', targets: [{ id: 'behind', x: 0, z: 3, radius: .58 }], expected: [] },
];
for (const test of rifleCases) {
  const room = { world: { monsters: new Map(test.targets.map(target => [target.id, target])) } };
  const result = rifleHits(room, { x: 0, z: 0 }, { x: 0, z: -1 }, profiles.dwarf, test.area || 1).map(target => target.id);
  assert.deepEqual(result, test.expected, test.name);
  checks.push({ name: `server rifle: ${test.name}`, result, passed: true });
}
const report = {
  scope: 'CPU fixtures execute actual production projectile update functions extracted without modification. Renderer, homing and damage sinks stubbed; this is collision evidence, not native gameplay.',
  passed: true, checks,
  serverSha256: crypto.createHash('sha256').update(productionServer).digest('hex'),
  clientSha256: crypto.createHash('sha256').update(productionClient).digest('hex'),
};
const directory = process.env.BIPX_EVIDENCE_DIR || `output/playwright/${new Date().toISOString().replace(/[:.]/g, '-')}-enemy-projectiles`;
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'enemy-projectiles.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, checks: checks.length, directory }));
