import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDir } from './quality-browser.mjs';
import { launchProtocolServer, connectProtocolClient, protocolMessage as message, startProtocolRun, closeProtocolClient as close, delay as wait } from './quality-protocol.mjs';

// Real WebSocket protocol; terminal damage uses private IPC, never a client damage command.
const directory = evidenceDir;
fs.mkdirSync(directory, { recursive: true });
const report = { startedAt: new Date().toISOString(), scope: 'Real isolated HTTP/WebSocket server; terminal damage and collision-valid scene/player arrangement are private IPC fixtures. Browser visuals and persistent identity resumption are separate gates.', checks: [], passed: false };
const clients = [];
const check = (name, details = {}) => report.checks.push({ name, status: 'passed', ...details });
const connect = url => connectProtocolClient(url, clients);
let server;
try {
  server = await launchProtocolServer('class-authority');
  Object.assign(report, server.evidence);
  const base = `${server.wsUrl}?room=class-contract`;
  const dwarf = await connect(`${base}&name=Rifle`);
  const warrior = await connect(`${base}&name=Sword&character=warrior`);
  const observer = await connect(`${base}&name=Observer&character=unknown`);
  assert.equal(self(dwarf).character, 'dwarf');
  assert.equal(self(dwarf).state.weapon, 'pistol');
  assert.equal(self(observer).state.character, 'dwarf');
  assert.equal(self(warrior).character, 'warrior');
  assert.equal(self(warrior).state.weapon, 'katana');
  const joined = await message(dwarf, m => m.type === 'playerJoined' && m.player.id === warrior.id);
  assert.equal(joined.player.character, 'warrior');
  assert.equal(joined.player.state.character, 'warrior');
  check('Missing/invalid character defaults to dwarf; query choice and join snapshots replicate warrior');

  let state = await setState(warrior, observer, { state: 'menu', character: 'dwarf', weapon: 'katana' });
  assert.equal(state.character, 'dwarf'); assert.equal(state.weapon, 'pistol');
  state = await setState(warrior, observer, { state: 'menu', character: 'warrior', weapon: 'pistol' });
  assert.equal(state.character, 'warrior'); assert.equal(state.weapon, 'katana');
  await startProtocolRun(warrior);
  await setState(warrior, observer, { x: 0, z: 25 });
  state = await setState(warrior, observer, { state: 'playing', character: 'dwarf', weapon: 'pistol' });
  assert.equal(state.character, 'warrior'); assert.equal(state.weapon, 'katana');
  state = await setState(warrior, observer, { state: 'playing', character: undefined, weapon: 'orbitOrb' });
  assert.equal(state.character, 'warrior'); assert.equal(state.weapon, 'katana');
  check('Choice can change in menu; in-play mutation and weapon spoofing cannot switch the class');

  const forbidden = ['pistol', 'axe', 'guardianBlade', 'orbitOrb', 'sealRain', 'frostNova', 'boneCannon', 'thunderstaff', 'flamethrower', 'crossbow', 'talisman', 'unknown', 'warrior_war_cry', 'warrior_cleaving_dash', 'warrior_shield_charge'];
  let from = observer.messages.length;
  for (const weapon of forbidden) attack(warrior, { kind: weapon, weapon });
  attack(warrior, { kind: 'katana', weapon: 'pistol' });
  attack(warrior, { kind: 'pistol', weapon: 'katana' });
  await wait(150);
  assert.equal(combatSince(observer, from, warrior.id).length, 0, 'Forbidden warrior attack broadcast or damaged the world');
  attack(warrior, { kind: 'katana', weapon: 'katana', projectileBonus: 6 });
  let accepted = await message(observer, m => m.type === 'playerAttack' && m.id === warrior.id, from);
  assert.equal(accepted.attack.projectileBonus, 0);
  check('Every forbidden warrior basic weapon and mismatched kind/weapon rejected before broadcast or damage; rejected packets do not consume cooldown; warrior projectile bonus zero');

  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana' });
  await wait(130);
  assert.equal(attacksSince(observer, from, warrior.id).length, 0);
  await wait(410);
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana' });
  await message(observer, m => m.type === 'playerAttack' && m.id === warrior.id, from);
  check('Warrior base cooldown suppresses immediate duplicate and permits attack after 500ms');

  await wait(270);
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana', cooldownMultiplier: 0, damageMultiplier: 8, areaMultiplier: 5, projectileBonus: 6 });
  await wait(100);
  assert.equal(attacksSince(observer, from, warrior.id).length, 0, 'Forged cadence bypassed the unupgraded base cooldown');
  await wait(170);
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana', cooldownMultiplier: 0, damageMultiplier: 8, areaMultiplier: 5, projectileBonus: 6 });
  accepted = await message(observer, m => m.type === 'playerAttack' && m.id === warrior.id, from);
  assert.equal(accepted.attack.cooldownMultiplier, 1);
  assert.equal(accepted.attack.damageMultiplier, 2);
  assert.equal(accepted.attack.areaMultiplier, 1);
  assert.equal(accepted.attack.projectileBonus, 0);
  check('Unupgraded warrior ignores forged cadence, damage, area and projectile count; base cooldown still enforced');

  await wait(550);
  let target = await liveTarget(observer);
  await setState(warrior, observer, { state: 'playing', ...positionFor(target, 2.5) });
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana', aimX: positionFor(target, 2.5).aimX, aimZ: 0 });
  let hit = await message(observer, m => m.type === 'monsterHit' && m.sourceId === warrior.id && m.id === target.id, from);
  assert.equal(hit.amount, 14);
  const reward = await message(warrior, m => m.type === 'playerReward');
  assert.ok(reward.totalKills >= 1);
  check('Warrior front-facing melee deals exactly 14 damage from server-owned base multiplier2 and preserves authoritative kill reward', { hit });

  await wait(550);
  target = await liveTarget(observer);
  await setState(warrior, observer, { state: 'playing', ...positionFor(target, 12) });
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana', aimX: positionFor(target, 12).aimX, aimZ: 0 });
  await message(observer, m => m.type === 'playerAttack' && m.id === warrior.id, from);
  await wait(80);
  assert.ok(!observer.messages.slice(from).some(m => m.type === 'monsterHit' && m.id === target.id));
  check('Warrior melee cannot damage a target 12m away');
  await wait(500);
  target = await liveTarget(observer);
  await setState(warrior, observer, { state: 'playing', ...positionFor(target, 2.5) });
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana', aimX: -positionFor(target, 2.5).aimX, aimZ: 0 });
  await message(observer, m => m.type === 'playerAttack' && m.id === warrior.id, from);
  await wait(80);
  assert.ok(!observer.messages.slice(from).some(m => m.type === 'monsterHit' && m.id === target.id));
  check('Warrior cone does not hit a nearby target behind the aim');

  await wait(500);
  target = await liveTarget(observer);
  const remoteOrigin = await setState(warrior, observer, { state: 'playing', x: 0, z: 25 });
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana', x: target.x - 2, z: target.z, aimX: 1, aimZ: 0 });
  accepted = await message(observer, m => m.type === 'playerAttack' && m.id === warrior.id, from);
  assert.equal(accepted.attack.x, remoteOrigin.x); assert.equal(accepted.attack.z, remoteOrigin.z);
  await wait(80);
  assert.ok(!observer.messages.slice(from).some(m => m.type === 'monsterHit' && m.id === target.id));
  check('Attack origin is last accepted player position, not spoofed packet coordinates');

  await startProtocolRun(dwarf);
  await setState(dwarf, observer, { weapon: 'katana', x: 0, z: 25 });
  from = observer.messages.length;
  for (const weapon of ['katana', 'orbitOrb', 'guardianBlade', 'axe', 'frostNova']) attack(dwarf, { kind: weapon, weapon });
  await wait(100);
  assert.equal(combatSince(observer, from, dwarf.id).length, 0);
  target = await liveTarget(observer);
  await setState(dwarf, observer, { state: 'playing', ...positionFor(target, 8) });
  from = observer.messages.length;
  attack(dwarf, { kind: 'pistol', weapon: 'pistol', aimX: positionFor(target, 8).aimX, aimZ: 0 });
  hit = await message(observer, m => m.type === 'monsterHit' && m.sourceId === dwarf.id && m.id === target.id, from);
  assert.equal(hit.amount, 4);
  await message(observer, m => m.type === 'playerAttack' && m.id === dwarf.id, from);
  from = observer.messages.length;
  attack(dwarf, { kind: 'pistol', weapon: 'pistol' });
  await wait(100);
  assert.equal(attacksSince(observer, from, dwarf.id).length, 0);
  await wait(220);
  from = observer.messages.length;
  attack(dwarf, { kind: 'pistol', weapon: 'pistol' });
  await message(observer, m => m.type === 'playerAttack' && m.id === dwarf.id, from);
  check('Dwarf basic attack is rifle-only; intentional skills use separate validated protocol, deals exactly 4 damage from server-owned base multiplier2, and enforces 300ms cooldown', { hit });

  from = observer.messages.length;
  const savedWarrior = { ...warrior.authority };
  await server.killPlayers('class-contract', [warrior.id, dwarf.id]);
  await message(warrior, m => m.type === 'playerDamaged' && m.id === warrior.id && m.state.state === 'dead');
  const deadState = await message(dwarf, m => m.type === 'playerDamaged' && m.id === dwarf.id && m.state.state === 'dead');
  assert.equal(deadState.state.character, 'dwarf');
  await message(observer, m => m.type === 'roomWipe', from);
  await message(observer, m => m.type === 'worldState' && m.world.wave === 0 && m.world.monsters.length === 0 && m.world.projectiles.length === 0, from);
  from = observer.messages.length;
  attack(warrior, { kind: 'katana', weapon: 'katana' });
  attack(dwarf, { kind: 'pistol', weapon: 'pistol' });
  await wait(100);
  assert.equal(observer.messages.slice(from).filter(m => ['playerAttack', 'monsterHit'].includes(m.type)).length, 0);
  check('Death/wipe clears authoritative world and dead players cannot attack');
  state = await setState(warrior, observer, { ...savedWarrior, state: 'playing', health: 200, score: 0, kills: 0, xpTotal: 0 });
  assert.equal(state.state, 'dead'); assert.equal(state.health, 0);
  assert.equal(state.score, savedWarrior.score); assert.equal(state.kills, savedWarrior.kills); assert.equal(state.xpTotal, savedWarrior.xpTotal);
  check('Stale periodic state cannot resurrect dead warrior or roll back earned rewards');
  state = await startProtocolRun(warrior);
  assert.equal(state.health, 200); assert.equal(state.score, 0); assert.notEqual(state.runId, savedWarrior.runId);
  assert.equal(state.character, 'warrior'); assert.equal(state.weapon, 'katana');
  const late = await connect(`${base}&name=Late&character=dwarf`);
  const lateWarrior = late.welcome.players.find(p => p.id === warrior.id);
  assert.equal(lateWarrior.character, 'warrior'); assert.equal(lateWarrior.state.weapon, 'katana');
  await close(late);
  const oldId = warrior.id;
  await close(warrior);
  // Disconnected identities reserve their slot for the real 30s grace. A new
  // room isolates the fresh-identity choice check from reconnect-capacity tests.
  const rejoined = await connect(`${server.wsUrl}?room=class-fresh&name=Sword&character=warrior`);
  assert.notEqual(rejoined.id, oldId);
  assert.equal(self(rejoined).state.character, 'warrior');
  assert.equal(self(rejoined).state.weapon, 'katana');
  check('Death/restart and late join preserve class; explicit choice restores it on fresh-identity rejoin');
  server.assertClean();
  report.passed = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await Promise.allSettled(clients.map(close));
  await server?.stop();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(directory, 'character-authority.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, evidenceDirectory: directory, error: report.error }));
}

function self(client) { return client.welcome.players.find(p => p.id === client.id); }
function positionFor(target, distance) {
  const aimX = target.x >= 0 ? 1 : -1;
  return { x: target.x - aimX * distance, z: target.z, aimX, aimZ: 0 };
}
async function setState(client, observer, fields) {
  if (Number.isFinite(fields.x) && Number.isFinite(fields.z)) Object.assign(fields, await server.placePlayer('class-contract', client.id, fields));
  const from = observer.messages.length;
  client.socket.send(JSON.stringify({ type: 'state', state: { ...client.authority, ...fields } }));
  const accepted = (await message(observer, m => m.type === 'playerState' && m.id === client.id, from)).state;
  client.authority = accepted;
  return accepted;
}
function attack(client, fields) { client.socket.send(JSON.stringify({ type: 'attack', attack: { damageMultiplier: 1, areaMultiplier: 1, ...fields } })); }
function attacksSince(client, from, id) { return client.messages.slice(from).filter(m => m.type === 'playerAttack' && m.id === id); }
function combatSince(client, from, id) { return client.messages.slice(from).filter(m => (m.type === 'playerAttack' && m.id === id) || (['monsterHit', 'monsterKilled', 'playerReward'].includes(m.type) && m.sourceId === id)); }
async function liveTarget(client) {
  return server.arrangeCombat('class-contract');
}
