import { createProjectileOriginBridge } from './projectile-origin-bridge.js';

// Keep the cannon contract while sharing bounded visual launch convergence.
export function createCannonOriginBridge(options) {
  return createProjectileOriginBridge({ ...options, skillId: 'dwarf_explosive_cannon', projectileRadius: .32 });
}
