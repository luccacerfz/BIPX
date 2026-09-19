"""Summarize dense CPU measurements; support is a landmark proxy, not force dynamics."""
import json,math,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
base=Path('output/brute-motion-v6')/(sys.argv[1] if len(sys.argv)>1 else 'review-01')
def hull(points):
 p=sorted(set(tuple(x) for x in points))
 if len(p)<3:return p
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 lower=[];upper=[]
 for pt in p:
  while len(lower)>=2 and cross(lower[-2],lower[-1],pt)<=0:lower.pop()
  lower.append(pt)
 for pt in p[::-1]:
  while len(upper)>=2 and cross(upper[-2],upper[-1],pt)<=0:upper.pop()
  upper.append(pt)
 return lower[:-1]+upper[:-1]
def outside(p,poly):
 if len(poly)<3:return None
 normals=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  e=np.array(b)-a;n=np.array([-e[1],e[0]])/max(np.linalg.norm(e),1e-12);normals.append(float((np.array(p)-a)@n))
 return max(0,-min(normals))
report={'scope':'Dense CPU review; contact 240Hz, self-crossing patches 60Hz; COM uses arbitrary anatomical mass weights, not physics','variants':{}}
for hero in ['warrior','dwarf']:
 data=json.loads((base/f'{hero}-cpu.json').read_text());fs=data['frames'];dt=1/240
 for f in fs:
  support=[p for foot in f['feet'].values() for p in foot['supportPoints']];f['supportHull']=hull(support);f['comOutsideDistance']=outside([f['comProxy'][0],f['comProxy'][2]],f['supportHull'])
 def at(t):return min(fs,key=lambda f:abs(f['time']-t))
 def speed(k,a,b):return float(np.linalg.norm(np.array(at(b)[k])-at(a)[k])/(at(b)['time']-at(a)['time']))
 selfkeys=['handTorsoCrossings','leftHandTorsoCrossings','forearmChestCrossings','capChestCrossings','capHeadCrossings'];checked=[f for f in fs if 'self'in f]
 original={k:set(tuple(sorted(p))for p in fs[0]['self'][k])for k in selfkeys}
 additions={k:[{'time':f['time'],'count':len(set(tuple(sorted(p))for p in f['self'][k])-original[k])}for f in checked if set(tuple(sorted(p))for p in f['self'][k])-original[k]]for k in selfkeys}
 planted=[f for f in fs if .4<=f['time']<=1.05];start=np.array(planted[0]['feet']['leftFoot']['solePoints'])
 slip=max(float(np.linalg.norm((np.array(f['feet']['leftFoot']['solePoints'])-start)[:,[0,2]],axis=1).max())for f in planted)
 active=[f for f in fs if .18<=f['time']<=1.3]
 summary={'sha256':data['summary']['sha256'],'duration':fs[-1]['time'],'contact':at(.7)['first'],'wristBeforeEncounterSpeed':speed('wrist',.7-dt,.7),'wristAfterEncounterSpeed':speed('wrist',.7,.7+dt),'wristPeakSpeed':max(speed('wrist',fs[i-1]['time'],fs[i]['time'])for i in range(1,len(fs))),'hipForwardLoadToContact':at(.18)['hip'][2]-at(.7)['hip'][2],'hipRightShiftAtLoad':at(.18)['hip'][0]-fs[0]['hip'][0],'hipLoweringAtContact':fs[0]['hip'][1]-at(.7)['hip'][1],'comForwardLoadToContact':at(.18)['comProxy'][2]-at(.7)['comProxy'][2],'leftPlantedSoleMaxXZDrift':slip,'footMinY':{k:min(f['feet'][k]['minY']for f in fs)for k in ['leftFoot','rightFoot']},'activeCOMProxyOutsideMax':max(f['comOutsideDistance']or 0 for f in active),'activeCOMProxyInsideFraction':sum((f['comOutsideDistance']or 0)<.001 for f in active)/len(active),'baselineCOMProxyOutside':fs[0]['comOutsideDistance'],'otherTargetGaps':{k:min(x['gap']for f in fs for x in f['otherContacts'][k])for k in ['forearm','torso']},'selfBaselineCounts':{k:len(original[k])for k in selfkeys},'selfMaximumCounts':{k:max(len(f['self'][k])for f in checked)for k in selfkeys},'selfNewPairs':additions,'contactEnvelopes':{}}
 poses=json.loads((base/'poses.json').read_text());p=min(poses['variants'][hero]['poses'],key=lambda p:abs(p['time']-.7));pts=np.array(p['positions'])
 for k in ['hand','forearm','shoulder']:
  a=pts[data['regions'][k]];summary['contactEnvelopes'][k]={'min':a.min(axis=0).tolist(),'max':a.max(axis=0).tolist()}
 report['variants'][hero]=summary
 # Top-down actual support patches and the COM proxy at eight phases.
 panels=[]
 for t in [.18,.29,.40,.70,.82,1.05,1.18,1.30]:
  f=at(t);im=Image.new('RGB',(440,390),(23,35,44));d=ImageDraw.Draw(im)
  def xy(p):return (220+p[0]*180,195+p[1]*180)
  for x in [-1,-.5,0,.5,1]:d.line([xy([x,-.8]),xy([x,.8])],fill=(45,59,67))
  for z in [-.5,0,.5]:d.line([xy([-1,z]),xy([1,z])],fill=(45,59,67))
  for k,col in [('leftFoot',(91,195,236)),('rightFoot',(222,159,96))]:
   for pt in f['feet'][k]['solePoints']:
    x,y=xy([pt[0],pt[2]]);d.ellipse([x-2,y-2,x+2,y+2],fill=col)
  if len(f['supportHull'])>=3:d.line([xy(p)for p in f['supportHull']+[f['supportHull'][0]]],fill=(115,224,154),width=2)
  x,y=xy([f['comProxy'][0],f['comProxy'][2]]);d.ellipse([x-5,y-5,x+5,y+5],fill=(245,87,156));d.text((15,15),f'{hero} t={f["time"]:.3f}s | CPU top-down',fill='white')
  d.text((15,335),'Green: vertices <=12mm from floor',fill=(115,224,154));d.text((15,355),'Pink: COM proxy, NOT force dynamics',fill=(245,87,156));panels.append(im)
 sheet=Image.new('RGB',(4*440,2*390))
 for i,im in enumerate(panels):sheet.paste(im,((i%4)*440,(i//4)*390))
 sheet.save(base/f'{hero}-support-sheet.png')
 (base/f'{hero}-support.json').write_text(json.dumps([{'time':f['time'],'hull':f['supportHull'],'com':f['comProxy'],'outside':f['comOutsideDistance']}for f in fs],indent=2)+'\n')
(base/'review-metrics.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:{a:v for a,v in r.items()if a not in ['selfNewPairs','contactEnvelopes','contact']}for k,r in report['variants'].items()},indent=2))
