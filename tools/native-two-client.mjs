// Two real browser clients (Lyra x2, high vs low/reduced) with per-frame sampling of RENDERED buffer attributes. Ported from
// output/qa/aaa-20260919/fable-native-v3/tools/native-origin.mjs (+ analyze.py -> tools/native-two-client-analyze.py); behaviour
// unchanged, only parameterised. Casts/aim/choices use real keyboard+mouse. It produced finding D-1 (projectile origin vs muzzle).
//
//   node tools/native-two-client.mjs <label> [--port=<n>] [--evidence-dir=<dir>] [--root=<game copy>] [--server=<file>] [--area-stacks=<n>]
//   (the original `<port> <label> [areaStacks]` order is still accepted)
//
// THE READ-ONLY HOOK. Rendered-attribute sampling needs the scene graph, which the shipped game does not expose. The original ran on
// an instrumented COPY of the game whose src/main.js had these lines added right before `window.__zombieNightDebug = {` (never add
// them to the shipped file; keep them in a QA copy and pass it as --root):
//
//   // QA READ-ONLY INSTRUMENTATION: exposes render objects for attribute sampling.
//   window.__fableQA = { scene, camera, muzzles: () => { const read = v => { const s = v?.muzzle || v?.weapon; if (!s) return null;
//     s.updateWorldMatrix(true, false); const p = s.getWorldPosition(new THREE.Vector3()); return [p.x, p.y, p.z]; };
//     return { local: read(heroVisual), remote: Object.fromEntries([...remotePlayers.entries()].map(([id, peer]) => [id, read(peer.visual)])) }; } };
//
// Without the hook (for example --root pointing at the shipped game) the capture DEGRADES instead of failing: both clients still
// connect, cast with real input, record authoritative skill events, targets, HUD tooltips, screenshots and videos, but every frame
// list is empty and capture-report.json says `hook.present:false`; the analyser then reports event-level results only.
// --area-stacks=<n> is a declared SERVER FIXTURE and needs a QA server copy that answers the private IPC message `qa-area-stacks`
// (the original `server-qa.mjs`); on a server without it the fixture is recorded as unavailable and the run continues without it.
//
// Server: own ephemeral process from --root (default: current checkout) running --server (default: server-qa.mjs when the root has
// one, else server.mjs) on 127.0.0.1:--port (default 0 = free port; never 5173), Supabase blank, disposable leaderboard, secrets
// stripped. Evidence: --evidence-dir, else BIPX_EVIDENCE_DIR, else output/qa/native-two-client/<ISO>-<label>. GPU: tools/quality-gpu-lock.mjs.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { chromium } from 'playwright';
import { acquireGpuLock } from './quality-gpu-lock.mjs'; import { assertNotLiveServer, sanitizedEnv } from './quality-target.mjs';
// Shared option parsing of the ported harnesses: `--name=value` flags, everything else positional.
const flags = new Map(), positional = [];
for (const argument of process.argv.slice(2)) { const match = argument.match(/^--([a-z-]+)(?:=(.*))?$/); if (match) flags.set(match[1], match[2] ?? 'true'); else positional.push(argument); }
const portArg = flags.get('port') ?? (/^\d+$/.test(positional[0] ?? '') ? positional.shift() : 0);
const label = flags.get('label') ?? positional.shift(), stacksArg = flags.get('area-stacks') ?? positional.shift(); const fixtureStacks = stacksArg === undefined ? null : Number(stacksArg);
if (!label) { console.error('usage: node tools/native-two-client.mjs <label> [--port=<n>] [--evidence-dir=<dir>] [--root=<game copy>] [--server=<file>] [--area-stacks=<n>]'); process.exit(64); }
if (Number(portArg) === 5173) assertNotLiveServer('http://127.0.0.1:5173/', '--port');
const root = path.resolve(flags.get('root') ?? '.'), serverFile = flags.get('server') ?? (fs.existsSync(path.join(root, 'server-qa.mjs')) ? 'server-qa.mjs' : 'server.mjs');
const outDir = path.resolve(flags.get('evidence-dir') ?? process.env.BIPX_EVIDENCE_DIR ?? `output/qa/native-two-client/${new Date().toISOString().replace(/[:.]/g, '-')}-${label}`); fs.mkdirSync(outDir, { recursive: true });
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-native-two-client-'));
const gpu = await acquireGpuLock({ owner: `native-two-client ${label}` });
const report = { label, startedAt: new Date().toISOString(), root, serverFile, fixtureStacks, fixture: fixtureStacks === null ? 'none' : 'SERVER PROGRESSION FIXTURE: +Área stacks written by private IPC on the QA server copy; not natural gameplay', rounds: [], natural: { offers: [], deaths: [] }, errors: {} };
const server = spawn(process.execPath, [serverFile], { cwd: root, env: sanitizedEnv({ PORT: String(portArg), HOST: '127.0.0.1', LEADERBOARD_FILE: path.join(scratch, 'lb.json') }), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
let ipcSerial = 0; const ipc = (type, payload) => new Promise((resolve, reject) => { const id = ++ipcSerial; const on = m => { if (m.id !== id) return; server.off('message', on); m.error ? reject(Error(m.error)) : resolve(m.result); }; server.on('message', on); server.send({ ...payload, type, id }); setTimeout(() => reject(Error('ipc timeout')), 5000); });
const port = await new Promise((resolve, reject) => { let out = ''; server.stdout.on('data', b => { out += b; const m = out.match(/http:\/\/127\.0\.0\.1:(\d+)/); if (m) resolve(Number(m[1])); }); setTimeout(() => reject(Error('server start timeout')), 10000); });
assertNotLiveServer(`http://127.0.0.1:${port}/`, 'Capture server'); report.port = port;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const W = 1280, H = 720, room = `fable${Date.now() % 100000}`;
async function client(name, prefs) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: path.join(outDir, `video-${name}`), size: { width: W, height: H } } });
  await context.addInitScript(p => { try { localStorage.setItem('bipxPresentation', JSON.stringify(p)); localStorage.setItem('bipx-controls-seen', 'true'); } catch {} }, prefs);
  const page = await context.newPage(); report.errors[name] = [];
  page.on('pageerror', e => report.errors[name].push(String(e))); page.on('console', m => { if (m.type() === 'error') report.errors[name].push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?room=${room}&ws=${encodeURIComponent(`ws://127.0.0.1:${port}/ws`)}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__zombieNightDebug && window.__bipxCharacters, null, { timeout: 60000 });
  (report.hook ??= { present: true, clients: {} }).clients[name] = await page.evaluate(() => Boolean(window.__fableQA?.scene && typeof window.__fableQA.muzzles === 'function'));
  if (!report.hook.clients[name]) { report.hook.present = false; report.hook.note = 'window.__fableQA is absent (not an instrumented copy): rendered-attribute sampling is disabled, frames stay empty; events, targets, HUD, screenshots and videos are still captured.'; }
  await page.keyboard.press('Enter'); await page.locator('label[for="character-dwarf"]').click();
  await page.waitForFunction(() => { const s = window.__bipxCharacters.getState(); return !s.loading && s.selected === 'dwarf' && s.characters?.some(c => c.id === s.selected && c.ready); }, null, { timeout: 60000 });
  await page.locator('#player-name').fill(name);
  return { name, page, context, prefs };
}
const start = async c => { await c.page.locator('#play-button').click(); await c.page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing', null, { timeout: 20000 }); };
// Per-frame sampler of rendered attributes (runs inside the page).
const installSampler = c => c.page.evaluate(() => {
  const qa = window.__fableQA, dbg = window.__zombieNightDebug; const S = window.__fableSamples = { frames: [], on: false };
  if (!qa?.scene) return; // degraded mode: no read-only hook, nothing to sample
  const find = name => { let hit = null; qa.scene.traverse(o => { if (!hit && o.name === name) hit = o; }); return hit; };
  const arr = (mesh, key, size, index) => Array.from(mesh.geometry.attributes[key].array.slice(index * size, index * size + size));
  function frame() { requestAnimationFrame(frame); if (!S.on) return;
    const bodies = find('ClassSkillProjectileBodies'), ribbons = find('ElementalHelicalRibbons'), surfaces = find('ElementalImpactSurfaces'), status = find('ClassSkillStatusFields'), pool = find('GravityHorizonPool');
    const f = { t: performance.now(), bodies: [], ribbons: [], surfaces: [], rings: [], nebulae: [], muzzles: qa.muzzles(), bridges: (dbg.getClassSkillVfxStats()?.launchBridges || []).map(b => ({ castId: b.castId, skillId: b.skillId, enabled: b.enabled, fallback: b.fallback, abandoned: b.abandoned, launchBlocked: b.launchBlocked, converging: b.converging, clipped: b.clipped, errors: b.errors, socket: b.socket, source: b.source })) };
    if (bodies?.visible) for (let i = 0; i < bodies.geometry.instanceCount; i += 1) { const st = arr(bodies, 'aStyle', 4, i); if (st[3] > .5) f.bodies.push({ i, kind: st[0], at: arr(bodies, 'aOrigin', 3, i) }); }
    if (ribbons) { const n = ribbons.geometry.attributes.aParams.count; for (let i = 0; i < n; i += 1) { const p = arr(ribbons, 'aParams', 4, i); if (p[1] > 0 && p[0] > (S.ribbonSince ?? -1)) f.ribbons.push({ i, birth: p[0], life: p[1], from: arr(ribbons, 'aOrigin', 3, i), to: arr(ribbons, 'aEnd', 3, i), visible: ribbons.visible }); } }
    if (surfaces) { const n = surfaces.geometry.attributes.aParams.count; for (let i = 0; i < n; i += 1) { const p = arr(surfaces, 'aParams', 4, i), look = arr(surfaces, 'aLook', 4, i); if (p[1] > 0 && p[2] >= 2.5) f.surfaces.push({ i, birth: p[0], radius: p[2], look, at: arr(surfaces, 'aOrigin', 3, i), visible: surfaces.visible }); } }
    if (status?.visible) { const n = status.geometry.attributes.aState.count; for (let i = 0; i < n; i += 1) { const st = arr(status, 'aState', 4, i); if (st[3] > 1e-4 && st[0] === 3) f.rings.push({ i, radius: st[1], remaining: st[3], at: arr(status, 'aOrigin', 3, i) }); } }
    if (pool) for (const g of pool.children) if (g.visible) { const p = g.position; const nebula = g.children.find(ch => ch.scale.x !== 1) || g.children[0]; f.nebulae.push({ at: [p.x, p.y, p.z], scales: g.children.map(ch => +ch.scale.x.toFixed(3)), visibleChildren: g.children.filter(ch => ch.visible).length }); }
    S.frames.push(f); }
  requestAnimationFrame(frame);
});
const sense = c => c.page.evaluate(() => { const d = window.__zombieNightDebug, s = d.getState(), p = d.getActorMotionState().local.position, a = d.getArpgState();
  const targets = d.getSkillTargets().filter(t => t.health > 0).map(t => ({ id: t.id, x: t.x, z: t.z, d: Math.hypot(t.x - p[0], t.z - p[2]) })).sort((m, n) => m.d - n.d);
  return { state: s.state, health: s.health, x: p[0], z: p[2], pending: s.pendingUpgradeChoices, level: s.level, kills: s.kills, targets: targets.slice(0, 12), hud: a.skills.map(k => ({ id: k.id, radius: k.radius, description: k.description, enabled: k.enabled, cd: k.cooldownRemaining })), areaMultiplier: a.areaMultiplier,
    nearestScreen: targets[0] ? d.projectWorldPosition(targets[0].x, 1, targets[0].z) : null }; });
const armed = (c, on) => c.page.evaluate(v => { const S = window.__fableSamples; if (v) { S.frames = []; S.since = performance.now(); } S.on = v; }, on);
const collect = c => c.page.evaluate(() => ({ frames: window.__fableSamples.frames, events: window.__zombieNightDebug.getSkillEvents().map(e => ({ ...e })), targets: window.__zombieNightDebug.getSkillTargets().map(t => ({ id: t.id, x: t.x, z: t.z })), now: performance.now() }));
async function aimAt(c, mode, s) { let x = W / 2, y = H / 2 - 40; const dirs = { up: [0, -230], right: [330, 0], down: [0, 190], left: [-330, 0] };
  if (mode === 'enemy' && s.nearestScreen) { x = Math.max(60, Math.min(W - 60, s.nearestScreen.x)); y = Math.max(90, Math.min(H - 190, s.nearestScreen.y)); } else { const d = dirs[mode] || dirs.up; x += d[0]; y += d[1]; }
  await c.page.mouse.move(x, y, { steps: 3 }); return { x, y }; }
async function handleCards(c) { const s = await sense(c); if (!s.pending.length) return; const pick = Math.max(0, s.pending.indexOf('area')); report.natural.offers.push({ client: c.name, level: s.level, offered: s.pending, chose: s.pending[pick] }); await c.page.waitForTimeout(500); await c.page.keyboard.press(`Digit${pick + 1}`); await c.page.waitForTimeout(400); }
async function ensureAlive(list) { for (const c of list) { const s = await sense(c); if (s.state !== 'playing') { report.natural.deaths.push({ client: c.name, kills: s.kills, level: s.level }); await c.page.waitForTimeout(1500); await c.page.keyboard.press('Enter'); await c.page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing', null, { timeout: 20000 }).catch(() => {}); await c.page.waitForTimeout(600); } } }
async function round(caster, observer, mode, { moving = false } = {}) {
  await ensureAlive([caster, observer]); await handleCards(caster); await handleCards(observer);
  const entry = { mode, moving, caster: caster.name, observer: observer.name, casts: [] };
  for (const [slot, wait] of [[1, 2600], [2, 7200]]) {
    let s = await sense(caster); const deadline = Date.now() + 14000; while (!s.hud[slot].enabled && Date.now() < deadline) { await handleCards(caster); await caster.page.waitForTimeout(300); s = await sense(caster); if (s.state !== 'playing') break; }
    if (s.state !== 'playing' || !s.hud[slot].enabled) { entry.casts.push({ slot, skipped: s.state !== 'playing' ? 'caster dead' : 'skill never became ready' }); continue; }
    const aim = await aimAt(caster, mode, s); await armed(caster, true); await armed(observer, true); await caster.page.waitForTimeout(120);
    if (moving) await caster.page.keyboard.down('KeyD');
    await caster.page.keyboard.press(`Digit${slot + 1}`); await caster.page.waitForTimeout(900); if (moving) await caster.page.keyboard.up('KeyD');
    // After the cast is released both players defend themselves with the real basic attack.
    const until = Date.now() + wait - 900; while (Date.now() < until) { for (const c of [caster, observer]) { const d = await sense(c); if (d.state === 'playing' && d.nearestScreen && d.targets[0].d < 14) { await c.page.mouse.move(Math.max(60, Math.min(W - 60, d.nearestScreen.x)), Math.max(90, Math.min(H - 190, d.nearestScreen.y))); await c.page.mouse.down(); } } await caster.page.waitForTimeout(250); }
    for (const c of [caster, observer]) await c.page.mouse.up();
    await armed(caster, false); await armed(observer, false);
    const [local, remote, after] = [await collect(caster), await collect(observer), await sense(caster)];
    const file = `round-${report.rounds.length + 1}-${mode}${moving ? '-moving' : ''}-${caster.name}-slot${slot + 1}.json`;
    fs.writeFileSync(path.join(outDir, file), JSON.stringify({ aim, casterBefore: s, casterAfter: after, local, remote }));
    await caster.page.screenshot({ path: path.join(outDir, file.replace('.json', '-local.png')) }); await observer.page.screenshot({ path: path.join(outDir, file.replace('.json', '-remote.png')) });
    entry.casts.push({ slot, file, hud: s.hud[slot], areaMultiplier: s.areaMultiplier });
  }
  report.rounds.push(entry);
}
try {
  const A = await client('AltaA', { quality: 'high', reducedMotion: false }), B = await client('LeveB', { quality: 'low', reducedMotion: true });
  await start(A); await start(B); await installSampler(A); await installSampler(B); await A.page.waitForTimeout(1200);
  report.multiplayer = { A: await A.page.evaluate(() => document.querySelector('#online-count').textContent + ' / ' + document.querySelector('#online-status').textContent), B: await B.page.evaluate(() => document.querySelector('#online-count').textContent + ' / ' + document.querySelector('#online-status').textContent) };
  report.presentation = { A: await A.page.evaluate(() => window.__bipxPresentation.getSettings()), B: await B.page.evaluate(() => window.__bipxPresentation.getSettings()) };
  if (fixtureStacks !== null) { report.fixtureResult = await ipc('qa-area-stacks', { room, stacks: fixtureStacks }).catch(error => ({ unavailable: `${error.message}: this server does not answer the private qa-area-stacks IPC (not a QA server copy)` })); await A.page.waitForTimeout(700); }
  const plan = fixtureStacks === null ? [['up', {}], ['enemy', {}], ['right', {}], ['left', { moving: true }], ['down', {}]] : [['up', {}], ['enemy', {}]];
  for (const [mode, options] of plan) { await round(A, B, mode, options); await round(B, A, mode, options); }
  // HUD evidence through the real tooltip (hover with the mouse).
  for (const c of [A, B]) { await ensureAlive([c]); for (const slot of [1, 2]) { await c.page.locator(`[data-arpg-slot="${slot}"]`).hover(); await c.page.waitForTimeout(250);
      (report.hudTooltips ??= []).push({ client: c.name, slot, text: await c.page.evaluate(() => document.querySelector('#arpg-tooltip').innerText.replace(/\n+/g, ' | ')), aria: await c.page.getAttribute(`[data-arpg-slot="${slot}"]`, 'aria-label') });
      await c.page.screenshot({ path: path.join(outDir, `hud-${c.name}-slot${slot + 1}.png`) }); } await c.page.mouse.move(W / 2, H / 2); }
  report.final = { A: await sense(A), B: await sense(B) };
  for (const c of [A, B]) { await c.context.close(); const dir = path.join(outDir, `video-${c.name}`); const v = fs.readdirSync(dir).find(f => f.endsWith('.webm')); if (v) fs.renameSync(path.join(dir, v), path.join(outDir, `${label}-${c.name}.webm`)); fs.rmSync(dir, { recursive: true, force: true }); }
} catch (error) { report.fatal = String(error?.stack || error); }
finally { await browser.close().catch(() => {}); server.kill('SIGTERM'); gpu.release(); fs.rmSync(scratch, { recursive: true, force: true }); report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'capture-report.json'), JSON.stringify(report, null, 1) + '\n'); console.log(report.fatal || JSON.stringify({ hook: report.hook, rounds: report.rounds.map(r => [r.mode, r.caster, r.casts.map(c => c.skipped || 'ok')]), multiplayer: report.multiplayer, natural: report.natural, errors: report.errors, presentation: report.presentation }, null, 1)); }
