import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three/three.module.js';
import { beginSkill, createSkillState, advanceSkills } from '../../../src/combat/class-skills.mjs';
import { createCollisionWorld, sweepStatic } from '../../../src/physics/contacts.mjs';
import { createCannonOriginBridge } from '../../../assets/vfx/source-history/cannon-origin-staging-20260919/cannon-origin-bridge.js';

// Synthetic CPU falsification using literal core/bridge/contacts and a previously
// captured socket. This does not measure the current hero pose or live gameplay.
const referencePath = 'output/playwright/2026-09-19T02-15-38-208Z-cannon-wrapper-vfx-native/cannon-wrapper-report.json';
const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
const capture = reference.captures.find(row => row.stats.time === .86);
const [x, y, z] = capture.stats.releaseOrigin;
const emitter = { x, y, z };
const files = [referencePath, 'src/combat/class-skills.mjs', 'src/physics/contacts.mjs',
  'assets/vfx/source-history/cannon-origin-staging-20260919/cannon-origin-bridge.js',
  'docs/arpg/review/cannon-bridge-contact-audit.mjs'];
const hashes = () => Object.fromEntries(files.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before = hashes();
const world = createCollisionWorld({ colliders: [{ id: 'thin-corner-witness',
  shape: 'box', x: -1.62, z: 2, halfX: .04, halfZ: .04, minY: 0, maxY: 3 }] });
const rows = [];
for (const hz of [10, 30, 60, 120]) {
  const queries = [];
  const bridge = createCannonOriginBridge({ THREE, sweepVisual(from, to, radius, context) {
    const visual = sweepStatic(world, from, to, radius);
    const authority = sweepStatic(world, { ...from, y: context.authorityY }, { ...to, y: context.authorityY }, radius);
    const hit = [visual, authority].filter(Boolean).sort((a, b) => a.t - b.t)[0] || null;
    queries.push({ phase: context.phase, from, to, t: hit?.t ?? null });
    return hit;
  } });
  const state = createSkillState('dwarf');
  const actor = { x: -2, y: 0, z: 5, playing: true, runId: `bridge-corner-${hz}` };
  const start = beginSkill(state, { slot: 0, aimX: 0, aimZ: -1 }, actor);
  assert.equal(start.ok, true);
  const crossings = [];
  const travels = [];
  let impact = null;
  for (let frame = 0; frame < hz * 2; frame++) advanceSkills(state, 1 / hz, {
    actor,
    sweepStatic: (from, to, radius) => sweepStatic(world, from, to, radius),
    emit(event) {
      if (event.phase === 'release') bridge.release({ ...event, emitter });
      if (event.phase === 'impact') impact = event.target;
      if (event.phase !== 'travel') return;
      const firstQuery = queries.length;
      const mapped = bridge.travel(event);
      const visualFrom = { x: mapped.origin.x, y: mapped.origin.y, z: mapped.origin.z };
      const visualTo = { x: mapped.target.x, y: mapped.target.y, z: mapped.target.z };
      const hit = sweepStatic(world, visualFrom, visualTo, .32);
      const row = { frame, origin: event.origin, target: event.target,
        visualFrom, visualTo, resetTrail: mapped.resetTrail, terminal: event.terminal,
        queries: queries.slice(firstQuery), visualHit: hit,
        authorityHit: sweepStatic(world, event.origin, event.target, .32),
        distanceFromAuthority: Math.hypot(visualTo.x - event.target.x,
          visualTo.y - event.target.y, visualTo.z - event.target.z),
        progress: bridge.getStats().progress };
      travels.push(row);
      if (!mapped.resetTrail && Math.hypot(visualFrom.x - visualTo.x,
        visualFrom.y - visualTo.y, visualFrom.z - visualTo.z) > 1e-10 && hit && hit.t < 1 - 1e-5) crossings.push(row);
    },
  });
  assert.ok(impact, 'Core must finish the shot');
  assert.equal(travels.some(row => row.authorityHit), false, 'Witness must leave core trajectory clear');
  rows.push({ hz, emitter, crossings, crossingCount: crossings.length, travels: travels.length,
    maximumDistanceFromAuthority: Math.max(...travels.map(row => row.distanceFromAuthority)),
    lastNonterminal: travels.filter(row => !row.terminal).at(-1),
    impact, finalBridgeStats: bridge.getStats() });
}
const report = { at: new Date().toISOString(), syntheticFixture: true,
  scope: 'Literal class-skills + staged visual bridge + static contacts. Fixed captured socket; one thin corner witness. No live browser/render proof.',
  sourceHashes: before, sourceStable: JSON.stringify(before) === JSON.stringify(hashes()),
  visualSegmentsClear: rows.every(row => row.crossingCount === 0), rows };
assert.equal(report.sourceStable, true);
const out = `output/qa/arpg-root-review/${report.at.replace(/[:.]/g, '-')}-cannon-bridge-contact.json`;
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out, sourceStable: report.sourceStable, visualSegmentsClear: report.visualSegmentsClear,
  rows: rows.map(row => ({ hz: row.hz, crossingCount: row.crossingCount, crossings: row.crossings,
    maximumDistanceFromAuthority: row.maximumDistanceFromAuthority,
    lastNonterminal: row.lastNonterminal })) }));
