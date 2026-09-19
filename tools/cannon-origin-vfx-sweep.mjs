// Controlled fixture implementation of Combat's accepted optional callback.
// No damage or event emission. Runtime wiring remains owned by Combat.
import { sweepStatic } from '../src/physics/contacts.mjs';
import { segmentCircleContact } from '../src/combat/projectile-sweep.mjs';

export function createFixtureVisualSweep(world, getMonsters = () => []) {
  return (from, to, radius, context) => {
    if (![from.x, from.y, from.z, to.x, to.y, to.z, radius, context.authorityY].every(Number.isFinite))
      throw new TypeError('Visual sweep requires finite coordinates/radius/authorityY');
    let first = Infinity;
    for (const [a, b] of [[from, to], [{ ...from, y: context.authorityY }, { ...to, y: context.authorityY }]]) {
      const hit = sweepStatic(world, a, b, radius, { kind: 'projectile' });
      if (hit) first = Math.min(first, hit.t);
    }
    for (const monster of getMonsters()) {
      if (monster.dead || !(monster.health > 0) || monster.ally || monster.eligible === false) continue;
      const center = monster.mesh?.position ?? monster.position ?? monster;
      if (![center.x, center.z, monster.radius].every(Number.isFinite) || monster.radius < 0) throw new TypeError('Invalid eligible monster collider');
      first = Math.min(first, segmentCircleContact(from, to, center, radius + monster.radius));
    }
    return Number.isFinite(first) ? { t: first } : null;
  };
}
