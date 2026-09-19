"""Extract existing native video evidence using CPU only; never opens a browser."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, math, subprocess, sys

base = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('output/brute-motion-v4/native-2026-09-19T03-58-17-886Z')
report = json.loads((base / 'report.json').read_text())
frames = base / 'video-frames'
frames.mkdir(exist_ok=True)
if not list(frames.glob('frame-*.png')):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-i', report['video'],
                    '-vf', 'fps=10', '-threads', '1', str(frames / 'frame-%03d.png')], check=True)

# Existing video timestamps are sampling positions, not a new simulation or retime.
def sheet(name, indices, crop=None):
    cell_w, cell_h, cols = 480, 340, 4
    canvas = Image.new('RGB', (cell_w * cols, cell_h * math.ceil(len(indices) / cols)), '#18232b')
    draw = ImageDraw.Draw(canvas)
    for n, index in enumerate(indices):
        source = Image.open(frames / f'frame-{index:03d}.png').convert('RGB')
        x, y = n % cols * cell_w, n // cols * cell_h
        # Preserve the recorded HUD time/mode as a separate strip when cropping detail.
        picture = source.crop(crop) if crop else source
        picture.thumbnail((cell_w, 285))
        canvas.paste(picture, (x + (cell_w - picture.width) // 2, y + 24))
        hud = source.crop((10, 10, 580, 75)).resize((456, 52))
        if crop:
            canvas.paste(hud, (x + 10, y + 282))
        draw.text((x + 10, y + 5), f'VIDEO sample #{index} ~{(index - 1) / 10:.1f}s | NOT sampled pose seek', fill='white')
    destination = base / name
    canvas.save(destination)
    return {'path': str(destination), 'indices': indices, 'crop': crop, 'method': '10fps sampled from original native WebM; no motion interpolation'}

sheets = [
    sheet('playback-close-caller-sheet.png', list(range(4, 16)), (375, 85, 1060, 750)),
    sheet('playback-close-source-sheet.png', list(range(17, 45, 2)), (375, 85, 1060, 750)),
    sheet('playback-arpg-caller-sheet.png', list(range(52, 64)), (620, 350, 820, 530)),
    sheet('playback-arpg-source-sheet.png', list(range(65, 93, 2)), (620, 350, 820, 530)),
]
summary = []
for playback in report['playbacks']:
    fs = playback['frames']
    attack = [f for f in fs if f['actors'][0]['mode'] == 'Attack']
    recovery = next(f for f in fs if f['actors'][0]['mode'] == 'recovery')
    summary.append({
        'view': playback['view'], 'timing': playback['timing'], 'frames': len(fs), 'attackFrames': len(attack),
        'firstAttackTime': attack[0]['time'], 'firstRecoveryTime': recovery['time'],
        'clockDifference': max(abs(f['wallTime'] - f['time'] - .3) for f in fs),
        'idleHipY': fs[0]['actors'][0]['hip'][1],
        'minHipY': min(f['actors'][0]['hip'][1] for f in fs),
        'maxFrameHipDelta': max(abs(b['actors'][0]['hip'][1] - a['actors'][0]['hip'][1]) for a, b in zip(fs, fs[1:])),
    })
(base / 'playback-review-data.json').write_text(json.dumps({'playbacks': summary, 'sheets': sheets,
    'limits': 'Native RAF recorded at real caller/source duration; reviewer inspects original stills and sampled WebM frames. Not continuous perceptual playback approval or gameplay.'}, indent=2) + '\n')
print(json.dumps({'sheets': sheets, 'playbacks': summary}, indent=2))
