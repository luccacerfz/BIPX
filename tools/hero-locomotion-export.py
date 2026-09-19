"""Export extra authored directional Mixamo takes in an isolated Blender process.

Uses the existing evaluated-rig export recipes, changing only the clip inventory
and destination. Sources are read only; existing runtime GLBs are never replaced.
Run: Blender --background --factory-startup --python tools/hero-locomotion-export.py
The companion extract tool emits animation-only JSON used by the leg sampler.
"""
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
exports = {
 'character': {
  'WalkBackward': 'Aldric | Original | sword and shield walk (2)',
  'RunAlternate': 'Aldric | Original | sword and shield run (2)',
  'StrafeA': 'Aldric | Original | sword and shield strafe',
  'StrafeB': 'Aldric | Original | sword and shield strafe (2)',
  'StrafeC': 'Aldric | Original | sword and shield strafe (3)',
  'StrafeD': 'Aldric | Original | sword and shield strafe (4)',
 },
 'dwarf': {
  'WalkBackward': 'Lyra | Original | walking backwards',
  'RunBackward': 'Lyra | Original | run backwards',
  'StrafeLeft': 'Lyra | Original | strafe left',
  'StrafeRight': 'Lyra | Original | strafe right',
  'StrafeA': 'Lyra | Original | strafe',
  'StrafeB': 'Lyra | Original | strafe (2)',
 }
}
for kind, clips in exports.items():
 source = ROOT / ('tools/assets-export-character.py' if kind == 'character' else 'tools/assets-dwarf-export.py')
 code = source.read_text()
 code = code.replace("OUT = ROOT / 'assets/models'", "OUT = ROOT / 'output/hero-locomotion/export'")
 code, count = re.subn(r'clips = \{.*?\n\}', 'clips = ' + repr({'Idle': 'Aldric | Demo | idle' if kind=='character' else 'Lyra | Original | rifle aiming idle', **clips}), code, count=1, flags=re.S)
 assert count == 1
 if kind == 'dwarf':
  start = code.index('death_path = Path(')
  end = code.index('runtime_scene = bpy.data.scenes.new', start)
  code = code[:start] + "death_report = {'method': 'Not included in directional sidecar'}\n" + code[end:]
 code = code.replace("dest = OUT/'aldric-hero.glb'", "dest = OUT/'aldric-directional.glb'")
 code = code.replace("dest = OUT/'dwarf-rifleman.glb'", "dest = OUT/'lyra-directional.glb'")
 exec(compile(code, str(source), 'exec'), {'__file__': str(source), '__name__':'__main__'})
