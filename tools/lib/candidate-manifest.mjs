// Candidate manifest: the single identity every evidence artifact must reference.
// `fingerprintSources` mirrors `sourceFingerprint()` of tools/quality-browser.mjs (same file set, same
// hashes) without importing Playwright, so the `sourceHashes` map that the browser suites already write
// into their reports binds those reports to the manifest. tools/verify-jef-gate.mjs checks both agree.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_FILES = ['index.html', 'styles.css', 'server.mjs', 'package.json', 'package-lock.json'];
const SOURCE_PATTERN = /\.(mjs|js|json|glsl|css|html|wasm|bin|glb|gltf)$/;

export function fingerprintSources(root = process.cwd()) {
  const files = new Set(ROOT_FILES);
  const visit = (directory, everyFile) => {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === 'source-history') continue;
      const name = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(name, everyFile);
      else if (everyFile || SOURCE_PATTERN.test(name)) files.add(name);
    }
  };
  visit('src', false);
  visit('vendor', true);
  visit('assets', true);
  return Object.fromEntries([...files].filter((file) => fs.existsSync(path.join(root, file))).sort().map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
}

export function buildCandidateManifest({ root = process.cwd(), id, git = null, createdAt = new Date().toISOString() }) {
  const sources = fingerprintSources(root);
  return { kind: 'bipx-candidate-manifest', schemaVersion: 2, id, createdAt, git, fileCount: Object.keys(sources).length, sourcesSha256: crypto.createHash('sha256').update(JSON.stringify(sources)).digest('hex'), sources };
}
