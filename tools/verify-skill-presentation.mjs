import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { evidenceDir } from './quality-browser.mjs';

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('function syncPersistentSkillPresentation(');
const end = source.indexOf('\nfunction updateClassSkills(', start);
assert.ok(start > 0 && end > start);
const vfx = [], sounds = [], remotePlayers = new Map();
const buff = { castId: 'run:1', skillId: 'warrior_war_cry', status: 'buff', remaining: 8, duration: 8, radius: 1.3 };
const field = { castId: 'other:2', skillId: 'dwarf_gravity_shot', status: 'gravity', x: 9, y: .08, z: 2, radius: 5, remaining: 5, duration: 5 };
const context = vm.createContext({
  Map, Object, Boolean, String,
  multiplayer: { enabled: true, connected: true, id: 'self' }, pendingMultiplayerStart: null, multiplayerAuthorityRunId: 'run',
  player: { position: { x: 0, y: 0, z: 0 } }, remotePlayers,
  remoteSkillSnapshots: [{ id: 'self', x: -20, z: -20, skills: { buff } }, { id: 'peer', x: -10, z: -10, skills: { buff: { ...buff, castId: 'other:1' }, fields: [field] } }],
  classSkillState: {}, zombies: [], monsterProfiles: {},
  classSkillVfx: { syncState: value => vfx.push(structuredClone(value)) },
  audioManager: { samples: { playSkillEvent: (value, options) => sounds.push(structuredClone({ value, options })) } },
  THREE: { Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } } },
  getSpatialAudioOptions: () => ({ pan: 0, distance: 0 }), persistentSkillPresentation: new Map(),
});
const suspendedStart = source.indexOf('function isMultiplayerSuspended(');
const suspendedEnd = source.indexOf('\n}', suspendedStart) + 2;
vm.runInContext(source.slice(suspendedStart, suspendedEnd) + '\n' + source.slice(start, end) + '\nthis.sync = syncPersistentSkillPresentation;', context);
const tests = [];
function check(name, run) { run(); tests.push({ name, passed: true }); }
remotePlayers.set('peer', { mesh: { position: { x: 4, y: 0, z: 6 } } });
check('Local and remote buff use rendered positions rather than old network positions', () => {
  context.sync(true);
  assert.deepEqual(vfx.at(-1).buffs.map(b => [b.position.x, b.position.z]), [[0, 0], [4, 6]]);
});
check('Moving presentation refreshes between network packets; audio is not replayed at frame cadence', () => {
  const count = sounds.length;
  for (let frame = 1; frame <= 6; frame++) {
    context.player.position.x = frame / 10;
    remotePlayers.get('peer').mesh.position.z = 6 + frame / 10;
    context.sync(false);
    assert.equal(vfx.at(-1).buffs[0].position.x, frame / 10);
    assert.equal(vfx.at(-1).buffs[1].position.z, 6 + frame / 10);
  }
  assert.equal(sounds.length, count);
});
check('Gravity center/radius/lifetime reach environment without following the caster or mutating authority', () => {
  const before = JSON.stringify(field);
  const area = context.sync(false).find(a => a.skillId === 'dwarf_gravity_shot');
  assert.deepEqual(JSON.parse(JSON.stringify(area.position)), { x: 9, y: .08, z: 2 });
  assert.equal(area.radius, 5); assert.equal(area.remaining, 5);
  assert.equal(JSON.stringify(field), before);
});
check('Living status visuals follow current target position and exclude dead targets', () => {
  context.zombies = [{ id: 8, health: 2, radius: .5, type: 'zombie', freezeTimer: 2, stunTimer: 0, mesh: { position: { x: 3, y: 0, z: 1 } } },
    { id: 9, health: 0, radius: .5, type: 'zombie', freezeTimer: 2, mesh: { position: { x: 4, y: 0, z: 1 } } }];
  context.sync(false); assert.equal(vfx.at(-1).statuses.length, 1);
  context.zombies[0].mesh.position.x = 3.2; context.sync(false);
  assert.equal(vfx.at(-1).statuses[0].position.x, 3.2);
});
check('Suspension cannot renew stale persistent presentation or mutate skill authority', () => {
  context.classSkillState = { resource: 47, cooldowns: [9, 4, 2], sequence: 11 };
  const authority = JSON.stringify(context.classSkillState), count = sounds.length;
  context.multiplayer.connected = false;
  for (let i = 0; i < 150; i++) assert.equal(context.sync(true).length, 0);
  assert.deepEqual(vfx.at(-1), { buffs: [], fields: [], statuses: [] });
  assert.equal(sounds.length, count); assert.equal(JSON.stringify(context.classSkillState), authority);
  context.multiplayer.connected = true;
});
check('Snapshot removal cancels presentation silently and only once', () => {
  context.remoteSkillSnapshots = []; context.zombies = [];
  assert.equal(context.sync(true).length, 0);
  assert.equal(vfx.at(-1).buffs.length + vfx.at(-1).fields.length + vfx.at(-1).statuses.length, 0);
  assert.equal(sounds.filter(s => s.value.phase === 'end').length, 3);
  assert.ok(sounds.filter(s => s.value.phase === 'end').every(s => s.value.reason === 'snapshot-removed'));
  context.sync(true); assert.equal(sounds.filter(s => s.value.phase === 'end').length, 3);
});
const report = { passed: true, scope: 'CPU execution of actual main presentation integration; no native visual/audio approval.', tests,
  mainSha256: crypto.createHash('sha256').update(source).digest('hex'), sourceStable: source === fs.readFileSync('src/main.js', 'utf8') };
assert.ok(report.sourceStable);
fs.writeFileSync(`${evidenceDir}/skill-presentation.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ evidenceDir, ...report }));
