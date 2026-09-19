// Bounded adaptation of animation-contact-native.mjs: retained v11 versus v12 dt-zero fixed.
// Uses its existing split-view fixture, copied dependencies and GPU wrapper.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = process.cwd();
const staging = path.resolve('output/arpg-animation/backward-v12/native-ab-staging');
const manifest = JSON.parse(await fs.readFile(path.join(staging, 'manifest.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = 'tools/animation-contact-preview.html';
const tool = 'tools/animation-backward-v12-native.mjs';
const cases = [
  {scenario:'turn',speed:6.5,hz:30,duration:110/30,rate:1,landmarks:Array.from({length:13},(_,i)=>97+i)},
  {scenario:'turn',speed:6.5,hz:60,duration:220/60,rate:1,landmarks:Array.from({length:23},(_,i)=>197+i)},
];
const files = Object.entries(manifest.variants).flatMap(([variant, rows]) => Object.keys(rows).map(f => `${variant}/${f}`));
files.push(fixture, ...Object.keys(manifest.references).map(f => `references/${f}`));
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async f => [f, sha(await fs.readFile(path.join(staging, f)))])));
const verifyOriginals = async () => {
  const changed = [];
  for (const [file, expected] of Object.entries(manifest.protectedRuntime))
    if (sha(await fs.readFile(path.join(root, file))) !== expected) changed.push(file);
  return changed;
};
const originalHashes = await hashes();
for (const [variant, rows] of Object.entries(manifest.variants)) for (const [file, expected] of Object.entries(rows))
  assert.equal(originalHashes[`${variant}/${file}`], expected, `Staging drift: ${variant}/${file}`);

