import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const cache = new Map();
export async function moduleUrl(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  let source = await fs.readFile(file, 'utf8');
  const matches = [...source.matchAll(/from\s+(['"])(\.\.?\/[^'"]+)\1/g)];
  for (const match of matches) source = source.replace(match[0], `from ${JSON.stringify(await moduleUrl(path.resolve(path.dirname(file), match[2])))}`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  cache.set(file, url); return url;
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export async function sourceHashes(extra = []) {
  const files = (await fs.readdir('src/vfx')).filter(f => /\.(js|txt)$/.test(f)).map(f => `src/vfx/${f}`);
  files.push('vendor/three/three.module.js', ...extra);
  return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async f => [f, sha256(await fs.readFile(f))])));
}
export async function gpuReservation() {
  const lock = '/tmp/bipx-arpg-gpu.lock';
  try { await fs.mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`GPU reservation busy: ${await fs.readdir(lock).then(names => names.join(', '))}. Existing owner must release it.`);
  }
  const token = `vfx-${process.pid}-${Date.now()}`;
  const owner = { owner: 'Astra VFX', pid: process.pid, token, startedAt: new Date().toISOString() };
  try { await fs.writeFile(path.join(lock, 'owner.json'), JSON.stringify(owner) + '\n'); }
  catch (error) { await fs.rmdir(lock).catch(() => {}); throw error; }
  return async () => {
    const current = JSON.parse(await fs.readFile(path.join(lock, 'owner.json'), 'utf8'));
    if (current.token !== token) throw new Error('Refusing to release another GPU owner');
    await fs.unlink(path.join(lock, 'owner.json')); await fs.rmdir(lock);
  };
}
