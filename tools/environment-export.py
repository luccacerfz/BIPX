"""Versioned browser derivatives only. Run via Blender background with GPU reservation."""
import bpy, bmesh, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/Users/luccacerf/Projetos/Assets/Environment')
OUT=ROOT/'assets/environment/cemetery-v1'
OUT.mkdir(parents=True,exist_ok=True)
ASSETS=[
 ('blue-shrine','Harbor_Map/Source/Tripo/18_blue_shrine_tripo_v31_8k.glb',4800,768),
 ('barrel','Harbor_Map/Source/Tripo/08_barrel_tripo_v31_8k.glb',1400,512),
 ('rose-bush','Harbor_Map/Source/Tripo/12_rose_bush_tripo_v31_8k.glb',2400,512),
 ('border-rock','Tunnel_Map/Exports/Game/Families/04_border_rock_cluster/04_border_rock_cluster_LOD1.glb',2000,512),
 ('root-border','Tunnel_Map/Exports/Game/Families/07_root_border/07_root_border_LOD1.glb',1600,512),
 ('mushrooms','Tunnel_Map/Exports/Game/Families/26_mushroom_cluster/26_mushroom_cluster_LOD1.glb',1000,256),
 ('crypt-door','House_Reconstruction/Source/Tripo/03_door_tripo_v31.glb',2000,512),
 ('timber-beam','House_Reconstruction/Source/Tripo/09_timber_beam_tripo_v31.glb',800,256),
]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
report=[]
for name,relative,budget,texture_size in ASSETS:
 src=SOURCE/relative; before=sha(src)
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(src))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 original_faces=sum(len(o.data.polygons) for o in meshes)
 for obj in meshes:
  bm=bmesh.new();bm.from_mesh(obj.data)
  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
  bm.to_mesh(obj.data);bm.free();obj.data.update()
  if len(obj.data.polygons)>budget:
   bpy.context.view_layer.objects.active=obj
   mod=obj.modifiers.new('Cemetery_Runtime_Derivative','DECIMATE');mod.ratio=min(1,budget/len(obj.data.polygons))
   bpy.ops.object.modifier_apply(modifier=mod.name)
 textures=[]
 for img in bpy.data.images:
  if not img.size[0]:continue
  original=list(img.size); factor=min(1,texture_size/max(img.size))
  if factor<1:img.scale(max(1,round(img.size[0]*factor)),max(1,round(img.size[1]*factor)))
  textures.append({'name':img.name,'source':original,'runtime':list(img.size)})
 for mat in bpy.data.materials:
  if mat.use_nodes:
   for node in mat.node_tree.nodes:
    if node.type=='BSDF_PRINCIPLED':
     node.inputs['Roughness'].default_value=.87
     node.inputs['Metallic'].default_value=.02
 points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
 low=[min(v[i] for v in points) for i in range(3)];high=[max(v[i] for v in points) for i in range(3)]
 dst=OUT/(name+'.glb')
 # glTF returns Y-up; record sizes explicitly in world XYZ.
 bpy.ops.export_scene.gltf(filepath=str(dst),export_format='GLB',export_animations=False,export_image_format='JPEG',export_jpeg_quality=82,export_extras=False)
 assert before==sha(src),'Original changed'
 report.append({'id':name,'source':str(src),'sourceSha256Before':before,'sourceSha256After':sha(src),'sourcePreserved':True,'sourceTriangles':original_faces,'runtimeTriangles':sum(len(o.data.polygons) for o in meshes),'bytes':dst.stat().st_size,'sha256':sha(dst),'sizeXYZ':[high[0]-low[0],high[2]-low[2],high[1]-low[1]],'textures':textures})
 print('ENVIRONMENT_EXPORTED',name,report[-1]['runtimeTriangles'],report[-1]['bytes'],flush=True)
(OUT/'provenance.json').write_text(json.dumps({'version':1,'sourcesRoot':str(SOURCE),'assets':report},indent=2)+'\n')
print('ENVIRONMENT_COMPLETE',sum(r['bytes'] for r in report),flush=True)
