// Real WebSocket coverage of Upgrades 2.0 on an isolated copy of the production server. Run with cwd = repository root.
// Trusted stacks are set only through private IPC on the server's own progression (or earned through the real
// chooseUpgrade protocol); every client payload in the hostile scenarios tries to grant itself the same power.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchProtocolServer, connectProtocolClient, startProtocolRun, protocolMessage, closeProtocolClient, delay } from './quality-protocol.mjs';
import { createCollisionWorld, sweepStatic, findFreePosition } from '../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';
import * as K from '../src/combat/class-skills.mjs';
import * as H from '../src/combat/hero-power.mjs';
// Hero-power (class armor + kill leech) is always on; the cards must add exactly their own effect on top of it.
const armored = amount => H.resolveIncomingDamage(H.createHeroCombatState('warrior'), Math.ceil(amount), { now: 1 }).damage;
const leechPerKill = H.heroProfile('warrior').leech.perKill * H.heroMaxHealth('warrior');
import * as U from '../src/progression/skill-upgrades.mjs';

const fixture = `
process.on('message', request => {
  if (!String(request.type).startsWith('qa-upgrade-')) return;
  try {
    const room = rooms.get(request.room), client = room?.clients.get(request.clientId);
    if (!client) throw Error('Fixture client missing');
    let result = null;
    if (request.type === 'qa-upgrade-stacks') { Object.assign(client.progression.stacks, request.stacks); syncProgression(client.state, client.progression); client.state.stateVersion++;
      sendJson(client, { type: 'playerState', id: client.id, state: client.state }); result = { mods: skillMods(client.progression), build: client.state.build }; }
    else if (request.type === 'qa-upgrade-xp') { rewardKill(client.state, client.progression, { type: 'zombie', xp: request.xp, x: 900, z: 900 }, { boss: false });
      sendJson(client, { type: 'playerState', id: client.id, state: client.state }); result = { level: client.state.level, offer: client.progression.offer }; }
    else if (request.type === 'qa-upgrade-damage') { const before = client.state.health; damageServerPlayer(room, client, request.amount); result = { before, after: client.state.health }; }
    else if (request.type === 'qa-upgrade-health') { client.state.health = request.health; result = { health: client.state.health }; }
    else if (request.type === 'qa-upgrade-state') result = { x: client.state.x, z: client.state.z, health: client.state.health, score: client.state.score, skills: skillSnapshot(client.skills), mods: skillMods(client.progression), stacks: { ...client.progression.stacks } };
    else throw Error('Unknown upgrade fixture');
    process.send({ id: request.id, result });
  } catch (error) { process.send({ id: request.id, error: error.message }); }
});`;

const evidenceDir = path.resolve(process.env.BIPX_EVIDENCE_DIR || 'output/qa/skill-upgrades');
const server = await launchProtocolServer('skill-upgrades', fixture), clients = [];
const report = { passed: false, scope: 'Isolated production server copy over real WebSocket; private IPC places actors and sets server-side stacks; no render', ...server.evidence, lane: null, scenarios: {}, checks: [] };
const send = (c, m) => c.socket.send(JSON.stringify(m)); let serial = 0;
const near = (a, b, epsilon, label = '') => assert.ok(Math.abs(a - b) <= epsilon, `${label} ${a} != ${b}`);
// The same static world the server builds: find a straight corridor so distances are not cut by scenery.
const world = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND, groundY: ENVIRONMENT_GROUND.y });
function findLane(ahead, behind) {
  for (let x = -24; x <= 24; x += 2) for (let z = -24; z <= 24; z += 2) for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const spot = findFreePosition(world, { x, z, radius: .9 }, { maxDistance: 0.01 }); if (!spot.found || Math.hypot(spot.x - x, spot.z - z) > 1e-6) continue;
    const from = { x: x - dx * behind, y: .1, z: z - dz * behind }, to = { x: x + dx * ahead, y: .1, z: z + dz * ahead };
    if (!sweepStatic(world, from, to, 1.7, { kind: 'actor' }) && !sweepStatic(world, { ...from, y: 1.05 }, { ...to, y: 1.05 }, 1.7, { kind: 'projectile' })) return { x, z, dx, dz };
  }
  throw Error('No clear lane in the environment');
}
const lane = report.lane = findLane(16, 6), along = (meters, side = 0) => ({ x: lane.x + lane.dx * meters - lane.dz * side, z: lane.z + lane.dz * meters + lane.dx * side });
const travelled = position => (position.x - lane.x) * lane.dx + (position.z - lane.z) * lane.dz;
const hostilePayload = { skillMods: Object.fromEntries(Object.keys(K.SKILL_MOD_LIMITS).map(key => [key, K.SKILL_MOD_LIMITS[key][1]])), mods: { dashRange: 3, frostHop: 4, cannonNapalm: 2, warCryDuration: 6 }, dashRange: 3, frostHop: 4,
  upgradeStacks: { dashReach: 3, frostHop: 1, skillThrift: 2, skillHaste: 3 }, stacks: { dashReach: 3 }, cost: 0, cooldown: 0, costMultiplier: .1, cooldownMultiplier: .1, range: 40, buffDuration: 99, resourceMax: 999, damageMultiplier: 99 };

