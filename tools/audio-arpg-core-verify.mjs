import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium, browserLaunchOptions, evidenceDir } from './quality-browser.mjs';
import { createAudioTestServer } from './audio-test-server.mjs';
const manifest = JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json'));
const files = ['src/audio/sample-bank.js', 'src/audio/skill-sounds.js', 'src/combat/class-skills.mjs', 'tools/audio-arpg-core-verify.mjs', 'assets/audio/processed/manifest.json', ...Object.values(manifest.cues).map(c => `assets/audio/processed/${c.file}`)];
const fingerprint = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before = fingerprint(), server = await createAudioTestServer();
const browser = await chromium.launch({ ...browserLaunchOptions, args: ['--disable-gpu'] });
const page = await browser.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(server.url);
  const results = await page.evaluate(async () => {
    const { createSampleBank } = await import('/src/audio/sample-bank.js');
    const { createSkillState, beginSkill, advanceSkills, getClassSkills, applySkillControl, tickSkillControl } = await import('/src/combat/class-skills.mjs');
    const results = [];
    for (const classId of ['warrior', 'dwarf']) {
      const context = new OfflineAudioContext(2, 48000 * 12, 48000), bank = createSampleBank(context, context.destination);
      bank.update({ playing: true }); await bank.load;
      const state = createSkillState(classId), actor = { x: 0, z: 0, runId: classId, damageMultiplier: 1 };
      const targets = [-3, -5, -6, -8, -12].map((z, id) => ({ id, x: 0, z, radius: .4, health: classId === 'warrior' ? (id === 0 ? 1 : 1000) : 1000 }));
      const events = [], hits = [], starts = [], snapshots = [], jobs = [], checks = [];
      const check = (condition, name) => { if (!condition) throw new Error(`${classId}: ${name}`); checks.push(name); };
      const emit = event => { events.push(event); check(bank.playSkillEvent(event, { local: true }), `core event ${event.phase} recognised`); };
      let nextSlot = 0;
      for (let i = 1; i <= 230; i++) jobs.push(context.suspend(i * .05).then(() => {
        if (nextSlot < 3 && i >= [2, 26, 56][nextSlot]) {
          const result = beginSkill(state, { slot: nextSlot, aimX: 0, aimZ: -1 }, actor);
          check(result.ok, `accepted slot ${nextSlot}`); emit(result.event); starts.push(result); nextSlot++;
        }
        advanceSkills(state, .05, { actor, targets,
          moveCaster(delta) { actor.x += delta.x; actor.z += delta.z; return actor; },
          moveTarget(target, delta) { target.x += delta.x; target.z += delta.z; return target; },
          hit(target, effect) {
            target.health -= effect.damage; target.dead = target.health <= 0;
            if (!target.dead) applySkillControl(target, effect);
            hits.push({ targetId: target.id, ...effect, killed: target.dead }); return target.dead;
          }, emit });
        for (const target of targets) if (!target.dead) tickSkillControl(target, .05, emit);
        bank.update({ playing: true });
        if (i % 20 === 0) snapshots.push(bank.getState());
        return context.resume();
      }));
      const buffer = await context.startRendering(); await Promise.all(jobs);
      const audio = bank.getState();
      for (const def of getClassSkills(classId)) {
        check(audio.skillPlayedByPhase[`${def.id}:cast`] === 1, `${def.id} one cast sound`);
        check(audio.skillPlayedByPhase[`${def.id}:release`] === 1, `${def.id} one release sound`);
        if (events.some(e => e.skillId === def.id && e.phase === 'impact')) check(audio.skillPlayedByPhase[`${def.id}:impact`] > 0, `${def.id} confirmed impact sounds`);
      }
      const persistentId = classId === 'warrior' ? 'warrior_war_cry' : 'dwarf_gravity_shot';
      check(audio.skillPlayedByPhase[`${persistentId}:sustain`] === 1 && audio.loopRefreshes > 40, 'Core status stream refreshes one persistent voice');
      check(audio.activeSkillLoops.length === 0, 'Core end event removes persistent voice');
      check(audio.skillPlayedByPhase[`${persistentId}:end`] === 1, 'Core end emits one final cue');
      if (classId === 'warrior') check(audio.skillPlayedByPhase['warrior_cleaving_dash:kill'] === 1, 'Only the confirmed dash kill sounds');
      let peak = 0; for (let channel = 0; channel < 2; channel++) for (const value of buffer.getChannelData(channel)) peak = Math.max(peak, Math.abs(value));
      check(peak > .01 && peak < 1, 'Actual core-driven native signal is non-silent and unclipped');
      bank.dispose(); results.push({ classId, checks, starts, hits, events, snapshots, audio, peak });
    }
    return results;
  });
  assert.deepEqual(errors, []); assert.deepEqual(fingerprint(), before);
  fs.writeFileSync(path.join(evidenceDir, 'arpg-core-audio.json'), `${JSON.stringify({ ok: true, kind: 'real shared core in synthetic targets/physics fixture driving native WebAudio; not gameplay', sourceChanged: false, sourceHashes: before, results }, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, evidenceDir, results: results.map(r => ({ classId: r.classId, checks: r.checks.length, peak: r.peak, loopRefreshes: r.audio.loopRefreshes })) }));
} finally { await browser.close(); await server.close(); }
