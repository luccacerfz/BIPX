import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { localServer } from './quality-isolated-server.mjs';

// Reserve only our GPU work; never stop the user's server or remove a peer's lock.
const lock = '/tmp/bipx-arpg-gpu.lock';
const script = process.argv[2] || 'tools/audio-verify.mjs';
if (!/^tools\/audio-[\w-]+\.mjs$/.test(script) || !fs.existsSync(script)) throw new Error('Expected an existing tools/audio-*.mjs verifier');
try { fs.mkdirSync(lock); } catch (error) {
  if (error.code === 'EEXIST') { console.log(JSON.stringify({ status: 'GPU_BUSY', lock })); process.exit(2); }
  throw error;
}
fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'sfx', pid: process.pid, script, at: new Date().toISOString() }));
let server;
try {
  server = await localServer();
  const child = spawn(process.execPath, [script, `${server.origin}/?offline=1`], { stdio: 'inherit', env: process.env });
  process.exitCode = await new Promise((resolve, reject) => { child.once('exit', code => resolve(code ?? 1)); child.once('error', reject); });
} finally {
  await server?.stop();
  const owner = JSON.parse(fs.readFileSync(path.join(lock, 'owner.json')));
  if (owner.pid === process.pid) { fs.unlinkSync(path.join(lock, 'owner.json')); fs.rmdirSync(lock); }
}
