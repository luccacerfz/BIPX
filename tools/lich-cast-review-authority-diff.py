"""Generate review artifacts only. No runtime target is written or patched."""
from pathlib import Path
import difflib, hashlib, json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/lich-cast-v1/combat-proposal'
parts = []
for name in ['caster-cast.mjs', 'caster-caller-boundary.mjs']:
    content = (OUT / name).read_text()
    parts.extend(difflib.unified_diff([], content.splitlines(True), fromfile='/dev/null', tofile=f'b/src/combat/{name}'))
(OUT / 'new-core.diff').write_text(''.join(parts))

# Exact caller expressions from the frozen source reference, not guessed defaults.
main = (OUT / 'source-reference/main.js').read_text()
server = (OUT / 'source-reference/server.mjs').read_text()
client_old = '''          zombie.attackCooldown = getRangedCooldown(zombie.type);
          spawnEnemyProjectile(zombie, target);
'''
server_old = '''        monster.attackCooldown = getServerRangedCooldown(monster.type);
        spawnServerProjectile(room, monster, target, directionX, directionZ);
'''
assert main.count(client_old) == 1 and server.count(server_old) == 1
client_new = '''          // REVIEW ONLY: for type==='caster'; other ranged types keep old path.
          // Identity/state is per offline world + monster, never per target/player.
          const plan = stepCasterCaller({
            state: zombie.casterCast, worldEpoch: game.casterWorldEpoch,
            actor: casterActorContext, target: lockedTargetContext,
            tick: game.casterWorldTick, dt, paused,
            ready: zombie.attackCooldown <= 0,
            inRange: canUseRangedAttack(zombie.type, lockedTargetDistance),
            losClear: clearEnemyMelee(zombie.mesh.position, lockedTarget.position),
            cooldownDuration: getRangedCooldown(zombie.type),
          });
          zombie.casterCast = plan.state; // commit BEFORE consuming events
          if (plan.assignCooldown !== null) zombie.attackCooldown = plan.assignCooldown;
          // prepare publishes only a cast; no projectile here.
          // Active casts must also call this boundary OUTSIDE the readiness/range
          // branch, BEFORE no-target/control early returns (see proposal doc).
          // Consume each eventId once. Only authority consumes phase==='release':
          // spawnEnemyProjectile(zombie, lockedTarget, lockedDirectionVector);
          // Preserve existing spec/damage; carry remainderAfterRelease to first
          // projectile update, and skip legacy .65s visual attack for this cast.
'''
server_new = '''        // REVIEW ONLY: for monster.type==='caster'; bosses keep old path.
        // One world.casterTick/monster step, OUTSIDE any playingClients loop.
        const plan = stepCasterCaller({
          state: monster.casterCast, worldEpoch: world.epoch,
          actor: casterActorContext, target: lockedTargetContext,
          tick: world.casterTick, dt, paused: worldPaused,
          ready: monster.attackCooldown <= 0,
          inRange: profile.ranged && lockedTargetDistance < 22 &&
            lockedTargetDistance > meleeRange + 1.2,
          losClear: lockedTargetLineOfSight, // same y=.9/radius0 sweep, fresh
          cooldownDuration: getServerRangedCooldown(monster.type),
        });
        monster.casterCast = plan.state; // shared by all observers
        if (plan.assignCooldown !== null) monster.attackCooldown = plan.assignCooldown;
        // prepare/release/cancel/end publication is a future Combat hook.
        // At release only, once/eventId, use freshly validated locked target:
        // spawnServerProjectile(room, monster, lockedTarget, e.direction.x, e.direction.z);
        // Keep collisionHeight/radius/damage/offset unchanged; account for
        // e.remainderAfterRelease on this newly emitted projectile's first step.
'''
patch = '# REVIEW SKETCH ONLY, NOT AN APPLY-READY RUNTIME PATCH.\n'
patch += '# Context identifiers below require lifecycle hooks documented in lich-cast-authority-proposal.md.\n'
for name, old, new in [('main-caster-ranged-branch', client_old, client_new), ('server-caster-ranged-branch', server_old, server_new)]:
    patch += ''.join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), fromfile=f'caller-reference/{name}', tofile=f'caller-proposal/{name}'))
(OUT / 'caller-integration-sketch.diff').write_text(patch)
print(json.dumps({'newCoreDiff':str(OUT/'new-core.diff'), 'callerSketch':str(OUT/'caller-integration-sketch.diff'), 'runtimeWritten':False}))
