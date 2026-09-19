import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { moduleUrl, sourceHashes, sha256 } from './class-skill-vfx-support.mjs';
import { beginSkill, createSkillState, advanceSkills, cancelSkills, getClassSkill, skillSnapshot } from '../src/combat/class-skills.mjs';
import { createCollisionWorld, sweepStatic } from '../src/physics/contacts.mjs';
import { createFixtureVisualSweep } from './cannon-origin-vfx-sweep.mjs';
const stage = 'assets/vfx/source-history/cannon-origin-staging-20260919';
const THREE = await import(await moduleUrl('vendor/three/three.module.js'));
const { createClassSkillVfx } = await import(await moduleUrl(`${stage}/class-skill-vfx.js`));
const stagedFiles=(await fs.readdir(stage)).filter(n=>n.endsWith('.js')).map(n=>`${stage}/${n}`);
const tracked=[...stagedFiles,'src/main.js','src/combat/class-skills.mjs','src/physics/contacts.mjs','tools/cannon-origin-vfx-sweep.mjs','tools/cannon-origin-vfx-cpu.mjs'];
const beforeSources=await sourceHashes(tracked);
const main = await fs.readFile('src/main.js', 'utf8');
const start = main.indexOf('function presentClassSkill('), end = main.indexOf('\n// Reconstruct enduring visuals', start);
assert.ok(start > 0 && end > start);
const adapter = main.slice(start, end);
const socketOffset = new THREE.Vector3(.2373511452952357, 1.7641336974451918, -1.397756736781511);
const box = (id, x, z, maxY = 3) => ({ id, shape: 'box', x, z, halfX: 2, halfZ: .1, minY: 0, maxY });
const cases = [
  { name: 'standing-clear' }, { name: 'moving-windup', moving: true },
  { name: 'near-live-target', targets: [{ id: 'close', x: -2, z: 4, radius: .15, health: 100 }] },
  { name: 'overlapping-target-t0', targets: [{ id: 'overlap', x: -2, z: 5, radius: .5, health: 100 }] },
  { name: 'wall-through-socket', colliders: [box('near-wall', -2, 4)] },
  { name: 'wall-ahead-socket', colliders: [box('ahead-wall', -2, 2.8)] },
  { name: 'low-beam-conservative-height', colliders: [box('low-beam', -2, 3.4, 1.15)] },
  { name: 'last-convergence-thin-corner', colliders: [{ id: 'thin-corner', shape: 'box', x: -1.62, z: 2, halfX: .04, halfZ: .04, minY: 0, maxY: 3 }] },
  { name: 'cancel-miss', cancelAt: .4 },
  { name: 'missing-callback', callback: 'missing' },
  { name: 'invalid-callback', callback: 'invalid' },
  { name: 'empty-callback-return', callback: 'empty' },
  { name: 'missing-socket', missingSocket: true },
];

