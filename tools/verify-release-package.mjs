import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, waitForRuntimeAssets } from './quality-browser.mjs';
import { gpuReservation } from './class-skill-vfx-support.mjs';

const release = path.resolve(process.argv[2] || '');
assert(process.argv[2], 'Usage: node tools/verify-release-package.mjs RELEASE_DIRECTORY');
const root = path.join(release, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(release, 'manifest.json')));
const out = path.join(release, 'checks', new Date().toISOString().replace(/[:.]/g, '-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = { at: new Date().toISOString(), artifactSha256: manifest.artifactSha256, scope: 'Local static artifact packaging smoke: two classes, actual input, runtime assets and publication boundary. Not gameplay quality, multiplayer or production approval.', errors: [], scenarios: [], passed: false };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
let browser, releaseGpu, server;
function verify() {
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Unexpected symlink: ${filename}`);
    return entry.isDirectory() ? walk(filename) : [path.relative(root, filename)];
  });
  const actual = walk(root).sort();
  assert.deepEqual(actual, Object.keys(manifest.files).sort(), 'Unmanifested or missing published files');
  assert(!actual.some(file => /(^|\/)(?:\.[^/]+|node_modules|source-history|tools|output)(\/|$)/.test(file)));
  assert(!actual.includes('server.mjs') && !actual.includes('package.json'));
  assert.equal(hash(JSON.stringify(manifest.files)), manifest.artifactSha256);
  for (const [file, expected] of Object.entries(manifest.files)) assert.equal(hash(fs.readFileSync(path.join(root, file))), expected.sha256, `Artifact changed: ${file}`);
}
try {
  verify();
  releaseGpu = await gpuReservation();
  fs.mkdirSync(out, { recursive: true });
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    if (!Object.hasOwn(manifest.files, relative)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(relative)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(root, relative)).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/.env', '/server.mjs', '/tools/evaluate-jev.mjs', '/output/qa/', '/assets/vfx/source-history/']) assert.equal((await fetch(origin + route)).status, 404, route);
  report.privatePathsAbsent = true;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  for (const character of ['warrior', 'dwarf']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(), requests = new Set();
    page.on('pageerror', error => report.errors.push({ character, kind: 'page', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.errors.push({ character, kind: 'console', message: message.text() }); });
    page.on('requestfailed', req => report.errors.push({ character, kind: 'request', url: req.url(), error: req.failure() }));
    page.on('response', response => { requests.add(new URL(response.url()).pathname); if (response.status() >= 400) report.errors.push({ character, kind: 'HTTP', url: response.url(), status: response.status() }); });
    await page.goto(origin + '/?offline=1&quality=high');
    await waitForRuntimeAssets(page);
    await page.locator('#open-login-button').click();
    await page.locator(`label[for="character-${character}"]`).click();
    const readiness = await waitForRuntimeAssets(page);
    await page.locator('#player-name').fill('Release ' + character);
    await page.locator('#play-button').click();
    await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing');
    await page.locator('#game-canvas').focus();
    const before = await page.evaluate(() => window.__zombieNightDebug.getState());
    await page.keyboard.down('d');
    await page.waitForTimeout(450);
    await page.keyboard.up('d');
    const after = await page.evaluate(() => window.__zombieNightDebug.getState());
    assert(!after.multiplayer.enabled, 'Packaging smoke must not contact the production multiplayer');
    const travel = Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z);
    assert(travel > .1, `${character} did not move after real input`);
    await page.screenshot({ path: path.join(out, character + '.png') });
    report.scenarios.push({ character, readiness, travel, requests: [...requests].sort() });
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  verify(); report.artifactStable = true; report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; }
finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await releaseGpu?.();
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ out, passed: report.passed, errors: report.errors, failure: report.failure, scenarios: report.scenarios.map(({ character, travel, requests }) => ({ character, travel, requests: requests.length })) }));
}
