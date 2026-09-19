"""Export an isolated GLB copy; never save the supplied master."""
from pathlib import Path
import bpy, hashlib, json
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/Users/luccacerf/Projetos/Assets/Characters/OrcPeasantMiner/Source/OrcPeasantMiner_Animation_Master.blend')
before=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
source_scene=bpy.context.scene
rig=bpy.data.objects['OrcPeasantMiner_Tripo_Rig']; body=bpy.data.objects['OrcPeasantMiner_Body']
socket=bpy.data.objects['Miner_Sickle_GripSocket']; equipment=bpy.data.objects['OrcPeasantMiner_Equipment']
scene=bpy.data.scenes.new('BIPX_Orc_Runtime'); scene.render.fps=24
bpy.context.window.scene=scene
newrig=bpy.data.objects.new('OrcRig',rig.data.copy());scene.collection.objects.link(newrig);newrig.matrix_world=rig.matrix_world.copy()
newbody=body.copy();newbody.data=body.data.copy();newbody.name='OrcBody';scene.collection.objects.link(newbody);newbody.parent=newrig
# Bake the authored hand closing shape into this independent runtime mesh.
key_values={key.name:key.value for key in newbody.data.shape_keys.key_blocks}
keys=newbody.data.shape_keys.key_blocks
coords=[v.co.copy() for v in keys[0].data]
for key in list(keys)[1:]:
 for i,v in enumerate(key.data): coords[i]+=(v.co-keys[0].data[i].co)*key.value
newbody.shape_key_clear()
for v,co in zip(newbody.data.vertices,coords):v.co=co
for modifier in newbody.modifiers:
 if modifier.type=='ARMATURE':modifier.object=newrig
newsocket=socket.copy();newsocket.name='OrcGrip';scene.collection.objects.link(newsocket);newsocket.parent=newrig
newweapon=equipment.copy();newweapon.data=equipment.data.copy();newweapon.name='OrcSickle';scene.collection.objects.link(newweapon);newweapon.parent=newsocket
newweapon.hide_set(False);newweapon.hide_render=False
clips={}
bpy.context.view_layer.update()
newrig.animation_data_create()
for name in ['Idle','Walk','Attack','Hit','Death','Mine']:
 action=bpy.data.actions[name].copy();action.name='Orc_'+name;action.use_fake_user=True
 newrig.animation_data.action=action
 newrig.animation_data.action_slot_handle=action.slots[0].handle
 # Preserve the motion and add only the vertical offset needed to stay above
 # ground. The supplied death animation sinks into the ground at its endpoint.
 maximum_lift=0.0
 floor_samples=[]
 for frame in range(int(action.frame_range[0]),int(action.frame_range[1])+1):
  scene.frame_set(frame);bpy.context.view_layer.update()
  evaluated_body=newbody.evaluated_get(bpy.context.evaluated_depsgraph_get())
  lowest=min((evaluated_body.matrix_world@v.co).z for v in evaluated_body.data.vertices)
  lift=max(0,.0005-lowest);maximum_lift=max(maximum_lift,lift)
  rootbone=newrig.pose.bones['Root'];matrix=rootbone.matrix.copy()
  matrix.translation+=newrig.matrix_world.inverted().to_3x3()@Vector((0,0,lift))
  floor_samples.append((frame,matrix))
 for frame,matrix in floor_samples:
  rootbone.matrix_basis=rootbone.bone.convert_local_to_pose(matrix,rootbone.bone.matrix_local,invert=True)
  rootbone.keyframe_insert(data_path='location',frame=frame,group='Root')
 track=newrig.animation_data.nla_tracks.new();track.name=name
 strip=track.strips.new(name,1,action);strip.extrapolation='NOTHING';track.mute=True
 newrig.animation_data.action=None
 clips[name]={'frames':list(action.frame_range),'fps':24,'duration':(action.frame_range[1]-action.frame_range[0])/24,'maximumFloorCorrectionMeters':maximum_lift}
for track in newrig.animation_data.nla_tracks:track.mute=False
texture_report=[]
for image in bpy.data.images:
 if image.size[0]>0:
  size=list(image.size);factor=min(1,1024/max(size))
  if factor<1:image.scale(round(size[0]*factor),round(size[1]*factor))
  texture_report.append({'name':image.name,'original':size,'runtime':list(image.size)})
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=newrig
scene.frame_start=1;scene.frame_end=369;scene.frame_set(1)
dest=ROOT/'assets/models/orc-peon.glb'
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,
 export_animations=True,export_animation_mode='NLA_TRACKS',export_merge_animation='NLA_TRACK',
 export_force_sampling=True,export_frame_step=1,export_anim_slide_to_zero=True,export_skins=True,
 export_image_format='JPEG',export_jpeg_quality=87,export_optimize_animation_size=True,export_yup=True)
after=hashlib.sha256(SOURCE.read_bytes()).hexdigest();assert before==after
report={'source':str(SOURCE),'sourceSha256Before':before,'sourceSha256After':after,'sourcePreserved':before==after,
 'export':str(dest.relative_to(ROOT)),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size,
 'blender':bpy.app.version_string,'rigBones':len(newrig.data.bones),'bodyVertices':len(newbody.data.vertices),'weaponVertices':len(newweapon.data.vertices),
 'clips':clips,'textures':texture_report,'bakedShapeKeys':key_values,'weaponParentBone':newsocket.parent_bone,
 'method':'Separate runtime scene with copied native rig and actions, authored hand grip shape baked into copied body, native bone-parented sickle socket preserved.'}
(dest.with_suffix('.provenance.json')).write_text(json.dumps(report,indent=2))
print('ORC_EXPORT_OK='+json.dumps(report),flush=True)
