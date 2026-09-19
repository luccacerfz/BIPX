import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { THREE, bonesOf } from './hero-locomotion-cpu-support.mjs';
import { loadHeroVisual } from '../src/assets/character-library.js';
import { loadDwarfVisual } from '../src/assets/dwarf-library.js';
import { HERO_SKILL_MOTIONS } from '../src/assets/hero-skill-motion.js';
import { getClassSkill } from '../src/combat/class-skills.mjs';

// Real mixer/rig endpoint comparisons, including independent anticipation and
// recovery overrides. This fixture neither imports main nor changes gameplay.
const files = [
  'tools/animation-retiming-cpu.mjs', 'tools/hero-locomotion-cpu-support.mjs',
  'src/assets/hero-skill-motion.js', 'src/assets/hero-locomotion.js',
  'src/assets/hero-foot-probes.js', 'src/assets/character-library.js',
  'src/assets/dwarf-library.js', 'src/assets/load-glb.js',
  'src/assets/warrior-skill-clips.json', 'src/assets/dwarf-skill-clips.json',
  'src/assets/warrior-locomotion-clips.json', 'src/assets/dwarf-locomotion-clips.json',
  'src/assets/vendor/GLTFLoader.js', 'src/assets/vendor/SkeletonUtils.js',
  'src/assets/vendor/BufferGeometryUtils.js', 'vendor/three/three.module.js',
  'src/combat/class-skills.mjs', 'assets/models/aldric-hero.glb',
  'assets/models/dwarf-rifleman.glb',
];
const fingerprint = async () => Object.fromEntries(await Promise.all(files.map(async file =>
  [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report = { scope: 'CPU actual mixers/rigs with explicit timing overrides and remote age; no render/gameplay/no-slide approval.',
  startedAt: new Date().toISOString(), before: await fingerprint(), cases: [] };
const pattern = [0, .017, .043, .099, .008];
let sequence = 0;

async function actorFor(definition) {
  const parent = new THREE.Group();
  const actor = await (definition.characterId === 'warrior' ? loadHeroVisual : loadDwarfVisual)({
    THREE, parent, height: definition.characterId === 'warrior' ? 2.7 : 2.55,
  });
  for (let i = 0; i < 120; i++) actor.update(1 / 120, { speed: 0 });
  return actor;
}

function advanceTo(actor, end) {
  let step = 0;
  while (actor.stats.cast.elapsed < end - 1e-10) {
    const dt = Math.min(pattern[step++ % pattern.length], end - actor.stats.cast.elapsed);
    actor.update(dt, { speed: 0 });
    assert(step < 1000, 'Cast stopped progressing');
  }
}

function upperPose(actor) {
  actor.root.updateWorldMatrix(true, true);
  const bones = Object.fromEntries(Object.entries(bonesOf(actor.model)).map(([name, bone]) => [name.replace(/_\d+$/, ''), bone]));
  const inverse = bones.Hips.matrixWorld.clone().invert();
  const objects = Object.entries(bones).filter(([name]) => /^(Spine|Neck|Head|LeftArm|RightArm|LeftForeArm|RightForeArm|LeftHand|RightHand|LeftShoulder|RightShoulder)/.test(name));
  objects.push(['weapon', actor.weapon]);
  if (actor.shield) objects.push(['shield', actor.shield]);
  return Object.fromEntries(objects.map(([name, object]) =>
    [name, new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld).elements]));
}

function poseError(expected, actual) {
  let error = 0;
  for (const [name, values] of Object.entries(expected)) for (let i = 0; i < 16; i++)
    error = Math.max(error, Math.abs(values[i] - actual[name][i]));
  assert(Number.isFinite(error));
  assert(error < 1e-5, `Retiming changed the authored upper body/prop pose: ${error}`);
  return error;
}

for (const d of Object.values(HERO_SKILL_MOTIONS)) {
  const core = getClassSkill(d.skillId);
  assert.equal(d.duration, core.duration);
  assert.equal(d.impactAt, core.windup);
  const reference = await actorFor(d);
  let releasePose, recoveryPose;
  try {
    assert(reference.cast({ skillId: d.skillId, castId: ++sequence, duration: core.duration, impactAt: core.windup }));
    advanceTo(reference, core.windup);
    releasePose = upperPose(reference);
    advanceTo(reference, (core.duration + core.windup) / 2);
    recoveryPose = upperPose(reference);
  } finally { reference.dispose(); }

  const timings = [
    { name: 'explicit-core', duration: core.duration, impactAt: core.windup },
    { name: 'short-preparation-long-recovery', duration: core.duration * 1.4 + .11, impactAt: Math.max(.12, core.windup * .55) },
    { name: 'long-preparation-short-recovery', duration: core.windup * 1.4 + .36, impactAt: core.windup * 1.4 + .15 },
  ];
  for (const timing of timings) for (const remote of [false, true]) {
    const actor = await actorFor(d);
    try {
      const elapsed = remote ? timing.impactAt - .03 : 0;
      const castId = ++sequence;
      assert(actor.cast({ skillId: d.skillId, castId, ...timing, elapsed }));
      assert.equal(actor.cast({ skillId: d.skillId, castId, ...timing, elapsed }), false);
      advanceTo(actor, timing.impactAt);
      const releaseClockError = Math.abs(actor.stats.animationTime - d.impactAt);
      assert(releaseClockError < 1e-7, 'Explicit emission must land on authored emission once, without double time scaling');
      // Remote catchup still crossfades for .07 s; compare pose only after that
      // blend has elapsed. Its action clock must already be correct at release.
      const releasePoseError = remote ? null : poseError(releasePose, upperPose(actor));
      advanceTo(actor, (timing.duration + timing.impactAt) / 2);
      const recoveryClockError = Math.abs(actor.stats.animationTime - (d.duration + d.impactAt) / 2);
      assert(recoveryClockError < 1e-7, 'Recovery must have its own retiming interval');
      const recoveryPoseError = poseError(recoveryPose, upperPose(actor));
      advanceTo(actor, timing.duration);
      // Permit one small frame for floating-point endpoint equality in Mixer.
      actor.update(1 / 120, { speed: 0 });
      assert.equal(actor.stats.cast.phase, 'complete');
      assert.equal(actor.stats.currentClip, 'Idle');
      assert.equal(actor.cast({ skillId: d.skillId, castId: ++sequence, ...timing, elapsed: timing.duration }), false);
      report.cases.push({ skillId: d.skillId, ...timing, remote, elapsed,
        releaseClockError, releasePoseError, recoveryClockError, recoveryPoseError, completed: true });
    } finally { actor.dispose(); }
  }
}
report.after = await fingerprint();
report.changedFiles = files.filter(file => report.before[file] !== report.after[file]);
report.sourceStable = !report.changedFiles.length;
report.passed = report.sourceStable && report.cases.length === 36;
report.finishedAt = new Date().toISOString();
const out = path.resolve(process.env.ANIMATION_RETIMING_OUTPUT || `output/arpg-animation/retiming-${report.startedAt.replace(/[:.]/g, '-')}.json`);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out, passed: report.passed, sourceStable: report.sourceStable, cases: report.cases.length,
  maximumReleaseClockError: Math.max(...report.cases.map(c => c.releaseClockError)),
  maximumRecoveryPoseError: Math.max(...report.cases.map(c => c.recoveryPoseError)) }));
assert(report.passed);
