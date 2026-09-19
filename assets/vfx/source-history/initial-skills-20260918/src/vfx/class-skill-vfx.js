import { createCombatVfx } from './combat-vfx.js';
import { createElementalVfx } from './elemental-vfx.js';
import { createClassSkillBodies } from './class-skill-bodies.js';

/** Presentation adapter only. Simulation owns hit/contact, projectile paths and timing.
 * Reuses Samurai / HandCast / Linear pools; retained licenses live beside this file.
 */
export const CLASS_SKILL_VFX = Object.freeze({
  warrior_flame_cleave: Object.freeze({ family: 'fire', radius: 5, color: 0xffaf55 }),
  warrior_frost_nova: Object.freeze({ family: 'glacial', radius: 5.6, color: 0x78dfff }),
  warrior_thunder_judgment: Object.freeze({ family: 'lightning', radius: 2.8, color: 0xaecbff }),
  dwarf_incendiary_burst: Object.freeze({ family: 'fire', radius: 2.3, color: 0xff963d }),
  dwarf_cryo_grenade: Object.freeze({ family: 'glacial', radius: 4, color: 0x84e5ff }),
  dwarf_arcane_shot: Object.freeze({ family: 'arcane', radius: .85, color: 0xca83ff }),
});
const QUALITY = Object.freeze({ high: { casts: 64, spacing: .28 }, medium: { casts: 40, spacing: .4 }, low: { casts: 20, spacing: .7 } });
const PHASES = new Set(['cast', 'travel', 'impact']);
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && (p.y == null || Number.isFinite(p.y));
const identifier = id => (typeof id === 'string' && id.length > 0 && id.length <= 160) || (typeof id === 'number' && Number.isFinite(id));
const copy = (to, from) => { to.x = from.x; to.y = finite(from.y, 1.2); to.z = from.z; return to; };
const distance = (a, b) => Math.hypot(a.x - b.x, finite(a.y, 1.2) - finite(b.y, 1.2), a.z - b.z);

