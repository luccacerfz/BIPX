"""Read the frozen v8/v9 history; add kinematics without changing audit gates."""
import hashlib
import json
import math
from pathlib import Path

base = Path('output/arpg-animation/backward-v9')
norm = lambda v: math.sqrt(sum(x*x for x in v))
sub = lambda a, b: [x-y for x, y in zip(a, b)]
def angle(a, b):
    dot = abs(sum(x*y for x, y in zip(a, b)) / (norm(a)*norm(b)))
    return math.degrees(2*math.acos(min(1, dot)))

report = {'scope': 'Existing complete history only; discrete differences, not a new contact gate.',
          'units': {'positions': 'm', 'velocity': 'm/s', 'acceleration': 'm/s²', 'angles': 'degrees'},
          'acceptedNoSliding': False, 'sources': {}, 'cases': []}
for hz, start in [(30, 49), (60, 103)]:
    variants = {}
    for variant in ['before', 'candidate']:
        source = base / f'{variant}-final/turn-6.5-{hz}.json'
        report['sources'][str(source)] = hashlib.sha256(source.read_bytes()).hexdigest()
        rows = json.loads(source.read_text())['rows']
        measured = []
        for i in range(start, len(rows)):
            row, prior, prior2 = rows[i], rows[i-1], rows[i-2]
            s, p, pp = [r['stages'][1]['final'] for r in [row, prior, prior2]]
            item = {'frame': i, 'time': row['time'], 'contact': row['feet'][1]['contact'],
                    'previousContact': row['feet'][1]['previousContact'], 'physicalPatch': row['feet'][1]['patch'],
                    'minimumSole': row['feet'][1]['minimum'], 'gait': s['gait'],
                    'ankleAngleStep': angle(s['ankleQ'], p['ankleQ']),
                    'toeAngleStep': angle(s['toeQ'], p['toeQ']), 'points': {}}
            for name in ['ankle', 'toe', 'hips', 'driverAnkle', 'driver39', '39', '99', '120']:
                points = [t[name] if name in ['ankle', 'toe', 'hips', 'driverAnkle'] else
                          t['driverMaterial']['39'] if name == 'driver39' else t['material'][name]
                          for t in [s, p, pp]]
                delta, oldDelta = sub(points[0], points[1]), sub(points[1], points[2])
                velocity = [v*hz for v in delta]
                root_relative = sub(delta, sub(row['position'], prior['position']))
                item['points'][name] = {'position': points[0], 'delta': delta, 'velocity': velocity,
                    'horizontalSpeed': math.hypot(velocity[0], velocity[2]), 'speed3d': norm(velocity),
                    'rootRelativeDelta': root_relative,
                    'rootRelativeHorizontalSpeed': math.hypot(root_relative[0], root_relative[2])*hz,
                    'acceleration': [v*hz*hz for v in sub(delta, oldDelta)]}
            measured.append(item)
        variants[variant] = measured
    comparison = []
    for a, b in zip(variants['before'], variants['candidate']):
        pa, pb = a['points']['39'], b['points']['39']
        comparison.append({'frame': a['frame'], 'contact': b['contact'],
            'positionDifference': norm(sub(pa['position'], pb['position'])),
            'deltaDifference': norm(sub(pa['delta'], pb['delta'])),
            'horizontalDistanceDifference': (pb['horizontalSpeed']-pa['horizontalSpeed'])/hz,
            'ankleAngleStepBefore': a['ankleAngleStep'], 'ankleAngleStepCandidate': b['ankleAngleStep'],
            'toeAngleStepBefore': a['toeAngleStep'], 'toeAngleStepCandidate': b['toeAngleStep']})
    report['cases'].append({'hz': hz, 'variants': variants, 'comparison': comparison})
out = base / 'native-ab-staging/continuity.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(report, indent=2))
for case in report['cases']:
    release = 56 if case['hz'] == 30 else 112
    print(json.dumps({'hz': case['hz'], 'release': next(r for r in case['comparison'] if r['frame'] == release)}))
