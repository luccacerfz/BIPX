// Natural-play bot (ported from output/qa/aaa-20260919/fable-fixes-v2/natural-play.mjs; behaviour unchanged, only parameterised).
// Real keyboard + mouse only. Debug getters are used as *perception* (positions, HUD state); no XP, damage, enemies, resources
// or invulnerability are created. It produced findings N-01..N-05 (wave-1 encirclement, deaths per class, card choices).
//
//   node tools/natural-play.mjs [<baseUrl>] <warrior|dwarf> [<activeSeconds>] [--evidence-dir=<dir>] [--port=<n>]
//   flags may replace the positionals: --base-url=<url> --class=<warrior|dwarf> --seconds=<n>   (default 150 s of active play)
//
// Server: --base-url / first positional URL / BIPX_BASE_URL is used verbatim (port 5173 is refused). Without one the bot starts its
// own ephemeral server (127.0.0.1, --port or a free port, Supabase blank, disposable leaderboard) and plays `/?offline=1`, the URL
// of the original runs. Evidence (natural-play.json, screenshots, video): --evidence-dir, else BIPX_EVIDENCE_DIR, else
// output/qa/natural-play/<ISO>-<class>. The GPU is reserved through tools/quality-gpu-lock.mjs (2 s retries, up to 25 min).
import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
import { acquireGpuLock } from './quality-gpu-lock.mjs'; import { assertNotLiveServer, startEphemeralServer } from './quality-target.mjs';
// Shared option parsing of the ported harnesses: `--name=value` flags, everything else positional.
const flags = new Map(), positional = [];
for (const argument of process.argv.slice(2)) { const match = argument.match(/^--([a-z-]+)(?:=(.*))?$/); if (match) flags.set(match[1], match[2] ?? 'true'); else positional.push(argument); }
const urlArgument = flags.get('base-url') ?? (/^https?:/i.test(positional[0] ?? '') ? positional.shift() : process.env.BIPX_BASE_URL);
const classId = flags.get('class') ?? positional.shift(), secondsArg = flags.get('seconds') ?? positional.shift(); const targetActive = Number(secondsArg) || 150;
if (!['warrior', 'dwarf'].includes(classId)) { console.error('usage: node tools/natural-play.mjs [<baseUrl>] <warrior|dwarf> [<activeSeconds>] [--evidence-dir=<dir>] [--port=<n>]'); process.exit(64); }
const outDir = path.resolve(flags.get('evidence-dir') ?? process.env.BIPX_EVIDENCE_DIR ?? `output/qa/natural-play/${new Date().toISOString().replace(/[:.]/g, '-')}-${classId}`); fs.mkdirSync(outDir, { recursive: true });
if (urlArgument) assertNotLiveServer(urlArgument, 'Base URL'); // refuse before queueing for the GPU
const gpu = await acquireGpuLock({ owner: `natural-play ${classId}` });
const server = urlArgument ? null : await startEphemeralServer({ port: Number(flags.get('port') ?? 0), logFile: path.join(outDir, 'ephemeral-server.log') });
const baseUrl = urlArgument ? assertNotLiveServer(urlArgument, 'Base URL').href : `${server.origin}/?offline=1`;
const W = 1280, H = 720;
const log = { classId, baseUrl, startedAt: new Date().toISOString(), runs: [], choices: [], samples: [], errors: [], notes: [] };
const browser = await chromium.launch({ headless: process.env.BIPX_HEADLESS !== '0', ...(process.env.BIPX_BROWSER_CHANNEL ? { channel: process.env.BIPX_BROWSER_CHANNEL } : {}), args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: outDir, size: { width: W, height: H } } });
const page = await context.newPage();
page.on('pageerror', e => log.errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text()); });
const sense = () => page.evaluate(() => { const d = window.__zombieNightDebug, s = d.getState(), a = d.getArpgState(), p = d.getActorMotionState().local.position;
  const perf = d.getPerfStats?.() || {}; const proj = (x, z) => d.projectWorldPosition(x, 1, z);
  const targets = d.getSkillTargets().filter(t => t.health > 0).map(t => ({ id: t.id, x: t.x, z: t.z, freeze: t.freeze, stun: t.stun, pull: t.pull }));
  targets.sort((m, n) => Math.hypot(m.x - p[0], m.z - p[2]) - Math.hypot(n.x - p[0], n.z - p[2]));
  return { state: s.state, paused: s.paused, health: s.health, maxHealth: s.maxHealth, kills: s.kills, score: s.score, wave: s.wave, level: s.level, xp: s.xp, xpToNext: s.xpToNext, gems: s.xpGems,
    pending: s.pendingUpgradeChoices, x: p[0], z: p[2], resource: a.resource, skills: a.skills.map(k => ({ cd: k.cooldownRemaining, cost: k.cost, enabled: k.enabled })), statuses: a.statuses.length,
    targets: targets.slice(0, 40), total: targets.length, aim: targets[0] ? proj(targets[0].x, targets[0].z) : null, fps: perf.fpsAverage ?? null,
    time: document.querySelector('#time-value').textContent, runStatus: document.querySelector('.arpg-run-status')?.textContent || '',
    events: d.getSkillEvents().filter(e => e.type === 'cast' || e.phase === 'cast').map(e => `${e.castId}|${e.skillId}`) }; });
