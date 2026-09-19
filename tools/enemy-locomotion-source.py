"""Convert authorized Mixamo source in a factory-started Blender, never save source."""
import bpy, hashlib, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
walking='--walk' in sys.argv
source=Path('/Users/luccacerf/Projetos/Assets/Characters/Arthas/Animations/Mixamo_ActionAdventure/running.fbx')
if walking: source=source.with_name('walking.fbx')
before=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(source),use_anim=True)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
action=rig.animation_data.action
scene=bpy.context.scene;scene.render.fps=30
scene.frame_start=int(action.frame_range[0]);scene.frame_end=int(action.frame_range[1]);scene.frame_set(scene.frame_start)
# Only armature nodes and motion are needed for retargeting, no donor geometry.
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
out=ROOT/f"assets/models/orc-peon-source/mixamo-{'walking' if walking else 'running'}.glb"
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_force_sampling=True,export_frame_step=1,export_anim_slide_to_zero=True,export_skins=True,export_yup=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
report={'source':str(source),'sourceSha256':before,'sourcePreserved':True,'output':str(out.relative_to(ROOT)),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'frames':list(action.frame_range),'fps':scene.render.fps,'bones':len(rig.data.bones),'blender':bpy.app.version_string}
(ROOT/('assets/models/orc-peon-source/walking.provenance.json' if walking else 'assets/models/orc-peon-source/provenance.json')).write_text(json.dumps(report,indent=2)+'\n')
print('MIXAMO_SOURCE='+json.dumps(report))
