"""CPU posed real meshes; projections are neither textures nor native playback."""
from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,ImageDraw
base=Path('output/brute-motion-v7')/(sys.argv[1] if len(sys.argv)>1 else 'candidate-04')

def frame(g,pose,view,size=(720,600)):
 width,height=size;d=1.855
 if view=='arpg':eye=np.array([0.,17.,20.]);aim=np.array([0.,1.2,-2.6]);fov=48
 elif view=='lateral':eye=np.array([-5.8,1.4,-.2]);aim=np.array([0.,1.55,-.945]);fov=48 # full raised hand; same angle, wider CPU framing
 else:eye=np.array([5.,3.7,5.]);aim=np.array([0.,1.45,-d/2]);fov=40
 f=aim-eye;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);focal=height/(2*math.tan(math.radians(fov/2)))
 def transform(p):
  p=np.asarray(p).copy();p[:,0]*=-1;p[:,2]=-p[:,2]-d;return p
 def project(p):
  rel=p-eye;dep=rel@f;return np.stack((width/2+(rel@r)*focal/dep,height/2-(rel@u)*focal/dep),axis=-1),dep
 image=Image.new('RGB',size,(23,35,44));draw=ImageDraw.Draw(image)
 def line(p,color,w=1):
  xy,_=project(np.asarray(p));draw.line([tuple(x) for x in xy],fill=color,width=w)
 for n in range(-4,5):line([[n,0,-5],[n,0,3]],(38,56,65));line([[-4,0,n],[4,0,n]],(38,56,65))
 objs=[({'positions':pose['positions'],'indices':g['indices'],'name':'Brute'},(173,109,77))]+[(m,(70,140,184) if 'Body' in m['name'] else (150,164,170)) for m in pose['targets']]
 faces=[];light=np.array([.2,.8,.6]);light/=np.linalg.norm(light)
 for mesh,color in objs:
  pts=transform(mesh['positions']);tri=np.array(mesh['indices']).reshape(-1,3);xy,dep=project(pts);xyz=pts[tri];normal=np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0]);normal/=np.maximum(1e-12,np.linalg.norm(normal,axis=1))[:,None];shade=np.clip(.4+.6*np.abs(normal@light),.15,1)
  hand=set(g['regions']['hand'])
  for i,t in enumerate(tri):
   col=(236,168,95) if mesh['name']=='Brute' and any(int(k) in hand for k in t) else color
   faces.append((dep[t].mean(),[tuple(p) for p in xy[t]],tuple(int(c*shade[i]) for c in col)))
 for _,xy,col in sorted(faces,reverse=True,key=lambda p:p[0]):draw.polygon(xy,fill=col)
 draw.text((12,12),f'CPU {g["name"]} / {pose["time"]:.3f}s / {view}',fill='white')
 draw.text((12,30),f'Target distance {pose["condition"]["distance"]:.3f}m; 1.45s clip',fill=(210,224,234))
 draw.text((12,height-25),'Posed meshes. No GPU/playback. Marker null.',fill=(210,224,234))
 return image

for p in sorted(base.glob('*-poses.json')):
 g=json.loads(p.read_text());poses=g['poses']
 for view in ['lateral','arpg']:
  selected=[min(poses,key=lambda p:abs(p['time']-t)) for t in [.40,.55,.60,.65,.70,.82,1.05,1.45]]
  sheet=Image.new('RGB',(2880,1200))
  for i,p in enumerate(selected):sheet.paste(frame(g,p,view),((i%4)*720,(i//4)*600))
  sheet.save(base/f'{g["name"]}-{view}-sheet.png')
 frame(g,min(poses,key=lambda p:abs(p['time']-.70)),'lateral',(1440,1000)).save(base/f'{g["name"]}-encounter.png')
 print(g['name'],flush=True)