async function join(room, classId) {
  const c = await connectProtocolClient(`${server.wsUrl}?room=${room}&character=${classId}`, clients); await startProtocolRun(c, classId);
  c.room = room; await server.arrangeCombat(room, [{ ...along(15), health: 1e6 }]); // stops the natural waves; scenario targets replace it
  const spot = await server.placePlayer(room, c.id, { x: lane.x, z: lane.z }); near(spot.x, lane.x, 1e-6); near(spot.z, lane.z, 1e-6); return c;
}
const fixtureCall = (c, type, payload = {}) => server.requestFixture(type, { room: c.room, clientId: c.id, ...payload });
async function cast(c, slot, extra = {}) {
  const requestId = `upg-${++serial}`, from = c.messages.length;
  send(c, { type: 'skill', slot, runId: c.authority.runId, requestId, aimX: lane.dx, aimZ: lane.dz, ...extra });
  const result = await protocolMessage(c, m => m.type === 'skillResult' && m.requestId === requestId, from); assert.ok(result.result.ok, `${slot}: ${JSON.stringify(result.result)}`);
  const events = () => c.messages.slice(from).filter(m => m.type === 'skillEvent' && m.id === c.id).map(m => m.event).filter(e => e.castId === result.result.castId);
  const hits = () => c.messages.slice(from).filter(m => m.type === 'monsterHit' && m.sourceId === c.id);
  return { result, events, hits, from };
}
const until = async (predicate, timeoutMs = 9000) => { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { const value = predicate(); if (value) return value; await delay(15); } throw Error(`Timed out: ${predicate}`); };

async function hostileWarrior() {
  const c = await join('upg-hostile-w', 'warrior'), def = K.getClassSkills('warrior');
  const monsters = await server.arrangeCombat(c.room, [{ ...along(3), health: 1 }, { ...along(5), health: 1 }, { ...along(10), health: 1e6 }]);
  await fixtureCall(c, 'qa-upgrade-health', { health: 100 });
  send(c, { type: 'state', state: { x: lane.x, z: lane.z, ...hostilePayload, progression: { upgradeStacks: hostilePayload.upgradeStacks } } });
  const cry = await cast(c, 0, hostilePayload); assert.equal(cry.result.skills.resource, 100 - def[0].cost); assert.equal(cry.result.skills.cooldowns[0], def[0].cooldown);
  const buff = await until(() => cry.events().find(e => e.status === 'buff' && e.phase === 'status')); assert.equal(buff.duration, 8); assert.equal(cry.events().find(e => e.phase === 'cast').mods, undefined);
  await delay(900); const dash = await cast(c, 1, hostilePayload); assert.equal(dash.result.skills.cooldowns[1], def[1].cooldown);
  const end = await until(() => dash.events().find(e => e.phase === 'travel' && e.terminal)); near(travelled(end.actorPosition), 8, .02, 'hostile dash'); await delay(250);
  assert.ok(!dash.hits().some(h => h.id === monsters[2].id), 'hostile dash reached the 10 m target'); assert.equal(dash.events().filter(e => e.phase === 'impact' && e.killed).length, 2);
  const state = await fixtureCall(c, 'qa-upgrade-state'); near(state.health, 100 + 2 * leechPerKill, .02, 'only the class leech without the card'); assert.deepEqual(state.mods, K.NEUTRAL_SKILL_MODS); near(travelled(state), 8, .02);
  await delay(800); const charge = await cast(c, 2, hostilePayload); await until(() => charge.events().find(e => e.phase === 'end')); const hurt = await fixtureCall(c, 'qa-upgrade-damage', { amount: 50 }); near(hurt.before - hurt.after, armored(50), .02, 'no Bastião without the card (class armor only)');
  return { dash: +travelled(end.actorPosition).toFixed(3), buffDuration: buff.duration, resourceAfterCry: cry.result.skills.resource, damageTaken: hurt.before - hurt.after };
}

