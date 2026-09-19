import { createCombatVfx } from './combat-vfx.js';
import { createElementalVfx } from './elemental-vfx.js';
import { createClassSkillBodies } from './class-skill-bodies.js';
import { createClassSkillFields } from './class-skill-fields.js';
import { createCannonVfx } from './cannon-vfx.js';

/** Canonical v2 presentation. Combat owns all paths, contacts and status durations.
 * Source-derived pools: Samurai, HandCast, Linear; MIT notices retained alongside.
 */
export const CLASS_SKILL_VFX = Object.freeze({
  warrior_war_cry: Object.freeze({ family: 'buff', radius: 3.5, color: 0xffc467 }),
  warrior_cleaving_dash: Object.freeze({ family: 'steel', radius: 2.2, color: 0xb9e4ff }),
  warrior_shield_charge: Object.freeze({ family: 'metal', radius: 2.2, color: 0xffd994 }),
  dwarf_explosive_cannon: Object.freeze({ family: 'fire', radius: 3.4, color: 0xff872e }),
  dwarf_frost_shot: Object.freeze({ family: 'glacial', radius: 4, color: 0x84e5ff }),
  dwarf_gravity_shot: Object.freeze({ family: 'arcane', radius: 5, color: 0xc27bff }),
});
const QUALITY = Object.freeze({ high: { casts: 64, spacing: .28 }, medium: { casts: 40, spacing: .4 }, low: { casts: 20, spacing: .7 } });
const PHASES = new Set(['cast', 'release', 'travel', 'impact', 'status', 'end']);
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.z) && (p.y == null || Number.isFinite(p.y));
const identifier = id => (typeof id === 'string' && id.length > 0 && id.length <= 160) || (typeof id === 'number' && Number.isFinite(id));
const copy = (to, from) => { to.x = from.x; to.y = finite(from.y, 1.2); to.z = from.z; return to; };
const distance = (a, b) => Math.hypot(a.x - b.x, finite(a.y, 1.2) - finite(b.y, 1.2), a.z - b.z);

