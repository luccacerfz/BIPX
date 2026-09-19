// Read-only analysis of Combat's source-bound native proofs. No new GPU run.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const [networkDirectory,physicsDirectory,output]=process.argv.slice(2);
assert(networkDirectory&&physicsDirectory&&output,'Pass network dir, physics dir, output JSON');
const read=file=>JSON.parse(fs.readFileSync(file));
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const currentHash=digest('src/assets/hero-locomotion.js');
assert.equal(currentHash,'07952bfc2e36dfed257a9f6f27dd582981c89a8dd2c791a92c1c1724be65f2b5');
const networkFile=path.join(networkDirectory,'arpg-network.json'),physicsFile=path.join(physicsDirectory,'physics-gameplay.json');
const network=read(networkFile),physics=read(physicsFile);
assert(network.passed&&network.sourceStable&&physics.passed);
const telemetryFiles=[...['warrior','dwarf','late'].map(c=>path.join(networkDirectory,`arpg-network-${c}.json`)),
  ...['warrior','dwarf'].map(c=>path.join(physicsDirectory,`physics-${c}.json`))];
const hashes=new Map(),sourceProof=[];
for(const file of telemetryFiles) {
  const data=read(file);assert.equal(data.sourceChangedDuringRun,false);
  assert.equal(data.sourceHashes['src/assets/hero-locomotion.js'],currentHash);
  const differences=[];
  for(const [source,expected] of Object.entries(data.sourceHashes)) {
    if(!hashes.has(source))hashes.set(source,digest(source));
    if(hashes.get(source)!==expected)differences.push(source);
  }
  assert.deepEqual(differences,[],`Current sources differ from ${file}`);
  sourceProof.push({file,sha256:digest(file),sourceCount:Object.keys(data.sourceHashes).length,sourceStable:true,currentSourcesMatch:true});
}
const motion=network.motion.map(item=>{
  const character=network.casts.find(c=>c.id===item.mover)?.skillId.split('_')[0];
  const samples=item.samples;
  assert(samples.length>100);
  const feet=samples.flatMap((sample,index)=>(sample.locomotion?.footContacts||[]).map(foot=>({index,sample,foot})));
  const worst=feet.reduce((a,b)=>b.foot.reachError>a.foot.reachError?b:a);
  const moving=samples.filter(s=>s.motion.speed>.5);
  for(const s of samples){assert.equal(s.motion.x,s.position[0]);assert.equal(s.motion.z,s.position[2]);assert(s.position.every(Number.isFinite));}
  assert(moving.length>0&&samples.at(-1).motion.speed<.2);
  return {character,actorId:item.mover,sampleCount:samples.length,movingSamples:moving.length,
    gaits:[...new Set(samples.map(s=>s.locomotion.gait))],maximumSpeed:Math.max(...samples.map(s=>s.motion.speed)),
    finalSpeed:samples.at(-1).motion.speed,samplerPositionMatches:true,
    maximumReach:{sampleIndex:worst.index,value:worst.foot.reachError,gait:worst.sample.locomotion.gait,
      speed:worst.sample.motion.speed,foot:worst.foot.foot,declaredContact:worst.foot.contact,locked:worst.foot.locked,
      soleProbeY:worst.foot.surfaceY,position:worst.sample.position},
  };
});
const wall=physics.results.map(row=>{
  assert(row.passed&&!row.sourceChanged);
  const hold=row.phases.find(p=>p.phase==='wall-hold'),slide=row.phases.find(p=>p.phase==='tangential-slide');
  const tail=hold.samples.slice(-6);
  assert(tail.length===6&&tail.every(s=>s.hero.locomotion.gait==='Idle'&&Math.abs(s.state.player.z+8.27)<.04));
  const a=slide.before.state.player,b=slide.after.state.player;
  assert(b.x-a.x>.5&&Math.abs(b.z-a.z)<.04);
  return {character:row.character,wallTailSamples:tail.length,gaitAtBlockedHold:'Idle',
    position:tail.at(-1).state.player,slideDelta:{x:b.x-a.x,z:b.z-a.z},slideGait:slide.after.hero.locomotion.gait,
    blockedSkillPhases:row.phases.filter(p=>['dash-against-wall','shield-against-wall'].includes(p.phase)).map(p=>p.phase)};
});
const result={analysedAt:new Date().toISOString(),controllerHash:currentHash,scope:'Analysis by Animation of Combat real browser/keyboard proofs; no duplicated capture',
  integrationPassed:true,acceptedNoSliding:false,AAAApproved:false,
  artifacts:[networkFile,physicsFile].map(file=>({file,sha256:digest(file)})),sourceProof,
  remote:motion,postCollision:wall,canonicalRemoteCasts:network.casts.map(c=>c.skillId),
  limits:['Remote startup/turn/gait transitions have material reach error; not attributed to the release correction without a paired df93 trace.',
    'Contact fields are controller skin-witness diagnostics, not the independent whole-sole audit.',
    'Blocked hold and tangent slide were offline; remote interpolation was tested in a separate two-client strafe/stop sequence.',
    'Still images are partial/occluded, not continuous close-up video review. No physical mobile or no-slide approval.']};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,integrationPassed:result.integrationPassed,sourceRecords:sourceProof.length,
  remote:motion.map(({character,sampleCount,maximumReach})=>({character,sampleCount,maximumReach})),postCollision:wall,acceptedNoSliding:false}));
