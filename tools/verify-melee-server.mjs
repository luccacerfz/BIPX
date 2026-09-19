import { relocateServerImports, serverDependencyHashes } from './quality-server-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { evidenceDir } from './quality-browser.mjs';

// Private child-process IPC fixture; no extra HTTP/WS command exists in the
// product. This copy retains every production function and real WS broadcast.
const append = `
process.on('message', request => {
  if (request.type !== 'qa-melee') return;
  try {
    const room = getRoom('melee-contract');
    const client = room.clients.get(request.clientId);
    if (!client) throw Error('Real WebSocket client missing');
    room.world.monsters.clear(); room.world.projectiles.clear();
    room.world.wave = 1; room.world.zombiesToSpawn = 0; room.world.nextWaveDelay = 999;
    Object.assign(client.state, { state: 'playing', x: 0, z: 0, health: 200, maxHealth: 200 });
    const monster = spawnServerMonster(room, 1.5, 0, request.monsterType);
    const initialHealth = client.state.health;
    const snapshots = [];
    const snapshot = label => snapshots.push({ label, health: client.state.health, exists: room.world.monsters.has(monster.id), strike: monster.meleeAttack ? { ...monster.meleeAttack } : null, monster: serializeMonster(monster) });
    const step = (dt, label) => { updateServerMonsters(room, [client], dt); snapshot(label); };
    // Let the real spawn cooldown elapse in normal 50ms server increments.
    for (let warmup = 0; !monster.meleeAttack && warmup < 20; warmup++) updateServerMonsters(room, [client], .05);
    if (!monster.meleeAttack) throw Error('Production monster did not begin a melee attack');
    step(0, 'start');
    if (request.scenario === 'impact') { step(.45, 'windup'); step(.011, 'impact'); step(.43, 'recovery'); }
    if (request.scenario === 'large-step') { step(.9, 'cross-impact-and-end'); step(.001, 'after'); }
    if (request.scenario === 'range') { step(.2, 'windup'); client.state.x = 4; step(.3, 'dodged'); }
    if (request.scenario === 'arc') { step(.2, 'windup'); client.state.x = 2.9; step(.3, 'behind'); }
    if (request.scenario === 'freeze') { step(.2, 'windup'); monster.freezeTimer = 1; step(.5, 'frozen'); }
    if (request.scenario === 'death') { step(.2, 'windup'); damageServerMonster(room, monster, 100000, client.id, 'pistol'); step(.5, 'removed'); }
    if (request.scenario === 'latejoin') { step(.3, 'latejoin-phase'); }
    process.send({ id: request.id, result: { initialHealth, expectedDamage: Math.ceil(monster.damage + Math.floor(room.world.wave * .55)), snapshots, monsterId: monster.id } });
    if (request.scenario !== 'latejoin') { room.world.monsters.clear(); room.world.projectiles.clear(); }
  } catch (error) { process.send({ id: request.id, error: error.stack }); }
});
`;

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-melee-server-'));
const source = fs.readFileSync('server.mjs', 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const timingUrl = pathToFileURL(path.resolve('src/combat/melee-timing.mjs')).href;
assert.ok(source.includes('"./src/combat/melee-timing.mjs"'), 'Shared production timing import missing');
const file = path.join(temporary, 'server.mjs');
fs.writeFileSync(file, relocateServerImports(source) + '\n' + append);
const report = { startedAt: new Date().toISOString(), scope: 'Deterministic private IPC fixture in an isolated copy of the production server plus real native WebSocket clients/broadcasts. Only import relocation and appended test controls differ; production functions are unchanged. This is not natural gameplay or full anti-cheat coverage.', serverSha256: sha(source), dependencyHashes: serverDependencyHashes(), timingSha256: sha(fs.readFileSync('src/combat/melee-timing.mjs')), instrumentationSha256: sha(append), checks: [], passed: false };
const child = spawn(process.execPath, [file], { env: { ...process.env, HOST: '127.0.0.1', PORT: '0', LEADERBOARD_FILE: path.join(temporary, 'leaderboard.json'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
const clients = [], pending = new Map(); let serial = 0, stderr = '';
child.stderr.on('data', bytes => { stderr += bytes; });
child.on('message', message => { const request = pending.get(message.id); if (!request) return; pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error)) : request.resolve(message.result); });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(client, monsterType, scenario) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`IPC timeout ${scenario}`)); }, 5000);
    pending.set(id, { resolve, reject, timer }); child.send({ type: 'qa-melee', id, clientId: client.id, monsterType, scenario });
  });
}
async function message(client, predicate, from = 0, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { const found = client.messages.slice(from).find(predicate); if (found) return found; await wait(5); }
  throw new Error('Expected WebSocket message did not arrive');
}
async function connect(url) {
  const client = { socket: new WebSocket(url), messages: [] }; clients.push(client);
  client.socket.addEventListener('message', event => { const value = JSON.parse(event.data); client.messages.push(value); if (value.type === 'welcome') client.id = value.id; });
  await message(client, value => value.type === 'welcome'); return client;
}
try {
  const base = await new Promise((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error('Isolated server startup timed out')), 8000);
    child.stdout.on('data', bytes => { output += bytes; const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); resolve(`ws://127.0.0.1:${match[1]}/ws?room=melee-contract`); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server startup exited ${code}`)); });
  });
  const client = await connect(`${base}&name=MeleeTarget&character=warrior`);
  const observer = await connect(`${base}&name=Observer&character=dwarf`);
  client.socket.send(JSON.stringify({ type: 'startRun', state: { character: 'warrior' } }));
  const started = await message(client, value => value.type === 'runStarted');
  assert.equal(started.state.state, 'playing');
  for (const type of ['zombie', 'runner']) {
    for (const scenario of ['impact', 'large-step', 'range', 'arc', 'freeze', 'death']) {
      const from = observer.messages.length;
      const result = await fixture(client, type, scenario);
      const start = result.snapshots[0], last = result.snapshots.at(-1);
      assert.equal(start.health, 200); assert.equal(start.strike.elapsed, 0); assert.equal(start.strike.impactTime, .46);
      const damages = scenario === 'impact' || scenario === 'large-step';
      assert.equal(last.health, damages ? 200 - result.expectedDamage : 200, `${type}/${scenario}: wrong authoritative health`);
      if (scenario === 'impact') { assert.equal(result.snapshots[1].health, 200); assert.equal(result.snapshots[2].health, last.health); assert.equal(last.strike.active, false); }
      if (scenario === 'freeze') assert.equal(last.strike.active, false);
      if (scenario === 'death') assert.equal(last.exists, false);
      const attack = await message(observer, value => value.type === 'monsterMelee' && value.monster.id === result.monsterId, from);
      assert.equal(attack.monster.meleeAttack.elapsed, 0);
      assert.equal(attack.monster.meleeAttack.id, start.strike.id);
      if (damages) await message(observer, value => value.type === 'playerDamaged' && value.id === client.id, from);
      await wait(20);
      const damageEvents = observer.messages.slice(from).filter(value => value.type === 'playerDamaged' && value.id === client.id);
      assert.equal(damageEvents.length, damages ? 1 : 0, `${type}/${scenario}: wrong number of damage broadcasts`);
      report.checks.push({ name: `${type}: ${scenario}`, passed: true, result, damageEvents: damageEvents.map(event => ({ amount: event.amount, health: event.state.health, stateVersion: event.state.stateVersion })) });
    }
  }
  const phase = await fixture(client, 'zombie', 'latejoin');
  const late = await connect(`${base}&name=LateObserver&character=dwarf`);
  const welcome = late.messages.find(value => value.type === 'welcome');
  const snapshot = welcome.world.monsters.find(monster => monster.id === phase.monsterId);
  assert.ok(snapshot, 'Late join missed the existing monster');
  assert.equal(snapshot.meleeAttack.id, phase.snapshots.at(-1).strike.id);
  assert.ok(snapshot.meleeAttack.elapsed >= .3 && snapshot.meleeAttack.elapsed <= .88, 'Late join reset or overshot melee phase');
  report.checks.push({ name: 'late join receives existing attack ID and current elapsed phase', passed: true, snapshot });
  assert.equal(sha(fs.readFileSync('server.mjs')), report.serverSha256, 'Server changed during test');
  assert.equal(sha(fs.readFileSync('src/combat/melee-timing.mjs')), report.timingSha256, 'Shared timing changed during test');
  assert.deepEqual(serverDependencyHashes(), report.dependencyHashes);
  assert.equal(stderr, ''); report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  for (const client of clients) client.socket.close();
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('close', resolve)), wait(1000)]);
  if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
  fs.rmSync(temporary, { recursive: true, force: true });
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(evidenceDir, 'melee-server.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, error: report.error, evidenceDirectory: evidenceDir }));
}
