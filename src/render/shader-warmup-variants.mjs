/** Return the actual application and shadow materials owned by one source mesh. */
export function getShaderWarmupMaterialSources(object) {
  if (!object) return [];
  const sources = [];
  if (object.material) sources.push({ role: 'color', material: object.material });
  if (object.customDepthMaterial) sources.push({ role: 'shadow-depth', material: object.customDepthMaterial });
  if (object.customDistanceMaterial) sources.push({ role: 'shadow-distance', material: object.customDistanceMaterial });
  return sources;
}
