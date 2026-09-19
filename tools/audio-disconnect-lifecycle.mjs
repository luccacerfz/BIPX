import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chromium, evidenceDir } from './quality-browser.mjs';
import { createAudioTestServer } from './audio-test-server.mjs';

// Extract the current integration, never import/render the game or modify main.
const source = fs.readFileSync('src/main.js', 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const extract = (text, name) => {
  const start = text.indexOf(`function ${name}(`), end = text.indexOf('\n}\n', start);
  assert(start >= 0 && end > start, `Missing function ${name}`);
  return text.slice(start, end + 2);
};
const closeCallback = text => {
  const marker = 'socket.addEventListener("close", ';
  const start = text.indexOf(marker), end = text.indexOf('\n  });', start);
  assert(start >= 0 && end > start, 'Missing socket close callback');
  return text.slice(start + marker.length, end + 4);
};
const replaceOnce = (text, from, to) => {
  assert(text.includes(from) && text.indexOf(from) === text.lastIndexOf(from), `Ambiguous patch anchor: ${from.slice(0, 80)}`);
  return text.replace(from, to);
};
const close = closeCallback(source);
const proposedClose = replaceOnce(close, '    multiplayer.connected = false;', `    multiplayer.connected = false;
    // Presentation has no authority to extend the last disconnected snapshot.
    remoteSkillSnapshots = [];
    persistentSkillPresentation.clear();
    skillSoundTravel.clear();
    onlineSkillMotion = null;
    audioManager.samples?.reset();
    classSkillVfx?.reset();`);
let proposed = replaceOnce(source, close, proposedClose);
const sync = extract(source, 'syncPersistentSkillPresentation');
let proposedSync = replaceOnce(sync, '  const next = new Map();', `  if (isMultiplayerSuspended()) {
    classSkillVfx?.syncState?.({ buffs: [], fields: [], statuses: [] });
    return [];
  }
  const next = new Map();`);
proposedSync = replaceOnce(proposedSync, "soundState({ ...value, phase: 'end', remaining: 0 })", "soundState({ ...value, phase: 'end', remaining: 0, reason: 'snapshot-removed' })");
proposed = replaceOnce(proposed, sync, proposedSync);
const audioState = "audioManager.samples?.update({ playing: game.state === 'playing', paused, muted: audioManager.muted });";
assert.equal(proposed.split(audioState).length - 1, 3, 'Review changed audio update callsites before proposing patch');
proposed = proposed.replaceAll(audioState, "audioManager.samples?.update({ playing: game.state === 'playing' && !isMultiplayerSuspended(), paused, muted: audioManager.muted });");
const extractBundle = text => ({
  functions: ['isMultiplayerSuspended', 'syncPersistentSkillPresentation', 'presentClassSkill', 'clearRemotePlayers'].map(name => extract(text, name)).join('\n'),
  close: closeCallback(text),
  audioUpdate: extract(text, 'animate').match(/audioManager\.samples\?\.update\([^\n]+\);/)?.[0],
});
const manifest = JSON.parse(fs.readFileSync('assets/audio/processed/manifest.json'));
const files = ['src/main.js', 'src/audio/sample-bank.js', 'src/audio/skill-sounds.js', 'src/combat/class-skills.mjs', 'tools/audio-disconnect-lifecycle.mjs', 'assets/audio/processed/manifest.json', ...Object.values(manifest.cues).map(c => `assets/audio/processed/${c.file}`)];
const fingerprint = () => Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))]));
const before = fingerprint();
fs.writeFileSync(path.join(evidenceDir, 'main-observed.js'), source);
fs.writeFileSync(path.join(evidenceDir, 'main-proposed.js'), proposed);
const diff = spawnSync('diff', ['-u', '--label', 'a/src/main.js', '--label', 'b/src/main.js', path.join(evidenceDir, 'main-observed.js'), path.join(evidenceDir, 'main-proposed.js')], { encoding: 'utf8' });
assert.equal(diff.status, 1);
fs.writeFileSync(path.join(evidenceDir, 'combat-disconnect-proposal.patch'), diff.stdout);
const bundles = { observed: extractBundle(source), proposed: extractBundle(proposed) };
fs.writeFileSync(path.join(evidenceDir, 'extracted-functions.json'), JSON.stringify(bundles, null, 2));
const server = await createAudioTestServer();
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.url);
  const results = await page.evaluate(async bundles => {
    const { createSampleBank } = await import('/src/audio/sample-bank.js');
    const { createSkillState, getClassSkill } = await import('/src/combat/class-skills.mjs');
    const results = [];
    for (const policy of ['observed', 'proposed']) for (const disconnect of ['own-socket', 'remote-actor']) {
      const context = new OfflineAudioContext(2, 48000 * 18, 48000);
      const bank = createSampleBank(context, context.destination);
      bank.update({ playing: true }); await bank.load;
      const calls = [], snapshots = [], checks = [], vfx = [], jobs = [];
      const check = (ok, name) => { if (!ok) throw new Error(`${policy}/${disconnect}: ${name}`); checks.push(name); };
      const spy = {
        update(options) { calls.push({ at: context.currentTime, method: 'update', options: { ...options } }); bank.update(options); },
        reset() { calls.push({ at: context.currentTime, method: 'reset' }); bank.reset(); },
        playSkillEvent(event, options) { calls.push({ at: context.currentTime, method: 'event', event: structuredClone(event), options: { ...options } }); return bank.playSkillEvent(event, options); },
      };
      const socket = {};
      const buff = { castId: 'self-run:11', skillId: 'warrior_war_cry', status: 'buff', remaining: 6, duration: 8, radius: 3 };
      const field = { castId: 'peer-run:7', skillId: 'dwarf_gravity_shot', status: 'gravity', x: 9, y: .08, z: 2, radius: 5, remaining: 4, duration: 5 };
      const state = Object.assign(createSkillState('warrior'), { resource: 47, cooldowns: [9, 4, 2], sequence: 11 });
      const authorityBefore = JSON.stringify({ resource: state.resource, cooldowns: state.cooldowns, sequence: state.sequence });
      const initialSnapshots = [{ id: 'self', x: 0, z: 0, skills: { buff, fields: [] } }, { id: 'peer', x: 4, z: 2, skills: { buff: null, fields: [field] } }];
      const scope = {
        socket, multiplayer: { socket, enabled: true, connected: true, id: 'self', reconnectAttempts: 0 },
        multiplayerAuthorityRunId: 'self-run', player: { position: { x: 0, y: 0, z: 0 } },
        remotePlayers: new Map([['peer', { mesh: { position: { x: 4, y: 0, z: 2 } } }]]),
        remoteSkillSnapshots: structuredClone(initialSnapshots), classSkillState: state, persistentSkillPresentation: new Map(),
        zombies: [], monsterProfiles: {}, getClassSkill,
        classSkillVfx: { syncState: value => vfx.push({ at: context.currentTime, method: 'sync', value: structuredClone(value) }), emit() {}, reset: () => vfx.push({ at: context.currentTime, method: 'reset' }) },
        audioManager: { samples: spy, muted: false }, game: { state: 'playing', survivalTime: 0 }, paused: false,
        THREE: { Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } } },
        getSpatialAudioOptions: position => ({ pan: position.x ? .3 : 0, distance: 0 }),
        pendingMultiplayerStart: null, pendingMultiplayerUpgrade: null, pendingMultiplayerPickups: new Map(),
        pendingSwordStrike: null, swordSwingRemaining: 0, keyboardAimActive: false, keyboardAimReleaseUntil: 0,
        multiplayerReconnectAt: 0, onlineSkillMotion: null, skillSoundTravel: new Set(), skillPresentationHistory: [],
        heroVisual: null, clearPlayerInput() {}, updateMultiplayerHud() {}, renderUpgradeChoices() {},
      };
      scope.removeRemotePlayer = id => scope.remotePlayers.delete(id); // Only mesh disposal is stubbed.
      const bundle = bundles[policy];
      const api = new Function('scope', `with (scope) { ${bundle.functions}\nreturn {
        close: ${bundle.close}, sync: syncPersistentSkillPresentation, present: presentClassSkill,
        suspended: isMultiplayerSuspended, frameUpdate() { ${bundle.audioUpdate} }
      }; }`)(scope);
      const schedule = (time, action) => jobs.push(context.suspend(time).then(() => { action(); return context.resume(); }));
      const frame = () => { api.frameUpdate(); api.sync(true); };
      const snapshot = label => snapshots.push({ label, at: context.currentTime, suspended: api.suspended(), snapshotCount: scope.remoteSkillSnapshots.length, cacheCount: scope.persistentSkillPresentation.size, audio: bank.getState() });
      for (let tick = 1; tick <= 165; tick++) schedule(tick / 10, () => {
        if (tick === 5) {
          snapshot('before-disconnect');
          if (disconnect === 'own-socket') api.close();
          else api.present({ ...field, phase: 'end', reason: 'disconnect', remaining: 0, origin: { x: 9, y: .08, z: 2 }, target: { x: 9, y: .08, z: 2 } }, 'peer');
          snapshot('immediately-after-disconnect');
        }
        if (disconnect === 'own-socket' && tick === 148) {
          scope.multiplayer.socket = {}; scope.multiplayer.connected = true;
          snapshot('reconnected-before-new-snapshot');
        }
        if (tick === 150) {
          // The first fresh authoritative snapshot removes the cancelled field.
          scope.remoteSkillSnapshots = [];
        }
        if (disconnect === 'own-socket' && tick >= 152 && tick < 160) {
          // New identities arrive through a fresh snapshot, never cast/impact replay.
          scope.remoteSkillSnapshots = [
            { id: 'self', skills: { buff: { ...buff, castId: 'self-run:12', remaining: (160 - tick) / 10 } } },
            { id: 'peer', skills: { fields: [{ ...field, castId: 'peer-run:8', remaining: (160 - tick) / 10 }] } },
          ];
        }
        if (disconnect === 'own-socket' && tick === 160) {
          // True authoritative expiry still owns its ending cue; snapshot removal does not.
          for (const value of [{ ...buff, castId: 'self-run:12' }, { ...field, castId: 'peer-run:8' }]) {
            api.present({ ...value, phase: 'end', reason: 'expired', remaining: 0,
              origin: { x: 9, y: .08, z: 2 }, target: { x: 9, y: .08, z: 2 } }, value.status === 'buff' ? 'self' : 'peer');
          }
          scope.remoteSkillSnapshots = [];
        }
        frame();
        if ([1, 4, 5, 6, 130, 147, 148, 150, 151, 152, 159, 160, 165].includes(tick)) snapshot(`tick-${tick}`);
      });
      schedule(17, () => bank.dispose());
      const rendered = await context.startRendering(); await Promise.all(jobs);
      const at = label => snapshots.find(s => s.label === label);
      const prior = at('before-disconnect'), after = at('immediately-after-disconnect'), frozen = at('tick-147');
      check(prior.audio.activeSkillLoops.length === 2, 'Fixture starts local buff and remote gravity voices');
      check(JSON.stringify({ resource: state.resource, cooldowns: state.cooldowns, sequence: state.sequence }) === authorityBefore, 'Disconnect and presentation preserve resource/cooldowns/sequence');
      const staleEvents = calls.filter(c => c.method === 'event' && c.event.phase === 'status' && c.at >= .5 && c.at < 14.8);
      const staleRemaining = Object.fromEntries(['buff', 'gravity'].map(status => [status, [...new Set(staleEvents.filter(c => c.event.status === status).map(c => c.event.remaining))]]));
      const executions = calls.filter(c => c.method === 'event' && ['cast', 'release', 'impact'].includes(c.event.phase));
      check(executions.length === 0, 'Snapshot reconstruction never replays cast/release/impact');
      if (disconnect === 'own-socket') {
        check((at('tick-165').audio.skillPlayedByPhase['dwarf_gravity_shot:end'] || 0)
          === (at('tick-151').audio.skillPlayedByPhase['dwarf_gravity_shot:end'] || 0) + 1,
        'A real authoritative expiry still emits exactly one new collapse');
        if (policy === 'observed') {
          check(after.suspended && after.audio.activeSkillLoops.length === 2, 'Reproduced: own close leaves both voices active');
          check(frozen.audio.activeSkillLoops.length === 2 && frozen.at - after.at > 12, 'Reproduced: stale snapshots sustain both voices beyond12s after disconnect');
          check(staleRemaining.buff[0] === 6 && staleRemaining.gravity[0] === 4 && staleEvents.length > 200, 'Reproduced: remaining6/4 repeats at10Hz with ageMs0');
          check(frozen.audio.skillPlayedByPhase['warrior_war_cry:sustain'] === 1 && frozen.audio.skillPlayedByPhase['dwarf_gravity_shot:sustain'] === 1, 'Dedup avoids new voices but does not prevent repeated lifetime extension');
          check(calls.filter(c => c.method === 'update' && c.at > .5 && c.at < 14.8).every(c => c.options.playing && !c.options.paused), 'Extracted animate sends playing true while network is suspended');
        } else {
          check(after.audio.activeSkillLoops.length === 0 && after.snapshotCount === 0 && after.cacheCount === 0, 'Proposed close immediately clears voices and stale presentation');
          check(staleEvents.length === 0 && frozen.audio.activeSkillLoops.length === 0, 'Proposed guard prevents any status reconstruction throughout >12s suspension');
          check(at('tick-148').audio.activeSkillLoops.length === 0, 'Reconnect alone does not recreate old loops');
          check(at('tick-152').audio.activeSkillLoops.length === 2, 'Only a new authoritative snapshot reconstructs local and remote sustain');
          check(!at('tick-151').audio.skillPlayedByPhase['dwarf_gravity_shot:end'], 'Disconnect and missing snapshots produce no false collapse');
        }
      } else {
        check(after.audio.activeSkillLoops.length === 1 && frozen.audio.activeSkillLoops.length === 1, 'Remote authoritative disconnect cancels only peer loop; local buff remains');
        check(!frozen.audio.skillPlayedByPhase['dwarf_gravity_shot:end'], 'Explicit remote disconnect event remains silent despite stale refreshes');
        const collapse = at('tick-151').audio.skillPlayedByPhase['dwarf_gravity_shot:end'] || 0;
        check(policy === 'observed' ? collapse === 1 : collapse === 0, policy === 'observed'
          ? 'Reproduced: later snapshot removal invents a collapse after explicit cancellation'
          : 'Proposed snapshot-removed reason avoids false remote collapse');
      }
      let peak = 0; for (const value of rendered.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
      results.push({ policy, disconnect, checks, staleRemaining, staleStatusCalls: staleEvents.length,
        frozenObservationSeconds: frozen.at - after.at, snapshots, calls, vfx,
        measurement: { durationSeconds: rendered.duration, peak, note: 'Native OfflineAudioContext output; ambience may remain. No perceptual listening or real network/gameplay claim.' } });
    }
    return results;
  }, bundles);
  assert.deepEqual(errors, []);
  const after = fingerprint();
  const changedFiles = Object.keys(before).filter(file => before[file] !== after[file]);
  const report = { ok: true, scope: 'CPU extracted real main functions + real sample bank + native OfflineAudioContext; synthetic snapshots/transport/3D stubs, not gameplay or listening',
    observedBugConfirmed: true, proposedPatchPassesFixture: true, patchAppliedToRuntime: false, gpuUsed: false,
    sourceHashes: before, sourceChangedDuringRun: changedFiles.length > 0, changedFiles,
    extractedHashes: Object.fromEntries(Object.entries(bundles).map(([name, value]) => [name, hash(JSON.stringify(value))])), results };
  fs.writeFileSync(path.join(evidenceDir, 'disconnect-lifecycle.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ evidenceDir, observedBugConfirmed: true, proposedPatchPassesFixture: true, changedFiles,
    results: results.map(r => ({ policy: r.policy, disconnect: r.disconnect, checks: r.checks.length, staleStatusCalls: r.staleStatusCalls, frozenObservationSeconds: r.frozenObservationSeconds })) }, null, 2));
  assert.deepEqual(changedFiles, [], 'Sources changed during fixture; evidence belongs to extracted source only');
} finally { await browser?.close(); await server.close(); }
