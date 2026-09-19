"""CPU posed meshes, no GPU/render/playback. Fixed real hero silhouettes."""
from pathlib import Path
import sys,json,math
import numpy as np
from PIL import Image,ImageDraw
base=Path('output/brute-motion-v6')/(sys.argv[1] if len(sys.argv)>1 else 'candidate-01')
g=json.loads((base/'poses.json').read_text())

def frame(hero,pose,view='threequarter',size=(960,720),regions=False):
 d=g['variants'][hero]['distance'];width,height=size
 if view=='arpg':eye=np.array([0.,17.,20.]);aim=np.array([0.,1.2,-2.6]);fov=48
 elif view=='side':eye=np.array([7.,2.7,-d/2]);aim=np.array([0.,1.5,-d/2]);fov=36
 else:eye=np.array([5.,3.7,5.]);aim=np.array([0.,1.45,-d/2]);fov=40
 f=aim-eye;f/=np.linalg.norm(f);r=np.cross(f,[0,1,0]);r/=np.linalg.norm(r);u=np.cross(r,f);focal=height/(2*math.tan(math.radians(fov/2)))
 def transform(p):
  p=np.asarray(p).copy();p[:,0]*=-1;p[:,2]=-p[:,2]-d;return p
 def project(p):
  rel=p-eye;dep=rel@f;return np.stack((width/2+(rel@r)*focal/dep,height/2-(rel@u)*focal/dep),axis=-1),dep
 image=Image.new('RGB',size,(23,35,44));draw=ImageDraw.Draw(image)
 def line(p,color,w=2):
  xy,_=project(np.asarray(p));draw.line([tuple(x) for x in xy],fill=color,width=w)
 for n in range(-4,5):line([[n,0,-5],[n,0,3]],(38,56,65),1);line([[-4,0,n],[4,0,n]],(38,56,65),1)
 for c,rad,col in [([0,0,-d],1.18,(169,119,85)),([0,0,0],.64,(68,150,192))]:line([[c[0]+rad*math.cos(t),.005,c[2]+rad*math.sin(t)] for t in np.linspace(0,2*math.pi,81)],col)
 objs=[({'positions':pose['positions'],'indices':g['indices'],'name':'Brute'},(173,109,77))]+[(m,(70,140,184) if 'Body' in m['name'] else (150,164,170)) for m in g['heroes'][hero]]
 faces=[];light=np.array([.2,.8,.6]);light/=np.linalg.norm(light)
 for mesh,color in objs:
  pts=np.array(mesh['positions']);tri=np.array(mesh['indices']).reshape(-1,3)
  if mesh['name']!='Brute':pts[:,2]-=d
  pts=transform(pts);xy,dep=project(pts);xyz=pts[tri];normal=np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0]);normal/=np.maximum(1e-12,np.linalg.norm(normal,axis=1))[:,None];shade=np.clip(.4+.6*np.abs(normal@light),.15,1)
  hand=set(g['regions']['hand']);shoulder=set(g['regions']['shoulder'])
  for i,t in enumerate(tri):
   col=color
   if regions and mesh['name']=='Brute':
    if any(int(k) in hand for k in t):col=(226,154,91)
    elif any(int(k) in shoulder for k in t):col=(189,96,144)
   faces.append((dep[t].mean(),[tuple(p) for p in xy[t]],tuple(int(c*shade[i]) for c in col)))
 for _,xy,col in sorted(faces,reverse=True,key=lambda p:p[0]):draw.polygon(xy,fill=col)
 draw.text((15,15),f'CPU {base.name} / {hero} / {pose["time"]:.3f}s / {view}',fill='white')
 draw.text((15,35),f'Fixed centers {d:.2f}m | Brute3.30 / Aldric2.70 / Lyra2.55',fill=(210,224,234))
 draw.text((15,height-35),'Real posed meshes. No textures/GPU/playback. Marker pending.',fill=(210,224,234))
 return image
for hero,data in g['variants'].items():
 selected=[min(data['poses'],key=lambda p:abs(p['time']-t)) for t in [0,.18,.40,.58,.70,.82,1.05,data['poses'][-1]['time']]]
 for view in ['threequarter','arpg']:
  panels=[frame(hero,p,view,(720,600)) for p in selected];sheet=Image.new('RGB',(4*720,2*600))
  for i,im in enumerate(panels):sheet.paste(im,((i%4)*720,(i//4)*600))
  sheet.save(base/f'{hero}-{view}-sheet.png')
 contact=min(data['poses'],key=lambda p:abs(p['time']-.7))
 for view in ['threequarter','side']:frame(hero,contact,view,(1440,1000),True).save(base/f'{hero}-{view}-contact.png')
print(base)
