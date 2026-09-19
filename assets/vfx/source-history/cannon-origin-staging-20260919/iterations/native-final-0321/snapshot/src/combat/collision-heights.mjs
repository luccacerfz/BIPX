// Gameplay heights are shared; muzzle transforms and cosmetic bob do not change cover.
export const RIFLE_COLLISION_HEIGHT = .85;
export function enemyProjectileCollisionHeight(type) {
  if (type === 'gitcity') return 1.45;
  if (type === 'angelSheep') return 1.4;
  return 1.05;
}
