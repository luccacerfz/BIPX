// Freezes the current source tree into a candidate manifest for evidence v2.
//   node tools/jef-candidate-manifest.mjs --id <candidate-id> --out <file.json> [--root <dir>]
// Prints {path, sha256}: paste both into `candidate.manifest` of the evidence file. Every artifact must
// then reference this manifest (matching sourceHashes, the hash inside the file, or a bound sidecar).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildCandidateManifest } from './lib/candidate-manifest.mjs';

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const id = option('--id');
const out = option('--out');
if (!id || !out) { console.error('Usage: node tools/jef-candidate-manifest.mjs --id <candidate-id> --out <file.json> [--root <dir>]'); process.exit(2); }
const root = path.resolve(option('--root') ?? process.cwd());
const gitValue = (...command) => { try { return execFileSync('git', ['-C', root, ...command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const status = gitValue('status', '--porcelain', '--untracked-files=no');
const manifest = buildCandidateManifest({ root, id, git: { commit: gitValue('rev-parse', 'HEAD'), branch: gitValue('rev-parse', '--abbrev-ref', 'HEAD'), trackedFilesDirty: status === null ? null : status.length > 0 } });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const bytes = `${JSON.stringify(manifest, null, 2)}\n`;
fs.writeFileSync(out, bytes);
console.log(JSON.stringify({ path: out, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), files: manifest.fileCount, git: manifest.git }));
