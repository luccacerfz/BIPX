// Independent diagnostic only: reads runtime geometry without changing controllers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
process.chdir(root);
const files = [
  'docs/arpg/review/sole-contact-audit.mjs', 'tools/hero-locomotion-cpu-support.mjs',
  'src/assets/hero-locomotion.js', 'src/assets/hero-foot-probes.js',
  'src/assets/hero-skill-motion.js',
  'src/assets/character-library.js', 'src/assets/dwarf-library.js', 'src/assets/load-glb.js',
  'src/assets/warrior-locomotion-clips.json', 'src/assets/dwarf-locomotion-clips.json',
  'src/assets/warrior-skill-clips.json', 'src/assets/dwarf-skill-clips.json',
  'src/assets/vendor/GLTFLoader.js', 'src/assets/vendor/SkeletonUtils.js',
  'src/assets/vendor/BufferGeometryUtils.js', 'vendor/three/three.module.js',
  'assets/models/aldric-hero.glb', 'assets/models/dwarf-rifleman.glb',
];
const fingerprint = () => Object.fromEntries(files.map(file => [file,
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const startedAt = new Date().toISOString();
const before = fingerprint();
const selectedCase = process.argv.find(value => value.startsWith('--case='))?.slice(7);
const transitionDetail = process.argv.includes('--transition-detail');
const { THREE, quantile } = await import('../../../tools/hero-locomotion-cpu-support.mjs');
const { loadHeroVisual } = await import('../../../src/assets/character-library.js');
const { loadDwarfVisual } = await import('../../../src/assets/dwarf-library.js');
const thresholds = { groundBandMeters: .008, localLowestBandMeters: .003,
  verticalSpeedMaxMetersPerSecond: .05, legacyGroundBandMeters: .04,
  warmupSeconds: 1, observedSeconds: 3, sampleHz: 120 };
const distribution = values => ({ count: values.length, median: quantile(values, .5),
  p90: quantile(values, .9), p99: quantile(values, .99), max: values.length ? Math.max(...values) : null });
const results = [];

for (const [id, loader, height] of [['warrior', loadHeroVisual, 2.7], ['dwarf', loadDwarfVisual, 2.55]]) {
  for (const [direction, angle, speed] of [['forward', 0, 6.5], ['strafe', Math.PI / 2, 6.5],
    ['backward', Math.PI, 6.5], ['upgraded-backward', Math.PI, 9.1]]) {
    if (selectedCase && selectedCase !== `${id}:${direction}`) continue;
    const parent = new THREE.Group();
    const actor = await loader({ THREE, parent, height });
    try {
      const probes = [[], []];
      actor.model.traverse(mesh => {
        if (!mesh.isSkinnedMesh) return;
        const { skinIndex, skinWeight } = mesh.geometry.attributes;
        for (let v = 0; v < skinIndex.count; v++) for (let side = 0; side < 2; side++) {
          let weight = 0;
          for (let k = 0; k < 4; k++) {
            const name = mesh.skeleton.bones[skinIndex.getComponent(v, k)].name;
            if (name.includes(side ? 'RightFoot' : 'LeftFoot') || name.includes(side ? 'RightToe' : 'LeftToe')) {
              weight += skinWeight.getComponent(v, k);
            }
          }
          if (weight > .75) probes[side].push({ mesh, vertex: v });
        }
      });
      if (probes.some(points => !points.length)) throw new Error(`Missing physical foot vertices: ${id}`);
      const velocity = { x: Math.sin(angle) * speed, z: -Math.cos(angle) * speed };
      const dt = 1 / thresholds.sampleHz;
      const previous = [null, null];
      const legacy = [], patch = [], patchDeclared = [], patchUndeclared = [];
      const patchReleasedBothFrames = [], patchContactTransition = [];
      const patchFrameMaximum = [], declaredMismatch = [], soleMinima = [], reach = [];
      const transitionFrames = [];
      let nearFloorFootFrames = 0, nearFloorWithoutDeclaredContact = 0;
      let observedFootFrames = 0, declaredContactFrames = 0, patchFrames = 0;
      const warmupFrames = thresholds.warmupSeconds * thresholds.sampleHz;
      const frameCount = warmupFrames + thresholds.observedSeconds * thresholds.sampleHz;
      for (let frame = 0; frame < frameCount; frame++) {
        parent.position.x += velocity.x * dt;
        parent.position.z += velocity.z * dt;
        actor.update(dt, { speed, velocity });
        parent.updateMatrixWorld(true);
        actor.model.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.skeleton.update(); });
        for (let side = 0; side < 2; side++) {
          const points = probes[side].map(({ mesh, vertex }) =>
            mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
          if (points.some(p => ![p.x, p.y, p.z].every(Number.isFinite))) throw new Error('Nonfinite skinned geometry');
          const minimum = Math.min(...points.map(p => p.y));
          const contact = actor.stats.locomotion.footContacts[side];
          const old = previous[side];
          if (frame >= warmupFrames && old) {
            observedFootFrames++;
            declaredContactFrames += Number(Boolean(contact.contact));
            soleMinima.push(minimum);
            reach.push(contact.reachError);
            if (minimum >= -.02 && minimum <= thresholds.groundBandMeters) {
              nearFloorFootFrames++;
              if (!contact.contact) nearFloorWithoutDeclaredContact++;
            }
            const frameSpeeds = [];
            let largestTransitionPatch = null;
            for (let n = 0; n < points.length; n++) {
              const p = points[n], q = old.points[n];
              const horizontalSpeed = Math.hypot(p.x - q.x, p.z - q.z) / dt;
              if (contact.contact && old.contact && Math.abs(p.y) < thresholds.legacyGroundBandMeters
                && Math.abs(q.y) < thresholds.legacyGroundBandMeters) legacy.push(horizontalSpeed);
              // Compare the SAME material vertex; changing the lowest vertex is
              // not displacement of a material contact point. No controller gate.
              if (Math.abs(p.y) <= thresholds.groundBandMeters && Math.abs(q.y) <= thresholds.groundBandMeters
                && p.y - minimum <= thresholds.localLowestBandMeters
                && q.y - old.minimum <= thresholds.localLowestBandMeters
                && Math.abs(p.y - q.y) / dt <= thresholds.verticalSpeedMaxMetersPerSecond) {
                patch.push(horizontalSpeed); frameSpeeds.push(horizontalSpeed);
                (contact.contact && old.contact ? patchDeclared : patchUndeclared).push(horizontalSpeed);
                if (!contact.contact && !old.contact) patchReleasedBothFrames.push(horizontalSpeed);
                if (Boolean(contact.contact) !== old.contact) patchContactTransition.push(horizontalSpeed);
                if (transitionDetail && Boolean(contact.contact) !== old.contact
                  && (!largestTransitionPatch || horizontalSpeed > largestTransitionPatch.horizontalSpeed)) {
                  largestTransitionPatch = {
                    vertex: probes[side][n].vertex, mesh: probes[side][n].mesh.name,
                    from: q.toArray(), to: p.toArray(), horizontalSpeed,
                    verticalSpeed: (p.y - q.y) / dt,
                  };
                }
              }
            }
            if (frameSpeeds.length) { patchFrames++; patchFrameMaximum.push(Math.max(...frameSpeeds)); }
            if (largestTransitionPatch) transitionFrames.push({
              frame, time: (frame + 1) * dt, foot: side ? 'right' : 'left',
              transition: contact.contact ? 'landing' : 'release',
              previousContact: old.contact, currentContact: Boolean(contact.contact),
              minimumSoleY: minimum, previousMinimumSoleY: old.minimum,
              gait: actor.stats.locomotion.gait, timeScale: actor.stats.locomotion.timeScale,
              strideScale: actor.stats.locomotion.strideScale,
              minimumSwingClearance: contact.minimumSwingClearance,
              reachError: contact.reachError, patch: largestTransitionPatch,
            });
            if (Number.isFinite(actor.stats.locomotion.speedMismatch)) declaredMismatch.push(actor.stats.locomotion.speedMismatch);
          }
          previous[side] = { points, minimum, contact: Boolean(contact.contact) };
        }
      }
      const result = { id, direction, speed, height, probes: probes.map(p => p.length),
        observedFootFrames, declaredContactFrames, nearFloorFootFrames, nearFloorWithoutDeclaredContact,
        undeclaredNearFloorFraction: nearFloorFootFrames ? nearFloorWithoutDeclaredContact / nearFloorFootFrames : null,
        patchFrames, patchFrameCoverage: patchFrames / observedFootFrames,
        legacy4cmControllerGatedSpeed: distribution(legacy),
        lowestPatchSpeed: distribution(patch), lowestPatchDeclaredSpeed: distribution(patchDeclared),
        lowestPatchUndeclaredSpeed: distribution(patchUndeclared),
        lowestPatchReleasedBothFramesSpeed: distribution(patchReleasedBothFrames),
        lowestPatchContactTransitionSpeed: distribution(patchContactTransition),
        lowestPatchMaximumPerFrame: distribution(patchFrameMaximum),
        minimumSoleY: Math.min(...soleMinima), maximumReachError: Math.max(...reach),
        maximumDeclaredSpeedMismatch: Math.max(...declaredMismatch),
        finalGait: actor.stats.locomotion.gait,
        ...(transitionDetail ? { transitionFrames: transitionFrames.sort((a, b) => b.patch.horizontalSpeed - a.patch.horizontalSpeed) } : {}) };
      results.push(result);
      console.log(JSON.stringify({ id, direction, declaredPatchP90: result.lowestPatchDeclaredSpeed.p90,
        undeclaredPatchP90: result.lowestPatchUndeclaredSpeed.p90,
        patchCoverage: result.patchFrameCoverage, undeclaredNearFloorFraction: result.undeclaredNearFloorFraction }));
    } finally { actor.dispose(); }
  }
}
const after = fingerprint();
if (!results.length) throw new Error(`No matching case: ${selectedCase}`);
const changedFiles = files.filter(file => before[file] !== after[file]);
const report = { startedAt, finishedAt: new Date().toISOString(),
  evidenceKind: 'independent_CPU_skinned_surface_diagnostic_not_gameplay',
  scope: 'Actual mesh skinning and runtime controller, images removed in memory by CPU loader. Constant flat-ground motion. Not visual acceptance, input, GPU performance or multiplayer proof.',
  interpretation: 'Lowest near-stationary vertical patches distinguish contact candidates from a broad rolling band. Thresholds are diagnostic selection criteria, not acceptance limits. Coverage and undeclared-contact samples are retained; sparse or absent patches never count as a pass.',
  thresholds, selectedCase: selectedCase || null, transitionDetail,
  before, after, changedFiles, sourceStable: !changedFiles.length, results,
  acceptedNoSliding: false };
const output = path.join(root, 'output/qa/arpg-root-review', `${startedAt.replace(/[:.]/g, '-')}-sole-contact.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, sourceStable: report.sourceStable, changedFiles, acceptedNoSliding: false }));
if (changedFiles.length) process.exitCode = 2;