async function trustedWarrior() {
  const c = await join('upg-trusted-w', 'warrior'), def = K.getClassSkills('warrior');
  const stacks = { dashReach: 3, skillThrift: 2, skillHaste: 3, warCryDuration: 3, warCryBloodlust: 2, chargeBastion: 2 }, expected = U.getSkillMods(stacks, 'warrior');
  const applied = await fixtureCall(c, 'qa-upgrade-stacks', { stacks }); assert.deepEqual(applied.mods, { ...expected }); assert.ok(applied.build.includes('Sede de Sangue x2'), JSON.stringify(applied.build));
  const monsters = await server.arrangeCombat(c.room, [{ ...along(3), health: 1 }, { ...along(5), health: 1 }, { ...along(10), health: 1e6 }]);
  await fixtureCall(c, 'qa-upgrade-health', { health: 100 });
  const cry = await cast(c, 0); assert.equal(cry.result.skills.resource, 100 - K.getSkillCost(def[0], expected)); assert.equal(cry.result.skills.resource, 82); assert.equal(cry.result.skills.cooldowns[0], 9.8);
  assert.deepEqual(cry.events().find(e => e.phase === 'cast').mods, { warCryDuration: 6, warCryKillHeal: 6 });
  const buff = await until(() => cry.events().find(e => e.status === 'buff' && e.phase === 'status')); assert.equal(buff.duration, 14);
  await delay(900); const dash = await cast(c, 1); assert.equal(dash.result.skills.cooldowns[1], K.getSkillCooldown(def[1], expected)); assert.deepEqual(dash.events().find(e => e.phase === 'cast').mods, { dashRange: 3, dashDamage: 1.6 });
  const end = await until(() => dash.events().find(e => e.phase === 'travel' && e.terminal)); near(travelled(end.actorPosition), 11, .02, 'trusted dash'); await delay(250);
  const tank = dash.hits().find(h => h.id === monsters[2].id); assert.ok(tank, 'the 11 m dash reaches the 10 m target'); near(tank.amount, 14 * 2 * 1.35 * 1.6, .011, 'dash damage');
  const state = await fixtureCall(c, 'qa-upgrade-state'); near(state.health, 100 + 2 * leechPerKill + 2 * 6, .02, 'Sede de Sangue heals 6 per kill on top of the class leech'); near(travelled(state), 11, .02);
  await delay(800); const charge = await cast(c, 2); await until(() => charge.events().find(e => e.phase === 'end')); await delay(60);
  const guarded = await fixtureCall(c, 'qa-upgrade-damage', { amount: 50 }); near(guarded.before - guarded.after, armored(50 * .6), .02, 'Bastião 40% before class armor');
  const guard = (await fixtureCall(c, 'qa-upgrade-state')).skills.guard; assert.ok(guard && guard.reduction === .4 && guard.remaining > 3);
  await delay(4200); const open = await fixtureCall(c, 'qa-upgrade-damage', { amount: 50 }); near(open.before - open.after, armored(50), .02, 'Bastião expired');
  return { dash: +travelled(end.actorPosition).toFixed(3), dashDamageOnTank: tank.amount, buffDuration: buff.duration, resourceAfterCry: cry.result.skills.resource, cryCooldown: cry.result.skills.cooldowns[0], healedByKills: state.health - 100, guardedDamage: guarded.before - guarded.after, afterGuard: open.before - open.after };
}

async function hostileDwarf() {
  const c = await join('upg-hostile-l', 'dwarf'); const monsters = await server.arrangeCombat(c.room, [{ ...along(8), health: 1e6 }]);
  send(c, { type: 'state', state: { x: lane.x, z: lane.z, ...hostilePayload } });
  const frost = await cast(c, 1, hostilePayload); assert.equal(frost.result.skills.resource, 100 - 32); await until(() => frost.events().find(e => e.phase === 'impact'));
  assert.ok(!frost.events().some(e => e.mod || e.actorPosition)); let state = await fixtureCall(c, 'qa-upgrade-state'); near(travelled(state), 0, 1e-6, 'hostile hop'); assert.equal(state.skills.movement, null);
  await delay(450); const cannon = await cast(c, 0, hostilePayload); await until(() => cannon.events().find(e => e.phase === 'impact')); await delay(2600);
  const hits = cannon.hits().filter(h => h.id === monsters[0].id && h.hitEffect === 'dwarf_explosive_cannon'); assert.equal(hits.length, 1, 'no napalm without the card'); near(hits[0].amount, 28, .011);
  state = await fixtureCall(c, 'qa-upgrade-state'); assert.equal(state.skills.fields.length, 0); assert.ok(state.skills.resource <= 100);
  return { hop: +travelled(state).toFixed(3), cannonHits: hits.length };
}

