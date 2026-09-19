#!/usr/bin/env python3
"""Find ground-contact vertex witnesses over all source clips (20 Hz, CPU)."""
import json
import math
from pathlib import Path
import struct
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/models/monsters'
DTYPES = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def calculate(name):
    data = (DEST / f'{name}.glb').read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + length])
    blob = data[28 + length:]
    def accessor(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        offset = a.get('byteOffset', 0) + v.get('byteOffset', 0)
        dtype = np.dtype(DTYPES[a['componentType']]); width = WIDTHS[a['type']]
        return np.ndarray((a['count'], width), dtype=dtype, buffer=blob, offset=offset,
                          strides=(v.get('byteStride', dtype.itemsize * width), dtype.itemsize)).copy()
    parents = {}
    for i, node in enumerate(doc['nodes']):
        for child in node.get('children', []): parents[child] = i
    mesh_index, mesh_node = next((i, n) for i, n in enumerate(doc['nodes']) if 'skin' in n)
    primitive = doc['meshes'][mesh_node['mesh']]['primitives'][0]
    positions = accessor(primitive['attributes']['POSITION'])
    positions = np.c_[positions, np.ones(len(positions))]
    joints = accessor(primitive['attributes']['JOINTS_0']).astype(np.int32)
    weights = accessor(primitive['attributes']['WEIGHTS_0'])
    skin = doc['skins'][mesh_node['skin']]
    inverse = accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    rest_rot = [np.array(n.get('rotation', [0, 0, 0, 1]), dtype=float) for n in doc['nodes']]
    def transform(node, q):
        x, y, z, w = q / np.linalg.norm(q)
        m = np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w,0],
                      [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w,0],
                      [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y,0],[0,0,0,1]], dtype=float)
        m[:3,:3] *= np.array(node.get('scale', [1,1,1]))
        m[:3,3] = node.get('translation', [0,0,0])
        return m
    def interpolate(times, values, t):
        hi = int(np.searchsorted(times, t, side='right'))
        if hi == 0: return values[0]
        if hi >= len(times): return values[-1]
        lo = hi - 1; a = values[lo]; b = values[hi]
        ratio = (t-times[lo]) / (times[hi]-times[lo]); dot = float(np.dot(a,b))
        if dot < 0: b = -b; dot = -dot
        if dot > .9995:
            q = a + ratio*(b-a); return q / np.linalg.norm(q)
        theta = math.acos(max(-1,min(1,dot)))
        return (math.sin((1-ratio)*theta)*a + math.sin(ratio*theta)*b) / math.sin(theta)
    witnesses = set(); summaries=[]
    for clip_index, animation in enumerate(doc['animations']):
        tracks=[]
        for channel in animation['channels']:
            assert channel['target']['path'] == 'rotation', 'Unexpected channel; extend baker first'
            sampler=animation['samplers'][channel['sampler']]
            assert sampler.get('interpolation','LINEAR') == 'LINEAR'
            tracks.append((channel['target']['node'],accessor(sampler['input'])[:,0],accessor(sampler['output'])))
        duration=max(t[-1] for _,t,_ in tracks)
        if clip_index == 0: duration=min(duration,3.2)
        if clip_index == 3: duration=min(duration,65/30)
        minima=[]
        for t in np.linspace(0,duration,math.ceil(duration*20)+1):
            rotations=list(rest_rot)
            for node,times,values in tracks:
                if doc['nodes'][node]['name'] == 'Root' and clip_index != 4: continue
                rotations[node]=interpolate(times,values,t)
            world={}
            def matrix(i):
                if i not in world:
                    m=transform(doc['nodes'][i],rotations[i])
                    world[i]=matrix(parents[i]) @ m if i in parents else m
                return world[i]
            matrices=np.array([matrix(j) @ inverse[k] for k,j in enumerate(skin['joints'])])
            posed=np.zeros((len(positions),4))
            for influence in range(4):
                posed += np.einsum('nij,nj->ni',matrices[joints[:,influence]],positions)*weights[:,influence,None]
            y=posed[:,1]; lowest=np.argpartition(y,7)[:8]
            witnesses.update(int(i) for i in lowest);minima.append(float(np.min(y)))
        summaries.append({'clip':animation['name'],'duration':float(duration),'samples':len(minima),'minimumRange':[min(minima),max(minima)]})
    return {'meshName':mesh_node['name'],'vertexIndices':sorted(witnesses),'vertices':len(positions),'samples':summaries}


if __name__ == '__main__':
    result={name:calculate(name) for name in ['zombie','brute','lich']}
    (DEST/'ground-probes.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({name:{'probes':len(v['vertexIndices']),'vertices':v['vertices']} for name,v in result.items()},indent=2))
