// CPU contract of tools/quality-gpu-lock.mjs. Every scenario uses a throw-away BIPX_GPU_LOCK_DIR: the real
// /tmp/bipx-arpg-gpu.lock is never created, read or removed here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const self = fileURLToPath(import.meta.url), mode = process.argv[2];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

if (mode) { // child roles; BIPX_GPU_LOCK_DIR comes from the parent
  const { acquireGpuLock, gpuLockedBrowserType } = await import('./quality-gpu-lock.mjs');
  const say = value => console.log(JSON.stringify(value));
  if (mode === 'hold') { const lease = await acquireGpuLock({ owner: 'holder' }); say({ held: true, token: lease.token }); await delay(Number(process.argv[3])); say({ released: lease.release() }); }
  if (mode === 'wait') { const lease = await acquireGpuLock({ owner: 'waiter' }); say({ waitedMs: lease.waitedMs, inherited: lease.inherited }); lease.release(); }
  if (mode === 'inherit') { const lease = await acquireGpuLock({ owner: 'child' }); say({ inherited: lease.inherited, released: lease.release() }); }
  if (mode === 'selflock') { // a legacy tool reserves the GPU by itself (three owner spellings), then launches through the guarded proxy
    const dir = process.env.BIPX_GPU_LOCK_DIR, spelling = process.argv[3], record = { owner: 'legacy self-locking tool', pid: process.pid, token: '11111111-1111-4111-8111-111111111111', created: new Date().toISOString() };
    fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, spelling === 'owner.json' ? 'owner.json' : 'owner'), spelling === 'text' ? `legacy self-locking tool pid=${process.pid} since=${record.created}\n` : JSON.stringify(record));
    const started = Date.now(), lease = await acquireGpuLock({ owner: 'proxy inside the tool', waitMs: 1500 });
    say({ inherited: lease.inherited, waitedMs: Date.now() - started, released: lease.release(), stillThere: fs.existsSync(dir) }); fs.rmSync(dir, { recursive: true }); // the tool removes its own lock
  }
  if (mode === 'crash') { await acquireGpuLock({ owner: 'crasher' }); say({ held: true }); throw new Error('deliberate crash while holding the reservation'); }
  if (mode === 'signal') { await acquireGpuLock({ owner: 'signalled' }); say({ held: true }); await delay(30_000); }
  if (mode === 'parent') { // holds the lock, then runs a grandchild that must inherit it (by env token or, without it, by parent pid)
    const lease = await acquireGpuLock({ owner: 'parent' });
    const env = { ...process.env, ...(process.argv[3] === 'token' ? lease.env : {}) }; if (process.argv[3] !== 'token') delete env.BIPX_GPU_LOCK_TOKEN;
    const child = spawn(process.execPath, [self, 'inherit'], { env, stdio: ['ignore', 'pipe', 'inherit'] }); let out = '';
    child.stdout.on('data', bytes => { out += bytes; }); await new Promise(resolve => child.on('close', resolve));
    say({ child: JSON.parse(out), stillHeld: fs.existsSync(process.env.BIPX_GPU_LOCK_DIR) }); say({ released: lease.release() });
  }
  if (mode === 'proxy') {
    const calls = [], fake = { name() { return `fake:${this === fake}`; }, async launch(options) { calls.push({ lockedAtLaunch: fs.existsSync(process.env.BIPX_GPU_LOCK_DIR), options }); return { fakeBrowser: true }; } };
    const guarded = gpuLockedBrowserType(fake, 'proxy-test');
    const before = fs.existsSync(process.env.BIPX_GPU_LOCK_DIR), browserOne = await guarded.launch({ headless: true }), browserTwo = await guarded.launch({});
    say({ before, name: guarded.name(), calls, browsers: [browserOne, browserTwo], heldAfterLaunch: fs.existsSync(process.env.BIPX_GPU_LOCK_DIR) });
  }
  process.exit(process.exitCode ?? 0);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-gpu-lock-test-')), checks = [];
let serial = 0;
const lockDir = () => path.join(scratch, `lock-${++serial}`);
function run(dir, args, { env = {}, onStdout } = {}) {
  const child = spawn(process.execPath, [self, ...args], { env: { ...process.env, BIPX_GPU_LOCK_TOKEN: '', BIPX_GPU_LOCK_DIR: dir, BIPX_GPU_LOCK_RETRY_MS: '40', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; onStdout?.(stdout, child); }); child.stderr.on('data', bytes => { stderr += bytes; });
  const done = new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal, stderr, lines: stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) })));
  return { child, done };
}
const check = async (name, body) => { const details = await body(); checks.push({ name, passed: true, details }); console.log(`PASS ${name}`); };

