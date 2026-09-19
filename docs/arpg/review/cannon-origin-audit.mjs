import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { beginSkill, createSkillState, advanceSkills } from '../../../src/combat/class-skills.mjs';

// CPU diagnostic: real core events compared with a socket captured in a native
// fixture. This is neither a new socket measurement nor live gameplay.
const reportPath = 'output/playwright/2026-09-19T02-15-38-208Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const fixturePath = path.join(report.snapshot, 'src/cannon-wrapper-vfx-preview.html');
const fixture = fs.readFileSync(fixturePath, 'utf8');
const match = fixture.match(/heroGroup\.position\.set\(([-\d.]+),([-\d.]+),([-\d.]+)\)/);
assert.ok(match, 'Must bind the actor origin to the preserved fixture source');
const actorOrigin = { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) };
const reference = report.captures.find(row => row.stats.time === .86);
assert.ok(reference?.stats.releaseOrigin?.length === 3);
const [x, y, z] = reference.stats.releaseOrigin;
const capturedMuzzle = { x, y, z };
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = ['src/combat/class-skills.mjs', 'src/main.js', reportPath, fixturePath, 'docs/arpg/review/cannon-origin-audit.mjs'];
const before = Object.fromEntries(files.map(file => [file, sha(file)]));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const results = [];
for (const hz of [30, 60, 120]) {
  const state = createSkillState('dwarf');
  const actor = { ...actorOrigin, playing: true, runId: `origin-audit-${hz}` };
  const started = beginSkill(state, { slot: 0, aimX: 0, aimZ: -1 }, actor);
  assert.equal(started.ok, true);
  const events = [started.event];
  for (let i = 0; i < hz * 2; i++) advanceSkills(state, 1 / hz, { actor, emit: event => events.push(event) });
  const release = events.find(event => event.phase === 'release');
  const firstTravel = events.find(event => event.phase === 'travel');
  const impact = events.find(event => event.phase === 'impact');
  assert.ok(release && firstTravel && impact);
  assert.equal(events.filter(event => event.phase === 'release').length, 1);
  assert.equal(events.filter(event => event.phase === 'impact').length, 1);
  results.push({ hz, actorOrigin, capturedMuzzle, releaseOrigin: release.origin,
    firstTravelOrigin: firstTravel.origin, firstTravelTarget: firstTravel.target,
    muzzleToAuthoritativeOriginMeters: distance(capturedMuzzle, release.origin),
    muzzleToFirstBodyMeters: distance(capturedMuzzle, firstTravel.target),
    authoritativeHeightMinusMuzzle: release.origin.y - capturedMuzzle.y,
    firstBodyBehindMuzzleMeters: firstTravel.target.z - capturedMuzzle.z,
    impact: impact.target, rangeFromActor: distance(impact.target, release.origin),
  });
}
const after = Object.fromEntries(files.map(file => [file, sha(file)]));
const result = { at: new Date().toISOString(), scope: 'Literal class-skills core with no targets/walls; captured native fixture socket held fixed for comparison across dt rates. No visual playback or live defect acceptance.',
  sourceStable: JSON.stringify(before) === JSON.stringify(after), sourceHashes: before,
  conclusion: 'The fixture trajectory begins at the captured muzzle. The actual core begins at actor XZ and Y1.05; current presentation forwards its travel coordinates unchanged. Integration must explicitly validate this discontinuity.',
  visualContinuityAccepted: false, results };
assert.equal(result.sourceStable, true, 'Source changed during diagnostic');
const out = `output/qa/arpg-root-review/${result.at.replace(/[:.]/g, '-')}-cannon-origin.json`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ out, sourceStable: result.sourceStable, results }));
