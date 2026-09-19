"""CPU-only local FBX metadata/pose inspection. No export, retarget, render or save."""
import bpy, json, hashlib
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / 'output/brute-motion-v4/source-triage-v1'
inputs = json.loads((BASE / 'fbx-inputs.json').read_text())
previous = BASE / 'fbx-metadata.json'
output = json.loads(previous.read_text())['records'] if previous.exists() else []
def digest(file): return hashlib.sha256(Path(file).read_bytes()).hexdigest()
for record in inputs:
    if any(r['sha256'] == record['sha256'] for r in output): continue
    source = Path(record['path'])
    assert digest(source) == record['sha256']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=str(source), use_anim=True)
    except RuntimeError as error:
        output.append(dict(record, importError=str(error), sourcePreserved=digest(source) == record['sha256']))
        (BASE / 'fbx-metadata.json').write_text(json.dumps({'blender': bpy.app.version_string,
            'scope': 'Source rig CPU only; no animation export or retarget', 'records': output}, indent=2) + '\n')
        continue
    scene = bpy.context.scene
    rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    result = dict(record, fps=scene.render.fps / scene.render.fps_base,
                  meshes=len([o for o in bpy.data.objects if o.type == 'MESH']),
                  rigs=[{'name': r.name, 'bones': len(r.data.bones),
                         'names': [b.name for b in r.data.bones]} for r in rigs],
                  actions=[{'name': a.name, 'range': list(a.frame_range)} for a in bpy.data.actions])
    fingerprints = []
    for rig in rigs:
        action = rig.animation_data.action if rig.animation_data else None
        if not action: continue
        lo, hi = action.frame_range
        samples = []
        for i in range(9):
            frame = lo + (hi - lo) * i / 8
            scene.frame_set(int(frame), subframe=frame % 1)
            sample = {b.name: [round(x, 6) for x in (rig.matrix_world @ b.matrix).translation]
                      for b in rig.pose.bones}
            samples.append({'frame': frame, 'age': (frame - lo) / result['fps'], 'joints': sample})
        result.setdefault('posedRigs', []).append({'rig': rig.name, 'action': action.name,
            'duration': (hi - lo) / result['fps'], 'coordinateSystem': 'Blender world Z up', 'poses': samples})
        # Fingerprint rotations and translations evaluated on this specific donor rig.
        fingerprints.append(hashlib.sha256(json.dumps(samples, sort_keys=True).encode()).hexdigest())
    result['poseFingerprints'] = fingerprints
    result['sourcePreserved'] = digest(source) == record['sha256']
    assert result['sourcePreserved']
    output.append(result)
    print('SOURCE_METADATA', source.name, [(a['name'], a['range']) for a in result['actions']], flush=True)
    (BASE / 'fbx-metadata.json').write_text(json.dumps({'blender': bpy.app.version_string,
        'scope': 'Source rig CPU only; no animation export or retarget', 'records': output}, indent=2) + '\n')
