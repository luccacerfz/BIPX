"""Create compact GLB copies from locally supplied Tripo environment sources."""
from pathlib import Path
import bpy, bmesh, json, hashlib

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/Users/luccacerf/Projetos/Assets/Environment/Harbor_Map/Source/Tripo')
OUT=ROOT/'assets/models'
ASSETS={'cedar-tree':'13_tree','lantern-post':'10_lantern_post','rune-portal':'20_rune_portal','ruined-wall':'02_wall'}
report=[]
for name,prefix in ASSETS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    src=SOURCE/(prefix+'_tripo_v31_8k.glb')
    before=hashlib.sha256(src.read_bytes()).hexdigest()
    bpy.ops.import_scene.gltf(filepath=str(src))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    original_faces=sum(len(o.data.polygons) for o in meshes)
    for obj in meshes:
        # Tripo GLBs duplicate positions at UV seams. Collapse geometry seams
        # before decimation so simplification cannot pull adjacent faces apart.
        bm=bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
        if len(obj.data.polygons)>6500:
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('Browser_LOD','DECIMATE')
            mod.ratio=min(1,6500/len(obj.data.polygons))
            bpy.ops.object.modifier_apply(modifier=mod.name)
    texture_report=[]
    for img in bpy.data.images:
        if img.size[0]:
            size=list(img.size)
            factor=min(1,1024/max(img.size))
            if factor<1: img.scale(round(img.size[0]*factor),round(img.size[1]*factor))
            texture_report.append({'name':img.name,'source':size,'runtime':list(img.size)})
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type=='BSDF_PRINCIPLED':
                    node.inputs['Roughness'].default_value=.86
                    node.inputs['Metallic'].default_value=.04
    dst=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(dst),export_format='GLB',export_animations=False,export_image_format='JPEG',export_jpeg_quality=85,export_extras=False)
    after=hashlib.sha256(src.read_bytes()).hexdigest()
    assert before==after
    report.append({'name':name,'source':str(src),'sourceSha256Before':before,'sourceSha256After':after,'sourcePreserved':True,'bytes':dst.stat().st_size,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'sourceFaces':original_faces,'runtimeFaces':sum(len(o.data.polygons) for o in meshes),'textures':texture_report})
    print('ENV_EXPORTED',name,dst.stat().st_size,flush=True)
(OUT/'environment.provenance.json').write_text(json.dumps(report,indent=2))
