import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadCPU, hash} from './brute-motion-review-v6-utils.mjs';
import {makePair, DURATION} from './brute-motion-review-v6-native-scene.mjs';
const base = 'output/brute-motion-v6', out = `${base}/native-preparation`;
fs.mkdirSync(out, {recursive:true});
const manifest = JSON.parse(fs.readFileSync(`${base}/delivery-manifest.json`));
for (const [file, expected] of Object.entries(manifest.files)) assert.equal(hash(fs.readFileSync(file)), expected, file);
const profile = JSON.parse(fs.readFileSync(`${base}/handoff-01/attack-profiles.json`));
const poses = JSON.parse(fs.readFileSync(`${base}/handoff-01/poses.json`));
const probes = JSON.parse(fs.readFileSync(`${base}/source/assets__models__monsters__ground-probes.json`)).brute.vertexIndices;
const result = {at:new Date().toISOString(),scope:'CPU verification of shared browser fixture; no GPU',
  frozenFilesVerified:Object.keys(manifest.files).length,contactAt:profile.contactAt,variants:[]};
const maxError = (a,b) => Math.max(...a.map((p,i) => Math.hypot(...p.map((x,j)=>x-b[i][j]))));
for (const p of profile.variants) {
  assert.equal(hash(fs.readFileSync(p.asset)), p.sha256);
  assert.equal(hash(fs.readFileSync(p.nativeTargetCopy)), p.nativeTargetSHA);
  const pair=makePair({brute:await loadCPU(p.asset),hero:await loadCPU(p.nativeTargetCopy),id:p.id,probes,profile:p});
  const heroes=[];
  for(const expected of poses.heroes[p.id]) {
    const mesh=pair.heroModel.getObjectByName(expected.name);
    const error=maxError(pair.positions(mesh,true),expected.positions);
    assert(error<1e-6, `Hero fixture mismatch ${p.id}/${expected.name}: ${error}`);
    heroes.push({mesh:expected.name,vertices:expected.positions.length,maxError:error});
  }
  const samples=[];
  for(const expected of poses.variants[p.id].poses) {
    pair.seek(expected.time);
    const error=maxError(pair.positions(pair.body),expected.positions);
    assert(error<.001, `Brute fixture mismatch ${p.id}/${expected.time}: ${error}`);
    samples.push({time:expected.time,maxError:error});
  }
  pair.seek(0); for(let i=0;i<87;i++)pair.advance(1/60);
  assert(Math.abs(pair.snapshot().time-DURATION)<1e-10);
  const stepped=pair.positions(pair.body); pair.seek(DURATION);
  assert(maxError(stepped,pair.positions(pair.body))<1e-8);
  result.variants.push({id:p.id,bruteSHA:p.sha256,nativeTargetSHA:p.nativeTargetSHA,
    historicalCpuTargetSHA:p.targetSourceSHA,duration:pair.clip.duration,heroes,samples,terminal:pair.snapshot()});
  pair.dispose();
}
result.passed=true;
fs.writeFileSync(`${out}/cpu-preflight.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
