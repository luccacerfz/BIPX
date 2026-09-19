#!/usr/bin/env node
// Synthetic CPU/protocol fixture. Isolated PORT 0 game server + fake Supabase REST.
// Not natural gameplay and not an AAA proof. No production secrets.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { sanitizedChildEnv } from './lib/child-env.mjs';
import { connectProtocolClient, startProtocolRun, closeProtocolClient, delay } from './quality-protocol.mjs';
import { createFakeSupabase, SYNTHETIC_HISTORY } from './fake-supabase-ranking.mjs';

const report = { passed: false, scope: 'Isolated fake Supabase REST and PORT 0 server copy. Synthetic startRun/finish only to exercise ranking persist gates. Not AAA gameplay.', checks: [] };
const check = (name, details = {}) => { report.checks.push({ name, ...details }); };

function spawnGame({ env, cwd }) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd,
    env: sanitizedChildEnv(env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '', stderr = '';
  child.stdout.on('data', (bytes) => { stdout += bytes; });
  child.stderr.on('data', (bytes) => { stderr += bytes; });
  const closed = new Promise((resolve) => child.once('close', resolve));
  return {
    child,
    stderr: () => stderr,
    async ready() {
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`startup timeout stdout=${stdout} stderr=${stderr}`)), 12000);
        const onData = () => {
          const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)/);
          if (match) { clearTimeout(timer); resolve(match[1]); }
        };
        onData();
        child.stdout.on('data', onData);
        child.once('error', (error) => { clearTimeout(timer); reject(error); });
        child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`exit ${code} stderr=${stderr}`)); });
      });
      return { origin: `http://127.0.0.1:${port}`, ws: `ws://127.0.0.1:${port}/ws` };
    },
    async stop() {
      if (child.exitCode === null && !child.signalCode) child.kill('SIGTERM');
      await Promise.race([closed, delay(1500)]);
      if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
    },
  };
}

async function playOnce(wsUrl, room, name) {
  const clients = [];
  const client = await connectProtocolClient(`${wsUrl}?room=${room}&name=${encodeURIComponent(name)}&character=warrior`, clients);
  await startProtocolRun(client, 'warrior');
  await delay(80);
  await closeProtocolClient(client);
  return client;
}

async function welcomeSnapshot(wsUrl, room, name) {
  const clients = [];
  const client = await connectProtocolClient(`${wsUrl}?room=${room}&name=${encodeURIComponent(name)}&character=warrior`, clients);
  const snapshot = client.welcome?.leaderboard || null;
  await closeProtocolClient(client);
  return snapshot;
}

const cwd = process.cwd();
const evidence = process.env.BIPX_EVIDENCE_DIR || path.join(cwd, 'evidence');
fs.mkdirSync(evidence, { recursive: true });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-ranking-guard-'));
const fake = createFakeSupabase();
let fakeHandle;
let game;