export function createClassSkillVfx({ THREE, scene, quality = 'medium', reducedMotion = false, combatVfx, elementalVfx, sweepVisual } = {}) {
  if (!THREE?.Vector3 || !scene?.add) throw new TypeError('createClassSkillVfx requires THREE and scene');
  const ownCombat = !combatVfx, ownElemental = !elementalVfx;
  const combat = combatVfx || createCombatVfx({ THREE, scene, quality, reducedMotion, ambient: false });
  const elemental = elementalVfx || createElementalVfx({ THREE, scene, quality, reducedMotion });
  const cannon = createCannonVfx({THREE,scene,quality,reducedMotion,sweepVisual});
  let transientFire=0;
  const depthState={required:false,gravityFields:0,fireCasts:0};
  const bodies = createClassSkillBodies(THREE, scene, QUALITY.high.casts);
  const fields = createClassSkillFields(THREE, scene, { onEnd(record) {
    if (record.kind === 1) elemental.emit('glacialImpact', record.position, { radius: .6, intensity: .55, groundY: record.position.y + .04 });
    // Gravity collapses inside its authoritative lifetime; no second burst on expiry.
  } });
  let level = Object.hasOwn(QUALITY, quality) ? quality : 'medium', reduced = Boolean(reducedMotion);
  let clock = 0, disposed = false, rejected = 0, duplicates = 0, overwritten = 0, pathDistance = 0, samples = 0;
  const events = Object.fromEntries(Object.keys(CLASS_SKILL_VFX).map(id => [id, { cast: 0, release: 0, travel: 0, impact: 0, status: 0, end: 0 }]));
  const records = Array.from({ length: QUALITY.high.casts }, (_, index) => ({
    index, id: null, skillId: '', expiry: 0, cast: false, released: false, terminal: false,
    bodyUntil: 0, debt: 0, travel: false, last: new THREE.Vector3(), trailKey: {}, contactCount: 0,
    contacts: Array.from({ length: 16 }, () => ({ id: null, point: new THREE.Vector3() })),
  }));
  const point = new THREE.Vector3(), end = new THREE.Vector3(), heading = new THREE.Vector3();
  let latest = null;
  function clear(record) {
    if(record.skillId==='dwarf_explosive_cannon'&&record.id!==null)cannon.cancel(record.id);
    bodies.hide(record.index); fields.endMotion(record.index); record.bodyUntil = 0; record.terminal = false; record.released = false;
    record.id = null; record.skillId = ''; record.expiry = 0; record.cast = false;
    record.debt = 0; record.travel = false; record.contactCount = 0; record.trailKey = {};
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
      found = oldest; if (found.id !== null && found.expiry > clock) overwritten++;
      clear(found); found.id = id; found.skillId = skillId;
    }
    found.expiry = clock + 8; return found;
  }
  function contactSeen(record, at, contactId) {
    if (!record) return false;
    const hasId = identifier(contactId);
    for (let i = 0; i < Math.min(record.contactCount, record.contacts.length); i++) {
      const item = record.contacts[i];
      if (hasId ? item.id === contactId : item.id === null && distance(item.point, at) < .001) return true;
    }
    const item = record.contacts[record.contactCount++ % record.contacts.length];
    item.id = hasId ? contactId : null; copy(item.point, at); return false;
  }
  function aim(payload) {
    heading.set(finite(payload.direction?.x, 0), finite(payload.direction?.y, 0), finite(payload.direction?.z, 1));
    if (heading.lengthSq() < 1e-8) heading.set(0, 0, 1); heading.normalize();
  }
  function emitter(payload) {
    copy(point, payload.emitter ?? payload.origin);
    // Root-position fallback only; integration should supply the actual hand/muzzle.
    if (!payload.emitter && point.y < .4) point.y += 1.15;
    return point;
  }
  function fireEvent(payload,override={}) {
    const normalized={...payload,...override,castId:identifier(payload.castId)?payload.castId:`fire-transient-${++transientFire}`};
    for(const key of ['origin','target','emitter','direction'])if(normalized[key])normalized[key]={x:normalized[key].x,y:finite(normalized[key].y,key==='direction'?0:1.2),z:normalized[key].z};
    return cannon.emit(normalized);
  }
  function release(spec, payload, record) {
    if (record?.released) return false;
    if (record) record.released = true;
    const at = emitter(payload); aim(payload);
    const opts = { color: spec.color, direction: heading, groundY: finite(payload.groundY,.04), radius: finite(payload.radius,spec.radius), intensity: reduced ? .4 : .75 };
    switch (spec.family) {
      case 'buff':
        combat.emit('shockwave', payload.origin, opts);
        combat.emit('impact', at, { ...opts, intensity: .3 });
        combat.emit('seal', payload.origin, { ...opts, radius: 1.4, life: .7 }); break;
      case 'steel': combat.emit('slash', at, { ...opts, radius: Math.min(opts.radius,1.05), tilt: .13 }); break;
      case 'metal':
        combat.emit('muzzle', at, { ...opts, intensity: .45 });
        combat.emit('dust', payload.origin, { ...opts, intensity: .5 }); break;
      case 'fire':
        fireEvent(payload,{phase:'release',radius:opts.radius,groundY:opts.groundY}); break;
      case 'glacial': elemental.emit('glacialCast', at, { ...opts, radius: .85 }); break;
      case 'arcane': elemental.emit('arcaneCast', at, { ...opts, radius: .8 }); break;
    }
    events[payload.skillId].release++; return true;
  }
  function travel(spec, payload, record) {
    const from = payload.origin, to = payload.target, span = distance(from, to);
    if (record.terminal) { duplicates++; return false; }
    if (payload.release === true) release(spec, payload, record);
    if (payload.terminal === true) { bodies.hide(record.index); fields.endMotion(record.index); record.bodyUntil = 0; record.terminal = true; }
    const projectile = payload.skillId.startsWith('dwarf_');
    if(spec.family==='fire'){
      fireEvent(payload);
      if(span<=8&&(!record.travel||distance(record.last,from)<=.12))pathDistance+=span;
      copy(record.last,to);record.travel=true;return true;
    }
    if (projectile && !record.terminal) {
      heading.set(to.x - from.x, finite(to.y,1.2) - finite(from.y,1.2), to.z - from.z);
      bodies.set(record.index, to, heading, spec.family); record.bodyUntil = clock + .3;
    }
    if(!projectile&&!record.terminal){
      aim(payload);copy(point,payload.emitter??to);
      if(spec.family==='metal'){copy(point,to);point.y=finite(payload.groundY,.04);}
      else if(!payload.emitter)point.y+=.95;
      fields.setMotion(record.index,spec.family==='metal'?6:7,point,heading,Math.min(finite(payload.radius,1.05),1.05));
    }
    if (span < 1e-6) return projectile || payload.release === true || payload.terminal === true;
    if (span > 8 || (record.travel && distance(record.last, from) > .12)) {
      record.debt = 0; record.trailKey = {}; record.travel = true; copy(record.last,to);
      return projectile; // Show the actual endpoint, never bridge a teleport.
    }
    copy(record.last,to); record.travel = true; pathDistance += span;
    if (projectile && reduced) return true;
    if (spec.family === 'glacial' || spec.family === 'arcane') {
      elemental.emitTrail(spec.family,from,to,{key:record.trailKey,radius:spec.family === 'arcane' ? 1 : .8,color:spec.color}); return true;
    }
    if(spec.family==='steel'){
      copy(point,from);copy(end,to);point.y+=.92;end.y+=.92;
      elemental.emitTrail('arcane',point,end,{key:record.trailKey,radius:.24,color:0x9dd4e7});
    }
    const spacing = spec.family === 'fire' ? QUALITY[level].spacing : spec.family==='steel' ? reduced?3.2:level==='low'?2.8:2.2 : reduced ? 1.8 : level === 'low' ? 1.25 : .85;
    for (let advance=spacing-record.debt;advance<=span+1e-7;advance+=spacing) {
      const t=clamp(advance/span,0,1);
      point.set(from.x+(to.x-from.x)*t,finite(from.y,1.2)+(finite(to.y,1.2)-finite(from.y,1.2))*t,from.z+(to.z-from.z)*t);
      if(spec.family==='fire') {copy(end,point);end.y+=.025;combat.emitTrail(point,end,'fire',{color:spec.color});samples++;}
      else if(spec.family==='steel') {point.y=Math.max(.95,point.y);combat.emit('slash',point,{direction:payload.direction,radius:Math.min(finite(payload.radius,1.05),1.05),color:spec.color,intensity:.2,tilt:.12});}
      else if(spec.family==='metal') combat.emit('dust',point,{intensity:.35,color:0xbab1a0});
    }
    const total=record.debt+span;record.debt=Math.max(0,total-Math.floor((total+1e-7)/spacing)*spacing);return true;
  }
  function emit(payload = {}) {
    const {skillId,phase,origin,target,direction,castId,contactId}=payload??{};
    if(disposed||!Object.hasOwn(CLASS_SKILL_VFX,skillId)||!PHASES.has(phase)
      ||(phase!=='impact'&&phase!=='end'&&phase!=='status'&&!valid(origin))||((phase==='travel'||phase==='impact')&&!valid(target))
      ||(direction!=null&&!valid(direction))||(origin!=null&&!valid(origin))||(target!=null&&!valid(target))
      ||(payload.emitter!=null&&!valid(payload.emitter))||(phase==='travel'&&!identifier(castId))) {rejected++;return false;}
    const spec=CLASS_SKILL_VFX[skillId],record=getRecord(castId,skillId);
    if(phase==='status'||(phase==='end'&&payload.status)){
      const handled=fields.event(payload);if(handled)events[skillId][phase]++;else rejected++;return handled;
    }
    if((phase==='cast'&&record?.cast)||(phase==='impact'&&contactSeen(record,target,contactId))||(phase==='release'&&record?.released)){duplicates++;return false;}
    if(phase==='end'){if(spec.family==='fire')fireEvent(payload);if(record){record.terminal=true;record.bodyUntil=0;bodies.hide(record.index);fields.endMotion(record.index);}events[skillId].end++;return true;}
    if(phase==='release')return release(spec,payload,record);
    if(phase==='travel'){const wrote=travel(spec,payload,record);if(wrote)events[skillId].travel++;return wrote;}
    const radius=clamp(finite(payload.radius,spec.radius),.12,18),groundY=finite(payload.groundY,.04);
    aim(payload);const opts={color:spec.color,radius,groundY,direction:heading,intensity:reduced?.4:.75};
    const at=phase==='cast'?emitter(payload):target;
    if(phase==='cast') {
      if(record)record.cast=true;
      switch(spec.family){
        case 'fire': fireEvent(payload,{radius,groundY});break;
        case 'glacial':elemental.emit('glacialCast',at,{...opts,radius:.45});break;
        case 'arcane':elemental.emit('arcaneCast',at,{...opts,radius:.5});break;
        case 'buff':combat.emit('seal',origin,{...opts,radius:.6,life:.45});break;
        default:combat.emit('seal',at,{...opts,radius:.72,life:finite(payload.impactAt,.4),intensity:.25});break;
      }
    }else{
      if(record&&skillId.startsWith('dwarf_')){record.terminal=true;record.bodyUntil=0;bodies.hide(record.index);}
      switch(spec.family){
        case 'buff':combat.emit('shockwave',at,opts);break;
        case 'steel':combat.emit('slash',at,{...opts,radius:Math.min(radius,1.05),tilt:.15});combat.emit('impact',at,{...opts,intensity:.4});break;
        case 'metal':combat.emit('impact',at,{...opts,intensity:.9});combat.emit('shockwave',at,{...opts,radius:Math.min(radius,1.8)});break;
        case 'fire': fireEvent(payload,{radius,groundY});break;
        case 'glacial':elemental.emit('glacialNova',at,opts);elemental.emit('glacialImpact',at,{...opts,radius:1.2});break;
        case 'arcane':elemental.emit('arcaneImpact',at,{...opts,radius:1.3});break;
      }
    }
    events[skillId][phase]++;latest={skillId,phase,castId:identifier(castId)?castId:null,position:{x:at.x,y:finite(at.y,1.2),z:at.z},radius,groundY};return true;
  }
  function update(dt){if(disposed)return;const step=clamp(finite(dt,0),0,.15);clock+=step;
    for(const record of records){if(record.id!==null&&record.expiry<=clock)clear(record);if(record.bodyUntil>0&&record.bodyUntil<=clock){bodies.hide(record.index);record.bodyUntil=0;}}
    fields.update(step,reduced,level);bodies.update(clock,reduced);cannon.update(step);if(ownCombat)combat.update(step);if(ownElemental)elemental.update(step);
  }
  function reset(){if(disposed)return;clock=0;latest=null;for(const record of records)clear(record);bodies.reset();fields.reset();cannon.reset();Object.assign(depthState,{required:false,gravityFields:0,fireCasts:0});if(ownCombat)combat.reset();if(ownElemental)elemental.reset();}
  function setQuality(value){if(disposed)return;cannon.setQuality(value);level=Object.hasOwn(QUALITY,value)?value:'medium';for(let i=QUALITY[level].casts;i<records.length;i++)clear(records[i]);if(ownCombat)combat.setQuality(level);if(ownElemental)elemental.setQuality(level);}
  function setReducedMotion(value){if(disposed)return;reduced=Boolean(value);cannon.setReducedMotion(reduced);if(ownCombat)combat.setReducedMotion(reduced);if(ownElemental)elemental.setReducedMotion(reduced);}
  function prepareSceneDepth(camera){
    const gravity=fields.prepareSceneDepth(camera);cannon.setGravityComposition(fields.getCompositionDescriptors());const fire=cannon.prepareSceneDepth(camera);
    Object.assign(depthState,{required:gravity.required||fire.required,gravityFields:gravity.visibleFields,fireCasts:fire.visibleFields});
    return {required:depthState.required,visibleFields:gravity.visibleFields+fire.visibleFields,gravityFields:gravity.visibleFields,fireCasts:fire.visibleFields,excludeRoots:[...new Set([...gravity.excludeRoots,...fire.excludeRoots])]};
  }
  function setSceneDepth(frame){const gravity=fields.setSceneDepth(frame),fire=cannon.setSceneDepth(frame);return gravity||fire;}
  function getStats(){const fire=cannon.getStats(),legacyBodies=bodies.getStats(),fireBodies=fire.casts.filter(c=>c.body).length;return {version:2,disposed,quality:level,reducedMotion:reduced,time:clock,rejected,duplicates,overwritten,
    activeCasts:records.filter(r=>r.id!==null&&r.expiry>clock).length,capacity:QUALITY[level].casts,allocatedCastSlots:records.length,contactSlotsPerCast:16,pathDistance,fireTrailSamples:samples,
    events:Object.fromEntries(Object.entries(events).map(([id,phases])=>[id,{...phases}])),latest:latest?{...latest,position:{...latest.position}}:null,
    borrowedPools:{combat:!ownCombat,elemental:!ownElemental},bodies:{...legacyBodies,active:legacyBodies.active+fireBodies,drawCalls:legacyBodies.drawCalls+fireBodies,cannonBodies:fireBodies},cannon:fire,sceneDepth:{...depthState},states:fields.getStats(),combat:combat.getStats(),elemental:elemental.getStats()};}
  function dispose(){if(disposed)return;reset();bodies.dispose();fields.dispose();cannon.dispose();if(ownCombat)combat.dispose();if(ownElemental)elemental.dispose();disposed=true;}
  return {emit,update,reset,dispose,getStats,setQuality,setReducedMotion,prepareSceneDepth,setSceneDepth,syncState:state=>{if(!disposed)fields.syncState(state);}};
}
