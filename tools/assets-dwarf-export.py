"""Export an isolated browser copy of the supplied Lyra assembly.

Run with Blender --background --factory-startup --python this-file.
Samples the evaluated deform rig (including corrected grips) before making a
constraint-free runtime skeleton. Original .blend and original actions untouched.
"""
from pathlib import Path
import hashlib, json, math
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/luccacerf/Projetos/Assets/Characters/Lyra_Brasswarden/Blender/Lyra_Brasswarden_Rebuilt.blend')
OUT = ROOT / 'assets/models'
OUT.mkdir(parents=True, exist_ok=True)
before = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
bpy.context.window.scene = bpy.data.scenes['Lyra_Brasswarden']
scene = bpy.context.scene
scene.render.fps = 30
rig = bpy.data.objects['Lyra_Rig']
driver = bpy.data.objects['Lyra_Animation_Driver']
body = bpy.data.objects['Lyra_Body']
props = [bpy.data.objects['Lyra_Steam_Blunderbuss']]
settings = bpy.data.objects['Lyra_Animation_Settings']
settings.animation_data_clear()
settings['support_contact'] = 1.0
settings['right_grip'] = 1.0
settings['weapon_left_carry'] = 0.0
settings.update_tag()
muzzle_source = bpy.data.objects['Lyra_Muzzle']
driver.animation_data_clear()
clips = {
    'Idle': 'Lyra | Original | rifle aiming idle',
    'Run': 'Lyra | Original | rifle run',
    'Walk': 'Lyra | Original | walking',
    'Shoot': 'Lyra | Original | firing rifle',
    'Hit': 'Lyra | Original | hit reaction',
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

death_path = Path('/Users/luccacerf/Projetos/Assets/Characters/Aldric_Leonguard/Source/Mixamo/sword and shield death.fbx')
death_hash = hashlib.sha256(death_path.read_bytes()).hexdigest()
existing = set(bpy.data.objects)
bpy.ops.wm.fbx_import(filepath=str(death_path))
death_rig = next(o for o in bpy.data.objects if o not in existing and o.type == 'ARMATURE')
death_action = death_rig.animation_data.action
scene.render.fps = 30
driver.animation_data_clear()
target_rest = {b.name: driver.matrix_world @ b.matrix_local for b in driver.data.bones}
source_rest = {b.name: death_rig.matrix_world @ b.matrix_local for b in death_rig.data.bones}
hip = 'mixamorig:Hips'
height_ratio = target_rest[hip].translation.z / source_rest[hip].translation.z
driver_inverse = driver.matrix_world.inverted()
death_frames = []
maximum_lift = 0.0
for frame in range(int(death_action.frame_range[0]), int(death_action.frame_range[1]) + 1):
    scene.frame_set(frame)
    # The support hand releases during the fall. Keeping the off-hand locked
    # after the rifle arm extends exceeds the shoulder reach in this source.
    release = min(1.0, max(0.0, (frame - 18) / 14))
    settings['support_contact'] = 1.0 - release * release * (3.0 - 2.0 * release)
    settings.update_tag()
    bpy.context.view_layer.update()
    desired_world = {}
    desired_local = {}
    for bone in driver.pose.bones:
        source_pose = death_rig.matrix_world @ death_rig.pose.bones[bone.name].matrix
        rest = target_rest[bone.name]
        rotation_delta = source_pose.to_quaternion() @ source_rest[bone.name].to_quaternion().inverted()
        rotation = rotation_delta @ rest.to_quaternion()
        if bone.parent:
            location = desired_world[bone.parent.name] @ target_rest[bone.parent.name].inverted() @ rest.translation
        else:
            location = rest.translation.copy()
            location.z += (source_pose.translation.z - source_rest[bone.name].translation.z) * height_ratio
        desired_world[bone.name] = Matrix.LocRotScale(location, rotation, rest.to_scale())
        desired_local[bone.name] = driver_inverse @ desired_world[bone.name]
        parent_args = {} if bone.parent is None else {
            'parent_matrix': desired_local[bone.parent.name],
            'parent_matrix_local': bone.parent.bone.matrix_local,
        }
        bone.matrix_basis = bone.bone.convert_local_to_pose(desired_local[bone.name], bone.bone.matrix_local, invert=True, **parent_args)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = rig.evaluated_get(depsgraph)
    evaluated_body = body.evaluated_get(depsgraph)
    lowest_z = min((evaluated_body.matrix_world @ v.co).z for v in evaluated_body.data.vertices)
    lift = max(0, .0005 - lowest_z)
    maximum_lift = max(maximum_lift, lift)
    bone_shift = rig.matrix_world.inverted().to_3x3() @ Vector((0, 0, lift))
    matrices = {b.name: b.matrix.copy() for b in evaluated.pose.bones}
    for matrix in matrices.values():
        matrix.translation += bone_shift
    prop_matrices = {p.name: p.evaluated_get(depsgraph).matrix_world.copy() for p in props}
    for matrix in prop_matrices.values():
        matrix.translation.z += lift
    death_frames.append({'bones': matrices, 'props': prop_matrices})
samples['Death'] = death_frames
death_report = {'source':str(death_path),'sha256':death_hash,'sourcePreserved':death_hash==hashlib.sha256(death_path.read_bytes()).hexdigest(),
    'method':'World rotation delta from source rest applied to target rest, target limb lengths retained, root planar motion removed, hip vertical scaled by rest height, support grip constraints evaluated.',
    'frames':len(death_frames),'hipHeightRatio':height_ratio,'maximumFloorCorrectionMeters':maximum_lift,
    'supportHandReleaseFrames':[18,32],'primaryHandRetainsRifle':True}
print('DEATH_RETARGET', json.dumps(death_report), flush=True)
runtime_scene = bpy.data.scenes.new('BIPX_Lyra_Runtime')
bpy.context.window.scene = runtime_scene
runtime_scene.render.fps = 30
newrig = bpy.data.objects.new('DwarfRig', rig.data.copy())
runtime_scene.collection.objects.link(newrig)
newrig.matrix_world = rig.matrix_world.copy()
newbody = bpy.data.objects.new('DwarfBody', body.data.copy())
runtime_scene.collection.objects.link(newbody)
newbody.parent = newrig
newbody.matrix_parent_inverse = body.matrix_parent_inverse.copy()
newbody.matrix_basis = body.matrix_basis.copy()
for group in body.vertex_groups:
    newbody.vertex_groups.new(name=group.name)
for vertex in body.data.vertices:
    for group in vertex.groups:
        newbody.vertex_groups[group.group].add([vertex.index], group.weight, 'REPLACE')
modifier = newbody.modifiers.new('DwarfSkin', 'ARMATURE')
modifier.object = newrig
newprops = {}
prop_scales = {}
for prop in props:
    obj = bpy.data.objects.new('DwarfRifle', prop.data.copy())
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

muzzle = bpy.data.objects.new('DwarfMuzzle', None)
runtime_scene.collection.objects.link(muzzle)
muzzle.parent = newprops[props[0].name]
# Preserve the authored barrel socket after the rifle centimetre scale is baked.
muzzle.matrix_basis = Matrix.Diagonal((*prop_scales[props[0].name], 1)) @ muzzle_source.matrix_basis
support = bpy.data.objects.new('DwarfForegrip', None)
runtime_scene.collection.objects.link(support)
support.parent = newprops[props[0].name]
support.matrix_basis = Matrix.Diagonal((*prop_scales[props[0].name], 1)) @ bpy.data.objects['Lyra_Foregrip_Contact'].matrix_basis
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
dest = OUT/'dwarf-rifleman.glb'
bpy.ops.export_scene.gltf(filepath=str(dest), export_format='GLB', use_selection=True,
    export_animations=True, export_animation_mode='NLA_TRACKS', export_merge_animation='NLA_TRACK',
    export_force_sampling=True, export_frame_step=1, export_anim_slide_to_zero=True,
    export_skins=True, export_image_format='JPEG', export_jpeg_quality=87,
    export_optimize_animation_size=True, export_yup=True, export_extras=False)
after = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
assert before == after, 'Source changed during isolated export'
report = {'source':str(SOURCE),'sourceSha256Before':before,'sourceSha256After':after,'sourcePreserved':before==after,
    'export':str(dest.relative_to(ROOT)),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size,
    'blender':bpy.app.version_string,'rigBones':len(newrig.data.bones),'bodyVertices':len(newbody.data.vertices), 'displayName':'Lyra Brasswarden', 'deathRetarget':death_report,
    'propVertices':{obj.name:len(obj.data.vertices) for obj in newprops.values()},
    'clips':{name:{'frames':len(frames),'fps':30,'duration':(len(frames)-1)/30} for name,frames in samples.items()},
    'textures':texture_report,'method':'Evaluated source deform bones and world-space attached props sampled every frame into separate constrained-free runtime scene. NLA tracks merged by clip name.',
    'rootMotion':'Planar Mixamo hip translation removed from action copies only. Vertical body weight retained.',
    'validation':'Export structure proven; visual GLB re-import and browser playback are separate gates.'}
(OUT/'dwarf-rifleman.provenance.json').write_text(json.dumps(report,indent=2))
print('BIPX_HERO_EXPORT_OK',json.dumps(report),flush=True)
