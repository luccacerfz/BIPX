import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { THREE } from './hero-locomotion-cpu-support.mjs';
import { loadEnemyLibrary } from '../src/assets/enemy-library.js';
import { loadMonsterLibrary } from '../src/assets/monster-library.js';

const sourceFile = process.env.ANIMATION_CUT_SOURCE || 'src/assets/enemy-death-cut.js';
const { createEnemyDeathCut } = await import(pathToFileURL(path.resolve(sourceFile)));
const files = [sourceFile, 'tools/animation-cut-fall-cpu.mjs', 'src/assets/enemy-library.js',
  'src/assets/monster-library.js', 'assets/models/orc-peon-locomotion-v1.glb',
  'assets/models/monsters/zombie.glb', 'assets/models/monsters/brute.glb', 'assets/models/monsters/lich.glb'];
const hashes = async () => Object.fromEntries(await Promise.all(files.map(async f =>
  [f, createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const report = { scope: 'CPU skinned fragment bounds, cap topology and falling motion; actual rigs but no gameplay/render approval.', before: await hashes(), cases: [] };
const orcs = await loadEnemyLibrary({ THREE }), monsters = await loadMonsterLibrary({ THREE });
const bonePose = root => { root.updateWorldMatrix(true, true); const data = []; root.traverse(o => { if (o.isBone) data.push(...o.matrixWorld.elements); }); return data; };

function measure(part) {
  part.pivot.updateWorldMatrix(true, true);
  let minimum = Infinity, sum = 0, count = 0, torsoSum = 0, torsoCount = 0;
  part.pivot.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    const geometry = mesh.geometry, index = geometry.index;
    const groups = geometry.groups.length ? geometry.groups : [{start:0,count:index?.count ?? geometry.attributes.position.count,materialIndex:0}];
    const seen = new Set();
    for (const group of groups) {
      const material = Array.isArray(mesh.material) ? mesh.material[group.materialIndex] : mesh.material;
      const carry = !!material?.userData.deathCarry;
      assert(!(part.sign < 0 && carry), 'Lower fragment must not contain carried arms');
      for (let offset = group.start; offset < group.start+group.count; offset++) {
        const i = index ? index.getX(offset) : offset, key = `${i}:${carry}`;
        if (seen.has(key)) continue; seen.add(key);
        const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        if (mesh !== part.cap && !carry && part.plane.distanceToPoint(p) < -1e-6) continue;
        minimum = Math.min(minimum, p.y); sum += p.y; count++;
        if (!carry && mesh !== part.cap) { torsoSum += p.y; torsoCount++; }
      }
    }
  });
  assert(count > 0);
  return { minimum, meanY: sum/count, torsoMeanY: torsoSum/torsoCount, vertices: count };
}

for (const [id, library] of [['orcPeon', orcs], ['zombie', monsters], ['brute', monsters], ['lich', monsters]]) {
  for (const poseTime of [.23, .57]) for (const heading of [0, 1.1]) {
    const scene = new THREE.Scene(), parent = new THREE.Group(); scene.add(parent);
    const groundY = heading ? .4 : 0;
    parent.position.set(1.7, groundY, -2.3); parent.rotation.y = heading;
    const actor = library.create(id, { parent, height: 2.6 });
    for (let t = 0; t < poseTime; t += 1/120) actor.update(1/120, { speed: 3.7 });
    scene.attach(actor.root);
    const livePose = bonePose(actor.root), originalGeometry = new Set(), originalMaterials = new Set();
    actor.root.traverse(o => { if (o.isMesh) { originalGeometry.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) originalMaterials.add(m); } });
    let originalDisposals = 0;
    for (const geometry of originalGeometry) geometry.addEventListener('dispose', () => originalDisposals++);
    const cut = createEnemyDeathCut({ THREE, source: actor.root, scene, direction: { x: Math.sin(heading), z: -Math.cos(heading) }, groundY, hideSource: false });
    assert(cut); assert(cut.diagnostics.capTriangles > 0, 'Real waist contour needs a cap');
    assert.equal(cut.diagnostics.openContours, 0, `Do not silently promote an open cap contour: ${id}/${poseTime}/${heading} ${JSON.stringify(cut.diagnostics.openPaths)}`);
    let capDisposals = 0; cut.parts[0].cap.geometry.addEventListener('dispose', () => capDisposals++);
    const owned = new Map();
    for (const part of cut.parts) part.root.traverse(mesh => { if (mesh.isMesh && !originalGeometry.has(mesh.geometry)) {
      owned.set(mesh.geometry,0); mesh.geometry.addEventListener('dispose',()=>owned.set(mesh.geometry,owned.get(mesh.geometry)+1));
    } });
    if (id === 'zombie' && poseTime === .57) assert(cut.diagnostics.carriedArmTriangles > 0, 'Reported Walker pose must carry the below-waist hand with the torso');
    let elapsed = 0; const frames = [];
    for (const time of [0, 1/120, .04, .12, .25, .4, .55, .66, .85, 1.1, 1.3, 1.6]) {
      cut.update(time-elapsed); elapsed = time;
      const measured = cut.parts.map(measure);
      for (let i = 0; i < 2; i++) {
        assert(measured[i].minimum >= groundY + .0118, `${id} buried at ${time}: ${measured[i].minimum-groundY}`);
        assert(Math.abs(measured[i].minimum - cut.parts[i].minimumY) < .001, 'Support hull must match visible geometry');
      }
      frames.push({ time, measured, grounded: cut.parts.map(p => p.grounded), angles: cut.parts.map(p => p.angle) });
    }
    const first = frames.find(f => f.time === .12), settled = frames.find(f => f.time === .85);
    assert(settled.grounded.every(Boolean), 'Both halves must reach the floor before fade');
    assert(first.measured[0].torsoMeanY - settled.measured[0].torsoMeanY > .25, JSON.stringify({id,poseTime,heading,first:first.measured[0],settled:settled.measured[0]}));
    const pose = cut.parts.map(p => p.pivot.matrixWorld.elements.slice()); cut.update(0);
    assert.deepEqual(cut.parts.map(p => p.pivot.matrixWorld.elements), pose, 'Paused cut moved');
    assert.deepEqual(bonePose(actor.root), livePose);
    for (const material of originalMaterials) assert.equal(material.clippingPlanes, null);
    cut.dispose(); cut.dispose(); assert.equal(originalDisposals, 0); assert.equal(capDisposals, 1);
    assert([...owned.values()].every(count => count === 1), 'Private cut geometries must dispose exactly once');
    report.cases.push({ id, poseTime, heading, groundY, diagnostics: cut.diagnostics, frames,
      sourcePreserved: true, sourceGeometryPreserved: true, ownedCapDisposedOnce: true, ownedArmGeometriesDisposedOnce: true });
    actor.dispose();
  }
}
report.after = await hashes(); report.sourceStable = JSON.stringify(report.before) === JSON.stringify(report.after);
report.passed = report.sourceStable && report.cases.length === 16;
const out = process.env.ANIMATION_CUT_CPU_OUTPUT || 'output/arpg-animation/death-cut-v3/candidate-cpu.json';
await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out, passed: report.passed, cases: report.cases.length, caps: report.cases.map(c => ({ id:c.id, pose:c.poseTime, ...c.diagnostics })) }));
assert(report.passed);