export function createClassSkillVfx({ THREE, scene, quality = 'medium', reducedMotion = false, combatVfx, elementalVfx } = {}) {
  if (!THREE?.Vector3 || !scene?.add) throw new TypeError('createClassSkillVfx requires THREE and scene');
  const ownCombat = !combatVfx, ownElemental = !elementalVfx;
  const combat = combatVfx || createCombatVfx({ THREE, scene, quality, reducedMotion, ambient: false });
  const elemental = elementalVfx || createElementalVfx({ THREE, scene, quality, reducedMotion });
  const bodies = createClassSkillBodies(THREE, scene, QUALITY.high.casts);
  let level = Object.hasOwn(QUALITY, quality) ? quality : 'medium', reduced = Boolean(reducedMotion);
  let clock = 0, disposed = false, rejected = 0, duplicates = 0, overwritten = 0, pathDistance = 0, samples = 0;
  const events = Object.fromEntries(Object.keys(CLASS_SKILL_VFX).map(id => [id, { cast: 0, travel: 0, impact: 0 }]));
  // Fixed records and contact slots; arbitrary network IDs never grow a Map.
  const records = Array.from({ length: QUALITY.high.casts }, (_, index) => ({
    index, bodyUntil: 0, terminal: false, released: false,
    id: null, skillId: '', expiry: 0, cast: false, debt: 0, travel: false,
    last: new THREE.Vector3(), trailKey: {}, contactCount: 0,
    contacts: Array.from({ length: 16 }, () => ({ id: null, point: new THREE.Vector3() })),
  }));
  const point = new THREE.Vector3(), start = new THREE.Vector3(), end = new THREE.Vector3(), heading = new THREE.Vector3();
  let latest = null;

  function clear(record) {
    bodies.hide(record.index); record.bodyUntil = 0; record.terminal = false; record.released = false;
    record.id = null; record.skillId = ''; record.expiry = 0; record.cast = false;
    record.debt = 0; record.travel = false; record.contactCount = 0;
    record.trailKey = {}; // Old WeakMap cadence is collectable when a slot is reused.
    for (const contact of record.contacts) contact.id = null;
  }
  function getRecord(id, skillId) {
    if (!identifier(id)) return null;
    let found = null, oldest = records[0];
    for (let i = 0; i < QUALITY[level].casts; i++) {
      const item = records[i];
      if (item.id === id && item.skillId === skillId && item.expiry > clock) { found = item; break; }
      if (item.expiry < oldest.expiry) oldest = item;
    }
    if (!found) {
      found = oldest;
      if (found.id !== null && found.expiry > clock) overwritten++;
      clear(found); found.id = id; found.skillId = skillId;
    }
    found.expiry = clock + 8;
    return found;
  }
  function contactSeen(record, at, contactId) {
    if (!record) return false;
    const hasId = identifier(contactId);
    for (let i = 0; i < Math.min(record.contactCount, record.contacts.length); i++) {
      const item = record.contacts[i];
      if (hasId ? item.id === contactId : item.id === null && distance(item.point, at) < .001) return true;
    }
    const item = record.contacts[record.contactCount++ % record.contacts.length];
    item.id = hasId ? contactId : null; copy(item.point, at);
    return false;
  }

  function travel(spec, payload, record) {
    const from = payload.origin, to = payload.target, span = distance(from, to);
    if (record.terminal) { duplicates++; return false; }
    if (payload.release === true && payload.skillId === 'warrior_flame_cleave') {
      if (record.released) { duplicates++; return false; }
      record.released = true; record.terminal = true;
      heading.set(finite(payload.direction?.x, to.x - from.x), 0, finite(payload.direction?.z, to.z - from.z)).normalize();
      copy(point, from); point.y = Math.max(.65, point.y);
      const radius = clamp(finite(payload.radius, 5), .12, 18);
      combat.emit('slash', point, { direction: heading, radius, color: 0xff802d, intensity: .55, tilt: .06 });
      // Flames sample the executed blade arc; they are not target contacts.
      const yaw = Math.atan2(heading.z, heading.x), n = reduced ? 3 : level === 'low' ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const angle = yaw - .9 + i / Math.max(n - 1, 1) * 1.8;
        end.set(from.x + Math.cos(angle) * radius * .65, point.y, from.z + Math.sin(angle) * radius * .65);
        elemental.emit('flameCast', end, { radius: reduced ? .38 : .58, intensity: .75 });
      }
      return true;
    }
    if (!payload.skillId.startsWith('dwarf_')) return false;
    if (payload.terminal === true) { bodies.hide(record.index); record.bodyUntil = 0; record.terminal = true; }
    else {
      heading.set(to.x-from.x, finite(to.y,1.2)-finite(from.y,1.2), to.z-from.z);
      bodies.set(record.index, to, heading, spec.family); record.bodyUntil = clock + .3;
    }
    if (span < 1e-6) return false;
    if (span > 8 || (record.travel && distance(record.last, from) > .12)) {
      record.debt = 0; record.trailKey = {}; record.travel = true; copy(record.last, to);
      return false; // Teleports/late snapshot gaps must not paint fictitious travel.
    }
    copy(record.last, to); record.travel = true; pathDistance += span;
    // Body uses real endpoint even when decorative trails are disabled.
    if (reduced) return true;
    if (spec.family === 'glacial' || spec.family === 'arcane') {
      elemental.emitTrail(spec.family, from, to, { key: record.trailKey, radius: spec.family === 'arcane' ? 1 : .7, color: spec.color });
      return true;
    }
    if (spec.family !== 'fire') return false;
    const spacing = QUALITY[level].spacing;
    let wrote = false;
    for (let advance = spacing - record.debt; advance <= span + 1e-7; advance += spacing) {
      const t = clamp(advance / span, 0, 1);
      point.set(from.x + (to.x - from.x) * t, finite(from.y, 1.2) + (finite(to.y, 1.2) - finite(from.y, 1.2)) * t, from.z + (to.z - from.z) * t);
      copy(end, point); end.y += .025;
      combat.emitTrail(point, end, 'fire', { color: spec.color }); samples++; wrote = true;
    }
    const total = record.debt + span;
    record.debt = Math.max(0, total - Math.floor((total + 1e-7) / spacing) * spacing);
    return wrote || !record.terminal;
  }

  function emit(payload = {}) {
    const { skillId, phase, origin, target, direction, castId, contactId } = payload ?? {};
    const spec = CLASS_SKILL_VFX[skillId];
    if (disposed || !Object.hasOwn(CLASS_SKILL_VFX, skillId) || !PHASES.has(phase)
      || (phase !== 'impact' && !valid(origin)) || (phase !== 'cast' && !valid(target))
      || (direction != null && !valid(direction)) || (origin != null && !valid(origin))
      || (target != null && !valid(target)) || (phase === 'travel' && !identifier(castId))) {
      rejected++; return false;
    }
    const record = getRecord(castId, skillId);
    if (phase === 'impact' && record && (skillId === 'dwarf_incendiary_burst' || skillId === 'dwarf_cryo_grenade')) {
      bodies.hide(record.index); record.bodyUntil = 0; record.terminal = true;
    }
    if ((phase === 'cast' && record?.cast) || (phase === 'impact' && contactSeen(record, target, contactId))) {
      duplicates++; return false;
    }
    if (phase === 'travel') {
      const wrote = travel(spec, payload, record);
      if (wrote) events[skillId].travel++;
      return wrote;
    }
    const radius = clamp(finite(payload.radius, spec.radius), .12, 18);
    const groundY = finite(payload.groundY, .075);
    const options = { color: spec.color, radius, groundY, intensity: reduced ? .35 : .65 };
    heading.set(finite(direction?.x, 0), finite(direction?.y, 0), finite(direction?.z, 1));
    if (heading.lengthSq() < 1e-8) heading.set(0, 0, 1);
    heading.normalize(); options.direction = heading;
    const at = phase === 'cast' ? origin : target;
    if (phase === 'cast') {
      if (record) record.cast = true;
      switch (spec.family) {
        case 'fire':
          combat.emit('fire', at, { ...options, radius: .45, intensity: .3 });
          elemental.emit('flameCast', at, { ...options, radius: .52, intensity: .8 });
          if (skillId === 'dwarf_incendiary_burst') combat.emit('muzzle', at, { ...options, intensity: .35 });
          break;
        case 'glacial': elemental.emit('glacialCast', at, { ...options, radius: .48 }); break;
        case 'arcane': elemental.emit('arcaneCast', at, { ...options, radius: .6 }); break;
        case 'lightning':
          // Preparation remains on the weapon; the target is struck only on impact.
          copy(end, at); end.addScaledVector(heading, .65);
          combat.emit('lightning', at, { ...options, target: end, intensity: .3 });
          break;
      }
    } else {
      switch (skillId) {
        case 'warrior_flame_cleave':
          // Contact-local crescent avoids replaying a five-metre sweep for every victim.
          combat.emit('slash', at, { ...options, radius: Math.min(radius, 1.6), tilt: .12 });
          elemental.emit('flameImpact', at, { ...options, radius: 1.6, intensity: .95 });
          combat.emit('fire', at, { ...options, radius: 1.2, intensity: .55 });
          combat.emit('impact', at, { ...options, intensity: .35 });
          break;
        case 'warrior_frost_nova':
          elemental.emit('glacialNova', at, options);
          elemental.emit('glacialImpact', at, { ...options, radius: .7 });
          break;
        case 'warrior_thunder_judgment':
          copy(end, at); copy(start, at); start.y += reduced ? 2 : 5.5;
          combat.emit('lightning', start, { ...options, target: end, intensity: reduced ? .8 : 1.6 });
          if (valid(origin) && distance(origin, at) > .15) combat.emit('lightning', origin, { ...options, target: end, intensity: .35 });
          combat.emit('shockwave', at, { ...options, intensity: .2 });
          combat.emit('impact', at, { ...options, intensity: .45 });
          break;
        case 'dwarf_incendiary_burst':
          elemental.emit('flameImpact', at, { ...options, radius: 1.55, intensity: .95 });
          combat.emit('fire', at, { ...options, intensity: .85 });
          combat.emit('shockwave', at, { ...options, intensity: .3 });
          combat.emit('impact', at, { ...options, intensity: .45 });
          break;
        case 'dwarf_cryo_grenade':
          elemental.emit('glacialNova', at, options);
          elemental.emit('glacialImpact', at, { ...options, radius: 1.25 });
          break;
        case 'dwarf_arcane_shot':
          elemental.emit('arcaneImpact', at, { ...options, radius: Math.min(radius, 1.05) });
          combat.emit('impact', at, { ...options, intensity: .18 });
          break;
      }
    }
    events[skillId][phase]++;
    latest = { skillId, phase, castId: identifier(castId) ? castId : null,
      position: { x: at.x, y: finite(at.y, 1.2), z: at.z }, radius, groundY };
    return true;
  }
  function update(dt) {
    if (disposed) return;
    const step = clamp(finite(dt, 0), 0, .15); clock += step;
    for (const record of records) if (record.id !== null && record.expiry <= clock) clear(record);
    for (const record of records) if (record.bodyUntil > 0 && record.bodyUntil <= clock) { bodies.hide(record.index); record.bodyUntil = 0; }
    bodies.update(clock, reduced);
    if (ownCombat) combat.update(step);
    if (ownElemental) elemental.update(step);
  }
  function reset() {
    if (disposed) return;
    clock = 0; latest = null; for (const record of records) clear(record);
    bodies.reset();
    if (ownCombat) combat.reset();
    if (ownElemental) elemental.reset();
  }
  function setQuality(value) {
    if (disposed) return;
    level = Object.hasOwn(QUALITY, value) ? value : 'medium';
    for (let i = QUALITY[level].casts; i < records.length; i++) clear(records[i]);
    if (ownCombat) combat.setQuality(level);
    if (ownElemental) elemental.setQuality(level);
  }
  function setReducedMotion(value) {
    if (disposed) return;
    reduced = Boolean(value); reset();
    if (ownCombat) combat.setReducedMotion(reduced);
    if (ownElemental) elemental.setReducedMotion(reduced);
  }
  function getStats() {
    return { disposed, quality: level, reducedMotion: reduced, time: clock, rejected, duplicates, overwritten,
      activeCasts: records.filter(r => r.id !== null && r.expiry > clock).length,
      capacity: QUALITY[level].casts, allocatedCastSlots: records.length, contactSlotsPerCast: 16,
      pathDistance, fireTrailSamples: samples,
      events: Object.fromEntries(Object.entries(events).map(([id, phases]) => [id, { ...phases }])),
      latest: latest ? { ...latest, position: { ...latest.position } } : null,
      borrowedPools: { combat: !ownCombat, elemental: !ownElemental },
      bodies: bodies.getStats(),
      combat: combat.getStats(), elemental: elemental.getStats() };
  }
  function dispose() {
    if (disposed) return;
    reset(); bodies.dispose(); if (ownCombat) combat.dispose(); if (ownElemental) elemental.dispose(); disposed = true;
  }
  return { emit, update, reset, dispose, getStats, setQuality, setReducedMotion };
}
