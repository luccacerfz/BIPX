import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THREE, bonesOf } from './hero-locomotion-cpu-support.mjs';
import { loadHeroVisual } from '../src/assets/character-library.js';
import { loadDwarfVisual } from '../src/assets/dwarf-library.js';
import { HERO_SKILL_MOTIONS } from '../src/assets/hero-skill-motion.js';
import { getClassSkill } from '../src/combat/class-skills.mjs';

const legacyIds = ['warrior_flame_cleave','warrior_frost_nova','warrior_thunder_judgment',
  'dwarf_incendiary_burst','dwarf_cryo_grenade','dwarf_arcane_shot'];
const canonicalIds = ['warrior_war_cry','warrior_cleaving_dash','warrior_shield_charge',
  'dwarf_explosive_cannon','dwarf_frost_shot','dwarf_gravity_shot'];
assert.deepEqual(Object.keys(HERO_SKILL_MOTIONS).sort(), [...canonicalIds].sort());
const report = { scope: 'CPU actual rig and cast protocol; no rendering, sole-slip approval or gameplay evidence.', cases: [], checks: {}, legacyRejections: [], provenance: [], hashes: {} };
for (const d of Object.values(HERO_SKILL_MOTIONS)) for (const speed of [0, 6.5, 9.1]) {
  assert.equal(d.duration,getClassSkill(d.skillId).duration,'Cast must follow current Combat duration');
  assert.equal(d.impactAt,getClassSkill(d.skillId).windup,'Cast must follow current Combat emission');
  const parent = new THREE.Group();
  const actor = await (d.characterId === 'warrior' ? loadHeroVisual : loadDwarfVisual)({ THREE, parent, height: d.characterId === 'warrior' ? 2.7 : 2.55 });
  if (speed === 0) for (const skillId of legacyIds) {
    const prior = actor.stats.currentClip;
    assert.equal(actor.cast({skillId,castId:`legacy-${skillId}`}),false,'Legacy IDs must not select a v2 gesture');
    assert.equal(actor.stats.currentClip,prior,'A rejected ID must not start a fallback gesture');
    report.legacyRejections.push({characterId:d.characterId,skillId,rejected:true});
  }
  const bones = Object.values(bonesOf(actor.model));
  const velocity = { x: speed * Math.SQRT1_2, z: -speed * Math.SQRT1_2 };
  const dt = 1/120;
  const step = () => { parent.position.x += velocity.x * dt; parent.position.z += velocity.z * dt; actor.update(dt, { speed, velocity }); parent.updateMatrixWorld(true); };
  for (let i=0;i<120;i++) step();
  const id = `${d.skillId}-${speed}`;
  assert.equal(actor.cast({skillId:d.skillId,castId:id}),true);
  assert.equal(actor.cast({skillId:d.skillId,castId:id}),false);
  assert.equal(actor.cast({skillId:d.characterId==='warrior'?'dwarf_gravity_shot':'warrior_war_cry',castId:'wrong'}),false);
  const clips = new Set(), phases = new Set();
  let finite = true, upperError = 0, maximumReachError = 0, legsMoved = 0, previousFoot = null;
  for(let i=0;i<Math.ceil((d.duration+.25)/dt);i++) {
    if (i === 3) actor.attack(); // A basic auto-attack must not truncate a spell.
    step(); clips.add(actor.stats.currentClip); phases.add(actor.stats.cast.phase);
    for (const bone of bones) finite &&= bone.matrixWorld.elements.every(Number.isFinite);
    upperError = Math.max(upperError,actor.stats.locomotion.upperBodyPoseError || 0);
    for(const c of actor.stats.locomotion.footContacts) maximumReachError=Math.max(maximumReachError,c.reachError);
    const foot = bones.find(b=>b.name.includes('LeftFoot')).quaternion.clone();
    if(previousFoot) legsMoved+=foot.angleTo(previousFoot);
    previousFoot=foot;
  }
  assert(finite); assert(clips.has(d.clip)); assert(phases.has('anticipation') && phases.has('recovery') && phases.has('complete'));
  assert(upperError<1e-5,'Locomotion must not tear the authored torso from the hips/props');
  assert.equal(actor.stats.currentClip,speed ? 'Run' : 'Idle');
  if(speed) assert(legsMoved>.1);
  assert.equal(actor.cast({skillId:d.skillId,castId:'late',elapsed:d.duration+1}),false);
  assert.equal(actor.cast({skillId:d.skillId,castId:'remote',elapsed:d.impactAt+.01}),true);
  assert.equal(actor.stats.cast.phase,'recovery');
  actor.update(dt,{speed,velocity,dead:true});
  assert.equal(actor.stats.currentClip,'Death'); assert.equal(actor.stats.cast.phase,'cancelled');
  assert.equal(actor.cast({skillId:d.skillId,castId:'dead'}),false);
  actor.dispose(); assert.equal(actor.cast({skillId:d.skillId,castId:'disposed'}),false);
  report.cases.push({skillId:d.skillId,speed,finite,clips:[...clips],phases:[...phases],upperError,maximumReachError,legsMoved});
}
for (const characterId of ['warrior','dwarf']) {
  const data=JSON.parse(await fs.readFile(`src/assets/${characterId}-skill-clips.json`,'utf8'));
  assert.deepEqual(data.clips.map(c=>c.skillId).sort(),canonicalIds.filter(id=>id.startsWith(characterId+'_')).sort());
  assert.equal(createHash('sha256').update(await fs.readFile(data.source)).digest('hex'),data.sourceSha256,'Sidecar must refer to the preserved evaluated Mixamo export');
  report.provenance.push({characterId,source:data.source,sourceSha256:data.sourceSha256,clips:data.clips.map(c=>({skillId:c.skillId,sourceClip:c.sourceClip,sourceKnots:c.sourceKnots,tracks:c.clip.tracks.length}))});
}
assert.equal(new Set(report.provenance.find(p=>p.characterId==='warrior').clips.map(c=>c.sourceClip)).size,3,'Warrior uses three distinct evaluated takes');
report.checks = { canonicalIdsOnly:true,legacyIdsRejected:true,preservedMixamoProvenance:true,sixSkills: new Set(report.cases.map(c=>c.skillId)).size===6, allFinite: report.cases.every(c=>c.finite), coherentTorso:report.cases.every(c=>c.upperError<1e-5), runtimeAndRemoteProtocol:true };
for(const file of ['src/assets/hero-skill-motion.js','src/assets/character-library.js','src/assets/dwarf-library.js','src/assets/hero-locomotion.js','src/assets/warrior-skill-clips.json','src/assets/dwarf-skill-clips.json']) report.hashes[file] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
await fs.writeFile(process.env.ANIMATION_SKILL_CPU_OUTPUT || 'output/arpg-animation/skill-v2-cpu.json',JSON.stringify(report,null,2));
console.table(report.cases.map(({skillId,speed,maximumReachError,legsMoved})=>({skillId,speed,maximumReachError,legsMoved})));
console.log(report.checks);
