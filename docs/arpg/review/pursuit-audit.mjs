// Independent CPU reproduction of the actual server pursuit function.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../../', import.meta.url)));
const files = ['server.mjs', 'src/physics/contacts.mjs', 'src/render/environment-layout.js',
  'src/physics/navigation.mjs', 'src/combat/class-skills.mjs',
  'src/combat/melee-timing.mjs', 'docs/arpg/review/pursuit-audit.mjs'];
const fingerprint = () => Object.fromEntries(files.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const before = fingerprint(), startedAt = new Date().toISOString();
const physics = await import('../../../src/physics/contacts.mjs');
const melee = await import('../../../src/combat/melee-timing.mjs');
const navigation = await import('../../../src/physics/navigation.mjs');
const crowd = await import('../../../src/combat/crowd-control.mjs');
const skills = await import('../../../src/combat/class-skills.mjs');
const environment = await import('../../../src/render/environment-layout.js');
const source = fs.readFileSync('server.mjs', 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Source boundary missing: ${start}`);
  return source.slice(a, b);
}
const extracted = [
  between('const serverMonsterProfiles = {', 'const serverCowMonsterTypes'),
  between('function getServerCrowdBodies(', 'function publishServerCaster('),
  between('function updateServerMonsters(', 'function updateServerMonsterStatus('),
  between('function updateServerMonsterStatus(', 'function spawnServerProjectile('),
  between('function getServerMonsterTarget(', 'function getServerDifficultyScale('),
].join('\n');
const allColliders = environment.getEnvironmentColliders();
const fullWorld = physics.createCollisionWorld({ colliders: allColliders, bounds: environment.ENVIRONMENT_GROUND });
const scenarios = [
  { id: 'open-ground-control', world: fullWorld, from: { x: 0, z: -6 }, target: { x: 0, z: 0 } },
  { id: 'real-rock-front-to-back', world: fullWorld, from: { x: -19, z: -20 }, target: { x: -19, z: -12 },
    waypoints: [{ x: -22.2, z: -20 }, { x: -22.2, z: -12 }, { x: -19, z: -12 }] },
  { id: 'real-rail-front-to-back', world: fullWorld, from: { x: -14, z: 22 }, target: { x: -14, z: 17.1 },
    waypoints: [{ x: -18.2, z: 22 }, { x: -18.2, z: 17.1 }, { x: -14, z: 17.1 }] },
  { id: 'real-rail-melee-through-barrier', world: fullWorld, from: { x: -14, z: 20 }, target: { x: -14, z: 18 }, wallExpectedBetween: true },
  { id: 'isolated-solid-wall-melee',
    world: physics.createCollisionWorld({ colliders: [{ id: 'wall', shape: 'box', x: 0, z: 0, halfX: 3, halfZ: .1, minY: 0, maxY: 3 }] }),
    from: { x: 0, z: -1 }, target: { x: 0, z: 1 }, wallExpectedBetween: true },
];
const results = [];
for (const scenario of scenarios) {
  const monster = { id: 1, type: 'zombie', ...scenario.from, radius: .78, speed: 3.3,
    health: 100, maxHealth: 100, damage: 13, attackCooldown: 0 };
  const player = { id: 'player', state: { ...scenario.target, health: 200 } };
  const initialMonster = physics.moveActor(scenario.world, monster, { x: 0, z: 0 });
  const initialPlayer = physics.moveActor(scenario.world, { ...scenario.target, radius: .64 }, { x: 0, z: 0 });
  const initialCorrection = Math.max(Math.hypot(initialMonster.x - monster.x, initialMonster.z - monster.z),
    Math.hypot(initialPlayer.x - player.state.x, initialPlayer.z - player.state.z));
  const hits = [], states = [];
  let now = 0;
  const context = vm.createContext({ ...physics, ...melee, ...navigation, ...crowd, ...skills, collisionWorld: scenario.world,
    distanceSq: (x, z, a, b) => (x - a) ** 2 + (z - b) ** 2,
    damageServerPlayer: (_room, _player, damage) => hits.push({ time: now, damage, origin: { x: monster.x, z: monster.z },
      obstructionAtImpact: physics.sweepStatic(scenario.world, { x: monster.x, y: .9, z: monster.z },
        { x: player.state.x, y: .9, z: player.state.z }, 0) }),
    damageServerMonster: () => { throw new Error('Unexpected burn branch in pursuit fixture'); },
    broadcast: () => {}, serializeMonster: monster => ({ ...monster }),
    getServerRangedCooldown: () => { throw new Error('Unexpected ranged branch'); },
    spawnServerProjectile: () => { throw new Error('Unexpected ranged branch'); },
  });
  vm.runInContext(extracted + '\nglobalThis.auditTick = updateServerMonsters;', context);
  const room = { world: { monsters: new Map([[1, monster]]), wave: 1 } };
  let finalSecondDistance = 0;
  const dt = .05;
  for (let i = 0; i < 400; i++) {
    now = (i + 1) * dt;
    const x = monster.x, z = monster.z;
    context.auditTick(room, [player], dt);
    if (i >= 380) finalSecondDistance += Math.hypot(monster.x - x, monster.z - z);
    if (i % 20 === 19) states.push({ time: now, x: monster.x, z: monster.z, distance: Math.hypot(monster.x - player.state.x, monster.z - player.state.z) });
  }
  let manualRoute = null;
  if (scenario.waypoints) {
    const body = { ...scenario.from, radius: .78 };
    let waypoint = 0, elapsed = 0;
    while (waypoint < scenario.waypoints.length && elapsed < 30) {
      const target = scenario.waypoints[waypoint], dx = target.x - body.x, dz = target.z - body.z, d = Math.hypot(dx, dz);
      if (d < .1) { waypoint++; continue; }
      const step = Math.min(d, 3.3 * dt);
      const moved = physics.moveActor(scenario.world, body, { x: dx / d * step, z: dz / d * step });
      body.x = moved.x; body.z = moved.z; elapsed += dt;
    }
    manualRoute = { description: 'Independent authored route using same collision world, not a proposed AI implementation',
      completed: waypoint === scenario.waypoints.length, elapsed, waypoints: scenario.waypoints, final: body };
  }
  const obstruction = physics.sweepStatic(scenario.world, { ...monster, y: 1 }, { ...player.state, y: 1 }, 0);
  const result = { id: scenario.id, initialCorrection, validInitialPlacement: initialCorrection < .001,
    sourceFunction: 'updateServerMonsters extracted verbatim', simulatedSeconds: 20, dt, states,
    hits, hitCount: hits.length, occludedHits: hits.filter(hit => hit.obstructionAtImpact).length,
    firstHitTime: hits[0]?.time ?? null, finalSecondDistance, finalDistance: states.at(-1).distance,
    obstructionAtEnd: obstruction, manualRoute };
  results.push(result);
  console.log(JSON.stringify({ id: result.id, validInitialPlacement: result.validInitialPlacement,
    hitCount: result.hitCount, occludedHits: result.occludedHits, firstHitTime: result.firstHitTime,
    finalDistance: result.finalDistance, finalSecondDistance, manualRouteCompleted: manualRoute?.completed,
    obstruction: obstruction?.colliderId }));
}
const after = fingerprint(), changedFiles = files.filter(p => before[p] !== after[p]);
const report = { startedAt, finishedAt: new Date().toISOString(), before, after, changedFiles, sourceStable: !changedFiles.length,
  evidenceKind: 'CPU extracted server function fixture, not network or gameplay capture',
  scope: 'Exact server pursuit and melee phases with actual physics/layout; callbacks observe hits and omit transport. Single stationary player and zombie. Manual waypoints only show an available route.',
  accepted: false, results };
const output = `output/qa/arpg-root-review/${startedAt.replace(/[:.]/g, '-')}-pursuit.json`;
fs.mkdirSync('output/qa/arpg-root-review', { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, sourceStable: report.sourceStable, changedFiles }));
if (changedFiles.length) process.exitCode = 2;
