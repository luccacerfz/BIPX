// Shared GPU/browser reservation for every BIPX harness.
//
// Convention (docs/arpg/README.md): one directory, created atomically with mkdir, serialises all GPU/browser work on this host.
//   /tmp/bipx-arpg-gpu.lock/owner       one text line, `<owner> pid=<pid> since=<iso> token=<uuid>` (what shell agents write and read)
//   /tmp/bipx-arpg-gpu.lock/owner.json  {owner,pid,token,created,argv} (what the older Node harnesses write and read)
// A third spelling exists in the wild and is understood when reading: the same JSON object written into `owner` itself
// (tools/verify-device-report.mjs). Missing it made that tool wait on its own reservation once it launched through the proxy.
// Rules: wait by retrying every 2 s for up to 25 min, release in `finally`, and never remove a reservation that is not ours.
//
// A lease is *inherited* (nothing is acquired or released here) when the reservation already belongs to this process tree:
//   - BIPX_GPU_LOCK_TOKEN matches the token on disk (tools/run-quality-suite.mjs holds the lock for the suite it spawned), or
//   - the recorded pid is this process or its parent (legacy self-locking tools, `arpg-gpu-run.mjs`/`animation-with-gpu.mjs` wrappers).
//
// Environment: BIPX_GPU_LOCK_DIR (tests only), BIPX_GPU_LOCK_WAIT_MS (default 1 500 000), BIPX_GPU_LOCK_RETRY_MS (default 2000).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const GPU_LOCK_DIR = process.env.BIPX_GPU_LOCK_DIR || '/tmp/bipx-arpg-gpu.lock';
const number = (value, fallback) => Number.isFinite(Number(value)) && Number(value) >= 0 && value !== undefined && value !== '' ? Number(value) : fallback;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let held = null; // one reservation per process, reference counted