async function trustedDwarf() {
  const c = await join('upg-trusted-l', 'dwarf'), stacks = { frostHop: 1, cannonNapalm: 2, frostShatter: 2, resourceMax: 3, resourceRegen: 3 }, expected = U.getSkillMods(stacks, 'dwarf');
  assert.deepEqual((await fixtureCall(c, 'qa-upgrade-stacks', { stacks })).mods, { ...expected });
  const monsters = await server.arrangeCombat(c.room, [{ ...along(8), health: 1e6 }]);
  const frost = await cast(c, 1); assert.deepEqual(frost.events().find(e => e.phase === 'cast').mods, { frostHop: 4, frostShatter: .7 });
  // Hostile: while the authority hops her back, the client insists it is somewhere else.
  const lie = along(9, 3); for (let i = 0; i < 4; i++) { send(c, { type: 'state', state: { x: lie.x, z: lie.z } }); await delay(40); }
  const landed = await until(() => frost.events().find(e => e.mod === 'frostHop' && e.terminal)); near(travelled(landed.actorPosition), -4, .02, 'hop'); const release = await until(() => frost.events().find(e => e.phase === 'release')); near(travelled(release.origin), -4, .02, 'shot leaves from the landing spot');
  assert.ok(c.messages.some(m => m.type === 'positionCorrection'), 'the lie was corrected'); let state = await fixtureCall(c, 'qa-upgrade-state'); near(travelled(state), -4, .05, 'authoritative position');
  await until(() => frost.events().find(e => e.phase === 'status' && e.status === 'freeze'));
  await delay(300); const cannon = await cast(c, 0); await until(() => cannon.events().find(e => e.phase === 'impact')); await delay(4400);
  const hits = cannon.hits().filter(h => h.id === monsters[0].id && h.hitEffect === 'dwarf_explosive_cannon'); near(hits[0].amount, 28 * 1.7, .011, 'Estilhaçar on the frozen target');
  assert.equal(hits.length, 9, `impact + 8 napalm intervals, got ${hits.length}`); for (const tick of hits.slice(1)) assert.ok(Math.abs(tick.amount - 8) < .011 || Math.abs(tick.amount - 13.6) < .011, `napalm tick ${tick.amount}`); assert.ok(hits.slice(1).some(h => Math.abs(h.amount - 8) < .011));
  const fieldEvents = cannon.events().filter(e => e.status === 'napalm'); assert.ok(fieldEvents.length > 10 && fieldEvents.every(e => e.mod === 'cannonNapalm' && e.radius === 3.4)); assert.equal(fieldEvents.at(-1).phase, 'end');
  await delay(3000); state = await fixtureCall(c, 'qa-upgrade-state'); assert.ok(state.skills.resource > 100 && state.skills.resource <= 145, `Reserva Profunda: ${state.skills.resource}`);
  return { hop: +travelled(landed.actorPosition).toFixed(3), cannonOnFrozen: hits[0].amount, napalmTicks: hits.length - 1, napalmAmounts: [...new Set(hits.slice(1).map(h => h.amount))], resourceAbove100: +state.skills.resource.toFixed(1) };
}