const held = new Set();
async function setKeys(want) { for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); } for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } }
let mouseDown = false; async function fire(on) { if (on !== mouseDown) { if (on) await page.mouse.down(); else await page.mouse.up(); mouseDown = on; } }
const prefs = classId === 'warrior' ? ['damage', 'maxHealth', 'ironBlood', 'bladeEcho', 'area', 'hunterEye', 'cadence', 'speed', 'ashenHeart', 'lastBreath', 'slayerPact', 'cuttingMoon', 'pickup', 'soulMagnet']
  : ['damage', 'cadence', 'projectile', 'hunterEye', 'area', 'speed', 'prismStorm', 'maxHealth', 'ironBlood', 'pickup', 'soulMagnet', 'ashenHeart', 'lastBreath', 'slayerPact', 'cuttingMoon', 'bladeEcho'];
try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__zombieNightDebug && window.__bipxCharacters, null, { timeout: 60000 });
  await page.keyboard.press('Enter');
  if (classId === 'dwarf') await page.locator('label[for="character-dwarf"]').click();
  await page.waitForFunction(() => { const s = window.__bipxCharacters.getState(); return !s.loading && s.characters?.some(c => c.id === s.selected && c.ready); }, null, { timeout: 60000 });
  await page.locator('#player-name').fill(classId === 'warrior' ? 'FableAldric' : 'FableLyra');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing', null, { timeout: 15000 });
  await page.mouse.move(W / 2, H / 2 - 120); await page.waitForTimeout(500);
  // Calibrate key → world axes with real key presses.
  const axis = async key => { const a = await sense(); await page.keyboard.down(key); await page.waitForTimeout(260); await page.keyboard.up(key); await page.waitForTimeout(80); const b = await sense(); const dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz) || 1; return { x: dx / n, z: dz / n }; };
  const up = await axis('KeyW'), right = await axis('KeyD'); log.notes.push({ calibration: { up, right } });
  let active = 0, run = { startedActiveAt: 0, deaths: 0 }, last = Date.now(), lastSample = 0, cardSeenAt = 0, lastTargets = new Map(), loot = [], casts = new Set(), castAttempts = [0, 0, 0], minHealthPct = 1, maxEnemies = 0, tick = 0, cardStatusSeen = new Set();
  let runStart = { kills: 0, time: 0 };
  while (active < targetActive) {
    const s = await sense(); const now = Date.now(), dt = (now - last) / 1000; last = now; tick += 1;
    for (const e of s.events) casts.add(e);
    if (s.state === 'dead') {
      await setKeys(new Set()); await fire(false);
      const menu = await page.evaluate(() => document.querySelector('#message-copy').textContent);
      log.runs.push({ endedBy: 'death', activeSecondsAtEnd: +active.toFixed(1), summary: menu, wave: s.wave, level: s.level, kills: s.kills, score: s.score, clock: s.time });
      await page.screenshot({ path: path.join(outDir, `death-${log.runs.length}.png`) });
      await page.waitForTimeout(1800); await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__zombieNightDebug.getState().state === 'playing', null, { timeout: 15000 }); lastTargets = new Map(); loot = []; last = Date.now(); continue;
    }
    if (s.paused) { log.notes.push({ at: active, paused: true }); await page.waitForTimeout(300); continue; }
    active += dt; minHealthPct = Math.min(minHealthPct, s.health / s.maxHealth); maxEnemies = Math.max(maxEnemies, s.total);
    // Remember where enemies vanished: XP souls drop there.
    const ids = new Set(s.targets.map(t => t.id)); for (const [id, t] of lastTargets) if (!ids.has(id) && Math.hypot(t.x - s.x, t.z - s.z) < 18) loot.push({ x: t.x, z: t.z, at: active });
    lastTargets = new Map(s.targets.map(t => [t.id, t])); loot = loot.filter(l => active - l.at < 9 && Math.hypot(l.x - s.x, l.z - s.z) > 1.1).slice(-12);
    // Upgrade cards: read ~1.3 s like a person, then choose by class preference with the real key.
    if (s.pending.length) {
      cardStatusSeen.add(s.runStatus);
      if (!cardSeenAt) { cardSeenAt = now; if (log.choices.length < 3) await page.screenshot({ path: path.join(outDir, `cards-${log.choices.length + 1}.png`) }); }
      else if (now - cardSeenAt > 1300) { let best = 0, rank = 99; s.pending.forEach((id, i) => { const r = prefs.indexOf(id); if (r >= 0 && r < rank) { rank = r; best = i; } });
        log.choices.push({ at: +active.toFixed(1), clock: s.time, level: s.level, offered: s.pending, chose: s.pending[best], healthPct: +(s.health / s.maxHealth).toFixed(2), enemies: s.total, runStatus: s.runStatus });
        await page.keyboard.press(`Digit${best + 1}`); cardSeenAt = 0; }
    } else cardSeenAt = 0;
    const d = t => Math.hypot(t.x - s.x, t.z - s.z); const near = s.targets[0], nd = near ? d(near) : 99;
    const within = r => s.targets.filter(t => d(t) <= r).length; const hp = s.health / s.maxHealth;
    // Aim with the real mouse at the nearest enemy; hold attack in range.
    if (s.aim) await page.mouse.move(Math.max(40, Math.min(W - 40, s.aim.x)), Math.max(70, Math.min(H - 170, s.aim.y)), { steps: 2 });
    await fire(near && nd <= (classId === 'warrior' ? 3.2 : 17));
    // Movement intent.
    let vx = 0, vz = 0;
    if (classId === 'warrior') {
      if (hp < .3 && within(4) >= 3) { for (const t of s.targets.slice(0, 8)) { const k = 1 / Math.max(.6, d(t)) ** 2; vx -= (t.x - s.x) * k; vz -= (t.z - s.z) * k; } }
      else if (near && nd > 1.9) { vx = near.x - s.x; vz = near.z - s.z; } else if (!near && loot[0]) { vx = loot[0].x - s.x; vz = loot[0].z - s.z; }
      if (near && nd > 9 && loot.length) { const l = loot[loot.length - 1]; vx = l.x - s.x; vz = l.z - s.z; }
    } else {
      if (near && nd < 7) { for (const t of s.targets.slice(0, 10)) { const k = 1 / Math.max(.6, d(t)) ** 2; vx -= (t.x - s.x) * k; vz -= (t.z - s.z) * k; } const o = Math.sin(active / 3) > 0 ? 1 : -1; const n = Math.hypot(vx, vz) || 1; [vx, vz] = [vx / n - vz / n * .6 * o, vz / n + vx / n * .6 * o]; }
      else if (loot.length && nd > 9) { const l = loot[loot.length - 1]; vx = l.x - s.x; vz = l.z - s.z; }
      else if (near && nd > 15) { vx = near.x - s.x; vz = near.z - s.z; }
      if (Math.hypot(s.x, s.z) > 38) { vx -= s.x * .08; vz -= s.z * .08; }
    }
    const n = Math.hypot(vx, vz), want = new Set();
    if (n > .01) { const ux = vx / n, uz = vz / n, a = ux * up.x + uz * up.z, b = ux * right.x + uz * right.z; if (a > .38) want.add('KeyW'); if (a < -.38) want.add('KeyS'); if (b > .38) want.add('KeyD'); if (b < -.38) want.add('KeyA'); }
    await setKeys(want);
    // Skills with the real digit keys when the HUD says they are ready.
    if (!s.pending.length && near) {
      const ready = i => s.skills[i].enabled; let slot = -1;
      if (classId === 'warrior') { if (ready(0) && within(6) >= 3) slot = 0; else if (ready(2) && within(5) >= 3 && nd < 5) slot = 2; else if (ready(1) && within(8) >= 2 && nd > 2.2 && nd < 8) slot = 1; }
      else { if (ready(1) && within(5) >= 3) slot = 1; else if (ready(2) && within(12) >= 5 && nd < 14) slot = 2; else if (ready(0) && within(16) >= 2 && nd > 3 && nd < 18) slot = 0; }
      if (slot >= 0 && tick % 2 === 0) { await page.keyboard.press(`Digit${slot + 1}`); castAttempts[slot] += 1; }
    }
    if (active - lastSample >= 1) { lastSample = active; log.samples.push({ t: +active.toFixed(1), clock: s.time, hp: Math.round(s.health), res: Math.round(s.resource), kills: s.kills, wave: s.wave, lvl: s.level, xp: `${s.xp}/${s.xpToNext}`, enemies: s.total, near: +nd.toFixed(1), gems: s.gems, fps: s.fps, keys: [...held].join('') }); }
    if (Math.floor(active) % 30 === 0 && Math.floor(active - dt) % 30 !== 0) await page.screenshot({ path: path.join(outDir, `play-${String(Math.floor(active)).padStart(3, '0')}s.png`) });
    await page.waitForTimeout(90);
  }
  await setKeys(new Set()); await fire(false);
  const end = await sense(); await page.screenshot({ path: path.join(outDir, 'final.png') });
  log.runs.push({ endedBy: 'time-limit', activeSecondsAtEnd: +active.toFixed(1), wave: end.wave, level: end.level, kills: end.kills, score: end.score, clock: end.time, healthPct: +(end.health / end.maxHealth).toFixed(2) });
  const bySkill = {}; for (const e of casts) { const id = e.split('|')[1]; bySkill[id] = (bySkill[id] || 0) + 1; }
  log.summary = { activeSeconds: +active.toFixed(1), deaths: log.runs.filter(r => r.endedBy === 'death').length, castsObserved: bySkill, castKeyPresses: castAttempts, minHealthPct: +minHealthPct.toFixed(2), maxEnemies, cardRunStatusSeen: [...cardStatusSeen],
    build: await page.evaluate(() => window.__zombieNightDebug.getState().upgradeStacks ?? null), hudScore: await page.evaluate(() => document.querySelector('#score').textContent) };
} catch (error) { log.fatal = String(error?.stack || error); }
finally {
  await context.close(); await browser.close(); await server?.stop(); gpu.release(); log.finishedAt = new Date().toISOString();
  const video = fs.readdirSync(outDir).find(f => f.endsWith('.webm')); if (video) { fs.renameSync(path.join(outDir, video), path.join(outDir, `natural-${classId}.webm`)); log.video = `natural-${classId}.webm`; }
  fs.writeFileSync(path.join(outDir, 'natural-play.json'), JSON.stringify(log, null, 1) + '\n'); console.log(log.fatal || JSON.stringify({ summary: log.summary, runs: log.runs }, null, 1));
}
