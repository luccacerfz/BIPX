// Generates the ready-to-fill evidence v2 skeleton from docs/quality-rubric.json.
//   node tools/jef-evidence-template.mjs --write   # rewrite docs/arpg/aaa-loop/evidence-template.v2.json
//   node tools/jef-evidence-template.mjs --check   # exit 1 when the committed template is out of date
// `scenarioChecklist` and `examples` are documentation: the lint ignores them and the gate never sends them.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_PATH = path.join(here, '..', 'docs', 'arpg', 'aaa-loop', 'evidence-template.v2.json');
const WHO = { automated: 'agents: tool output (JSON) with at least one claim verified in code', agent_observed: 'agents: a named inspector looking at native captures or playback', human: 'OWNER ONLY: source "owner" with device and date (owner-session-form.md)', device: 'OWNER ONLY: physical device in the owner\'s hands (owner-session-form.md)' };

export function buildTemplate(rubric) {
  return {
    schemaVersion: 2,
    language: 'en',
    howToUse: [
      'Copy this file, replace every REPLACE value and fill `observations`. Schema and rules: docs/quality-gates.md, "Evidence file schema v2".',
      'Freeze the candidate first: node tools/jef-candidate-manifest.mjs --id <id> --out <dir>/candidate-manifest.json',
      'Never add a coverage field: coverage is computed by tools/lib/evidence-lint.mjs from requiredScenarios.',
      'Check without any API call: npm run jef:lint -- --evidence <file> --out <dir>',
    ],
    candidate: { id: 'REPLACE-candidate-id', manifest: { path: 'REPLACE/candidate-manifest.json', sha256: 'REPLACE-with-the-64-hex-sha256-of-the-manifest-file' }, deployedPreview: null },
    roles: { implementer: 'REPLACE', reviewer: 'REPLACE (must differ from the implementer)', evaluator: 'REPLACE (who runs the gate)' },
    artifacts: {},
    dimensions: Object.fromEntries(Object.entries(rubric.dimensions).map(([id, dimension]) => [id, {
      name: dimension.name,
      scenarioChecklist: dimension.requiredScenarios.map((scenario) => ({ id: scenario.id, kind: scenario.kind, text: scenario.text, whoCanEstablishIt: WHO[scenario.kind], ...(scenario.bounds ? { bounds: scenario.bounds } : {}) })),
      observations: [],
    }])),
    tests: [],
    openDefects: [],
    closedDefects: [],
    examples: {
      artifact: { 'perf-natural': { path: 'output/qa/aaa-loop/<run>/verify-performance.json', sha256: '<64 hex of the file>' }, 'dense-capture': { path: 'output/qa/aaa-loop/<run>/dense-combat.png', sha256: '<64 hex>', boundBy: 'capture-index' } },
      automatedObservation: { id: 'pf-desktop-01', scenarios: ['PF2', 'PF5'], source: 'automation', inputKind: 'natural', environment: { hardware: 'Apple M5 Pro', browser: 'Chrome 141 (ANGLE Metal)', qualityMode: 'high' }, method: 'Ten minute natural run with real keyboard and mouse input, frame times sampled every frame.', result: 'Frame time p95 stayed under the desktop bound for the whole run. Two frames were longer than fifty milliseconds.', limits: 'One machine. No dense stress in this run.', artifacts: ['perf-natural'], claims: [{ claim: 'frame time p95 in milliseconds', metric: 'frameTimeP95Ms', value: 8.3, artifact: 'perf-natural', pointer: '/measurements/frameSample/frameTimeP95Ms' }] },
      agentObservedObservation: { id: 'ar-clipping-01', scenarios: ['AR5'], source: 'agent', inspector: 'vision-agent: <name of the reviewing agent, not the implementer>', inputKind: 'natural', method: 'Inspected twenty four native captures: desktop high and mobile low, quiet and dense combat, six locations.', result: 'No mesh passes through another in twenty three captures. In one capture the sword tip enters the shield during the charge.', limits: 'Stills only; motion was not inspected here.', artifacts: ['dense-capture'] },
      ownerObservation: { id: 'mb-ios-01', scenarios: ['MB3'], source: 'owner', inputKind: 'natural', environment: { device: 'iPhone 15', os: 'iOS 19.1', browser: 'Safari', physical: true, date: '2026-09-21' }, method: 'Ten minute scripted session from owner-session-form.md, portrait then landscape, both classes.', result: 'The owner moved and attacked with two thumbs at once, used the three skills and picked one card by touch. Sound started on the first touch.', verbatim: 'Movi e ataquei ao mesmo tempo sem falha. O som tocou no primeiro toque.', limits: 'One device. Ten minutes.', artifacts: ['owner-session-iphone'] },
      test: { name: 'verify:all', status: 'passed', dimensions: ['reliability'], artifact: 'suite', pointer: '/ok', expected: true },
      openDefect: { id: 'ANIM-01', dimensions: ['animation'], severity: 'P1', status: 'open', summary: 'Independent sole contact study still reports visible sliding.' },
      closedDefect: { id: 'A2-01', resolution: 'Canopy no longer hides the remote warrior at dash contact.', closedBy: { artifact: 'canopy-after' } },
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rubric = JSON.parse(fs.readFileSync(path.join(here, '..', 'docs', 'quality-rubric.json'), 'utf8'));
  const expected = `${JSON.stringify(buildTemplate(rubric), null, 2)}\n`;
  if (process.argv.includes('--write')) { fs.mkdirSync(path.dirname(TEMPLATE_PATH), { recursive: true }); fs.writeFileSync(TEMPLATE_PATH, expected); console.log(JSON.stringify({ written: path.relative(process.cwd(), TEMPLATE_PATH) })); }
  else if (process.argv.includes('--check')) { const current = fs.existsSync(TEMPLATE_PATH) ? fs.readFileSync(TEMPLATE_PATH, 'utf8') : ''; if (current !== expected) { console.error('evidence-template.v2.json is out of date. Run: node tools/jef-evidence-template.mjs --write'); process.exit(1); } console.log(JSON.stringify({ upToDate: true })); }
  else { console.error('Usage: node tools/jef-evidence-template.mjs --write | --check'); process.exit(2); }
}
