"""Reproduce the selected metadata-only correction from the exact original GLB.

This is a post-export step, never a Blender/rig/texture re-export. New source
hashes require a new alpha/material audit before extending this allowlist.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct

BASELINE = '0e5da9d8a667fa44dbccf6c5ae9141f6f3183df555c2ed6781bc87d632327a32'
SELECTED = '5c1903a064decbcee1d018df4f6ee595e826640a0ccb9b40538efe5aef70f996'
sha = lambda b: hashlib.sha256(b).hexdigest()

def patch(data):
    assert sha(data) == BASELINE, 'Unreviewed export: re-audit material alpha before patching'
    magic, version, length = struct.unpack_from('<4sII', data)
    assert (magic, version, length) == (b'glTF', 2, len(data))
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4e4f534a
    original = json.loads(data[20:20+size])
    metadata = json.loads(data[20:20+size])
    material = metadata['materials'][0]
    assert material['name'] == 'tripo_mat_5c5194c8.001' and material['alphaMode'] == 'BLEND'
    material['alphaMode'] = 'OPAQUE'
    encoded = json.dumps(metadata, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    following_chunks = data[20+size:]
    result = (struct.pack('<4sII', b'glTF', 2, 20+len(encoded)+len(following_chunks))
              + struct.pack('<II', len(encoded), kind) + encoded + following_chunks)
    restored = json.loads(encoded)
    restored['materials'][0]['alphaMode'] = 'BLEND'
    assert restored == original, 'Unexpected logical JSON change'
    assert result[20+len(encoded):] == following_chunks, 'Unexpected BIN/chunk change'
    assert sha(result) == SELECTED, 'Result differs from native-reviewed candidate'
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
