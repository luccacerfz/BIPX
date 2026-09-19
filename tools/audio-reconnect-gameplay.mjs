import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, evidenceDir, attachQualityTelemetry, waitForRuntimeAssets } from './quality-browser.mjs';

// Run only through audio-runtime-run.mjs, after the agreed stable GPU window.
const lock = JSON.parse(fs.readFileSync('/tmp/bipx-arpg-gpu.lock/owner.json', 'utf8'));
assert(lock.owner === 'sfx' && lock.pid === process.ppid, 'Use the SFX atomic GPU runner');
const url = new URL(process.argv[2]);
url.searchParams.delete('offline'); url.searchParams.delete('autoplay');
url.searchParams.set('room', `audio-reconnect-${process.pid}`);
url.searchParams.set('ws', `${url.origin.replace('http:', 'ws:')}/ws`);
const browser = await chromium.launch(browserLaunchOptions), clients = [], checks = [];
const check = (name, passed) => checks.push({ name, passed: Boolean(passed) });
const read = client => client.page.evaluate(() => ({
  state: window.__zombieNightDebug.getState(), skills: window.__zombieNightDebug.getSkillState(),
  audio: window.__zombieNightDebug.getAudioState(), wire: window.__sfxWire.stats(),
}));
const recordings = {};
try {
  for (const classId of ['warrior', 'dwarf']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      const Native = window.WebSocket; let current; const stats = { welcomes: 0, resumes: 0, closes: 0 };
      window.WebSocket = class extends Native {
        constructor(...args) {
          super(...args); current = this;
          this.addEventListener('message', event => {
            let value; try { value = JSON.parse(event.data); } catch { return; }
            if (value.type === 'welcome') { stats.welcomes++; if (value.resumed) stats.resumes++; }
          });
          this.addEventListener('close', () => stats.closes++);
        }
      };
      // Fault injection closes only the actual socket; no gameplay state is edited.
      // Never expose/record packets or resume credentials.
      window.__sfxWire = { close: () => current?.close(), stats: () => ({ ...stats }) };
    });
    const page = await context.newPage();
    const telemetry = attachQualityTelemetry(page, `audio-reconnect-${classId}`);
    const client = { classId, context, page, telemetry }; clients.push(client);
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await waitForRuntimeAssets(page, telemetry);
    await page.locator('#open-login-button').click();
    await page.locator(`label[for="character-${classId}"]`).click();
    await waitForRuntimeAssets(page, telemetry);
    await page.locator('#player-name').fill(`SFX reconnect ${classId}`);
    await page.locator('#play-button').click();
    await page.waitForFunction(() => {
      const debug = window.__zombieNightDebug;
      return debug.getState().state === 'playing' && debug.getState().multiplayer.connected && debug.getAudioState().samples?.loaded;
    });
  }
  const [warrior, dwarf] = clients;
  for (const client of clients) {
    await client.page.locator(`[data-arpg-slot="${client.classId === 'warrior' ? 0 : 2}"][data-state="ready"]`).waitFor({ state: 'visible' });
    await client.page.mouse.move(830, 355);
    await client.page.keyboard.press(client.classId === 'warrior' ? '1' : '3');
  }
  for (const client of clients) await client.page.waitForFunction(() => {
    const loops = window.__zombieNightDebug.getAudioState().samples.activeSkillLoops;
    return loops.some(id => id.startsWith('warrior_war_cry:')) && loops.some(id => id.startsWith('dwarf_gravity_shot:'));
  }, null, { timeout: 5000 });
  recordings.before = { warrior: await read(warrior), dwarf: await read(dwarf) };
  await dwarf.page.evaluate(() => window.__sfxWire.close());
  await dwarf.page.waitForFunction(() => !window.__zombieNightDebug.getState().multiplayer.connected);
  await dwarf.page.waitForTimeout(450);
  recordings.disconnected = { warrior: await read(warrior), dwarf: await read(dwarf) };
  check('Disconnected owner stops all persistent audio', recordings.disconnected.dwarf.audio.samples.activeSkillLoops.length === 0);
  check('Peer removes the disconnected gravity field', !recordings.disconnected.warrior.audio.samples.activeSkillLoops.some(id => id.startsWith('dwarf_gravity_shot:')));
  for (const classId of ['warrior', 'dwarf']) {
    const before = recordings.before[classId].audio.samples.skillPlayedByPhase;
    const after = recordings.disconnected[classId].audio.samples.skillPlayedByPhase;
    check(`${classId}: cancellation never invents a gravity collapse`, (after['dwarf_gravity_shot:end'] || 0) === (before['dwarf_gravity_shot:end'] || 0));
    check(`${classId}: native AudioContext remains unlocked/running`, recordings.disconnected[classId].audio.contextState === 'running');
  }
  await dwarf.page.waitForFunction(() => window.__zombieNightDebug.getState().multiplayer.connected && window.__sfxWire.stats().welcomes >= 2, null, { timeout: 10000 });
  await dwarf.page.waitForTimeout(200);
  recordings.resumed = { warrior: await read(warrior), dwarf: await read(dwarf) };
  const before = recordings.before.dwarf, after = recordings.resumed.dwarf;
  check('Reconnect retains player identity', after.state.multiplayer.id === before.state.multiplayer.id);
  check('Reconnect retains sequence without granting a new cast', after.skills.sequence === before.skills.sequence);
  check('Reconnect retains active cooldown', after.skills.cooldowns[2] > 0 && after.skills.cooldowns[2] <= before.skills.cooldowns[2] + .3);
  check('Reconnect does not charge resource again', after.skills.resource >= before.skills.resource - .3 && after.skills.resource <= 100);
  check('Cancelled own field does not resurrect after resync', !after.skills.fields.length && !after.audio.samples.activeSkillLoops.some(id => id.startsWith('dwarf_gravity_shot:')));
  for (const classId of ['warrior', 'dwarf']) {
    const original = recordings.before[classId].audio.samples.skillPlayedByPhase;
    const resumed = recordings.resumed[classId].audio.samples.skillPlayedByPhase;
    for (const phase of ['cast', 'release', 'impact']) for (const skill of ['warrior_war_cry', 'dwarf_gravity_shot']) {
      check(`${classId}: no ${skill}/${phase} replay on resync`, (resumed[`${skill}:${phase}`] || 0) === (original[`${skill}:${phase}`] || 0));
    }
  }
  for (const client of clients) { await client.telemetry.capture('after-reconnect'); client.telemetry.assertClean(); }
  assert(checks.every(value => value.passed), checks.filter(value => !value.passed).map(value => value.name).join('; '));
} catch (error) {
  process.exitCode = 1;
  for (const client of clients) client.telemetry.fail(error);
} finally {
  for (const client of clients) {
    await client.telemetry.save({ classId: client.classId, checks, recordings,
      scope: 'Actual browser, server and WebAudio; real skill input with intentional socket closure. No gameplay mutation, packet replay, perceptual listening or60s claim.' });
    await client.context.close();
  }
  await browser.close();
  const report = { passed: !process.exitCode && clients.length === 2 && checks.every(c => c.passed), checks,
    sourceStable: clients.every(c => c.telemetry.report.sourceChangedDuringRun === false), evidenceDir };
  fs.writeFileSync(path.join(evidenceDir, 'audio-reconnect-summary.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
