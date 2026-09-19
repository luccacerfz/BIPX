from pathlib import Path
import json, hashlib, shutil, struct, datetime, difflib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/lich-cast-v1'
CANDIDATE = Path('/tmp/bipx-caster-motion/lich/artifacts/monster-gesture.glb')
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(CANDIDATE) == 'd47d9a13ab7d3df9b1df1018735d56075fdedeb32b266c3ffcb9d3ca3a576599'
assert sha(ROOT/'assets/models/monsters/lich.glb') == 'f6ddd47d97757b4acee76c056baa26c644ff19e2afa17fb5630b00108e832e44'
preserved = ['assets/models/monsters/lich.glb','assets/models/monsters/zombie.glb','assets/models/monsters/brute.glb','assets/models/monsters/ground-probes.json','src/assets/monster-library.js','src/assets/load-glb.js','src/assets/enemy-control-state.js','src/assets/vendor/GLTFLoader.js','src/assets/vendor/SkeletonUtils.js','src/assets/vendor/BufferGeometryUtils.js','vendor/three/three.module.js']
before = {p: sha(ROOT/p) for p in preserved}
OUT.mkdir(parents=True, exist_ok=True)
assert not (OUT/'preservation.json').exists(), 'Staging already prepared: preserve it; do not overwrite a reviewed version.'
(OUT/'assets').mkdir(); (OUT/'source-history').mkdir(); (OUT/'provenance').mkdir()
for kind in ['zombie','brute']:
    shutil.copy2(ROOT/f'assets/models/monsters/{kind}.glb', OUT/f'assets/{kind}.glb')
shutil.copy2(CANDIDATE, OUT/'assets/lich.glb')
shutil.copy2(ROOT/'assets/models/monsters/ground-probes.json', OUT/'assets/ground-probes.json')
shutil.copy2(ROOT/'src/assets/monster-library.js', OUT/'source-history/monster-library-runtime.js')
for name in ['cpu-report.json','clips.json']:
    shutil.copy2(CANDIDATE.parent/name, OUT/'provenance'/name)
for name in ['conversion.json','spell cast.glb','spell cast.fbx']:
    shutil.copy2(Path('/tmp/bipx-caster-motion/source')/name, OUT/'provenance'/name)
shutil.copy2('/tmp/bipx-caster-motion/README.md', OUT/'provenance/previous-staging-readme.md')

profile = dict(id='lich-mixamo-cast-v1', actor='lich', sourceClip='Attack', sourceIndex=3,
    sourceDuration=1.1666666269302368, duration=1.10, releasePhase=19/35,
    releaseAt=1.10*19/35, sourceReleaseAt=1.1666666269302368*19/35,
    socketName='L_Hand', crop=None, authority='visual-only', projectileEmission=False,
    candidateSha256=sha(CANDIDATE), status='staging; visual review pending')
(OUT/'lich-cast-profile.js').write_text('export const LICH_CAST_PROFILE = Object.freeze('+json.dumps(profile,indent=2)+');\n')
source = (ROOT/'src/assets/monster-library.js').read_text()
text = source.replace("'./load-glb.js'", "'/src/assets/load-glb.js'").replace("'./vendor/SkeletonUtils.js'", "'/src/assets/vendor/SkeletonUtils.js'").replace("'./enemy-control-state.js'", "'/src/assets/enemy-control-state.js'")
text = "// STAGING ONLY: copied loader with explicit Lich profile; never imported by the game.\nimport { LICH_CAST_PROFILE } from './lich-cast-profile.js';\n"+text
def replace(old,new):
    global text
    assert text.count(old)==1, old
    text=text.replace(old,new)
