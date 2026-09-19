// Presentation only: preserve each enemy's projectile, collider and damage.
// Colour ownership (palette.js): whatever table colour the projectile carries, its cast, trail and impact are drawn in
// the hostile threat colour, and every live hostile projectile refreshes its threat marker (shape + motion + reticle).
import { hostileColor } from './palette.js';

const elements = Object.freeze({ visor: 'glacial', caster: 'void', dinzo: 'toxic' });
export function projectileElement(projectile) { return elements[projectile.sourceType]; }

export function emitProjectileCast(vfx, projectile) {
  const family = projectileElement(projectile);
  if (family) vfx?.emit(`${family}Cast`, projectile.mesh.position, {
    direction: projectile.velocity, radius: projectile.radius * 1.2, color: hostileColor(),
  });
}

export function emitProjectileTrail(vfx, projectile) {
  vfx?.trackThreat?.(projectile, projectile.mesh.position, projectile.radius);
  const family = projectileElement(projectile);
  if (family && projectile.previousPosition) vfx?.emitTrail(family,
    projectile.previousPosition, projectile.mesh.position,
    { key: projectile, radius: projectile.radius, color: hostileColor() });
}

// Call only after a confirmed contact, never on expiry or snapshot removal.
export function emitProjectileImpact(vfx, projectile) {
  const family = projectileElement(projectile);
  if (!family) return false;
  return Boolean(vfx?.emit(`${family}Impact`, projectile.mesh.position, {
    direction: projectile.velocity, radius: Math.min(1.5, projectile.impactRadius * .48), color: hostileColor(),
  }));
}