function execute(scenario, hz, presentation) {
  const actor = { x: -2, y: 0, z: 5, playing: true, runId: `origin-${scenario.name}-${hz}`, damageMultiplier: 1 };
  const targets = structuredClone(scenario.targets ?? []);
  const world = createCollisionWorld({ colliders: scenario.colliders ?? [], bounds: { x: 0, z: 0, radius: 55 } });
  const scene = new THREE.Scene();
  const callback = scenario.callback === 'missing' ? undefined : scenario.callback === 'invalid' ? () => ({ t: NaN }) : scenario.callback === 'empty' ? () => undefined : createFixtureVisualSweep(world, () => targets);
  const vfx = presentation ? createClassSkillVfx({ THREE, scene, quality: 'low', reducedMotion: true, sweepVisual: callback }) : null;
  const socket = { updateWorldMatrix() {}, getWorldPosition: v => v.copy(actor).add(socketOffset) };
  const context = vm.createContext({ THREE, getClassSkill, multiplayer: { enabled: false, id: 'self' },
    heroVisual: { muzzle: scenario.missingSocket ? undefined : socket, cast() {} }, remotePlayers: new Map(), player: { shotCooldown: 0 }, pendingSwordStrike: null,
    classSkillVfx: vfx, audioManager: {}, game: { survivalTime: 0 }, skillSoundTravel: new Set(), skillPresentationHistory: [],
    getSpatialAudioOptions: () => ({}), isMultiplayerSuspended: () => false });
  if (vfx) vm.runInContext(`${adapter}\nthis.present=presentClassSkill;`, context);
  const state = createSkillState('dwarf'), events = [], hits = [], frames = [];
  let time = 0, cancelled = false;
  const emit = event => {
    const before = JSON.stringify(event); events.push({ time, ...structuredClone(event) });
    if (vfx) {
      context.present(event); assert.equal(JSON.stringify(event), before, 'Adapter must not mutate core event');
      const cast = vfx.getStats().cannon.casts[0];
      if (cast) frames.push({ time, phase: event.phase, terminal: !!event.terminal, origin: event.origin, target: event.target, ...cast });
    }
  };
  const accepted = beginSkill(state, { slot: 0, aimX: 0, aimZ: -1 }, actor); assert.equal(accepted.ok, true); emit(accepted.event);
  for (let i = 0; i < hz * 1.6; i++) {
    const dt = 1 / hz; time += dt;
    if (scenario.moving && time <= .3 + 1e-8) actor.x += 2 * dt;
    vfx?.update(dt); context.game.survivalTime = time;
    if (scenario.cancelAt && time >= scenario.cancelAt && !cancelled) { cancelSkills(state, emit, 'fixture-cancel'); cancelled = true; }
    advanceSkills(state, dt, { actor, targets, emit, sweepStatic: (a, b, r, kind) => sweepStatic(world, a, b, r, { kind }),
      hit(target, effect) { hits.push({ time, id: target.id, ...structuredClone(effect) }); target.health -= effect.damage; return target.health <= 0; } });
  }
  const result = { events, hits, state: skillSnapshot(state), targets, frames };
  if (vfx) {
    const impact = events.find(e => e.phase === 'impact');
    const terminal = frames.find(f => f.terminal);
    if (impact) { assert.ok(terminal); assert.deepEqual(terminal.position, [impact.target.x, impact.target.y, impact.target.z]); }
    if (scenario.cancelAt) { assert.equal(events.some(e => e.phase === 'impact'), false); assert.equal(vfx.getStats().cannon.casts.length, 0); }
    const release = frames.find(f => f.phase === 'release'), first = frames.find(f => f.phase === 'travel');
    assert.equal(release.origin.y, 1.05);
    if (scenario.moving) assert.ok(release.origin.x > -1.5);
    if (scenario.name === 'standing-clear' || scenario.name === 'moving-windup') {
      const f = first.originBridge; assert.equal(f.enabled, true); assert.equal(f.launchBlocked, false);
      const progress = Math.hypot(first.target.x - release.origin.x, first.target.z - release.origin.z);
      assert.ok(new THREE.Vector3(...first.position).distanceTo(new THREE.Vector3(...f.socket)) <= progress + 1e-5);
      assert.ok(frames.filter(f => f.phase === 'travel' && f.originBridge.progress > f.originBridge.settleDistance).every(f => new THREE.Vector3(...f.position).distanceTo(new THREE.Vector3(f.target.x, f.target.y, f.target.z)) < 1e-6));
    }
    if (['near-live-target', 'overlapping-target-t0', 'wall-through-socket', 'low-beam-conservative-height'].includes(scenario.name)) {
      assert.equal(release.originBridge.launchBlocked, true); assert.equal(release.muzzle.wanted, false);
    }
    if (scenario.callback) assert.equal(release.originBridge.fallback, scenario.callback === 'missing' ? 'missing-sweep' : 'invalid-sweep');
    if (scenario.missingSocket) assert.equal(release.originBridge.fallback, 'missing-socket');
    for (const f of frames.filter(f => f.phase === 'travel' && f.body)) {
      const p = { x: f.position[0], y: f.position[1], z: f.position[2] };
      assert.equal(sweepStatic(world, p, p, .32)?.t ?? null, null, 'Visual body must not occupy a solid');
    }
    if (scenario.name === 'last-convergence-thin-corner') {
      let previous = new THREE.Vector3(...release.originBridge.socket);
      let abandoned = false;
      for (const frame of frames.filter(f => f.phase === 'travel')) {
        const current = new THREE.Vector3(...frame.position);
        const distance = current.distanceTo(new THREE.Vector3(...frame.authorityPosition));
        assert.ok(distance <= socketOffset.clone().setY(socketOffset.y - 1.05).length() + 1e-6, 'Bridge must not accumulate separation from authority');
        if (frame.trailReset) {
          abandoned = true;
          assert.equal(frame.originBridge.abandoned, true);
          assert.equal(frame.originBridge.enabled, false);
          assert.equal(frame.body, false, 'Disconnected body is briefly hidden instead of drawn across the gap');
          assert.equal(frame.flight.wanted, false, 'Disconnected trail must be cleared');
        } else {
          assert.equal(sweepStatic(world, previous, current, .32), null, 'Last convergence segment must stay clear, including dt=.1');
        }
        if (abandoned) assert.ok(distance < 1e-9, 'Abandoned bridge must track authority immediately');
        previous.copy(current);
      }
      if (hz === 10) assert.equal(abandoned, true, 'The original corner witness must explicitly abandon its bridge');
      const last = frames.filter(f => f.phase === 'travel' && !f.terminal).at(-1);
      assert.ok(new THREE.Vector3(...last.position).distanceTo(new THREE.Vector3(...last.authorityPosition)) < 1e-9);
      assert.deepEqual(impact.target, { x: -2, y: 1.05, z: -17 }, 'Visual corner must not change the clear core path');
    }
    vfx.reset(); assert.equal(vfx.getStats().cannon.casts.length, 0); vfx.dispose();
  }
  return result;
}

