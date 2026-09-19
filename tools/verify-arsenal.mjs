// Arsenal ("Relíquias" + automatic weapons) verification. CPU only, no browser/GPU:
//  A. production shared rules (src/combat/arsenal.mjs) on production physics,
//  B. server-owned progression (src/progression/authority.mjs),
//  C. real WebSocket protocol against an isolated copy of the production server (tools/quality-protocol.mjs).
// Fixtures are declared where they are used. Visual evidence is a separate browser run (tools/arsenal-evidence.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as R from '../src/combat/arsenal.mjs';
import * as A from '../src/progression/authority.mjs';
import { createCollisionWorld, sweepStatic, findFreePosition } from '../src/physics/contacts.mjs';
import { getEnvironmentColliders, ENVIRONMENT_GROUND } from '../src/render/environment-layout.js';
import { launchProtocolServer, connectProtocolClient, startProtocolRun, protocolMessage, closeProtocolClient, delay } from './quality-protocol.mjs';

const outDir = path.resolve(process.env.BIPX_ARSENAL_EVIDENCE_DIR || 'output/qa/arsenal');
const checks = [], measurements = { relics: {}, autoWeapons: {} };
const sources = Object.fromEntries(['src/combat/arsenal.mjs', 'src/progression/authority.mjs', 'server.mjs'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
function check(name, fn) { const details = fn(); checks.push({ name, ...(details && typeof details === 'object' ? { details } : {}) }); console.log(`ok  ${name}`); }
async function checkAsync(name, fn) { const details = await fn(); checks.push({ name, ...(details && typeof details === 'object' ? { details } : {}) }); console.log(`ok  ${name}`); }

// The class basic attack is read from the production server table, so the baseline follows any rebalance of it.
// (T1 moved the table into the shared hero-power module; the server builds its profiles from it.)
const { basicAttackSpec, heroProfile } = await import('../src/combat/hero-power.mjs');
const profile = classId => { const spec = basicAttackSpec(classId); return { damage: spec.damage, range: spec.range }; };
const BASIC = { warrior: { ...profile('warrior'), halfAngle: heroProfile('warrior').basic.arc }, dwarf: profile('dwarf') };

const target = (id, x, z = 0, extra = {}) => ({ id, x, z, radius: .6, health: 1e6, ...extra });
function fixture(classId, targets, { relic = null, colliders = [], stats = {}, loadout = null, perks = null } = {}) {
  const world = createCollisionWorld({ colliders, bounds: { x: 0, z: 0, radius: 55 } });
  const state = R.createArsenalState(classId), events = [], hits = [], kills = [];
  const ctx = { ownerId: 'fixture', actor: { x: 0, z: 0 }, aim: { x: 1, z: 0 }, relic, loadout, perks,
    stats: { damageMultiplier: 2, areaMultiplier: 1, cooldownMultiplier: 1, projectileBonus: 0, ...stats },
    targets: () => targets, emit: event => events.push(structuredClone(event)),
    sweepStatic: (from, to, radius, kind) => sweepStatic(world, from, to, radius, { kind }),
    hit(victim, effect) { assert.ok(victim.health > 0 && !victim.dead, `dead target ${victim.id} was hit again`); hits.push({ id: victim.id, ...effect });
      victim.health -= effect.damage; if (victim.health <= 0) { kills.push(victim.id); return true; } return false; } };
  return { state, ctx, events, hits, kills, targets,
    attack() { return R.relicAttack(state, ctx); },
    tick(seconds, dt = 1 / 60) { for (let t = 0; t < seconds - 1e-9; t += dt) R.advanceArsenal(state, Math.min(dt, seconds - t), ctx); },
    hitIds() { return [...new Set(hits.map(hit => hit.id))].sort((a, b) => a - b); },
    damageTo(id) { return hits.filter(hit => hit.id === id).reduce((sum, hit) => sum + hit.damage, 0); } };
}
// Plain basic attack of each class on the same pack (what the infused attack is compared against).
function baselineDamage(classId, targets, multiplier = 2) {
  if (classId === 'warrior') return R.targetsInCone(targets, { x: 0, z: 0 }, { x: 1, z: 0 }, BASIC.warrior.range, BASIC.warrior.halfAngle).length * BASIC.warrior.damage * multiplier;
  return BASIC.dwarf.damage * multiplier; // rifle: first body on the ray
}
const pack = () => [target(1, 2.6, 0), target(2, 3.4, 1.1), target(3, 3.4, -1.1), target(4, 6.2, .3), target(5, 9, -.4), target(6, 11.5, .2),
  target(7, -3, 0), target(8, 0, 3.6), target(9, 4, 5.5), target(90, -30, 30)];

// ---------------------------------------------------------------- A. shared rules
check('Tables: eight legacy relics for both classes, legacy durations, boss drops valid, Aldric never shoots', () => {
  assert.deepEqual(R.RELIC_IDS, ['flamethrower', 'axe', 'katana', 'crossbow', 'talisman', 'thunderstaff', 'boneCannon', 'frostNova']);
  assert.deepEqual(R.RELIC_IDS.map(id => R.RELICS[id].duration), [20, 16, 20, 22, 18, 20, 22, 20]);
  for (const id of R.RELIC_IDS) for (const classId of ['warrior', 'dwarf']) {
    const spec = R.getRelicSpec(id, classId); assert.ok(spec.name && spec.summary && spec.actions.length);
    if (classId === 'warrior') assert.ok(spec.actions.every(action => action.type !== 'projectile'), `${id}: Aldric relic must stay melee-shaped`);
  }
  for (const relic of Object.values(R.BOSS_RELIC_DROPS)) assert.ok(R.RELIC_IDS.includes(relic));
  assert.equal(R.getRelicSpec('pistol', 'dwarf'), null); assert.equal(R.getRelicSpec('constructor', 'warrior'), null);
  assert.ok(Object.isFrozen(R.RELICS.axe.warrior.actions[0]));
});

for (const classId of ['warrior', 'dwarf']) for (const relic of R.RELIC_IDS) check(`${classId} × ${relic}: infused attack hits its shape, spares decoys and beats the plain attack`, () => {
  const f = fixture(classId, pack(), { relic }), attacks = 6;
  for (let i = 0; i < attacks; i++) { assert.equal(f.attack(), true); f.tick(.5); }
  f.tick(3);
  assert.ok(f.hits.length > 0, 'relic never hit'); assert.ok(f.hits.every(hit => hit.hitEffect === relic && hit.source === relic));
  assert.ok(!f.hits.some(hit => hit.id === 90), 'far decoy was hit');
  assert.equal(f.state.pending.length, 0); assert.equal(f.state.projectiles.length, 0);
  const extra = f.hits.reduce((sum, hit) => sum + hit.damage, 0) / attacks, base = baselineDamage(classId, pack());
  assert.ok(extra > 0 && base + extra > base);
  measurements.relics[`${classId}:${relic}`] = { name: R.getRelicName(relic, classId), duration: R.RELICS[relic].duration, basicPerAttack: base, relicExtraPerAttack: +extra.toFixed(2),
    infusedVsBasic: +((base + extra) / base).toFixed(2), victims: f.hitIds() };
  assert.ok((base + extra) / base >= 1.5, `${relic} is not a clear power spike (${((base + extra) / base).toFixed(2)}x)`);
  return measurements.relics[`${classId}:${relic}`];
});

check('Aldric shapes: fire cone burns, whirlwind reaches behind twice, echo is delayed, thrust pierces a 12 m lane', () => {
  let f = fixture('warrior', pack(), { relic: 'flamethrower' }); f.attack();
  assert.deepEqual(f.hitIds(), [1, 2, 3, 4]); assert.ok(f.hits.every(hit => hit.burnDps === 3.2 && hit.burnDuration === 3 && hit.damage === 8));
  f = fixture('warrior', pack(), { relic: 'axe' }); f.attack();
  assert.deepEqual(f.hitIds(), [1, 2, 3, 7, 8]); f.tick(.3); assert.equal(f.hits.filter(hit => hit.id === 7).length, 2);
  assert.equal(f.events.filter(event => event.shape === 'radius').length, 2);
  f = fixture('warrior', pack(), { relic: 'katana' }); f.attack(); assert.equal(f.hits.length, 0); f.tick(.13); assert.equal(f.hits.length, 0);
  f.tick(.03); assert.deepEqual(f.hitIds(), [1, 2, 3, 4]); assert.ok(f.events.at(-1).phantom);
  f = fixture('warrior', pack(), { relic: 'crossbow' }); f.attack();
  assert.deepEqual(f.hits.map(hit => hit.id), [1, 2, 3, 4, 5, 6], 'lane victims, ordered outwards'); assert.ok(f.hits.every(hit => hit.damage === 18)); assert.equal(f.events[0].length, 12);
});
check('Aldric shapes: seals follow marked enemies and detonate once per victim, lightning chains without repeats, slam and nova cadence', () => {
  let f = fixture('warrior', pack(), { relic: 'talisman' }); f.attack();
  assert.equal(f.hits.length, 0); assert.equal(f.events[0].phase, 'mark'); assert.equal(f.events[0].points.length, 3);
  f.targets[0].x = 2.6; f.targets[0].z = -6; f.targets.push(target(10, 2.6, -8)); // a marked enemy walks away; the blast goes with it
  f.tick(.6);
  const wave = f.hits.map(hit => hit.id); assert.equal(new Set(wave).size, wave.length, 'a victim took two blasts from one wave');
  assert.ok(wave.includes(10) && wave.includes(1) && wave.includes(2)); assert.equal(f.events.at(-1).phase, 'detonate');
  f = fixture('warrior', pack(), { relic: 'thunderstaff' }); f.attack();
  const chain = f.hits.map(hit => hit.id); assert.equal(chain[0], 1); assert.equal(new Set(chain).size, chain.length); assert.equal(chain.length, 6);
  for (let i = 1; i < f.hits.length; i++) assert.ok(f.hits[i].damage < f.hits[i - 1].damage);
  assert.equal(f.events[0].points.length, 7);
  f = fixture('warrior', pack(), { relic: 'boneCannon' }); f.attack();
  assert.equal(f.hits.length, 0); assert.equal(f.events[0].phase, 'windup'); f.tick(.2);
  assert.ok(f.hitIds().includes(4) && !f.hitIds().includes(6)); assert.deepEqual([f.events.at(-1).x, f.events.at(-1).radius], [3.2, 5]);
  f = fixture('warrior', pack(), { relic: 'frostNova' });
  const novas = []; for (let swing = 1; swing <= 7; swing++) { const before = f.hits.length; f.attack(); novas.push(f.hits.length > before); }
  assert.deepEqual(novas, [true, false, false, true, false, false, true]);
  assert.deepEqual(f.events.filter(event => event.shape === 'charge').map(event => event.step), [1, 2, 1, 2]);
  assert.ok(f.hitIds().includes(7) && f.hitIds().includes(8));
});
check('Lyra bodies: boomerang returns through the horde, blade ricochets ≤4, bolt pierces 6, seal homes, shell/orb cadence and blasts', () => {
  let f = fixture('dwarf', [target(1, 4, 0), target(2, 8, .2), target(90, 0, 20)], { relic: 'axe' }); f.attack(); f.attack(); f.tick(3);
  assert.equal(f.events.filter(event => event.phase === 'spawn').length, 1, 'axe is thrown every second shot');
  assert.equal(f.hits.filter(hit => hit.id === 1).length, 2); assert.equal(f.hits.filter(hit => hit.id === 2).length, 2);
  assert.ok(f.events.some(event => event.phase === 'move' && event.returning)); assert.equal(f.events.at(-1).reason, 'returned');
  f = fixture('dwarf', [1, 2, 3, 4, 5, 6].map(i => target(i, 3 + i * 2.2, (i % 2) * 2.4)), { relic: 'katana' }); f.attack(); f.tick(2);
  assert.equal(f.hits.length, 4); assert.equal(new Set(f.hits.map(hit => hit.id)).size, 4); assert.equal(f.events.filter(event => event.bounce).length, 3);
  f = fixture('dwarf', [1, 2, 3, 4, 5, 6, 7, 8].map(i => target(i, 2 + i * 2, 0)), { relic: 'crossbow', stats: { projectileBonus: 0 } }); f.attack(); f.tick(1.2);
  assert.deepEqual(f.hits.map(hit => hit.id), [1, 2, 3, 4, 5, 6]);
  f = fixture('dwarf', [target(1, 9, 5)], { relic: 'talisman' }); f.attack(); f.tick(2);
  assert.ok(f.hits.some(hit => hit.id === 1), 'homing seal missed an off-axis target'); assert.ok(f.events.some(event => event.phase === 'move'));
  assert.equal(f.events.at(-1).radius, 4.8);
  f = fixture('dwarf', [target(1, 8, 0), target(2, 10, 3), target(3, 8, -9)], { relic: 'boneCannon' }); f.attack(); f.attack(); f.attack(); f.tick(2);
  assert.equal(f.events.filter(event => event.phase === 'spawn').length, 2); assert.ok(f.hitIds().includes(2) && !f.hitIds().includes(3));
  assert.equal(f.damageTo(1), 2 * (3 * 2 + 8 * 2));
  f = fixture('dwarf', [target(1, 30, 0)], { relic: 'frostNova' }); for (let i = 0; i < 6; i++) f.attack(); f.tick(3);
  assert.equal(f.events.filter(event => event.phase === 'spawn').length, 2); assert.ok(f.events.filter(event => event.phase === 'impact').every(event => event.radius === 5 && event.reason === 'expired'));
  f = fixture('dwarf', pack(), { relic: 'crossbow', stats: { projectileBonus: 2 } }); f.attack();
  assert.equal(f.events.filter(event => event.phase === 'spawn').length, 3, '+Projétil widens bolt relics like the rifle');
});
check('Solids: cone, lane, chain, bodies and blasts stop at a wall; whirlwind and nova keep the legacy wall-free radius', () => {
  const wall = [{ id: 'wall', shape: 'box', x: 3, z: 0, halfX: .1, halfZ: 12 }], beyond = () => [target(1, 2, 0), target(2, 4.2, 0), target(3, 4.2, 1.5)];
  for (const [classId, relic] of [['warrior', 'flamethrower'], ['warrior', 'crossbow'], ['warrior', 'thunderstaff'], ['warrior', 'talisman'], ['dwarf', 'flamethrower'],
    ['dwarf', 'crossbow'], ['dwarf', 'thunderstaff'], ['dwarf', 'katana'], ['dwarf', 'frostNova']]) {
    const f = fixture(classId, beyond(), { relic, colliders: wall }); f.attack(); f.tick(3);
    assert.ok(f.hitIds().every(id => id === 1), `${classId} ${relic} crossed the wall: ${f.hitIds()}`);
  }
  const f = fixture('dwarf', [target(2, 4.2, 0), target(3, 4.2, 1.5)], { relic: 'boneCannon', colliders: wall }); f.attack(); f.tick(2);
  assert.equal(f.hits.length, 0, 'bone blast crossed the wall'); assert.equal(f.events.at(-1).reason, 'wall');
  for (const relic of ['axe', 'frostNova']) { const g = fixture('warrior', beyond(), { relic, colliders: wall }); g.attack(); assert.deepEqual(g.hitIds(), [1, 2, 3]); }
});
check('One reward per victim: kills are reported once, corpses take no further hits, relic swap resets cadence', () => {
  for (const [classId, relic] of [['warrior', 'axe'], ['warrior', 'talisman'], ['warrior', 'thunderstaff'], ['dwarf', 'axe'], ['dwarf', 'boneCannon'], ['dwarf', 'katana']]) {
    const f = fixture(classId, pack().map(body => ({ ...body, health: 9 })), { relic });
    for (let i = 0; i < 8; i++) { f.attack(); f.tick(.5); } f.tick(3);
    assert.equal(new Set(f.kills).size, f.kills.length, `${classId} ${relic} killed a victim twice`); assert.ok(f.kills.length >= 3);
  }
  const f = fixture('warrior', pack(), { relic: 'frostNova' }); f.attack(); f.attack(); assert.equal(f.state.swing, 2);
  f.ctx.relic = 'axe'; f.attack(); assert.equal(f.state.swing, 1); assert.equal(f.state.relic, 'axe');
});
check('Untrusted numbers are clamped; unknown relic, missing actor and zero dt do nothing', () => {
  let f = fixture('warrior', pack(), { relic: 'axe', stats: { damageMultiplier: Infinity, areaMultiplier: NaN, cooldownMultiplier: -5, projectileBonus: 1e9 } }); f.ctx.aim = { x: NaN, z: Infinity }; f.attack();
  assert.ok(f.hits.every(hit => hit.damage === 10)); assert.equal(f.events[0].radius, 4.4);
  f = fixture('warrior', pack(), { relic: 'axe', stats: { damageMultiplier: 1e9, areaMultiplier: 1e9 } }); f.attack();
  assert.ok(Math.abs(f.events[0].radius - 4.4 * 1.5) < 1e-9, 'area is capped at the progression limit (2.25 → ×1.5 radius)'); assert.ok(f.hits.every(hit => hit.damage === 500));
  f = fixture('dwarf', pack(), { relic: 'crossbow', stats: { projectileBonus: 99 } }); f.attack(); assert.equal(f.events.filter(event => event.phase === 'spawn').length, 5);
  for (const relic of [null, 'pistol', 'toString', 42]) { const g = fixture('warrior', pack(), { relic }); assert.equal(g.attack(), false); assert.equal(g.hits.length + g.events.length, 0); }
  const g = fixture('dwarf', pack(), { relic: 'katana' }); g.ctx.actor = { x: NaN, z: 0 }; assert.equal(g.attack(), false);
  const h = fixture('dwarf', pack(), { relic: 'katana' }); h.attack(); const events = h.events.length; R.advanceArsenal(h.state, 0, h.ctx); R.advanceArsenal(h.state, NaN, h.ctx); assert.equal(h.events.length, events);
});

const loadout = stacks => R.getAutoWeaponLoadout(stacks);
check('Automatic weapons: stacks unlock blade → orb → rain, perk gates evolve them, Aldric can reach Dilúvio Arcano', () => {
  assert.deepEqual(R.AUTO_WEAPON_IDS, ['guardianBlade', 'orbitOrb', 'sealRain']);
  assert.deepEqual(Object.values(loadout({})).map(slot => slot.level), [0, 0, 0]);
  assert.deepEqual(Object.values(loadout({ autoWeapon: 2 })).map(slot => slot.level), [1, 1, 0]);
  assert.deepEqual(Object.values(loadout({ autoWeapon: 99, bladeEcho: 2, sealRitual: 1, prismStorm: 1 })), [{ level: 1, evolved: true }, { level: 1, evolved: true }, { level: 1, evolved: true }]);
  assert.equal(loadout({ autoWeapon: 3, bladeEcho: 1 }).guardianBlade.evolved, false);
  assert.equal(loadout({ autoWeapon: 3, sealRitual: 2 }).sealRain.evolved, true, 'warrior path (no Tempestade Prismática)');
  assert.equal(loadout({ autoWeapon: 0, bladeEcho: 2 }).guardianBlade.evolved, false);
  assert.deepEqual([R.nextAutoWeapon({}), R.nextAutoWeapon({ autoWeapon: 2 }), R.nextAutoWeapon({ autoWeapon: 3 })], ['guardianBlade', 'sealRain', null]);
  assert.deepEqual(Object.values(R.AUTO_WEAPONS).map(weapon => weapon.evolution.id), ['eclipseBlade', 'profaneOrb', 'arcaneDeluge']);
});
check('Automatic weapons tick on their own: cadence, reach, line of sight, orbit contact, evolutions and Ritual de Selos', () => {
  const only = id => Object.fromEntries(R.AUTO_WEAPON_IDS.map(weapon => [weapon, { level: weapon === id ? 1 : 0, evolved: false }]));
  let f = fixture('warrior', [target(1, 10, 0), target(2, 40, 0)], { loadout: only('guardianBlade') }); f.tick(10);
  assert.ok(f.hits.length >= 10 && f.hits.length <= 11); assert.deepEqual(f.hitIds(), [1]); assert.ok(f.hits.every(hit => hit.damage === 11 && hit.hitEffect === 'guardianBlade'));
  f = fixture('warrior', [target(1, 10, 0)], { loadout: only('guardianBlade'), stats: { cooldownMultiplier: .5 } }); f.tick(10); assert.ok(f.hits.length >= 20);
  f = fixture('warrior', [target(1, 6, 0), target(2, 0, 12)], { loadout: only('guardianBlade'), colliders: [{ id: 'wall', shape: 'box', x: 3, z: 0, halfX: .1, halfZ: 4 }] }); f.tick(3);
  assert.deepEqual(f.hitIds(), [2], 'guardian blade struck through a wall');
  f = fixture('warrior', [target(1, 3.4, 0), target(2, 9, 0)], { loadout: only('orbitOrb') }); f.tick(8);
  assert.deepEqual(f.hitIds(), [1]); assert.ok(f.hits.length >= 3 && f.hits.every(hit => hit.damage === 5.2));
  f = fixture('dwarf', [target(1, 20, 0), target(2, 22, 1), target(3, 20, 12)], { loadout: only('sealRain') }); f.tick(6);
  assert.deepEqual(f.hitIds(), [1, 2]); assert.ok(f.hits.filter(hit => hit.id === 1).length === 4 && f.hits.every(hit => hit.damage === 18));
  const evolved = Object.fromEntries(R.AUTO_WEAPON_IDS.map(weapon => [weapon, { level: 1, evolved: true }]));
  f = fixture('dwarf', [target(1, 8, 0), target(2, 5, .3), target(3, 8, 1.35)], { loadout: evolved, perks: { sealRitual: 2 } }); f.tick(6);
  assert.ok(f.hits.some(hit => hit.source === 'guardianBlade' && hit.id === 2), 'Eclipse cone missed the enemy in its lane');
  assert.ok(f.events.filter(event => event.weapon === 'sealRain').every(event => event.evolved && event.points.length === 3));
  const autos = f.events.filter(event => event.kind === 'auto' && event.weapon !== 'sealRitual').length, rituals = f.events.filter(event => event.weapon === 'sealRitual').length;
  assert.equal(rituals, Math.floor(autos / 5)); assert.ok(rituals >= 1); assert.ok(f.hits.some(hit => hit.source === 'sealRitual' && hit.damage === 20));
  f = fixture('dwarf', [], { loadout: evolved }); f.tick(3); assert.equal(f.events.length, 0, 'automatic weapons fired with nothing to hit');
  for (const id of R.AUTO_WEAPON_IDS) measurements.autoWeapons[id] = { label: R.AUTO_WEAPONS[id].label, damage: R.AUTO_WEAPONS[id].damage * 2, cooldown: R.AUTO_WEAPONS[id].cooldown, evolution: R.AUTO_WEAPONS[id].evolution.label };
});
check('Cleanup: death and cancel end every body and pending blast; nothing allocates targets while idle', () => {
  const f = fixture('dwarf', [target(1, 40, 0)], { relic: 'talisman' }); f.attack(); const g = fixture('warrior', pack(), { relic: 'talisman' }); g.attack();
  assert.equal(f.state.projectiles.length, 1); assert.equal(g.state.pending.length, 1);
  f.ctx.dead = true; f.tick(.1); assert.equal(f.state.projectiles.length, 0); assert.deepEqual([f.events.at(-1).phase, f.events.at(-1).reason], ['end', 'death']);
  R.cancelArsenal(g.state, g.ctx.emit); g.tick(2); assert.equal(g.hits.length, 0); assert.equal(R.arsenalBusy(g.state), false);
  let calls = 0; const idle = fixture('warrior', pack()); idle.ctx.targets = () => { calls++; return []; }; idle.tick(2); assert.equal(calls, 0);
});

// ---------------------------------------------------------------- B. server-owned progression
const fresh = (character = 'dwarf', random = () => .5) => { const state = { runId: `run-${character}`, character, health: 200, maxHealth: 200, bestLevel: 1, stateVersion: 0, state: 'playing', x: 0, z: 0, wave: 1 }; return [state, A.createProgression(state, { random })]; };
check('Progression: relic drops rotate without repeating the held relic, charge only during downtime, expire and report in the snapshot', () => {
  const [state, p] = fresh('warrior'); let serial = 0;
  const kill = () => A.rewardKill(state, p, { type: 'zombie', xp: 0, x: 0, z: 0 });
  const relicDrops = () => [...p.drops.values()].filter(drop => drop.kind === 'weapon');
  for (let i = 0; i < 5; i++) kill(); assert.equal(relicDrops().length, 0); kill();
  assert.deepEqual(relicDrops().map(drop => drop.type), ['flamethrower']);
  assert.equal(A.collectDrop(state, p, { runId: p.runId, dropId: relicDrops()[0].id, requestId: `pickup-${++serial}` }).ok, true);
  assert.deepEqual([A.activeRelic(p), p.weaponTimer, state.progression.relic, state.progression.relicDuration], ['flamethrower', 20, 'flamethrower', 20]);
  assert.ok(Math.abs(A.attackStats(p).damageMultiplier - 2.8) < 1e-9);
  for (let i = 0; i < 30; i++) kill(); assert.equal(relicDrops().length, 0, 'kills charged a drop while a relic was infused');
  A.tickProgression(state, p, 19.5); assert.equal(state.progression.relic, 'flamethrower'); A.tickProgression(state, p, .6);
  assert.deepEqual([A.activeRelic(p), p.relic, state.progression.relic, state.progression.relicDuration], [null, null, null, 0]);
  const seen = []; for (let round = 0; round < 9; round++) { for (let i = 0; i < 6; i++) kill(); const drop = relicDrops().at(-1); seen.push(drop.type); p.drops.delete(drop.id); }
  assert.deepEqual(seen, ['axe', 'katana', 'crossbow', 'talisman', 'thunderstaff', 'boneCannon', 'frostNova', 'flamethrower', 'axe']);
  assert.deepEqual([R.nextRelicDrop(0, 'flamethrower'), R.nextRelicDrop(7, null), R.nextRelicDrop(NaN, null)], [{ type: 'axe', index: 2 }, { type: 'frostNova', index: 0 }, { type: 'flamethrower', index: 1 }]);
  A.rewardKill(state, p, { type: 'dinzo', xp: 0, x: 4, z: 4 }, { boss: true });
  assert.deepEqual([...p.drops.values()].map(drop => drop.kind).sort(), ['bossChest', 'healthPotion', 'weapon']); assert.equal(relicDrops()[0].type, 'boneCannon');
  const legacy = A.createDrop(p, 'weapon', { x: 0, z: 0 }); A.collectDrop(state, p, { runId: p.runId, dropId: legacy.id, requestId: 'generic' });
  assert.deepEqual([A.activeRelic(p), p.weaponTimer], [null, 15], 'a drop without a relic type keeps the generic 15 s infusion');
});
check('Progression: both classes are offered Desbloquear arma automática (3 stacks) and Ritual de Selos; the snapshot mirrors the loadout', () => {
  for (const character of ['warrior', 'dwarf']) {
    const [state, p] = fresh(character, () => 0); A.grantXp(state, p, 500000); const chosen = new Set();
    while (p.offer) { const id = p.offer.upgradeIds.find(upgrade => ['autoWeapon', 'sealRitual'].includes(upgrade)) || p.offer.upgradeIds[0]; chosen.add(id);
      assert.equal(A.chooseUpgrade(state, p, { runId: p.runId, offerId: p.offer.id, upgradeId: id, requestId: `c${p.offerSerial}` }).ok, true); }
    assert.ok(chosen.has('autoWeapon') && chosen.has('sealRitual')); assert.equal(p.stacks.autoWeapon, 3); assert.equal(p.stacks.sealRitual, 2);
    assert.deepEqual(Object.values(state.progression.autoWeapons).map(slot => slot.level), [1, 1, 1]);
    assert.equal(state.progression.autoWeapons.sealRain.evolved, true); assert.equal(state.progression.autoWeapons.orbitOrb.evolved, true);
    assert.equal(A.available(p, A.DEFINITIONS.find(definition => definition.id === 'autoWeapon')), false, 'fourth stack offered');
  }
  const [, young] = fresh('warrior'); assert.equal(A.available(young, A.DEFINITIONS.find(definition => definition.id === 'sealRitual')), false, 'Ritual de Selos keeps its level 5 gate');
});

// ---------------------------------------------------------------- C. real protocol, isolated production server
// Declared fixtures (private IPC of the isolated copy; production functions are called, never replaced):
//  qa-arsenal-drop  → production createDrop() places a relic drop under the player; the pickup itself is a real client message.
//  qa-arsenal-stack → writes upgrade stacks on server progression (the offer RNG cannot be steered from a test).
const authorityUrl = pathToFileURL(path.resolve('src/progression/authority.mjs')).href;
const arsenalFixture = `
process.on('message', async request => {
  if (request.type !== 'qa-arsenal-drop' && request.type !== 'qa-arsenal-stack' && request.type !== 'qa-arsenal-read') return;
  try {
    const room = rooms.get(request.room), client = room?.clients.get(request.clientId);
    if (!client) throw Error('Fixture client missing');
    if (request.type === 'qa-arsenal-drop') {
      const authority = await import(${JSON.stringify(authorityUrl)});
      const drop = authority.createDrop(client.progression, 'weapon', { x: client.state.x, z: client.state.z }, { type: request.relic, source: 'qa-fixture' });
      client.state.stateVersion++; syncProgression(client.state, client.progression);
      sendJson(client, { type: 'playerState', id: client.id, state: client.state });
      process.send({ id: request.id, result: drop });
    } else if (request.type === 'qa-arsenal-stack') {
      Object.assign(client.progression.stacks, request.stacks);
      client.state.stateVersion++; syncProgression(client.state, client.progression);
      sendJson(client, { type: 'playerState', id: client.id, state: client.state });
      process.send({ id: request.id, result: client.state.progression.autoWeapons });
    } else process.send({ id: request.id, result: { relic: activeRelic(client.progression), weaponTimer: client.progression.weaponTimer, stacks: { ...client.progression.stacks },
      monsters: [...room.world.monsters.values()].map(monster => ({ id: monster.id, x: monster.x, z: monster.z, health: monster.health, burnTimer: monster.burnTimer, burnDps: monster.burnDps, freezeTimer: monster.freezeTimer })),
      arsenal: client.arsenal ? { pending: client.arsenal.pending.length, projectiles: client.arsenal.projectiles.length } : null } });
  } catch (error) { process.send({ id: request.id, error: error.message }); }
});
`;
// An open patch of the real arena: every listed offset is free and visible from the hero.
const arena = createCollisionWorld({ colliders: getEnvironmentColliders(), bounds: ENVIRONMENT_GROUND, groundY: ENVIRONMENT_GROUND.y });
const offsets = { front: [3, 0], lane: [10, 0], behind: [-3.2, 0], side: [0, 6.2], far: [-20, 0] };
function openSpot() {
  for (let radius = 6; radius < 40; radius += 2) for (let step = 0; step < 24; step++) {
    const x = Math.cos(step / 24 * Math.PI * 2) * radius, z = Math.sin(step / 24 * Math.PI * 2) * radius;
    const free = (px, pz, r) => { const spot = findFreePosition(arena, { x: px, z: pz, radius: r }, { maxDistance: 2 }); return spot.found && !spot.relocated; };
    if (!free(x, z, .64)) continue;
    if (Object.values(offsets).every(([dx, dz]) => free(x + dx, z + dz, 1) && !sweepStatic(arena, { x, z, y: .9 }, { x: x + dx, z: z + dz, y: .9 }, .7))
      && !sweepStatic(arena, { x, z, y: .9 }, { x: x + 13, z, y: .9 }, 1.2)) return { x, z };
  }
  throw Error('No open arena patch for the protocol scene');
}

const server = await launchProtocolServer('arsenal', arsenalFixture), clients = [];
const send = (client, message) => client.socket.send(JSON.stringify(message));
const since = (client, from, predicate) => client.messages.slice(from).filter(predicate);
const arsenalEvents = (client, from, id) => since(client, from, message => message.type === 'arsenalEvent' && message.id === id).map(message => message.event);
const monsterHits = (client, from, id) => since(client, from, message => message.type === 'monsterHit' && message.sourceId === id);
let failure = null;
try {
  // One room per scenario: a closed client keeps its slot for the 30 s reconnect grace (4 slots per room).
  const spot = openSpot();
  let room = null, observer = null, roomSerial = 0;
  async function openRoom() { room = `arsenal${++roomSerial}`; observer = await connectProtocolClient(`${server.wsUrl}?room=${room}&character=dwarf`, clients); }
  async function hero(character) {
    await openRoom();
    const client = await connectProtocolClient(`${server.wsUrl}?room=${room}&character=${character}`, clients);
    await startProtocolRun(client, character);
    const placed = await server.placePlayer(room, client.id, spot);
    assert.ok(Math.hypot(placed.x - spot.x, placed.z - spot.z) < .01, 'hero was not placed on the open patch');
    return client;
  }
  async function scene(health = 400) {
    const placed = await server.arrangeCombat(room, Object.values(offsets).map(([dx, dz]) => ({ x: spot.x + dx, z: spot.z + dz, health })));
    const byName = Object.fromEntries(Object.keys(offsets).map((name, index) => [name, placed[index]]));
    for (const [name, [dx, dz]] of Object.entries(offsets)) assert.ok(Math.hypot(byName[name].x - spot.x - dx, byName[name].z - spot.z - dz) < .05, `${name} target was relocated`);
    return byName;
  }
  async function grantRelic(client, relic) {
    const drop = await server.requestFixture('qa-arsenal-drop', { room, clientId: client.id, relic }), from = client.messages.length, requestId = crypto.randomUUID();
    send(client, { type: 'pickup', runId: client.authority.runId, dropId: drop.id, requestId });
    const result = await protocolMessage(client, message => message.type === 'progressionResult' && message.requestId === requestId, from);
    assert.equal(result.result.ok, true); assert.equal(result.state.progression.relic, relic); assert.equal(result.state.progression.weaponTimer, R.RELICS[relic].duration);
    return result.state;
  }
  async function attack(client, kind, extra = {}) {
    const from = observer.messages.length;
    send(client, { type: 'attack', attack: { kind, weapon: kind, aimX: 1, aimZ: 0, ...extra } });
    await delay(700); // covers every delayed relic action (≤ .55 s) at the 50 ms server tick
    return from;
  }
  const hostile = { relic: 'frostNova', relicType: 'frostNova', damage: 1e9, damageMultiplier: 1e9, radius: 999, range: 999, areaMultiplier: 99, halfAngle: 3.2, x: 0, z: 0,
    autoWeapons: { sealRain: { level: 1, evolved: true } }, stats: { damageMultiplier: 1e9 }, event: { kind: 'relic', relic: 'frostNova', shape: 'radius', radius: 999 } };

  await checkAsync('Server: a hostile attack payload cannot conjure a relic; without one only the class basic attack resolves', async () => {
    const warrior = await hero('warrior'), targets = await scene();
    const from = await attack(warrior, 'katana', hostile);
    assert.equal(arsenalEvents(observer, from, warrior.id).length, 0, 'client-supplied relic produced an arsenal event');
    const hits = monsterHits(observer, from, warrior.id);
    assert.deepEqual([...new Set(hits.map(hit => hit.id))], [targets.front.id]); assert.ok(hits.every(hit => hit.hitEffect === 'katana' && hit.amount <= BASIC.warrior.damage * 2 * 1.8 + 1e-6));
    for (const type of ['arsenal', 'arsenalEvent', 'relic', 'equipWeapon']) send(warrior, { type, relic: 'axe', event: hostile.event, runId: warrior.authority.runId });
    const forged = crypto.randomUUID(), at = warrior.messages.length; send(warrior, { type: 'pickup', runId: warrior.authority.runId, dropId: `${warrior.authority.runId}:drop:999`, requestId: forged });
    assert.equal((await protocolMessage(warrior, message => message.type === 'progressionResult' && message.requestId === forged, at)).result.code, 'missing-drop');
    const state = await server.requestFixture('qa-arsenal-read', { room, clientId: warrior.id }); assert.equal(state.relic, null);
    await closeProtocolClient(warrior);
  });

  await checkAsync('Server: Redemoinho do Machado (warrior × axe) is resolved from server progression, reaches behind, ignores hostile numbers and is broadcast', async () => {
    const warrior = await hero('warrior'), targets = await scene(); await grantRelic(warrior, 'axe');
    const from = await attack(warrior, 'katana', hostile), events = arsenalEvents(observer, from, warrior.id), hits = monsterHits(observer, from, warrior.id);
    assert.equal(events.length, 2); assert.ok(events.every(event => event.relic === 'axe' && event.shape === 'radius' && event.radius === 4.4), 'radius came from the client');
    const axeHits = hits.filter(hit => hit.hitEffect === 'axe'), victims = [...new Set(axeHits.map(hit => hit.id))].sort();
    assert.deepEqual(victims, [targets.front.id, targets.behind.id].sort(), 'whirlwind victims'); assert.equal(axeHits.filter(hit => hit.id === targets.behind.id).length, 2);
    assert.ok(axeHits.every(hit => hit.amount <= 5 * 2 * 1.4 * 1.8 + 1e-6), 'client damage leaked into the server hit');
    assert.ok(!hits.some(hit => [targets.far.id, targets.lane.id, targets.side.id].includes(hit.id)));
    // Same attack message while the sword is still recovering: rejected, so no second relic resolution either.
    const early = observer.messages.length; send(warrior, { type: 'attack', attack: { kind: 'katana', weapon: 'katana', aimX: 1, aimZ: 0 } }); send(warrior, { type: 'attack', attack: { kind: 'katana', weapon: 'katana', aimX: 1, aimZ: 0 } });
    await delay(450); assert.equal(arsenalEvents(observer, early, warrior.id).filter(event => !event.echo).length, 1, 'relic bypassed the server attack cooldown');
    await closeProtocolClient(warrior);
    return { events: events.length, victims };
  });

  await checkAsync('Server: Estocada Perfurante (warrior × crossbow) pierces the 12 m lane; kills are rewarded once per victim', async () => {
    const warrior = await hero('warrior'), targets = await scene(20); await grantRelic(warrior, 'crossbow');
    const rewardsFrom = warrior.messages.length, from = await attack(warrior, 'katana', hostile), events = arsenalEvents(observer, from, warrior.id);
    assert.equal(events.length, 1); assert.deepEqual([events[0].shape, events[0].length, events[0].halfWidth], ['line', 12, .9]);
    const killed = since(observer, from, message => message.type === 'monsterKilled' && message.sourceId === warrior.id).map(message => message.monster.id).sort();
    assert.deepEqual(killed, [targets.front.id, targets.lane.id].sort(), 'thrust must kill the near and the 10 m target (20 HP < 25.2)');
    const rewards = since(warrior, rewardsFrom, message => message.type === 'playerReward').map(message => message.monster.id);
    assert.deepEqual(rewards.sort(), killed); assert.equal(new Set(rewards).size, rewards.length, 'a victim was rewarded twice');
    await closeProtocolClient(warrior);
    return { killed: killed.length, rewards: rewards.length };
  });

  await checkAsync('Server: Rifle Lança-chamas applies the shared burn rule; a Selo Teleguiado flies server-side until death cleans it up', async () => {
    const dwarf = await hero('dwarf'), targets = await scene(); await grantRelic(dwarf, 'flamethrower');
    const from = await attack(dwarf, 'pistol', hostile), events = arsenalEvents(observer, from, dwarf.id);
    assert.deepEqual([events[0].shape, events[0].range, events[0].halfAngle], ['cone', 10.5, .58]);
    let read = await server.requestFixture('qa-arsenal-read', { room, clientId: dwarf.id });
    const burning = read.monsters.filter(monster => monster.burnTimer > 0); assert.ok(burning.some(monster => monster.id === targets.front.id));
    assert.ok(burning.every(monster => Math.abs(monster.burnDps - 1.6 * 2 * 1.4) < 1e-9), 'burn did not follow the shared rule');
    assert.ok(since(observer, from, message => message.type === 'monsterHit' && message.hitEffect === 'burnTick').length <= 4, 'burn is batched, not broadcast every 50 ms tick');
    await grantRelic(dwarf, 'talisman'); await scene();
    send(dwarf, { type: 'attack', attack: { kind: 'pistol', weapon: 'pistol', aimX: 0, aimZ: -1 } }); await delay(130); // fired away from every target
    read = await server.requestFixture('qa-arsenal-read', { room, clientId: dwarf.id }); assert.equal(read.arsenal.projectiles, 1, 'homing seal should still be in flight');
    const deathFrom = observer.messages.length; await server.killPlayers(room, [dwarf.id]);
    read = await server.requestFixture('qa-arsenal-read', { room, clientId: dwarf.id }); assert.deepEqual(read.arsenal, { pending: 0, projectiles: 0 });
    assert.ok(arsenalEvents(observer, deathFrom, dwarf.id).some(event => event.kind === 'projectile' && event.phase === 'end' && event.reason === 'death'));
    const afterDeath = observer.messages.length; await delay(500);
    assert.equal(monsterHits(observer, afterDeath, dwarf.id).filter(hit => hit.hitEffect === 'talisman').length, 0, 'a relic body kept damaging after its owner died');
    assert.equal(arsenalEvents(observer, afterDeath, dwarf.id).length, 0, 'arsenal events continued after death');
    await closeProtocolClient(dwarf);
  });

  await checkAsync('Server: Lâmina Guardiã attacks with no client input; levels are server-owned and cannot be claimed by the client', async () => {
    const warrior = await hero('warrior'); await scene(30);
    let from = observer.messages.length;
    send(warrior, { type: 'state', state: { x: spot.x, z: spot.z, aimX: 1, aimZ: 0, state: 'playing', autoWeapons: hostile.autoWeapons, progression: { autoWeapons: hostile.autoWeapons, upgradeStacks: { autoWeapon: 3 } } } });
    const choice = crypto.randomUUID(), at = warrior.messages.length; send(warrior, { type: 'chooseUpgrade', runId: warrior.authority.runId, offerId: 'forged', upgradeId: 'autoWeapon', requestId: choice });
    assert.equal((await protocolMessage(warrior, message => message.type === 'progressionResult' && message.requestId === choice, at)).result.code, 'not-offered');
    await delay(1600); assert.equal(arsenalEvents(observer, from, warrior.id).length, 0, 'client-claimed automatic weapon fired');
    assert.deepEqual(await server.requestFixture('qa-arsenal-stack', { room, clientId: warrior.id, stacks: { autoWeapon: 1 } }), { guardianBlade: { level: 1, evolved: false }, orbitOrb: { level: 0, evolved: false }, sealRain: { level: 0, evolved: false } });
    from = observer.messages.length; const rewardsFrom = warrior.messages.length; await delay(3200);
    const events = arsenalEvents(observer, from, warrior.id); assert.ok(events.length >= 3 && events.every(event => event.kind === 'auto' && event.weapon === 'guardianBlade'));
    const hits = monsterHits(observer, from, warrior.id); assert.ok(hits.length >= 3 && hits.every(hit => hit.hitEffect === 'guardianBlade' && hit.amount <= 5.5 * 2 * 1.8 + 1e-6));
    const killed = since(observer, from, message => message.type === 'monsterKilled' && message.sourceId === warrior.id).map(message => message.monster.id);
    const rewards = since(warrior, rewardsFrom, message => message.type === 'playerReward').map(message => message.monster.id);
    assert.ok(killed.length >= 1, 'three 11-damage strikes must kill a 30 HP target'); assert.deepEqual(rewards.sort(), [...killed].sort());
    await closeProtocolClient(warrior);
    return { autoAttacks: events.length, killed: killed.length };
  });
  server.assertClean();
} catch (error) { failure = error; }
finally { for (const client of clients) await closeProtocolClient(client); await server.stop(); }

for (const [file, hash] of Object.entries(sources)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash, `${file} changed during the run`);
const report = { passed: !failure, scope: 'CPU: production arsenal rules on production physics, production progression module, and a real-WebSocket isolated copy of the production server with declared private IPC fixtures. Not visual gameplay.',
  sources, serverEvidence: server.evidence, basicAttackBaseline: BASIC, measurements, checks, ...(failure ? { failure: failure.stack } : {}) };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'verify-arsenal.json'), JSON.stringify(report, null, 2));
console.log(failure ? `FAILED: ${failure.stack}` : `verify-arsenal: ${checks.length} checks passed → ${path.join(outDir, 'verify-arsenal.json')}`);
if (failure) process.exitCode = 1;
