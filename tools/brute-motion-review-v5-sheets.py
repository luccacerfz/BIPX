"""CPU projection of actual posed vertices; diagnostic geometry, NOT a render/gameplay capture."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw

import sys
BASE = Path(__file__).resolve().parents[1] / 'output/brute-motion-v5'
eye = np.array([5., 3.4, -8.]); aim = np.array([0., 1.45, 0.])
forward = aim-eye; forward /= np.linalg.norm(forward)
right = np.cross(forward, [0,1,0]); right /= np.linalg.norm(right)
up = np.cross(right, forward)
light = np.array([.2, .8, -.7]); light /= np.linalg.norm(light)

for name in [sys.argv[1] if len(sys.argv)>1 else 'candidate-01']:
    data = json.loads((BASE/name/'cpu-poses.json').read_text())
    indices = np.array(data['indices']).reshape(-1,3)
    panels = []
    for pose in data['poses']:
        points = np.array(pose['positions']); points = points[:,[2,1,0]]; points[:,2] *= -1
        camera = np.stack(((points-aim)@right, (points-aim)@up, (points-eye)@forward), axis=1)
        xy = camera[:,:2]*130; xy[:,0]+=300; xy[:,1]=330-xy[:,1]
        image=Image.new('RGB',(600,600),(23,35,44)); draw=ImageDraw.Draw(image)
        tri=points[indices]; normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); lengths=np.linalg.norm(normals,axis=1)
        normals/=np.maximum(lengths[:,None],1e-12)
        shades=np.clip(.42+.58*np.abs(normals@light),.15,1)
        for i in np.argsort(camera[indices,2].mean(axis=1))[::-1]:
            value=shades[i];color=(int(165*value),int(145*value),int(122*value))
            draw.polygon([tuple(p) for p in xy[indices[i]]],fill=color)
        draw.text((15,15),f'CPU GEOMETRY - {name} - t {pose["time"]:.2f}s',fill='white')
        draw.text((15,575),'Posed mesh, no textures. NOT native playback.',fill=(210,225,235))
        image.save(BASE/name/f'cpu-pose-{round(pose["phase"]*100):03}.png'); panels.append(image)
    sheet=Image.new('RGB',(600*len(panels),600))
    for i,image in enumerate(panels): sheet.paste(image,(600*i,0))
    sheet.save(BASE/name/'cpu-pose-strip.png')
print('CPU actual mesh projection, no GPU/textures/playback.')
