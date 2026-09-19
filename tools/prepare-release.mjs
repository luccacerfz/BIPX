import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  assert(args[i + 1] && !args[i + 1].startsWith('--'), `Missing ${name}`);
  return args[i + 1];
};
const source = path.resolve(option('--source', process.cwd()));
const destination = path.resolve(option('--out', `output/releases/${new Date().toISOString().replace(/[:.]/g, '-')}`));
assert(!fs.existsSync(destination), 'Release destination already exists; preserve prior artifacts');
assert(destination !== source && !source.startsWith(destination + path.sep), 'Destination cannot contain the source');
const publicRoot = path.join(destination, 'public');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = new Map(), excluded = [];
const runtimeExtensions = new Set(['.js', '.mjs', '.css', '.html', '.json', '.glsl', '.wasm']);
const assetExtensions = new Set(['.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.mp3', '.wav', '.ogg', '.json', '.ktx2', '.woff', '.woff2']);
const attribution = name => /(?:^|[-_.])(license|licence|attribution|copyright|credits)(?:$|[-_.])/i.test(name);

function add(relative) {
  const filename = path.join(source, relative);
  assert(fs.lstatSync(filename).isFile(), `Expected a regular file: ${relative}`);
  const bytes = fs.readFileSync(filename);
  files.set(relative, { bytes: bytes.length, sha256: digest(bytes) });
}
function walk(relative, category) {
  for (const entry of fs.readdirSync(path.join(source, relative), { withFileTypes: true })) {
    const child = `${relative}/${entry.name}`;
    if (entry.name === 'source-history' || entry.name.startsWith('.')) { excluded.push(child); continue; }
    assert(!entry.isSymbolicLink(), `Review symlink before release: ${child}`);
    if (entry.isDirectory()) { walk(child, category); continue; }
    const extension = path.extname(entry.name).toLowerCase();
    if (attribution(entry.name) || (category === 'assets' ? assetExtensions : runtimeExtensions).has(extension)) add(child);
    else excluded.push(child);
  }
}
for (const entry of ['index.html', 'styles.css', 'vercel.json']) add(entry);
for (const directory of ['src', 'vendor', 'assets']) walk(directory, directory);
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (entry.isFile() && attribution(entry.name)) add(entry.name);
}

const references = [], dynamicUrls = [];
function reference(owner, value, kind) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return;
  if (value.includes('${')) { dynamicUrls.push({ owner, value, kind }); return; }
  const clean = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  if (!clean) return;
  const relative = path.posix.normalize(clean.startsWith('/') ? clean.slice(1) : path.posix.join(path.posix.dirname(owner), clean));
  if (kind === 'module URL' && clean.endsWith('/')) {
    assert([...files.keys()].some(file => file.startsWith(relative)), `Empty asset URL base: ${owner} -> ${value}`);
    dynamicUrls.push({ owner, value, kind: 'asset URL base' });
    return;
  }
  assert(files.has(relative), `Missing ${kind}: ${owner} -> ${value} (${relative})`);
  references.push({ owner, value, target: relative, kind });
}
for (const relative of files.keys()) {
  const text = () => fs.readFileSync(path.join(source, relative), 'utf8');
  if (/\.[cm]?js$/.test(relative)) {
    const content = text();
    for (const m of content.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)(['"])(\.{1,2}\/[^'"]+)\1/g)) reference(relative, m[2], 'module');
    for (const m of content.matchAll(/new\s+URL\(\s*(['"`])([^'"`]+)\1\s*,\s*import\.meta\.url/g)) reference(relative, m[2], 'module URL');
  } else if (relative.endsWith('.css')) {
    for (const m of text().matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g)) reference(relative, m[2].trim(), 'CSS URL');
  } else if (relative.endsWith('.html')) {
    for (const m of text().matchAll(/\b(?:src|href)\s*=\s*(['"])([^'"]+)\1/g)) reference(relative, m[2], 'HTML URL');
  }
}

const vercel = JSON.parse(fs.readFileSync(path.join(source, 'vercel.json'), 'utf8'));
assert.equal(vercel.outputDirectory, '.', 'Review changed Vercel output directory');
assert(!vercel.buildCommand && !vercel.installCommand, 'Review changed Vercel build/install command');
for (const relative of files.keys()) {
  const target = path.join(publicRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(source, relative), target);
  assert.equal(digest(fs.readFileSync(target)), files.get(relative).sha256, `Copy changed: ${relative}`);
}
// Check the source again after copying: a concurrent edit invalidates this artifact.
for (const [relative, record] of files) assert.equal(digest(fs.readFileSync(path.join(source, relative))), record.sha256, `Source changed: ${relative}`);
const sorted = Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)));
const manifest = {
  createdAt: new Date().toISOString(), sourceDirectory: source,
  artifactSha256: digest(JSON.stringify(sorted)), files: sorted,
  fileCount: files.size, totalBytes: [...files.values()].reduce((n, file) => n + file.bytes, 0),
  excluded: excluded.sort(), staticReferencesChecked: references.length, dynamicUrls,
  scope: 'Static Vercel artifact only. Includes active asset families for dynamic loaders. Excludes server, secrets, tools, evidence, archives and dependency installs. Hashes match the captured source.',
  qualityAccepted: false, nativeArtifactSmokePassed: false, deployed: false,
};
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(destination, 'static-references.json'), JSON.stringify(references, null, 2) + '\n');
console.log(JSON.stringify({ destination, publicRoot, artifactSha256: manifest.artifactSha256, files: files.size, bytes: manifest.totalBytes, staticReferencesChecked: references.length, dynamicUrls: dynamicUrls.length }));
