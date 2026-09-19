// CPU coverage of Upgrades 2.0 on the shared authoritative simulation (the exact modules the server imports
// and the solo client runs). No render. Run with cwd = repository root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as K from '../src/combat/class-skills.mjs';
import * as U from '../src/progression/skill-upgrades.mjs';
import { createCollisionWorld, moveActor, sweepStatic } from '../src/physics/contacts.mjs';

const BASELINE_COMMIT = '8baaa5f'; // aaa-loop base: class-skills.mjs before skillMods existed
const evidenceDir = path.resolve(process.env.BIPX_EVIDENCE_DIR || 'output/qa/skill-upgrades');
const report = { passed: false, scope: 'CPU fixtures on the production skill core, upgrade module and physics; not visual gameplay', baselineCommit: BASELINE_COMMIT, checks: [], metrics: {} };
const check = (name, fn) => { fn(); report.checks.push(name); console.log(name); };
const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const target = (id, x, z = 0, extra = {}) => ({ id, x, z, radius: .5, health: 1e6, ...extra });
const mods = (stacks, classId) => U.getSkillMods(stacks, classId);

function fixture(mod, classId, { targets = [], colliders = [], skillMods, actor: actorExtra = {}, aim = { aimX: 1, aimZ: 0 }, mover = true } = {}) {
  const state = mod.createSkillState(classId), actor = { x: 0, z: 0, radius: .64, playing: true, damageMultiplier: 2, runId: 'fixture', ...(skillMods === undefined ? {} : { skillMods }), ...actorExtra };
  const events = [], hits = [], world = createCollisionWorld({ colliders, bounds: { x: 0, z: 0, radius: 55 } });
  const options = { actor, targets, emit: e => events.push(e), ...(skillMods === undefined ? {} : { skillMods }),
    sweepStatic: (a, b, r, kind) => sweepStatic(world, a, b, r, { kind }),
    moveCaster: d => { const m = moveActor(world, actor, d); actor.x = m.x; actor.z = m.z; return m; },
    ...(mover ? { moveTarget: (t, d) => { const m = moveActor(world, t, d); return m; } } : {}),
    hit: (t, e) => { hits.push({ id: t.id, ...e }); mod.applySkillControl?.(t, e); t.health -= e.damage; t.dead = t.health <= 0; return t.dead; } };
  return { state, actor, events, hits, targets, options,
    cast: (slot, intent = {}) => { const result = mod.beginSkill(state, { slot, ...aim, ...intent }, actor); if (result.ok) events.push(result.event); return result; },
    tick(seconds, dt = .02) { for (let t = 0; t < seconds - 1e-8; t += dt) mod.advanceSkills(state, Math.min(dt, seconds - t), options); } };
}

