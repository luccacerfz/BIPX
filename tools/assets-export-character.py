"""Export an isolated browser copy of the supplied Aldric assembly.

Run with Blender --background --factory-startup --python this-file.
Samples the evaluated deform rig (including corrected grips) before making a
constraint-free runtime skeleton. Original .blend and original actions untouched.
"""
from pathlib import Path
import hashlib, json, math
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/luccacerf/Projetos/Assets/Characters/Aldric_Leonguard/Blender/Aldric_Rebuilt.blend')
OUT = ROOT / 'assets/models'
OUT.mkdir(parents=True, exist_ok=True)
before = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.window.scene = bpy.data.scenes['Aldric_Leonguard_Rebuilt']
scene = bpy.context.scene
scene.render.fps = 30
rig = bpy.data.objects['Aldric_Rig']
driver = bpy.data.objects['Aldric_Animation_Driver']
body = bpy.data.objects['Aldric_Body']
props = [bpy.data.objects[n] for n in ['Aldric_Sword', 'Aldric_Shield']]
driver.animation_data_clear()
clips = {
    'Idle': 'Aldric | Demo | idle',
    'Run': 'Aldric | Demo | run',
    'Walk': 'Aldric | Demo | walk',
    'Attack': 'Aldric | Demo | slash',
    'AttackHeavy': 'Aldric | Demo | attack (2)',
    'Hit': 'Aldric | Demo | impact',
    'Death': 'Aldric | Original | sword and shield death',
}
samples = {}
for clip, action_name in clips.items():
    action = bpy.data.actions[action_name].copy()
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    if fc.data_path == 'pose.bones["mixamorig:Hips"].location' and fc.array_index in (0, 2):
                        for key in fc.keyframe_points:
                            key.co.y = key.handle_left.y = key.handle_right.y = 0
    driver.animation_data_create()
    driver.animation_data.action = action
    driver.animation_data.action_slot = action.slots[0]
    frames = []
    for frame in range(int(action.frame_range[0]), int(action.frame_range[1]) + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        frames.append({'bones': {b.name: b.matrix.copy() for b in evaluated.pose.bones},
                       'props': {p.name: p.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world.copy() for p in props}})
    samples[clip] = frames
    print('SAMPLED',clip,len(frames),flush=True)

runtime_scene = bpy.data.scenes.new('BIPX_Aldric_Runtime')
bpy.context.window.scene = runtime_scene
runtime_scene.render.fps = 30
newrig = bpy.data.objects.new('HeroRig', rig.data.copy())
runtime_scene.collection.objects.link(newrig)
newrig.matrix_world = rig.matrix_world.copy()
newbody = bpy.data.objects.new('HeroBody', body.data.copy())
runtime_scene.collection.objects.link(newbody)
newbody.parent = newrig
newbody.matrix_parent_inverse = body.matrix_parent_inverse.copy()
newbody.matrix_basis = body.matrix_basis.copy()
for group in body.vertex_groups:
    newbody.vertex_groups.new(name=group.name)
for vertex in body.data.vertices:
    for group in vertex.groups:
        newbody.vertex_groups[group.group].add([vertex.index], group.weight, 'REPLACE')
modifier = newbody.modifiers.new('HeroSkin', 'ARMATURE')
modifier.object = newrig
newprops = {}
prop_scales = {}
for prop in props:
    obj = bpy.data.objects.new(prop.name.replace('Aldric_', 'Hero'), prop.data.copy())
    runtime_scene.collection.objects.link(obj)
    # Bake centimetre mesh scale into geometry. Blender's NLA exporter otherwise
    # omits the constant .01 object scale when merging independent prop tracks.
    prop_scale = samples['Idle'][0]['props'][prop.name].to_scale()
    obj.data.transform(Matrix.Diagonal((*prop_scale, 1)))
    prop_scales[prop.name] = prop_scale
    newprops[prop.name] = obj

def preserve_clip(obj, clip):
    action = obj.animation_data.action
    action.name = clip + '_' + obj.name
    action.use_fake_user = True
    track = obj.animation_data.nla_tracks.new()
    track.name = clip
    strip = track.strips.new(clip, 1, action)
    strip.action_slot = action.slots[0]
    strip.extrapolation = 'NOTHING'
    obj.animation_data.action = None
    track.mute = True

for clip, frames in samples.items():
    for frame, sample in enumerate(frames, 1):
        runtime_scene.frame_set(frame)
        for bone in newrig.pose.bones:
            bone.rotation_mode = 'QUATERNION'
            parent_args = {} if bone.parent is None else {
                'parent_matrix': sample['bones'][bone.parent.name],
                'parent_matrix_local': bone.parent.bone.matrix_local,
            }
            bone.matrix_basis = bone.bone.convert_local_to_pose(
                sample['bones'][bone.name], bone.bone.matrix_local,
                invert=True, **parent_args)
        for bone in newrig.pose.bones:
            for path in ('location', 'rotation_quaternion', 'scale'):
                bone.keyframe_insert(data_path=path, frame=frame, group=bone.name)
        for name, obj in newprops.items():
            obj.rotation_mode = 'QUATERNION'
            location, rotation, scale = sample['props'][name].decompose()
            scale = Vector([scale[i] / prop_scales[name][i] for i in range(3)])
            obj.matrix_world = Matrix.LocRotScale(location, rotation, scale)
            for path in ('location', 'rotation_quaternion', 'scale'):
                obj.keyframe_insert(data_path=path, frame=frame)
    for obj in [newrig, *newprops.values()]:
        preserve_clip(obj, clip)
for obj in [newrig, *newprops.values()]:
    for track in obj.animation_data.nla_tracks:
        track.mute = False

# Images are modified only in this isolated process, and encoded into the GLB.
texture_report = []
for img in bpy.data.images:
    if img.size[0] > 0:
        original_size = list(img.size)
        cap = 1024
        factor = min(1, cap / max(img.size))
        if factor < 1:
            img.scale(round(img.size[0]*factor), round(img.size[1]*factor))
        texture_report.append({'name':img.name,'sourceSize':original_size,'runtimeSize':list(img.size)})
for mat in bpy.data.materials:
    if mat.use_nodes:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Roughness'].default_value = .69
                node.inputs['Metallic'].default_value = .08

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = newrig
runtime_scene.frame_start = 1
runtime_scene.frame_end = max(len(v) for v in samples.values())
runtime_scene.frame_set(1)
dest = OUT/'aldric-hero.glb'
bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_merge_animation='NLA_TRACK',
    export_force_sampling=True, export_frame_step=1, export_anim_slide_to_zero=True,
    export_skins=True, export_image_format='JPEG', export_jpeg_quality=87,
    export_optimize_animation_size=True, export_yup=True, export_extras=False)
after = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert before == after, 'Source changed during isolated export'
report = {'source':str(SOURCE),'sourceSha256Before':before,'sourceSha256After':after,'sourcePreserved':before==after,
    'export':str(dest.relative_to(ROOT)),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size,
    'blender':bpy.app.version_string,'rigBones':len(newrig.data.bones),'bodyVertices':len(newbody.data.vertices),
    'propVertices':{obj.name:len(obj.data.vertices) for obj in newprops.values()},
    'clips':{name:{'frames':len(frames),'fps':30,'duration':(len(frames)-1)/30} for name,frames in samples.items()},
    'textures':texture_report,'method':'Evaluated source deform bones and world-space attached props sampled every frame into separate constrained-free runtime scene. NLA tracks merged by clip name.',
    'rootMotion':'Planar Mixamo hip translation removed from action copies only. Vertical body weight retained.',
    'validation':'Export structure proven; visual GLB re-import and browser playback are separate gates.'}
(OUT/'aldric-hero.provenance.json').write_text(json.dumps(report,indent=2))
print('BIPX_HERO_EXPORT_OK',json.dumps(report),flush=True)
