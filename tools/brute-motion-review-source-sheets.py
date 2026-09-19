"""CPU projection of SOURCE skeletons only. Not a character render or retarget."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, math
import numpy as np
BASE = Path(__file__).resolve().parents[1] / 'output/brute-motion-v4/source-triage-v1'
data = json.loads((BASE / 'source-poses.json').read_text())['reports']
core = set('Hips Spine Spine1 Spine2 Neck Head LeftShoulder LeftArm LeftForeArm LeftHand RightShoulder RightArm RightForeArm RightHand LeftUpLeg LeftLeg LeftFoot LeftToeBase RightUpLeg RightLeg RightFoot RightToeBase'.split())
for source in data:
    panels = []
    for view, eye in [('3/4', np.array([2., 1., 4.])), ('side', np.array([1., 0., 0.]))]:
        direction = -eye / np.linalg.norm(eye)
        right = np.cross(direction, [0, 1, 0]); right /= np.linalg.norm(right)
        up = np.cross(right, direction)
        for i in [0, 2, 4, 6, 8, 10]:
            p = source['poses'][i]
            image = Image.new('RGB', (400, 450), '#14202a'); draw = ImageDraw.Draw(image)
            def project(point):
                point = np.array(point) - [0, .55, 0]
                return (200 + point @ right * 265, 240 - point @ up * 265)
            for start, end in source['edges']:
                if start not in core or end not in core: continue
                color = '#75b8ff' if end.startswith('Left') else '#ffa467' if end.startswith('Right') else '#e8e2cd'
                draw.line([project(p['joints'][start]), project(p['joints'][end])], fill=color, width=8)
            for name, point in p['joints'].items():
                if name not in core: continue
                x, y = project(point); radius = 15 if name == 'Head' else 4
                draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill='#f1e6cc')
            for x in [-.6, 0, .6]:
                draw.line([project([x,0,-.6]),project([x,0,.6])],fill='#395063',width=1)
            draw.text((10, 10), f'{source["name"]} | {view} | {p["time"]:.3f}s', fill='white')
            draw.text((10, 30), f'CPU SOURCE RIG / phase {p["phase"]:.2f}', fill='white')
            draw.text((10, 390), f'hip/leg {p["hipHeightOverLeg"]:.3f} | torso {p["torsoLeanDegrees"]:.1f}deg', fill='white')
            draw.text((10, 410), f'knees {p["knees"][0]:.1f}/{p["knees"][1]:.1f}deg | NO retarget/native', fill='white')
            panels.append(image)
    sheet = Image.new('RGB', (2400, 900))
    for i, panel in enumerate(panels): sheet.paste(panel, ((i % 6)*400, (i // 6)*450))
    sheet.save(BASE / (source['name'].lower().replace(' ', '-') + '-source-poses.png'))
print('Five source skeleton sheets; no GPU/mesh retarget.')
