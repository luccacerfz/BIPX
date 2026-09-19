import bpy, json
from pathlib import Path

source=Path('/Users/luccacerf/Projetos/Assets/Characters/OrcPeasantMiner/Source/OrcPeasantMiner_Animation_Master.blend')
bpy.ops.wm.open_mainfile(filepath=str(source))
report={'blender':bpy.app.version_string,'scenes':[s.name for s in bpy.data.scenes],'objects':[], 'actions':[], 'images':[]}
for obj in bpy.data.objects:
    report['objects'].append({'name':obj.name,'type':obj.type,'parent':obj.parent.name if obj.parent else None,'dimensions':list(obj.dimensions),'scale':list(obj.scale),'vertices':len(obj.data.vertices) if obj.type=='MESH' else 0,'bones':len(obj.data.bones) if obj.type=='ARMATURE' else 0,'constraints':len(obj.constraints),'modifiers':[(m.name,m.type) for m in obj.modifiers],'animation':obj.animation_data.action.name if obj.animation_data and obj.animation_data.action else None})
for action in bpy.data.actions:
    report['actions'].append({'name':action.name,'range':list(action.frame_range),'slots':[s.identifier for s in action.slots]})
for img in bpy.data.images:
    report['images'].append({'name':img.name,'size':list(img.size),'packed':bool(img.packed_file),'filepath':img.filepath})
print('ASSET_INSPECTION='+json.dumps(report))

rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
print('ORC_DETAILS='+json.dumps({'bones':[(b.name,b.parent.name if b.parent else None) for b in rig.data.bones],'constraints':[(b.name,[(c.name,c.type) for c in b.constraints]) for b in rig.pose.bones if b.constraints],'shapeKeys':[(o.name,[(k.name,k.value) for k in o.data.shape_keys.key_blocks]) for o in bpy.data.objects if o.type=='MESH' and o.data.shape_keys],'fps':bpy.context.scene.render.fps}))
