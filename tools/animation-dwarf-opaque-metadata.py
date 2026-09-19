"""Reproduce the selected DwarfBody metadata correction from its exact export.

This post-export step preserves all BIN chunks and the original provenance.
New export hashes require a new material/alpha audit, not an allowlist bypass.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

BASELINE = 'e11eadb8b428ad46332b0f70bc2db3459628775b65cbb101886cd46fdcd643b0'
SELECTED = 'dc0867dacd22b04e42475a686fffe808ad8c7e66e9889b2a182eb4393eb5378e'
sha = lambda data: hashlib.sha256(data).hexdigest()


def patch(data):
    assert sha(data) == BASELINE, 'Unreviewed export: re-audit material alpha before patching'
    magic, version, length = struct.unpack_from('<4sII', data)
    assert (magic, version, length) == (b'glTF', 2, len(data))
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4e4f534a
    original = json.loads(data[20:20 + size])
    metadata = json.loads(data[20:20 + size])
    body = next(node for node in metadata['nodes'] if node.get('name') == 'DwarfBody')
    rifle = next(node for node in metadata['nodes'] if node.get('name') == 'DwarfRifle')
    assert body['mesh'] == 1 and body['skin'] == 0 and rifle['mesh'] == 0
    assert all(p['material'] == 1 for p in metadata['meshes'][body['mesh']]['primitives'])
    assert all(p['material'] == 0 for p in metadata['meshes'][rifle['mesh']]['primitives'])
    material = metadata['materials'][1]
    assert material['name'] == 'tripo_mat_2a1e3867' and material['alphaMode'] == 'BLEND'
    assert metadata['materials'][0].get('alphaMode', 'OPAQUE') == 'OPAQUE'
    material['alphaMode'] = 'OPAQUE'
    encoded = json.dumps(metadata, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    following_chunks = data[20 + size:]
    result = (struct.pack('<4sII', b'glTF', 2, 20 + len(encoded) + len(following_chunks))
              + struct.pack('<II', len(encoded), kind) + encoded + following_chunks)
    restored = json.loads(encoded)
    restored['materials'][1]['alphaMode'] = 'BLEND'
    assert restored == original, 'Unexpected logical JSON change'
    assert result[20 + len(encoded):] == following_chunks, 'Unexpected BIN/chunk change'
    assert sha(result) == SELECTED, 'Result differs from exact native-reviewed candidate'
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('original', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert args.original.resolve() != args.output.resolve(), 'Keep original separate'
    result = patch(args.original.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        assert args.output.read_bytes() == result, 'Refusing to overwrite a different output'
    else:
        args.output.write_bytes(result)
    print(json.dumps({'sourceSHA256': BASELINE, 'outputSHA256': SELECTED,
                      'output': str(args.output), 'allOtherJSONEqual': True,
                      'followingChunksByteIdentical': True}))