// ---------------------------------------------------------------------------------------------------------------
const baseSource = execFileSync('git', ['show', `${BASELINE_COMMIT}:src/combat/class-skills.mjs`], { encoding: 'utf8' });
const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-skill-base-')), baseFile = path.join(baseDir, 'class-skills.mjs');
fs.writeFileSync(baseFile, baseSource);
const B = await import(pathToFileURL(baseFile).href);
report.baselineSha256 = crypto.createHash('sha256').update(baseSource).digest('hex');
try {
  check('Baseline: six skills without mods (absent, null, neutral object, zero stacks) are byte-equivalent to the pre-upgrade core: events, hits, snapshots and HUD', () => {
    const scene = (mod, classId, slot, skillMods) => {
      const f = fixture(mod, classId, { skillMods, targets: [target(1, 3, 0, { health: 30 }), target(2, 3, 1, { boss: true }), target(3, 6, -.4, { health: 5 }), target(4, 40, 20)], colliders: [{ id: 'wall', shape: 'box', x: 14, z: 0, halfX: .2, halfZ: 6 }] });
      const snapshots = []; assert.ok(f.cast(slot).ok);
      for (let t = 0; t < 12; t += .05) { mod.advanceSkills(f.state, .05, f.options); if (Math.round(t * 20) % 10 === 0) snapshots.push(mod.skillSnapshot(f.state)); }
      return JSON.stringify({ events: f.events, hits: f.hits, snapshots, final: mod.skillSnapshot(f.state), actor: { x: f.actor.x, z: f.actor.z }, targets: f.targets, hud: mod.getSkillHud(f.state, { health: 50, skillMods }), modifiers: mod.getSkillModifiers(f.state) });
    };
    let compared = 0;
    for (const classId of ['warrior', 'dwarf']) for (const slot of [0, 1, 2]) {
      const expected = scene(B, classId, slot, undefined);
      for (const neutral of [undefined, null, K.NEUTRAL_SKILL_MODS, { ...K.NEUTRAL_SKILL_MODS }, mods({}, classId), mods({ damage: 6, area: 5, ironBlood: 3 }, classId)]) { const actual = scene(K, classId, slot, neutral); let at = 0; while (at < expected.length && actual[at] === expected[at]) at++;
        assert.ok(actual === expected, `${classId}:${slot} differs at ${at}: …${actual.slice(Math.max(0, at - 90), at + 90)}… vs …${expected.slice(Math.max(0, at - 90), at + 90)}…`); compared++; }
    }
    const roundTrip = B.skillSnapshot(B.restoreSkillSnapshot(JSON.parse(JSON.stringify(K.skillSnapshot(K.createSkillState('warrior'))))));
    assert.deepEqual(K.skillSnapshot(K.restoreSkillSnapshot(roundTrip)), roundTrip);
    report.metrics.baselineScenes = compared;
  });

  check('Cards: 18 definitions, 2-3 per skill + 4 resource/cooldown cards, rare+ only, values inside the simulation clamps, natural class filter', () => {
    assert.equal(U.SKILL_UPGRADES.length, 18); assert.equal(new Set(U.SKILL_UPGRADES.map(c => c.id)).size, 18);
    for (const skill of K.CLASS_SKILLS) { const count = U.SKILL_UPGRADES.filter(c => c.skillId === skill.id).length; assert.ok(count >= 2 && count <= 3, `${skill.id}: ${count}`); }
    assert.deepEqual(U.SKILL_UPGRADES.filter(c => !c.skillId).map(c => c.mod), ['resourceMax', 'resourceRegen', 'costMultiplier', 'cooldownMultiplier']);
    for (const card of U.SKILL_UPGRADES) {
      assert.ok(['rare', 'epic', 'legendary'].includes(card.rarity)); assert.equal(card.kind, 'skill'); assert.equal(card.values.length, card.maxStacks + 1); assert.ok(Object.isFrozen(card));
      const [min, max, neutral] = K.SKILL_MOD_LIMITS[card.mod]; assert.equal(card.values[0], neutral); for (const value of card.values) assert.ok(value >= min && value <= max);
      assert.ok(!U.describeSkillUpgrade(card, 'warrior').includes('{') && U.describeSkillUpgrade(card, 'dwarf').length <= 130, card.id);
      assert.match(U.getSkillUpgradeTag(card, 'dwarf'), card.skillId ? /^Habilidade [123] · / : /^Lyra · Foco$/);
      assert.ok(['war-cry', 'cleaving-dash', 'shield-charge', 'explosive-cannon', 'frost-shot', 'gravity-shot', 'blade', 'rifle'].includes(U.getSkillUpgradeIcon(card, 'warrior')));
    }
    assert.equal(U.describeSkillUpgrade(U.getSkillUpgrade('resourceMax'), 'warrior'), '+15 de Fervor máximo por nível.'); assert.equal(U.describeSkillUpgrade(U.getSkillUpgrade('resourceMax'), 'dwarf'), '+15 de Foco máximo por nível.');
    assert.ok(U.getClassSkillUpgrades('warrior').every(c => c.classId !== 'dwarf') && U.getClassSkillUpgrades('dwarf').every(c => c.classId !== 'warrior'));
    assert.equal(U.getClassSkillUpgrades('warrior').length, 12); assert.equal(U.getClassSkillUpgrades('dwarf').length, 10);
    report.metrics.cards = U.SKILL_UPGRADES.map(c => ({ id: c.id, label: c.label, rarity: c.rarity, stacks: c.maxStacks, classId: c.classId, skillId: c.skillId, minLevel: c.minLevel, mod: c.mod, values: c.values }));
  });

  check('getSkillMods: pure, frozen, class-filtered, stack-clamped; hostile stacks and non-numbers never escape the limits', () => {
    assert.equal(mods({}, 'warrior'), K.NEUTRAL_SKILL_MODS); assert.equal(mods(null, 'dwarf'), K.NEUTRAL_SKILL_MODS); assert.ok(Object.isFrozen(K.NEUTRAL_SKILL_MODS));
    const all = Object.fromEntries(U.SKILL_UPGRADES.map(c => [c.id, c.maxStacks]));
    for (const classId of ['warrior', 'dwarf']) { const full = mods({ ...all, cadence: 5 }, classId); assert.ok(Object.isFrozen(full)); assert.deepEqual(K.sanitizeSkillMods(full), full);
      const foreign = classId === 'warrior' ? ['cannonDamage', 'cannonNapalm', 'frostShatter', 'frostHop', 'gravityDuration', 'gravityCollapse'] : ['warCryDuration', 'warCryKillHeal', 'warCryShockwave', 'dashKillFervor', 'dashRange', 'dashDamage', 'dashMultiKill', 'chargeBastion', 'chargeShockwave'];
      for (const key of foreign) assert.equal(full[key], K.NEUTRAL_SKILL_MODS[key], `${classId}.${key}`);
      near(full.cooldownMultiplier, .7 * .85); near(full.costMultiplier, .76); assert.equal(full.resourceMax, 145); near(full.resourceRegen, 1.6); }
    const hostile = mods({ dashReach: 1e9, warCryDuration: Infinity, warCryBloodlust: NaN, dashFervor: '3', chargeBastion: -4, skillHaste: 2.9, cadence: 1e6, resourceMax: {} }, 'warrior');
    assert.equal(hostile.dashRange, 3); near(hostile.dashDamage, 1.6); assert.equal(hostile.warCryDuration, 0); assert.equal(hostile.warCryKillHeal, 0); assert.equal(hostile.dashKillFervor, 0); assert.equal(hostile.chargeBastion, 0); assert.equal(hostile.resourceMax, 100); near(hostile.cooldownMultiplier, .8 * .85);
    for (const bad of [NaN, Infinity, -Infinity, 1e12, -1e12, '9', null, {}, [], true]) { const clean = K.sanitizeSkillMods(Object.fromEntries(Object.keys(K.SKILL_MOD_LIMITS).map(key => [key, bad])));
      for (const [key, [min, max, neutral]] of Object.entries(K.SKILL_MOD_LIMITS)) assert.ok(clean[key] === neutral || (clean[key] >= min && clean[key] <= max), `${key}=${String(bad)}`); }
    for (const junk of ['x', 7, [], () => 1]) assert.deepEqual(K.sanitizeSkillMods(junk), K.NEUTRAL_SKILL_MODS);
  });

  check('Resource cards: cap 100→145, regeneration +20%/stack, cost −12%/stack and cooldown −10%/stack (× −3% per +Cadência) reach beginSkill and the HUD', () => {
    for (const [classId, regeneration] of [['warrior', 8], ['dwarf', 9]]) {
      const m = mods({ resourceMax: 3, resourceRegen: 2, skillThrift: 2, skillHaste: 3, cadence: 5 }, classId), f = fixture(K, classId, { skillMods: m });
      f.state.resource = 0; f.tick(1); near(f.state.resource, regeneration * 1.4, 1e-6); f.tick(30); assert.equal(f.state.resource, 145);
      const plain = fixture(K, classId); plain.state.resource = 0; plain.tick(1); near(plain.state.resource, regeneration); plain.tick(30); assert.equal(plain.state.resource, 100);
      for (const def of K.getClassSkills(classId)) { const g = fixture(K, classId, { skillMods: m }); assert.ok(g.cast(def.slot).ok);
        assert.equal(g.state.resource, 100 - Math.round(def.cost * .76)); near(g.state.cooldowns[def.slot], def.cooldown * .7 * .85, .0051); assert.equal(g.state.cooldowns[def.slot], K.getSkillCooldown(def, m));
        const hud = K.getSkillHud(K.createSkillState(classId), { skillMods: m }).skills[def.slot]; assert.equal(hud.cost, Math.round(def.cost * .76)); assert.equal(hud.cooldownDuration, g.state.cooldowns[def.slot]); }
      assert.equal(K.getSkillHud(f.state, { skillMods: m }).maxResource, 145); assert.equal(K.getSkillHud(f.state, {}).maxResource, 100);
      const poor = fixture(K, classId, { skillMods: m }); poor.state.resource = Math.round(K.getClassSkills(classId)[2].cost * .76); assert.ok(K.getSkillHud(poor.state, { skillMods: m }).skills[2].enabled); assert.ok(!K.getSkillHud(poor.state, {}).skills[2].enabled); assert.ok(poor.cast(2).ok);
      const cadenceOnly = mods({ cadence: 5 }, classId); near(cadenceOnly.cooldownMultiplier, .85); assert.equal(cadenceOnly.costMultiplier, 1);
    }
  });

  check('Grito de Guerra: Brado Prolongado +2 s/stack; Sede de Sangue heals 3/stack per kill only while the buff lasts (boss ×3); Brado Trovejante hurts, stuns and pushes 3 m', () => {
    for (const n of [1, 2, 3]) { const f = fixture(K, 'warrior', { skillMods: mods({ warCryDuration: n }, 'warrior') }); f.cast(0); f.tick(.4); near(f.state.buff.duration, 8 + 2 * n); assert.ok(f.state.buff.remaining > 7.9 + 2 * n);
      f.tick(7.7 + 2 * n); assert.deepEqual(K.getSkillModifiers(f.state), { damage: 1.35, speed: 1.15 }); f.tick(.4); assert.deepEqual(K.getSkillModifiers(f.state), { damage: 1, speed: 1 });
      assert.match(K.getSkillHud(f.state, { skillMods: mods({ warCryDuration: n }, 'warrior') }).skills[0].description, new RegExp(`^Por ${8 + 2 * n} s:`)); }
    const blood = fixture(K, 'warrior', { skillMods: mods({ warCryBloodlust: 2 }, 'warrior') }); assert.equal(K.creditSkillKill(blood.state).heal, 0); blood.cast(0); blood.tick(.3); assert.equal(K.creditSkillKill(blood.state).heal, 0);
    blood.tick(.2); assert.equal(K.creditSkillKill(blood.state).heal, 6); assert.equal(K.creditSkillKill(blood.state, { boss: true }).heal, 18); blood.tick(8); assert.equal(K.creditSkillKill(blood.state).heal, 0);
    const dry = fixture(K, 'warrior'); dry.cast(0); dry.tick(.5); assert.equal(K.creditSkillKill(dry.state).heal, 0); assert.equal(K.creditSkillKill(null).heal, 0);
    const ring = [target('near', 2, 0), target('edge', 0, 4.4), target('boss', -3, 0, { boss: true }), target('far', 6, 0), target('weak', 0, -2, { health: 5 })];
    const f = fixture(K, 'warrior', { skillMods: mods({ warCryShockwave: 1 }, 'warrior'), targets: ring }); f.cast(0); f.tick(.37); assert.equal(f.hits.length, 0); f.tick(.6);
    assert.deepEqual(f.hits.map(h => h.id).sort(), ['boss', 'edge', 'near', 'weak']); for (const h of f.hits) { assert.equal(h.damage, 12); assert.equal(h.mod, 'warCryShockwave'); assert.equal(h.stun, h.id === 'boss' ? .65 : 1.2); }
    near(ring[0].x, 5, 1e-6); near(ring[1].z, 7.4, 1e-6); near(ring[2].x, -3 - 3 * .35, 1e-6); assert.equal(ring[3].x, 6); assert.ok(ring[4].dead && ring[4].z === -2);
    const burst = f.events.filter(e => e.mod === 'warCryShockwave' && e.phase === 'impact'); assert.equal(burst.length, 1); assert.equal(burst[0].radius, 4.5); assert.equal(burst[0].victims, 4);
    assert.ok(f.events.filter(e => e.status === 'stun').every(e => e.mod === 'warCryShockwave')); assert.equal(f.events.filter(e => e.status === 'buff' && e.phase === 'status' && !e.mod).length > 0, true); assert.equal(f.state.active.length, 0);
    const still = fixture(K, 'warrior', { skillMods: mods({ warCryShockwave: 1 }, 'warrior'), targets: [target(1, 2, 0)], mover: false }); still.cast(0); still.tick(1); assert.equal(still.targets[0].x, 2); assert.equal(still.hits.length, 1);
    const walled = fixture(K, 'warrior', { skillMods: mods({ warCryShockwave: 1 }, 'warrior'), targets: [target(1, 3, 0)], colliders: [{ id: 'wall', shape: 'box', x: 1.6, z: 0, halfX: .1, halfZ: 6 }] }); walled.cast(0); walled.tick(1); assert.equal(walled.hits.length, 0);
    const base = fixture(K, 'warrior', { targets: [target(1, 2, 0)] }); base.cast(0); base.tick(1); assert.equal(base.hits.length, 0); assert.equal(base.targets[0].x, 2);
  });

  check('Corte Devastador: Ceifa Fervorosa refunds 4/stack per kill (40 cap), Avanço Implacável +1 m and +20% damage per stack, Ímpeto do Carrasco −35%/stack cooldown on 2+ kills', () => {
    const line = health => Array.from({ length: 12 }, (_, i) => target(i, 1 + i * .55, 0, { health }));
    for (const n of [1, 2, 3]) { const f = fixture(K, 'warrior', { skillMods: mods({ dashFervor: n }, 'warrior'), targets: line(1).slice(0, 3) }); f.state.resource = 28; f.cast(1); assert.equal(f.state.resource, 0); f.tick(1); assert.equal(f.targets.filter(t => t.dead).length, 3);
      near(f.state.resource, 4 * n * 3 + 8 * 1, 1e-6); }
    const capped = fixture(K, 'warrior', { skillMods: mods({ dashFervor: 3 }, 'warrior'), targets: line(1) }); capped.state.resource = 30; capped.cast(1); advanceTo(capped, .2); const before = capped.state.resource; capped.tick(.6); assert.equal(capped.targets.filter(t => t.dead).length, 12); near(capped.state.resource - before, 40 + 8 * .6, 1e-6);
    const spared = fixture(K, 'warrior', { skillMods: mods({ dashFervor: 3 }, 'warrior'), targets: line(1e6) }); spared.state.resource = 30; spared.cast(1); spared.tick(1); near(spared.state.resource, 2 + 8, .01);
    for (const n of [0, 1, 2, 3]) { const f = fixture(K, 'warrior', { skillMods: mods({ dashReach: n }, 'warrior'), targets: [target('in', 3, 0), target('reach', 10, 0), target('beyond', 13, 0)] }); const cast = f.cast(1); f.tick(1);
      near(f.actor.x, 8 + n, 1e-5); near(f.hits.find(h => h.id === 'in').damage, 28 * (1 + .2 * n), 1e-9); assert.equal(f.hits.some(h => h.id === 'reach'), n >= 1); assert.ok(!f.hits.some(h => h.id === 'beyond'));
      near(cast.event.target.x, 8 + n); assert.equal(f.events.filter(e => e.phase === 'travel').at(-1).terminal, true); assert.deepEqual(cast.event.mods ?? null, n ? { dashRange: n, dashDamage: 1 + .2 * n > 1.6 ? 1.6 : 1 + .2 * n } : null);
      if (n) assert.match(K.getSkillHud(f.state, { skillMods: mods({ dashReach: n }, 'warrior') }).skills[1].description, new RegExp(`^Avança até ${8 + n} m,`)); }
    const charge = fixture(K, 'warrior', { skillMods: mods({ dashReach: 3 }, 'warrior') }); charge.cast(2); charge.tick(1.2); near(charge.actor.x, 7, 1e-5);
    // The cut lands at the end of the dash (0.58 s after the cast) and trims what is left of the recharge.
    for (const [n, kills, expected] of [[1, 2, 5.42 * .65 + .58], [2, 3, 5.42 * .3 + .58], [2, 1, 6], [0, 5, 6]]) { const f = fixture(K, 'warrior', { skillMods: mods({ dashMomentum: n }, 'warrior'), targets: Array.from({ length: 5 }, (_, i) => target(i, 1.5 + i, 0, { health: i < kills ? 1 : 1e6 })) }); f.cast(1); f.tick(.6);
      near(f.state.cooldowns[1], expected - .6, .03); assert.equal(f.events.filter(e => e.mod === 'dashMultiKill').length, n && kills >= 2 ? 1 : 0); }
  });

  check('Investida de Escudo: Bastião cuts incoming damage 25%/40% for 4 s after the charge, Impacto Sísmico bursts 3.5 m at the end without double-hitting the lane', () => {
    for (const [n, reduction] of [[1, .25], [2, .4]]) { const f = fixture(K, 'warrior', { skillMods: mods({ chargeBastion: n }, 'warrior') }); assert.equal(K.getSkillDamageTaken(f.state), 1); f.cast(2); f.tick(.5); assert.equal(K.getSkillDamageTaken(f.state), 1);
      f.tick(.6); near(K.getSkillDamageTaken(f.state), 1 - reduction); const hud = K.getSkillHud(f.state, {}); const status = hud.statuses.find(s => s.status === 'guard'); assert.equal(status.label, 'Bastião'); assert.equal(status.skillId, 'warrior_shield_charge'); assert.match(status.description, new RegExp(`−${reduction * 100}%`));
      const snap = K.skillSnapshot(f.state); assert.deepEqual(K.skillSnapshot(K.restoreSkillSnapshot(JSON.parse(JSON.stringify(snap)))), snap);
      f.tick(3.9); assert.equal(K.getSkillDamageTaken(f.state), 1); assert.equal(K.skillSnapshot(f.state).guard, undefined); }
    const dead = fixture(K, 'warrior', { skillMods: mods({ chargeBastion: 2 }, 'warrior') }); dead.cast(2); dead.tick(1.2); assert.ok(K.getSkillDamageTaken(dead.state) < 1); K.advanceSkills(dead.state, .02, { ...dead.options, dead: true }); assert.equal(K.getSkillDamageTaken(dead.state), 1);
    const none = fixture(K, 'warrior'); none.cast(2); none.tick(1.2); assert.equal(K.getSkillDamageTaken(none.state), 1); assert.equal(K.getSkillDamageTaken(null), 1);
    const crowd = [target('lane', 3, 0), target('side', 7, 3), target('behind', 9.5, -1, { boss: true }), target('far', 7, 5.2)];
    const f = fixture(K, 'warrior', { skillMods: mods({ chargeShockwave: 1 }, 'warrior'), targets: crowd }); f.cast(2); f.tick(1.2);
    assert.deepEqual(f.hits.map(h => h.id), ['lane', 'side', 'behind']); assert.equal(f.hits[0].damage, 1.2 * 2); assert.equal(f.hits[0].mod, undefined); for (const h of f.hits.slice(1)) { assert.equal(h.damage, 16); assert.equal(h.mod, 'chargeShockwave'); }
    assert.equal(f.hits[1].stun, 2.2); assert.equal(f.hits[2].stun, .65); const burst = f.events.find(e => e.mod === 'chargeShockwave' && e.phase === 'impact'); near(burst.target.x, 7, 1e-5); assert.equal(burst.radius, 3.5); assert.equal(burst.victims, 2);
    const order = f.events.map(e => e.phase + (e.mod ? ':' + e.mod : '')); assert.ok(order.lastIndexOf('impact:chargeShockwave') < order.lastIndexOf('end'));
    const plain = fixture(K, 'warrior', { targets: [target('lane', 3, 0), target('side', 7, 3)] }); plain.cast(2); plain.tick(1.2); assert.deepEqual(plain.hits.map(h => h.id), ['lane']);
  });

  check('Canhão Infernal: Pólvora Negra +25%/stack; Napalm Rúnico burns the blast area for 4 s in whole 0.5 s intervals (tick-rate independent, walls block, leaving stops it)', () => {
    for (const n of [0, 1, 2, 3]) { const f = fixture(K, 'dwarf', { skillMods: mods({ cannonPowder: n }, 'dwarf'), targets: [target(1, 6, 0), target(2, 7, 2)] }); f.cast(0); f.tick(1.5); assert.equal(f.hits.length, 2); for (const h of f.hits) near(h.damage, 28 * (1 + .25 * n), 1e-9); }
    const totals = {};
    for (const n of [1, 2]) for (const dt of [.02, .05, .1]) { const victims = [target('core', 6, 0), target('rim', 6, 3.6), target('out', 6, 4.2)]; const f = fixture(K, 'dwarf', { skillMods: mods({ cannonNapalm: n }, 'dwarf'), targets: victims }); f.cast(0); f.tick(7, dt);
      const burns = f.hits.filter(h => h.mod === 'cannonNapalm'); assert.equal(burns.filter(h => h.id === 'core').length, 8); assert.equal(burns.filter(h => h.id === 'rim').length, 8); assert.equal(burns.filter(h => h.id === 'out').length, 0);
      for (const h of burns) { assert.equal(h.damage, 2 * n * 2); assert.equal(h.skillId, 'dwarf_explosive_cannon'); assert.equal(h.status, null); }
      totals[`${n}@${dt}`] = burns.reduce((sum, h) => sum + h.damage, 0); assert.equal(f.state.fields.length, 0);
      const statuses = f.events.filter(e => e.status === 'napalm'); assert.ok(statuses.length > 5 && statuses.every(e => e.mod === 'cannonNapalm' && e.radius === 3.4)); assert.equal(statuses.at(-1).phase, 'end'); }
    assert.equal(totals['1@0.02'], totals['1@0.1']); assert.equal(totals['2@0.02'], totals['2@0.05']); assert.equal(totals['2@0.02'], 2 * totals['1@0.02']); report.metrics.napalmTotals = totals;
    const leaver = fixture(K, 'dwarf', { skillMods: mods({ cannonNapalm: 1 }, 'dwarf'), targets: [target('core', 6, 0)] }); leaver.cast(0); leaver.tick(1.8); const early = leaver.hits.filter(h => h.mod).length; assert.ok(early >= 2); leaver.targets[0].x = 30; leaver.tick(4); assert.equal(leaver.hits.filter(h => h.mod).length, early);
    const wall = fixture(K, 'dwarf', { skillMods: mods({ cannonNapalm: 2 }, 'dwarf'), targets: [target('block', 6, 0), target('hidden', 8.2, 0)], colliders: [{ id: 'wall', shape: 'box', x: 7.2, z: 0, halfX: .1, halfZ: 6 }] }); wall.cast(0); wall.tick(6); assert.ok(wall.hits.some(h => h.id === 'block' && h.mod)); assert.ok(!wall.hits.some(h => h.id === 'hidden'));
    const area = fixture(K, 'dwarf', { skillMods: mods({ cannonNapalm: 1 }, 'dwarf'), actor: { areaMultiplier: 1.65 }, targets: [target(1, 6, 0)] }); area.cast(0); area.tick(1); assert.equal(area.state.fields[0].radius, K.getSkillRadius(K.getClassSkill('dwarf_explosive_cannon'), 1.65));
    const gone = fixture(K, 'dwarf', { skillMods: mods({ cannonNapalm: 1 }, 'dwarf'), targets: [target(1, 6, 0)] }); gone.cast(0); gone.tick(1); assert.equal(gone.state.fields.length, 1); K.advanceSkills(gone.state, .02, { ...gone.options, dead: true }); assert.equal(gone.state.fields.length, 0); assert.equal(gone.events.at(-1).reason, 'death');
  });

  check('Disparo Glacial: Estilhaçar +35%/stack against already frozen victims (never the first freeze itself); Recuo Tático hops 4 m back before the shot, collided, with authoritative positions', () => {
    for (const n of [1, 2]) { const m = mods({ frostShatter: n }, 'dwarf'), victim = target(1, 6, 0), fresh = target(2, 6, 1.5);
      const f = fixture(K, 'dwarf', { skillMods: m, targets: [victim, fresh] }); f.cast(1); f.tick(1); assert.ok(f.hits.every(h => h.damage === .8 * 2 && !h.shattered)); assert.ok(victim.freezeTimer > 0);
      fresh.freezeTimer = 0; f.cast(0); f.tick(1.5); const cannon = f.hits.filter(h => h.skillId === 'dwarf_explosive_cannon'); near(cannon.find(h => h.id === 1).damage, 28 * (1 + .35 * n)); assert.ok(cannon.find(h => h.id === 1).shattered); assert.equal(cannon.find(h => h.id === 2).damage, 28); assert.ok(!cannon.find(h => h.id === 2).shattered);
      const g = fixture(K, 'dwarf', { skillMods: mods({ frostShatter: n, gravityCollapse: 1, gravityDuration: 0 }, 'dwarf'), targets: [target(1, 6, 0, { freezeTimer: 99 }), target(2, 6, 2)] }); g.cast(2); g.tick(7); const collapse = g.hits.filter(h => h.mod === 'gravityCollapse'); near(collapse.find(h => h.id === 1).damage, 32 * (1 + .35 * n)); assert.equal(collapse.find(h => h.id === 2).damage, 32); }
    const f = fixture(K, 'dwarf', { skillMods: mods({ frostHop: 1 }, 'dwarf'), targets: [target(1, 9, 0)] }); const cast = f.cast(1); assert.deepEqual(cast.event.mods, { frostHop: 4 }); K.advanceSkills(f.state, .02, f.options); assert.ok(K.isSkillMoving(f.state)); assert.ok(f.actor.x < 0);
    f.tick(.26); near(f.actor.x, -4, 1e-6); assert.ok(!K.isSkillMoving(f.state)); const hops = f.events.filter(e => e.mod === 'frostHop'); assert.ok(hops.length >= 3 && hops.every(e => e.phase === 'travel' && Number.isFinite(e.actorPosition.x))); assert.equal(hops.at(-1).terminal, true); near(hops.at(-1).actorPosition.x, -4, 1e-6); assert.equal(hops.filter(e => e.terminal).length, 1);
    f.tick(1); near(f.events.find(e => e.phase === 'release').origin.x, -4, 1e-6); assert.equal(f.hits.length, 1); assert.equal(f.actor.z, 0);
    for (const dt of [.1, .05, 1 / 60]) { const g = fixture(K, 'dwarf', { skillMods: mods({ frostHop: 1 }, 'dwarf'), aim: { aimX: 0, aimZ: -1 } }); g.cast(1); g.tick(.7, dt); near(g.actor.z, 4, 1e-6); near(g.events.find(e => e.phase === 'release').origin.z, 4, 1e-6); }
    const wall = fixture(K, 'dwarf', { skillMods: mods({ frostHop: 1 }, 'dwarf'), colliders: [{ id: 'wall', shape: 'box', x: -2, z: 0, halfX: .1, halfZ: 6 }] }); wall.cast(1); wall.tick(.7); assert.ok(wall.actor.x > -1.27 && wall.actor.x < 0, String(wall.actor.x)); assert.ok(!K.isSkillMoving(wall.state));
    const other = fixture(K, 'dwarf', { skillMods: mods({ frostHop: 1 }, 'dwarf') }); other.cast(0); other.tick(1); assert.equal(other.actor.x, 0); const plain = fixture(K, 'dwarf'); plain.cast(1); plain.tick(1); assert.equal(plain.actor.x, 0);
    const snap = (() => { const h = fixture(K, 'dwarf', { skillMods: mods({ frostHop: 1 }, 'dwarf') }); h.cast(1); K.advanceSkills(h.state, .05, h.options); return K.skillSnapshot(h.state); })(); assert.equal(snap.movement.hop, true); assert.ok(K.isSkillMoving(K.restoreSkillSnapshot(JSON.parse(JSON.stringify(snap)))));
  });

  check('Núcleo Gravitacional: Horizonte de Eventos +1.5 s/stack; Colapso do Núcleo implodes for 16×dano only on natural expiry', () => {
    for (const n of [0, 1, 2, 3]) { const f = fixture(K, 'dwarf', { skillMods: mods({ gravityDuration: n }, 'dwarf'), targets: [target(1, 6, 0)] }); f.cast(2); f.tick(.8); near(f.state.fields[0].duration, 5 + 1.5 * n); f.tick(4.7 + 1.5 * n); assert.equal(f.state.fields.length, 1); f.tick(.3); assert.equal(f.state.fields.length, 0);
      const ends = f.events.filter(e => e.status === 'gravity' && e.phase === 'end'); assert.equal(ends.length, 1); near(ends[0].duration, 5 + 1.5 * n); if (n) assert.match(K.getSkillHud(f.state, { skillMods: mods({ gravityDuration: n }, 'dwarf') }).skills[2].description, new RegExp(`por ${String(5 + 1.5 * n).replace('.', ',')} s:`)); }
    const f = fixture(K, 'dwarf', { skillMods: mods({ gravityCollapse: 1 }, 'dwarf'), targets: [target('in', 6, 0), target('edge', 6, 5.2), target('out', 6, 9)], mover: false }); f.cast(2); f.tick(5.5); assert.equal(f.hits.filter(h => h.mod).length, 0); f.tick(.5);
    const collapse = f.hits.filter(h => h.mod === 'gravityCollapse'); assert.deepEqual(collapse.map(h => h.id).sort(), ['edge', 'in']); for (const h of collapse) { assert.equal(h.damage, 32); assert.equal(h.skillId, 'dwarf_gravity_shot'); }
    const events = f.events.map(e => `${e.phase}:${e.status || ''}:${e.mod || ''}`); assert.ok(events.indexOf('impact:gravity:gravityCollapse') > 0 && events.indexOf('impact:gravity:gravityCollapse') < events.lastIndexOf('end:gravity:'));
    const buffed = fixture(K, 'dwarf', { skillMods: mods({ gravityCollapse: 1 }, 'dwarf'), actor: { damageMultiplier: 3.5 }, targets: [target(1, 6, 0)], mover: false }); buffed.cast(2); buffed.actor.damageMultiplier = 99; buffed.tick(6.2); near(buffed.hits.find(h => h.mod).damage, 16 * 3.5);
    const cancelled = fixture(K, 'dwarf', { skillMods: mods({ gravityCollapse: 1 }, 'dwarf'), targets: [target(1, 6, 0)] }); cancelled.cast(2); cancelled.tick(2); K.cancelSkills(cancelled.state, e => cancelled.events.push(e), 'disconnect'); assert.equal(cancelled.hits.filter(h => h.mod).length, 0);
    const plain = fixture(K, 'dwarf', { targets: [target(1, 6, 0)] }); plain.cast(2); plain.tick(7); assert.equal(plain.hits.filter(h => h.mod).length, 0);
  });

  check('Trust: mods freeze at cast, the intent is never read, hostile actor values clamp, other-class keys do nothing', () => {
    const live = { ...mods({ dashReach: 1 }, 'warrior') }, f = fixture(K, 'warrior', { actor: { skillMods: live }, targets: [target(1, 3, 0)] }); f.cast(1); Object.assign(live, { dashRange: 3, dashDamage: 1.6 }); f.actor.skillMods = mods({ dashReach: 3 }, 'warrior'); f.tick(1); near(f.actor.x, 9, 1e-5); near(f.hits[0].damage, 28 * 1.2);
    const intent = fixture(K, 'warrior', { targets: [target(1, 3, 0)] }); const result = intent.cast(1, { skillMods: mods({ dashReach: 3 }, 'warrior'), mods: { dashRange: 3 }, dashRange: 3, range: 40, cost: 0, cooldown: 0, damage: 999, upgradeStacks: { dashReach: 3 } }); assert.ok(result.ok); assert.equal(result.event.mods, undefined); intent.tick(1); near(intent.actor.x, 8, 1e-5); assert.equal(intent.hits[0].damage, 28); assert.equal(intent.state.resource > 71 && intent.state.resource < 81, true); assert.ok(intent.state.cooldowns[1] > 4.9);
    const huge = Object.fromEntries(Object.keys(K.SKILL_MOD_LIMITS).map(key => [key, 1e9])), tiny = Object.fromEntries(Object.keys(K.SKILL_MOD_LIMITS).map(key => [key, -1e9]));
    const big = fixture(K, 'warrior', { skillMods: huge, targets: [target(1, 3, 0)] }); const bigCast = big.cast(1); big.tick(1); near(big.actor.x, 11, 1e-5); near(big.hits[0].damage, 28 * 1.6); assert.equal(big.state.resource <= 145, true); assert.deepEqual(bigCast.event.mods, { dashKillFervor: 12, dashRange: 3, dashDamage: 1.6, dashMultiKill: .7 });
    const small = fixture(K, 'warrior', { skillMods: tiny, targets: [target(1, 3, 0)] }); const smallCast = small.cast(1); small.tick(1); near(small.actor.x, 8, 1e-5); assert.equal(small.hits[0].damage, 28); assert.equal(smallCast.event.mods, undefined); near(small.state.cooldowns[1], 6 * .55 - 1, .021); assert.equal(K.getSkillCost(K.getClassSkill('warrior_cleaving_dash'), tiny), 20);
    for (const bad of [NaN, Infinity, '3', null, {}, []]) { const g = fixture(K, 'warrior', { skillMods: { dashRange: bad, dashDamage: bad, costMultiplier: bad, cooldownMultiplier: bad }, targets: [target(1, 3, 0)] }); g.cast(1); g.tick(1); assert.ok(g.actor.x === 8 || Math.abs(g.actor.x - 8) < 1e-5 || Math.abs(g.actor.x - 11) < 1e-5, String(bad)); assert.ok(g.hits[0].damage <= 28 * 1.6 + 1e-9); assert.ok(g.state.cooldowns[1] >= 6 * .55 - 1.01); }
    const cross = fixture(K, 'dwarf', { skillMods: mods({ dashReach: 3, chargeBastion: 2, warCryShockwave: 1, warCryDuration: 3 }, 'warrior'), targets: [target(1, 6, 0)] }); const crossCast = cross.cast(0); cross.tick(1.5); assert.equal(crossCast.event.mods, undefined); assert.equal(cross.hits[0].damage, 28); assert.equal(K.getSkillDamageTaken(cross.state), 1);
  });

  check('Snapshots: modded casts, buff, guard and fields survive a JSON round-trip; hostile snapshots are re-derived and clamped, legacy snapshots restore unchanged', () => {
    const f = fixture(K, 'warrior', { skillMods: mods({ dashReach: 2, dashFervor: 1, warCryDuration: 2, warCryBloodlust: 1 }, 'warrior'), targets: [target(1, 30, 0)] }); f.cast(0); f.tick(.9); f.cast(1); f.tick(.3);
    const snap = K.skillSnapshot(f.state); assert.deepEqual(snap.active[0].mods, { dashKillFervor: 4, dashRange: 2, dashDamage: 1.4 }); assert.equal(snap.buff.killHeal, 3); near(snap.buff.duration, 12);
    const wire = JSON.parse(JSON.stringify(snap)); assert.deepEqual(K.skillSnapshot(K.restoreSkillSnapshot(wire)), snap);
    const hostile = K.restoreSkillSnapshot({ classId: 'warrior', resource: 1e9, buff: { skillId: 'warrior_war_cry', remaining: 999, duration: 999, killHeal: 999, origin: { x: 0, y: 0, z: 0 } }, guard: { remaining: 99, reduction: 5, castId: 7 },
      active: [{ skillId: 'warrior_cleaving_dash', castId: 'x', distance: 500, mods: { dashRange: 500, dashDamage: 99, dashKillFervor: -3, dashMultiKill: NaN, cannonNapalm: 2, invented: 1 } }],
      fields: [{ skillId: 'dwarf_explosive_cannon', status: 'napalm', remaining: 99, duration: 99, level: 99, tick: -5, radius: 500, areaMultiplier: 77, damageMultiplier: 1e9, shatter: 9, x: 1, z: 2 }, { skillId: 'dwarf_gravity_shot', remaining: 99, duration: 99, radius: 500, collapse: 7, damageMultiplier: -2, x: 3, z: 4 }, { skillId: 'dwarf_explosive_cannon', remaining: 3, x: 0, z: 0 }, null] });
    assert.equal(hostile.resource, 145); assert.equal(hostile.buff.remaining, 14); assert.equal(hostile.buff.duration, 14); assert.equal(hostile.buff.killHeal, 6); assert.equal(hostile.guard.remaining, 4); assert.equal(hostile.guard.reduction, .4); near(K.getSkillDamageTaken(hostile), .6);
    assert.deepEqual(hostile.active[0].mods, { dashRange: 3, dashDamage: 1.6 }); assert.equal(hostile.active[0].distance, 11); assert.equal(hostile.fields.length, 2);
    const [napalm, gravity] = hostile.fields; assert.equal(napalm.remaining, 4); assert.equal(napalm.duration, 4); assert.equal(napalm.level, 2); assert.equal(napalm.tick, 0); assert.equal(napalm.radius, K.getSkillRadius(K.getClassSkill('dwarf_explosive_cannon'), K.SKILL_AREA_LIMIT)); assert.equal(napalm.damageMultiplier, 100); assert.equal(napalm.shatter, .7);
    assert.equal(gravity.remaining, 9.5); assert.equal(gravity.duration, 9.5); assert.equal(gravity.collapse, 1); assert.equal(gravity.damageMultiplier, 1); assert.equal(gravity.radius, 5);
    const legacy = K.restoreSkillSnapshot({ classId: 'dwarf', fields: [{ skillId: 'dwarf_gravity_shot', remaining: 3, duration: 5, radius: 5, x: 1, z: 2 }] }); assert.deepEqual(legacy.fields[0], { skillId: 'dwarf_gravity_shot', remaining: 3, duration: 5, radius: 5, x: 1, z: 2, areaMultiplier: 1 });
    assert.equal(K.restoreSkillSnapshot({ classId: 'dwarf', guard: { remaining: 3, reduction: .4 } }).guard, undefined);
  });

  check('HUD: effective cost, cooldown, cap, radius and descriptions for every modded skill; the area multiplier and the mods compose', () => {
    const lyra = K.getSkillHud(K.createSkillState('dwarf'), { areaMultiplier: 1.65, skillMods: mods({ gravityDuration: 3, skillThrift: 1, skillHaste: 1, resourceMax: 1 }, 'dwarf') });
    assert.equal(lyra.skills[2].description, 'Campo fixo de 6,4 m por 9,5 s: atrai e impede caminhar, mas não atacar. Chefes sofrem 35% da atração.'); assert.equal(lyra.skills[2].cost, 33); assert.equal(lyra.skills[2].cooldownDuration, 10.8); assert.equal(lyra.maxResource, 115);
    const aldric = K.getSkillHud(K.createSkillState('warrior'), { skillMods: mods({ warCryDuration: 3, dashReach: 3 }, 'warrior') }); assert.equal(aldric.skills[0].description, 'Por 14 s: +35% de dano e +15% de movimento.'); assert.match(aldric.skills[1].description, /^Avança até 11 m,/); assert.equal(aldric.skills[2].description, K.getClassSkill('warrior_shield_charge').description);
    const owned = U.getOwnedSkillUpgrades({ dashReach: 2, skillHaste: 1, cannonPowder: 3, frostShatter: 1 }, 'warrior', 'warrior_cleaving_dash'); assert.deepEqual(owned.map(o => `${o.label} ${o.stacks}/${o.maxStacks}`), ['Avanço Implacável 2/3', 'Ritmo Implacável 1/3']);
    assert.deepEqual(U.getOwnedSkillUpgrades({ frostShatter: 1, gravityCollapse: 1 }, 'dwarf', 'dwarf_explosive_cannon').map(o => o.id), ['frostShatter']);
    report.metrics.hud = { lyra: lyra.skills.map(s => ({ id: s.id, cost: s.cost, cooldown: s.cooldownDuration, description: s.description })), aldric: aldric.skills.map(s => ({ id: s.id, cost: s.cost, cooldown: s.cooldownDuration, description: s.description })) };
  });

  const sources = ['src/combat/class-skills.mjs', 'src/progression/skill-upgrades.mjs', 'src/progression/authority.mjs'];
  report.sourceSha256 = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
  report.passed = true;
} catch (error) { report.failure = error.stack; process.exitCode = 1; console.error(error.stack); }
finally { fs.rmSync(baseDir, { recursive: true, force: true }); fs.mkdirSync(evidenceDir, { recursive: true }); fs.writeFileSync(path.join(evidenceDir, 'verify-skill-upgrades.json'), JSON.stringify(report, null, 1) + '\n'); }

function advanceTo(f, seconds) { f.tick(seconds); }