if (process.argv.includes('--preflight')) {
  const html = await fs.readFile(path.join(staging, fixture), 'utf8');
  const source = html.match(/function motion\(\)\{([\s\S]*?)\n\}\nfunction step/)[1];
  const motion = new Function('time', 'settings', source);
  let maxPositionDifference=0, maxReachDifference=0, completeFrames=0;
  for (const variant of ['before','candidate']) {
    const {THREE}=await import(pathToFileURL(path.join(staging,variant,'tools/hero-locomotion-cpu-support.mjs')));
    const {loadDwarfVisual}=await import(pathToFileURL(path.join(staging,variant,'src/assets/dwarf-library.js')));
    for (const item of cases) {
      const reference=JSON.parse(await fs.readFile(path.join(staging,'references',`${variant}-${item.hz}.json`),'utf8')).rows;
      const parent=new THREE.Group(), actor=await loadDwarfVisual({THREE,parent,height:2.55});
      for(const old of reference){
        const dt=1/item.hz,m=motion(old.frame*dt,item);
        const velocity={x:Math.sin(m.angle)*m.speed,z:Math.cos(m.angle)*m.speed};
        assert.deepEqual(velocity,old.velocity);
        parent.position.x+=velocity.x*dt;parent.position.z+=velocity.z*dt;
        actor.update(dt,{speed:m.speed,velocity});parent.updateMatrixWorld(true);
        maxPositionDifference=Math.max(maxPositionDifference,...parent.position.toArray().map((v,i)=>Math.abs(v-old.position[i])));
        for(let side=0;side<2;side++){
          const f=actor.stats.locomotion.footContacts[side];
          assert.equal(f.contact,old.feet[side].contact);
          maxReachDifference=Math.max(maxReachDifference,Math.abs(f.reachError-old.feet[side].reach));
        }
        completeFrames++;
      }
      actor.dispose();
    }
  }
  assert(maxPositionDifference<1e-9&&maxReachDifference<1e-9);
  assert.deepEqual(await verifyOriginals(),[]);
  const result={scope:'Same existing 452-frame CPU history, each frozen variant. No new search or acceptance.',
    completeFrames,maxPositionDifference,maxReachDifference,cases,sources:originalHashes,
    runner:sha(await fs.readFile(tool)),runtimeUnchanged:true,gpuUsed:false};
  await fs.writeFile(path.join(staging,'preflight.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({completeFrames,maxPositionDifference,maxReachDifference}));process.exit(0);
}

assert(process.argv.includes('--capture'), 'Use --preflight or --capture after the coordinated GPU window');
const owner = JSON.parse(await fs.readFile('/tmp/bipx-arpg-gpu.lock/owner.json', 'utf8'));
assert(owner.owner === 'animation' && owner.pid === process.ppid, 'Run through animation-with-gpu.mjs after Combat releases its window');
const preflight = JSON.parse(await fs.readFile(path.join(staging, 'preflight.json'), 'utf8'));
assert.deepEqual(preflight.sources, originalHashes, 'Recheck preflight if staged source changes');
const out = path.resolve(`output/playwright/arpg-animation-backward-v12-ab-${Date.now()}`);
await fs.mkdir(out, { recursive: true });
const report = { scope: 'Native diagnostic split-view A/B. Retained v11 versus v12 dt-zero fixed; real-time 1x, full prefix; same rig/material/light/input. Close3/4 and current desktop camera parameters/follow; plain floor fixture, not gameplay.',
  staging, before: originalHashes, runner: sha(await fs.readFile(tool)), gpuOwner: owner,
  errors: [], cases: [], captures: [], acceptedNoSliding: false, promoted: false, runtimeDriftBefore: await verifyOriginals() };
const allowed = new Set(files);
const server = http.createServer(async (req, res) => {
  try {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
    const file = route.startsWith('vendor/') ? `before/${route}` : route;
    assert(allowed.has(file), `Not in the isolated manifest: ${file}`);
    const bytes = await fs.readFile(path.join(staging, file));
    res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.html': 'text/html', '.json': 'application/json', '.glb': 'model/gltf-binary' })[path.extname(file)] || 'application/octet-stream');
    res.end(bytes);
  } catch (error) { res.writeHead(404); res.end(); report.errors.push(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
const attach = page => {
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) report.errors.push(`${response.status()} ${response.url()}`); });
};
const open = async page => { attach(page); await page.goto(`http://127.0.0.1:${server.address().port}/${fixture}`); await page.waitForFunction(() => window.contactFixture?.ready); };
const viewport = { width: 2880, height: 900 }; // Each panel is the real1440x900 desktop aspect.
try {
  browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-gl=angle', '--use-angle=metal'] });
  for (const item of cases) for (const view of ['close', 'game']) {
    const name = `${item.scenario}-${item.speed}-${item.hz}hz-${view}`;
    const context = await browser.newContext({ viewport, recordVideo: { dir: out, size: viewport } });
    const page = await context.newPage(); await open(page);
    await page.evaluate(options => window.contactFixture.configure(options), { ...item, view, character: 'dwarf' });
    await page.waitForTimeout(600);
    const start = await page.evaluate(({ rate, duration }) => { const wallTime = performance.now(); window.contactFixture.play(rate, duration); return wallTime; }, item);
    await page.waitForFunction(() => window.contactFixture.snapshot().playback === 0, null, { timeout: 45000, polling: 200 });
    const snapshot = await page.evaluate(() => window.contactFixture.snapshot());
    const json = `${name}-trace.json`; await fs.writeFile(path.join(out, json), JSON.stringify(snapshot));
    const trace = snapshot.trace;
    assert.equal(trace.length, Math.round(item.duration * item.hz));
    assert(trace.every(f => f.samples.every(s => s.finite) && f.positions[0].every((v, i) => v === f.positions[1][i])));
    assert.equal(snapshot.glError, 0);
    const maximumReach = [0, 1].map(i => Math.max(...trace.flatMap(f => f.samples[i].feet.map(foot => foot.reachError))));
    let maxPositionDifference=0,maxMaterialDifference=0,maxReachDifference=0;
    for(const [side,variant]of ['before','candidate'].entries()){
      const reference=JSON.parse(await fs.readFile(path.join(staging,'references',`${variant}-${item.hz}.json`),'utf8')).rows;
      for(const row of trace){
        const old=reference[row.frame],sample=row.samples[side];
        maxPositionDifference=Math.max(maxPositionDifference,...row.positions[side].map((v,k)=>Math.abs(v-old.position[k])));
        for(let foot=0;foot<2;foot++){
          assert.equal(sample.feet[foot].contact,old.feet[foot].contact);
          maxReachDifference=Math.max(maxReachDifference,Math.abs(sample.feet[foot].reachError-old.feet[foot].reach));
        }
        for(const [vertex,p]of Object.entries(sample.material))
          maxMaterialDifference=Math.max(maxMaterialDifference,...p.map((v,k)=>Math.abs(v-old.stages[1].final.material[vertex][k])));
      }
    }
    assert(maxPositionDifference<1e-9&&maxMaterialDifference<1e-7&&maxReachDifference<1e-9,'Browser must reproduce CPU witness');
    const reached=snapshot.renderTrace.find(r=>r.frame===trace.length);
    const wallDuration=(reached.wallTime-start)/1000;
    const renderGaps=snapshot.renderTrace.slice(1).map((r,i)=>r.wallTime-snapshot.renderTrace[i].wallTime);
    const playback={requestedRate:1,wallDuration,simulationDuration:trace.length/item.hz,
      wallDifference:wallDuration-trace.length/item.hz,maxRenderGapMS:Math.max(...renderGaps),
      distinctRenderedFrames:new Set(snapshot.renderTrace.map(r=>r.frame)).size};
    assert(Math.abs(playback.wallDifference)<.1,'Real-time playback wall duration drift');
    await page.waitForTimeout(600);
    const video = page.video(); await context.close(); await video.saveAs(path.join(out, `${name}.webm`));
    report.cases.push({ ...item, view, name, trace: json, video: `${name}.webm`, playbackStartPerformanceMS: start,
      completeFrames: trace.length, maximumReach, playback, parity:{maxPositionDifference,maxMaterialDifference,maxReachDifference}, glRenderer: snapshot.glRenderer, cameras: snapshot.cameras,
      transitions: trace.flatMap(f => f.transitions.map(t => ({ frame: f.frame, time: f.time, ...t }))) });
    // Exact before/at/after stills use a separate, non-recorded context. The full
    // clip above is never rewound, cropped to a favorable phase or interrupted.
    const stillContext = await browser.newContext({ viewport }), stillPage = await stillContext.newPage(); await open(stillPage);
    for (const frame of item.landmarks) {
      await stillPage.evaluate(options => window.contactFixture.configure(options), { ...item, view, character: 'dwarf' });
      await stillPage.evaluate(count => window.contactFixture.step(count), frame + 1);
      const state = await stillPage.evaluate(() => window.contactFixture.snapshot());
      const png = `${name}-frame${frame}.png`; await stillPage.screenshot({ path: path.join(out, png) });
      report.captures.push({ name, frame, inputTime: frame / item.hz, renderedTime: state.time, png,
        cameras: state.cameras, bounds:await stillPage.evaluate(()=>window.contactFixture.bounds()), samples: state.trace.at(-1).samples });
    }
    await stillContext.close();
    console.log(JSON.stringify({ completed: name, frames: trace.length, maximumReach }));
  }
} catch (error) { report.errors.push(String(error)); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
report.after = await hashes(); report.sourceStable = JSON.stringify(report.before) === JSON.stringify(report.after);
report.runtimeDriftAfter = await verifyOriginals();
report.captureComplete = report.sourceStable && !report.errors.length && report.cases.length === 4 && report.captures.length === 72;
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, captureComplete: report.captureComplete, sourceStable: report.sourceStable, errors: report.errors }));
if (!report.captureComplete) process.exitCode = 1;
