import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { evidenceDir } from './quality-browser.mjs';
import { launchProtocolServer, connectProtocolClient, protocolMessage, startProtocolRun, closeProtocolClient } from './quality-protocol.mjs';
import { basicAttackSpec, basicPower } from '../src/combat/hero-power.mjs';
import { attackStats } from '../src/progression/authority.mjs';
// Server-owned level-1 rifle hit, read from the modules server.mjs imports (T1 retuned it) and rounded like monsterHit.amount.
const baseRifleHit = Number((basicAttackSpec('dwarf').damage * attackStats({ stacks: {}, character: 'dwarf', weaponTimer: 0, prismStormRemaining: 0 }).damageMultiplier * basicPower('dwarf', 1)).toFixed(2));

// Preserve authoritative world, reward, late-join and room-wipe coverage. The
// isolated server is required because client packets cannot author terminal HP.
const clients = [];
const report = { startedAt: new Date().toISOString(), ok: false, scope: 'Three real WebSocket clients against isolated production server functions; private IPC arranges a stationary target, collision-valid player positions, and applies terminal world damage to trigger the real wipe tick. Not browser or natural gameplay evidence.' };
let server;
try {
  assert.equal(process.argv[2], undefined, 'This suite now owns an isolated server; use verify:multiplayer:browser for the running application.');
  server = await launchProtocolServer('world-authority');
  Object.assign(report, server.evidence);
  const wsUrl = `${server.wsUrl}?room=authoritative-smoke`;
  const first = await connectClient(`${wsUrl}&name=SmokeA`);
  const second = await connectClient(`${wsUrl}&name=SmokeB`);
  await startProtocolRun(first);
  await startProtocolRun(second);
  sendPlayingState(first, 0, 0);
  sendPlayingState(second, 4, 0);

  const fixtureTarget = await server.arrangeCombat('authoritative-smoke');
  const firstWorld = await waitForWorld(first, world => world.monsters.some(m => m.id === fixtureTarget.id));
  const secondWorld = await waitForWorld(second, world => world.monsters.length > 0 && sameIds(world.monsters, firstWorld.monsters));
  const target = firstWorld.monsters[0];
  await server.placePlayer('authoritative-smoke', first.id, {x: target.x - 4, z: target.z});
  sendPlayingState(first, target.x - 4, target.z);
  let killed;
  const hits = [];
  for (let attempt = 0; attempt < 3 && !killed; attempt++) {
    const movingTarget = first.latestWorld?.monsters.find(monster => monster.id === target.id) || target;
    sendPlayingState(first, movingTarget.x - 4, movingTarget.z);
    const from = first.messages.length;
    first.socket.send(JSON.stringify({ type: 'attack', attack: { kind: 'pistol', weapon: 'pistol', aimX: 1, aimZ: 0, damageMultiplier: 8, areaMultiplier: 5 } }));
    const hit = await protocolMessage(first, m => m.type === 'monsterHit' && m.id === target.id, from);
    assert.equal(hit.amount, baseRifleHit, 'Forged multiplier changed server-owned base rifle damage');
    hits.push(hit.amount);
    await new Promise(resolve => setTimeout(resolve, 330));
    killed = first.messages.slice(from).find(m => m.type === 'monsterKilled' && m.monster.id === target.id);
  }
  assert.ok(killed, 'Base rifle shots did not kill authoritative target');
  const reward = await protocolMessage(first, m => m.type === 'playerReward' && m.monster.id === target.id);
  const third = await connectClient(`${wsUrl}&name=SmokeC`);
  await startProtocolRun(third);
  sendPlayingState(third, -4, 0);
  const lateWorld = third.welcome.world;
  // Welcome is an immediate snapshot, while peer broadcasts are periodic.
  // Retain the previously observed peer tick, then compare both clients at an
  // actual shared broadcast so a stale first.latestWorld cannot false-fail.
  report.lateJoinBeforeAlignment = { welcome: { seq: lateWorld.seq, serverTime: lateWorld.serverTime, ids: lateWorld.monsters.map(m => m.id) }, previousPeer: { seq: first.latestWorld.seq, serverTime: first.latestWorld.serverTime, ids: first.latestWorld.monsters.map(m => m.id) } };
  const latestFirstWorld = (await protocolMessage(first, message => message.type === 'worldState' && message.world.epoch === lateWorld.epoch && message.world.serverTime >= lateWorld.serverTime, first.messages.length, 8000)).world;
  const thirdCommonWorld = (await protocolMessage(third, message => message.type === 'worldState' && message.world.seq === latestFirstWorld.seq && message.world.serverTime === latestFirstWorld.serverTime)).world;
  assert.deepEqual(thirdCommonWorld.monsters, latestFirstWorld.monsters, 'Late client and original client disagree on same authoritative tick');
  report.lateJoinCommonTick = { seq: latestFirstWorld.seq, serverTime: latestFirstWorld.serverTime, identical: true };

  assert.ok(firstWorld.monsters.length > 0, 'first client did not receive monsters');
  assert.ok(secondWorld.monsters.length > 0, 'second client did not receive monsters');
  assert.ok(sameIds(firstWorld.monsters, secondWorld.monsters), 'clients did not receive the same monster IDs');
  assert.equal(killed.type, 'monsterKilled', 'attack did not affect the authoritative world');
  assert.ok(reward.totalKills >= 1, 'authoritative kill did not reward the killer');
  assert.ok(Array.isArray(lateWorld.monsters), 'late join did not receive world state');
  assert.ok(lateWorld.monsters.every(monster => latestFirstWorld.monsters.some(known => known.id === monster.id)), 'late join received a different monster layer');

  const beforeWipe = first.messages.length;
  const terminal = await server.killPlayers('authoritative-smoke', clients.map(client => client.id));
  assert.ok(terminal.every(client => client.state.health === 0 && client.state.state === 'dead'));
  const wipe = await protocolMessage(first, message => message.type === 'roomWipe', beforeWipe);
  const resetWorld = (await protocolMessage(first, message => message.type === 'worldState' && message.world.monsters.length === 0 && message.world.projectiles.length === 0 && message.world.wave === 0, beforeWipe)).world;
  assert.equal(wipe.wave, 1, 'room wipe did not reset the room wave');
  assert.equal(resetWorld.zombiesToSpawn, 0, 'room wipe did not clear pending spawns');
  server.assertClean();
  Object.assign(report, {
    ok: true, initialMonsterIds: firstWorld.monsters.map(monster => monster.id).slice(0, 8),
    lateJoinMonsters: lateWorld.monsters.length, wiped: true,
    kill: { monsterId: target.id, totalKills: reward.totalKills, hitAmounts: hits, scoreDelta: reward.scoreDelta, xp: reward.xp },
    terminal: terminal.map(client => ({ id: client.id, health: client.state.health, state: client.state.state, stateVersion: client.state.stateVersion })),
  });
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  await Promise.allSettled(clients.map(closeProtocolClient));
  await server?.stop();
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(evidenceDir, 'multiplayer-world.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, evidenceDirectory: evidenceDir, error: report.error }));
}

function connectClient(url) { return connectProtocolClient(url, clients); }
async function waitForWorld(client, predicate) {
  if (client.latestWorld && predicate(client.latestWorld)) return client.latestWorld;
  return (await protocolMessage(client, m => m.type === 'worldState' && predicate(m.world), client.messages.length, 8000)).world;
}
function sendPlayingState(client, x, z) {
  client.socket.send(JSON.stringify({ type: 'state', state: {
    ...client.authority, x, z, rotation: 0, aimX: 1, aimZ: 0, shooting: false,
  } }));
}
function sameIds(firstMonsters, secondMonsters) {
  const firstIds = firstMonsters.map(monster => monster.id).sort((a, b) => a - b);
  const secondIds = secondMonsters.map(monster => monster.id).sort((a, b) => a - b);
  return firstIds.length === secondIds.length && firstIds.every((id, index) => id === secondIds[index]);
}
