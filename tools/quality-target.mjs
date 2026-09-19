// Where a harness finds the game server. Nothing in tools/ may default to the owner's live server on port 5173.
//
// Resolution order used by `suiteUrl(defaultPathAndQuery)`:
//   1. an explicit URL in argv[2] (kept verbatim, exactly like before);
//   2. BIPX_BASE_URL, set by tools/run-quality-suite.mjs for the ephemeral server it started: the suite's own default path and
//      query (`/?offline=1&autoplay=1`, ...) are resolved against it;
//   3. otherwise the suite starts its own ephemeral server (127.0.0.1, PORT=0, Supabase blank, disposable leaderboard) and stops
//      it when the process exits.
// Port 5173 is refused in every case unless BIPX_ALLOW_LIVE_5173=1 is set on purpose.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const LIVE_PORT = 5173;
const SECRET_NAME = /(_KEY|_TOKEN|_SECRET|PASSWORD|PASSWD|CREDENTIAL|^SUPABASE_|^TYPESAFE_|^ANTHROPIC_|^OPENAI_|^ELEVENLABS_|^GITHUB_|^GH_|^NPM_|^AWS_|^RENDER_|^VERCEL_|^DATABASE_URL$)/i;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export function assertNotLiveServer(value, label = 'Target') {
  const url = new URL(value);
  const port = Number(url.port || (url.protocol === 'https:' || url.protocol === 'wss:' ? 443 : 80));
  if (port === LIVE_PORT && process.env.BIPX_ALLOW_LIVE_5173 !== '1') {
    throw new Error(`${label} ${url.origin} is the owner's live server (port ${LIVE_PORT}). Harnesses use an ephemeral server; set BIPX_ALLOW_LIVE_5173=1 only if you really mean it.`);
  }
  return url;
}

/** process.env without anything that looks like a credential. SUPABASE_* stay *defined but blank*: server.mjs only reads `.env` for undefined names. */
export function sanitizedEnv(extra = {}) {
  const env = {};
  for (const [name, value] of Object.entries(process.env)) if (name.startsWith('BIPX_') || !SECRET_NAME.test(name)) env[name] = value;
  return { ...env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ...extra };
}

/** Starts `server.mjs` from `cwd` on 127.0.0.1. `port: 0` lets the OS choose. Output goes to a file so the parent can exit freely. */
export async function startEphemeralServer({ port = 0, cwd = process.cwd(), logFile = null, startupMs = 10_000 } = {}) {
  if (Number(port) === LIVE_PORT) assertNotLiveServer(`http://127.0.0.1:${port}/`, 'Ephemeral server port');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-ephemeral-'));
  const log = logFile ? path.resolve(logFile) : path.join(scratch, 'server.log');
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const descriptor = fs.openSync(log, 'w');
  const child = spawn(process.execPath, ['server.mjs'], { cwd, stdio: ['ignore', descriptor, descriptor],
    env: sanitizedEnv({ HOST: '127.0.0.1', PORT: String(port), LEADERBOARD_FILE: path.join(scratch, 'leaderboard.json') }) });
  fs.closeSync(descriptor); child.unref();
  let exit = null; child.once('exit', (code, signal) => { exit = { code, signal }; });
  const stopSync = () => { if (!exit) { try { child.kill('SIGTERM'); } catch { /* already gone */ } } };
  process.on('exit', stopSync);
  async function stop() {
    process.off('exit', stopSync);
    if (!exit) { child.kill('SIGTERM'); for (let waited = 0; !exit && waited < 1500; waited += 25) await delay(25); if (!exit) child.kill('SIGKILL'); }
    fs.rmSync(scratch, { recursive: true, force: true }); // disposable leaderboard (and the log, unless the caller asked for a file)
  }
  for (let waited = 0; waited < startupMs; waited += 50) {
    const match = fs.readFileSync(log, 'utf8').match(/http:\/\/127\.0\.0\.1:(\d+)/);
    if (match) {
      const origin = `http://127.0.0.1:${match[1]}`; assertNotLiveServer(origin, 'Ephemeral server');
      return { origin, port: Number(match[1]), pid: child.pid, logFile: log, stop };
    }
    if (exit) break;
    await delay(50);
  }
  const output = fs.readFileSync(log, 'utf8').slice(-600); await stop();
  throw new Error(`Ephemeral server did not start${exit ? ` (exit ${exit.code ?? exit.signal})` : ` within ${startupMs} ms`}: ${output}`);
}

let own = null;
/** Full URL for a suite: `suiteUrl('/?offline=1')`. See the resolution order at the top of this file. */
export async function suiteUrl(defaultPathAndQuery = '/', { argument = process.argv[2] } = {}) {
  if (argument && /^https?:\/\//i.test(argument)) return assertNotLiveServer(argument, 'URL argument').href;
  if (process.env.BIPX_BASE_URL) return new URL(defaultPathAndQuery, assertNotLiveServer(process.env.BIPX_BASE_URL, 'BIPX_BASE_URL')).href;
  own ??= startEphemeralServer({ logFile: process.env.BIPX_EVIDENCE_DIR ? path.join(process.env.BIPX_EVIDENCE_DIR, 'ephemeral-server.log') : null });
  return new URL(defaultPathAndQuery, (await own).origin).href;
}
