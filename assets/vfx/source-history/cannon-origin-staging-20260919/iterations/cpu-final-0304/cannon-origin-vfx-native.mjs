// Bounded origin gate; run only after Combat releases the Environment/nav window.
// Reuses the existing browser, isolated server, source snapshot and atomic GPU lock.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { chromium, attachQualityTelemetry, evidenceDir, sourceFingerprint } from './quality-browser.mjs';
import { localServer } from './quality-isolated-server.mjs';
import { gpuReservation, sha256 } from './class-skill-vfx-support.mjs';

const root = process.cwd(), releaseGpu = await gpuReservation();
const staging = 'assets/vfx/source-history/cannon-origin-staging-20260919';
const baseline = 'assets/vfx/source-history/cannon-wrapper-integration-20260919';
const report = { promoted: false, syntheticFixture: true, captures: [], playback: [],
  scope: 'Literal core + literal presentClassSkill + current animated Lyra socket; same authority events drive both A/B wrappers. Real assets/camera and cinematic HDR/bloom/shared depth. Controlled core fixture, not gameplay by input or network proof.' };
let browser, server, context, telemetry;
try {
  report.applicationSources = sourceFingerprint();
  const stagedFiles = (await fs.readdir(staging)).filter(n => n.endsWith('.js')).map(n => `${staging}/${n}`);
  const baselineFiles = (await fs.readdir(baseline)).filter(n => n.endsWith('.js')).map(n => `${baseline}/${n}`);
  const tracked = [...stagedFiles, ...baselineFiles, 'tools/cannon-origin-vfx-native.mjs', 'tools/cannon-origin-vfx-preview.html', 'tools/cannon-origin-vfx-sweep.mjs'];
  report.stagingSources = Object.fromEntries(await Promise.all(tracked.map(async f => [f, sha256(await fs.readFile(f))])));
  report.snapshot = await fs.mkdtemp(path.join(os.tmpdir(), 'bipx-cannon-origin-vfx-'));
  for (const f of Object.keys(report.applicationSources)) {
    const out = path.join(report.snapshot, f); await fs.mkdir(path.dirname(out), { recursive: true }); await fs.copyFile(f, out);
  }
  assert.deepEqual(sourceFingerprint(), report.applicationSources, 'Application changed during snapshot');
  for (const [folder, files] of [['src/vfx-origin-staged', stagedFiles], ['src/vfx-pre-origin', baselineFiles]]) {
    await fs.mkdir(path.join(report.snapshot, folder), { recursive: true });
    for (const file of files) await fs.copyFile(file, path.join(report.snapshot, folder, path.basename(file)));
  }
  await fs.mkdir(path.join(report.snapshot, 'tools'), { recursive: true });
  await fs.copyFile('tools/cannon-origin-vfx-sweep.mjs', path.join(report.snapshot, 'tools/cannon-origin-vfx-sweep.mjs'));
  await fs.copyFile('tools/cannon-origin-vfx-preview.html', path.join(report.snapshot, 'src/cannon-origin-vfx-preview.html'));
  const main = await fs.readFile(path.join(report.snapshot, 'src/main.js'), 'utf8');
  const start = main.indexOf('function presentClassSkill('), end = main.indexOf('\n// Reconstruct enduring visuals', start);
  assert.ok(start > 0 && end > start, 'Cannot extract literal adapter');
  const adapter = main.slice(start, end);
  report.adapter = { sha256: sha256(adapter), source: 'src/main.js', literal: true, fixtureContextOnly: true };
  const adapterModule = `export function createLiteralPresenter(context) { return new Function('context', ${JSON.stringify(`with(context){\n${adapter}\nreturn presentClassSkill;}`)})(context); }\n`;
  await fs.writeFile(path.join(report.snapshot, 'src/cannon-adapter-literal.js'), adapterModule);
  process.chdir(report.snapshot);
  server = await localServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
  context = await browser.newContext({ viewport: { width: 2560, height: 720 }, recordVideo: { dir: evidenceDir, size: { width: 2560, height: 720 } } });
  const page = await context.newPage(); telemetry = attachQualityTelemetry(page, 'cannon-origin-vfx-native'); telemetry.markFixture();
  await page.goto(server.origin + '/src/cannon-origin-vfx-preview.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.cannonOrigin?.ready, null, { timeout: 60000 });
  const capture = async (name, data) => {
    const file = await telemetry.capture(name);
    report.captures.push({ file, sha256: sha256(await fs.readFile(path.join(evidenceDir, file))), ...data });
    assert.equal(data.stats.glError, 0); assert.equal(data.stats.pipeline.hdr, true);
    for (const c of data.stats.candidate.cannon.casts) assert.equal(c.radius, 3.4);
  };
  for (const name of ['standing', 'moving']) for (const time of [.30, .3333333333333333, .40, .48]) {
    const stats = await page.evaluate(args => window.cannonOrigin.sample(...args), [name, time]);
    await capture(`${name}-${time.toFixed(3)}`, { stats });
    const first = stats.samples.find(s => s.phase === 'travel' && s.body);
    if (first) {
      assert.equal(first.bridge.launchBlocked, false, 'Clear launch must use current socket');
      const travelled = Math.hypot(first.authority[0] - stats.release.origin.x, first.authority[2] - stats.release.origin.z);
      assert.ok(Math.hypot(...first.visual.map((v, i) => v - stats.release.socket[i])) <= travelled + 1e-5);
    }
    if (stats.release && name === 'moving') assert.ok(stats.release.origin.x > -1.5);
  }
  for (const name of ['near-target', 'wall-through', 'wall-ahead']) {
    const stats = await page.evaluate(args => window.cannonOrigin.afterImpact(...args), [name, .04]);
    await capture(`${name}-contact`, { stats });
    assert.equal(stats.events.filter(e => e.phase === 'impact').length, 1);
    assert.ok(stats.events.some(e => e.phase === 'travel' && e.terminal));
    assert.deepEqual(stats.candidate.cannon.casts[0].hit, [stats.impact.target.x, stats.impact.target.y, stats.impact.target.z]);
    if (name !== 'wall-ahead') {
      assert.equal(stats.candidate.cannon.casts[0].originBridge.launchBlocked, true);
      assert.equal(stats.candidate.cannon.casts[0].muzzle.wanted, false);
    }
  }
  report.corner = [];
  for (const time of [.4, .5, .55, .6, 1.2]) {
    const stats = await page.evaluate(args => window.cannonOrigin.sample(...args), ['thin-corner', time, 'high', false, false, .1]);
    await capture(`thin-corner-10hz-${time}`, { stats });
    const cast = stats.candidate.cannon.casts[0];
    const abandonment = stats.samples.find(s => s.bridge.abandoned);
    report.corner.push({ time, abandonment, sourceSocket: stats.release?.socket, cast });
    if (abandonment && cast?.phase === 'travel') {
      assert.ok(Math.hypot(...cast.position.map((v, i) => v - cast.authorityPosition[i])) < 1e-8);
      assert.equal(cast.originBridge.enabled, false);
    }
    for (const s of stats.samples.filter(s => s.trailReset && s.bodyResumeIn > 0)) assert.equal(s.body, false);
  }
  assert.ok(report.corner.some(row => row.abandonment), 'Current animated socket must actually exercise bridge abandonment; otherwise the native discontinuity gate is unproven');
  for (const [quality, reduced] of [['high', false], ['low', true]]) {
    const travel = await page.evaluate(args => window.cannonOrigin.sample(...args), ['standing', .4, quality, reduced]);
    await capture(`travel-${quality}${reduced ? '-reduced' : ''}`, { stats: travel });
    assert.ok(travel.candidate.cannon.casts.some(c => c.body && c.flight.visible));
    const data = await page.evaluate(args => {
      const stats = window.cannonOrigin.afterImpact(...args); return { stats, torso: window.cannonOrigin.audit() };
    }, ['standing', .16, quality, reduced, true]);
    await capture(`coexist-${quality}${reduced ? '-reduced' : ''}`, data);
    assert.equal(data.stats.pipeline.depth.passes, 1);
    assert.equal(data.stats.candidate.cannon.depthValid, true);
    assert.equal(data.stats.candidate.states.gravity.depthValid, true);
    assert.equal(data.stats.candidate.states.frozen, 4);
  }
  const miss = await page.evaluate(() => window.cannonOrigin.sample('cancel', .9));
  await capture('cancel-without-impact', { stats: miss });
  assert.equal(miss.events.some(e => e.phase === 'impact'), false); assert.equal(miss.candidate.cannon.casts.length, 0);
  for (const name of ['standing', 'moving']) {
    await page.evaluate(name => window.cannonOrigin.play(name), name);
    await page.waitForFunction(() => window.cannonOrigin.stats().time >= 1.6, null, { timeout: 15000 });
    report.playback.push(await page.evaluate(() => window.cannonOrigin.stats()));
  }
  report.artGate = { threshold: .65, metric: 'Same 11x11 torso patches, RGB L1 delta <65, retained fraction >=65%. Real core contact/new source scene; not the previous fixed-fixture pose/contact.',
    allCombinedPassed: report.captures.filter(c => c.torso).every(c => c.torso.length === 4 && c.torso.every(t => t.pixels === 121 && t.preservedFraction >= .65)) };
  report.reset = await page.evaluate(() => window.cannonOrigin.reset());
  assert.equal(report.reset.candidate.cannon.casts.length, 0); assert.equal(report.reset.pipeline.depth.passes, 0);
  report.disposal = await page.evaluate(() => window.cannonOrigin.dispose());
  assert.equal(report.disposal.candidate.cannon.disposed, true);
  telemetry.assertClean(); report.contractPassed = true; report.passed = report.artGate.allCombinedPassed;
  if (!report.passed) process.exitCode = 1;
  await telemetry.save({ measurements: report });
  const video = page.video(); await context.close(); context = null;
  if (video) await video.saveAs(path.join(evidenceDir, 'cannon-origin-core-adapter.webm'));
} catch (error) {
  report.passed = false; report.failure = error.stack; process.exitCode = 1;
  telemetry?.fail(error); await telemetry?.save({ measurements: report }).catch(() => {});
} finally {
  await context?.close(); await browser?.close(); await server?.stop(); process.chdir(root); await releaseGpu();
  report.currentApplicationStillMatches = JSON.stringify(report.applicationSources) === JSON.stringify(sourceFingerprint());
  const after = Object.fromEntries(await Promise.all(Object.keys(report.stagingSources ?? {}).map(async f => [f, sha256(await fs.readFile(f))])));
  report.stagingStillMatches = JSON.stringify(report.stagingSources) === JSON.stringify(after);
  if (!report.currentApplicationStillMatches || !report.stagingStillMatches) { report.passed = false; process.exitCode = 1; }
  report.hashes = Object.fromEntries(await Promise.all((await fs.readdir(evidenceDir)).filter(n => /\.(png|webm)$/.test(n)).map(async n => [n, sha256(await fs.readFile(path.join(evidenceDir, n)))])));
  await fs.writeFile(path.join(evidenceDir, 'cannon-origin-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, evidenceDir, captures: report.captures.length,
    currentApplicationStillMatches: report.currentApplicationStillMatches, stagingStillMatches: report.stagingStillMatches, failure: report.failure }));
}
