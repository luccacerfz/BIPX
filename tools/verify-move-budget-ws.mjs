import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchProtocolServer, connectProtocolClient, startProtocolRun, protocolMessage, closeProtocolClient, delay } from './quality-protocol.mjs';
import { PLAYER_LOCOMOTION_SPEED, MAX_CATCH_UP_DT } from '../src/combat/network-move.mjs';

const cap = PLAYER_LOCOMOTION_SPEED * MAX_CATCH_UP_DT;
const clients = [];
const server = await launchProtocolServer('move-budget-ws');
const report = {
  passed: false,
  scope: 'Isolated PORT 0 copy of the staged production server, private ledger, blanked Supabase. Synthetic teleport spam over a real WebSocket. Not natural gameplay.',
  ...server.evidence,
  cap,
  speed: PLAYER_LOCOMOTION_SPEED,
  maxCatchUpDt: MAX_CATCH_UP_DT,
  checks: [],
};

try {
  const client = await connectProtocolClient(`${server.wsUrl}?room=move&character=warrior`, clients);
  await startProtocolRun(client, 'warrior');
  const placed = await server.placePlayer('move', client.id, { x: 0, z: 0 });
  const origin = { x: placed.x, z: placed.z };
  client.authority = { ...client.authority, x: origin.x, z: origin.z };

  const burstFrom = client.messages.length;
  for (let i = 0; i < 40; i++) {
    client.socket.send(JSON.stringify({ type: 'state', state: { ...client.authority, x: origin.x + 40, z: origin.z } }));
  }
  const firstCorrection = await protocolMessage(client, (m) => m.type === 'positionCorrection', burstFrom, 3000);
  await delay(60);
  const burstCorrections = client.messages.slice(burstFrom).filter((m) => m.type === 'positionCorrection');
  const lastBurst = burstCorrections.at(-1) || firstCorrection;
  const burstDistance = Math.hypot(lastBurst.x - origin.x, lastBurst.z - origin.z);
  assert.ok(burstCorrections.length >= 1, 'instant 40 m spam must produce positionCorrection');
  assert.ok(burstDistance <= cap + 0.08, `burst displacement ${burstDistance} exceeded cap ${cap}`);
  report.checks.push({
    name: 'instant teleport spam is discarded beyond the 0.25 s catch-up cap',
    corrections: burstCorrections.length,
    displacement: burstDistance,
    cap,
  });

  await delay(300);
  const startX = lastBurst.x;
  const startZ = lastBurst.z;
  const waitFrom = client.messages.length;
  client.socket.send(JSON.stringify({ type: 'state', state: { ...client.authority, x: startX + 40, z: startZ } }));
  const accrued = await protocolMessage(client, (m) => m.type === 'positionCorrection', waitFrom, 3000);
  const travelled = Math.hypot(accrued.x - startX, accrued.z - startZ);
  assert.ok(travelled <= cap + 0.08, `accrued step ${travelled} exceeded cap ${cap}`);
  assert.ok(travelled > 0.5, 'accrued move budget should allow a real step under the cap');
  report.checks.push({
    name: 'after 300 ms the server still caps a 40 m request at speed * MAX_CATCH_UP_DT',
    travelled,
    cap,
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
  fs.writeFileSync(path.join(directory, 'move-budget-ws.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.failure, evidenceDirectory: directory }));
}
