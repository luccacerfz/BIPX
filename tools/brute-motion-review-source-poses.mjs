// Source-rig triage only: no retarget, clip edits, IK, pinned legs or renderer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {GLTFLoader} from '../src/assets/vendor/GLTFLoader.js';
globalThis.ProgressEvent ??= class ProgressEvent extends Event {};
const base = 'output/brute-motion-v4/source-triage-v1';
const library = '/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/anims/mixamo';
const names = ['mutant punch', 'mutant swipe', 'zombie attack 2', 'Zombie Attack', 'zombie biting'];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const v = () => new THREE.Vector3();
const canonical = n => n.replace(/^mixamorig[:_]?/i, '');
const reports = [];
for (const name of names) {
  const file = path.join(library, name + '.glb'), bytes = fs.readFileSync(file), before = hash(bytes);
  const source = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const nodes = new Map(); source.scene.traverse(n => {if (/^mixamorig/i.test(n.name)) nodes.set(canonical(n.name), n);});
  source.scene.updateMatrixWorld(true);
  const joints = () => Object.fromEntries([...nodes].map(([name, node]) => [name, node.getWorldPosition(v()).toArray()]));
  const rest = joints(); assert(rest.Hips && rest.Head && rest.LeftFoot && rest.RightFoot);
  const vec = (p, n) => v().fromArray(p[n]);
  const legLength = vec(rest, 'LeftUpLeg').distanceTo(vec(rest, 'LeftLeg')) + vec(rest, 'LeftLeg').distanceTo(vec(rest, 'LeftFoot'));
  const restFloor = Math.min(rest.LeftToeBase[1], rest.RightToeBase[1], rest.LeftFoot[1], rest.RightFoot[1]);
  const restHeight = rest.Head[1] - restFloor;
  const forward = vec(rest, 'LeftToeBase').sub(vec(rest, 'LeftFoot')).add(vec(rest, 'RightToeBase').sub(vec(rest, 'RightFoot'))); forward.y = 0; forward.normalize();
  const right = v().set(0, 1, 0).cross(forward).normalize();
  const anchor = v().set(rest.Hips[0], restFloor, rest.Hips[2]);
  const normalize = p => {const a = v().fromArray(p).sub(anchor); return [a.dot(right) / restHeight, a.y / restHeight, a.dot(forward) / restHeight];};
  const edges = [...nodes].filter(([, node]) => nodes.has(canonical(node.parent?.name || ''))).map(([name, node]) => [canonical(node.parent.name), name]);
  const clip = source.animations[0], mixer = new THREE.AnimationMixer(source.scene);
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
  function sample(time) {
    action.reset().play(); mixer.setTime(time); source.scene.updateMatrixWorld(true);
    const p = joints(), hip = vec(p, 'Hips'), head = vec(p, 'Head');
    const knee = side => {
      const a = vec(p, side + 'UpLeg').sub(vec(p, side + 'Leg'));
      const b = vec(p, side + 'Foot').sub(vec(p, side + 'Leg'));
      return a.angleTo(b) * 180 / Math.PI;
    };
    const reach = side => vec(p, side + 'Hand').sub(hip).dot(forward) / legLength;
    return {time, phase: time / clip.duration, joints: Object.fromEntries(Object.entries(p).map(([n, point]) => [n, normalize(point)])),
      hipHeightOverLeg: (hip.y - restFloor) / legLength, torsoLeanDegrees: head.sub(hip).angleTo(v().set(0, 1, 0)) * 180 / Math.PI,
      knees: [knee('Left'), knee('Right')], handForwardOverLeg: [reach('Left'), reach('Right')]};
  }
  const frames = Array.from({length: Math.ceil(clip.duration * 30) + 1}, (_, i, arr) => i);
  // Explicit endpoint sampling; resets prevent LoopOnce clamp from contaminating seeks.
  const timeline = frames.map((_, i) => sample(i / (frames.length - 1) * clip.duration));
  const poses = Array.from({length: 11}, (_, i) => sample(i / 10 * clip.duration));
  const maximum = side => timeline.reduce((a, b) => b.handForwardOverLeg[side] > a.handForwardOverLeg[side] ? b : a);
  const report = {name, path: file, sha256: before, duration: clip.duration, tracks: clip.tracks.length,
    label: 'CPU SOURCE RIG poses, no donor mesh, no Brute retarget, not native playback',
    restHeight, legLength, forwardConvention: forward.toArray(), rest: Object.fromEntries(Object.entries(rest).map(([n, p]) => [n, normalize(p)])),
    edges, poses, timeline,
    minHipOverLeg: Math.min(...timeline.map(f => f.hipHeightOverLeg)), maxHipOverLeg: Math.max(...timeline.map(f => f.hipHeightOverLeg)),
    maxTorsoLeanDegrees: Math.max(...timeline.map(f => f.torsoLeanDegrees)), minKneeDegrees: Math.min(...timeline.flatMap(f => f.knees)),
    reachCandidates: ['Left', 'Right'].map((side, i) => ({side, time: maximum(i).time, phase: maximum(i).phase, reachOverLeg: maximum(i).handForwardOverLeg[i], meaning: 'Geometric peak only; no verified contact/target'})),
    selected: false, sourcePreserved: hash(fs.readFileSync(file)) === before};
  assert(report.sourcePreserved);
  reports.push(report);
}
fs.writeFileSync(`${base}/source-poses.json`, JSON.stringify({scope: 'Source triage and rejected-source controls; no shortlist approval', reports}, null, 2) + '\n');
console.log(JSON.stringify(reports.map(({name, duration, minHipOverLeg, maxHipOverLeg, maxTorsoLeanDegrees, minKneeDegrees, reachCandidates}) => ({name, duration, minHipOverLeg, maxHipOverLeg, maxTorsoLeanDegrees, minKneeDegrees, reachCandidates})), null, 2));
