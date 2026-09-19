import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchProtocolServer, connectProtocolClient, startProtocolRun, protocolMessage, closeProtocolClient, delay } from './quality-protocol.mjs';

const clients = [];
const server = await launchProtocolServer('latejoin-projectiles-ws');
const report = {
  passed: false,
  scope: 'Isolated PORT 0 copy of the staged production server, private ledger, blanked Supabase. Real WebSockets plus private placement IPC. Covers late-join cannon active[] and reconnect of war-cry buff / gravity field. Not natural gameplay.',
  ...server.evidence,
  checks: [],
};

const send = (client, message) => client.socket.send(JSON.stringify(message));
let serial = 0;

async function setup(room, character, position = { x: -4, z: 0 }) {
  const client = await connectProtocolClient(`${server.wsUrl}?room=${room}&character=${character}&name=${room}-${character}`, clients);
  await startProtocolRun(client, character);
  const placed = await server.placePlayer(room, client.id, position);
  client.authority = { ...client.authority, x: placed.x, z: placed.z };
  return client;
}

async function cast(client, slot) {
  const requestId = `focal-${++serial}`;
  const from = client.messages.length;
  send(client, { type: 'skill', requestId, runId: client.authority.runId, slot, aimX: 1, aimZ: 0 });
  const result = await protocolMessage(client, (m) => m.type === 'skillResult' && m.requestId === requestId, from);
  assert.ok(result.result.ok, `skill slot ${slot} rejected: ${JSON.stringify(result.result)}`);
  return { from, castId: result.result.castId, result };
}

async function reconnect(room, previous) {
  const token = previous.welcome.resumeToken;
  const id = previous.id;
  await closeProtocolClient(previous);
  const resumed = await connectProtocolClient(
    `${server.wsUrl}?room=${room}&name=resumed&resumeToken=${encodeURIComponent(token)}`,
    clients,
  );
  assert.equal(resumed.id, id);
  assert.equal(resumed.welcome.resumed, true);
  return resumed;
}

try {
  const cannon = await setup('cannon', 'dwarf');
  const launched = await cast(cannon, 0);
  const flying = await protocolMessage(
    cannon,
    (m) => m.type === 'worldState' && m.world.skillStates.some((s) => s.id === cannon.id && s.skills.active.some((a) => a.skillId === 'dwarf_explosive_cannon' && a.released && !a.done)),
    launched.from,
    2500,
  );
  const active = flying.world.skillStates.find((s) => s.id === cannon.id).skills.active.find((a) => a.skillId === 'dwarf_explosive_cannon');
  const late = await connectProtocolClient(`${server.wsUrl}?room=cannon&name=latejoin`, clients);
  const lateSkills = late.welcome.world.skillStates.find((s) => s.id === cannon.id)?.skills;
  assert.ok(lateSkills, 'late join missing caster skillStates');
  const lateActive = (lateSkills.active || []).find((a) => a.skillId === 'dwarf_explosive_cannon' && a.castId === active.castId);
  assert.ok(lateActive, 'late join welcome omitted in-flight cannon from skillSnapshot.active');
  assert.equal(lateActive.released, true);
  assert.equal(lateActive.done, false);
  report.checks.push({
    name: 'late join receives in-flight dwarf_explosive_cannon on world.skillStates[].skills.active',
    castId: active.castId,
    elapsed: lateActive.elapsed,
  });

  const warrior = await setup('buff-resume', 'warrior');
  const warCry = await cast(warrior, 0);
  await protocolMessage(
    warrior,
    (m) => m.type === 'worldState' && m.world.skillStates.some((s) => s.id === warrior.id && s.skills.buff?.remaining > 6),
    warCry.from,
    3000,
  );
  const remainingBefore = warrior.latestWorld.skillStates.find((s) => s.id === warrior.id).skills.buff.remaining;
  const resumedWarrior = await reconnect('buff-resume', warrior);
  const resumedBuff = resumedWarrior.authority.skills.buff;
  assert.ok(resumedBuff, 'reconnect dropped war-cry buff');
  assert.equal(resumedBuff.skillId, 'warrior_war_cry');
  assert.ok(resumedBuff.remaining > 4, `buff remaining ${resumedBuff.remaining} after resume`);
  report.checks.push({
    name: 'reconnect within 30 s grace keeps war-cry buff on the same identity',
    remainingBefore,
    remainingAfter: resumedBuff.remaining,
  });

  const gravity = await setup('field-resume', 'dwarf');
  const fieldCast = await cast(gravity, 2);
  await protocolMessage(
    gravity,
    (m) => m.type === 'worldState' && m.world.skillStates.some((s) => s.id === gravity.id && s.skills.fields.length > 0),
    fieldCast.from,
    4000,
  );
  const fieldBefore = gravity.latestWorld.skillStates.find((s) => s.id === gravity.id).skills.fields[0];
  const resumedDwarf = await reconnect('field-resume', gravity);
  const fields = resumedDwarf.authority.skills.fields || [];
  assert.equal(fields.length, 1, 'reconnect dropped gravity field');
  assert.equal(fields[0].skillId, 'dwarf_gravity_shot');
  assert.equal(fields[0].castId, fieldBefore.castId);
  assert.ok(fields[0].remaining > 0, 'resumed gravity field has no remaining time');
  report.checks.push({
    name: 'reconnect within 30 s grace keeps gravity field center and remaining time',
    castId: fields[0].castId,
    remainingBefore: fieldBefore.remaining,
    remainingAfter: fields[0].remaining,
  });

  server.assertClean();
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  for (const client of clients) await closeProtocolClient(client);
  await server.stop();
  const directory = process.env.BIPX_EVIDENCE_DIR || 'evidence';
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'latejoin-projectiles-ws.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.failure, evidenceDirectory: directory }));
}