try {
  assert.ok(!scratch.startsWith('/tmp/bipx-arpg-gpu.lock'));
  await check('acquire creates the directory atomically with both owner files; release removes it', async () => {
    const dir = lockDir(); let seen = null;
    const result = await run(dir, ['hold', '250'], { onStdout: () => { if (!seen && fs.existsSync(path.join(dir, 'owner.json'))) seen = { json: JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8')), text: fs.readFileSync(path.join(dir, 'owner'), 'utf8') }; } }).done;
    assert.equal(result.code, 0); assert.ok(seen, 'owner files were not observed while held');
    assert.equal(seen.json.owner, 'holder'); assert.equal(seen.json.token, result.lines[0].token); assert.ok(Number.isInteger(seen.json.pid));
    assert.match(seen.text, new RegExp(`^holder pid=${seen.json.pid} since=\\S+ token=${seen.json.token}\\n$`));
    assert.deepEqual(result.lines[1], { released: true }); assert.equal(fs.existsSync(dir), false);
    return { owner: seen.json.owner, text: seen.text.trim().replace(seen.json.token, '<token>') };
  });
  await check('a second process waits by retrying and acquires only after the holder releases', async () => {
    const dir = lockDir(), holder = run(dir, ['hold', '600']);
    while (!fs.existsSync(dir)) await delay(10);
    const waiter = await run(dir, ['wait']).done, held = await holder.done;
    assert.equal(held.code, 0); assert.equal(waiter.code, 0); assert.equal(waiter.lines[0].inherited, null);
    assert.ok(waiter.lines[0].waitedMs >= 350, `waited only ${waiter.lines[0].waitedMs} ms`); assert.equal(fs.existsSync(dir), false);
    return waiter.lines[0];
  });
  await check("someone else's reservation is never removed: the wait times out with the owner in the message", async () => {
    const dir = lockDir(); fs.mkdirSync(dir); fs.writeFileSync(path.join(dir, 'owner'), 'fable-other natural-dwarf pid=1 since=2026-09-19T12:00:55.932Z\n');
    const result = await run(dir, ['wait'], { env: { BIPX_GPU_LOCK_WAIT_MS: '300' } }).done;
    assert.notEqual(result.code, 0); assert.match(result.stderr, /GPU lock busy after \d+ s: fable-other natural-dwarf pid=1/);
    assert.equal(fs.readFileSync(path.join(dir, 'owner'), 'utf8'), 'fable-other natural-dwarf pid=1 since=2026-09-19T12:00:55.932Z\n');
    return { exit: result.code };
  });
  await check('release leaves the directory alone when the token on disk is no longer ours', async () => {
    const dir = lockDir();
    const result = await run(dir, ['hold', '400'], { onStdout: () => { const file = path.join(dir, 'owner.json'); if (fs.existsSync(file) && !fs.readFileSync(file, 'utf8').includes('intruder')) fs.writeFileSync(file, JSON.stringify({ owner: 'intruder', pid: 1, token: '00000000-0000-4000-8000-000000000000' })); } }).done;
    assert.deepEqual(result.lines[1], { released: false }); assert.match(result.stderr, /no longer ours/); assert.ok(fs.existsSync(dir));
    return { kept: fs.readdirSync(dir) };
  });
  for (const [how, expected] of [['token', 'BIPX_GPU_LOCK_TOKEN'], ['pid', 'parent process']]) await check(`a child inherits its parent's reservation by ${how} and cannot release it`, async () => {
    const dir = lockDir(), result = await run(dir, ['parent', how]).done;
    assert.equal(result.code, 0, result.stderr); assert.deepEqual(result.lines[0], { child: { inherited: expected, released: false }, stillHeld: true });
    assert.deepEqual(result.lines[1], { released: true }); assert.equal(fs.existsSync(dir), false);
    return result.lines[0];
  });
  for (const spelling of ['owner.json', 'json-in-owner', 'text']) await check(`a tool that reserved the GPU itself (${spelling}) never waits on its own reservation`, async () => {
    const dir = lockDir(), result = await run(dir, ['selflock', spelling]).done;
    assert.equal(result.code, 0, result.stderr); const [out] = result.lines;
    assert.equal(out.inherited, 'same process'); assert.ok(out.waitedMs < 1000, `waited ${out.waitedMs} ms on itself`); assert.equal(out.released, false); assert.equal(out.stillThere, true);
    return out;
  });
  await check('an uncaught error still releases the reservation on exit', async () => {
    const dir = lockDir(), result = await run(dir, ['crash']).done;
    assert.notEqual(result.code, 0); assert.match(result.stderr, /deliberate crash/); assert.equal(fs.existsSync(dir), false);
    return { exit: result.code };
  });
  await check('SIGTERM releases the reservation and keeps the signal semantics', async () => {
    const dir = lockDir(), result = await run(dir, ['signal'], { onStdout: (_out, child) => child.kill('SIGTERM') }).done;
    assert.equal(result.signal, 'SIGTERM'); assert.equal(fs.existsSync(dir), false);
    return { signal: result.signal };
  });
  await check('the browser-type proxy reserves before the first launch, keeps the lease for later launches and passes everything else through', async () => {
    const dir = lockDir(), result = await run(dir, ['proxy']).done;
    assert.equal(result.code, 0, result.stderr); const [out] = result.lines;
    assert.equal(out.before, false); assert.equal(out.name, 'fake:true'); assert.equal(out.heldAfterLaunch, true);
    assert.deepEqual(out.calls, [{ lockedAtLaunch: true, options: { headless: true } }, { lockedAtLaunch: true, options: {} }]);
    assert.deepEqual(out.browsers, [{ fakeBrowser: true }, { fakeBrowser: true }]); assert.equal(fs.existsSync(dir), false, 'exit hook must release');
    return out.calls.length;
  });
  const report = { passed: true, checks, scope: 'Child-process contract of the shared GPU reservation in throw-away directories; the real lock path is never touched.' };
  if (process.env.BIPX_EVIDENCE_DIR) { fs.mkdirSync(process.env.BIPX_EVIDENCE_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.BIPX_EVIDENCE_DIR, 'gpu-lock.json'), `${JSON.stringify(report, null, 2)}\n`); }
  console.log(JSON.stringify({ passed: true, checks: checks.length }));
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
