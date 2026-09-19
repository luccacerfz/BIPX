import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { relocateServerImports, serverDependencyHashes } from './quality-server-source.mjs';
import { spawn } from 'node:child_process';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fixture = `
process.on('message', request => {
  if (request.type === 'qa-combat-scene') {
    try {
      const room = rooms.get(request.room);
      if (!room) throw Error('Fixture room missing');
      room.world.monsters.clear(); room.world.projectiles.clear(); room.world.zombiesToSpawn = 0; room.world.nextWaveDelay = 1e9;
      const specs = request.targets || [{x:0,z:0,health:7}];
      const result = specs.map(spec => {
        const monster = spawnServerMonster(room, spec.x, spec.z, spec.type || 'zombie');
        if (!monster) throw Error('Fixture monster placement failed');
        monster.speed = 0; monster.attackCooldown = 1e9; monster.health = spec.health || 1000; monster.maxHealth = monster.health;
        return serializeMonster(monster);
      });
      broadcastWorldState(room);
      process.send({id: request.id, result: request.targets ? result : result[0]});
    } catch(error) { process.send({id: request.id, error: error.message}); }
    return;
  }
  if (request.type === 'qa-place-player') {
    try {
      const room = rooms.get(request.room), client = room?.clients.get(request.clientId);
      if (!client) throw Error('Fixture client missing');
      const p = findFreePosition(collisionWorld, { x: request.x, z: request.z, radius: .64 }, {maxDistance: 16});
      if (!p.found) throw Error('Fixture player placement failed');
      client.state.x = p.x; client.state.z = p.z;
      process.send({id: request.id, result: {x:p.x,z:p.z}});
    } catch(error) { process.send({id: request.id, error: error.message}); }
    return;
  }
  if (request.type !== 'qa-terminal-damage') return;
  try {
    const room = rooms.get(request.room);
    if (!room) throw Error('Fixture room missing');
    const states = request.clientIds.map(id => {
      const client = room.clients.get(id);
      if (!client || client.state.state !== 'playing') throw Error('Fixture requires an actual playing client');
      for (let hit = 0; client.state.health > 0 && hit < 6; hit++) damageServerPlayer(room, client, 120);
      if (client.state.state !== 'dead') throw Error('Production damage did not produce terminal death');
      return { id, state: { ...client.state } };
    });
    process.send({ id: request.id, result: states });
  } catch (error) { process.send({ id: request.id, error: error.message }); }
});
`;

// Only private child-process IPC adds test control. Production functions remain
// identical; death, broadcasts and the subsequent room-wipe tick are real.
export async function launchProtocolServer(name, additionalFixture = '') {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), `bipx-${name}-`));
  const source = fs.readFileSync('server.mjs', 'utf8');
  const dependencies = serverDependencyHashes();
  const file = path.join(temporary, 'server.mjs');
  fs.writeFileSync(file, relocateServerImports(source) + fixture + additionalFixture);
  const child = spawn(process.execPath, [file], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', LEADERBOARD_FILE: path.join(temporary, 'leaderboard.json'), SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let stderr = '', serial = 0;
  const pending = new Map();
  child.stderr.on('data', bytes => { stderr += bytes; });
  child.on('message', value => {
    const request = pending.get(value.id);
    if (!request) return;
    pending.delete(value.id); clearTimeout(request.timer);
    value.error ? request.reject(new Error(value.error)) : request.resolve(value.result);
  });
  async function stop() {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Fixture server stopped')); }
    pending.clear();
    const closed = new Promise(resolve => child.once('close', resolve));
    if (child.exitCode === null && !child.signalCode) child.kill('SIGTERM');
    await Promise.race([closed, delay(1000)]);
    if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Isolated protocol server startup timed out')), 8000);
      child.stdout.on('data', bytes => {
        output += bytes;
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Isolated protocol server exited (${code})`)); });
    });
    return {
      wsUrl: `ws://127.0.0.1:${port}/ws`,
      evidence: { serverSha256: hash(source), dependencyHashes: dependencies, instrumentationSha256: hash(fixture + additionalFixture), fixtureScope: 'Isolated production server copy with relocated local imports and private IPC for declared synthetic arrangements. No production functions replaced and no public test command.' },
      requestFixture(type, payload = {}) {
        return new Promise((resolve, reject) => {
          const id = ++serial, timer = setTimeout(() => { pending.delete(id); reject(Error('Fixture IPC timeout')); }, 5000);
          pending.set(id, { resolve, reject, timer }); child.send({ ...payload, type, id });
        });
      },
      arrangeCombat(room, targets) {
        return new Promise((resolve,reject) => {
          const id=++serial, timer=setTimeout(()=>reject(Error('Scene IPC timeout')),5000);
          pending.set(id,{resolve,reject,timer}); child.send({type:'qa-combat-scene',id,room,targets});
        });
      },
      placePlayer(room, clientId, position) {
        return new Promise((resolve,reject) => {
          const id=++serial, timer=setTimeout(()=>reject(Error('Placement IPC timeout')),5000);
          pending.set(id,{resolve,reject,timer}); child.send({type:'qa-place-player',id,room,clientId,...position});
        });
      },
      killPlayers(room, clientIds) {
        return new Promise((resolve, reject) => {
          const id = ++serial;
          const timer = setTimeout(() => { pending.delete(id); reject(new Error('Terminal damage IPC timeout')); }, 5000);
          pending.set(id, { resolve, reject, timer });
          child.send({ type: 'qa-terminal-damage', id, room, clientIds });
        });
      },
      stderr: () => stderr,
      assertClean() {
        assert.equal(fs.readFileSync('server.mjs', 'utf8'), source, 'Production server changed during protocol test');
        assert.deepEqual(serverDependencyHashes(), dependencies, 'Server dependencies changed during protocol test');
        assert.equal(stderr, '', 'Isolated protocol server emitted stderr');
      },
      stop,
    };
  } catch (error) { await stop(); throw error; }
}

export async function protocolMessage(client, predicate, from = 0, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = client.messages.slice(from).find(predicate);
    if (result) return result;
    await delay(10);
  }
  throw new Error(`Timed out waiting for ${predicate.toString()}`);
}

export async function connectProtocolClient(url, clients) {
  const client = { socket: new WebSocket(url), messages: [], latestWorld: null, authority: null };
  clients.push(client);
  client.socket.addEventListener('message', event => {
    const value = JSON.parse(event.data);
    client.messages.push(value);
    if (value.type === 'welcome') { client.welcome = value; client.id = value.id; client.latestWorld = value.world; client.authority = value.selfState; }
    if (value.type === 'worldState') client.latestWorld = value.world;
    if (value.type === 'runStarted' || value.type === 'playerReward' || (value.id === client.id && value.state)) client.authority = value.state;
  });
  await protocolMessage(client, value => value.type === 'welcome');
  return client;
}

export async function startProtocolRun(client, character = client.authority.character) {
  const from = client.messages.length;
  const requestId = crypto.randomUUID();
  client.socket.send(JSON.stringify({ type: 'startRun', requestId, state: { character } }));
  const result = await protocolMessage(client, value => value.type === 'runStarted' && value.requestId === requestId, from);
  assert.equal(result.state.state, 'playing');
  client.authority = result.state;
  return result.state;
}

export async function closeProtocolClient(client) {
  if (client.socket.readyState === WebSocket.CLOSED) return;
  const closed = new Promise(resolve => client.socket.addEventListener('close', resolve, { once: true }));
  client.socket.close();
  await Promise.race([closed, delay(500)]);
}
