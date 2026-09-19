import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const lock = '/tmp/bipx-arpg-gpu.lock';
const token = randomUUID();
try { await fs.mkdir(lock); }
catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('GPU occupied; retained current reservation.');
  try { console.log(await fs.readFile(`${lock}/owner.json`, 'utf8')); } catch {}
  process.exit(75);
}
const [command, ...args] = process.argv.slice(2);
try {
  await fs.writeFile(`${lock}/owner.json`, JSON.stringify({ owner: 'animation', pid: process.pid, token, created: new Date().toISOString() }));
  if (!command) throw new Error('Pass an export or GPU capture command.');
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
} finally {
  const owner = JSON.parse(await fs.readFile(`${lock}/owner.json`, 'utf8'));
  if (owner.token === token) await fs.rm(lock, { recursive: true });
}
