// Pure CPU contract for src/combat/hero-power.mjs (no browser, no network): mitigation, hit-grace, leech cap,
// combo finisher, knockback, level power, pacing monotonicity and client/server numeric parity (same module).
// The survival cases at the end are a *model*: module rules + the monster numbers parsed from the sources.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../src/combat/hero-power.mjs';
import * as A from '../src/progression/authority.mjs';
import { CLASS_SKILLS, createSkillState, beginSkill } from '../src/combat/class-skills.mjs';
const checks = [];
function check(name, fn) { fn(); checks.push(name); console.log(name); }
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const main = fs.readFileSync('src/main.js', 'utf8'), server = fs.readFileSync('server.mjs', 'utf8'), authority = fs.readFileSync('src/progression/authority.mjs', 'utf8');
const W = H.HERO_PROFILES.warrior, D = H.HERO_PROFILES.dwarf;
const oldXp = level => 10 + level * 7 + Math.floor(level ** 1.35);
const oldInterval = (wave, t, floor) => Math.max(floor, .7 - Math.min(.66, wave * .043 + Math.max(0, wave - 10) * .017) - Math.min(.22, t * .0045));

check('Profiles: Aldric is the melee bruiser, Lyra stays squishier, tables are frozen', () => {
  assert.ok(W.maxHealth > D.maxHealth * 1.5 && W.mitigation >= .25 && W.mitigation <= .45 && D.mitigation < W.mitigation && D.mitigation >= 0);
  assert.equal(W.basic.shape, 'melee'); assert.equal(W.basic.weapon, 'katana');
  for (const key of ['speed', 'pierce', 'radius']) assert.equal(W.basic[key], undefined, 'Aldric must not gain projectile fields');
  assert.equal(D.basic.shape, 'ray'); assert.equal(D.leech, null); assert.equal(D.combo, null);
  assert.ok(Object.isFrozen(H.HERO_PROFILES) && Object.isFrozen(W.basic) && Object.isFrozen(W.combo.finisher.knockback));
  assert.throws(() => { 'use strict'; W.basic.damage = 99; });
  assert.equal(H.heroProfile('hacker'), D); assert.equal(H.heroMaxHealth('warrior'), W.maxHealth); assert.equal(H.createHeroCombatState('x').classId, 'dwarf');
  // Wider and longer than the previous cone (4.2 m, ±0.92 rad); old basic damage was 7 and 2.
  assert.ok(W.basic.range > 4.2 && W.basic.arc > .92 && W.basic.arc < Math.PI / 2 && W.basic.damage > 7 && D.basic.damage > 2);
});

