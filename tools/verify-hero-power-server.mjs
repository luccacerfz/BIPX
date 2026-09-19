// Real WebSocket against an isolated copy of the production server (tools/quality-protocol.mjs): the authority applies the
// shared hero-power rules (class health, armor, hit-grace, combo finisher, knockback, pierce, leech cap, level power) and
// ignores hostile client values. Monsters are declared synthetic arrangements; incoming hits use private IPC into the
// production damageServerPlayer. Not visual gameplay evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launchProtocolServer, connectProtocolClient, startProtocolRun, protocolMessage, closeProtocolClient, delay } from './quality-protocol.mjs';
import * as H from '../src/combat/hero-power.mjs';
const fixture = `
process.on('message', request => {
  if (request.type !== 'qa-hero-hit' && request.type !== 'qa-hero-health') return;
  try {
    const room = rooms.get(request.room), client = room?.clients.get(request.clientId);
    if (!client || client.state.state !== 'playing') throw Error('Fixture requires an actual playing client');
    const before = client.state.health;
    if (request.type === 'qa-hero-health') { client.state.health = request.health; client.state.stateVersion++; }
    else damageServerPlayer(room, client, request.amount, request.source || null);
    process.send({ id: request.id, result: { before, after: client.state.health, maxHealth: client.state.maxHealth, level: client.progression.level } });
  } catch (error) { process.send({ id: request.id, error: error.message }); }
});
`;
const server = await launchProtocolServer('hero-power', fixture), clients = [], checks = [];
const report = { passed: false, scope: 'Real WebSocket isolated production server with declared synthetic monster arrangements and IPC incoming hits; not visual gameplay', ...server.evidence, checks };
const near = (a, b, eps = .011) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const W = H.HERO_PROFILES.warrior, D = H.HERO_PROFILES.dwarf, room = 'power';
const send = (c, m) => c.socket.send(JSON.stringify(m));
const hit = (c, amount, source) => server.requestFixture('qa-hero-hit', { room, clientId: c.id, amount, source });
const setHealth = (c, health) => server.requestFixture('qa-hero-health', { room, clientId: c.id, health });
const hostile = { x: 999, z: 999, damage: 99999, damageMultiplier: 500, areaMultiplier: 50, cooldownMultiplier: 0, projectileBonus: 9, finisher: true, combo: 3, range: 999, heal: 999, level: 99 };
async function attack(c, weapon, aimX, aimZ, extra = hostile) {
  const from = c.messages.length; send(c, { type: 'attack', attack: { ...extra, kind: weapon, weapon, aimX, aimZ } }); await delay(140);
  const messages = c.messages.slice(from);
  return { hits: messages.filter(m => m.type === 'monsterHit' && m.sourceId === c.id), result: messages.find(m => m.type === 'attackResult'), kills: messages.filter(m => m.type === 'monsterKilled') };
}
const monster = (c, id) => c.latestWorld.monsters.find(m => m.id === id);
try {
  // ---------- Aldric ----------
  let c = await connectProtocolClient(`${server.wsUrl}?room=${room}&character=warrior`, clients);
  let state = await startProtocolRun(c, 'warrior');
  assert.equal(state.maxHealth, W.maxHealth); assert.equal(state.health, W.maxHealth);
  const origin = await server.placePlayer(room, c.id, { x: 0, z: 0 });
  const at = (dx, dz, extra = {}) => ({ x: origin.x + dx, z: origin.z + dz, health: 1000, ...extra });
  let placed = await server.arrangeCombat(room, [at(0, -3), at(3.2, -1.6), at(0, 3.5), at(0, -9), at(-3, -1.5, { type: 'brute' })]);
  const [front, flank, behind, far, brute] = placed.map(m => m.id);
  send(c, { type: 'state', state: { x: origin.x, z: origin.z, aimX: 0, aimZ: -1, health: 99999, maxHealth: 99999, level: 99, state: 'playing' } }); await delay(120);
  assert.equal((await hit(c, 1, null)).maxHealth, W.maxHealth, 'client-reported health/maxHealth/level are ignored');
  await setHealth(c, W.maxHealth);

  const base = W.basic.damage * H.HERO_BASE_DAMAGE_MULTIPLIER;
  let swing = await attack(c, 'katana', 0, -1);
  assert.deepEqual(swing.hits.map(h => h.id).sort(), [front, flank, brute].sort(), 'cleave reaches front + flank + brute, never behind/far');
  for (const h of swing.hits) near(h.amount, base); assert.deepEqual([swing.result.combo, swing.result.finisher], [1, false]);
  const rejected = await attack(c, 'katana', 0, -1); assert.equal(rejected.hits.length, 0); assert.equal(rejected.result, undefined, 'server cadence gate ignores cooldownMultiplier: 0');
  await delay(W.basic.cooldownMs);
  const pushedFront = Math.hypot(monster(c, front).x - origin.x, monster(c, front).z - origin.z), pushedBrute = Math.hypot(monster(c, brute).x - origin.x, monster(c, brute).z - origin.z);
  near(pushedFront, 3 + W.knockback.distance, .12); near(pushedBrute, Math.hypot(3, 1.5) + W.knockback.distance * .35, .12);
  swing = await attack(c, 'katana', 0, -1); assert.deepEqual([swing.result.combo, swing.result.finisher], [2, false]); assert.ok(!swing.hits.some(h => h.id === behind));
  await delay(W.basic.cooldownMs);
  swing = await attack(c, 'katana', 0, -1);
  assert.deepEqual([swing.result.combo, swing.result.finisher], [3, true]);
  assert.ok(swing.hits.some(h => h.id === behind) && !swing.hits.some(h => h.id === far), 'finisher is 360° inside its radius only');
  for (const h of swing.hits) near(h.amount, base * W.combo.finisher.damageMultiplier);
  checks.push('Aldric: class health, hostile state ignored, cleave arc, cadence gate, knockback (brute reduced), 3-hit combo with heavy 360° finisher');

  // Armor + hit-grace through the production damageServerPlayer.
  const armored = 50 * (1 - W.mitigation) - W.plate;
  await setHealth(c, W.maxHealth);
  let r = await hit(c, 50, { type: 'zombie' }); near(r.before - r.after, armored);
  r = await hit(c, 50, { type: 'zombie' }); assert.equal(r.after, r.before, 'second swarm hit inside the window is graced');
  r = await hit(c, 50, { type: 'runner' }); assert.equal(r.after, r.before);
  r = await hit(c, 50, { type: 'brute' }); near(r.before - r.after, armored); // heavy ignores grace
  r = await hit(c, 50, { type: 'zombie', eliteType: 'furious' }); near(r.before - r.after, armored);
  r = await hit(c, 50, { type: 'visor' }); near(r.before - r.after, armored); // boss flag comes from the server table
  r = await hit(c, 50, null); near(r.before - r.after, armored); // projectile / fixture
  await delay(H.INCOMING.graceSeconds * 1000 + 60);
  r = await hit(c, 50, { type: 'zombie' }); near(r.before - r.after, armored);
  checks.push('Aldric: 30% armor + flat plate on every landed hit; swarm melee graced inside the window; brute/elite/boss/projectile always land');

  // Leech: per hit, per kill, shared per-second cap; the client cannot ask for healing.
  await delay(W.basic.cooldownMs + 1100); await setHealth(c, 100);
  placed = await server.arrangeCombat(room, [at(0, -3), at(1.7, -3)]);
  let from = c.messages.length; swing = await attack(c, 'katana', 0, -1); assert.equal(swing.hits.length, 2);
  let healed = await protocolMessage(c, m => m.type === 'playerState' && m.id === c.id && m.state.health > 100, from);
  near(healed.state.health, 100 + 2 * W.leech.perHit * W.maxHealth);
  await delay(1100); await setHealth(c, 100);
  placed = await server.arrangeCombat(room, Array.from({ length: 10 }, (_, i) => at(-3.2 + (i % 5) * 1.6, i < 5 ? -2.2 : -3.8, { health: 1 })));
  swing = await attack(c, 'katana', 0, -1); assert.ok(swing.kills.length >= 8, `kills ${swing.kills.length}`);
  r = await hit(c, 1, null); // read back authoritative health (1 damage × armor)
  near(r.before, 100 + W.leech.capPerSecond * W.maxHealth, .02); assert.ok(r.level >= 2, 'kills levelled the hero through the shared XP curve');
  checks.push(`Aldric: leech ${2 * W.leech.perHit * W.maxHealth} HP for two hits; ${swing.kills.length} kills in one swing healed exactly the ${W.leech.capPerSecond * W.maxHealth} HP/s cap`);

  // Trusted level power: basic attack and skill damage follow the server level, never the payload.
  await delay(W.basic.cooldownMs + 100); const level = r.level;
  placed = await server.arrangeCombat(room, [at(0, -3), at(6, 0)]);
  swing = await attack(c, 'katana', 0, -1); const combo = swing.result.finisher ? W.combo.finisher.damageMultiplier : 1;
  near(swing.hits.find(h => h.id === placed[0].id).amount, base * H.basicPower('warrior', level) * combo);
  from = c.messages.length; send(c, { type: 'skill', slot: 1, runId: c.authority.runId, requestId: 'dash-1', aimX: 1, aimZ: 0, damage: 99999, damageMultiplier: 500, level: 99 });
  const dash = await protocolMessage(c, m => m.type === 'monsterHit' && m.id === placed[1].id && m.hitEffect === 'warrior_cleaving_dash', from);
  near(dash.amount, 14 * H.HERO_BASE_DAMAGE_MULTIPLIER * H.skillPower('warrior', level)); assert.ok(H.skillPower('warrior', level) > 1);
  checks.push(`Aldric level ${level}: basic ×${H.basicPower('warrior', level)} and Corte Devastador ×${H.skillPower('warrior', level)} from server progression; payload damage/level ignored`);
  await server.killPlayers(room, [c.id]); await closeProtocolClient(c);

  // ---------- Lyra ----------
  c = await connectProtocolClient(`${server.wsUrl}?room=${room}&character=dwarf`, clients);
  state = await startProtocolRun(c, 'dwarf'); assert.equal(state.maxHealth, D.maxHealth); assert.equal(state.health, D.maxHealth);
  const spot = await server.placePlayer(room, c.id, { x: 0, z: 0 });
  placed = await server.arrangeCombat(room, [0, 1, 2].map(i => ({ x: spot.x, z: spot.z - 4 - i * 2, health: 1000 })));
  send(c, { type: 'state', state: { x: spot.x, z: spot.z, aimX: 0, aimZ: -1, state: 'playing' } }); await delay(120);
  const shot = await attack(c, 'pistol', 0, -1), rifle = H.rifleShot('dwarf');
  assert.deepEqual(shot.hits.map(h => h.id), [placed[0].id, placed[1].id], 'one ray (projectileBonus: 9 ignored), nearest first, pierce 1');
  near(shot.hits[0].amount, rifle.damage * H.HERO_BASE_DAMAGE_MULTIPLIER); near(shot.hits[1].amount, rifle.damage * H.HERO_BASE_DAMAGE_MULTIPLIER * rifle.pierceFalloff);
  assert.equal(shot.result, undefined); assert.ok(rifle.damage * H.HERO_BASE_DAMAGE_MULTIPLIER >= 4.2 * 1.2, 'opening zombie dies to one shot');
  await delay(300); near(spot.z - monster(c, placed[0].id).z, 4 + D.knockback.distance, .1);
  // Point-blank assist: the cursor ray points east, the body hugs Lyra to the south-east; the authority still hits it.
  placed = await server.arrangeCombat(room, [{ x: spot.x + 1.2, z: spot.z + 1.2, health: 1000 }, { x: spot.x + 6, z: spot.z - 3, health: 1000 }]); await delay(320);
  const hugging = await attack(c, 'pistol', 1, 0); assert.deepEqual(hugging.hits.map(h => h.id), [placed[0].id], 'assist is point-blank only: the far body off the ray is untouched');
  await delay(320);
  r = await hit(c, 50, { type: 'zombie' }); near(r.before - r.after, 50 * (1 - D.mitigation) - D.plate);
  r = await hit(c, 50, { type: 'zombie' }); assert.equal(r.after, r.before);
  await setHealth(c, 50); placed = await server.arrangeCombat(room, [{ x: spot.x, z: spot.z - 4, health: 1 }]); await delay(320);
  const kill = await attack(c, 'pistol', 0, -1); assert.equal(kill.kills.length, 1);
  r = await hit(c, 1, null); near(r.before, 50, .001); // Lyra never leeches
  checks.push('Lyra: 200 HP, 10% armor + grace, one-shot opening zombie, pierce 1 with falloff, stopping power, point-blank assist, no leech, hostile projectileBonus ignored');
  await server.killPlayers(room, [c.id]); await closeProtocolClient(c);
  server.assertClean(); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  for (const c of clients) await closeProtocolClient(c); await server.stop();
  const outDir = process.env.BIPX_EVIDENCE_DIR || 'output/qa/hero-power'; fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(`${outDir}/hero-power-server.json`, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
}
