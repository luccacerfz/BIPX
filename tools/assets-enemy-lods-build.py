"""CPU-only static enemy LOD copies from exact runtime idle vertex snapshots."""
from pathlib import Path
import bpy,bmesh,json,hashlib,math,struct
from mathutils import Vector
ROOT=Path('/tmp/bipx-enemy-lods')
reports=[]
for asset_id in ['orcPeon','zombie','brute','lich']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 data=json.loads((ROOT/'posed'/f'{asset_id}.json').read_text())
 source=Path(data['source']);assert hashlib.sha256(source.read_bytes()).hexdigest()==data['sourceSha256']
 bpy.ops.import_scene.gltf(filepath=str(source))
 for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
 scene=bpy.context.scene
 runtime=[];reference=[];mesh_reports=[]
 weapon_triangles=sum((len(m['indices']) if m['indices'] else len(m['positions'])//3)//3 for m in data['meshes'][1:])
 for mi,m in enumerate(data['meshes']):
  pos=m['positions'];verts=[(pos[i],-pos[i+2],pos[i+1]) for i in range(0,len(pos),3)]
  inds=m['indices'] if m['indices'] else list(range(len(verts)));faces=[inds[i:i+3] for i in range(0,len(inds),3)]
  mesh=bpy.data.meshes.new(m['name']+'_Idle');mesh.from_pydata(verts,[],faces);mesh.update()
  obj=bpy.data.objects.new(m['name']+'_LOD',mesh);scene.collection.objects.link(obj)
  if m['uv']:
   uv=mesh.uv_layers.new(name='UVMap')
   for loop in mesh.loops:uv.data[loop.index].uv=(m['uv'][2*loop.vertex_index],1-m['uv'][2*loop.vertex_index+1])
  for mat in m['materials']:
   material=bpy.data.materials.get(mat['name']);assert material,mat['name'];mesh.materials.append(material)
  for polygon in mesh.polygons:polygon.use_smooth=True
  ref=obj.copy();ref.data=mesh.copy();ref.name=m['name']+'_Reference';scene.collection.objects.link(ref);ref.hide_render=True;reference.append(ref)
  # Weld imported UV seam duplicates before collapse; UVs remain per-loop.
  bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);bm.to_mesh(mesh);bm.free()
  mesh.calc_loop_triangles();before=len(mesh.loop_triangles)
  target=(670 if mi==0 else max(12,round(230*len(faces)/weapon_triangles))) if asset_id=='orcPeon' else 900
  modifier=obj.modifiers.new('Static distance simplification','DECIMATE');modifier.ratio=min(1,target/max(1,before));modifier.use_collapse_triangulate=True
  bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.modifier_apply(modifier=modifier.name);obj.select_set(False)
  obj.data.calc_loop_triangles();mesh_reports.append({'name':m['name'],'sourceTriangles':len(faces),'weldedTriangles':before,'targetTriangles':target,'triangles':len(obj.data.loop_triangles)})
  runtime.append(obj)
 # Normalize the final simplified shape after extrema reduction, keep root X/Z.
 min_z=min(v.co.z for obj in runtime for v in obj.data.vertices);max_z=max(v.co.z for obj in runtime for v in obj.data.vertices);height=max_z-min_z
 for obj in runtime:
  for v in obj.data.vertices:v.co=(v.co-Vector((0,0,min_z)))/height
 for obj in reference:
  for v in obj.data.vertices:v.co=(v.co-Vector((0,0,min_z)))/height
 for img in bpy.data.images:
  if max(img.size)>512:
   scale=512/max(img.size);img.scale(round(img.size[0]*scale),round(img.size[1]*scale))
 bpy.ops.object.select_all(action='DESELECT')
 for obj in runtime:obj.select_set(True)
 bpy.context.view_layer.objects.active=runtime[0];bpy.ops.object.join();lod=bpy.context.object;lod.name=asset_id+'_LOD';lod.data.name=asset_id+'_StaticMesh'
 dest=ROOT/'models'/f'{asset_id}.glb'
 bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_animations=False,export_skins=False,export_morph=False,export_image_format='JPEG',export_jpeg_quality=82,export_yup=True)
 after=hashlib.sha256(source.read_bytes()).hexdigest();assert after==data['sourceSha256']
 report={'id':asset_id,'file':dest.name,'source':str(source),'sourceSha256Before':data['sourceSha256'],'sourceSha256After':after,'sourcePreserved':True,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'bytes':dest.stat().st_size,'triangles':sum(m['triangles'] for m in mesh_reports),'meshes':mesh_reports,'height':1,'sourceHeight':data['stats']['sourceHeight'],'normalizationScaleAfterDecimation':1/height,'groundOffsetBeforeNormalization':min_z,'forward':[0,0,-1],'textures':[[i.name,list(i.size)] for i in bpy.data.images if i.size[0]],'pose':'Exact runtime loader Idle at time 0, deformed on CPU before simplification','skeletons':0,'animations':0,'blender':bpy.app.version_string}
 raw=dest.read_bytes();json_size=struct.unpack_from('<I',raw,12)[0];gltf=json.loads(raw[20:20+json_size]);report['trianglesBeforeGltfCleanup']=report['triangles'];report['triangles']=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']);report['primitives']=sum(len(m['primitives']) for m in gltf['meshes']);report['nodes']=len(gltf['nodes'])
 reports.append(report);(ROOT/'manifest.json').write_text(json.dumps(reports,indent=2));print('LOD_EXPORT='+json.dumps(report),flush=True)
 # Actual Blender Cycles CPU comparison: left LOD, right original posed geometry.
 bpy.ops.object.select_all(action='DESELECT')
 for obj in reference:obj.hide_render=False;obj.location.x=-.62
 lod.location.x=.62
 floor_mat=bpy.data.materials.new('Review floor');floor_mat.diffuse_color=(.025,.045,.055,1)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object;floor.data.materials.append(floor_mat)
 world=bpy.data.worlds.new('Review world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.17,.21,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6;scene.world=world
 for name,loc,energy,color,size in [('Key',(-2,3,4),280,(1,.78,.58),3),('Fill',(3,1,3),200,(.55,.76,1),3),('Rim',(0,-3,3),240,(.54,.73,1),2)]:
  light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.color=color;light.shape='DISK';light.size=size;o=bpy.data.objects.new(name,light);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
 camera_data=bpy.data.cameras.new('Review Camera');camera=bpy.data.objects.new('Review Camera',camera_data);scene.collection.objects.link(camera);camera.location=(.8,4,1.85);camera.rotation_euler=(Vector((0,0,.52))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=2.7;scene.camera=camera
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=800;scene.render.resolution_y=500;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'review'/f'{asset_id}-lod-left-original-right.png');scene.view_settings.view_transform='AgX'
 bpy.ops.render.render(write_still=True)
print('ALL_LODS_COMPLETE',flush=True)
