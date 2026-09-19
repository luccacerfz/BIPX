// Browser evidence for the returned arsenal (relics + automatic weapons). Real Chromium, real keyboard and mouse.
//   node tools/arsenal-evidence.mjs <port> <outDir> <smoke|solo:warrior|solo:dwarf|multi>
// Input policy: walking onto a relic, aiming and every attack are real Playwright input. Placement of drops, enemy packs,
// unlocks and perks uses the page debug API or private server IPC and is LABELLED as a fixture in the report.
// GPU etiquette: /tmp/bipx-arpg-gpu.lock is taken with mkdir before any browser starts and removed only by its owner.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { launchProtocolServer } from './quality-protocol.mjs';
import { createCollisionWorld, sweepStatic, findFreePosition } from '../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';

const [portArg, outArg, mode = 'smoke'] = process.argv.slice(2);
const port = Number(portArg), W = 1280, H = 720;
if (!(port >= 5321 && port <= 5329) || !outArg) { console.error('usage: node tools/arsenal-evidence.mjs <5321-5329> <outDir> <mode>'); process.exit(2); }
const outDir = path.resolve(outArg, mode.replace(':', '-')); fs.mkdirSync(outDir, { recursive: true });
const RELICS = ['flamethrower', 'axe', 'katana', 'crossbow', 'talisman', 'thunderstaff', 'boneCannon', 'frostNova'];
const lock = '/tmp/bipx-arpg-gpu.lock', scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-t3-'));
const report = { mode, startedAt: new Date().toISOString(), fixturesUsed: new Set(), realInput: ['KeyD held to walk onto the relic drop', 'mouse move to aim', 'mouse button held to attack'], steps: [], errors: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let own = false;
for (let attempt = 0; attempt < 750 && !own; attempt++) { try { fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner'), `fable-t3-arsenal ${mode} pid=${process.pid} since=${new Date().toISOString()}\n`); own = true; } catch { await sleep(2000); } }
if (!own) { console.error('GPU lock busy for 25 minutes'); process.exit(2); }
report.lockAcquiredAt = new Date().toISOString();
// The lock is held for one bounded scenario (~6 minutes at most) and is released on every exit path.
const releaseLock = () => { if (own) { own = false; fs.rmSync(lock, { recursive: true, force: true }); } };
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { releaseLock(); process.exit(130); });
setTimeout(() => { console.error('arsenal-evidence watchdog: scenario exceeded 6.5 minutes'); releaseLock(); process.exit(3); }, 6.5 * 60 * 1000).unref();

let server = null, protocol = null, browser = null;
const contexts = [];
async function startServer() {
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', HOST: '127.0.0.1', PORT: String(port), LEADERBOARD_FILE: path.join(scratch, 'lb.json') }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { let out = ''; const timer = setTimeout(() => reject(Error('static server start timeout')), 10000);
    server.stdout.on('data', bytes => { out += bytes; if (/http:\/\//.test(out)) { clearTimeout(timer); resolve(); } }); server.once('exit', code => reject(Error(`server exited ${code}`))); });
}
async function openClient(name, classId, url, prefs = { quality: 'high', reducedMotion: false }) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: path.join(outDir, `video-${name}`), size: { width: W, height: H } } });
  contexts.push({ context, name });
  await context.addInitScript(value => { try { localStorage.setItem('bipxPresentation', JSON.stringify(value)); localStorage.setItem('bipx-controls-seen', 'true'); } catch {} }, prefs);
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(`${name}: ${error}`)); page.on('console', message => { if (message.type() === 'error') report.errors.push(`${name}: ${message.text()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__zombieNightDebug && window.__bipxCharacters, null, { timeout: 60000 });
  await page.keyboard.press('Enter');
  await page.locator(`label[for="character-${classId}"]`).click();
  await page.waitForFunction(id => { const s = window.__bipxCharacters.getState(); return !s.loading && s.selected === id && s.characters?.some(c => c.id === id && c.ready); }, classId, { timeout: 60000 });
  await page.locator('#player-name').fill(name);
  await page.locator('#play-button').click();
  await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing', null, { timeout: 20000 });
  await page.mouse.move(W / 2 + 200, H / 2 - 40); await page.waitForTimeout(700);
  return page;
}
const debug = (page, fn, ...args) => page.evaluate(([name, values]) => window.__zombieNightDebug[name](...values), [fn, args]);
function fixture(page, fn, ...args) { report.fixturesUsed.add(`debug.${fn}`); return debug(page, fn, ...args); }
const sense = page => page.evaluate(() => { const d = window.__zombieNightDebug, s = d.getState(), a = d.getArsenalState(), v = d.getArsenalVfxStats(), perf = d.getPerfStats?.() || {};
  return { state: s.state, x: s.player.x, z: s.player.z, kills: s.kills, health: s.health, zombies: s.zombies, relic: a.relic, relicName: a.relicName, remaining: +a.remaining.toFixed(1), loadout: a.loadout, authority: a.authority,
    swing: a.swing, statuses: s.statuses, evolved: s.evolvedWeapons, vfx: { glyphs: v.activeGlyphs, bodies: v.activeBodies.length, actors: v.actors, events: v.events, rejected: v.rejected },
    hud: { weapon: document.querySelector('#weapon-name').textContent, timer: document.querySelector('#weapon-timer').textContent, tile: document.querySelector('.arpg-basic__name')?.textContent, tileTimer: document.querySelector('.arpg-basic small')?.textContent },
    fps: perf.fpsAverage ? +perf.fpsAverage.toFixed(1) : null, frameMs: perf.frameMs ? +perf.frameMs.toFixed(1) : null, multiplayerId: s.multiplayer.id }; });
async function aimWorld(page, x, z) {
  const p = await page.evaluate(([wx, wz]) => window.__zombieNightDebug.projectWorldPosition(wx, 1, wz), [x, z]);
  await page.mouse.move(Math.max(40, Math.min(W - 40, p.x)), Math.max(60, Math.min(H - 170, p.y)), { steps: 2 }); await page.waitForTimeout(70);
}
async function calibrate(page) { // world direction of the D key, measured with a real key press
  const a = await sense(page); await page.keyboard.down('KeyD'); await page.waitForTimeout(260); await page.keyboard.up('KeyD'); await page.waitForTimeout(90);
  const b = await sense(page), dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz) || 1; return { x: dx / n, z: dz / n };
}
const shot = async (page, name) => { const file = path.join(outDir, `${name}.png`); await page.screenshot({ path: file }); return path.basename(file); };
async function spawnPack(page, dir, specs) { // FIXTURE: enemies appear along the aim; the aim itself is a real mouse move
  const me = await sense(page);
  for (const [distance, degrees, type] of specs) {
    const angle = degrees * Math.PI / 180, ax = dir.x * Math.cos(angle) - dir.z * Math.sin(angle), az = dir.x * Math.sin(angle) + dir.z * Math.cos(angle);
    await aimWorld(page, me.x + ax * 8, me.z + az * 8); await fixture(page, 'spawnZombieAhead', distance, type);
  }
  await aimWorld(page, me.x + dir.x * 7, me.z + dir.z * 7);
}
async function pickUpRelic(page, dir, relic) {
  const me = await sense(page); await aimWorld(page, me.x + dir.x * 7, me.z + dir.z * 7);
  await fixture(page, 'spawnWeaponDrop', relic);
  await page.keyboard.down('KeyD'); // REAL INPUT: walk onto the drop
  try { await page.waitForFunction(id => window.__zombieNightDebug.getArsenalState().relic === id, relic, { timeout: 2500 }); } finally { await page.keyboard.up('KeyD'); }
}
async function holdAttack(page, label, ms, shots) {
  const before = await sense(page), frames = []; await page.mouse.down(); const started = Date.now();
  for (const at of shots) { await page.waitForTimeout(Math.max(0, at - (Date.now() - started))); frames.push(await shot(page, `${label}-${String(at).padStart(4, '0')}ms`)); }
  await page.waitForTimeout(Math.max(0, ms - (Date.now() - started))); const during = await sense(page); await page.mouse.up();
  return { before, during, frames };
}

async function solo(classId, relics) {
  await startServer();
  const page = await openClient(classId === 'warrior' ? 'AldricT3' : 'LyraT3', classId, `http://127.0.0.1:${port}/?offline=1`);
  const dir = await calibrate(page); report.calibration = dir;
  const near = classId === 'warrior';
  const pack = near ? [[2.6, 0, 'zombie'], [3.4, 22, 'brute'], [3.4, -22, 'zombie'], [5.2, 8, 'brute'], [6.4, -10, 'zombie'], [8.5, 4, 'brute'], [10.5, -3, 'zombie'], [3.2, 170, 'brute'], [3.6, -150, 'zombie']]
    : [[5, 0, 'zombie'], [6.5, 14, 'brute'], [6.5, -14, 'zombie'], [8.5, 6, 'brute'], [10, -8, 'zombie'], [12, 3, 'brute'], [14, -4, 'zombie'], [9, 28, 'zombie'], [9, -28, 'brute']];
  // 1. automatic weapons alone: no attack input at all
  await fixture(page, 'clearCombatEntities');
  for (const id of ['guardianBlade', 'orbitOrb', 'sealRain']) await fixture(page, 'unlockAutoWeapon', id);
  await spawnPack(page, dir, pack.map(([d, a, t]) => [d + 2, a, t]));
  const autoBefore = await sense(page), autoFrames = [];
  for (const [wait, at] of [[700, 700], [800, 1500], [900, 2400], [900, 3300]]) { await page.waitForTimeout(wait); autoFrames.push(await shot(page, `auto-weapons-${at}ms`)); }
  const autoAfter = await sense(page);
  report.steps.push({ step: 'automatic weapons, no attack input', fixtures: ['clearCombatEntities', 'unlockAutoWeapon×3', 'spawnZombieAhead pack'], input: 'none', frames: autoFrames,
    killsBefore: autoBefore.kills, killsAfter: autoAfter.kills, loadout: autoAfter.loadout, vfxEvents: autoAfter.vfx.events, companions: autoAfter.vfx.actors, passed: autoAfter.vfx.events.auto > 0 && autoAfter.kills > autoBefore.kills });
  // 2. evolutions (perk gates reached through the debug perk grant)
  for (const perk of ['bladeEcho', 'bladeEcho', 'sealRitual', 'sealRitual']) await fixture(page, 'grantPerk', perk);
  await spawnPack(page, dir, pack.map(([d, a, t]) => [d + 3, a, t])); await page.waitForTimeout(1800);
  const evolvedFrame = await shot(page, 'auto-weapons-evolved'), evolved = await sense(page);
  report.steps.push({ step: 'evolved automatic weapons + Ritual de Selos', fixtures: ['grantPerk bladeEcho×2, sealRitual×2', 'spawnZombieAhead pack'], input: 'none', frames: [evolvedFrame], evolved: evolved.evolved, loadout: evolved.loadout,
    passed: Object.values(evolved.loadout).every(slot => slot.level === 1 && slot.evolved) });
  // 3. relics: real pickup, real attacks
  for (const relic of relics) {
    await fixture(page, 'clearCombatEntities');
    await pickUpRelic(page, dir, relic);
    const picked = await sense(page), pickupFrame = await shot(page, `relic-${relic}-pickup`);
    await spawnPack(page, dir, pack);
    const result = await holdAttack(page, `relic-${relic}`, 2300, [380, 950, 1700]);
    report.steps.push({ step: `relic ${relic}`, fixtures: ['clearCombatEntities', `spawnWeaponDrop ${relic}`, 'spawnZombieAhead pack'], input: 'KeyD walk onto drop; mouse aim; mouse held 2.3 s',
      relicName: picked.relicName, hud: picked.hud, frames: [pickupFrame, ...result.frames], killsBefore: result.before.kills, killsAfter: result.during.kills, statuses: result.during.statuses,
      relicVfxEvents: result.during.vfx.events.relic - result.before.vfx.events.relic, projectileVfxEvents: result.during.vfx.events.projectile - result.before.vfx.events.projectile, fps: result.during.fps,
      passed: picked.relic === relic && result.during.kills > result.before.kills && (result.during.vfx.events.relic + result.during.vfx.events.projectile) > (result.before.vfx.events.relic + result.before.vfx.events.projectile) });
  }
  // 4. frame rate: automatic weapons + relic + horde, attack held with the real mouse
  await fixture(page, 'clearCombatEntities');
  await pickUpRelic(page, dir, near ? 'axe' : 'boneCannon');
  const horde = []; for (let ring = 0; ring < 5; ring++) for (let step = 0; step < 12; step++) horde.push([7 + ring * 2.2, step * 30 + ring * 7, step % 4 === 0 ? 'brute' : step % 3 === 0 ? 'runner' : 'zombie']);
  await spawnPack(page, dir, horde);
  const samples = []; await page.mouse.down();
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(250); const s = await sense(page); samples.push({ t: (i + 1) * .25, fps: s.fps, frameMs: s.frameMs, zombies: s.zombies, glyphs: s.vfx.glyphs, bodies: s.vfx.bodies, kills: s.kills }); if (i === 6) await shot(page, 'horde-fps-moment'); if (i === 16) await shot(page, 'horde-fps-moment-late'); }
  await page.mouse.up();
  const fpsValues = samples.map(sample => sample.fps).filter(Number.isFinite).sort((a, b) => a - b);
  report.steps.push({ step: 'fps: automatic weapons (evolved) + relic + 60-enemy horde', fixtures: ['spawnZombieAhead ×60', 'spawnWeaponDrop'], input: 'mouse held 6 s', samples,
    fps: { min: fpsValues[0], median: fpsValues[Math.floor(fpsValues.length / 2)], max: fpsValues.at(-1), note: 'fpsAverage is the game\'s exponential moving average; headless Chromium with ANGLE/Metal on a shared GPU' },
    quality: await page.evaluate(() => window.__bipxPresentation.getSettings()), passed: fpsValues.length > 0 });
  report.final = await sense(page);
}

async function multi() {
  await startServer();
  // Declared private IPC fixtures on an isolated copy of the production server (no production function replaced).
  const authorityUrl = pathToFileURL(path.resolve('src/progression/authority.mjs')).href;
  protocol = await launchProtocolServer('arsenal-evidence', `
process.on('message', async request => {
  if (request.type !== 'qa-arsenal-drop' && request.type !== 'qa-arsenal-stack') return;
  try {
    const room = rooms.get(request.room), client = room?.clients.get(request.clientId); if (!client) throw Error('Fixture client missing');
    if (request.type === 'qa-arsenal-drop') { const authority = await import(${JSON.stringify(authorityUrl)}); authority.createDrop(client.progression, 'weapon', { x: client.state.x, z: client.state.z }, { type: request.relic, source: 'qa-fixture' }); }
    else Object.assign(client.progression.stacks, request.stacks);
    client.state.stateVersion++; syncProgression(client.state, client.progression); sendJson(client, { type: 'playerState', id: client.id, state: client.state });
    broadcast(room, { type: 'playerState', id: client.id, state: client.state }, client.id);
    process.send({ id: request.id, result: true });
  } catch (error) { process.send({ id: request.id, error: error.message }); }
});`);
  report.fixturesUsed.add('server IPC qa-place-player / qa-combat-scene / qa-arsenal-drop / qa-arsenal-stack (isolated production server copy)');
  const room = `t3${Date.now() % 100000}`, url = `http://127.0.0.1:${port}/?room=${room}&ws=${encodeURIComponent(protocol.wsUrl)}`;
  const A = await openClient('AldricT3', 'warrior', url), B = await openClient('LyraT3', 'dwarf', url, { quality: 'medium', reducedMotion: false });
  await A.waitForTimeout(1200);
  // An open patch of the real arena so headstones do not hide the scene from either hero.
  const arena = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND, groundY: ENVIRONMENT_GROUND.y });
  const free = (x, z, radius) => { const found = findFreePosition(arena, { x, z, radius }, { maxDistance: 2 }); return found.found && !found.relocated; };
  const clear = (x, z, tx, tz) => !sweepStatic(arena, { x, z, y: .9 }, { x: tx, z: tz, y: .9 }, .7);
  let spot = null;
  for (let radius = 6; radius < 40 && !spot; radius += 2) for (let step = 0; step < 24 && !spot; step++) {
    const x = Math.cos(step / 24 * Math.PI * 2) * radius, z = Math.sin(step / 24 * Math.PI * 2) * radius;
    if (free(x, z, .64) && free(x - 4.5, z + 4.5, .64) && [[11, 0], [-3.4, 0], [0, 4.4], [1.5, -4.2], [6, 2]].every(([dx, dz]) => free(x + dx, z + dz, 1) && clear(x, z, x + dx, z + dz))
      && [[6, 9], [10, 7.5], [14, 8.5]].every(([dx, dz]) => clear(x - 4.5, z + 4.5, x - 4.5 + dx, z + 4.5 + dz))) spot = { x, z };
  }
  if (!spot) throw Error('No open arena patch for the multiplayer scene');
  const idA = (await sense(A)).multiplayerId, idB = (await sense(B)).multiplayerId;
  const placedA = await protocol.placePlayer(room, idA, spot), placedB = await protocol.placePlayer(room, idB, { x: spot.x - 4.5, z: spot.z + 4.5 });
  await A.waitForTimeout(900);
  const scene = health => protocol.arrangeCombat(room, [[3, 0], [5.5, 1.5], [8, -.5], [10.5, .5], [-3.2, 0], [0, 4.2], [1.5, -4]].map(([dx, dz]) => ({ x: placedA.x + dx, z: placedA.z + dz, health })));
  async function round(attacker, watcher, attackerId, center, relic, label) {
    await scene(60); await protocol.requestFixture('qa-arsenal-drop', { room, clientId: attackerId, relic });
    await attacker.waitForFunction(id => window.__zombieNightDebug.getArsenalState().relic === id, relic, { timeout: 6000 }); // the pickup request itself is the production client path
    await aimWorld(attacker, center.x + 8, center.z); const watcherBefore = await sense(watcher), before = await sense(attacker);
    await attacker.mouse.down(); await attacker.waitForTimeout(900);
    const frames = [await shot(attacker, `${label}-attacker`), await shot(watcher, `${label}-remote-view`)];
    await attacker.waitForTimeout(1900); frames.push(await shot(watcher, `${label}-remote-view-late`)); await attacker.mouse.up();
    const after = await sense(attacker), watcherAfter = await sense(watcher);
    report.steps.push({ step: `multiplayer ${label}: ${relic}`, fixtures: ['qa-combat-scene (stationary 60 HP monsters)', `qa-arsenal-drop ${relic}`], input: 'mouse aim + mouse held 2.8 s on the attacker only', frames,
      attacker: { authority: after.authority, relic: before.relic, hud: before.hud, killsBefore: before.kills, killsAfter: after.kills },
      remote: { relicEventsSeen: watcherAfter.vfx.events.relic - watcherBefore.vfx.events.relic, projectileEventsSeen: watcherAfter.vfx.events.projectile - watcherBefore.vfx.events.projectile, actors: watcherAfter.vfx.actors },
      passed: after.authority === 'server' && after.kills > before.kills && (watcherAfter.vfx.events.relic + watcherAfter.vfx.events.projectile) > (watcherBefore.vfx.events.relic + watcherBefore.vfx.events.projectile) });
  }
  await round(A, B, idA, placedA, 'axe', 'aldric-whirlwind');
  await round(A, B, idA, placedA, 'thunderstaff', 'aldric-chain-lightning');
  await scene(60); await protocol.requestFixture('qa-arsenal-stack', { room, clientId: idA, stacks: { autoWeapon: 3, sealRitual: 1 } });
  const autoBefore = await sense(B), killsBefore = (await sense(A)).kills; await A.waitForTimeout(3200);
  const autoFrames = [await shot(A, 'aldric-automatic-weapons-owner'), await shot(B, 'aldric-automatic-weapons-remote-view')], autoAfter = await sense(B), ownerAfter = await sense(A);
  report.steps.push({ step: 'multiplayer automatic weapons on Aldric, seen by Lyra', fixtures: ['qa-combat-scene', 'qa-arsenal-stack autoWeapon:3 sealRitual:1'], input: 'none', frames: autoFrames,
    ownerLoadout: ownerAfter.loadout, killsBefore, killsAfter: ownerAfter.kills, remoteAutoEventsSeen: autoAfter.vfx.events.auto - autoBefore.vfx.events.auto, remoteCompanions: autoAfter.vfx.actors,
    passed: ownerAfter.kills > killsBefore && autoAfter.vfx.events.auto > autoBefore.vfx.events.auto && autoAfter.vfx.actors.some(actor => actor.id === idA && actor.orb && actor.blade) });
  // Lyra attacks, Aldric watches: projectile relic across the wire
  const sceneB = health => protocol.arrangeCombat(room, [[6, 0], [8, 2], [10, -1.5], [12, 1], [14, -.5]].map(([dx, dz]) => ({ x: placedB.x + dx, z: placedB.z + 9 + dz, health })));
  await sceneB(40); await protocol.requestFixture('qa-arsenal-drop', { room, clientId: idB, relic: 'katana' });
  await B.waitForFunction(() => window.__zombieNightDebug.getArsenalState().relic === 'katana', null, { timeout: 6000 });
  await aimWorld(B, placedB.x + 9, placedB.z + 9); const watcherBefore = await sense(A), lyraBefore = await sense(B);
  await B.mouse.down(); await B.waitForTimeout(1000); const lyraFrames = [await shot(B, 'lyra-ricochet-attacker'), await shot(A, 'lyra-ricochet-remote-view')]; await B.waitForTimeout(1600); await B.mouse.up();
  const lyraAfter = await sense(B), watcherAfter = await sense(A);
  report.steps.push({ step: 'multiplayer lyra-ricochet-blades: katana', fixtures: ['qa-combat-scene (stationary 40 HP monsters)', 'qa-arsenal-drop katana'], input: 'mouse aim + mouse held 2.6 s on Lyra only', frames: lyraFrames,
    attacker: { authority: lyraAfter.authority, relic: lyraBefore.relic, killsBefore: lyraBefore.kills, killsAfter: lyraAfter.kills }, remote: { projectileEventsSeen: watcherAfter.vfx.events.projectile - watcherBefore.vfx.events.projectile },
    passed: lyraAfter.kills > lyraBefore.kills && watcherAfter.vfx.events.projectile > watcherBefore.vfx.events.projectile });
  report.final = { A: await sense(A), B: await sense(B) };
}

