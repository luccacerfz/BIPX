import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { CASTER_CAST_TIMING as timing, createCasterCastState as create,
  prepareCasterCast as prepare, advanceCasterCast as advance, cancelCasterCast as cancel,
  casterCastSnapshot as snapshot, acceptCasterCastSnapshot as accept,
  projectCasterCastSnapshot as project } from '../output/lich-cast-v1/combat-proposal/caster-cast.mjs';
import { stepCasterCaller as caller } from '../output/lich-cast-v1/combat-proposal/caster-caller-boundary.mjs';

const base = path.resolve('output/lich-cast-v1/combat-proposal');
const out = path.join(base, `cpu-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(out);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const reference = JSON.parse(fs.readFileSync(path.join(base, 'source-reference/source-hashes.json')));
const files = [...Object.keys(reference.hashes), 'output/lich-cast-v1/combat-proposal/caster-cast.mjs', 'output/lich-cast-v1/combat-proposal/caster-caller-boundary.mjs', 'tools/lich-cast-review-authority.mjs'];
const hashes = () => Object.fromEntries(files.map(file => [file, sha(file)]));
const report = { scope: 'Pure proposal + extracted current caller expressions. CPU only; no integration/network/GPU.', before: hashes(), tests: [] };
const fresh = () => create({ worldEpoch: 'world:A', actorId: 7 });
const actor = { id: 7, type: 'caster', present: true, alive: true, frozen: false, stunned: false, position: { x: 0, z: 0 } };
const target = { id: 'player:A', lifeId: 'life:A', present: true, alive: true, position: { x: 0, z: -10 } };
const context = { actor, target, inRange: true, losClear: true };
const begin = (state = fresh(), extra = {}) => prepare(state, { ...context, ready: true, sequence: state.sequence + 1, ...extra });
const step = (state, dt, extra = {}) => advance(state, { ...context, tick: state.lastTick + 1, dt, ...extra });
const phases = result => result.events.map(e => e.phase);
const freeze = object => { Object.freeze(object); for (const v of Object.values(object)) if (v && typeof v === 'object') freeze(v); return object; };
const check = (name, fn) => { fn(); report.tests.push({ name, passed: true }); };
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`); assert(start >= 0, name);
  const opening = source.indexOf('{', start); let depth = 0;
  for (let i = opening; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

try {
  check('Timing exactly matches staged profile without core importing asset/Three', () => {
    const text = fs.readFileSync('output/lich-cast-v1/lich-cast-profile.js', 'utf8');
    const profile = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    assert.equal(timing.duration, profile.duration); assert.equal(timing.releaseAt, profile.releaseAt);
    assert(!/^import\s/m.test(fs.readFileSync(path.join(base, 'caster-cast.mjs'), 'utf8')));
  });
  check('Prepare emits once, no immediate release; direction copied and normalized', () => {
    const input = structuredClone(context); input.target.position = { x: 3, z: -4 };
    const r = begin(fresh(), input); assert.deepEqual(phases(r), ['prepare']);
    assert.deepEqual(r.state.cast.direction, { x: .6, z: -.8 });
    input.target.position.x = 999; assert.equal(r.state.cast.direction.x, .6);
    assert.equal(r.state.cast.released, false);
  });
  check('IDs belong to world/monster sequence, not target player or visual asset', () => {
    const a = begin(), b = begin(fresh(), { target: { ...target, id: 'player:B' } });
    assert.equal(a.state.cast.castId, b.state.cast.castId);
    assert.notEqual(begin(create({ worldEpoch: 'world:B', actorId: 7 })).state.cast.castId, a.state.cast.castId);
    assert.notEqual(begin(create({ worldEpoch: 'world:A', actorId: 8 }), { actor: { ...actor, id: 8 } }).state.cast.castId, a.state.cast.castId);
    assert.throws(() => create({ worldEpoch: 'world:A', actorId: 7, actorType: 'lich' }));
  });
  check('Release frontier: before / exact / after, then exactly one end', () => {
    let r = step(begin().state, timing.releaseAt - 1e-8); assert.deepEqual(phases(r), []);
    r = step(r.state, 1e-8); assert.deepEqual(phases(r), ['release']);
    r = step(r.state, 1e-8); assert.deepEqual(phases(r), []);
    r = step(r.state, 2); assert.deepEqual(phases(r), ['end']);
    assert.deepEqual(phases(step(r.state, 20)), []);
  });
  check('Long dt crosses release and end in order, exposes correct substep offset', () => {
    const before = step(begin().state, .2).state, r = step(before, 2);
    assert.deepEqual(phases(r), ['release', 'end']);
    assert.equal(r.events[0].elapsed, timing.releaseAt);
    assert.equal(r.events[0].releaseOffsetInStep, timing.releaseAt - .2);
    assert.equal(r.events[0].remainderAfterRelease, 2 - (timing.releaseAt - .2));
    assert.equal(r.state.cast.elapsed, 1.1);
  });
  check('Moved caster resamples origin; moved target does not rotate locked direction', () => {
    const r = step(begin().state, .7, { actor: { ...actor, position: { x: 2, z: 3 } }, target: { ...target, position: { x: 8, z: -8 } } });
    assert.deepEqual(r.events[0].origin, { x: 2, z: 3 });
    assert.deepEqual(r.events[0].direction, { x: 0, z: -1 });
    assert(!('y' in r.events[0].origin));
  });
  for (const [reason, changes] of [['freeze', { frozen: true }], ['stun', { stunned: true }], ['death', { alive: false }], ['removed', { present: false }]]) {
    check(`${reason} before marker cancels even on a long crossing tick; no orphan on recovery`, () => {
      let r = step(step(begin().state, .2).state, 20, { actor: { ...actor, ...changes } });
      assert.deepEqual(phases(r), ['cancel', 'end']); assert.equal(r.state.cast.cancelReason, reason);
      assert.equal(r.state.cast.released, false);
      const castId = r.state.cast.castId; r = step(r.state, 20); assert.deepEqual(phases(r), []);
      assert.equal(prepare(r.state, { ...context, ready: true, sequence: 1 }).accepted, false);
      assert.equal(cancel(r.state, { castId, reason }).accepted, false);
    });
    check(`${reason} after release terminates cast but cannot retract projectile`, () => {
      const released = step(begin().state, .7), projectile = structuredClone(released.events[0]);
      const r = step(released.state, .2, { actor: { ...actor, ...changes } });
      assert.deepEqual(phases(r), ['cancel', 'end']); assert(r.state.cast.released);
      assert.deepEqual(projectile, released.events[0]); assert(!r.events.some(e => e.phase === 'release'));
    });
  }
  for (const [reason, extra] of [
    ['target-unavailable', { target: { ...target, alive: false } }],
    ['target-unavailable', { target: null }],
    ['target-mismatch', { target: { ...target, id: 'player:B' } }],
    ['target-life-changed', { target: { ...target, lifeId: 'life:B' } }],
    ['line-of-sight', { losClear: false }], ['line-of-sight', { losClear: undefined }],
    ['range', { inRange: false }],
  ]) check(`Release revalidation: ${reason} (${JSON.stringify(extra)})`, () => {
    const r = step(begin().state, .9, extra); assert.deepEqual(phases(r), ['cancel', 'end']);
    assert.equal(r.state.cast.cancelReason, reason); assert.equal(r.state.cast.elapsed, timing.releaseAt);
  });
  check('Pause holds age; control cancellation still takes precedence while paused', () => {
    let r = step(begin().state, 100, { paused: true }); assert.equal(r.state.cast.elapsed, 0); assert.deepEqual(phases(r), []);
    assert.equal(project(snapshot(r.state), 100).cast.elapsed, 0);
    r = step(r.state, .2); assert.equal(r.state.cast.elapsed, .2);
    r = step(r.state, 10, { paused: true, actor: { ...actor, frozen: true } }); assert.deepEqual(phases(r), ['cancel', 'end']);
  });
  check('Same world tick cannot advance twice, even if second call chooses another player', () => {
    const a = step(begin().state, .3, { tick: 20 });
    const b = step(a.state, .4, { tick: 20, target: { ...target, id: 'player:B' } });
    assert.equal(b.accepted, false); assert.equal(b.state.cast.elapsed, .3); assert.deepEqual(phases(b), []);
    assert.equal(step(a.state, .5, { tick: 19 }).accepted, false);
  });
  check('No new prepare while active, no stale sequence after end, next monster sequence works', () => {
    const a = begin().state; assert.equal(begin(a).reason, 'busy');
    const end = step(a, 2).state;
    assert.equal(prepare(end, { ...context, ready: true, sequence: 1 }).accepted, false);
    assert.equal(prepare(end, { ...context, ready: true, sequence: 3 }).accepted, false);
    assert.equal(begin(end).state.sequence, 2);
  });
  check('Explicit cancellation requires matching identity and cannot consume a later cast', () => {
    const a = begin().state, end = step(a, 2).state, next = begin(end).state;
    assert.equal(cancel(next, { castId: a.cast.castId }).accepted, false);
    const r = cancel(next, { castId: next.cast.castId, reason: 'world-reset' });
    assert.deepEqual(phases(r), ['cancel', 'end']);
  });
  check('Preparation rejects cooldown/range/LOS/dead/frozen/removed/paused/zero direction', () => {
    for (const extra of [{ ready: false }, { inRange: false }, { losClear: false },
      { actor: { ...actor, alive: false } }, { actor: { ...actor, frozen: true } },
      { actor: { ...actor, present: false } }, { paused: true }, { target: { ...target, position: { x: 0, z: 0 } } }]) {
      const s = fresh(), r = begin(s, extra); assert.equal(r.accepted, false); assert.deepEqual(r.events, []); assert.equal(r.state, s);
    }
  });
  check('Invalid dt/tick reject; zero dt cannot manufacture a release', () => {
    for (const dt of [-1, NaN, Infinity]) assert.throws(() => step(begin().state, dt));
    assert.throws(() => step(begin().state, .1, { tick: 1.5 }));
    assert.deepEqual(phases(step(begin().state, 0)), []);
  });
  check('Pure reducers accept frozen inputs and do not mutate caller cooldown/damage/range', () => {
    const s = freeze(fresh()), input = freeze({ ...structuredClone(context), ready: true, sequence: 1, cooldown: 1.45, damage: 19, range: [4.2, 16] });
    const original = JSON.stringify({ s, input }), r = prepare(s, input); freeze(r.state);
    advance(r.state, freeze({ ...structuredClone(context), tick: 1, dt: 2 }));
    assert.equal(JSON.stringify({ s, input }), original);
  });
  check('Latejoin during prepare/recovery/end receives pose age but never release events', () => {
    for (const age of [.2, .8, 2]) {
      const s = snapshot(step(begin().state, age).state), r = accept(null, s, { worldEpoch: 'world:A', actorId: 7 });
      assert(r.accepted); assert.deepEqual(r.events, []);
      const v = project(r.snapshot, .1); assert.deepEqual(v.events, []);
      assert.equal(v.cast.releaseConfirmed, age >= timing.releaseAt);
    }
  });
  check('Extrapolated visual age may cross marker; no fabricated authoritative release/end', () => {
    const r = project(snapshot(step(begin().state, .2).state), 12);
    assert.equal(r.cast.elapsed, 1.1); assert.equal(r.cast.remaining, 0); assert.equal(r.cast.visualActive, false);
    assert.equal(r.cast.phase, 'prepare'); assert.equal(r.cast.releaseConfirmed, false); assert.deepEqual(r.events, []);
  });
  check('Old/duplicate snapshots, terminal resurrection and direction mutation rejected', () => {
    const a = step(begin().state, .2).state, b = step(a, .5).state, end = step(b, 1).state;
    const scope = { worldEpoch: 'world:A', actorId: 7 };
    assert(!accept(snapshot(b), snapshot(a), scope).accepted);
    assert(!accept(snapshot(b), snapshot(b), scope).accepted);
    const late = snapshot(b); late.revision = end.revision + 2;
    assert(!accept(snapshot(end), late, scope).accepted);
    const turn = snapshot(b); turn.direction = null; turn.cast.direction = { x: 1, z: 0 }; turn.revision++;
    assert(!accept(snapshot(b), turn, scope).accepted);
    const cancelled = cancel(a, { castId: a.cast.castId, reason: 'freeze' }).state;
    const replay = snapshot(b); replay.revision = cancelled.revision + 10;
    assert(!accept(snapshot(cancelled), replay, scope).accepted);
  });
  check('World epoch change is explicit; old world cannot revive reused monster ID', () => {
    const old = snapshot(begin().state), current = snapshot(begin(create({ worldEpoch: 'world:B', actorId: 7 })).state);
    const scope = { worldEpoch: 'world:B', actorId: 7 };
    assert(!accept(null, old, scope).accepted); assert(accept(old, current, scope).accepted);
    assert(!accept(null, current, { ...scope, actorId: 8 }).accepted);
  });
  check('Terminal outcome and released origin cannot be rewritten by a newer snapshot', () => {
    const scope = { worldEpoch: 'world:A', actorId: 7 }, end = snapshot(step(begin().state, 2).state);
    const forged = structuredClone(end); forged.revision++; forged.cast.endReason = 'cancelled'; forged.cast.cancelReason = 'freeze';
    assert(!accept(end, forged, scope).accepted);
    const moved = structuredClone(end); moved.revision++; moved.cast.releaseOrigin.x++;
    assert(!accept(end, moved, scope).accepted);
  });
  check('Snapshot is detached, JSON roundtrip-safe, and invalid ages/data are rejected', () => {
    const state = begin().state, snap = snapshot(state); snap.cast.direction.x = 20;
    assert.equal(state.cast.direction.x, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot(state))), state);
    assert(!accept(null, snap, { worldEpoch: 'world:A', actorId: 7 }).accepted);
    assert.throws(() => project(snapshot(state), -1)); assert.throws(() => project(snapshot(state), Infinity));
  });
  check('World-owned state fanout to two players still has one projectile release', () => {
    let s = begin().state; const seen = new Set(), projectiles = [], peers = [null, null];
    for (let i = 0; i < 20; i++) {
      const r = step(s, .1); s = r.state;
      for (const e of [...r.events, ...r.events]) if (!seen.has(e.eventId)) { seen.add(e.eventId); if (e.phase === 'release') projectiles.push(e); }
      for (let k = 0; k < peers.length; k++) peers[k] = accept(peers[k], snapshot(s), { worldEpoch: 'world:A', actorId: 7 }).snapshot;
    }
    assert.equal(projectiles.length, 1); assert.deepEqual(peers[0], peers[1]);
  });
  check('Timestep partition invariance with static context (120Hz/10Hz/single long tick)', () => {
    const run = steps => { let s = begin().state; const events = []; for (const dt of steps) { const r = step(s, dt); s = r.state; events.push(...r.events); } return { cast: s.cast, events: events.map(e => [e.phase, e.elapsed, e.origin]) }; };
    const large = run([2]); assert.deepEqual(run(Array(240).fill(1/120)), large); assert.deepEqual(run(Array(20).fill(.1)), large);
  });
  check('Caller boundary debits only its supplied cooldown on accepted prepare', () => {
    for (const cooldownDuration of [1.45, 1.65]) {
      const input = { ...context, worldEpoch: 'world:A', tick: 1, dt: .1, ready: true, cooldownDuration };
      const a = caller(input); assert.equal(a.assignCooldown, cooldownDuration); assert.equal(a.state.cast.elapsed, 0); assert(a.consumeActorStep);
      const b = caller({ ...input, tick: 2, state: a.state, dt: 2 });
      assert.equal(b.assignCooldown, null); assert(b.consumeActorStep); assert.deepEqual(phases(b), ['release', 'end']);
      const duplicate = caller({ ...input, tick: 2, state: b.state }); assert(!duplicate.accepted); assert.equal(duplicate.assignCooldown, null);
      const blocked = caller({ ...input, tick: 3, state: b.state, ready: false }); assert(!blocked.consumeActorStep); assert.equal(blocked.assignCooldown, null);
    }
  });
  check('Caller cancellation does not refund/reset cooldown or start again in the same tick', () => {
    const input = { ...context, worldEpoch: 'world:A', tick: 1, dt: .1, ready: true, cooldownDuration: 1.45 };
    const a = caller(input), b = caller({ ...input, state: a.state, tick: 2, actor: { ...actor, frozen: true } });
    assert.equal(b.assignCooldown, null); assert.deepEqual(phases(b), ['cancel', 'end']);
    assert(!caller({ ...input, state: b.state, tick: 2 }).accepted);
    assert.throws(() => caller({ ...input, state: b.state, tick: 3, worldEpoch: 'world:B' }));
  });
  check('Expired within-tick control must be carried into caller context', () => {
    const before = begin().state, timerAtStart = .01, timerNow = 0;
    const r = step(before, 2, { actor: { ...actor, frozen: timerAtStart > 0 || timerNow > 0 } });
    assert.deepEqual(phases(r), ['cancel', 'end']); assert(!r.state.cast.released);
  });

  check('Actual caller policies extracted without importing/executing server', () => {
    const main = fs.readFileSync('src/main.js', 'utf8'), server = fs.readFileSync('server.mjs', 'utf8');
    const profileMatch = server.match(/  caster: (\{[^\n]+\}),/); assert(profileMatch);
    const serverProfile = vm.runInNewContext(`(${profileMatch[1]})`);
    const sandbox = vm.createContext({ serverMonsterProfiles: { caster: serverProfile }, monsterProfiles: { caster: { projectileColor: 0xd978ff } } });
    for (const [source, name] of [[main, 'canUseRangedAttack'], [main, 'getRangedCooldown'], [main, 'getEnemyProjectileSpec'], [server, 'getServerRangedCooldown'], [server, 'getServerProjectileSpec']]) vm.runInContext(extractFunction(source, name), sandbox);
    assert.equal(sandbox.getRangedCooldown('caster'), 1.45); assert.equal(sandbox.getServerRangedCooldown('caster'), 1.65);
    for (const [distance, expected] of [[4.2, false], [4.200001, true], [15.999999, true], [16, false]]) assert.equal(sandbox.canUseRangedAttack('caster', distance), expected);
    const guard = server.match(/if \((profile\.ranged && distance < 22[^\n]+)\) \{/); assert(guard);
    const guarded = vm.runInContext(`(profile,distance,meleeRange,monster,clearMelee) => ${guard[1]}`, sandbox);
    const meleeRange = serverProfile.radius + .72;
    assert(!guarded(serverProfile, meleeRange + 1.2, meleeRange, { attackCooldown: 0 }, true));
    assert(guarded(serverProfile, meleeRange + 1.200001, meleeRange, { attackCooldown: 0 }, true));
    assert(!guarded(serverProfile, 22, meleeRange, { attackCooldown: 0 }, true));
    assert(guarded(serverProfile, 21.999, meleeRange, { attackCooldown: 0 }, true));
    report.callerAudit = { main: { minExclusive: 4.2, maxExclusive: 16, cooldown: sandbox.getRangedCooldown('caster'), projectile: sandbox.getEnemyProjectileSpec('caster') },
      server: { minExclusive: meleeRange + 1.2, minFormula: '(profile.meleeRange ?? monster.radius + .72) + reachBonus + 1.2', maxExclusive: 22, cooldown: sandbox.getServerRangedCooldown('caster'), projectile: sandbox.getServerProjectileSpec('caster'), baseProfile: serverProfile },
      los: 'existing caller XZ sweep at y=.9, radius0', collisionHeight: 1.05,
      damage: 'existing monster.damage + floor(wave * .35), applied at release by caller' };
  });
  report.after = hashes(); report.sourceStable = JSON.stringify(report.before) === JSON.stringify(report.after);
  assert(report.sourceStable);
  report.referenceSourceChanges = Object.keys(reference.hashes).filter(f => sha(f) !== reference.hashes[f]);
  report.passed = true;
} catch (error) { report.passed = false; report.error = error.stack; process.exitCode = 1; }
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, passed: report.passed, tests: report.tests.length, sourceStable: report.sourceStable, error: report.error }));
