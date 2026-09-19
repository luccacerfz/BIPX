import { createCombatVfx } from './combat-vfx.js';
import { createElementalVfx } from './elemental-vfx.js';
import { createClassSkillBodies } from './class-skill-bodies.js';
import { createClassSkillFields } from './class-skill-fields.js';
import { createCannonVfx } from './cannon-vfx.js';
import { createWarCryVfx } from './warcry-vfx.js';
import { createProjectileOriginBridge } from './projectile-origin-bridge.js';
import { createDashVfx } from './dash-vfx.js';

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
  const warcry = createWarCryVfx({THREE,scene,quality,reducedMotion});
  const dash = createDashVfx({THREE,scene,quality,reducedMotion});
  let transientFire=0;
  let snapshotEpoch = null, snapshotSequence = -1, snapshotServerTime = Number.NEGATIVE_INFINITY;
  const depthState={required:false,gravityFields:0,fireCasts:0,warcryActors:0};
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
    bridge: null, snapshotOnly: false, snapshotUntil: 0, bodyUntil: 0, debt: 0, travel: false, last: new THREE.Vector3(), trailKey: {}, contactCount: 0,
    contacts: Array.from({ length: 16 }, () => ({ id: null, point: new THREE.Vector3() })),
  }));
  const point = new THREE.Vector3(), end = new THREE.Vector3(), heading = new THREE.Vector3();
  let latest = null;
  function clear(record) {
    record.bridge?.reset(); record.bridge = null;
    record.snapshotOnly = false; record.snapshotUntil = 0;
    if(record.skillId==='warrior_cleaving_dash'&&record.id!==null)dash.cancel(record.id);
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
      if (skillId === 'dwarf_frost_shot' || skillId === 'dwarf_gravity_shot') {
        found.bridge = createProjectileOriginBridge({ THREE, sweepVisual, skillId,
          projectileRadius: skillId === 'dwarf_frost_shot' ? .25 : .3, clampMuzzleLead: true });
      }
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
    record?.bridge?.release(payload);
    const at = emitter(payload); aim(payload);
    if (record?.bridge && !record.bridge.launchBlocked) {
      const bridge = record.bridge.getStats();
      const origin = bridge.enabled ? at : payload.origin;
      // With the muzzle lead clamped, the projectile is still inside the barrel at release: drawing it at the mouth
      // would put it beyond a point-blank contact that the authority has not reported yet.
      if (bridge.enabled && bridge.forward > 0) { bodies.hide(record.index); record.bodyUntil = 0; }
      else { bodies.set(record.index, origin, heading, spec.family); record.bodyUntil = clock + .3; }
    }
    const opts = { color: spec.color, direction: heading, groundY: finite(payload.groundY,.04), radius: finite(payload.radius,spec.radius), intensity: reduced ? .4 : .75 };
    switch (spec.family) {
      case 'buff':
        warcry.emit(payload); break;
      case 'steel': dash.emit(payload); break;
      case 'metal':
        combat.emit('muzzle', at, { ...opts, intensity: .45 });
        combat.emit('dust', payload.origin, { ...opts, intensity: .5 }); break;
      case 'fire':
        fireEvent(payload,{phase:'release',radius:opts.radius,groundY:opts.groundY}); break;
      case 'glacial': if (!record?.bridge?.launchBlocked) elemental.emit('glacialCast', at, { ...opts, radius: .85 }); break;
      case 'arcane': if (!record?.bridge?.launchBlocked) elemental.emit('arcaneCast', at, { ...opts, radius: .8 }); break;
    }
    events[payload.skillId].release++; return true;
  }
  function travel(spec, payload, record) {
    const from = payload.origin, to = payload.target, span = distance(from, to);
    if (record.terminal) { duplicates++; return false; }
    if (payload.release === true) release(spec, payload, record);
    if (payload.terminal === true) { bodies.hide(record.index); fields.endMotion(record.index); record.bodyUntil = 0; record.terminal = true; }
    const projectile = payload.skillId.startsWith('dwarf_');
    if(spec.family==='steel'){
      const wrote=dash.emit(payload);
      if(span<=8&&(!record.travel||distance(record.last,from)<=.12))pathDistance+=span;
      copy(record.last,to);record.travel=true;return wrote;
    }
    if(spec.family==='fire'){
      fireEvent(payload);
      if(span<=8&&(!record.travel||distance(record.last,from)<=.12))pathDistance+=span;
      copy(record.last,to);record.travel=true;return true;
    }
    const discontinuous = span > 8 || (record.travel && distance(record.last, from) > .12);
    let visualFrom = from, visualTo = to, resetTrail = false, hideBody = false;
    if (record.bridge) {
      if (discontinuous) {
        record.bridge.reset(); visualFrom = to; resetTrail = true;
      } else {
        const mapped = record.bridge.travel(payload);
        visualFrom = mapped.origin; visualTo = mapped.target; resetTrail = mapped.resetTrail; hideBody = mapped.hideBody === true;
      }
      if (resetTrail) { record.debt = 0; record.trailKey = {}; bodies.hide(record.index); record.bodyUntil = 0; }
      // Inside the barrel nothing is drawn: hide any instance explicitly and keep it from lingering.
      if (hideBody) { bodies.hide(record.index); record.bodyUntil = 0; }
    }
    if (projectile && !record.terminal && !resetTrail && !hideBody) {
      heading.set(visualTo.x - visualFrom.x, finite(visualTo.y,1.2) - finite(visualFrom.y,1.2), visualTo.z - visualFrom.z);
      if (heading.lengthSq() < 1e-8) aim(payload);
      bodies.set(record.index, visualTo, heading, spec.family); record.bodyUntil = clock + .3;
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
    if (projectile && (reduced || resetTrail || hideBody)) return true; // no trail inside the barrel either
    if (spec.family === 'glacial' || spec.family === 'arcane') {
      elemental.emitTrail(spec.family,visualFrom,visualTo,{key:record.trailKey,radius:spec.family === 'arcane' ? 1 : .8,color:spec.color}); return true;
    }
    const spacing = spec.family === 'fire' ? QUALITY[level].spacing : reduced ? 1.8 : level === 'low' ? 1.25 : .85;
    for (let advance=spacing-record.debt;advance<=span+1e-7;advance+=spacing) {
      const t=clamp(advance/span,0,1);
      point.set(from.x+(to.x-from.x)*t,finite(from.y,1.2)+(finite(to.y,1.2)-finite(from.y,1.2))*t,from.z+(to.z-from.z)*t);
      if(spec.family==='fire') {copy(end,point);end.y+=.025;combat.emitTrail(point,end,'fire',{color:spec.color});samples++;}
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
      const handled=spec.family==='buff'?warcry.emit(payload):fields.event(payload);if(handled)events[skillId][phase]++;else rejected++;return handled;
    }
    if((phase==='cast'&&record?.cast)||(phase==='impact'&&contactSeen(record,target,contactId))||(phase==='release'&&record?.released)){duplicates++;return false;}
    if(phase==='end'){if(spec.family==='steel')dash.emit(payload);if(spec.family==='buff')warcry.emit(payload);if(spec.family==='fire')fireEvent(payload);if(record){record.terminal=true;record.bodyUntil=0;bodies.hide(record.index);fields.endMotion(record.index);}events[skillId].end++;return true;}
    if(phase==='release')return release(spec,payload,record);
    if(phase==='travel'){record.snapshotOnly=false;record.snapshotUntil=0;const wrote=travel(spec,payload,record);if(wrote)events[skillId].travel++;return wrote;}
    const radius=clamp(finite(payload.radius,spec.radius),.12,18),groundY=finite(payload.groundY,.04);
    aim(payload);const opts={color:spec.color,radius,groundY,direction:heading,intensity:reduced?.4:.75};
    const at=phase==='cast'?emitter(payload):target;
    if(phase==='cast') {
      if(record)record.cast=true;
      record?.bridge?.prepare(payload);
      switch(spec.family){
        case 'fire': fireEvent(payload,{radius,groundY});break;
        case 'glacial':if(!record?.bridge?.launchBlocked)elemental.emit('glacialCast',at,{...opts,radius:.45});break;
        case 'arcane':if(!record?.bridge?.launchBlocked)elemental.emit('arcaneCast',at,{...opts,radius:.5});break;
        case 'buff':warcry.emit(payload);break;
        case 'steel':dash.emit(payload);break;
        default:combat.emit('seal',at,{...opts,radius:.72,life:finite(payload.impactAt,.4),intensity:.25});break;
      }
    }else{
      if(record&&skillId.startsWith('dwarf_')){record.terminal=true;record.bodyUntil=0;bodies.hide(record.index);}
      switch(spec.family){
        case 'buff':break; // Authoritative cry uses release/status only.
        case 'steel':dash.emit(payload);break;
        case 'metal':combat.emit('impact',at,{...opts,intensity:.9});combat.emit('shockwave',at,{...opts,radius:Math.min(radius,1.8)});break;
        case 'fire': fireEvent(payload,{radius,groundY});break;
        case 'glacial':elemental.emit('glacialNova',at,opts);elemental.emit('glacialImpact',at,{...opts,radius:1.2});break;
        case 'arcane':elemental.emit('arcaneImpact',at,{...opts,radius:1.3});break;
      }
    }
    events[skillId][phase]++;latest={skillId,phase,castId:identifier(castId)?castId:null,position:{x:at.x,y:finite(at.y,1.2),z:at.z},radius,groundY};return true;
  }
  // Restore only the current body: no replayed cast, release, impact, audio or trail.
  function syncProjectiles({ epoch, sequence, serverTime, ageMs = 0, owners = [] } = {}) {
    if (disposed || typeof epoch !== 'string' || !Number.isFinite(serverTime)) return false;
    if (snapshotEpoch !== epoch) {
      if (snapshotEpoch !== null) for (const record of records) if (record.skillId.startsWith('dwarf_')) clear(record);
      snapshotEpoch = epoch; snapshotSequence = -1; snapshotServerTime = Number.NEGATIVE_INFINITY;
    }
    if (serverTime <= snapshotServerTime) return false;
    snapshotServerTime = serverTime;
    if (Number.isInteger(sequence) && sequence > snapshotSequence) snapshotSequence = sequence;
    const active = new Set(), age = Math.max(0, finite(ageMs, Infinity)) / 1000;
    for (const owner of Array.isArray(owners) ? owners.slice(0, 4) : []) {
      for (const cast of Array.isArray(owner.skills?.active) ? owner.skills.active.slice(0, 3) : []) {
        const spec = CLASS_SKILL_VFX[cast.skillId];
        if (!spec || !cast.skillId.startsWith('dwarf_') || !identifier(cast.castId) || !cast.released || cast.done
          || !valid(cast.position) || !valid(cast.direction) || !Number.isFinite(cast.elapsed)
          || !Number.isFinite(cast.impactAt) || !Number.isFinite(cast.travelDuration)) continue;
        const remaining = cast.impactAt + cast.travelDuration - cast.elapsed - age;
        if (!(remaining > 0)) continue;
        active.add(cast.castId);
        const existing = records.find(r => r.id === cast.castId && r.skillId === cast.skillId && r.expiry > clock);
        if (existing?.terminal || (existing?.travel && !existing.snapshotOnly)) continue;
        const record = existing || getRecord(cast.castId, cast.skillId);
        const until = clock + Math.min(remaining, 2);
        record.released = true; record.snapshotOnly = true;
        record.snapshotUntil = record.snapshotUntil > clock ? Math.min(record.snapshotUntil, until) : until;
        record.bridge?.reset(); record.debt = 0; record.trailKey = {}; record.travel = false;
        travel(spec, { skillId: cast.skillId, castId: cast.castId, phase: 'travel', origin: cast.position,
          target: cast.position, direction: cast.direction, radius: cast.radius, groundY: .04 }, record);
        record.bodyUntil = record.snapshotUntil;
      }
    }
    for (const record of records) if (record.snapshotOnly && !record.terminal && !active.has(record.id)) retireSnapshot(record);
    return true;
  }
  function retireSnapshot(record) {
    if (record.skillId === 'dwarf_explosive_cannon') cannon.cancel(record.id);
    bodies.hide(record.index); record.terminal = true; record.bodyUntil = 0; record.snapshotUntil = 0;
  }
  function update(dt){if(disposed)return;const step=clamp(finite(dt,0),0,.15);clock+=step;
    for(const record of records){if(record.snapshotOnly&&record.snapshotUntil>0&&record.snapshotUntil<=clock)retireSnapshot(record);if(record.id!==null&&record.expiry<=clock)clear(record);if(record.bodyUntil>0&&record.bodyUntil<=clock){bodies.hide(record.index);record.bodyUntil=0;}}
    fields.update(step,reduced,level);bodies.update(clock,reduced);cannon.update(step);warcry.update(step);dash.update(step);if(ownCombat)combat.update(step);if(ownElemental)elemental.update(step);
  }
  function reset(){if(disposed)return;clock=0;latest=null;snapshotEpoch=null;snapshotSequence=-1;snapshotServerTime=Number.NEGATIVE_INFINITY;for(const record of records)clear(record);bodies.reset();fields.reset();cannon.reset();warcry.reset();dash.reset();Object.assign(depthState,{required:false,gravityFields:0,fireCasts:0,warcryActors:0});if(ownCombat)combat.reset();if(ownElemental)elemental.reset();}
  function setQuality(value){if(disposed)return;cannon.setQuality(value);warcry.setQuality(value);dash.setQuality(value);level=Object.hasOwn(QUALITY,value)?value:'medium';for(let i=QUALITY[level].casts;i<records.length;i++)clear(records[i]);if(ownCombat)combat.setQuality(level);if(ownElemental)elemental.setQuality(level);}
  function setReducedMotion(value){if(disposed)return;reduced=Boolean(value);cannon.setReducedMotion(reduced);warcry.setReducedMotion(reduced);dash.setReducedMotion(reduced);if(ownCombat)combat.setReducedMotion(reduced);if(ownElemental)elemental.setReducedMotion(reduced);}
  function prepareSceneDepth(camera){
    const gravity=fields.prepareSceneDepth(camera);cannon.setGravityComposition(fields.getCompositionDescriptors());
    const fire=cannon.prepareSceneDepth(camera),cry=warcry.prepareSceneDepth(camera);
    Object.assign(depthState,{required:gravity.required||fire.required||cry.required,gravityFields:gravity.visibleFields,fireCasts:fire.visibleFields,warcryActors:cry.visibleFields});
    return {...depthState,visibleFields:gravity.visibleFields+fire.visibleFields+cry.visibleFields,excludeRoots:[...new Set([...gravity.excludeRoots,...fire.excludeRoots,...cry.excludeRoots])]};
  }
  function setSceneDepth(frame){const gravity=fields.setSceneDepth(frame),fire=cannon.setSceneDepth(frame),cry=warcry.setSceneDepth(frame);return gravity||fire||cry;}
  function getStats(){const cry=warcry.getStats(),state=fields.getStats(),fire=cannon.getStats(),legacyBodies=bodies.getStats(),fireBodies=fire.casts.filter(c=>c.body).length;return {version:2,disposed,quality:level,reducedMotion:reduced,time:clock,rejected,duplicates,overwritten,
    activeCasts:records.filter(r=>r.id!==null&&r.expiry>clock).length,capacity:QUALITY[level].casts,allocatedCastSlots:records.length,contactSlotsPerCast:16,pathDistance,fireTrailSamples:samples,
    events:Object.fromEntries(Object.entries(events).map(([id,phases])=>[id,{...phases}])),latest:latest?{...latest,position:{...latest.position}}:null,
    launchBridges:records.filter(r=>r.bridge).map(r=>({castId:r.id,skillId:r.skillId,terminal:r.terminal,bodyUntil:r.bodyUntil,...r.bridge.getStats()})),
    borrowedPools:{combat:!ownCombat,elemental:!ownElemental},bodies:{...legacyBodies,active:legacyBodies.active+fireBodies,drawCalls:legacyBodies.drawCalls+fireBodies,cannonBodies:fireBodies},cannon:fire,warcry:cry,dash:dash.getStats(),sceneDepth:{...depthState},states:{...state,buffs:cry.buffs,drawCalls:state.drawCalls+cry.drawCalls},combat:combat.getStats(),elemental:elemental.getStats()};}
  function dispose(){if(disposed)return;reset();bodies.dispose();fields.dispose();cannon.dispose();warcry.dispose();dash.dispose();if(ownCombat)combat.dispose();if(ownElemental)elemental.dispose();disposed=true;}
  return {emit,update,syncProjectiles,updateDashTransform:(id,transform)=>!disposed&&dash.updateDashTransform(id,transform),updateCastTransform:(id,transform)=>!disposed&&warcry.updateCastTransform(id,transform),reset,dispose,getStats,setQuality,setReducedMotion,prepareSceneDepth,setSceneDepth,syncState:(state={})=>{if(!disposed){fields.syncState({...state,buffs:[]});warcry.syncState(state.buffs??[]);}}};
}
