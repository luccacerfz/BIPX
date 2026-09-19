import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function relocateServerImports(source, sourceDirectory = process.cwd()) {
  return source.replace(/\bfrom\s+(["'])(\.{1,2}\/[^"']+)\1/g, (_all, _quote, relative) => `from ${JSON.stringify(pathToFileURL(path.resolve(sourceDirectory, relative)).href)}`);
}

export function serverDependencyHashes(entry = path.resolve('server.mjs')) {
  const visited = new Map();
  function visit(file) {
    if (visited.has(file)) return;
    const source = fs.readFileSync(file);
    visited.set(file, crypto.createHash('sha256').update(source).digest('hex'));
    for (const match of source.toString().matchAll(/\bfrom\s+(["'])(\.{1,2}\/[^"']+)\1/g)) visit(path.resolve(path.dirname(file), match[2]));
  }
  visit(entry);
  return Object.fromEntries([...visited].sort(([a], [b]) => a.localeCompare(b)).map(([file, hash]) => [path.relative(process.cwd(), file), hash]));
}
