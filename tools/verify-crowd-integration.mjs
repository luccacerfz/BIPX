// Integration CPU fixtures: current production hooks run verbatim in an isolated VM.
// Tracing observes the real solver; it does not supply missing bodies or status policy.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { requireStagingArtefacts } from './quality-staging.mjs';
const root = process.cwd();
const imp = p => import(pathToFileURL(path.join(root, p)));
// Baseline comparison inputs are staging snapshots under the untracked output/ tree (the pre-optimisation solver and server).
requireStagingArtefacts(['output/physics/crowd-optimized-20260919/snapshots/production-contacts.mjs', 'output/qa/arpg-crowd-integrated-20260919/before/server.mjs']);
const original = await imp('output/physics/crowd-optimized-20260919/snapshots/production-contacts.mjs');
const physics = await imp('src/physics/contacts.mjs');
const { separateControlledActors } = await imp('src/combat/crowd-control.mjs');
const navigation = await imp('src/physics/navigation.mjs');
const skills = await imp('src/combat/class-skills.mjs');
const melee = await imp('src/combat/melee-timing.mjs');
const heights = await imp('src/combat/collision-heights.mjs');
const { skillMods } = await imp('src/progression/authority.mjs'); // T2: trusted skill mods read by updateServerSkills
const heroPower = await imp('src/combat/hero-power.mjs'); // T1: knockback, swarm grace and pacing are read by the extracted monster hooks
const environment = await imp('src/render/environment-layout.js');
const files = ['src/main.js', 'server.mjs', 'output/qa/arpg-crowd-integrated-20260919/before/server.mjs', 'output/physics/crowd-optimized-20260919/snapshots/production-contacts.mjs', 'src/physics/navigation.mjs',
  'src/combat/class-skills.mjs', 'src/combat/melee-timing.mjs', 'src/combat/collision-heights.mjs',
  'src/render/environment-layout.js', 'src/physics/contacts.mjs', 'src/combat/crowd-control.mjs', 'src/physics/navigation.mjs', path.relative(root, fileURLToPath(import.meta.url))];
