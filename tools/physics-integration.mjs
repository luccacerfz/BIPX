// CPU integration: execute production functions verbatim, with rendering/network
// sinks replaced by observations. This does not claim browser or gameplay proof.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import * as physics from '../src/physics/contacts.mjs';
import * as navigation from '../src/physics/navigation.mjs';
import * as skills from '../src/combat/class-skills.mjs';
import * as melee from '../src/combat/melee-timing.mjs';
import * as collisionHeights from '../src/combat/collision-heights.mjs';
import { segmentCircleContact } from '../src/combat/projectile-sweep.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';

const files = ['src/main.js', 'server.mjs', 'src/combat/class-skills.mjs', 'src/combat/melee-timing.mjs', 'src/combat/projectile-sweep.mjs', 'src/combat/collision-heights.mjs',
  'src/physics/contacts.mjs', 'src/physics/navigation.mjs', 'src/render/environment-layout.js', 'tools/physics-integration.mjs'];
const hashes = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report = { scope: 'Production hooks extracted verbatim. CPU fixtures; presentation/transport/damage sinks observed or stubbed. Not real gameplay.', sourceHashes: hashes(), tests: [] };
const source = { client: fs.readFileSync('src/main.js', 'utf8'), server: fs.readFileSync('server.mjs', 'utf8') };
const out = path.resolve(`output/physics/${new Date().toISOString().replace(/[:.]/g, '-')}-integration`);
fs.mkdirSync(out, { recursive: true });
const near = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const wallWorld = physics.createCollisionWorld({ colliders: [{ id: 'wall', shape: 'box', x: 0, z: 0, halfX: .1, halfZ: 6, minY: 0, maxY: 3 }] });
const actualWorld = physics.createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND });
function extract(mode, name) {
  const start = source[mode].indexOf(`function ${name}(`), end = source[mode].indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, `Production hook ${name} missing`);
  return source[mode].slice(start, end + 2);
}
function profile(name) {
  const start = source.server.indexOf(`const ${name} = `), end = source.server.indexOf('\n};', start);
  return vm.runInNewContext(source.server.slice(start, end + 3) + `;${name};`);
}
const profiles = profile('serverMonsterProfiles');
function context(extra = {}) {
  return vm.createContext({ ...physics, ...navigation, ...skills, ...melee, ...collisionHeights, THREE, segmentCircleContact,
    collisionWorld: wallWorld, serverWorldLimit: 55, serverMonsterProfiles: profiles,
    serverCharacterProfiles: profile('serverCharacterProfiles'),
    clampNumber: (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback,
    normalizeCharacter: (v, fallback = 'dwarf') => v === 'warrior' || v === 'dwarf' ? v : fallback,
    distanceSq: (x, z, a, b) => (x - a) ** 2 + (z - b) ** 2,
    broadcast() {}, sendJson() {}, serializeMonster: monster => ({ ...monster }),
    resolveDamage: (_progression, damage) => ({ damage }), getProjectileSpeed: p => Math.hypot(p.vx, p.vz),
    ...extra });
}
function install(ctx, mode, names) { vm.runInContext(names.map(name => extract(mode, name)).join('\n'), ctx); return ctx; }
function test(name, run) {
  try { report.tests.push({ name, passed: true, details: run() }); }
  catch (error) { report.tests.push({ name, passed: false, error: error.stack }); }
}
function monster(id, x, z) { return { id, type: 'zombie', x, z, radius: .78, speed: 3.3, health: 200, maxHealth: 200, damage: 13, attackCooldown: 0 }; }

test('client updatePlayer consumes collision result and respects bounded dt', () => {
  const player = { position: new THREE.Vector3(-2, 0, 0), mesh: { position: new THREE.Vector3() }, speed: 6.5, upgradeStats: { speedMultiplier: 1 } };
  const ctx = install(context({ player, multiplayer: { enabled: false }, onlineSkillMotion: null, classSkillState: skills.createSkillState('warrior'),
    keys: new Set(['KeyD']), tempVectorB: new THREE.Vector3(), game: { touchVector: new THREE.Vector2() }, playerMoveBlend: 0 }), 'client', ['updatePlayer']);
  ctx.updatePlayer(5); near(player.position.x, -1.35);
  for (let i = 0; i < 30; i++) ctx.updatePlayer(1 / 60);
  near(player.position.x, -.74); near(player.mesh.position.x, player.position.x);
});
test('server normalizePlayerState sweeps submitted path instead of accepting wall teleport', () => {
  const ctx = install(context(), 'server', ['normalizePlayerState']);
  const fallback = { character: 'warrior', state: 'playing', x: -3, z: 0, rotation: 0, aimX: 1, aimZ: 0, health: 200 };
  const next = ctx.normalizePlayerState({ x: 3, z: 0, health: 9999 }, fallback);
  near(next.x, -.74); assert.equal(next.health, 200);
});
test('server rifle and enemy projectile select wall before target', () => {
  const hits = [], ctx = install(context({ damageServerPlayer: (_room, client) => hits.push(client.id) }), 'server', ['getServerAttackHits', 'updateServerProjectiles']);
  const far = monster('far', 2, 0), room = { world: { monsters: new Map([['far', far]]), projectiles: new Map() } };
  assert.equal(ctx.getServerAttackHits(room, { x: -3, z: 0 }, { x: 1, z: 0 }, ctx.serverCharacterProfiles.dwarf).length, 0);
  room.world.projectiles.set('p', { id: 'p', x: -3, z: 0, y: 1.05, vx: 100, vz: 0, radius: .3, damage: 10, age: 0, lifespan: 5 });
  ctx.updateServerProjectiles(room, [{ id: 'victim', state: { x: 2, z: 0, health: 200, state: 'playing' } }], .1);
  assert.equal(hits.length, 0); assert.equal(room.world.projectiles.size, 0);
});
for (const mode of ['client', 'server']) for (const slot of [1, 2]) test(`${mode} actual v2 dash/charge hook stops at wall and cannot hit victim behind it`, () => {
  const state = skills.createSkillState('warrior'), actor = { x: -3, z: 0, playing: true, health: 200, runId: 'physics' }, events = [], hits = [];
  const target = monster(1, 1.2, 0);
  let tick, readPosition;
  if (mode === 'server') {
    const client = { id: 'player', state: actor, skills: state, progression: {} }, room = { world: { monsters: new Map([[1, target]]) } };
    const ctx = install(context({ broadcast: (_room, message) => events.push(message.event), damageServerMonster: (_room, monster) => hits.push(monster.id) }), 'server', ['updateServerSkills']);
    tick = dt => ctx.updateServerSkills(room, client, dt); readPosition = () => actor;
  } else {
    const player = { position: new THREE.Vector3(-3, 0, 0), mesh: { position: new THREE.Vector3(-3, 0, 0) }, health: 200 };
    target.mesh = { position: new THREE.Vector3(target.x, 0, target.z) };
    const ctx = install(context({ player, multiplayer: { enabled: false }, classSkillState: state, zombies: [target], monsterProfiles: profiles,
      playSkillsReady() {}, presentClassSkill: event => events.push(event), damageZombie: zombie => { hits.push(zombie.id); return false; } }), 'client', ['updateClassSkills']);
    tick = dt => ctx.updateClassSkills(dt); readPosition = () => player.position;
  }
  assert.equal(skills.beginSkill(state, { slot, aimX: 1, aimZ: 0 }, actor).ok, true);
  for (let i = 0; i < 90; i++) tick(1 / 60);
  const position = readPosition(); near(position.x, -.74, .001); assert.equal(hits.length, 0); assert.equal(state.active.length, 0);
  const travel = events.filter(event => event?.phase === 'travel');
  assert.ok(travel.length); assert.ok(travel.every(event => event.target.x <= -.73999));
  return { canonicalSkill: skills.getClassSkills('warrior')[slot].id, finalX: position.x, travelEvents: travel.length, hitCount: hits.length };
});
test('actual server pursuit routes around both independently reproduced blockers', () => {
  const cases = [{ from: [-19, -20], to: [-19, -12] }, { from: [-14, 22], to: [-14, 17.1] }], results = [];
  for (const item of cases) {
    const enemy = monster(1, ...item.from), client = { id: 'player', state: { x: item.to[0], z: item.to[1], health: 200 } }, hits = [];
    const room = { world: { monsters: new Map([[1, enemy]]), wave: 1 } };
    const ctx = install(context({ collisionWorld: actualWorld, damageServerPlayer: () => hits.push(true), damageServerMonster() {} }), 'server', ['updateServerMonsters', 'updateServerMonsterStatus', 'getServerMonsterTarget']);
    for (let i = 0; i < 200; i++) ctx.updateServerMonsters(room, [client], .05);
    const remaining = Math.hypot(enemy.x - client.state.x, enemy.z - client.state.z);
    assert.ok(hits.length > 0 && remaining < 2.4, `Blocked pursuit: remaining=${remaining} hits=${hits.length}`);
    results.push({ from: item.from, to: item.to, remaining, hits: hits.length });
  }
  return results;
});
test('actual server timed melee cannot damage through a closed tall wall', () => {
  const closedWorld = physics.createCollisionWorld({ colliders: [{ id: 'wall', shape: 'box', x: 0, z: 0, halfX: 50, halfZ: .1, minY: 0, maxY: 3 }], bounds: { x: 0, z: 0, radius: 20 } });
  const enemy = monster(1, 0, -1), client = { id: 'player', state: { x: 0, z: 1, health: 200 } }, hits = [];
  const room = { world: { monsters: new Map([[1, enemy]]), wave: 1 } };
  const ctx = install(context({ collisionWorld: closedWorld, damageServerPlayer: () => hits.push(true), damageServerMonster() {} }), 'server', ['updateServerMonsters', 'updateServerMonsterStatus', 'getServerMonsterTarget']);
  for (let i = 0; i < 80; i++) ctx.updateServerMonsters(room, [client], .05);
  assert.equal(hits.length, 0, 'Enemy melee crossed tall closed wall');
});
test('actual melee rechecks moving target cover at impact with matching client height policy', () => {
  const results = [];
  for (const height of [.7, 1.05, 3]) {
    const w = physics.createCollisionWorld({ colliders: [{ id: 'cover', shape: 'box', x: 0, z: 0, halfX: .1, halfZ: .1, minY: 0, maxY: height }] });
    const enemy = monster(1, -.9, 0), client = { id: 'player', state: { x: .8, z: .8, health: 200 } }, hits = [];
    const room = { world: { monsters: new Map([[1, enemy]]), wave: 1 } };
    const ctx = install(context({ collisionWorld: w, damageServerPlayer: () => hits.push(true), damageServerMonster() {} }), 'server',
      ['updateServerMonsters', 'updateServerMonsterStatus', 'getServerMonsterTarget']);
    install(ctx, 'client', ['clearEnemyMelee']);
    assert.equal(ctx.clearEnemyMelee(enemy, client.state), true, 'Preparation must begin with a clear attack line');
    ctx.updateServerMonsters(room, [client], .05);
    assert.equal(enemy.meleeAttack?.active, true);
    // A valid path along the far side of the cover changes LOS during windup.
    // Target motion is a CPU fixture, not a gameplay/network movement claim.
    for (let frame = 0; frame < 10; frame++) {
      client.state.z = Math.max(0, .8 - (frame + 1) * .1);
      const free = physics.moveActor(w, { ...client.state, radius: .64 }, { x: 0, z: 0 });
      near(free.x, client.state.x); near(free.z, client.state.z);
      assert.equal(melee.isWithinMeleeArc(enemy, client.state, enemy.meleeAttack), true, 'Range/arc must not hide a missing cover check');
      ctx.updateServerMonsters(room, [client], .05);
    }
    assert.equal(enemy.meleeAttack.impactConsumed, true);
    assert.equal(ctx.clearEnemyMelee(enemy, client.state), height < .9);
    assert.equal(hits.length, height < .9 ? 1 : 0, 'Impact failed shared cover-height policy');
    results.push({ coverHeight: height, queryHeight: .9, hits: hits.length, impactConsumed: true });
  }
  return results;
});
test('actual server gravity plus crowd step pulls all nearby bodies without persistent compression', () => {
  const enemies = Array.from({ length: 24 }, (_, i) => ({ ...monster(i + 1,
    Math.cos(i * 2.39996) * (3 + i % 3 * .5), Math.sin(i * 2.39996) * (3 + i % 3 * .5)), radius: .58 }));
  const openWorld = physics.createCollisionWorld({ bounds: ENVIRONMENT_GROUND });
  for (let frame = 0; frame < 180; frame++) {
    const settled = physics.separateActors(openWorld, enemies);
    settled.bodies.forEach((body, i) => { enemies[i].x = body.x; enemies[i].z = body.z; });
  }
  assert.ok(physics.separateActors(openWorld, enemies).maxPenetration < .0011, 'Gravity fixture must begin with settled contacts');
  const state = skills.createSkillState('dwarf');
  state.fields.push({ skillId: 'dwarf_gravity_shot', castId: 'fixture:gravity', status: 'gravity', x: 0, y: .08, z: 0,
    radius: 5, remaining: 5, duration: 5, origin: { x: 0, y: .08, z: 0 } });
  const client = { id: 'player', connected: true, state: { x: -20, z: 0, health: 200, state: 'playing' }, skills: state, progression: {} };
  const room = { clients: new Map([[client.id, client]]), world: { monsters: new Map(enemies.map(enemy => [enemy.id, enemy])), wave: 1 } };
  const ctx = install(context({ collisionWorld: openWorld, damageServerPlayer() {}, damageServerMonster() {} }), 'server',
    ['updateServerSkills', 'updateServerMonsters', 'updateServerMonsterStatus', 'getServerMonsterTarget', 'getPlayingClients']);
  const mean = () => enemies.reduce((sum, enemy) => sum + Math.hypot(enemy.x, enemy.z), 0) / enemies.length;
  const startMean = mean();
  for (let i = 0; i < 180; i++) { ctx.updateServerSkills(room, client, 1 / 60); ctx.updateServerMonsters(room, [client], 1 / 60); }
  let maxPenetration = 0;
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    maxPenetration = Math.max(maxPenetration, a.radius + b.radius - Math.hypot(a.x - b.x, a.z - b.z));
  }
  assert.ok(mean() < startMean - .5, `Insufficient attraction ${startMean} -> ${mean()}`);
  assert.ok(enemies.every(enemy => enemy.pullTimer > 0), 'Not all eligible enemies received pull');
  assert.ok(maxPenetration < .08, `Persistent gravity compression ${maxPenetration}`);
  return { startMean, finalMean: mean(), maxPenetration, bodies: enemies.length, seconds: 3 };
});
test('actual client and server gravity hooks agree while pulling all eligible targets against cover', () => {
  const outputs = [];
  for (const mode of ['client', 'server']) {
    const state = skills.createSkillState('dwarf');
    state.fields.push({ skillId: 'dwarf_gravity_shot', castId: 'parity:gravity', status: 'gravity', x: 2, y: .08, z: 0,
      radius: 5, remaining: 5, duration: 5, origin: { x: 2, y: .08, z: 0 } });
    const enemies = [-2, 0, 2].map((z, i) => ({ ...monster(i + 1, -2, z), radius: .64 }));
    let tick, positions;
    if (mode === 'server') {
      const client = { id: 'player', connected: true, state: { x: -20, z: 0, health: 200, state: 'playing' }, skills: state, progression: {} };
      const room = { clients: new Map([[client.id, client]]), world: { monsters: new Map(enemies.map(e => [e.id, e])) } };
      const ctx = install(context(), 'server', ['updateServerSkills', 'getPlayingClients']);
      tick = () => ctx.updateServerSkills(room, client, .05); positions = () => enemies;
    } else {
      const player = { position: new THREE.Vector3(-20, 0, 0), mesh: { position: new THREE.Vector3(-20, 0, 0) }, health: 200 };
      enemies.forEach(e => { e.mesh = { position: new THREE.Vector3(e.x, 0, e.z) }; });
      const ctx = install(context({ player, multiplayer: { enabled: false }, classSkillState: state, zombies: enemies, monsterProfiles: profiles,
        playSkillsReady() {}, presentClassSkill() {} }), 'client', ['updateClassSkills']);
      tick = () => ctx.updateClassSkills(.05); positions = () => enemies.map(e => ({ ...e, x: e.mesh.position.x, z: e.mesh.position.z }));
    }
    for (let frame = 0; frame < 60; frame++) {
      tick();
      for (const e of positions()) assert.ok(e.x <= -.73999, `${mode}: field crossed cover`);
      near(state.fields[0].x, 2); near(state.fields[0].z, 0);
    }
    assert.ok(enemies.every(e => e.pullTimer > 0));
    const result = positions().map(({ id, x, z }) => ({ id, x, z }));
    assert.ok(result.every(e => e.x > -2)); outputs.push({ mode, positions: result });
  }
  outputs[0].positions.forEach((e, i) => { near(e.x, outputs[1].positions[i].x, 1e-9); near(e.z, outputs[1].positions[i].z, 1e-9); });
  return outputs;
});
test('actual field expiry releases pursuit around the blocking wall without teleporting', () => {
  const w = physics.createCollisionWorld({ colliders: [{ id: 'wall', shape: 'box', x: 0, z: 0, halfX: .1, halfZ: 2, minY: 0, maxY: 3 }], bounds: { x: 0, z: 0, radius: 20 } });
  const enemy = monster(1, -2, 0), state = skills.createSkillState('dwarf'), events = [], hits = [];
  state.fields.push({ skillId: 'dwarf_gravity_shot', castId: 'expiry:gravity', status: 'gravity', x: 2, y: .08, z: 0,
    radius: 5, remaining: 5, duration: 5, origin: { x: 2, y: .08, z: 0 } });
  const client = { id: 'player', connected: true, state: { x: 4, z: 0, health: 200, state: 'playing' }, skills: state, progression: {} };
  const room = { clients: new Map([[client.id, client]]), world: { monsters: new Map([[1, enemy]]), wave: 1 } };
  const ctx = install(context({ collisionWorld: w, broadcast: (_room, message) => { if (message.event) events.push(message.event); },
    damageServerPlayer: () => hits.push(true), damageServerMonster() {} }), 'server',
    ['updateServerSkills', 'updateServerMonsters', 'updateServerMonsterStatus', 'getServerMonsterTarget', 'getPlayingClients']);
  let maximumStep = 0, expiredAt = null, firstHitAt = null;
  for (let frame = 0; frame < 260; frame++) {
    const previous = { x: enemy.x, z: enemy.z };
    ctx.updateServerSkills(room, client, .05); ctx.updateServerMonsters(room, [client], .05);
    maximumStep = Math.max(maximumStep, Math.hypot(enemy.x - previous.x, enemy.z - previous.z));
    const valid = physics.moveActor(w, enemy, { x: 0, z: 0 });
    near(valid.x, enemy.x); near(valid.z, enemy.z); assert.equal(valid.unresolved, false);
    if (frame < 90) assert.ok(enemy.x < 0, 'Field must respect wall before expiry');
    if (!state.fields.length && expiredAt === null) expiredAt = (frame + 1) * .05;
    if (hits.length && firstHitAt === null) firstHitAt = (frame + 1) * .05;
  }
  assert.ok(expiredAt >= 5 && expiredAt <= 5.05 + 1e-9 && firstHitAt > expiredAt && firstHitAt < 12,
    `Expiry/recovery timing failed: ${JSON.stringify({ expiredAt, firstHitAt, maximumStep, pullTimer: enemy.pullTimer, remainingFields: state.fields.length })}`);
  assert.ok(maximumStep <= 4.5 * .05 + 1e-4, 'Unexpected teleport during expiry/pursuit');
  assert.equal(enemy.pullTimer, 0); assert.equal(state.fields.length, 0);
  assert.equal(events.filter(e => e.phase === 'end' && e.castId === 'expiry:gravity').length, 1);
  return { expiredAt, firstHitAt, maximumStep, final: { x: enemy.x, z: enemy.z } };
});
test('actual player spawn hook validates all four slots and rejects impossible topology', () => {
  const ctx = install(context({ collisionWorld: actualWorld }), 'server', ['getSpawnPoint']);
  const positions = Array.from({ length: 4 }, (_, i) => ctx.getSpawnPoint(i));
  for (const p of positions) {
    const resolved = physics.moveActor(actualWorld, { ...p, radius: .64 }, { x: 0, z: 0 });
    near(p.x, resolved.x); near(p.z, resolved.z); assert.equal(resolved.unresolved, false);
    assert.ok(Math.hypot(p.x, p.z) + .64 <= 55);
  }
  const impossible = physics.createCollisionWorld({ colliders: [{ id: 'filled', shape: 'box', x: 0, z: 0, halfX: 100, halfZ: 100 }], bounds: ENVIRONMENT_GROUND });
  const invalid = install(context({ collisionWorld: impossible }), 'server', ['getSpawnPoint']);
  assert.throws(() => invalid.getSpawnPoint(0), /No valid player spawn/);
  return { positions, impossibleTopologyRejected: true };
});
test('actual client and server v2 movement stops at the first real cemetery solid', () => {
  const from = { x: -15.5, z: -6 }, aim = { x: 0, z: -1 };
  const first = physics.sweepStatic(actualWorld, from, { x: from.x, z: from.z - 8 }, .64, { kind: 'actor' });
  assert.equal(first?.colliderId, 'burial-rail-0');
  const start = physics.moveActor(actualWorld, { ...from, radius: .64 }, { x: 0, z: 0 });
  near(start.x, from.x); near(start.z, from.z);
  const results = [];
  for (const mode of ['client', 'server']) for (const slot of [1, 2]) {
    const state = skills.createSkillState('warrior'), actor = { ...from, health: 200, playing: true, runId: 'cemetery' }, events = [];
    let tick, position;
    if (mode === 'server') {
      const client = { id: 'player', state: actor, skills: state, progression: {} }, room = { world: { monsters: new Map() } };
      const ctx = install(context({ collisionWorld: actualWorld, broadcast: (_room, message) => { if (message.event) events.push(message.event); } }), 'server', ['updateServerSkills']);
      tick = () => ctx.updateServerSkills(room, client, .05); position = () => actor;
    } else {
      const player = { position: new THREE.Vector3(from.x, 0, from.z), mesh: { position: new THREE.Vector3(from.x, 0, from.z) }, health: 200 };
      const ctx = install(context({ collisionWorld: actualWorld, player, multiplayer: { enabled: false }, classSkillState: state, zombies: [], monsterProfiles: profiles,
        playSkillsReady() {}, presentClassSkill: event => events.push(event) }), 'client', ['updateClassSkills']);
      tick = () => ctx.updateClassSkills(.05); position = () => player.position;
    }
    assert.equal(skills.beginSkill(state, { slot, aimX: aim.x, aimZ: aim.z }, actor).ok, true);
    for (let frame = 0; frame < 30; frame++) {
      tick(); near(position().x, from.x);
      assert.ok(position().z >= first.z - 1e-5, 'Movement crossed the first real solid');
    }
    near(position().z, first.z, .001);
    const travel = events.filter(e => e.phase === 'travel');
    assert.ok(travel.length && travel.at(-1).terminal); assert.equal(state.active.length, 0);
    for (const event of travel) assert.ok(event.target.z >= first.z - 1e-5);
    results.push({ mode, skillId: skills.getClassSkills('warrior')[slot].id, collider: first.colliderId, x: position().x, z: position().z });
  }
  return results;
});
test('actual gravity and monster hooks preserve real cemetery cover and crowd separation', () => {
  const impact = physics.sweepStatic(actualWorld, { x: -15.5, y: 1.05, z: -6 }, { x: -15.5, y: 1.05, z: -24 }, .3);
  assert.equal(impact?.colliderId, 'burial-rail-0');
  const center = { x: impact.x, z: impact.z }, enemies = [];
  for (let i = 0; i < 80 && enemies.length < 12; i++) {
    const angle = i * 2.39996, radius = 2 + i % 4 * .7;
    const request = { ...monster(i + 1, center.x + Math.cos(angle) * radius, center.z + Math.sin(angle) * radius), radius: .58 };
    const spawn = physics.findFreePosition(actualWorld, request, { maxDistance: 3, actors: enemies });
    if (spawn.found && Math.hypot(spawn.x - center.x, spawn.z - center.z) < 4.8) enemies.push({ ...request, x: spawn.x, z: spawn.z });
  }
  assert.equal(enemies.length, 12, 'Real layout fixture needs twelve initially valid bodies');
  const state = skills.createSkillState('dwarf');
  state.fields.push({ skillId: 'dwarf_gravity_shot', castId: 'cemetery:gravity', status: 'gravity', ...center, y: .08,
    radius: 5, remaining: 5, duration: 5, origin: { ...center, y: .08 } });
  const client = { id: 'player', connected: true, state: { x: 0, z: 0, health: 200, state: 'playing' }, skills: state, progression: {} };
  const room = { clients: new Map([[client.id, client]]), world: { monsters: new Map(enemies.map(e => [e.id, e])), wave: 1 } };
  const ctx = install(context({ collisionWorld: actualWorld, damageServerPlayer() {}, damageServerMonster() {} }), 'server',
    ['updateServerSkills', 'updateServerMonsters', 'updateServerMonsterStatus', 'getServerMonsterTarget', 'getPlayingClients']);
  const mean = () => enemies.reduce((sum, e) => sum + Math.hypot(e.x - center.x, e.z - center.z), 0) / enemies.length;
  const initialMean = mean(); let maximumStep = 0, maximumPenetration = 0;
  for (let frame = 0; frame < 180; frame++) {
    const before = enemies.map(e => ({ x: e.x, z: e.z }));
    ctx.updateServerSkills(room, client, 1 / 60); ctx.updateServerMonsters(room, [client], 1 / 60);
    near(state.fields[0].x, center.x); near(state.fields[0].z, center.z);
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i], free = physics.moveActor(actualWorld, e, { x: 0, z: 0 });
      assert.equal(free.unresolved, false); near(free.x, e.x); near(free.z, e.z);
      assert.ok(Math.hypot(e.x, e.z) + e.radius <= ENVIRONMENT_GROUND.radius + 1e-5);
      maximumStep = Math.max(maximumStep, Math.hypot(e.x - before[i].x, e.z - before[i].z));
      for (let j = i + 1; j < enemies.length; j++) maximumPenetration = Math.max(maximumPenetration,
        e.radius + enemies[j].radius - Math.hypot(e.x - enemies[j].x, e.z - enemies[j].z));
    }
  }
  assert.ok(mean() < initialMean - .2, `Real-layout field failed attraction ${initialMean} -> ${mean()}`);
  assert.ok(maximumStep < .5, 'Unexpected field/crowd displacement');
  assert.ok(maximumPenetration < .01, `Real-layout crowd overlap ${maximumPenetration}`);
  return { collider: impact.colliderId, center, bodies: enemies.length, seconds: 3, initialMean, finalMean: mean(), maximumStep, maximumPenetration };
});

report.sourceChangedDuringRun = JSON.stringify(report.sourceHashes) !== JSON.stringify(hashes());
report.passed = report.tests.filter(test => test.passed).length; report.failed = report.tests.length - report.passed;
fs.writeFileSync(path.join(out, 'physics-integration.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ evidence: path.join(out, 'physics-integration.json'), passed: report.passed, failed: report.failed, sourceChanged: report.sourceChangedDuringRun,
  failures: report.tests.filter(test => !test.passed) }, null, 2));
if (report.failed || report.sourceChangedDuringRun) process.exitCode = 1;
