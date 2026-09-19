// Crowd displacement is separate from explicit skill forces; never mutate actor masses.
import { separateActors } from '../physics/contacts.mjs';
const controlled = body => body.freezeTimer > 0 || body.stunTimer > 0;

export function separateControlledActors(world, bodies, dt, options = {}) {
  let copies = bodies.map(body => ({ ...body }));
  const recoveryBodies = copies.filter(body => controlled(body) || body.inverseMass === 0)
    .map(body => ({ ...body, inverseMass: controlled(body) ? 1 : 0 }));
  const budget = .2 * Math.min(.1, Number.isFinite(dt) ? Math.max(0, dt) : 0);
  let recoveryTrace = [];
  if (recoveryBodies.length > 1 && budget >= .001) {
    const result = separateActors(world, recoveryBodies, { iterations: 2, maxTotalCorrection: budget,
      blockers: copies.filter(body => !controlled(body) && body.inverseMass !== 0), trace: options.trace });
    const byId = new Map(result.bodies.map(body => [body.id, body]));
    copies = copies.map(body => byId.has(body.id) ? { ...body, x: byId.get(body.id).x, z: byId.get(body.id).z } : body);
    if (options.trace) recoveryTrace = result.trace;
  }
  const result = separateActors(world, copies.map(body => ({ ...body, inverseMass: controlled(body) ? 0 : body.inverseMass ?? 1 })),
    { iterations: 2, maxTotalCorrection: .2, trace: options.trace });
  if (options.trace) result.trace = recoveryTrace.concat(result.trace);
  return result;
}
