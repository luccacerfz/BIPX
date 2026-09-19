#!/usr/bin/env python3
"""Preserve authorized local originals; derive 1K embedded-texture GLBs only."""
import hashlib
import io
import json
from pathlib import Path
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/models/zombies')
DEST = ROOT / 'assets/models/monsters'
FILES = {'zombie': 'zombie-walker', 'brute': 'zombie-brute', 'lich': 'boss-lich'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def preserve(path, data):
    if path.exists() and path.read_bytes() != data:
        raise RuntimeError(f'Refusing to replace a different preserved source: {path}')
    path.write_bytes(data)


def optimize(data):
    length, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    doc = json.loads(data[20:20 + length])
    bin_length, bin_kind = struct.unpack_from('<II', data, 20 + length)
    assert bin_kind == 0x004E4942 and len(doc['buffers']) == 1
    blob = data[28 + length:28 + length + bin_length]
    replacements, textures = {}, []
    for image in doc.get('images', []):
        view_id = image['bufferView']
        view = doc['bufferViews'][view_id]
        start = view.get('byteOffset', 0)
        im = Image.open(io.BytesIO(blob[start:start + view['byteLength']])).convert('RGB')
        original_size = im.size
        im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        im.save(output, format='JPEG', quality=90, optimize=True)
        replacements[view_id] = output.getvalue()
        image['mimeType'] = 'image/jpeg'
        textures.append({'sourceSize': original_size, 'runtimeSize': im.size, 'bytes': len(output.getvalue())})
    packed = bytearray()
    for index, view in enumerate(doc['bufferViews']):
        while len(packed) % 4:
            packed.append(0)
        start = view.get('byteOffset', 0)
        chunk = replacements.get(index, blob[start:start + view['byteLength']])
        view['byteOffset'], view['byteLength'] = len(packed), len(chunk)
        packed.extend(chunk)
    doc['buffers'][0]['byteLength'] = len(packed)
    doc.setdefault('asset', {}).setdefault('extras', {})['BIPX_derivation'] = 'Embedded albedo resized to 1024 max; mesh, skin and animation accessors unchanged.'
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    packed += b'\0' * (-len(packed) % 4)
    result = struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(packed))
    result += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    result += struct.pack('<II', len(packed), 0x004E4942) + packed
    return result, textures


def main():
    current = DEST / 'zombie.glb'
    if current.exists():
        payload = current.read_bytes()
        length = struct.unpack_from('<I', payload, 12)[0]
        document = json.loads(payload[20:20 + length])
        if any(scene.get('extras', {}).get('bipxMotion') for scene in document.get('scenes', [])):
            raise RuntimeError('Walker has retargeted motion. Refusing to replace it with the old baseline. Rebuild motion with node tools/monster-retarget.mjs --install; preserved source/zombie-pre-mixamo.glb is the texture baseline.')
    (DEST / 'source').mkdir(parents=True, exist_ok=True)
    entries = []
    for runtime_id, name in FILES.items():
        original = (SOURCE / f'{name}.glb').read_bytes()
        sidecar = (SOURCE / f'{name}.json').read_bytes()
        preserve(DEST / 'source' / f'{name}.glb', original)
        preserve(DEST / 'source' / f'{name}.json', sidecar)
        optimized, textures = optimize(original)
        (DEST / f'{runtime_id}.glb').write_bytes(optimized)
        entries.append({'id': runtime_id, 'originalPath': str(SOURCE / f'{name}.glb'),
                        'preservedSource': f'source/{name}.glb', 'sourceSha256': digest(original),
                        'runtimeFile': f'{runtime_id}.glb', 'runtimeSha256': digest(optimized),
                        'sourceBytes': len(original), 'runtimeBytes': len(optimized), 'textures': textures,
                        'sidecar': json.loads(sidecar)})
    manifest = {'sourceProject': 'quake / DeadOrbit', 'sourceHeadObserved': '39e9488665a9c941bc0ecfa74ce53c318257ffd3',
                'authorization': 'User authorized reuse of their local generated assets in BIPX.',
                'provenance': 'Tripo generated/rigged/retargeted; copied sidecars preserve task IDs.',
                'licenseStatus': 'Provider provenance established; original account plan and historical commercial license not proven locally. Not MIT/CC0.',
                'derivation': 'Pillow LANCZOS 1024px max, JPEG quality90. Geometry/skin/clips unchanged.',
                'entries': entries}
    (DEST / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps([{k: e[k] for k in ('id', 'sourceBytes', 'runtimeBytes', 'sourceSha256', 'runtimeSha256')} for e in entries], indent=2))


if __name__ == '__main__':
    main()