const hashes = () => Object.fromEntries(files.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report = { createdAt: new Date().toISOString(), scope: 'Current production hooks verbatim with real dynamic index and policy; CPU fixtures, no browser/render/network proof. Historical current-mode baseline uses preserved pre-integration server/contacts.', sourceHashes: hashes(), tests: [] };
const source = fs.readFileSync('server.mjs', 'utf8');
const profileStart = source.indexOf('const serverMonsterProfiles = ');
const profiles = vm.runInNewContext(source.slice(profileStart, source.indexOf('\n};', profileStart) + 3) + ';serverMonsterProfiles;');
const baselineSource = fs.readFileSync('output/qa/arpg-crowd-integrated-20260919/before/server.mjs','utf8');
function extract(name, text = source) {
  const source = text;
  const start = source.indexOf(`function ${name}(`), end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
const openWorld = physics.createCollisionWorld({ bounds: { x: 0, z: 0, radius: 55 } });
const actualWorld = physics.createCollisionWorld({ colliders: environment.getEnvironmentColliders(), bounds: environment.ENVIRONMENT_GROUND });
const recoveryRail = environment.getEnvironmentColliders().find(c => c.id === 'burial-rail-0');
assert.ok(recoveryRail);
const railPoint = (x, z) => ({ x: recoveryRail.x + Math.cos(recoveryRail.yaw || 0) * x + Math.sin(recoveryRail.yaw || 0) * z,
  z: recoveryRail.z - Math.sin(recoveryRail.yaw || 0) * x + Math.cos(recoveryRail.yaw || 0) * z });
const controlled = b => b.freezeTimer > 0 || b.stunTimer > 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function policySeparate(world, input, options, mode, dt) {
  if (mode === 'current') return original.separateActors(world, input, options);
  if (mode === 'anchor') return physics.separateActors(world,input.map(b=>({...b,inverseMass:controlled(b)?0:b.inverseMass??1})),options);
  return separateControlledActors(world, input, dt, options);
}

function enemy(id, x, z, status = null, duration = 4) {
  return { id, type: 'zombie', x, z, radius: .78, speed: 3.3, health: 200, maxHealth: 200,
    damage: 13, attackCooldown: 0, ...(status ? { [status]: duration } : {}) };
}
function segmentPenetration(body, other, segment) {
  const dx = segment.to.x - segment.from.x, dz = segment.to.z - segment.from.z, sq = dx*dx + dz*dz;
  const t = sq > 0 ? Math.max(0,Math.min(1,((other.x-segment.from.x)*dx+(other.z-segment.from.z)*dz)/sq)) : 0;
  return Math.max(0,body.radius+other.radius-Math.hypot(segment.from.x+dx*t-other.x,segment.from.z+dz*t-other.z));
}
function observeTrace(bodies, trace, stats) {
  const state = new Map(bodies.map(b => [String(b.id), { ...b }]));
  for (const segment of trace ?? []) {
    const body = state.get(String(segment.id)); assert.ok(body,'Trace body id');
    for (const other of state.values()) if (String(other.id) !== String(body.id)) {
      const pen = segmentPenetration(body,other,segment);
      if(pen>stats.maximumTransientPenetration) stats.peak={body:{...body},other:{...other},segment,pen};
      stats.maximumTransientPenetration = Math.max(stats.maximumTransientPenetration,pen);
    }
    body.x=segment.to.x; body.z=segment.to.z; stats.segments++;
  }
}
function setup(enemies, mode, dt, world = openWorld, playerPosition = { x: 0, z: -10 }, audit = true) {
  const player = { id: 'player', connected: true, state: { ...playerPosition, health: 200, state: 'playing' }, progression: {} };
  const room = { clients: new Map([[player.id, player]]), world: { monsters: new Map(enemies.map(e => [e.id, e])), wave: 1 } };
  const stats = { maximumTransientPenetration:0, segments:0, maxPlansPerTick:0, plansThisTick:0, ticks:0, costsMs:[] };
  const peers = () => [...room.world.monsters.values()].map(b=>({...b,id:`monster:${b.id}`})).concat({id:'player:player',...player.state,radius:.64});
  const ctx = vm.createContext({ ...physics, ...navigation, ...skills, ...melee, ...heights, ...heroPower, skillMods,
    collisionWorld: world, serverMonsterProfiles: profiles,
    getPursuitDirection(...args) { const result=navigation.getPursuitDirection(...args); if(result.state.planned)stats.plansThisTick++;return result; },
    stepActor(w, body, velocity, elapsed, options) {
      const bodies=audit?peers():null;
      if(mode!=='current') assert.equal(typeof options?.bodies?.query,'function','Runtime must pass its own live actor index');
      const result=mode==='current' ? original.stepActor(w,body,velocity,elapsed,options)
        : physics.stepActor(w,body,velocity,elapsed,{...options,trace:audit});
      const id=String(body.id).startsWith('monster:')?body.id:`monster:${body.id}`;
      if(audit) observeTrace(bodies,(result.trace??[{from:{x:body.x,z:body.z},to:result}]).map(s=>({...s,id})),stats);
      return result;
    },
    separateActors(w,b,o) { return original.separateActors(w,b,o); },
    separateControlledActors(w,b,d,o) {
      const result=separateControlledActors(w,b,d,{...o,trace:audit});
      if(audit)observeTrace(b,result.trace,stats);return result;
    },
    pullActors(w,b,c,d,o) { const result=physics.pullActors(w,b,c,d,{...o,trace:audit});if(audit)observeTrace(b,result.trace,stats);return result; },
    distanceSq: (x, z, a, b) => (x-a)**2 + (z-b)**2,
    broadcast() {}, sendJson() {}, serializeMonster: m => ({ ...m }), damageServerPlayer() {}, damageServerMonster() {} });
  const names=['updateServerMonsters','updateServerMonsterStatus','getServerMonsterTarget','updateServerSkills','getPlayingClients'];
  if(mode!=='current')names.push('getServerCrowdBodies');
  vm.runInContext(names.map(n=>extract(n,mode==='current'?baselineSource:source)).join('\n'),ctx);
  return { enemies, player, room, ctx, stats, tick: () => {
    stats.plansThisTick=0;const start=performance.now();ctx.updateServerMonsters(room,[player],dt);if(mode!=='current')assert.equal(room.world.actorIndex,null,'Index must not survive crowd corrections');
    stats.costsMs.push(performance.now()-start); stats.ticks++;
    stats.maxPlansPerTick=Math.max(stats.maxPlansPerTick,stats.plansThisTick); assert.ok(stats.plansThisTick<=4);
  } };
}
function test(name, fn) {
  try { report.tests.push({ name, passed: true, details: fn() }); }
  catch (error) { report.tests.push({ name, passed: false, error: error.stack }); }
}
function pressure(mode, status, dt = .05, seconds = 1, pack = false) {
  const target = enemy(1, 0, 0, status, seconds + 1), enemies = [target, enemy(2, 0, 2)];
  if (pack) for (let i = 0; i < 8; i++) enemies.push(enemy(i + 3, (i % 3 - 1) * 1.7, 3.7 + Math.floor(i / 3) * 1.7));
  const sim = setup(enemies, mode, dt);
  let cumulative = 0, maximumStep = 0, maximumControlledPenetration = 0, finalControlledPenetration = 0;
  for (let frame = 0; frame < Math.round(seconds / dt); frame++) {
    const previous = { ...target }; sim.tick(); const step = distance(previous, target);
    cumulative += step; maximumStep = Math.max(maximumStep, step);
    finalControlledPenetration = Math.max(0, ...enemies.slice(1).map(e => e.radius + target.radius - distance(e, target)));
    maximumControlledPenetration = Math.max(maximumControlledPenetration, finalControlledPenetration);
    assert.ok(target[status] > 0); assert.equal(Object.hasOwn(target, 'inverseMass'), false);
  }
  return { mode, status, dt, seconds, bodies: enemies.length, cumulative, net: Math.hypot(target.x, target.z), maximumStep,
    maximumControlledPenetration, finalControlledPenetration, maximumTransientPenetration:sim.stats.maximumTransientPenetration,
    measuredSegments:sim.stats.segments, maxPlansPerTick:sim.stats.maxPlansPerTick };
}
test('actual ordinary solver versus low inverse masses and anchoring under pursuit pressure', () => {
  const results = [];
  for (const status of ['freezeTimer', 'stunTimer']) for (const mode of ['current', 'anchor-recover']) {
    const result = pressure(mode, status); results.push(result);
    if (typeof mode === 'string' && mode.startsWith('anchor')) near(result.cumulative, 0);
  }
  return results;
});
test('three seconds of ten-body pressure at 10/20/60 Hz', () => {
  const results = [];
  for (const status of ['freezeTimer','stunTimer']) for (const dt of [.1, .05, 1/60]) for (const mode of ['current', 'anchor-recover']) {
    const result = pressure(mode, status, dt, 3, true); results.push(result);
    if (mode==='anchor-recover') { near(result.cumulative, 0);assert.ok(result.maximumTransientPenetration<.00101); }
  }
  return results;
});
test('pre-existing fixed/fixed overlaps need bounded recovery rather than permanent locking', () => {
  const cases = [
    [enemy(1, -.68, 0, 'freezeTimer'), enemy(2, .68, 0, 'stunTimer')],
    [enemy(1, 0, 0, 'freezeTimer'), { id: 'player', x: 0, z: 1.2, radius: .64, inverseMass: 0 }],
  ];
  return cases.map((input, index) => {
    let locked = input, recovered = input, maxStep = 0;
    for (let frame = 0; frame < 40; frame++) {
      locked = policySeparate(openWorld, locked, { iterations: 2, maxTotalCorrection: .2 }, 'anchor', .05).bodies;
      const next = policySeparate(openWorld, recovered, { iterations: 2, maxTotalCorrection: .2 }, 'anchor-recover', .05).bodies;
      for (let i = 0; i < next.length; i++) maxStep = Math.max(maxStep, distance(next[i], recovered[i]));
      recovered = next;
    }
    const penetration = bodies => Math.max(0, bodies[0].radius + bodies[1].radius - distance(bodies[0], bodies[1]));
    assert.ok(penetration(locked) >= .19); assert.ok(penetration(recovered) <= .00101); assert.ok(maxStep <= .01000001);
    if (index === 1) near(distance(recovered[1], input[1]), 0);
    return { case: index ? 'controlled/player' : 'controlled/controlled', lockedPenetration: penetration(locked), recoveryPenetration: penetration(recovered), maxStep, seconds: 2 };
  });
});
test('control expiration releases current position without rewind or persistent mass', () => {
  const target = enemy(1, 0, 0, 'freezeTimer', 1), sim = setup([target, enemy(2, 0, 2)], 'anchor-recover', .05);
  let beforeExpiry = 0, afterExpiry = 0, maxStep = 0;
  for (let frame = 0; frame < 40; frame++) {
    const previous = { ...target }; sim.tick(); const step = distance(previous, target);
    if (target.freezeTimer > 0) beforeExpiry += step; else afterExpiry += step;
    maxStep = Math.max(maxStep, step); assert.equal(Object.hasOwn(target, 'inverseMass'), false);
  }
  near(beforeExpiry, 0); assert.ok(afterExpiry > 1); assert.ok(maxStep < .37);
  return { beforeExpiry, afterExpiry, maxStep, finalTimer: target.freezeTimer };
});
test('bounded recovery sweeps the real rail and circular arena rather than ejecting bodies through them', () => {
  const atRail = railPoint(0, -(recoveryRail.halfZ + .78 + .00001));
  const behind = railPoint(0, -(recoveryRail.halfZ + .78 + 1.36 + .00001));
  const cases = [
    { world: actualWorld, bodies: [enemy(1, atRail.x, atRail.z, 'freezeTimer'), enemy(2, behind.x, behind.z, 'stunTimer')] },
    { world: openWorld, bodies: [enemy(1, 0, 54.22, 'freezeTimer'), enemy(2, 0, 52.86, 'stunTimer')] },
  ];
  // The intended initial error is body/body overlap, never overlap with a prop.
  assert.equal(physics.sweepStatic(actualWorld, atRail, railPoint(0, 0), .78, {kind:'actor'}).colliderId, recoveryRail.id);
  return cases.map(({ world, bodies }, index) => {
    for (const body of bodies) {
      const free = physics.moveActor(world, body, {x:0,z:0});
      assert.equal(free.unresolved, false); near(distance(free, body), 0, 1e-5);
    }
    let maxStep = 0;
    for (let frame = 0; frame < 60; frame++) {
      const next = policySeparate(world, bodies, { iterations: 2, maxTotalCorrection: .2 }, 'anchor-recover', .05).bodies;
      for (let i = 0; i < next.length; i++) {
        maxStep = Math.max(maxStep, distance(next[i], bodies[i]));
        const free = physics.moveActor(world, next[i], { x: 0, z: 0 });
        near(distance(free, next[i]), 0, 1e-5); assert.equal(free.unresolved, false);
        assert.ok(Math.hypot(next[i].x, next[i].z) + next[i].radius <= 55 + 1e-6);
      }
      bodies = next;
    }
    const penetration = Math.max(0, bodies[0].radius + bodies[1].radius - distance(bodies[0], bodies[1]));
    assert.ok(penetration <= .00101); assert.ok(maxStep <= .01000001);
    return { case: index ? 'arena55' : 'burial-rail-0', maxStep, finalPenetration: penetration };
  });
});
function clientContext(zombies,playerPosition,world) {
  const player={position:playerPosition,health:200};
  const ctx=vm.createContext({...physics,...navigation,...heroPower,separateControlledActors,zombies,player,collisionWorld:world,zombieNavigationBudget:4,zombieActorIndex:null,
    getLivingPlayerTargets:()=>[{id:'player',position:player.position,radius:.64}]});
  const main=fs.readFileSync('src/main.js','utf8');
  vm.runInContext(['getZombieCollisionBody','getEnemyCrowdBodies','moveZombieWithPhysics','resolveEnemyCrowding'].map(n=>extract(n,main)).join('\n'),ctx);
  return ctx;
}
test('current client/server crowd hooks consume real control timers and dt',()=>{
  const initial=[enemy(1,-.68,0,'freezeTimer'),enemy(2,.68,0,'stunTimer'),{...enemy(3,0,2),speed:0}];
  const sim=setup(initial.map(e=>({...e})),'anchor-recover',.05);
  const zs=initial.map(e=>({...e,mesh:{position:{x:e.x,z:e.z},rotation:{y:0}}}));
  const ctx=clientContext(zs,sim.player.state,openWorld);let maxError=0;
  for(let i=0;i<20;i++){sim.tick();ctx.resolveEnemyCrowding(.05);for(let j=0;j<zs.length;j++)maxError=Math.max(maxError,distance(zs[j].mesh.position,sim.enemies[j]));}
  near(maxError,0);return {maxError,seconds:1};
});
test('actual gravity hook still pulls controlled bodies with ordinary anchor policy in real layout', () => {
  const impact = physics.sweepStatic(actualWorld, {...railPoint(0, -3),y:1.05}, {...railPoint(0, 3),y:1.05}, .3);
  assert.equal(impact.colliderId, 'burial-rail-0'); const center = { x: impact.x, z: impact.z }, enemies = [];
  for (let i = 0; i < 80 && enemies.length < 12; i++) {
    const angle = i * 2.39996, radius = 2 + i % 4 * .7;
    const request = { ...enemy(i + 1, center.x + Math.cos(angle) * radius, center.z + Math.sin(angle) * radius, i % 2 ? 'freezeTimer' : 'stunTimer'), radius: .58 };
    const spawn = physics.findFreePosition(actualWorld, request, { maxDistance: 3, actors: enemies });
    if (spawn.found && distance(spawn, center) < 4.8) enemies.push({ ...request, x: spawn.x, z: spawn.z });
  }
  assert.equal(enemies.length, 12);
  const sim = setup(enemies, 'anchor-recover', 1/60, actualWorld, { x: 0, z: 0 });
  sim.player.skills = skills.createSkillState('dwarf');
  sim.player.skills.fields.push({ skillId: 'dwarf_gravity_shot', castId: 'policy:gravity', status: 'gravity', ...center, y: .08, radius: 5,
    remaining: 5, duration: 5, origin: { ...center, y: .08 } });
  const mean = () => enemies.reduce((sum, e) => sum + distance(e, center), 0) / enemies.length;
  const initialMean = mean(); let maxStep = 0, maxOrdinaryStep = 0, maxPenetration = 0;
  for (let frame = 0; frame < 180; frame++) {
    const previous = enemies.map(e => ({ ...e })); sim.ctx.updateServerSkills(sim.room, sim.player, 1/60);
    const afterPull = enemies.map(e => ({ ...e })); sim.tick();
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i], free = physics.moveActor(actualWorld, e, { x: 0, z: 0 });
      near(distance(e, free), 0); assert.equal(free.unresolved, false); assert.ok(Math.hypot(e.x, e.z) + e.radius <= 55 + 1e-6);
      maxStep = Math.max(maxStep, distance(e, previous[i])); maxOrdinaryStep = Math.max(maxOrdinaryStep, distance(e, afterPull[i]));
      assert.ok(controlled(e)); assert.equal(Object.hasOwn(e, 'inverseMass'), false);
      for (let j = i+1; j < enemies.length; j++) maxPenetration = Math.max(maxPenetration, e.radius + enemies[j].radius - distance(e, enemies[j]));
    }
  }
  assert.ok(mean() < initialMean - .2); assert.ok(maxStep <= .075001); assert.ok(maxPenetration <= .00101); near(maxOrdinaryStep, 0);
  assert.ok(sim.stats.maximumTransientPenetration<.00101);
  return { bodies: enemies.length, center, initialMean, finalMean: mean(), maxStep, maxOrdinaryStep, maxPenetration, maximumTransientPenetration:sim.stats.maximumTransientPenetration,measuredSegments:sim.stats.segments };
});
test('zero-time recovery, immutable inputs, player immunity, and explicit pull resistance stay distinct', () => {
  const input = [enemy(1, 0, 0, 'freezeTimer'), { id: 'player', x: 0, z: 1.2, radius: .64, inverseMass: 0 }];
  const snapshot = JSON.stringify(input), stationary = policySeparate(openWorld, input, { iterations: 2, maxTotalCorrection: .2 }, 'anchor-recover', 0);
  near(distance(stationary.bodies[0], input[0]), 0); assert.equal(JSON.stringify(input), snapshot);
  const normal = { ...enemy(1, 0, 4, 'freezeTimer'), inverseMass: 1, pullScale: 1 };
  const boss = { ...normal, pullScale: .35 };
  const run = b => physics.pullActors(openWorld, [b, { id: 'player', x: 0, z: -4, radius: .64, inverseMass: 0 }], { x: 0, z: 0 }, .05, { radius: 5, speed: 4.5, coreRadius: .55, iterations: 4 });
  const n = run(normal), b = run(boss); near(distance(b.bodies[0], boss) / distance(n.bodies[0], normal), .35);
  near(distance(n.bodies[1], { x: 0, z: -4 }), 0);
  assert.equal(JSON.stringify(input), snapshot);
  return { normalStep: distance(n.bodies[0], normal), bossStep: distance(b.bodies[0], boss), zeroTimeRecovery: 0 };
});
test('long-frame dynamic sweep cannot cross a frozen boss or a second moving actor', () => {
  const boss={...enemy('boss',0,0,'freezeTimer'),radius:1.72}, runner={...enemy('runner',-8,0),radius:.58};
  const result=physics.stepActor(openWorld,runner,{x:200,z:0},5,{bodies:[runner,boss],trace:true});
  near(result.dt,.1);assert.ok(result.x<=-2.3);assert.equal(result.blocked,true);
  const stats={maximumTransientPenetration:0,segments:0};observeTrace([runner,boss],result.trace.map(s=>({...s,id:runner.id})),stats);
  let actors=[{...enemy('a',-5,3),radius:.64},{...enemy('b',5,3),radius:.64}];
  for(let i=0;i<2;i++) {
    const move=physics.stepActor(openWorld,actors[i],{x:i?-100:100,z:0},.1,{bodies:actors,trace:true});
    observeTrace(actors,move.trace.map(s=>({...s,id:actors[i].id})),stats);actors[i]={...actors[i],x:move.x,z:move.z};
  }
  near(stats.maximumTransientPenetration,0);
  return {requestedDt:5,acceptedDt:result.dt,stoppedAtX:result.x,maximumTransientPenetration:stats.maximumTransientPenetration,segments:stats.segments};
});
test('all ten actors resume after freeze/stun expiry without position rewind', () => {
  return ['freezeTimer','stunTimer'].flatMap(status=>[.1,.05,1/60].map(dt=>{
    const actors=[enemy(1,0,0,status,1),enemy(2,0,2)];
    for(let i=0;i<8;i++)actors.push(enemy(i+3,(i%3-1)*1.7,3.7+Math.floor(i/3)*1.7));
    const sim=setup(actors,'anchor-recover',dt);let controlledTravel=0,maxStep=0,positionsAtExpiry=null;
    for(let i=0;i<Math.round(3/dt);i++) {
      const before=actors.map(b=>({...b}));sim.tick();
      if(actors[0][status]>0)controlledTravel+=distance(before[0],actors[0]);else positionsAtExpiry??=before;
      maxStep=Math.max(maxStep,...actors.map((b,j)=>distance(b,before[j])));
    }
    const afterExpiry=actors.map((b,i)=>distance(b,positionsAtExpiry[i]));
    near(controlledTravel,0);assert.ok(afterExpiry.every(d=>d>.1));assert.ok(maxStep<=3.3*dt+1e-4);
    assert.ok(sim.stats.maximumTransientPenetration<.00101);
    return {status,dt,controlledTravel,minTravelAfterExpiry:Math.min(...afterExpiry),maxStep,maximumTransientPenetration:sim.stats.maximumTransientPenetration};
  }));
});
test('large boss control durations and crowd remain finite, then resume', () => {
  return [['freezeTimer',.8],['stunTimer',.65]].map(([status,duration])=>{
    const boss={...enemy(1,0,0,status,duration),radius:1.72,speed:2.6};
    const actors=[boss,enemy(2,0,3.1),enemy(3,-1.7,4.8),enemy(4,0,4.8),enemy(5,1.7,4.8)];
    const sim=setup(actors,'anchor-recover',.05);let controlledTravel=0,maxStep=0;
    for(let i=0;i<40;i++) { const p={...boss};sim.tick();const d=distance(p,boss);maxStep=Math.max(maxStep,d);if(boss[status]>0)controlledTravel+=d; }
    near(controlledTravel,0);assert.equal(boss[status],0);assert.ok(Math.hypot(boss.x,boss.z)>.5);assert.ok(maxStep<=.13001);
    assert.ok(sim.stats.maximumTransientPenetration<.00101);
    return {status,duration,radius:boss.radius,controlledTravel,maxStep,finalTravel:Math.hypot(boss.x,boss.z),maximumTransientPenetration:sim.stats.maximumTransientPenetration};
  });
});
test('120 real-layout actors preserve cover, bounds and the four-plan per-tick budget', () => {
  const actors=[];
  for(let i=0;i<120;i++) {
    const angle=i*2.39996,r=15+i%32,request=enemy(i+1,Math.cos(angle)*r,Math.sin(angle)*r,i%7===0?'freezeTimer':null,4);
    const placed=physics.findFreePosition(actualWorld,request,{actors,maxDistance:16});assert.ok(placed.found);
    actors.push({...request,x:placed.x,z:placed.z});
  }
  const sim=setup(actors,'anchor-recover',.1,actualWorld,{x:0,z:0});let maxStep=0,plans=0;
  for(let i=0;i<30;i++) {
    const before=actors.map(b=>({...b}));sim.tick();plans+=sim.stats.plansThisTick;
    for(let j=0;j<actors.length;j++) {
      const b=actors[j],fixed=physics.moveActor(actualWorld,b,{x:0,z:0});
      near(distance(fixed,b),0,2e-5);assert.equal(fixed.unresolved,false);assert.ok(Math.hypot(b.x,b.z)+b.radius<=55+1e-5);
      maxStep=Math.max(maxStep,distance(b,before[j]));if(b.freezeTimer>0)near(distance(b,before[j]),0,2e-5);
    }
  }
  assert.ok(plans>4);assert.ok(sim.stats.maxPlansPerTick<=4);assert.equal(sim.room.world.navigationTick,30);
  assert.ok(sim.stats.maximumTransientPenetration<.00101,JSON.stringify(sim.stats.peak));assert.ok(maxStep<.331);
  return {actors:120,seconds:3,dt:.1,plans,maxPlansPerTick:sim.stats.maxPlansPerTick,navigationTicks:sim.room.world.navigationTick,
    maxStep,maximumTransientPenetration:sim.stats.maximumTransientPenetration,measuredSegments:sim.stats.segments};
});
test('segment audit includes peak during pre-existing packed recovery', () => {
  let bodies=Array.from({length:80},(_,i)=>({id:i,x:i%10*.7-3.15,z:Math.floor(i/10)*.7-2.45,radius:.5}));
  const initialPenetration=Math.max(...bodies.flatMap((a,i)=>bodies.slice(i+1).map(b=>a.radius+b.radius-distance(a,b))));
  const stats={maximumTransientPenetration:0,segments:0};let last,maxStep=0,recoveries=0;
  for(let frame=0;frame<360;frame++) {
    last=physics.separateActors(openWorld,bodies,{trace:true});observeTrace(bodies,last.trace,stats);
    recoveries+=Number(last.maxPenetration>.0011);maxStep=Math.max(maxStep,...last.bodies.map((b,i)=>distance(b,bodies[i])));bodies=last.bodies;
  }
  assert.ok(last.maxPenetration<.0011);assert.ok(maxStep<=.50001);
  return {initialPenetration,maximumTransientPenetration:stats.maximumTransientPenetration,finalPenetration:last.maxPenetration,maxStep,recoveries,
    note:'Already-invalid pack; recovery peaks are reported separately from zero-new-overlap movement.'};
});
function makePerfActors(count) {
  if(count===10) { const a=[enemy(1,0,0,'freezeTimer',10),enemy(2,0,2)];for(let i=0;i<8;i++)a.push(enemy(i+3,(i%3-1)*1.7,3.7+Math.floor(i/3)*1.7));return a; }
  const columns=Math.ceil(Math.sqrt(count));
  return Array.from({length:count},(_,i)=>enemy(i+1,(i%columns-(columns-1)/2)*1.65,2+Math.floor(i/columns)*1.65,i%7===0?'freezeTimer':null,10));
}
test('spatial index agrees with complete peer sweeps through cell changes and removals',()=>{
  let actors=Array.from({length:40},(_,i)=>({...enemy(i,Math.cos(i*2.39996)*(5+i%9),Math.sin(i*2.39996)*(5+i%9)),radius:.4+i%3*.1}));
  const index=physics.createActorIndex(actors.slice().reverse());let maxError=0;
  for(let frame=0;frame<20;frame++)for(let i=0;i<actors.length;i++) {
    const body=actors[i],delta={x:Math.sin(frame+i*.31)*1.4,z:Math.cos(frame+i*.27)*1.4};
    const full=physics.moveActor(openWorld,body,delta,{bodies:actors}),indexed=physics.moveActor(openWorld,body,delta,{bodies:index});
    maxError=Math.max(maxError,distance(full,indexed));actors[i]={...body,x:indexed.x,z:indexed.z};index.update(actors[i]);
  }
  near(maxError,0,1e-9);const removed=actors.shift();assert.equal(index.remove(removed.id),true);
  assert.ok(!index.query(-55,-55,55,55).some(b=>b.id===removed.id));
  assert.equal(index.remove(removed.id),false);assert.equal(index.query(-55,-55,55,55).length,39);
  return {moves:800,maxError,remainingIndexed:39};
});
test('actual client movement passes and updates the same live index as server',()=>{
  const sim=setup([enemy(1,0,0,'freezeTimer',4),enemy(2,0,2)],'anchor-recover',.05);
  const zs=sim.enemies.map(e=>({...e,mesh:{position:{x:e.x,z:e.z},rotation:{y:0}},pursuitTarget:{x:0,z:-10}}));
  const ctx=clientContext(zs,sim.player.state,openWorld);let maxError=0;
  for(let i=0;i<60;i++){
    sim.tick();ctx.zombieActorIndex=physics.createActorIndex(ctx.getEnemyCrowdBodies());
    ctx.moveZombieWithPhysics(zs[1],{x:0,z:-1},3.3,.05);
    const indexed=ctx.zombieActorIndex.query(-55,-55,55,55).find(b=>b.id==='monster:2');
    near(distance(indexed,zs[1].mesh.position),0);
    ctx.resolveEnemyCrowding(.05);ctx.zombieActorIndex=null;
    for(let j=0;j<zs.length;j++)maxError=Math.max(maxError,distance(zs[j].mesh.position,sim.enemies[j]));
  }
  near(maxError,0,1e-9);return {seconds:3,maxError,blockerTravel:Math.hypot(zs[0].mesh.position.x,zs[0].mesh.position.z)};
});
test('server spawn queries all actors and updates an active index without changing existing bodies',()=>{
  const sim=setup([],'anchor-recover',.05,actualWorld,{x:0,z:0});
  Object.assign(sim.ctx,{serverEliteProfiles:{},rollServerEliteType:()=>null,getServerDifficultyScale:()=>({health:1,speed:1,damage:1}),getServerMonsterBalanceModifiers:()=>({health:1,speed:1,damage:1})});
  Object.assign(sim.room.world,{nextMonsterId:1,seq:0,survivalTime:0});
  vm.runInContext(extract('spawnServerMonster'),sim.ctx);
  sim.room.world.actorIndex=physics.createActorIndex(sim.ctx.getServerCrowdBodies(sim.room));
  for(let i=0;i<40;i++)assert.ok(sim.ctx.spawnServerMonster(sim.room,0,0,'zombie'));
  const bodies=sim.ctx.getServerCrowdBodies(sim.room);let overlap=0;
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)overlap=Math.max(overlap,bodies[i].radius+bodies[j].radius-distance(bodies[i],bodies[j]));
  assert.ok(overlap<1e-6);assert.equal(sim.room.world.actorIndex.query(-55,-55,55,55).length,41);
  return {monsters:40,player:1,overlap};
});
if(!process.env.BIPX_CROWD_SKIP_PERF)test('measured per-tick CPU cost without path-audit overhead', () => {
  const results=[];
  // Warm both code paths outside the timed samples.
  for(const mode of ['current','anchor-recover']) {const s=setup(makePerfActors(10),mode,.05,openWorld,{x:0,z:-10},false);for(let i=0;i<60;i++)s.tick();}
  for(const count of [10,120,400]) for(const dt of (count===10?[.1,.05,1/60]:[.1,1/60])) for(const mode of ['current','anchor-recover']) {
    const times=[];
    for(let trial=0;trial<3;trial++) {
      const sim=setup(makePerfActors(count),mode,dt,openWorld,{x:0,z:-10},false);
      for(let i=0;i<Math.round(3/dt);i++)sim.tick();times.push(...sim.stats.costsMs);
    }
    times.sort((a,b)=>a-b);
    results.push({actors:count,dt,mode,samples:times.length,medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1),
      scope:'Node VM production monster tick; no render/network/audio; tracing disabled; timing includes AI+movement+crowd.'});
  }
  return results;
});
report.sourceHashesAfter = hashes(); report.sourceStable = JSON.stringify(report.sourceHashes) === JSON.stringify(report.sourceHashesAfter);
report.passed = report.tests.filter(t => t.passed).length; report.failed = report.tests.length - report.passed;
report.acceptedForProduction = false;
report.gates = { runtimePolicyIntegrated: true, nativePolicyValidation: false };
report.limitations = ['Actual runtime hooks in CPU fixtures; native cost and multiplayer gameplay remain separate gates'];

const directory=process.env.BIPX_EVIDENCE_DIR||`output/qa/arpg-crowd-integrated-20260919/${report.createdAt.replace(/[:.]/g,'-')}`;fs.mkdirSync(directory,{recursive:true});const destination=`${directory}/crowd-integration.json`;
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ destination, passed: report.passed, failed: report.failed, sourceStable: report.sourceStable, tests: report.tests.filter(t=>!t.passed) }, null, 2));
if (report.failed || !report.sourceStable) process.exitCode = 1;
