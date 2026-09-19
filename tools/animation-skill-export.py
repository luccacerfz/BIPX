"""Export evaluated local Mixamo skill takes; never save the source assemblies.

Uses the existing verified rig/prop baking recipes, with separate destinations.
The grenade take carries the rifle in the left hand while the right hand throws.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
exports = {
    'character': {
        'CastWarCry': 'Aldric | Original | sword and shield power up',
        'CastDash': 'Aldric | Original | sword and shield slash (2)',
        'CastShieldCharge': 'Aldric | Original | sword and shield block',
    },
    'dwarf': {
        'CastCannon': 'Lyra | Original | firing rifle',
        'CastFrostShot': 'Lyra | Original | firing rifle',
        'CastGravity': 'Lyra | Original | firing rifle',
    },
}
for kind, clips in exports.items():
    source = ROOT / ('tools/assets-export-character.py' if kind == 'character' else 'tools/assets-dwarf-export.py')
    code = source.read_text()
    code = code.replace("OUT = ROOT / 'assets/models'", "OUT = ROOT / 'output/arpg-animation/export-v2'")
    idle = 'Aldric | Demo | idle' if kind == 'character' else 'Lyra | Original | rifle aiming idle'
    code, count = re.subn(r'clips = \{.*?\n\}', 'clips = ' + repr({'Idle': idle, **clips}), code, count=1, flags=re.S)
    assert count == 1
    if kind == 'dwarf':
        start = code.index('death_path = Path(')
        end = code.index('runtime_scene = bpy.data.scenes.new', start)
        code = code[:start] + "death_report = {'method': 'Not included in skill sidecar'}\n" + code[end:]
        # These controls come from the editable assembly's original grenade
        # sequence. Do not keep the off hand glued to a right-hand rifle while
        # the source raises that right hand for its throw.
        code = code.replace("        scene.frame_set(frame)\n        bpy.context.view_layer.update()", """        scene.frame_set(frame)
        throwing = clip == 'CastCryo'
        t = frame - int(action.frame_range[0])
        carry = min(1.0, max(0.0, t / 6.0)) * min(1.0, max(0.0, (89.0 - t) / 11.0)) if throwing else 0.0
        carry = carry * carry * (3.0 - 2.0 * carry)
        settings['support_contact'] = 1.0 - carry
        settings['right_grip'] = 1.0 - carry
        settings['weapon_left_carry'] = carry
        settings.update_tag()
        bpy.context.view_layer.update()""")
    code = code.replace("dest = OUT/'aldric-hero.glb'", "dest = OUT/'aldric-skills.glb'")
    code = code.replace("dest = OUT/'dwarf-rifleman.glb'", "dest = OUT/'lyra-skills.glb'")
    exec(compile(code, str(source), 'exec'), {'__file__': str(source), '__name__': '__main__'})
