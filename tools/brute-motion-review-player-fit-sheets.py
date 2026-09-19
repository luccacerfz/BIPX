"""CPU perspective projections of REAL posed meshes. No GPU or new animation."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
BASE=Path('output/brute-motion-v5/player-fit-v1')
G=json.loads((BASE/'geometry.json').read_text()); M=json.loads((BASE/'measurements.json').read_text())
marker=G['marker']; pose=min(G['brute'],key=lambda p:abs(p['time']-marker))
current=np.array(M['brute']['socket']); witness=np.array(pose['positions'][4337]); length=np.linalg.norm(witness-current)
offset=np.array([0,-.25,-math.sqrt(length*length-.25*.25)])
shoulder=np.array([.20,2.64,-.45]); upper=M['brute']['limbLengths']['upper']; lower=M['brute']['limbLengths']['forearm']
proposal={'scope':'PROPOSED contact frames only, no posed v6 rig, keys, animation or target movement','sourceWitness':4337,'unchangedHandOffsetLength':float(length),'proposedContactOffsetFromWrist':offset.tolist(),'proposedShoulder':shoulder.tolist(),'shoulderDeltaFrom07':(shoulder-np.array(M['brute']['shoulder'])).tolist(),'timing':{'durationProposal':1.30,'preparationEnd':.40,'drive':[.40,.70],'nominalImpact':.70,'followThroughEnd':.82,'recoveryEnd':1.30,'contactSpeedDesignTarget':[1.8,2.5],'markerNotYetSelected':True},'cases':[]}
for c in M['cases']:
 row=next(row for row in c['centerlineSurface'] if row['height']==1.7)
 choices=[(k,row[k]) for k in ['allBody','HeroShield','HeroSword','DwarfRifle'] if row.get(k)]
 surface,point=min(choices,key=lambda pair:-pair[1][2]);point=np.array(point)
 wrist=point-offset;distance=np.linalg.norm(wrist-shoulder)
 elbow=math.degrees(math.acos(np.clip((upper*upper+lower*lower-distance*distance)/(2*upper*lower),-1,1)))
 proposal['cases'].append({'id':c['id'],'distance':c['distance'],'fixedTargetCenter':c['center'],'contactSurface':surface,'contactSurfacePoint':point.tolist(),'torsoPointBehindGuard':row['torso'],'proposedWrist':wrist.tolist(),'wristDeltaFrom07':(wrist-current).tolist(),'requiredShoulderWristLength':float(distance),'armLength':upper+lower,'reachFraction':float(distance/(upper+lower)),'elbowAngleDegrees':elbow,'reachableIgnoringCollisionAndSkin':bool(distance<upper+lower)})
(BASE/'artistic-proposal.json').write_text(json.dumps(proposal,indent=2)+'\n')

def transform(points,d):
 p=np.array(points).copy();p[:,0]*=-1;p[:,2]=-p[:,2]-d;return p
def frame(hero,d,view,proposed=False):
 width,height=(1440,900)
 if view=='arpg':eye=np.array([0.,17.,20.]);aim=np.array([0.,1.2,-2.6]);fov=48
 else:eye=np.array([6.,4.2,6.5]);aim=np.array([0.,1.35,-d/2]);fov=40
 f=(aim-eye);f/=np.linalg.norm(f);right=np.cross(f,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,f)
 focal=height/(2*math.tan(math.radians(fov/2)))
 def project(points):
  rel=np.asarray(points)-eye;dep=rel@f;return np.stack((width/2+(rel@right)*focal/dep,height/2-(rel@up)*focal/dep),axis=-1),dep
 image=Image.new('RGB',(width,height),(23,35,44));draw=ImageDraw.Draw(image)
 def line3(points,color,width=2):
  xy,_=project(points);draw.line([tuple(p) for p in xy],fill=color,width=width)
 for n in range(-5,6):
  line3([[n,0,-6],[n,0,4]],(38,56,65),1);line3([[-5,0,n],[5,0,n]],(38,56,65),1)
 for center,radius,color in [([0,0,-d],1.18,(169,119,85)),([0,0,0],.64,(68,150,192))]:
  pts=[[center[0]+radius*math.cos(t),.003,center[2]+radius*math.sin(t)] for t in np.linspace(0,2*math.pi,81)];line3(pts,color)
 line3([[0,.007,-d],[0,.007,0]],(220,225,230),3)
 objects=[(pose,(173,109,77),'Brute07')]
 for mesh in G['heroes'][hero]:objects.append((mesh,(70,140,184) if 'Body' in mesh['name'] else (150,164,170),mesh['name']))
 faces=[];light=np.array([.2,.8,.6]);light/=np.linalg.norm(light)
 for mesh,color,name in objects:
  pts=np.array(mesh['positions']);
  if name!='Brute07':pts[:,2]-=d
  pts=transform(pts,d);triangles=np.array(mesh['indices']).reshape(-1,3);xy,dep=project(pts)
  xyz=pts[triangles];norm=np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0]);norm/=np.maximum(1e-12,np.linalg.norm(norm,axis=1))[:,None]
  shades=np.clip(.4+.6*np.abs(norm@light),.15,1)
  for i,t in enumerate(triangles):
   faces.append((dep[t].mean(),[tuple(p) for p in xy[t]],tuple(int(c*shades[i]) for c in color)))
 for dep,xy,color in sorted(faces,reverse=True,key=lambda f:f[0]):draw.polygon(xy,fill=color)
 case=next(c for c in M['cases'] if c['id']==hero and c['distance']==d);body='HeroBody' if hero=='warrior' else 'DwarfBody';near=case['regions']['hand'][body]
 line3(transform([near['brutePoint'],near['targetPoint']],d),(255,173,85),3)
 # Bone socket and frontal-axis relation are diagnostic overlays, not new poses.
 line3(transform([[0,current[1],0],current],d),(247,203,108),2)
 for pt,color,label in [(near['brutePoint'],(255,175,85),'07'),(near['targetPoint'],(104,199,251),'BODY')]:
  xy,_=project(transform([pt],d));x,y=xy[0];draw.ellipse([x-4,y-4,x+4,y+4],fill=color);draw.text((x+6,y-7),label,fill=color)
 if proposed:
  p=next(c for c in proposal['cases'] if c['id']==hero and c['distance']==d)
  planned=[proposal['proposedShoulder'],p['proposedWrist'],p['contactSurfacePoint']]
  line3(transform(planned,d),(91,237,183),4)
  line3(transform([current,p['proposedWrist']],d),(241,99,170),3)
  for pt in planned:
   xy,_=project(transform([pt],d));x,y=xy[0];draw.ellipse([x-5,y-5,x+5,y+5],fill=(91,237,183))
  draw.text((22,760),'GREEN = planned shoulder / wrist / FIRST real surface target. NOT a v6 pose.',fill=(91,237,183))
  draw.text((22,787),'PINK = required wrist displacement; actor centers and real meshes stay fixed.',fill=(241,139,188))
 title=f'CPU REAL MESHES - Brute07 vs {hero} - marker {marker:.3f}s - centers {d:.2f}m'
 draw.text((22,20),title,fill='white');draw.text((22,44),f'{view} | Brute3.30m / Aldric2.70m / Lyra2.55m | body gap {near["gap"]:.3f}m',fill=(220,224,229))
 draw.text((22,840),'CPU projection, no textures/GPU/playback. Brown=Brute, blue=body, gray=real equipment.',fill=(215,220,230))
 draw.text((22,863),'Hero Idle0 + live locomotion update(0); fixed front targets. No rig/authority changes.',fill=(215,220,230))
 filename=f'{hero}-{d:.2f}-{view}'+('-proposal' if proposed else '')+'.png';image.save(BASE/filename)
 return image
for hero in ['warrior','dwarf']:
 for d in [1.82,1.89]:
  for view in ['threequarter','arpg']:frame(hero,d,view)
 frame(hero,1.89,'threequarter',True)
print(json.dumps(proposal,indent=2))