replace('function normalizeClips(THREE, source) {','function normalizeClips(THREE, source, castProfile = null) {')
replace("  const retargeted = new Set(source.scene.userData.bipxMotion?.retargetedRoles || []);", "  const retargeted = new Set(source.scene.userData.bipxMotion?.retargetedRoles || []);\n  if (castProfile) retargeted.add('Attack');")
replace("if(name==='Attack'&&retargeted.has(name))", "if(name==='Attack'&&retargeted.has(name)&&!castProfile)")
replace("'../../assets/models/monsters/ground-probes.json'", "'./assets/ground-probes.json'")
replace('`../../assets/models/monsters/${definition.file}.glb`', '`./assets/${definition.file}.glb`')
replace('    const clips = normalizeClips(THREE, source);', "    const castProfile = id === 'lich' ? LICH_CAST_PROFILE : null;\n    if (castProfile && (source.animations[3].name !== 'Attack' || Math.abs(source.animations[3].duration - castProfile.sourceDuration) > 1e-6)) throw new Error('Lich profile requires the exact full staged Attack');\n    const clips = normalizeClips(THREE, source, castProfile);")
replace("    const attackWindow = motion?.retargetedRoles?.includes('Attack') ?", "    const attackWindow = castProfile ? { from: 0, to: source.animations[3].duration, fullDuration: source.animations[3].duration, defaultDuration: castProfile.duration, impactPhase: castProfile.releasePhase, profileId: castProfile.id } : motion?.retargetedRoles?.includes('Attack') ?")
replace('bones, skinnedMeshes, motion, attackWindow,','bones, skinnedMeshes, motion, attackWindow, castProfile,')
replace('return [id, { source, clips, definition, stats, motion }];','return [id, { source, clips, definition, stats, motion, castProfile }];')
replace("    const supportsPhaseAttack=entry.motion?.retargetedRoles?.includes('Attack')===true;", "    const castProfile = entry.castProfile;\n    const supportsPhaseAttack=Boolean(castProfile)||entry.motion?.retargetedRoles?.includes('Attack')===true;")
replace("actorStats.control?.paused || !snapshot", "(actorStats.control?.paused && (!castProfile || snapshot?.active !== false)) || !snapshot")
replace('Number(snapshot.duration)||.88', 'Number(snapshot.duration)||castProfile?.duration||.88')
replace('snapshot.impactPhase:.523','snapshot.impactPhase:(castProfile?.releasePhase??.523)')
replace('      root, model, stats: actorStats, syncAttack,', '''      root, model, stats: actorStats, syncAttack,
      castSocket: castProfile ? model.getObjectByName(castProfile.socketName) : null,
      cast(options = {}) {
        if (!castProfile) return false;
        return syncAttack({ id: options.castId ?? options.id ?? `cast:${++localAttackId}`,
          duration: castProfile.duration, impactPhase: castProfile.releasePhase,
          ...options, elapsed: options.elapsed ?? Math.max(0, options.ageMs || 0) / 1000 });
      },
      cancelCast(reason = 'cancelled') {
        if (!castProfile || !attackState?.active) return false;
        const result = syncAttack({ ...attackState, active: false });
        attackState.cancelReason = reason; publishAttack(); return result;
      },''')
replace('''        if (actorStats.control.paused) return;
        const delta''', '''        if (castProfile && (state.dead || actorStats.control.paused)) {
          actor.cancelCast(state.dead ? 'death' : actorStats.control.frozen ? 'freeze' : 'stun');
        }
        if (actorStats.control.paused || (castProfile && state.paused)) return;
        const delta''')
replace('duration:.88, ...options', 'duration:castProfile?.duration??.88, ...options')
replace('      next.fadeIn(fade).play();', '      if (castProfile && fade <= 0) next.stopFading().setEffectiveWeight(1).play();\n      else next.fadeIn(fade).play();')
(OUT/'monster-library-staged.js').write_text(text)
(OUT/'loader-changes.patch').write_text(''.join(difflib.unified_diff(source.splitlines(True),text.splitlines(True),fromfile='runtime-reference/monster-library.js',tofile='staging/monster-library-staged.js')))
assert before == {p:sha(ROOT/p) for p in preserved}
record=dict(createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),scope='staging only; original bytes preserved',originalHashes=before,candidateInput=str(CANDIDATE),candidateHash=sha(CANDIDATE),profile=profile,
    stagedHashes={str(p.relative_to(OUT)):sha(p) for p in OUT.rglob('*') if p.is_file()})
(OUT/'preservation.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'output':str(OUT),'candidateHash':sha(CANDIDATE),'runtimePreserved':True,'releaseAt':profile['releaseAt']}))