// No IPC stack poke here: the cards are earned through the real offer/choice protocol, then the casts must obey them.
async function earnedThroughProtocol() {
  const c = await join('upg-earned', 'warrior'), def = K.getClassSkills('warrior'), chosen = [];
  for (let level = 1; level <= 7; level++) {
    const from = c.messages.length; await fixtureCall(c, 'qa-upgrade-xp', { xp: 10 + level * 7 + Math.floor(level ** 1.35) });
    const offered = await protocolMessage(c, m => m.type === 'playerState' && m.id === c.id && m.state.progression?.offer, from); const offer = offered.state.progression.offer;
    const first = U.getSkillUpgrade(offer.upgradeIds[0]); assert.ok(first && (!first.classId || first.classId === 'warrior'), `first card of the offer: ${offer.upgradeIds[0]}`);
    assert.ok(offer.upgradeIds.every(id => { const card = U.getSkillUpgrade(id); return !card || !card.classId || card.classId === 'warrior'; }), JSON.stringify(offer.upgradeIds));
    if (level === 1) { const forged = `forge-${++serial}`, at = c.messages.length; send(c, { type: 'chooseUpgrade', runId: c.authority.runId, offerId: offer.id, upgradeId: 'cannonPowder', requestId: forged });
      assert.equal((await protocolMessage(c, m => m.type === 'progressionResult' && m.requestId === forged, at)).result.code, 'not-offered'); }
    const requestId = `choose-${++serial}`, at = c.messages.length; send(c, { type: 'chooseUpgrade', runId: c.authority.runId, offerId: offer.id, upgradeId: first.id, requestId, skillMods: hostilePayload.skillMods });
    const result = await protocolMessage(c, m => m.type === 'progressionResult' && m.requestId === requestId, at); assert.ok(result.result.ok, JSON.stringify(result.result)); chosen.push(first.id);
    assert.ok(result.state.build.some(entry => entry.startsWith(first.label)), JSON.stringify(result.state.build));
  }
  const owned = {}; for (const id of chosen) owned[id] = (owned[id] || 0) + 1; const expected = U.getSkillMods(owned, 'warrior'), state = await fixtureCall(c, 'qa-upgrade-state');
  assert.deepEqual(state.mods, { ...expected }); for (const [id, n] of Object.entries(owned)) assert.equal(state.stacks[id], n);
  const cry = await cast(c, 0, hostilePayload); assert.equal(cry.result.skills.cooldowns[0], K.getSkillCooldown(def[0], expected)); near(cry.result.skills.resource, state.skills.resource - K.getSkillCost(def[0], expected), 1.5, 'earned cost');
  const buff = await until(() => cry.events().find(e => e.status === 'buff' && e.phase === 'status')); assert.equal(buff.duration, 8 + expected.warCryDuration);
  await delay(900); const dash = await cast(c, 1, hostilePayload); const end = await until(() => dash.events().find(e => e.phase === 'travel' && e.terminal)); near(travelled(end.actorPosition), 8 + expected.dashRange, .02, 'earned dash');
  return { chosen, mods: Object.fromEntries(Object.entries(expected).filter(([key, value]) => value !== K.NEUTRAL_SKILL_MODS[key])), buffDuration: buff.duration, dash: +travelled(end.actorPosition).toFixed(3) };
}

try {
  const [hostileW, trustedW, hostileL, trustedL, earned] = await Promise.all([hostileWarrior(), trustedWarrior(), hostileDwarf(), trustedDwarf(), earnedThroughProtocol()]);
  report.scenarios = { hostileWarrior: hostileW, trustedWarrior: trustedW, hostileDwarf: hostileL, trustedDwarf: trustedL, earnedThroughProtocol: earned };
  report.checks.push('hostile skill/state payloads (skillMods, mods, stacks, cost, cooldown, range, frostHop…) change nothing: 8 m dash, 8 s buff, full cost/cooldown, no hop, no napalm, no Bastião, no kill heal');
  report.checks.push('server-side stacks apply on the authority: Avanço Implacável 11 m + ×1.6 damage, Economia/Ritmo cost 18 and 9.8 s, Brado Prolongado 14 s, Sede de Sangue +6/kill, Bastião −40% for 4 s then expiry');
  report.checks.push('Lyra: Recuo Tático moves the authoritative position 4 m back (client lies corrected) and the shot leaves from there; Napalm Rúnico = impact + 8 server ticks; Estilhaçar ×1.7 on frozen; Reserva Profunda lifts the cap above 100');
  report.checks.push('cards earned through the real offer/chooseUpgrade protocol: first card always a warrior/class card, forged Lyra card rejected, ranking build lists the card, casts obey the derived mods');
  server.assertClean(); report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  for (const c of clients) await closeProtocolClient(c); await server.stop();
  report.sourceSha256 = Object.fromEntries(['server.mjs', 'src/combat/class-skills.mjs', 'src/progression/skill-upgrades.mjs', 'src/progression/authority.mjs'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  fs.mkdirSync(evidenceDir, { recursive: true }); fs.writeFileSync(path.join(evidenceDir, 'verify-skill-upgrades-server.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify({ passed: report.passed, lane: report.lane, scenarios: report.scenarios, checks: report.checks, failure: report.failure }, null, 1));
}