const results = [];
for (const scenario of cases) for (const hz of [10, 30, 60, 120]) {
  const baseline = execute(scenario, hz, false), candidate = execute(scenario, hz, true);
  for (const key of ['events', 'hits', 'state', 'targets']) assert.deepEqual(candidate[key], baseline[key], `Authority changed: ${scenario.name}/${hz}/${key}`);
  results.push({ scenario: scenario.name, hz, authorityIdentical: true, ...candidate });
}
// Callback eligibility and zero segments are independent of presentation interpolation.
const world = createCollisionWorld({}), p = { x: 0, y: 1.05, z: 0 }, c = { authorityY: 1.05 };
assert.equal(createFixtureVisualSweep(world, () => [{ id: 'ally', ...p, radius: 1, health: 10, ally: true }, { id: 'corpse', ...p, radius: 1, health: 0 }])(p, p, .32, c), null);
assert.equal(createFixtureVisualSweep(world, () => [{ id: 'live', ...p, radius: 1, health: 10 }])(p, p, .32, c).t, 0);
assert.equal(await fs.readFile('src/main.js', 'utf8'), main, 'Main changed during CPU audit');
const files = (await fs.readdir(stage)).filter(n => n.endsWith('.js')).map(n => `${stage}/${n}`);
const report = { passed: true, scope: 'Real core + literal presentClassSkill; captured socket offset held fixed on a moving actor. CPU fixture, not new pose/socket measurement or gameplay.',
  adapterSha256: sha256(adapter), sources: await sourceHashes(tracked), results };
assert.deepEqual(report.sources,beforeSources,'Tracked sources changed during audit');report.sourceStable=true;
const output = `output/qa/cannon-origin-vfx-${new Date().toISOString().replace(/[:.]/g, '-')}-cpu.json`;
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: true, cases: results.length, output }));
