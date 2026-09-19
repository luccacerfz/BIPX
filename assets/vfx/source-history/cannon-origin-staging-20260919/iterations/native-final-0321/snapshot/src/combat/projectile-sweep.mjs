/** First contact on a finite XZ segment against a circular gameplay collider. */
export function segmentCircleContact(from, to, center, radius) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const ox = from.x - center.x, oz = from.z - center.z;
  const offset = ox * ox + oz * oz - radius * radius;
  if (offset <= 0) return 0;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < 1e-12) return Infinity;
  const approach = ox * dx + oz * dz;
  if (approach >= 0) return Infinity;
  const discriminant = approach * approach - lengthSquared * offset;
  if (discriminant < 0) return Infinity;
  const contact = (-approach - Math.sqrt(discriminant)) / lengthSquared;
  return contact >= 0 && contact <= 1 ? contact : Infinity;
}
