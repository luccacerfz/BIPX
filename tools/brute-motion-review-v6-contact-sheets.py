"""CPU-only extraction from recorded native WebM; no synthetic poses or new GPU."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1])
report = json.loads((root / 'report.json').read_text())
out = root / 'playback-frames'
out.mkdir(exist_ok=True)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 17)
small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
times = [0, .18, .40, .58, .70, .82, 1.05, 1.45]
details = []
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
for playback in report['playbacks']:
    vid = root / playback['video']
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'frame=pts_time', '-show_frames', '-of', 'json', str(vid)], text=True))
    stamps = [float(f['pts_time']) for f in probe['frames']]
    row = {'id': playback['id'], 'view': playback['view'], 'video': str(vid),
           'videoSHA': sha(vid), 'decodedFrames': len(stamps), 'firstPTS': stamps[0], 'lastPTS': stamps[-1],
           'timePolicy': 'Approximate clip time = video PTS minus .35 s lead-in. Encoder/RAF alignment is not a marker witness.', 'frames': []}
    cell_w, cell_h = (440, 486) if playback['view'] == 'reverse-lateral' else (400, 382)
    sheet = Image.new('RGB', (cell_w * 4, cell_h * 2 + 58), '#17232c')
    draw = ImageDraw.Draw(sheet)
    draw.text((12, 8), f"RECORDED NATIVE PLAYBACK FRAMES | {playback['id']} / {playback['view']} | full clip 1.45 s at 1x", font=font, fill='white')
    draw.text((12, 32), 'Diagnostic crops, not a new camera. Approximate video time; no selected marker. Original full videos preserved.', font=small, fill='#cad4da')
    for j, intended in enumerate(times):
        index = min(range(len(stamps)), key=lambda k: abs(stamps[k] - .35 - intended))
        filename = f"{playback['id']}-{playback['view']}-frame-{index:03d}.png"
        frame = out / filename
        if not frame.exists():
            subprocess.run(['ffmpeg', '-v', 'error', '-hwaccel', 'none', '-i', str(vid),
                '-vf', f'select=eq(n\\,{index})', '-frames:v', '1', '-vsync', '0', str(frame)], check=True)
        im = Image.open(frame).convert('RGB')
        crop_box = (250, 0, 1160, 840) if playback['view'] == 'reverse-lateral' else (560, 335, 860, 605)
        cropped = im.crop(crop_box)
        cropped.thumbnail((cell_w - 8, cell_h - 30))
        # ARPG crops retain original pixels (not enlarged) to preserve screen-size limitations.
        x, y = (j % 4) * cell_w, 58 + (j // 4) * cell_h
        sheet.paste(cropped, (x + (cell_w - cropped.width) // 2, y + 25))
        draw.text((x + 10, y + 3), f"clip ~{max(0, stamps[index] - .35):.3f}s | PTS {stamps[index]:.3f}", font=small, fill='white')
        row['frames'].append({'intendedClipTime': intended, 'index': index, 'pts': stamps[index],
            'approxClipTime': max(0, stamps[index] - .35), 'file': str(frame), 'sha256': sha(frame), 'crop': crop_box})
    sheet_path = root / f"{playback['id']}-{playback['view']}-recorded-playback-sheet.png"
    sheet.save(sheet_path); row['sheet'] = str(sheet_path); row['sheetSHA'] = sha(sheet_path)
    attack = [f for f in playback['frames'] if f['mode'] == 'attack']
    row['timing'] = {'attackRAFFrames':len(attack), 'maxRAFdt':max(f['dt'] for f in attack),
        'minAttackAge':min(f['time'] for f in attack), 'maxAttackAge':max(f['time'] for f in attack),
        'finalClipAge':playback['final']['time'], 'speedError':max(abs(f['time']-(f['wallTime']-.35)) for f in attack)}
    details.append(row)
(root / 'playback-extraction.json').write_text(json.dumps(details, indent=2) + '\n')
cards = '\n'.join(f'''<article><h2>{p['id']} · {p['view']}</h2><video controls preload="metadata" src="{p['video']}"></video>
<p>Native canvas recording · .35 s lead-in + full 1.45 s Attack at 1× + .35 s terminal hold.</p>
<a href="{p['id']}-{p['view']}-recorded-playback-sheet.png">Frames extracted from this recording</a></article>''' for p in report['playbacks'])
(root / 'review.html').write_text(f'''<!doctype html><meta charset="utf-8"><title>Brute v6 contact focal native</title>
<style>body{{background:#17232c;color:#eee;font:16px system-ui;margin:24px}}main{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}video{{width:100%}}a{{color:#acd9ef}}h2{{font-size:18px}}</style>
<h1>Brute v6 · frozen handoff-01 · one reverse lateral angle</h1><p>Fixed real heroes at 1.89 m; no marker selection or promotion. Lyra native dc0867 OPAQUE, historical CPU e11ead. Negative 1.82 m remains unresolved. Videos recorded at 1×, not slow motion. Lighting fixture, not gameplay.</p>
<main>{cards}</main>''')
print(json.dumps([{k:r[k] for k in ['id','view','decodedFrames','timing','sheet']} for r in details], indent=2))