export function readGpuLockOwner(dir = GPU_LOCK_DIR) {
  if (!fs.existsSync(dir)) return null;
  const owner = { dir, owner: null, pid: null, token: null, since: null };
  try { Object.assign(owner, JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8'))); } catch { /* text-only or still being written */ }
  try {
    const text = fs.readFileSync(path.join(dir, 'owner'), 'utf8').trim(); owner.text = text;
    let json = null; try { json = JSON.parse(text); } catch { /* the plain text line */ }
    if (json && typeof json === 'object') { owner.owner ??= json.owner ?? null; owner.pid ??= Number(json.pid) || null; owner.token ??= json.token ?? null; owner.since ??= json.created ?? json.since ?? json.at ?? null; }
    owner.owner ??= text.split(/\s+pid=/)[0] || null;
    owner.pid ??= Number(text.match(/\bpid=(\d+)/)?.[1]) || null;
    owner.token ??= text.match(/\btoken=([0-9a-f-]{36})/)?.[1] ?? null;
    owner.since ??= text.match(/\bsince=(\S+)/)?.[1] ?? null;
  } catch { /* owner.json only */ }
  owner.since ??= owner.created ?? owner.at ?? owner.startedAt ?? null;
  owner.alive = owner.pid ? (() => { try { process.kill(owner.pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } })() : null;
  return owner;
}

const describe = owner => !owner ? 'free' : `${owner.owner ?? 'unknown owner'} pid=${owner.pid ?? '?'}${owner.since ? ` since=${owner.since}` : ''}${owner.alive === false ? ' (pid is not running: looks stale, but only its owner or a human may remove it)' : ''}`;

function inheritedFrom(owner) {
  if (!owner) return null;
  if (owner.token && process.env.BIPX_GPU_LOCK_TOKEN === owner.token) return 'BIPX_GPU_LOCK_TOKEN';
  if (owner.pid && owner.pid === process.pid) return 'same process';
  if (owner.pid && owner.pid === process.ppid) return 'parent process';
  return null;
}

function releaseSync() {
  const lease = held; held = null;
  if (!lease || lease.inherited) return false;
  for (const [signal, handler] of lease.signalHandlers) process.off(signal, handler);
  const owner = readGpuLockOwner(lease.dir);
  if (!owner || owner.token !== lease.token) { lease.log(`GPU lock at ${lease.dir} is no longer ours (${describe(owner)}); left untouched`); return false; }
  fs.rmSync(lease.dir, { recursive: true, force: true });
  return true;
}
process.on('exit', releaseSync);

/**
 * Reserves the GPU for this process. Resolves to a lease; call `lease.release()` in `finally` (the process exit hook is only a net).
 * Nested calls share the reservation. Throws after `waitMs` with the current owner in the message.
 */
export async function acquireGpuLock({ owner = path.basename(process.argv[1] || 'node'), dir = GPU_LOCK_DIR,
  waitMs = number(process.env.BIPX_GPU_LOCK_WAIT_MS, 25 * 60 * 1000), retryMs = number(process.env.BIPX_GPU_LOCK_RETRY_MS, 2000), log = message => console.error(message) } = {}) {
  if (held) { held.references++; return held.handle; }
  const startedAt = Date.now(); let announcedAt = 0;
  for (;;) {
    const inherited = inheritedFrom(readGpuLockOwner(dir));
    if (inherited) return lease({ dir, owner, token: readGpuLockOwner(dir).token, inherited, waitedMs: Date.now() - startedAt, log });
    try { fs.mkdirSync(dir); } // atomic: exactly one contender succeeds
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const waited = Date.now() - startedAt;
      if (waited >= waitMs) throw new Error(`GPU lock busy after ${Math.round(waited / 1000)} s: ${describe(readGpuLockOwner(dir))}`);
      if (!announcedAt || Date.now() - announcedAt >= 30_000) { announcedAt = Date.now(); log(`GPU lock busy (${describe(readGpuLockOwner(dir))}); waited ${Math.round(waited / 1000)} s of ${Math.round(waitMs / 1000)} s`); }
      await delay(Math.min(retryMs, Math.max(1, waitMs - waited)));
      continue;
    }
    const token = crypto.randomUUID(), since = new Date().toISOString();
    try {
      fs.writeFileSync(path.join(dir, 'owner.json'), `${JSON.stringify({ owner, pid: process.pid, token, created: since, argv: process.argv.slice(1, 3).map(value => path.basename(value)) })}\n`);
      fs.writeFileSync(path.join(dir, 'owner'), `${owner} pid=${process.pid} since=${since} token=${token}\n`);
    } catch (error) { fs.rmSync(dir, { recursive: true, force: true }); throw error; } // ours and ownerless: safe to undo
    return lease({ dir, owner, token, inherited: null, waitedMs: Date.now() - startedAt, log });
  }
}

function lease({ dir, owner, token, inherited, waitedMs, log }) {
  const signalHandlers = new Map();
  if (!inherited) for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    // Release first; if nobody else (Playwright, the runner) handles the signal, die with its default meaning.
    const handler = () => { releaseSync(); if (process.listenerCount(signal) === 0) process.kill(process.pid, signal); };
    signalHandlers.set(signal, handler); process.once(signal, handler);
  }
  const handle = { dir, owner, token, inherited, waitedMs, env: token ? { BIPX_GPU_LOCK_TOKEN: token } : {},
    release() { if (!held || held.handle !== handle) return false; if (--held.references > 0) return false; return releaseSync(); } };
  held = { dir, token, inherited, references: 1, signalHandlers, log, handle };
  return handle;
}

export async function withGpuLock(options, run) {
  const reservation = await acquireGpuLock(typeof options === 'string' ? { owner: options } : options);
  try { return await run(reservation); } finally { reservation.release(); }
}

/**
 * Wraps a Playwright BrowserType so that every launch in this process goes through the reservation. The lock is taken before
 * the first browser starts and kept until the process exits, so a suite never has to queue again between two of its browsers.
 */
export function gpuLockedBrowserType(browserType, owner) {
  const guarded = new Set(['launch', 'launchPersistentContext', 'launchServer']);
  return new Proxy(browserType, { get(target, property) {
    const value = Reflect.get(target, property, target);
    if (typeof value !== 'function') return value;
    if (!guarded.has(property)) return value.bind(target);
    return async (...args) => { await acquireGpuLock({ owner }); return value.apply(target, args); };
  } });
}
