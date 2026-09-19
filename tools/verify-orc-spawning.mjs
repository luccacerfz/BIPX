import { serverDependencyHashes } from './quality-server-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { evidenceDir } from './quality-browser.mjs';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-orc-spawn-'));
const hash = () => crypto.createHash('sha256').update(fs.readFileSync('server.mjs')).digest('hex');
const report = { startedAt: new Date().toISOString(), serverSha256: hash(), dependencyHashes: serverDependencyHashes(), passed: false, evidenceKind: 'scripted_protocol_fixture', scope: 'Real isolated server, deterministic random seed, real wave progression and accepted class attacks. Scripted player positions with base server-owned attack damage and no health grants; not natural browser gameplay or visual asset proof.', observations: [] };
// Reproducible spawn sampling without adding any production diagnostic endpoint.
const seedModule = 'data:text/javascript;base64,' + Buffer.from('let seed=19; Math.random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);').toString('base64');
const server = spawn(process.execPath, ['--import', seedModule, 'server.mjs'], { env: { ...process.env, HOST: '127.0.0.1', PORT: '0', LEADERBOARD_FILE: path.join(temporary, 'leaderboard.json'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  const port = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 5000);
    server.stdout.on('data', bytes => { output += bytes; const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    server.once('error', reject);
  });
  socket = new WebSocket(`ws://127.0.0.1:${port}/ws?room=orc-seeded&character=dwarf&name=SpawnFixture`);
  let welcome, world, authority, runStarted, orc, orcHit, orcKilled, reward;
  const seen = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.type === 'welcome') { welcome = message; world = message.world; authority = message.selfState; }
    if (message.type === 'runStarted') runStarted = message;
    if (message.type === 'runStarted' || message.type === 'playerReward' || (message.id === welcome?.id && message.state)) authority = message.state;
    if (message.type === 'worldState') {
      world = message.world;
      for (const monster of world.monsters) {
        if (!seen.has(monster.id)) seen.set(monster.id, { id: monster.id, type: monster.type, wave: world.wave });
        if (monster.type === 'orcPeon' && !orc) orc = { ...monster, wave: world.wave };
      }
    }
    if (message.type === 'monsterHit' && message.id === orc?.id) orcHit = message;
    if (message.type === 'monsterKilled' && message.monster.id === orc?.id) orcKilled = message;
    if (message.type === 'playerReward' && message.monster.id === orc?.id) reward = message;
  });
  const connectedUntil = Date.now() + 5000;
  while (!welcome && Date.now() < connectedUntil) await wait(10);
  assert.ok(welcome, 'WebSocket welcome missing');
  socket.send(JSON.stringify({ type: 'startRun', requestId: 'orc-natural-waves-fixture', state: { character: 'dwarf' } }));
  const startedUntil = Date.now() + 5000;
  while (!runStarted && Date.now() < startedUntil) await wait(10);
  assert.equal(runStarted?.state.state, 'playing', 'Explicit startRun not acknowledged');
  socket.send(JSON.stringify({ type: 'state', state: { ...authority, x: 0, z: 0 } }));
  const deadline = Date.now() + 90_000;
  while (!reward && Date.now() < deadline) {
    assert.equal(authority.state, 'playing', 'Protocol actor died during real wave progression');
    const target = world?.monsters.find(monster => monster.id === orc?.id) || world?.monsters[0];
    if (target) {
      const aimX = target.x >= 0 ? 1 : -1;
      const x = target.x - aimX * 8;
      socket.send(JSON.stringify({ type: 'state', state: { ...authority, x, z: target.z, aimX, aimZ: 0 } }));
      socket.send(JSON.stringify({ type: 'attack', attack: { kind: 'pistol', weapon: 'pistol', aimX, aimZ: 0, damageMultiplier: 8, cooldownMultiplier: 0.48, areaMultiplier: 1 } }));
    }
    await wait(325);
  }
  const observed = [...seen.values()];
  assert.ok(observed.some(m => m.wave === 1), 'No first-wave spawn observation');
  assert.ok(observed.filter(m => m.wave === 1).every(m => m.type !== 'orcPeon'), 'Orc appeared before wave 2');
  assert.ok(orc && orc.wave >= 2, 'Seeded real wave progression did not spawn Orc Peon');
  assert.ok(orcHit && orcKilled && reward, 'Authoritative Orc hit/kill/reward missing');
  assert.equal(orcHit.amount, 4);
  assert.equal(reward.scoreDelta, 18);
  assert.equal(reward.xp, 5);
  assert.equal(hash(), report.serverSha256);
  assert.deepEqual(serverDependencyHashes(), report.dependencyHashes);
  report.observations = [{ name: 'No Orc during wave 1', samples: observed.filter(m => m.wave === 1).length }, { name: 'Orc appeared during actual wave progression', orc }, { name: 'Rifle damage and Orc kill reward', orcHit, orcKilled, reward }];
  report.spawnSamples = observed;
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  socket?.close();
  server.kill('SIGTERM');
  await wait(100);
  fs.rmSync(temporary, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(evidenceDir, 'orc-spawning.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, evidenceDirectory: evidenceDir, error: report.error }));
}
