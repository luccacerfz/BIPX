"""Read only structural/take metadata from old FBX6100; never convert or import."""
from pathlib import Path
import struct, json, collections, hashlib
BASE = Path(__file__).resolve().parents[1] / 'output/brute-motion-v4/source-triage-v1'
records = []
for name in ['character (1).fbx', 'character (2).fbx', 'character.fbx']:
    file = Path('/Users/luccacerf/Projetos/Pessoal/Gaming/quake/public/assets/anims/mixamo') / name
    data = file.read_bytes(); version = struct.unpack_from('<I', data, 23)[0]
    counts = collections.Counter()
    def node(offset):
        end, count, prop_length, n = struct.unpack_from('<IIIB', data, offset)
        if not end: return None, offset + 13
        assert offset < end <= len(data)
        kind = data[offset+13:offset+13+n].decode('utf-8', 'replace')
        counts[kind] += 1
        p = offset + 13 + n; props = []
        for _ in range(count):
            tag = chr(data[p]); p += 1
            if tag in 'YCIFDL':
                fmt = {'Y':'h','C':'?','I':'i','F':'f','D':'d','L':'q'}[tag]
                props.append(struct.unpack_from('<'+fmt, data, p)[0]); p += struct.calcsize(fmt)
            elif tag in 'SR':
                length = struct.unpack_from('<I', data, p)[0]; p += 4
                props.append(data[p:p+length].decode('utf-8','replace') if tag == 'S' else '<raw>'); p += length
            elif tag in 'fdlibc':
                length, encoding, packed = struct.unpack_from('<III', data, p); p += 12 + packed
                props.append({'arrayCount':length, 'encoding':encoding})
            else: raise ValueError(f'Unknown FBX property {tag!r}')
        assert p == offset + 13 + n + prop_length
        children = []
        while p < end - 13:
            child, p = node(p)
            if child is not None: children.append(child)
        return {'name':kind, 'properties':props, 'children':children}, end
    roots = []; cursor = 27
    while cursor < len(data)-13:
        item, cursor = node(cursor)
        if item is None: break
        roots.append(item)
    takes = [n for n in roots if n['name'] == 'Takes']
    records.append({'path':str(file),'sha256':hashlib.sha256(data).hexdigest(),'version':version,
                    'rootNames':[n['name'] for n in roots], 'counts':dict(counts), 'takes':takes,
                    'limit':'Metadata only; no rig evaluation; Blender importer rejects6100'})
(BASE/'legacy-fbx-metadata.json').write_text(json.dumps(records,indent=2)+'\n')
for r in records: print(Path(r['path']).name, 'takes', json.dumps(r['takes'])[:1000])
