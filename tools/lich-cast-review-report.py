"""Audit staged evidence; never modifies runtime or the source GLB."""
from pathlib import Path
import hashlib, json, math, struct, datetime

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'output/lich-cast-v1'
CPU = BASE / 'cpu-2026-09-19T02-27-46-139Z/report.json'
NATIVE = BASE / 'native-2026-09-19T02-28-07-583Z/report.json'
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
c, n = json.loads(CPU.read_text()), json.loads(NATIVE.read_text())
p = json.loads((BASE / 'preservation.json').read_text())
assert c['passed'] and n['passed'] and c['sourceStable'] and n['sourceStable']
assert not c['errors'] and not n['errors'] and n['gl']['error'] == 0
for file, expected in p['originalHashes'].items():
    assert sha(ROOT / file) == expected, file
for file, expected in n['after'].items():
    assert sha(ROOT / file) == expected, file

def glb(file):
    data = Path(file).read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + size]), data[28 + size:]

a, a_bin = glb(ROOT / 'assets/models/monsters/lich.glb')
b, b_bin = glb(BASE / 'assets/lich.glb')
sections = ['nodes', 'skins', 'meshes', 'materials', 'images', 'textures', 'samplers']
assert all(a.get(k) == b.get(k) for k in sections)
assert b_bin[:len(a_bin)] == a_bin
assert all(a['animations'][i] == b['animations'][i] for i in [0, 1, 2, 4])

summary = []
for playback in n['playbacks']:
    frames = playback['frames']
    end = frames[-1]['stats']
    assert end['currentClip'] == 'Idle' and not end['attack']['active']
    assert end['attack']['startCount'] == 1
    cancellations = [f for f in frames if (f['stats']['attack'] or {}).get('cancelReason')]
    if playback['mode'] == 'full':
        assert not cancellations and not end['attack']['cancelled']
    else:
        assert cancellations and end['attack']['cancelled']
        assert end['attack']['impactReached'] == ('after' in playback['mode'])
    summary.append(dict(view=playback['view'], mode=playback['mode'], frames=len(frames),
        castStarts=end['attack']['startCount'], finalClip=end['currentClip'],
        cancelled=end['attack']['cancelled'], reachedMarker=end['attack']['impactReached']))

release = c['cpu']['release']['socket']
for capture in n['captures']:
    if abs(capture['t'] - c['cpu']['profile']['releaseAt']) < 1e-9:
        expected = release if capture['view'] == 'close' else [-release[0], release[1], -release[2]]
        assert math.dist(capture['snapshot']['socket'], expected) < 1e-6
    assert capture['snapshot']['nonFinite'] == 0

samples = c['cpu']['samples']
report = dict(createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    stagingValidated=True, runtimePromoted=False, artisticAAAApproved=False,
    releaseMarkerReviewed=True, continuousVideoPerceptuallyReviewed=False,
    reviewMethod='Actual WebGL playback recorded; selected video frames and independently sampled poses inspected.',
    cpuChecks=len(c['cpu']['checks']), skinnedPoseChecks=len(samples),
    behaviorChecks=len(c['cpu']['checks'])-len(samples),
    fullMeshMinimumY=min(s['minY'] for s in samples),
    maximumFloorCorrection=c['cpu']['maxFloorCorrection'],
    playbackSummary=summary, nativeRenderer=n['gl'],
    originalSectionsEqual=sections, originalBinaryPrefixEqual=True,
    otherClipsUnchanged=True, runtimeOriginalHashes=p['originalHashes'],
    selectedCpu=str(CPU.relative_to(ROOT)), selectedNative=str(NATIVE.relative_to(ROOT)),
    historicalNativeFailure='native-2026-09-19T02-26-37-167Z: render harness passed, but post-stun seek screenshots showed T-pose; not visually accepted.',
    limits=['Fixture only; no projectile authority, networking or gameplay.',
            'ARPG hand readability limited at native camera distance.',
            'No foot-plant/no-slide acceptance; residual floor penetration is measured.',
            'Quick 0.10s return to Idle; continuous human motion review pending.'])
(BASE / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
files = [f for f in BASE.rglob('*') if f.is_file() and f.name != 'delivery-hashes.json']
files += sorted((ROOT / 'tools').glob('lich-cast-review*'))
handoff = ROOT / 'docs/arpg/lich-cast-asset-handoff.md'
if handoff.exists(): files.append(handoff)
(BASE / 'delivery-hashes.json').write_text(json.dumps({str(f.relative_to(ROOT)):sha(f) for f in files}, indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['stagingValidated','runtimePromoted','cpuChecks','behaviorChecks','skinnedPoseChecks','fullMeshMinimumY']}))
