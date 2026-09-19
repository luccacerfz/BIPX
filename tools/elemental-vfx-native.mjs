/** Serialized native fixture audit. Run only while this task owns the GPU slot. */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(`output/playwright/${stamp}-elemental-vfx`); await fs.mkdir(out, { recursive: true });
const root = process.cwd();
const tracked = ['src/vfx/elemental-vfx.js', 'src/vfx/elemental-shaders.js', 'src/vfx/elemental-source-glsl.js', 'src/vfx/elemental-geometry.js', 'vendor/three/three.module.js', 'tools/elemental-vfx-preview.html'];
const hash = data => createHash('sha256').update(data).digest('hex');
const sourceHashes = async () => Object.fromEntries(await Promise.all(tracked.map(async f => [f, hash(await fs.readFile(f))])));
const report = { scope: 'Real Chrome/Metal rendering of isolated synthetic elemental fixture; not gameplay, physical device or JEF score.', syntheticFixture: true, errors: [], captures: [], sources: await sourceHashes() };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const name = decodeURIComponent(url.pathname).slice(1);
    if (!tracked.includes(name)) throw new Error('not a fixture asset');
    const data = await fs.readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html' : 'text/javascript', 'Content-Length': data.length }); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-gl=angle', '--use-angle=metal'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: path.join(out, 'video'), size: { width: 1280, height: 800 } } });
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/elemental-vfx-preview.html`);
  await page.waitForFunction(() => window.elementalFixture);
  report.graphics = await page.evaluate(() => { const gl = window.elementalFixture.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return { version: gl.getParameter(gl.VERSION), renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) }; });
  for (const [label, phase, quality, reduced] of [['high-flight', .75, 'high', false], ['high-contact', 1.26, 'high', false], ['high-decay', 1.6, 'high', false], ['low-contact', 1.26, 'low', false], ['reduced-contact', 1.26, 'high', true]]) {
    const stats = await page.evaluate(({ phase, quality, reduced }) => { const f = window.elementalFixture; f.vfx.setQuality(quality); f.vfx.setReducedMotion(reduced); return f.capturePhase(phase); }, { phase, quality, reduced });
    const file = `${label}.png`; await page.screenshot({ path: path.join(out, file) });
    const state = await page.evaluate(() => { const f = window.elementalFixture; return { glError: f.renderer.getContext().getError(), memory: { ...f.renderer.info.memory }, render: { ...f.renderer.info.render }, programs: f.renderer.info.programs?.map(p => ({ name: p.name, runnable: p.diagnostics?.runnable ?? null })) }; });
    report.captures.push({ label, file, sha256: hash(await fs.readFile(path.join(out, file))), stats, state });
    assert.equal(state.glError, 0); assert.ok(stats.drawCalls <= 3); assert.ok(state.programs.every(p => p.runnable !== false));
  }
  await page.evaluate(() => { const f = window.elementalFixture; f.vfx.setQuality('high'); f.vfx.setReducedMotion(false); f.reset(); f.pause(false); });
  report.frameIntervals = await page.evaluate(() => new Promise(resolve => {
    const samples = [], start = performance.now(); let last = start;
    function tick(t) { samples.push(t - last); last = t; if (t - start < 8300) requestAnimationFrame(tick); else { const sorted = samples.slice(1).sort((a,b) => a-b); resolve({ frames: sorted.length, median: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.floor(sorted.length*.95)], max: sorted.at(-1) }); } }
    requestAnimationFrame(tick);
  }));
  report.lifecycle = await page.evaluate(() => {
    const f = window.elementalFixture; f.pause(); f.vfx.reset(); f.renderer.render(f.scene,f.camera);
    const before = { ...f.renderer.info.memory };
    for(let i=0;i<200;i++)f.emitAll();
    const overload = f.vfx.getStats(); f.vfx.reset(); f.renderer.render(f.scene,f.camera);
    const after = { ...f.renderer.info.memory };
    f.vfx.dispose(); f.vfx.dispose(); f.renderer.render(f.scene,f.camera);
    return { before, after, disposed: { ...f.renderer.info.memory }, overload, glError: f.renderer.getContext().getError() };
  });
  assert.deepEqual(report.lifecycle.before, report.lifecycle.after);
  assert.equal(report.lifecycle.glError, 0);
  assert.equal(report.lifecycle.disposed.geometries, report.lifecycle.after.geometries - 3);
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  assert.deepEqual(report.sources, await sourceHashes());
  report.passed = true; await context.close();
} catch (error) { report.failure = error.stack; report.passed = false; process.exitCode = 1; }
finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  await fs.writeFile(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, out, errors: report.errors, failure: report.failure }));
}