try {
  fakeHandle = await fake.listen();
  const supabaseEnv = {
    HOST: '127.0.0.1',
    PORT: '0',
    LEADERBOARD_FILE: path.join(temp, 'unused-leaderboard.json'),
    SUPABASE_URL: fakeHandle.origin,
    SUPABASE_SERVICE_ROLE_KEY: 'test-role-not-a-secret',
  };

  fake.down();
  game = spawnGame({ cwd, env: supabaseEnv });
  const endpoints = await game.ready();

  const first = await fetch(`${endpoints.origin}/api/leaderboard`);
  const firstBody = await first.json();
  assert.equal(first.status, 503);
  assert.equal(firstBody.error, 'leaderboard_unavailable');
  assert.equal(firstBody.unavailable, true);
  assert.equal(firstBody.available, false);
  assert.deepEqual(firstBody.players, []);
  const downWelcome = await welcomeSnapshot(endpoints.ws, 'guard-down-welcome', 'Watcher');
  assert.equal(downWelcome?.available, false);
  check('startup GET is 503 compatible payload while supabase is down');

  await playOnce(endpoints.ws, 'guard-down', 'Runner');
  await delay(1200);
  assert.equal(fake.posts.length, 0, 'no POST while history unloaded');
  const stillDown = await fetch(`${endpoints.origin}/api/leaderboard`);
  assert.equal(stillDown.status, 503);
  assert.equal((await stillDown.json()).available, false);
  check('startRun/finish while unavailable issues zero supabase POSTs');

  fake.restore(SYNTHETIC_HISTORY);
  const restored = await fetch(`${endpoints.origin}/api/leaderboard`);
  const restoredBody = await restored.json();
  assert.equal(restored.status, 200);
  assert.equal(restoredBody.error, undefined);
  assert.equal(restoredBody.available, true);
  const guard = restoredBody.players.find((row) => row.name === 'GuardA');
  assert.ok(guard, 'synthetic history missing after restore');
  assert.equal(guard.gamesPlayed, 5);
  assert.equal(guard.totalScore, 900);
  assert.equal(fake.posts.length, 0, 'GET restore must load before any save');
  const upWelcome = await welcomeSnapshot(endpoints.ws, 'guard-up-welcome', 'Watcher2');
  assert.equal(upWelcome?.available, true);
  check('GET after restore loads history first; gamesPlayed 5 / totalScore 900 intact');

  await playOnce(endpoints.ws, 'guard-up', 'GuardA');
  await delay(1200);
  assert.ok(fake.posts.some((post) => post.table === 'players'), 'authorized persist should POST players');
  const posted = fake.posts.filter((post) => post.table === 'players').at(-1).rows.find((row) => row.player_key === 'guarda');
  assert.ok(posted);
  assert.ok(posted.games_played >= 5, `history reduced: games_played=${posted.games_played}`);
  assert.ok(posted.total_score >= 900, `history reduced: total_score=${posted.total_score}`);
  const afterPlay = await fetch(`${endpoints.origin}/api/leaderboard`);
  const afterBody = await afterPlay.json();
  const guardAfter = afterBody.players.find((row) => row.name === 'GuardA');
  assert.equal(afterPlay.status, 200);
  assert.ok(guardAfter.gamesPlayed >= 5);
  assert.ok(guardAfter.totalScore >= 900);
  check('later authorized run persists without reducing loaded history', { gamesPlayed: guardAfter.gamesPlayed, totalScore: guardAfter.totalScore });

  await game.stop();

  fake.restore(SYNTHETIC_HISTORY);
  game = spawnGame({ cwd, env: supabaseEnv });
  const hydrated = await game.ready();
  const loaded = await fetch(`${hydrated.origin}/api/leaderboard`);
  assert.equal(loaded.status, 200);
  assert.equal((await loaded.json()).players[0].gamesPlayed, 5);
  fake.down();
  const cached = await fetch(`${hydrated.origin}/api/leaderboard`);
  const cachedBody = await cached.json();
  assert.equal(cached.status, 200);
  assert.equal(cachedBody.available, true);
  assert.equal(cachedBody.players[0].name, 'GuardA');
  assert.equal(cachedBody.players[0].gamesPlayed, 5);
  check('late supabase failure keeps hydrated cache and GET 200');
  await game.stop();

  const fileLedger = path.join(temp, 'file-leaderboard.json');
  game = spawnGame({
    cwd,
    env: {
      HOST: '127.0.0.1',
      PORT: '0',
      LEADERBOARD_FILE: fileLedger,
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
  });
  const fileEndpoints = await game.ready();
  const fileGet = await fetch(`${fileEndpoints.origin}/api/leaderboard`);
  assert.equal(fileGet.status, 200);
  assert.equal((await fileGet.json()).available, true);
  await playOnce(fileEndpoints.ws, 'guard-file', 'FileQA');
  await delay(1200);
  const fileAfter = await fetch(`${fileEndpoints.origin}/api/leaderboard`);
  const fileBody = await fileAfter.json();
  assert.equal(fileAfter.status, 200);
  assert.ok(fileBody.players.some((row) => row.name === 'FileQA' && row.gamesPlayed >= 1));
  assert.equal(fs.existsSync(fileLedger), true);
  check('file backend still loads empty ledger and persists');
  await game.stop();

  fake.malformed('object');
  fake.posts.length = 0;
  game = spawnGame({ cwd, env: supabaseEnv });
  const malformedEndpoints = await game.ready();
  const malformedObject = await fetch(`${malformedEndpoints.origin}/api/leaderboard`);
  const malformedObjectBody = await malformedObject.json();
  assert.equal(malformedObject.status, 503);
  assert.equal(malformedObjectBody.available, false);
  await playOnce(malformedEndpoints.ws, 'guard-malformed-object', 'Runner');
  await delay(1200);
  assert.equal(fake.posts.length, 0);
  fake.malformed('null');
  const malformedNull = await fetch(`${malformedEndpoints.origin}/api/leaderboard`);
  const malformedNullBody = await malformedNull.json();
  assert.equal(malformedNull.status, 503);
  assert.equal(malformedNullBody.available, false);
  await playOnce(malformedEndpoints.ws, 'guard-malformed-null', 'Runner');
  await delay(1200);
  assert.equal(fake.posts.length, 0);
  check('REST 200 object/null does not hydrate; GET stays 503 available:false with zero POST');
  await game.stop();

  fake.down();
  fake.setDelay(0);
  fake.posts.length = 0;
  game = spawnGame({ cwd, env: supabaseEnv });
  const slow = await game.ready();
  fake.restore(SYNTHETIC_HISTORY);
  fake.setDelay(400);
  fake.gets.players = 0;
  fake.gets.sessions = 0;
  const started = Date.now();
  const [left, right] = await Promise.all([
    fetch(`${slow.origin}/api/leaderboard`),
    fetch(`${slow.origin}/api/leaderboard`),
  ]);
  const elapsed = Date.now() - started;
  const leftBody = await left.json();
  const rightBody = await right.json();
  assert.equal(left.status, 200);
  assert.equal(right.status, 200);
  assert.equal(leftBody.available, true);
  assert.equal(rightBody.available, true);
  assert.equal(fake.gets.players, 1, `single-flight expected one players GET, got ${fake.gets.players}`);
  assert.equal(fake.gets.sessions, 1, `single-flight expected one sessions GET, got ${fake.gets.sessions}`);
  assert.ok(elapsed >= 350, `delay not observed (${elapsed}ms)`);
  assert.equal(fake.posts.length, 0);
  check('concurrent initial GETs share one delayed load and do not POST', { elapsed, playerGets: fake.gets.players });

  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  process.exitCode = 1;
} finally {
  await game?.stop();
  await fakeHandle?.close();
  report.fakePosts = fake.posts.map((post) => ({ table: post.table, rows: post.rows.length }));
  fs.writeFileSync(path.join(evidence, 'ranking-guard.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, error: report.failure, evidence }));
}
