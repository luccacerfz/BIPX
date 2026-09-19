// Current literal server hooks; controlled CPU fixture, no socket/server mutation.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createCollisionWorld, findFreePosition } from '../../../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../../../src/render/environment-layout.js';

const files = ['server.mjs', 'src/physics/contacts.mjs', 'src/render/environment-layout.js', 'docs/arpg/review/player-start-audit.mjs'];
const hashes = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before = hashes(), source = fs.readFileSync('server.mjs', 'utf8');
function extract(name, next) {
  const a = source.indexOf(`function ${name}(`), b = source.indexOf(`\nfunction ${next}(`, a);
  assert.ok(a >= 0 && b > a, `Missing hook ${name}`);
  return source.slice(a, b);
}
const collisionWorld = createCollisionWorld({ bounds: ENVIRONMENT_GROUND, colliders: getEnvironmentColliders() });
function fixture(slot, kind) {
  const messages = [], sessions = [];
  const context = vm.createContext({ collisionWorld, findFreePosition, crypto,
    playerBaseMaxHealth: 200, serverCharacterProfiles: { warrior: { weapon: 'katana' } },
    normalizeCharacter: () => 'warrior', finishPlayerSession: client => sessions.push(client.id),
    createProgression: () => ({ fixture: true }), createSkillState: () => ({ resource: 100 }),
    skillSnapshot: state => ({ ...state }), ensureRoomWorldActive: () => {}, updatePlayerHistory: () => {},
    sendJson: (_client, data) => messages.push(data), getWorldSnapshot: () => ({ fixture: true }),
    broadcast: () => {}, broadcastLeaderboard: () => {},
  });
  for (const pair of [ ['getSpawnPoint', 'sanitizeRoomId'], ['createInitialPlayerState', 'attachClientSocket'],
    ['getServerCrowdBodies', 'updateServerMonsters'], ['startClientRun', 'getRoom'] ]) {
    vm.runInContext(extract(...pair), context);
  }
  const origin = context.getSpawnPoint(slot);
  const oldState = { ...origin, state: 'dead', health: 0, character: 'warrior', stateVersion: 7, runId: 'preserved-run' };
  const client = { id: 'joining', slot, state: oldState, lastStartRequestId: 'old-request',
    attackCooldowns: new Map([['rifle', 2]]), pendingRewards: new Map([['reward', { amount: 1 }]]),
    skills: { resource: 47 }, progression: { xp: 14 } };
  const room = { clients: new Map([[client.id, client]]), world: { wave: 2, monsters: new Map() } };
  let occupant;
  if (kind === 'player') {
    occupant = { id: 'other', ...origin, radius: .64 };
    room.clients.set('other', { id: 'other', state: { ...origin, state: 'playing', health: 100 } });
  } else if (kind === 'monster' || kind === 'boss' || kind === 'full') {
    // The synthetic 20 m blocker fits the 55 m bounds but covers the 16 m
    // spawn search. This rejection case does not represent an authored monster.
    occupant = { id: 1, ...origin, radius: kind === 'full' ? 20 : kind === 'boss' ? 1.72 : .78,
      health: 100, freezeTimer: 3, stunTimer: 0 };
    room.world.monsters.set(1, occupant);
  }
  if (kind === 'self') Object.assign(client.state, { state: 'playing', health: 100 });
  const beforeState = JSON.stringify(client);
  context.startClientRun(room, client, { character: 'warrior' }, 'new-request');
  if (kind === 'full') {
    assert.equal(messages.length, 1); assert.equal(messages[0].type, 'runStartRejected');
    assert.equal(messages[0].reason, 'no-free-spawn'); assert.equal(client.state, oldState);
    assert.equal(JSON.stringify(client), beforeState); assert.equal(sessions.length, 0);
    assert.equal(client.attackCooldowns.get('rifle'), 2); assert.equal(client.pendingRewards.size, 1);
    return { slot, kind, rejectedBeforeSessionMutation: true };
  }
  assert.equal(messages[0].type, 'runStarted'); assert.equal(sessions.length, 1);
  assert.equal(client.state.state, 'playing'); assert.equal(client.state.stateVersion, 8);
  assert.equal(messages[0].state, client.state);
  const position = { x: client.state.x, z: client.state.z };
  let penetration = null;
  if (occupant) {
    penetration = Math.max(0, .64 + occupant.radius - Math.hypot(position.x - occupant.x, position.z - occupant.z));
    assert.ok(penetration < 1e-8, `Spawn overlaps ${kind}: ${penetration}`);
  } else assert.deepEqual(position, { x: origin.x, z: origin.z });
  return { slot, kind, position, penetration, successfulStarts: sessions.length };
}
const cases = [];
for (const slot of [0, 1, 2, 3]) for (const kind of ['monster', 'boss', 'player', 'self', 'full']) {
  try { cases.push({ ...fixture(slot, kind), passed: true }); }
  catch (error) { cases.push({ slot, kind, passed: false, error: error.stack }); }
}
const after = hashes();
const report = { observedAt: new Date().toISOString(),
  scope: 'Literal startClientRun/createInitialPlayerState/getServerCrowdBodies/getSpawnPoint and real physics/layout; synthetic rooms/occupants. Full-search rejection uses a synthetic 20 m blocker fitting bounds, not an authored monster or a natural crowd. Transport, progression initialization and session accounting are stubs. Does not prove network, client UI, reconnect or complete resource behavior.',
  sourceHashes: before, sourceHashesAfter: after, sourceStable: JSON.stringify(before) === JSON.stringify(after),
  cases, passed: cases.every(row => row.passed) };
const dir = path.resolve('output/qa/arpg-root-review'); fs.mkdirSync(dir, { recursive: true });
const output = path.join(dir, `${report.observedAt.replace(/[:.]/g, '-')}-player-start.json`);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, passed: report.passed, sourceStable: report.sourceStable,
  cases: cases.length, failures: cases.filter(row => !row.passed).map(row => ({ slot: row.slot, kind: row.kind, error: row.error })) }));
if (!report.passed || !report.sourceStable) process.exitCode = 1;
