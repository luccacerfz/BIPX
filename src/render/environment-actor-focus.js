// A small independent budget keeps party visibility stable in a dense horde.
export const ENVIRONMENT_ACTOR_LIMIT = 4;
export function createEnvironmentActorFocus(THREE) {
  const projected = new THREE.Vector3();
  const slots = Array.from({ length: ENVIRONMENT_ACTOR_LIMIT }, () => ({ id: null, x: 0, y: 0, z: 0, strength: 0 }));
  return {
    slots,
    update(actors, position, camera, dt, playing) {
      if (!playing) { for (const s of slots) { s.id = null; s.strength = 0; } return slots; }
      camera.updateMatrixWorld();
      const eligible = [];
      for (const actor of actors) {
        const p = actor.mesh?.position;
        if (!p || actor.mesh.visible === false || actor.state !== 'playing' || !(actor.health > 0) ||
            ![p.x, p.y, p.z].every(Number.isFinite)) continue;
        const distance = (p.x - position.x) ** 2 + (p.z - position.z) ** 2;
        if (distance > 26 ** 2) continue;
        projected.set(p.x, p.y + 1.2, p.z).project(camera);
        // Small edge margin covers a body/weapon intersecting the viewport.
        if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.08 || Math.abs(projected.y) > 1.12) continue;
        eligible.push({ id: actor.id, p, distance });
      }
      eligible.sort((a, b) => a.distance - b.distance || String(a.id).localeCompare(String(b.id)));
      const selected = eligible.slice(0, ENVIRONMENT_ACTOR_LIMIT);
      const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), .1) / .18;
      for (const s of slots) {
        const actor = selected.find(a => a.id === s.id);
        if (actor) {
          // Follow the rendered root directly, including a fast authoritative dash.
          s.x = actor.p.x; s.y = actor.p.y + 1.2; s.z = actor.p.z;
          s.strength = Math.min(1, s.strength + step);
        } else {
          s.strength = Math.max(0, s.strength - step);
          if (s.strength === 0) s.id = null;
        }
      }
      for (const actor of selected) {
        if (slots.some(s => s.id === actor.id)) continue;
        const s = slots.find(s => s.id === null);
        if (!s) break; // Let an old opening close before reusing its slot elsewhere.
        Object.assign(s, { id: actor.id, x: actor.p.x, y: actor.p.y + 1.2, z: actor.p.z, strength: Math.min(1, step) });
      }
      return slots;
    },
  };
}
