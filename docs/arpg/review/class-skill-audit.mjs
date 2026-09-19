// Read-only reproduction of presentation/simulation mismatches, not acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
process.chdir(root);
const files = ['docs/arpg/review/class-skill-audit.mjs', 'src/combat/class-skills.mjs',
  'src/main.js', 'server.mjs', 'src/vfx/class-skill-vfx.js'];
const hashes = () => Object.fromEntries(files.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const startedAt = new Date().toISOString(), before = hashes();
const { createSkillState, beginSkill, advanceSkills } = await import('../../../src/combat/class-skills.mjs');
const movingRelease = [];
for (const [classId, slot] of [['dwarf', 0], ['dwarf', 1], ['dwarf', 2], ['warrior', 1]]) {
  const state = createSkillState(classId);
  const actor = { x: 0, z: 0, playing: true, runId: `review-${classId}-${slot}`, damageMultiplier: 2 };
  const accepted = beginSkill(state, { slot, aimX: 1, aimZ: 0 }, actor);
  if (!accepted.ok) throw new Error('Review setup rejected');
  const events = [];
  let time = 0;
  while (time < 1 && !events.length) {
    const dt = 1 / 60; time += dt; actor.x += 6.5 * dt;
    advanceSkills(state, dt, { emit: event => events.push({ time, actorAtEmission: { x: actor.x, z: actor.z }, ...event }) });
  }
  const first = events[0];
  const emittedPoint = first.phase === 'impact' ? first.target : first.origin;
  movingRelease.push({ skillId: accepted.event.skillId, acceptedAt: { x: 0, z: 0 },
    time: first.time, phase: first.phase, actorAtEmission: first.actorAtEmission,
    emittedPoint, horizontalSeparation: Math.hypot(emittedPoint.x - actor.x, emittedPoint.z - actor.z),
    note: 'Actor movement is simulated as constant6.5m/s, matching current move-while-casting behavior. No DOM/GPU/network proof.' });
}

const state = createSkillState('dwarf');
const accepted = beginSkill(state, { slot: 2, aimX: 1, aimZ: 0 }, { x: 0, z: 0, playing: true, runId: 'review-pierce' });
const targets = Array.from({ length: 7 }, (_, i) => ({ id: `target-${i}`, x: 1 + i * .4, z: 0, radius: .05, dead: false }));
const hits = [], events = [];
for (let frame = 0; frame < 5; frame++) advanceSkills(state, .1, {
  targets, hit: target => hits.push(target.id), emit: event => events.push(event),
});
const travel = events.filter(event => event.phase === 'travel').at(-1);
const lastImpact = events.filter(event => event.phase === 'impact').at(-1);
const pierce = { skillId: accepted.event.skillId, hits, activeAfter: state.active.length,
  finalTravelEndpoint: travel?.target, lastImpact: lastImpact?.target,
  endpointPastLastTargetCenter: travel && lastImpact ? travel.target.x - lastImpact.target.x : null,
  note: 'Seven explicit fixture targets; six-hit cap. First-contact surface is before target center, so endpoint past center is a conservative overshoot.' };
const after = hashes(), changedFiles = files.filter(file => before[file] !== after[file]);
const output = path.join('output/qa/arpg-root-review', `${startedAt.replace(/[:.]/g, '-')}-class-skill.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), before, after,
  changedFiles, sourceStable: !changedFiles.length, evidenceKind: 'CPU_simulation_fixture_not_gameplay',
  accepted: false, movingRelease, pierce }, null, 2) + '\n');
console.log(JSON.stringify({ output, sourceStable: !changedFiles.length, changedFiles, movingRelease, pierce }));
