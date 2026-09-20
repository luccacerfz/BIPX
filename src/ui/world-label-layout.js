const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// Prefer the anchor, then the nearest clear location. A crowded label can wait;
// its pickup model and collection radius remain in the authoritative world.
export function placeWorldLabel(anchor, size, blockers, occupied, viewport, preferred = null) {
  const candidates = [[0, 0]], step = size.height + 8;
  for (let row = 1; row <= 3; row++) candidates.push([0, -step * row], [0, step * row]);
  for (const side of [-1, 1]) candidates.push([side * (size.width * .55 + 12), 0], [side * (size.width * .55 + 12), -step]);
  // Include obstacle edges: a fixed row grid can miss a clear nearby slot.
  for (const other of [...blockers, ...occupied]) candidates.push(
    [0, other.top - anchor.y - size.height / 2 - 4],
    [0, other.bottom - anchor.y + size.height / 2 + 4],
    [other.left - anchor.x - size.width / 2 - 4, 0],
    [other.right - anchor.x + size.width / 2 + 4, 0]);
  candidates.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  if (preferred) candidates.unshift(preferred);
  for (const [dx, dy] of candidates) {
    if (Math.hypot(dx, dy) > 110) continue;
    const rect = { left: anchor.x + dx - size.width / 2, right: anchor.x + dx + size.width / 2,
      top: anchor.y + dy - size.height / 2, bottom: anchor.y + dy + size.height / 2 };
    if (rect.left < 12 || rect.top < 12 || rect.right > viewport.width - 12 || rect.bottom > viewport.height - 12) continue;
    if ([...blockers, ...occupied].some(other => overlaps(rect, other))) continue;
    return { ...rect, x: anchor.x + dx, y: anchor.y + dy };
  }
  return null;
}

/** One material/geometry factory shared by the lazy gameplay line and startup warmup. */
export function createWorldLabelLeaderLine(THREE, renderOrder = 0) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 0xcac0a7, transparent: true, opacity: .6, depthTest: false, depthWrite: false,
  }));
  line.name = 'loot-label-leader';
  line.renderOrder = renderOrder;
  line.frustumCulled = false;
  return line;
}

export function createWorldLabelLayout(THREE) {
  const point = new THREE.Vector3(), right = new THREE.Vector3(), projected = new THREE.Vector3();
  const anchor = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  const stats = { visible: 0, shifted: 0, crowded: 0 };
  const states = new Map();
  function clearMissing(drops) {
    const live = new Set(drops);
    for (const [drop, state] of states) if (!live.has(drop)) {
      state.line?.removeFromParent(); state.line?.geometry.dispose(); state.line?.material.dispose();
      states.delete(drop);
    }
  }
  function hide(drops) {
    clearMissing(drops); stats.visible = stats.shifted = stats.crowded = 0;
    for (const drop of drops) {
      if (drop.labelSprite) drop.labelSprite.visible = false;
      const state = states.get(drop); if (state?.line) state.line.visible = false;
    }
  }
  function project(position, camera, viewport) {
    projected.copy(position).project(camera);
    return { x: (projected.x + 1) * viewport.width / 2, y: (1 - projected.y) * viewport.height / 2, z: projected.z };
  }
  function update({ camera, viewport, actors, drops }) {
    clearMissing(drops);
    stats.visible = stats.shifted = stats.crowded = 0;
    camera.updateMatrixWorld(); right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const blockers = [], occupied = [];
    for (const actor of actors) {
      if (!actor?.position) continue;
      const corners = [];
      for (const y of [.05, actor.height ?? 3.2]) for (const x of [-1, 1]) {
        point.copy(actor.position).addScaledVector(right, x * (actor.radius ?? 1.55)); point.y += y;
        corners.push(project(point, camera, viewport));
      }
      if (corners.every(p => p.z < -1 || p.z > 1)) continue;
      blockers.push({ left: Math.min(...corners.map(p => p.x)) - 10, right: Math.max(...corners.map(p => p.x)) + 10,
        top: Math.min(...corners.map(p => p.y)) - 12, bottom: Math.max(...corners.map(p => p.y)) + 10 });
    }
    const sorted = drops.filter(d => d.labelSprite && d.mesh).sort((a, b) => a.mesh.id - b.mesh.id);
    for (const drop of sorted) {
      const label = drop.labelSprite;
      let state = states.get(drop);
      if (!state) { state = { offset: null, line: null }; states.set(drop, state); }
      // Labels do not inherit the pickup mesh's decorative bob or rarity pulse.
      anchor.copy(drop.mesh.position); anchor.y = (drop.baseY ?? anchor.y) + 1.18;
      const at = project(anchor, camera, viewport);
      const peakPulse = drop.rarity === 'legendary' ? 1.08 : drop.rarity === 'epic' ? 1.035 : 1;
      const width = (label.userData.baseScaleX ?? label.scale.x) * peakPulse;
      const height = (label.userData.baseScaleY ?? label.scale.y) * peakPulse;
      side.copy(anchor).addScaledVector(right, width / 2);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(height / 2).add(anchor);
      const px = project(side, camera, viewport), py = project(up, camera, viewport);
      const size = { width: 2 * Math.hypot(px.x - at.x, px.y - at.y), height: 2 * Math.hypot(py.x - at.x, py.y - at.y) };
      const onScreen = at.z >= -1 && at.z <= 1 && at.x >= 0 && at.x <= viewport.width && at.y >= 0 && at.y <= viewport.height;
      const placed = onScreen ? placeWorldLabel(at, size, blockers, occupied, viewport, state.offset) : null;
      label.userData.worldLabelLayout = { anchor: { ...at }, rect: placed, blockers };
      label.visible = Boolean(placed);
      if (state.line) state.line.visible = false;
      if (!placed) { stats.crowded++; continue; }
      state.offset = [placed.x - at.x, placed.y - at.y];
      occupied.push(placed); stats.visible++;
      if (Math.hypot(placed.x - at.x, placed.y - at.y) > 1) stats.shifted++;
      point.set(placed.x / viewport.width * 2 - 1, 1 - placed.y / viewport.height * 2, at.z).unproject(camera);
      label.position.copy(point);
      if (Math.hypot(...state.offset) > 1 && label.parent) {
        if (!state.line) {
          state.line = createWorldLabelLeaderLine(THREE, label.renderOrder - 1);
          label.parent.add(state.line);
        }
        const item = project(drop.mesh.position, camera, viewport);
        const endX = Math.max(placed.left, Math.min(placed.right, item.x));
        const endY = Math.max(placed.top, Math.min(placed.bottom, item.y));
        point.set(endX / viewport.width * 2 - 1, 1 - endY / viewport.height * 2, at.z).unproject(camera);
        const positions = state.line.geometry.attributes.position;
        positions.setXYZ(0, drop.mesh.position.x, drop.mesh.position.y, drop.mesh.position.z);
        positions.setXYZ(1, point.x, point.y, point.z); positions.needsUpdate = true;
        state.line.visible = true;
      }
    }
    return stats;
  }
  return { update, hide, getStats: () => ({ ...stats }) };
}