try {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  if (mode === 'smoke') await solo('warrior', ['axe']);
  else if (mode === 'solo:warrior') await solo('warrior', RELICS);
  else if (mode === 'solo:dwarf') await solo('dwarf', RELICS);
  else if (mode === 'multi') await multi();
  else throw Error(`unknown mode ${mode}`);
} catch (error) { report.fatal = String(error?.stack || error); }
finally {
  for (const { context, name } of contexts) { await context.close().catch(() => {}); const dir = path.join(outDir, `video-${name}`);
    const video = fs.existsSync(dir) && fs.readdirSync(dir).find(file => file.endsWith('.webm')); if (video) { fs.renameSync(path.join(dir, video), path.join(outDir, `${name}.webm`)); (report.videos ??= []).push(`${name}.webm`); } fs.rmSync(dir, { recursive: true, force: true }); }
  await browser?.close().catch(() => {});
  releaseLock(); // only ever the lock this process created
  report.lockReleasedAt = new Date().toISOString();
  server?.kill('SIGTERM'); await protocol?.stop().catch(() => {}); fs.rmSync(scratch, { recursive: true, force: true });
  report.fixturesUsed = [...report.fixturesUsed]; report.finishedAt = new Date().toISOString();
  report.passed = !report.fatal && report.steps.length > 0 && report.steps.every(step => step.passed) && report.errors.length === 0;
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify({ mode, passed: report.passed, fatal: report.fatal, errors: report.errors.slice(0, 6), steps: report.steps.map(step => [step.step, step.passed, step.fps ?? '']) }, null, 1));
  if (!report.passed) process.exitCode = 1;
}