check('Lyra breakpoint: one rifle shot kills the opening zombie for the whole gentle window, using the live monster tables', () => {
  const serverZombie = Number(server.match(/zombie: \{ health: ([\d.]+)/)[1]);
  const clientZombie = Number(main.match(/zombie: \{\s*label: "Zumbi",\s*health: ([\d.]+)/)[1]);
  assert.equal(serverZombie, clientZombie);
  for (const source of [main, server]) assert.match(source, /health: 1\.08 \+ wave \* 0\.12/); // the difficulty term modelled below
  const zombieHealth = (wave, t) => (serverZombie + Math.floor(t / 120)) * (1.08 + wave * .12 + Math.min(1.35, t / 210));
  const shot = H.rifleShot('dwarf').damage * H.HERO_BASE_DAMAGE_MULTIPLIER;
  assert.ok(2 * H.HERO_BASE_DAMAGE_MULTIPLIER < zombieHealth(1, 0), 'previous rifle needed two shots');
  for (let t = 0; t <= 45; t += 5) assert.ok(shot >= zombieHealth(1, t), `wave 1 at ${t}s needs a second shot`);
  assert.ok(shot * H.basicPower('dwarf', 4) >= zombieHealth(2, 45), 'level 4 Lyra still one-shots wave 2 at 0:45');
});

check('Mitigation: percent armor plus flat plate blunts small hits far more than heavy ones; invalid amounts never heal or hurt', () => {
  const w = H.createHeroCombatState('warrior'), d = H.createHeroCombatState('dwarf');
  near(H.resolveIncomingDamage(w, 100, { now: 1 }).damage, 100 * (1 - W.mitigation) - W.plate);
  near(H.resolveIncomingDamage(d, 100, { now: 1 }).damage, 100 * (1 - D.mitigation) - D.plate);
  const taken = amount => H.resolveIncomingDamage(H.createHeroCombatState('warrior'), amount, { now: 1 }).damage / amount;
  assert.ok(taken(14) < .45 && taken(60) > .6 && taken(14) < taken(30) && taken(30) < taken(60) && taken(60) < taken(120), 'horde hits are blunted, brutes/bosses still hurt');
  near(taken(3), H.INCOMING.minimumTaken); assert.ok(W.plate > 0 && W.plate <= 6 && D.plate === 0, 'plate never nullifies a hit and Lyra has none');
  for (const bad of [0, -5, NaN, undefined, null, '50']) assert.deepEqual(H.resolveIncomingDamage(H.createHeroCombatState('warrior'), bad, { now: 1, swarm: true }), { damage: 0, graced: false });
  assert.deepEqual(H.resolveIncomingDamage(H.createHeroCombatState('warrior'), 10, { now: NaN }), { damage: 0, graced: false });
});

check('Hit-grace: N touching zombies land one hit per window; heavy sources always land; a backwards clock grants nothing', () => {
  const s = H.createHeroCombatState('dwarf');
  let landed = 0; for (let i = 0; i < 30; i++) if (H.resolveIncomingDamage(s, 14, { now: 10, swarm: true }).damage > 0) landed++;
  assert.equal(landed, 1);
  assert.ok(H.resolveIncomingDamage(s, 14, { now: 10 + H.INCOMING.graceSeconds - .01, swarm: true }).graced);
  assert.ok(H.resolveIncomingDamage(s, 14, { now: 10 + H.INCOMING.graceSeconds, swarm: true }).damage > 0);
  // A full second of 60 Hz swarm contact is bounded by the window, not by the crowd size.
  const c = H.createHeroCombatState('warrior'); let hits = 0;
  for (let frame = 0; frame < 600; frame++) for (let z = 0; z < 12; z++) if (H.resolveIncomingDamage(c, 14, { now: 100 + frame / 60, swarm: true }).damage > 0) hits++;
  assert.ok(hits <= Math.ceil(10 / H.INCOMING.graceSeconds) + 1 && hits >= Math.floor(10 / H.INCOMING.graceSeconds) - 1, `swarm hits in 10s: ${hits}`);
  const h = H.createHeroCombatState('warrior');
  assert.ok(H.resolveIncomingDamage(h, 14, { now: 5, swarm: true }).damage > 0);
  assert.ok(H.resolveIncomingDamage(h, 50, { now: 5.01 }).damage > 0, 'brute/boss/projectile ignores grace');
  assert.ok(H.resolveIncomingDamage(h, 50, { now: 5.02, swarm: false }).damage > 0);
  assert.ok(H.resolveIncomingDamage(h, 14, { now: 5.03, swarm: true }).graced, 'a heavy hit refreshes the swarm window');
  assert.ok(H.resolveIncomingDamage(h, 14, { now: 1, swarm: true }).damage > 0, 'clock moved backwards: no stale invulnerability');
  assert.equal(H.isSwarmSource({ type: 'zombie' }), true); assert.equal(H.isSwarmSource(null), false);
  for (const heavy of [{ type: 'brute' }, { type: 'cowBrute' }, { type: 'zombie', eliteType: 'furious' }, { type: 'visor', boss: true }]) assert.equal(H.isSwarmSource(heavy), false);
});

check('Leech: per-hit and per-kill sustain with a sane rolling per-second cap, never overheals, Lyra has none', () => {
  const max = W.maxHealth, s = H.createHeroCombatState('warrior');
  near(H.resolveLeech(s, { hits: 1, now: 0, health: 100, maxHealth: max }), W.leech.perHit * max);
  near(H.resolveLeech(s, { kills: 1, now: .1, health: 100, maxHealth: max }), W.leech.perKill * max);
  let total = W.leech.perHit * max + W.leech.perKill * max;
  for (let i = 0; i < 50; i++) total += H.resolveLeech(s, { hits: 8, kills: 8, now: .2 + i * .01, health: 100, maxHealth: max });
  near(total, W.leech.capPerSecond * max, 1e-6);
  assert.ok(W.leech.capPerSecond * max <= 25 && W.leech.capPerSecond <= .08, 'cap must stay below a wave-6 zombie hit per second');
  assert.equal(H.resolveLeech(s, { hits: 8, now: .99, health: 100, maxHealth: max }), 0);
  assert.ok(H.resolveLeech(s, { hits: 1, now: 1.01, health: 100, maxHealth: max }) > 0, 'window rolls after one second');
  const full = H.createHeroCombatState('warrior');
  assert.equal(H.resolveLeech(full, { kills: 5, now: 0, health: max, maxHealth: max }), 0); assert.equal(full.leechWindowHealed, 0);
  near(H.resolveLeech(full, { kills: 5, now: .5, health: max - 2, maxHealth: max }), 2);
  assert.equal(H.resolveLeech(H.createHeroCombatState('warrior'), { kills: 5, now: 0, health: 0, maxHealth: max }), 0, 'the dead do not leech');
  assert.equal(H.resolveLeech(H.createHeroCombatState('dwarf'), { hits: 9, kills: 9, now: 0, health: 10, maxHealth: 200 }), 0);
  assert.equal(H.resolveLeech(H.createHeroCombatState('warrior'), { hits: -4, kills: -4, now: 0, health: 10, maxHealth: max }), 0);
});

check('Combo: 1, 2, heavy 360° finisher, reset after a pause; Lyra never combos', () => {
  const s = H.createHeroCombatState('warrior'), steps = [];
  for (let i = 0; i < 7; i++) steps.push(H.beginBasicAttack(s, i * .52));
  assert.deepEqual(steps.map(x => x.index), [1, 2, 3, 1, 2, 3, 1]); assert.deepEqual(steps.map(x => x.finisher), [false, false, true, false, false, true, false]);
  assert.equal(steps[0].damageMultiplier, 1); assert.ok(steps[2].damageMultiplier >= 1.8);
  assert.ok(steps[2].knockback.distance > steps[0].knockback.distance && steps[2].knockback.stagger > steps[0].knockback.stagger);
  const p = H.createHeroCombatState('warrior'); H.beginBasicAttack(p, 0); H.beginBasicAttack(p, .5);
  assert.equal(H.beginBasicAttack(p, .5 + W.combo.resetSeconds + .01).index, 1, 'pause resets the chain');
  const b = H.createHeroCombatState('warrior'); H.beginBasicAttack(b, 50); assert.equal(H.beginBasicAttack(b, 10).index, 1, 'backwards clock resets');
  const preview = H.createHeroCombatState('warrior'); H.beginBasicAttack(preview, 0); H.beginBasicAttack(preview, .5);
  assert.ok(H.beginBasicAttack({ ...preview }, 1).finisher); assert.equal(preview.combo, 2, 'a copied state previews without advancing');
  const l = H.createHeroCombatState('dwarf'); for (let i = 0; i < 5; i++) assert.deepEqual(H.beginBasicAttack(l, i * .3), { index: 1, finisher: false, damageMultiplier: 1, knockback: D.knockback });
  const front = { x: 0, z: -3, radius: .78 }, side = { x: 3.2, z: -1.6, radius: .78 }, behind = { x: 0, z: 3.5, radius: .78 }, hugging = { x: 0, z: 1.6, radius: .78 }, far = { x: 0, z: -7, radius: .78 };
  const aim = { x: 0, z: -1 }, origin = { x: 0, z: 0 }, cleave = H.meleeShape('warrior'), spin = H.meleeShape('warrior', { finisher: true });
  assert.ok(H.insideMeleeShape(cleave, origin, aim, front) && H.insideMeleeShape(cleave, origin, aim, side) && H.insideMeleeShape(cleave, origin, aim, hugging));
  assert.ok(!H.insideMeleeShape(cleave, origin, aim, behind) && !H.insideMeleeShape(cleave, origin, aim, far));
  assert.ok(!H.insideMeleeShape({ range: 4.2, minDot: Math.cos(.92), pointBlank: 0 }, origin, aim, side), 'the previous cone missed this flank');
  for (const target of [front, side, behind, hugging]) assert.ok(H.insideMeleeShape(spin, origin, aim, target));
  assert.ok(!H.insideMeleeShape(spin, origin, aim, far)); assert.ok(spin.range > cleave.range);
  near(H.meleeShape('warrior', { areaMultiplier: 1.69 }).range, W.basic.range * 1.3); // literal area: reach grows with the square root
});

check('Rifle point-blank assist: a hugging body inside the frontal arc is never missed; far shots and bodies behind are untouched', () => {
  const shot = H.rifleShot('dwarf'), origin = { x: 0, z: 0 }, east = { x: 1, z: 0 }, body = (x, z, extra = {}) => ({ x, z, radius: .78, health: 5, ...extra });
  // Cursor on the chest of a zombie to the south-east: the ground-plane ray points east and used to fly past it.
  const hugging = body(1.2, 1.2), assisted = H.assistRifleAim(origin, east, [hugging], shot);
  near(assisted.x, Math.SQRT1_2); near(assisted.z, Math.SQRT1_2);
  assert.equal(H.assistRifleAim(origin, east, [body(1.7, .1)], shot), east, 'an aim that already hits is not touched');
  assert.equal(H.assistRifleAim(origin, east, [body(-1.5, .2)], shot), east, 'never turns around');
  assert.equal(H.assistRifleAim(origin, east, [body(4, 3)], shot), east, 'no magnetism beyond point-blank');
  assert.equal(H.assistRifleAim(origin, east, [body(1.2, 1.2, { health: 0 })], shot), east, 'the dead are ignored');
  const nearest = H.assistRifleAim(origin, east, [body(1.6, 1.6), body(1.1, -1.1)], shot); assert.ok(nearest.z < 0, 'nearest hugging body wins');
  assert.ok(shot.assistRange <= 2.5 && shot.assistMinDot >= Math.cos(1.2), 'assist stays a point-blank rule');
});

check('Knockback: swarm slides and staggers, heavies barely move, bosses and controlled bodies ignore it', () => {
  const total = (monster, dt = .02) => { let x = 0, guard = 0; while (monster.knockback && guard++ < 100) x += H.advanceHeroKnockback(monster, dt).dx; return x; };
  const zombie = { type: 'zombie' }; assert.ok(H.applyHeroKnockback(zombie, { x: 2, z: 0 }, W.knockback));
  near(zombie.staggerTimer, W.knockback.stagger); near(total(zombie), W.knockback.distance, 1e-9); assert.equal(zombie.knockback, null);
  const coarse = { type: 'zombie' }; H.applyHeroKnockback(coarse, { x: 1, z: 0 }, W.knockback); near(total(coarse, .05), W.knockback.distance, 1e-9); // 20 Hz server tick
  const huge = { type: 'zombie' }; H.applyHeroKnockback(huge, { x: 1, z: 0 }, W.knockback); assert.ok(H.advanceHeroKnockback(huge, 999).dx <= W.knockback.distance + 1e-9);
  // Slide and stagger run together: the stagger clock starts at the hit, not after the slide.
  const timed = { type: 'zombie' }; H.applyHeroKnockback(timed, { x: 0, z: 1 }, W.knockback);
  let t = 0; while (timed.staggerTimer > 0 && t < 5) { assert.ok(H.advanceHeroKnockback(timed, .02).staggered); t += .02; } near(t, W.knockback.stagger, .021);
  assert.equal(H.advanceHeroKnockback(timed, .02).staggered, false); assert.ok(zombie.staggerTimer < W.knockback.stagger);
  const brute = { type: 'brute' }; H.applyHeroKnockback(brute, { x: 1, z: 0 }, W.combo.finisher.knockback);
  assert.ok(total(brute) < W.combo.finisher.knockback.distance * .5); assert.ok(!(brute.staggerTimer > 0), 'brutes are never staggered');
  const elite = { type: 'zombie', eliteType: 'armored' }; H.applyHeroKnockback(elite, { x: 1, z: 0 }, W.knockback); assert.ok(!(elite.staggerTimer > 0));
  const boss = { type: 'visor', boss: true }; assert.equal(H.applyHeroKnockback(boss, { x: 1, z: 0 }, W.combo.finisher.knockback), false); assert.equal(boss.knockback, undefined);
  for (const controlled of [{ freezeTimer: 1 }, { stunTimer: 1 }, { pullTimer: .1 }]) assert.equal(H.applyHeroKnockback({ type: 'zombie', ...controlled }, { x: 1, z: 0 }, W.knockback), false);
  assert.equal(H.applyHeroKnockback({ type: 'zombie' }, { x: 0, z: 0 }, W.knockback), false); assert.equal(H.applyHeroKnockback({ type: 'zombie' }, { x: 1, z: 0 }, null), false);
  assert.ok(D.knockback.distance > 0 && D.knockback.distance < W.knockback.distance, 'rifle stopping power is modest');
});

check('Level power: trusted, monotonic, capped, and inside the beginSkill clamp', () => {
  for (const classId of ['warrior', 'dwarf']) {
    assert.equal(H.basicPower(classId, 1), 1); assert.equal(H.skillPower(classId, 1), 1);
    for (let level = 1; level < 120; level++) { assert.ok(H.basicPower(classId, level + 1) >= H.basicPower(classId, level)); assert.ok(H.skillPower(classId, level + 1) >= H.skillPower(classId, level)); }
    assert.equal(H.skillPower(classId, 9999), H.skillPower(classId, H.HERO_POWER_LEVEL_CAP));
    for (const bad of [NaN, -3, 0, undefined, null, 'x', Infinity]) { assert.ok(H.skillPower(classId, bad) >= 1 && H.skillPower(classId, bad) <= H.skillPower(classId, H.HERO_POWER_LEVEL_CAP)); assert.ok(H.basicPower(classId, bad) >= 1); }
    assert.ok(H.skillPower(classId, 12) >= 1.7 && H.skillPower(classId, 12) <= 2.2, 'wave-6 skills stay relevant without trivialising bosses');
    assert.ok(2.96 * 1.4 * 1.35 * H.skillPower(classId, 9999) < 100, 'max stacks × buffs × level stays inside beginSkill clamp');
  }
  const def = CLASS_SKILLS.find(skill => skill.id === 'dwarf_explosive_cannon'), state = createSkillState('dwarf');
  const cast = beginSkill(state, { slot: def.slot, aimX: 1, aimZ: 0 }, { x: 0, z: 0, playing: true, damageMultiplier: 2 * H.skillPower('dwarf', 10) });
  assert.ok(cast.ok); near(state.active[0].damageMultiplier, 2 * H.skillPower('dwarf', 10));
});

check('Pacing: early XP is faster then rejoins the old curve; spawn pressure is monotonic with a gentle first 25 s', () => {
  assert.equal(H.xpToNext(1), 9); // three opening zombies (3 XP each)
  for (let level = 1; level < 99; level++) { assert.ok(H.xpToNext(level + 1) > H.xpToNext(level)); assert.ok(H.xpToNext(level) <= oldXp(level)); }
  assert.ok(oldXp(20) - H.xpToNext(20) <= 1 && H.xpToNext(1) <= oldXp(1) * .5); assert.equal(H.xpToNext(-5), H.xpToNext(1)); assert.equal(H.xpToNext('x'), H.xpToNext(1));
  for (const floor of [.032, .05]) for (let wave = 1; wave <= 30; wave++) for (let t = 0; t <= 600; t += 5) {
    assert.ok(H.spawnInterval(wave, t + 5, floor) <= H.spawnInterval(wave, t, floor) + 1e-12, 'interval must not grow with time');
    assert.ok(H.spawnInterval(wave + 1, t, floor) <= H.spawnInterval(wave, t, floor) + 1e-12, 'interval must not grow with wave');
    if (t >= H.PACING.openingSeconds) near(H.spawnInterval(wave, t, floor), oldInterval(wave, t, floor));
    assert.ok(H.waveSpawnBudget(wave + 1, t) > H.waveSpawnBudget(wave, t) && H.waveSpawnBudget(wave, t + 6) > H.waveSpawnBudget(wave, t));
  }
  assert.ok(H.spawnInterval(1, 0) >= oldInterval(1, 0, .05) * 1.8, 'opening trickle');
  assert.equal(H.waveSpawnBudget(1, 0), 35); assert.equal(H.waveSpawnBudget(6, 180), 24 + 66 + Math.floor(5 ** 1.32 * 7.8) + 30);
  let opening = 0; for (let t = 0; t < 25; t += H.spawnInterval(1, t)) opening++;
  let previous = 0; for (let t = 0; t < 25; t += oldInterval(1, t, .05)) previous++;
  assert.ok(opening <= previous * .8 && opening >= 18, `opening spawns ${opening} vs ${previous}`);
  assert.ok(H.spawnInterval(30, 600, .05) === .05 && H.spawnInterval(30, 600, .032) < .05, 'late pressure still reaches the caller floor');
  for (const r of [0, .5, .999]) { const early = H.spawnDistance(0, r), late = H.spawnDistance(60, r); assert.ok(early >= 22 && early <= 32 && late >= 28 && late <= 50 && early <= late); }
});

check('Client/server parity: both import the same module and carry no private copy of the numbers', () => {
  for (const [name, source] of [['main.js', main], ['server.mjs', server]]) {
    assert.match(source, /from ["']\.\/(src\/)?combat\/hero-power\.mjs["']/, `${name} must import hero-power`);
    for (const symbol of ['beginBasicAttack', 'meleeShape', 'insideMeleeShape', 'rifleShot', 'assistRifleAim', 'basicPower', 'skillPower', 'applyHeroKnockback', 'advanceHeroKnockback', 'resolveIncomingDamage', 'resolveLeech', 'waveSpawnBudget'])
      assert.ok(source.split(symbol).length > 2, `${name} imports and uses ${symbol}`);
  }
  assert.ok(!/damage: 7, cooldown: 500/.test(server) && !/damage: 2, cooldown: 300/.test(server) && !/7 \* getCombatDamageMultiplier\(\)/.test(main) && !/4\.2 \* getAreaMultiplier\(\)/.test(main));
  assert.match(server, /serverCharacterProfiles = \{ warrior: basicAttackSpec\("warrior"\), dwarf: basicAttackSpec\("dwarf"\) \}/);
  assert.match(server, /damageMultiplier: attackStats\(client\.progression\)\.damageMultiplier \* skillPower\(client\.state\.character, client\.progression\.level\)/);
  assert.match(main, /\* skillPower\(player\.character, player\.level\)/);
  assert.match(authority, /state\.maxHealth = heroMaxHealth\(p\.character\)/); assert.equal(A.xpToNext, H.xpToNext);
  const warrior = { runId: 'w', character: 'warrior', health: 999, state: 'playing', stateVersion: 0 }; A.createProgression(warrior);
  assert.equal(warrior.maxHealth, W.maxHealth); assert.equal(warrior.health, W.maxHealth);
  const lyra = { runId: 'd', character: 'dwarf', health: 999, state: 'playing', stateVersion: 0 }; A.createProgression(lyra); assert.equal(lyra.maxHealth, D.maxHealth);
  for (const classId of ['warrior', 'dwarf']) {
    const spec = H.basicAttackSpec(classId), basic = H.heroProfile(classId).basic;
    assert.deepEqual([spec.classId, spec.weapon, spec.damage, spec.cooldown], [classId, basic.weapon, basic.damage, basic.cooldownMs]);
    // The server gate stays below the client cadence at every +Cadência value, so jitter never drops a legitimate attack.
    for (const multiplier of [1, .9, .81, .6, .48]) assert.ok(spec.cooldown * multiplier <= H.swingDuration(classId, multiplier) * 1000 * .95, `${classId} cadence ${multiplier}`);
  }
  near(H.rifleShot('dwarf').lifespan * H.rifleShot('dwarf').speed, H.rifleShot('dwarf').range); // solo bullet reach == server ray
});

check('Model: the opening horde is survivable, a hero standing still at wave 6 still dies', () => {
  const profile = type => { const m = server.match(new RegExp(`${type}: \\{ health: ([\\d.]+), speed: [\\d.]+, radius: [\\d.]+, damage: ([\\d.]+)`)); return { health: Number(m[1]), damage: Number(m[2]) }; };
  const difficulty = (wave, t) => .98 + wave * .075 + Math.max(0, wave - 10) * .075 + Math.min(1, t / 285);
  assert.match(server, /damage: 0\.98 \+ wave \* 0\.075/);
  function standStill(classId, wave, t0, zombies, brutes) {
    const state = H.createHeroCombatState(classId); let health = H.heroMaxHealth(classId), t = 0; const next = [...Array(zombies)].map((_, i) => i / zombies * 1.05), brute = [...Array(brutes)].map((_, i) => .3 + i * .31);
    while (health > 0 && t < 120) {
      t += 1 / 60;
      next.forEach((at, i) => { if (t >= at) { next[i] = at + 1.05; health -= H.resolveIncomingDamage(state, Math.ceil(profile('zombie').damage * difficulty(wave, t0 + t) + Math.floor(wave * .55)), { now: t, swarm: true }).damage; } });
      brute.forEach((at, i) => { if (t >= at) { brute[i] = at + .62; health -= H.resolveIncomingDamage(state, Math.ceil(profile('brute').damage * difficulty(wave, t0 + t) + Math.floor(wave * .55)), { now: t, swarm: false }).damage; } });
    }
    return t;
  }
  const before = 200 / (8 / 1.05 * 14); // previous rules: eight zombies, no armor, no grace
  const aldricOpening = standStill('warrior', 1, 10, 8, 0), lyraOpening = standStill('dwarf', 1, 10, 8, 0);
  assert.ok(before < 2 && aldricOpening >= 12 && lyraOpening >= 5 && aldricOpening > lyraOpening * 1.8, `opening: before ${before.toFixed(1)}s, Aldric ${aldricOpening.toFixed(1)}s, Lyra ${lyraOpening.toFixed(1)}s`);
  const aldricLate = standStill('warrior', 6, 240, 8, 2), lyraLate = standStill('dwarf', 6, 240, 8, 2);
  assert.ok(aldricLate < 6 && lyraLate < 3, `wave 6 standing still must stay lethal: Aldric ${aldricLate.toFixed(1)}s, Lyra ${lyraLate.toFixed(1)}s`);
  checks.push(`model seconds to die standing still — opening x8 zombies: before ${before.toFixed(1)}, Aldric ${aldricOpening.toFixed(1)}, Lyra ${lyraOpening.toFixed(1)}; wave 6 x8 zombies + 2 brutes: Aldric ${aldricLate.toFixed(1)}, Lyra ${lyraLate.toFixed(1)}`);
});

const outDir = process.env.BIPX_EVIDENCE_DIR || 'output/qa/hero-power';
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/hero-power-cpu.json`, JSON.stringify({ passed: true, scope: 'Pure CPU module contract plus source-text parity; the survival block is a model, not gameplay evidence.', profiles: H.HERO_PROFILES, incoming: H.INCOMING, pacing: H.PACING,
  xpToNext: Array.from({ length: 12 }, (_, i) => H.xpToNext(i + 1)), checks }, null, 2) + '\n');
console.log(`hero-power: ${checks.length} checks passed`);
