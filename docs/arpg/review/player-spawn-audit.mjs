// Read-only, source-bound CPU diagnostic. No server, browser or gameplay mutation.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createCollisionWorld, findFreePosition } from '../../../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../../../src/render/environment-layout.js';

const files = ['server.mjs', 'src/physics/contacts.mjs', 'src/render/environment-layout.js'];
const hashes = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before = hashes();
const source = fs.readFileSync('server.mjs', 'utf8');
const start = source.indexOf('function getSpawnPoint(');
const end = source.indexOf('\nfunction sanitizeRoomId(', start);
assert.ok(start >= 0 && end > start, 'Bounded spawn-function extraction failed');
const collisionWorld = createCollisionWorld({ bounds: ENVIRONMENT_GROUND, colliders: getEnvironmentColliders() });
const context = vm.createContext({ collisionWorld, findFreePosition });
vm.runInContext(source.slice(start, end), context);

const cases = [];
for (const slot of [0, 1, 2, 3]) {
  const requested = context.getSpawnPoint(slot);
  for (const kind of ['frozen-monster', 'living-player']) {
    const occupant = { id: kind, ...requested, radius: kind === 'living-player' ? .64 : .78,
      health: 100, freezeTimer: kind === 'frozen-monster' ? 3 : 0 };
    // A living world can already contain this actor when another player starts.
    const actual = context.getSpawnPoint(slot);
    const penetration = Math.max(0, .64 + occupant.radius - Math.hypot(actual.x - occupant.x, actual.z - occupant.z));
    const available = findFreePosition(collisionWorld, { id: 'joining-player', ...requested, radius: .64 },
      { maxDistance: 16, actors: [occupant] });
    assert.ok(available.found, 'Fixture needs an available non-overlapping alternative');
    const alternativePenetration = Math.max(0, .64 + occupant.radius - Math.hypot(available.x - occupant.x, available.z - occupant.z));
    assert.ok(alternativePenetration < 1e-8);
    cases.push({ slot, kind, occupant, actual, penetration, available, alternativePenetration,
      spawnAvoidsLivingBody: penetration < 1e-8 });
  }
}
const after = hashes();
const report = { observedAt: new Date().toISOString(),
  scope: 'CPU diagnostic of the literal current server spawn function against real layout/physics. Occupants are synthetic. No protocol, browser or natural-late-join claim.',
  sourceHashes: before, sourceHashesAfter: after, sourceStable: JSON.stringify(before) === JSON.stringify(after),
  cases, passed: cases.every(row => row.spawnAvoidsLivingBody) };
const dir = path.resolve('output/qa/arpg-root-review');
fs.mkdirSync(dir, { recursive: true });
const output = path.join(dir, `${report.observedAt.replace(/[:.]/g, '-')}-player-spawn.json`);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, passed: report.passed, sourceStable: report.sourceStable,
  failingCases: cases.filter(row => !row.spawnAvoidsLivingBody).length,
  maximumPenetration: Math.max(...cases.map(row => row.penetration)) }));
if (!report.sourceStable) process.exitCode = 2;
