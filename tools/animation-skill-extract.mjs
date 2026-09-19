import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { THREE } from './hero-locomotion-cpu-support.mjs';
import { loadGlb } from '../src/assets/load-glb.js';
import { HERO_SKILL_MOTIONS } from '../src/assets/hero-skill-motion.js';

// Source seconds -> presentation seconds. Select the actual local Mixamo
// battle cry, first cleave, shield block and rifle release; retain body/props.
const recipes = {
  warrior_war_cry: ['CastWarCry', [[0, 0], [18/30, .38], [48/30, .60], [71/30, .85]]],
  warrior_cleaving_dash: ['CastDash', [[0, 0], [17/30, .22], [24/30, .50], [31/30, .78]]],
  warrior_shield_charge: ['CastShieldCharge', [[0, 0], [9/30, .28], [17/30, 1.10]]],
};
for (const [id, file] of [['warrior', 'aldric'], ['dwarf', 'lyra']]) {
  const url = new URL(`../output/arpg-animation/export-v2/${file}-skills.glb`, import.meta.url);
  const { animations } = await loadGlb(url);
  const clips = [];
  for (const d of Object.values(HERO_SKILL_MOTIONS).filter(d => d.characterId === id)) {
    const rifle = d.characterId === 'dwarf';
    const [sourceName, knots] = rifle ? [({dwarf_explosive_cannon:'CastCannon',dwarf_frost_shot:'CastFrostShot',dwarf_gravity_shot:'CastGravity'})[d.skillId], [[0, d.impactAt], [8/30, d.duration]]] : recipes[d.skillId];
    const source = animations.find(c => c.name === sourceName);
    const mapTime = t => {
      const i = Math.max(0, Math.min(knots.length - 2, knots.findIndex(k => k[0] >= t) - 1));
      const a = knots[i], b = knots[i + 1];
      return a[1] + (t - a[0]) / (b[0] - a[0]) * (b[1] - a[1]);
    };
    const start = knots[0][0], end = Math.min(source.duration, knots.at(-1)[0]);
    const tracks = source.tracks.map(track => {
      const times = [...new Set([start, end, ...Array.from(track.times).filter(t => t > start && t < end), ...knots.map(k => k[0]).filter(t => t > start && t < end)])].sort((a,b) => a-b);
      const interpolant = track.createInterpolant();
      const values = times.flatMap(t => Array.from(interpolant.evaluate(t)));
      const outputTimes = times.map(mapTime);
      if (rifle) { outputTimes.unshift(0); values.unshift(...values.slice(0, track.getValueSize())); }
      const result = new track.constructor(track.name, outputTimes, values, track.getInterpolation());
      return result;
    });
    const clip = THREE.AnimationClip.toJSON(new THREE.AnimationClip(d.clip, d.duration, tracks));
    clip.uuid = `bipx-${d.clip}-v1`;
    clips.push({ skillId: d.skillId, sourceClip: sourceName, sourceKnots: knots, clip });
  }
  const document = { source: `output/arpg-animation/export-v2/${file}-skills.glb`, sourceSha256: createHash('sha256').update(await fs.readFile(url)).digest('hex'), method: 'Evaluated source body and props sampled together; complete transform tracks, selected single gestures, piecewise retiming to Combat release windows. Rifle skills add a held aim preparation.', clips };
  await fs.writeFile(`src/assets/${id}-skill-clips.json`, JSON.stringify(document));
  console.log(id, clips.map(c => ({skillId:c.skillId,duration:c.clip.duration,tracks:c.clip.tracks.length})));
}
