// CPU-only contract tests for the JEF gate v2. No network, no API key: fetch is always a mock, and the one
// child-process case replaces globalThis.fetch before the CLI loads. Nothing here is a game grade.
//   npm run verify:jef

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lintEvidence, resolvePointer } from './lib/evidence-lint.mjs';
import { createJefClient, redactSecrets } from './lib/jef-client.mjs';
import { readLedger, appendLedgerEntry } from './lib/jef-ledger.mjs';
import { findBannedPraise, meetsThreshold, isOwnerOnly, GATE_POLICY } from './lib/jef-questions.mjs';
import { sanitizedChildEnv } from './lib/child-env.mjs';
import { fingerprintSources } from './lib/candidate-manifest.mjs';
import { buildTemplate, TEMPLATE_PATH } from './jef-evidence-template.mjs';
import { runGate, parseArgs } from './jef-gate.mjs';

const rubric = JSON.parse(fs.readFileSync('docs/quality-rubric.json', 'utf8'));
const gatesDoc = fs.readFileSync('docs/quality-gates.md', 'utf8');
const dimensionIds = Object.keys(rubric.dimensions);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const SYNTHETIC_KEY = 'apikey_SYNTHETIC-contract-test-key-0123456789';
const suiteEvidenceDirectory = process.env.BIPX_EVIDENCE_DIR || null; // set by tools/run-quality-suite.mjs
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-jef-gate-'));
const checks = [];
const silent = () => {};
let caseCounter = 0;

async function check(name, run) { await run(); checks.push({ name, passed: true }); }

// ---- Fixture: a complete, honest-looking evidence set built from the real rubric in a temp root. --------
function makeFixture(mutate) {
  const root = path.join(temporary, `case-${caseCounter += 1}`);
  const put = (relative, content) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return { path: relative, sha256: sha(fs.readFileSync(file)) }; };
  const sources = { 'src/main.js': 'a'.repeat(64), 'server.mjs': 'b'.repeat(64) };
  const manifest = put('candidate/candidate-manifest.json', JSON.stringify({ kind: 'bipx-candidate-manifest', schemaVersion: 2, id: 'fixture', sources }));
  const verbatim = (id) => `Resposta do dono para ${id}: S. Aconteceu como descrito.`;
  const ownerIds = dimensionIds.flatMap((id) => rubric.dimensions[id].requiredScenarios.filter(isOwnerOnly).map((scenario) => scenario.id));
  const artifacts = {
    suite: put('out/suite.json', JSON.stringify({ ok: true, sourceHashes: sources, sourceChangedDuringRun: false, metrics: { passed: true, checks: 16, frameTimeP95Ms: 8.3 } })),
    review: put('out/review.md', `# Native review\nCandidate manifest ${manifest.sha256}\nTwenty four captures inspected.\n`),
    ownerSession: put('docs/arpg/aaa-loop/owner-sessions/2026-09-19-s1-iphone15.md', `# Sessão do dono\nManifesto ${manifest.sha256}\n${ownerIds.map((id) => `### [${id}]\n${verbatim(id)}`).join('\n')}\n`),
    qaReport: put('out/owner-qa.json', JSON.stringify({ kind: 'bipx-device-qa-report', code: `${manifest.sha256}-iphone15`, frames: { total: { p95Ms: 18.5 } } })),
    capture: put('out/capture.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 0, 9])),
  };
  artifacts.captureIndex = put('out/captures.json', JSON.stringify({ candidateManifestSha256: manifest.sha256, files: [{ path: 'out/capture.png', sha256: artifacts.capture.sha256 }] }));
  artifacts.capture.boundBy = 'captureIndex';
  const observation = (scenario) => {
    const common = { id: `obs-${scenario.id}`, scenarios: [scenario.id], inputKind: 'natural', method: 'Scripted run on the frozen candidate with actual input.', limits: 'One machine.' };
    if (scenario.kind === 'automated') return { ...common, source: 'automation', result: 'The recorded run completed and the checked field holds the expected value.', artifacts: ['suite'], claims: [{ claim: 'suite result', value: true, artifact: 'suite', pointer: '/metrics/passed' }, ...(scenario.bounds ? [{ claim: 'frame time p95 in milliseconds', metric: 'frameTimeP95Ms', value: 8.3, artifact: 'suite', pointer: '/metrics/frameTimeP95Ms' }] : [])] };
    if (scenario.kind === 'agent_observed') return { ...common, source: 'agent', inspector: 'vision-agent: independent reviewer', result: 'The behaviour was seen in the native captures listed in the review.', artifacts: ['review', 'capture'] };
    const device = scenario.kind === 'device';
    return { ...common, source: 'owner', environment: device ? { device: 'iPhone 15', os: 'iOS 19.1', browser: 'Safari', physical: true, date: '2026-09-19' } : { device: 'MacBook Pro with headphones', date: '2026-09-19' }, result: 'The owner answered yes and described what happened.', verbatim: verbatim(scenario.id), artifacts: scenario.bounds ? ['ownerSession', 'qaReport'] : ['ownerSession'], ...(scenario.bounds ? { claims: [{ claim: 'frame time p95 in milliseconds on the phone', metric: 'frameTimeP95Ms', value: 18.5, artifact: 'qaReport', pointer: '/frames/total/p95Ms' }] } : {}) };
  };
  const evidence = {
    schemaVersion: 2, language: 'en',
    candidate: { id: 'fixture-candidate', manifest },
    roles: { implementer: 'agent-a', reviewer: 'agent-b' },
    artifacts,
    dimensions: Object.fromEntries(dimensionIds.map((id) => [id, { observations: rubric.dimensions[id].requiredScenarios.map(observation) }])),
    tests: [{ name: 'verify:all', status: 'passed', dimensions: ['reliability'], artifact: 'suite', pointer: '/ok', expected: true }],
    openDefects: [], closedDefects: [],
  };
  const fixture = { root, evidence, put, manifest, sources };
  mutate?.(fixture);
  fixture.evidenceFile = path.join(root, 'evidence.json');
  fs.writeFileSync(fixture.evidenceFile, JSON.stringify(fixture.evidence, null, 2));
  fixture.lint = (extra = {}) => lintEvidence({ evidence: fixture.evidence, rubric, root, now: new Date('2026-09-19T12:00:00Z'), ...extra });
  return fixture;
}
const codes = (report) => report.errors.map((item) => item.code);
const firstObservation = (fixture, dimensionId, kind) => fixture.evidence.dimensions[dimensionId].observations.find((item) => rubric.dimensions[dimensionId].requiredScenarios.find((scenario) => scenario.id === item.scenarios[0]).kind === kind);

// ---- Mock judge. ---------------------------------------------------------------------------------------------
function mockJudge({ level = 9, canary = {}, failDimension = null, echoAuthorization = false, requirementNoul = 0.97 } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, authorization: init.headers.Authorization });
    const dimensionId = body.state.dimension.id;
    if (failDimension === dimensionId && body.state.candidate.id !== 'synthetic-canary-not-a-candidate') return new Response(JSON.stringify({ error: 'synthetic failure' }), { status: 500 });
    const synthetic = body.state.candidate.id === 'synthetic-canary-not-a-candidate';
    const kind = !synthetic ? 'real' : body.state.open_defects.length ? 'known_defect' : /bread/.test(body.state.observations[0].result) ? 'irrelevant' : 'flattery';
    const profile = { real: { score: level, noul: requirementNoul, praise: 0.02, complete: 0.99, defectAbsent: 0.99 }, flattery: { score: 1, noul: 0.05, praise: 0.96, complete: 0.03, defectAbsent: 0.2 }, irrelevant: { score: 0.1, noul: 0.02, praise: 0.1, complete: 0.01, defectAbsent: 0.1 }, known_defect: { score: 2, noul: 0.2, praise: 0.1, complete: 0.1, defectAbsent: 0.02 } }[kind];
    Object.assign(profile, canary[kind] ?? {});
    const answers = Object.fromEntries(Object.entries(body.questions).map(([id, question]) => [id, question.type === 'score' ? { type: 'score', score: profile.score, confidence: 0.91, probabilities: Object.fromEntries(rubric.levels.map((_, index) => [String(index), index === Math.round(profile.score) ? 1 : 0])) } : { type: 'noul', noul: id === 'lint_unbacked_praise' ? profile.praise : id === 'evidence_complete' ? profile.complete : id === 'major_defect_absent' ? profile.defectAbsent : profile.noul }]));
    return new Response(JSON.stringify({ model: 'jev-1.13.0', answers, usage: { input_tokens: 1200, output_tokens: 20 }, ...(echoAuthorization ? { debug_echo: init.headers.Authorization } : {}) }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}
const gate = (fixture, options = {}, deps = {}) => runGate({ evidence: fixture.evidenceFile, out: path.join(fixture.root, options.outName ?? 'gate-out'), root: fixture.root, ledger: path.join(fixture.root, 'ledger.jsonl'), ...options }, { env: { TYPESAFE_API_KEY: SYNTHETIC_KEY }, log: silent, sleep: async () => {}, now: () => new Date('2026-09-19T12:00:00Z'), ...deps });
const filesUnder = (directory) => fs.readdirSync(directory, { withFileTypes: true, recursive: true }).filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));

try {
  // ======================================= Rubric and documents =========================================
  await check('rubric: owner threshold is strictly above 9.5, dated 2026-09-19', () => {
    assert.deepEqual([rubric.threshold.operator, rubric.threshold.value, rubric.threshold.decision.by, rubric.threshold.decision.date], ['>', 9.5, 'owner', '2026-09-19']);
    assert.ok(rubric.schemaVersion >= 6);
    assert.match(gatesDoc, /owner decision dated 2026-09-19/i);
  });
  await check('rubric: requiredScenarios itemise existing text only (every quote is verbatim)', () => {
    const rowTitle = { game_design: 'Game design and class identity', animation: 'Animation, locomotion and contact', art_direction: 'Art direction', vfx: 'VFX', combat_feel: 'Combat feel', ui_ux: 'UI and flow', mobile: 'Mobile', audio: 'Audio', performance: 'Performance', multiplayer: 'Multiplayer', accessibility: 'Accessibility', reliability: 'Reliability' };
    const seen = new Set();
    assert.equal(dimensionIds.length, 12);
    for (const id of dimensionIds) {
      const dimension = rubric.dimensions[id];
      const row = gatesDoc.split('\n').find((line) => line.startsWith(`| ${rowTitle[id]} |`));
      assert.ok(row, `quality-gates.md row for ${id}`);
      assert.ok(dimension.requiredScenarios.length >= 6, `${id} has scenarios`);
      for (const scenario of dimension.requiredScenarios) {
        assert.ok(!seen.has(scenario.id), `duplicate ${scenario.id}`); seen.add(scenario.id);
        assert.ok(['automated', 'agent_observed', 'human', 'device'].includes(scenario.kind), `${scenario.id} kind`);
        assert.ok(scenario.text.length > 10 && scenario.from.length > 0, `${scenario.id} text/from`);
        assert.deepEqual(findBannedPraise(scenario.text), [], `${scenario.id} text must not grade`);
        for (const source of scenario.from) assert.ok((source.origin === 'rubric' ? dimension.requirements : row).includes(source.quote), `${scenario.id}: "${source.quote}" is not verbatim in ${source.origin}`);
      }
      for (const quote of dimension.notSufficientAlone) assert.ok(dimension.requirements.includes(quote) || row.includes(quote), `${id}: notSufficientAlone quote`);
      // Nothing dropped: every sentence of the requirement text is quoted by a scenario or kept as guidance,
      // and every word of it except plain connectives sits inside a quote.
      for (const sentence of dimension.requirements.split(/(?<=\.)\s+/)) {
        const used = dimension.notSufficientAlone.includes(sentence) || dimension.requiredScenarios.some((scenario) => scenario.from.some((source) => source.origin === 'rubric' && sentence.includes(source.quote)));
        assert.ok(used, `${id}: sentence is not itemised: "${sentence}"`);
      }
      const quoted = [...dimension.requiredScenarios.flatMap((scenario) => scenario.from.filter((source) => source.origin === 'rubric').map((source) => source.quote)), ...dimension.notSufficientAlone].join(' ').toLowerCase();
      const unquoted = [...new Set(dimension.requirements.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g).filter((word) => !quoted.includes(word)))];
      assert.deepEqual(unquoted.filter((word) => !['require', 'document', 'verify', 'plus', 'and', 'or', 'the', 'of', 'with'].includes(word)), [], `${id}: requirement words dropped by the itemisation`);
    }
  });
  await check('template: lists every required scenario with empty observations and is up to date', () => {
    assert.equal(fs.readFileSync(TEMPLATE_PATH, 'utf8'), `${JSON.stringify(buildTemplate(rubric), null, 2)}\n`);
    const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    for (const id of dimensionIds) { assert.deepEqual(template.dimensions[id].observations, []); assert.deepEqual(template.dimensions[id].scenarioChecklist.map((item) => item.id), rubric.dimensions[id].requiredScenarios.map((item) => item.id)); }
    assert.equal(lintEvidence({ evidence: template, rubric, root: temporary }).ok, false, 'an unfilled template must not lint');
  });
  await check('owner form: answer blocks map 1:1 to the human/device scenarios', () => {
    const form = fs.readFileSync('docs/arpg/aaa-loop/owner-session-form.md', 'utf8');
    const blocks = [...form.matchAll(/^### \[([A-Z]{2}\d+)\]/gm)].map((match) => match[1]);
    const expected = dimensionIds.flatMap((id) => rubric.dimensions[id].requiredScenarios.filter(isOwnerOnly).map((scenario) => scenario.id));
    assert.equal(new Set(blocks).size, blocks.length, 'a scenario has two answer blocks');
    assert.deepEqual([...blocks].sort(), [...expected].sort());
    for (const id of expected) { const scenario = dimensionIds.flatMap((dimension) => rubric.dimensions[dimension].requiredScenarios).find((item) => item.id === id); assert.ok(form.includes(`| ${id} |`) && form.includes(scenario.text), `${id} mapping row`); }
  });

  // ============================================= Lint ====================================================
  await check('lint: complete fixture is clean and coverage is computed for all 12 dimensions', () => {
    const report = makeFixture().lint();
    assert.deepEqual(codes(report), []);
    assert.equal(report.status, 'clean');
    for (const id of dimensionIds) assert.equal(report.coverage[id].status, 'complete', id);
    assert.deepEqual([report.artifacts.suite.binding, report.artifacts.review.binding, report.artifacts.capture.binding], ['source_hashes', 'manifest_hash_in_artifact', 'sidecar:captureIndex']);
  });
  await check('lint: missing artifact', () => { const fixture = makeFixture(({ root }) => fs.rmSync(path.join(root, 'out/review.md'))); const report = fixture.lint(); assert.ok(codes(report).includes('artifact_missing')); assert.equal(report.ok, false); });
  await check('lint: wrong hash', () => { const report = makeFixture(({ root }) => fs.appendFileSync(path.join(root, 'out/review.md'), 'edited after hashing')).lint(); assert.ok(codes(report).includes('artifact_hash_mismatch')); });
  await check('lint: wrong number (claim does not match the JSON artifact)', () => {
    const report = makeFixture(({ evidence }) => { evidence.dimensions.performance.observations.find((item) => item.scenarios[0] === 'PF5').claims[1].value = 8.2; }).lint();
    const issue = report.errors.find((item) => item.code === 'claim_mismatch');
    assert.deepEqual([issue.expected, issue.actual], [8.2, 8.3]);
    assert.ok(codes(makeFixture(({ evidence }) => { firstObservation({ evidence }, 'reliability', 'automated').claims[0].pointer = '/metrics/nope'; }).lint()).includes('claim_pointer_missing'));
    assert.ok(codes(makeFixture(({ evidence }) => { firstObservation({ evidence }, 'reliability', 'automated').claims[0].artifact = 'review'; }).lint()).includes('claim_artifact_not_json'));
  });
  await check('lint: self-declared coverage is rejected, coverage is never read from the file', () => {
    assert.ok(codes(makeFixture(({ evidence }) => { evidence.dimensions.mobile.coverage = 'complete'; }).lint()).includes('self_declared_coverage'));
    assert.ok(codes(makeFixture(({ evidence }) => { evidence.requiredMissing = []; }).lint()).includes('self_declared_coverage'));
    const emptied = makeFixture(({ evidence }) => { evidence.dimensions.audio.observations = []; }).lint();
    assert.deepEqual([emptied.ok, emptied.status, emptied.coverage.audio.status], [true, 'incomplete', 'none']);
  });
  await check('lint: agent-authored "owner" observation is rejected', () => {
    const variants = {
      'agent field': ({ evidence }) => { firstObservation({ evidence }, 'audio', 'human').inspector = 'vision-agent'; },
      'words not in the owner file': ({ evidence }) => { firstObservation({ evidence }, 'audio', 'human').verbatim = 'The owner loved everything.'; },
      'artifact outside owner-sessions': ({ evidence }) => { firstObservation({ evidence }, 'audio', 'human').artifacts = ['review']; },
      'look-alike owner-sessions folder elsewhere': ({ evidence, put, root }) => { evidence.artifacts.lookalike = put('out/docs/arpg/aaa-loop/owner-sessions/s1.md', fs.readFileSync(path.join(root, evidence.artifacts.ownerSession.path))); firstObservation({ evidence }, 'audio', 'human').artifacts = ['lookalike']; },
      'no device or date': ({ evidence }) => { delete firstObservation({ evidence }, 'audio', 'human').environment; },
      'future date': ({ evidence }) => { firstObservation({ evidence }, 'audio', 'human').environment.date = '2027-01-01'; },
    };
    for (const [name, mutate] of Object.entries(variants)) assert.ok(codes(makeFixture(mutate).lint()).includes('owner_observation_not_authentic'), name);
  });
  await check('lint: human/device scenarios count only with source owner; device needs a physical device', () => {
    const agent = makeFixture(({ evidence }) => { const item = firstObservation({ evidence }, 'audio', 'human'); item.source = 'agent'; item.inspector = 'vision-agent'; delete item.verbatim; item.artifacts = ['review']; }).lint();
    assert.equal(agent.ok, true);
    assert.equal(agent.coverage.audio.status, 'partial');
    assert.ok(agent.ownerOnlyGaps.some((gap) => gap.dimension === 'audio'));
    assert.ok(agent.warnings.some((item) => item.code === 'owner_only_scenario_without_owner'));
    const emulated = makeFixture(({ evidence }) => { evidence.dimensions.mobile.observations.find((item) => item.scenarios[0] === 'MB3').environment.physical = false; }).lint();
    assert.ok(emulated.coverage.mobile.missing.some((row) => row.id === 'MB3'));
  });
  await check('lint: automated scenarios need a verified claim; agent_observed needs an inspector', () => {
    const noClaim = makeFixture(({ evidence }) => { delete firstObservation({ evidence }, 'multiplayer', 'automated').claims; }).lint();
    assert.equal(noClaim.coverage.multiplayer.status, 'partial');
    const noInspector = makeFixture(({ evidence }) => { delete firstObservation({ evidence }, 'vfx', 'agent_observed').inspector; }).lint();
    assert.equal(noInspector.coverage.vfx.status, 'partial');
  });
  await check('lint: every artifact must reference the same candidate manifest', () => {
    assert.ok(codes(makeFixture(({ evidence, put, sources }) => { evidence.artifacts.suite = put('out/suite.json', JSON.stringify({ ok: true, sourceHashes: { ...sources, 'src/main.js': 'c'.repeat(64) }, metrics: { passed: true, frameTimeP95Ms: 8.3 } })); }).lint()).includes('artifact_from_other_candidate'));
    assert.ok(codes(makeFixture(({ evidence, put }) => { evidence.artifacts.review = put('out/review.md', '# Review without any candidate reference\n'); }).lint()).includes('artifact_not_bound_to_candidate'));
    assert.ok(codes(makeFixture(({ evidence, put, sources }) => { evidence.artifacts.suite = put('out/suite.json', JSON.stringify({ ok: true, sourceHashes: sources, sourceChangedDuringRun: true, metrics: { passed: true, frameTimeP95Ms: 8.3 } })); }).lint()).includes('artifact_source_changed_during_run'));
    assert.ok(codes(makeFixture(({ evidence }) => { evidence.candidate.manifest.sha256 = 'd'.repeat(64); }).lint()).includes('candidate_manifest_hash_mismatch'));
  });
  await check('lint: numeric bounds are compared in code', () => {
    const slow = makeFixture(({ evidence, put, sources }) => { evidence.artifacts.suite = put('out/suite.json', JSON.stringify({ ok: true, sourceHashes: sources, metrics: { passed: true, frameTimeP95Ms: 31.5 } })); evidence.dimensions.performance.observations.find((item) => item.scenarios[0] === 'PF5').claims[1].value = 31.5; }).lint();
    assert.equal(slow.ok, true);
    assert.match(slow.coverage.performance.missing.find((row) => row.id === 'PF5').reason, /bound not met/);
  });
  await check('lint: open defects only disappear when closed with an artifact', () => {
    const previousLedgerEntry = { openDefects: ['ANIM-01'] };
    assert.ok(codes(makeFixture().lint({ previousLedgerEntry })).includes('defect_disappeared'));
    assert.deepEqual(codes(makeFixture(({ evidence }) => { evidence.closedDefects = [{ id: 'ANIM-01', resolution: 'Sole contact study passes on the whole gait matrix.', closedBy: { artifact: 'suite' } }]; }).lint({ previousLedgerEntry })), []);
    assert.ok(codes(makeFixture(({ evidence }) => { evidence.closedDefects = [{ id: 'ANIM-01', resolution: 'Trust me.', closedBy: {} }]; }).lint({ previousLedgerEntry })).includes('defect_closed_without_artifact'));
    const open = makeFixture(({ evidence }) => { evidence.openDefects = [{ id: 'ANIM-01', dimensions: ['animation'], severity: 'P1', summary: 'Feet slide.' }]; }).lint({ previousLedgerEntry });
    assert.deepEqual([open.ok, open.clean, open.gaps.includes('open_defects')], [true, false, true]);
  });
  await check('lint: grading vocabulary, unverified tests and secrets are rejected', () => {
    assert.ok(codes(makeFixture(({ evidence }) => { firstObservation({ evidence }, 'vfx', 'agent_observed').result = 'The effects are flawless and polished.'; }).lint()).includes('banned_praise_term'));
    assert.deepEqual(findBannedPraise('greater than the great AAA bar'), ['aaa', 'great']);
    assert.ok(codes(makeFixture(({ evidence }) => { evidence.tests[0].pointer = '/metrics/checks'; }).lint()).includes('test_status_mismatch'));
    assert.ok(codes(makeFixture(({ evidence }) => { delete evidence.tests[0].artifact; }).lint()).includes('test_status_unverified'));
    assert.equal(makeFixture(({ evidence }) => { evidence.tests[0].status = 'failed'; }).lint().tests.allPassed, false);
    assert.ok(codes(makeFixture(({ evidence }) => { evidence.roles.note = `key ${SYNTHETIC_KEY}`; }).lint()).includes('secret_in_evidence'));
    assert.deepEqual(resolvePointer({ 'a/b': [{ '~': 5 }] }, '/a~1b/0/~0'), { found: true, value: 5 });
  });

  // ============================================ Client ===================================================
  await check('client: retries 429/529 with backoff, times out, never leaks the key', async () => {
    const statuses = [429, 529, 200];
    const delays = [];
    const client = createJefClient({ apiKey: SYNTHETIC_KEY, fetch: async () => { const status = statuses.shift(); return new Response(JSON.stringify(status === 200 ? { answers: {} } : {}), { status, headers: status === 429 ? { 'retry-after': '3' } : {} }); }, sleep: async (ms) => delays.push(ms) });
    const done = await client.ask({});
    assert.deepEqual([done.ok, done.attempts, delays], [true, 3, [3000, 2000]]);
    const exhausted = await createJefClient({ apiKey: SYNTHETIC_KEY, fetch: async () => new Response('{}', { status: 529 }), sleep: async () => {} }).ask({});
    assert.deepEqual([exhausted.ok, exhausted.status, exhausted.attempts], [false, 529, 3]);
    const hanging = await createJefClient({ apiKey: SYNTHETIC_KEY, timeoutMs: 25, fetch: () => new Promise(() => {}), sleep: async () => {} }).ask({});
    assert.deepEqual([hanging.ok, hanging.attempts], [false, 1]);
    assert.match(hanging.error, /timed out/);
    const leaky = await createJefClient({ apiKey: SYNTHETIC_KEY, maxAttempts: 1, fetch: async () => { throw new Error(`connect failed for Bearer ${SYNTHETIC_KEY}`); } }).ask({});
    assert.ok(!leaky.error.includes(SYNTHETIC_KEY));
    assert.ok(!JSON.stringify(redactSecrets({ nested: [`x ${SYNTHETIC_KEY} y`, 'Bearer abcdefghijklmnop'] }, [SYNTHETIC_KEY])).match(/SYNTHETIC|abcdefghijklmnop/));
    assert.throws(() => createJefClient({ apiKey: '' }));
  });

  // ============================================= Gate ====================================================
  await check('gate: lint failure means no API call and a non-zero exit', async () => {
    const fixture = makeFixture(({ evidence }) => { evidence.dimensions.mobile.coverage = 'complete'; });
    const judge = mockJudge();
    const result = await gate(fixture, {}, { fetch: judge.fetch });
    assert.deepEqual([result.status, result.exitCode, judge.calls.length], ['lint_failed', 3, 0]);
    assert.equal(readLedger(path.join(fixture.root, 'ledger.jsonl')).entries.at(-1).type, 'lint_failed');
  });
  await check('gate: --dry-run writes the exact requests, calls nothing and leaves the ledger alone', async () => {
    const fixture = makeFixture(({ evidence, root }) => { evidence.artifacts.review.path = path.join(root, 'out/review.md'); });
    const judge = mockJudge();
    const dry = await gate(fixture, { dryRun: true, outName: 'dry' }, { fetch: judge.fetch, env: {} });
    assert.ok(!fs.readFileSync(path.join(dry.outDir, 'requests.json'), 'utf8').includes(fixture.root), 'absolute local paths must not be sent to the provider');
    assert.deepEqual([dry.status, dry.exitCode, judge.calls.length, fs.existsSync(path.join(fixture.root, 'ledger.jsonl'))], ['dry_run_not_evaluated', 0, 0, false]);
    const planned = JSON.parse(fs.readFileSync(path.join(dry.outDir, 'requests.json'), 'utf8'));
    assert.equal(planned.length, dimensionIds.length * 4);
    const real = await gate(fixture, { outName: 'real' }, { fetch: judge.fetch });
    assert.equal(real.status, 'passed');
    const sent = new Map(judge.calls.map((call) => [JSON.stringify(call.body), call]));
    for (const request of planned) assert.ok(sent.has(JSON.stringify(request.body)), `${request.id} was not sent exactly as written`);
    assert.equal(judge.calls.length, planned.length);
    const mobile = planned.find((request) => request.id === 'dimension:mobile').body;
    assert.deepEqual(Object.keys(mobile.questions), ['score', ...rubric.dimensions.mobile.requiredScenarios.map((scenario) => `req_${scenario.id}`), 'lint_unbacked_praise', 'evidence_complete', 'major_defect_absent']);
    assert.ok(mobile.state.observations.every((item) => item.id.startsWith('obs-MB') && !('scenarios' in item)), 'only that dimension, no self-declared mapping');
    assert.ok(!JSON.stringify(mobile.state).includes('obs-AU'), 'other dimensions must not leak into the state');
    assert.equal(mobile.model, 'jev-1.13.0');
  });
  await check('gate: passes only with everything true; report and delta are written', async () => {
    const fixture = makeFixture();
    const result = await gate(fixture, {}, { fetch: mockJudge().fetch });
    assert.deepEqual([result.status, result.exitCode], ['passed', 0]);
    assert.ok(Object.values(result.report.passConditions).every(Boolean));
    assert.deepEqual([result.report.fullGoalComplete, result.report.dimensions.mobile.score0to10, result.report.dimensions.mobile.pAtLeast8], [false, 10, 1]);
    const delta = fs.readFileSync(path.join(result.outDir, 'delta.md'), 'utf8');
    assert.match(delta, /Matriz de requisitos/);
    assert.match(delta, /nenhuma entrada anterior com a mesma rubrica/);
  });
  await check('gate: threshold is strict — exactly 9.5 fails, 9.51 passes, never rounded upward', async () => {
    assert.deepEqual([9.5, 9.51, 9.4999999, 10, NaN, null].map((value) => meetsThreshold(value, rubric.threshold)), [false, true, false, true, false, false]);
    assert.equal(meetsThreshold((10 * 8.55) / 9, rubric.threshold), false);
    const exact = await gate(makeFixture(), {}, { fetch: mockJudge({ level: 8.55 }).fetch });
    assert.deepEqual([exact.status, exact.exitCode, exact.report.dimensions.audio.score0to10], ['requires_further_work', 1, 9.5]);
    assert.ok(exact.report.dimensions.audio.blockers.includes('score_not_above_threshold'));
    const above = await gate(makeFixture(), {}, { fetch: mockJudge({ level: 8.559 }).fetch });
    assert.deepEqual([above.status, above.report.dimensions.audio.score0to10], ['passed', 9.51]);
  });
  await check('gate: a high score never overrides gaps, open defects, failed tests or judge-side doubts', async () => {
    const gap = await gate(makeFixture(({ evidence }) => { evidence.dimensions.audio.observations = []; }), {}, { fetch: mockJudge().fetch });
    assert.deepEqual([gap.status, gap.report.dimensions.audio.score0to10, gap.report.dimensions.audio.preliminaryScore0to10], ['requires_further_work', null, 10]);
    assert.ok(gap.report.ownerOnlyGaps.some((item) => item.id === 'AU2'));
    const defect = await gate(makeFixture(({ evidence }) => { evidence.openDefects = [{ id: 'NET-01', dimensions: ['multiplayer'], severity: 'P1', summary: 'Late join is not verified.' }]; }), {}, { fetch: mockJudge().fetch });
    assert.equal(defect.status, 'requires_further_work');
    assert.ok(defect.report.dimensions.multiplayer.blockers.includes('open_defects'));
    const failedTest = await gate(makeFixture(({ evidence }) => { evidence.tests.push({ name: 'verify:orc', status: 'failed', dimensions: ['reliability'] }); }), {}, { fetch: mockJudge().fetch });
    assert.deepEqual([failedTest.status, failedTest.report.passConditions.allTestsPassed], ['requires_further_work', false]);
    const doubtful = await gate(makeFixture(), {}, { fetch: mockJudge({ requirementNoul: 0.2 }).fetch });
    assert.equal(doubtful.status, 'requires_further_work');
    assert.ok(doubtful.report.dimensions.vfx.blockers.some((item) => item.startsWith('requirement_not_established:')));
  });
  await check('gate: a canary above its bound marks the whole run judge_unreliable', async () => {
    const flattered = await gate(makeFixture(), {}, { fetch: mockJudge({ canary: { flattery: { score: 8.7 } } }).fetch });
    assert.deepEqual([flattered.status, flattered.exitCode, flattered.report.canaries.sane], ['judge_unreliable', 1, false]);
    const irrelevant = await gate(makeFixture(), {}, { fetch: mockJudge({ canary: { irrelevant: { score: 4 } } }).fetch });
    assert.equal(irrelevant.status, 'judge_unreliable');
    const blind = await gate(makeFixture(), {}, { fetch: mockJudge({ canary: { known_defect: { defectAbsent: 0.9 } } }).fetch });
    assert.equal(blind.status, 'judge_unreliable');
  });
  await check('gate: any failed request or invalid answer is evaluation_error, never passed', async () => {
    const failed = await gate(makeFixture(), {}, { fetch: mockJudge({ failDimension: 'vfx' }).fetch });
    assert.deepEqual([failed.status, failed.exitCode, failed.report.dimensions.vfx.requestOk], ['evaluation_error', 2, false]);
    const invalid = await gate(makeFixture(), {}, { fetch: mockJudge({ level: 12 }).fetch });
    assert.deepEqual([invalid.status, invalid.exitCode], ['evaluation_error', 2]);
    const noKey = await gate(makeFixture(), {}, { fetch: mockJudge().fetch, env: {} });
    assert.deepEqual([noKey.status, noKey.exitCode], ['pending_credential', 2]);
  });
  await check('gate: --dimension evaluates one dimension and can never pass the run', async () => {
    const judge = mockJudge();
    const partial = await gate(makeFixture(), { dimension: 'mobile' }, { fetch: judge.fetch });
    assert.deepEqual([partial.status, partial.exitCode, judge.calls.length, Object.keys(partial.report.dimensions)], ['partial_run', 1, 4, ['mobile']]);
    await assert.rejects(() => gate(makeFixture(), { dimension: 'nope' }, { fetch: judge.fetch }));
    assert.throws(() => parseArgs(['--evidence']));
  });
  await check('ledger: prose-only re-query is refused; new artifacts re-open only their dimension; --force records the reason', async () => {
    const fixture = makeFixture();
    const judge = mockJudge({ level: 7 });
    const ledgerFile = path.join(fixture.root, 'ledger.jsonl');
    assert.equal((await gate(fixture, { outName: 'run1' }, { fetch: judge.fetch })).status, 'requires_further_work');
    const callsAfterFirst = judge.calls.length;
    const same = await gate(fixture, { outName: 'run2' }, { fetch: judge.fetch });
    assert.deepEqual([same.status, same.exitCode, judge.calls.length], ['refused_requery', 4, callsAfterFirst]);
    fixture.evidence.dimensions.vfx.observations[0].result = 'Reworded: the behaviour was seen clearly in every native capture listed in the review.';
    fs.writeFileSync(fixture.evidenceFile, JSON.stringify(fixture.evidence));
    const reworded = await gate(fixture, { outName: 'run3' }, { fetch: judge.fetch });
    assert.deepEqual([reworded.status, judge.calls.length], ['refused_requery', callsAfterFirst]);
    fixture.evidence.artifacts.extra = fixture.put('out/extra.md', `Second native review for manifest ${fixture.manifest.sha256}\n`);
    fixture.evidence.dimensions.vfx.observations[0].artifacts.push('extra');
    fs.writeFileSync(fixture.evidenceFile, JSON.stringify(fixture.evidence));
    const gained = await gate(fixture, { outName: 'run4' }, { fetch: judge.fetch });
    assert.equal(judge.calls.length, callsAfterFirst + 4, 'only vfx and its three canaries are asked again');
    assert.ok(gained.report.dimensions.audio.carriedForward && !gained.report.dimensions.vfx.carriedForward);
    assert.equal(gained.report.delta.against.sameCandidate, true);
    assert.equal(gained.report.delta.dimensions.vfx.scoreDelta, 0);
    const forced = await gate(fixture, { outName: 'run5', force: 'questions were reworded after calibration' }, { fetch: judge.fetch });
    assert.equal(judge.calls.length, callsAfterFirst + 4 + dimensionIds.length * 4);
    assert.equal(forced.report.forced.reason, 'questions were reworded after calibration');
    const ledger = readLedger(ledgerFile);
    assert.deepEqual([ledger.ok, ledger.entries.map((entry) => entry.type)], [true, ['evaluation', 'refused_requery', 'refused_requery', 'evaluation', 'evaluation']]);
    assert.equal(ledger.entries.at(-1).forced.reason, 'questions were reworded after calibration');
    // Stale answers: prose changed without a new artifact -> carried forward but blocked.
    fixture.evidence.dimensions.audio.observations[0].result = 'Reworded owner summary.';
    fixture.evidence.artifacts.extra2 = fixture.put('out/extra2.md', `Third review for manifest ${fixture.manifest.sha256}\n`);
    fixture.evidence.dimensions.vfx.observations[0].artifacts.push('extra2');
    fs.writeFileSync(fixture.evidenceFile, JSON.stringify(fixture.evidence));
    const stale = await gate(fixture, { outName: 'run6' }, { fetch: judge.fetch });
    assert.ok(stale.report.dimensions.audio.blockers.includes('stale_answers_requery_refused'));
    // Tampering with history is detected and stops the gate.
    const lines = fs.readFileSync(ledgerFile, 'utf8').split('\n');
    lines[0] = lines[0].replace('"requires_further_work"', '"passed"');
    fs.writeFileSync(ledgerFile, lines.join('\n'));
    assert.equal(readLedger(ledgerFile).ok, false);
    assert.deepEqual([(await gate(fixture, { outName: 'run7' }, { fetch: judge.fetch })).status], ['ledger_corrupt']);
    assert.throws(() => appendLedgerEntry(ledgerFile, { type: 'evaluation' }));
  });
  await check('ledger: defects recorded by one evaluation cannot vanish from the next evidence', async () => {
    const fixture = makeFixture(({ evidence }) => { evidence.openDefects = [{ id: 'ANIM-01', dimensions: ['animation'], severity: 'P1', summary: 'Feet slide.' }]; });
    await gate(fixture, { outName: 'first' }, { fetch: mockJudge().fetch });
    fixture.evidence.openDefects = [];
    fs.writeFileSync(fixture.evidenceFile, JSON.stringify(fixture.evidence));
    const judge = mockJudge();
    const second = await gate(fixture, { outName: 'second' }, { fetch: judge.fetch });
    assert.deepEqual([second.status, judge.calls.length], ['lint_failed', 0]);
    assert.ok(second.report.lint.errorList.some((item) => item.code === 'defect_disappeared'));
  });
  await check('gate: the key is never written to disk, even when the provider echoes it', async () => {
    const fixture = makeFixture();
    const judge = mockJudge({ echoAuthorization: true });
    const result = await gate(fixture, {}, { fetch: judge.fetch });
    assert.equal(result.status, 'passed');
    assert.ok(judge.calls.every((call) => call.authorization === `Bearer ${SYNTHETIC_KEY}` && call.url === 'https://api.typesafe.ai/v1/systemone'));
    for (const file of filesUnder(fixture.root)) assert.ok(!fs.readFileSync(file).includes(SYNTHETIC_KEY), `${path.relative(fixture.root, file)} contains the key`);
    assert.match(fs.readFileSync(path.join(result.outDir, 'responses.json'), 'utf8'), /\[REDACTED\]/);
  });
  await check('gate: --calibrate asks only synthetic states and writes no ledger', async () => {
    const root = path.join(temporary, 'calibration');
    const judge = mockJudge({ level: 9 });
    const dry = await runGate({ calibrate: true, dryRun: true, out: path.join(root, 'dry') }, { env: {}, log: silent, fetch: judge.fetch });
    assert.deepEqual([dry.status, judge.calls.length], ['dry_run_not_evaluated', 0]);
    const result = await runGate({ calibrate: true, out: path.join(root, 'real'), dimension: 'audio' }, { env: { TYPESAFE_API_KEY: SYNTHETIC_KEY }, log: silent, fetch: judge.fetch, sleep: async () => {} });
    assert.deepEqual([result.status, result.exitCode, judge.calls.length], ['calibration_completed', 0, 4]);
    assert.ok(judge.calls.every((call) => call.body.state.candidate.id === 'synthetic-canary-not-a-candidate'));
    assert.equal(result.report.dimensions.audio.canariesSane, true);
    assert.ok(fs.existsSync(path.join(root, 'real', 'calibration.md')));
  });
  await check('cli: child process with mocked fetch — exit codes and no key on disk', () => {
    const fixture = makeFixture();
    const mock = `globalThis.fetch = async (url, init) => { const body = JSON.parse(init.body); const synthetic = body.state.candidate.id.startsWith('synthetic'); const defect = body.state.open_defects.length > 0; const answers = Object.fromEntries(Object.entries(body.questions).map(([id, q]) => [id, q.type === 'score' ? { type: 'score', score: synthetic ? 1 : 9, confidence: 0.9 } : { type: 'noul', noul: !synthetic ? (id === 'lint_unbacked_praise' ? 0.01 : 0.99) : id === 'lint_unbacked_praise' ? 0.95 : defect && id === 'major_defect_absent' ? 0.02 : 0.03 }])); return new Response(JSON.stringify({ model: 'jev-1.13.0', answers, echo: init.headers.Authorization }), { status: 200 }); };`;
    const run = (extra) => spawnSync(process.execPath, ['--import', `data:text/javascript;base64,${Buffer.from(mock).toString('base64')}`, path.resolve('tools/jef-gate.mjs'), '--evidence', fixture.evidenceFile, '--root', fixture.root, '--ledger', path.join(fixture.root, 'cli-ledger.jsonl'), ...extra], { env: { ...sanitizedChildEnv(), TYPESAFE_API_KEY: SYNTHETIC_KEY }, encoding: 'utf8' });
    const lintOnly = run(['--out', path.join(fixture.root, 'cli-lint'), '--lint-only']);
    assert.equal(lintOnly.status, 0, lintOnly.stderr);
    const first = run(['--out', path.join(fixture.root, 'cli-1')]);
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.root, 'cli-1', 'report.json'), 'utf8')).status, 'passed');
    assert.equal(run(['--out', path.join(fixture.root, 'cli-2')]).status, 4);
    for (const file of filesUnder(fixture.root)) assert.ok(!fs.readFileSync(file).includes(SYNTHETIC_KEY), `${file} contains the key`);
    assert.ok(![first.stdout, first.stderr].join('').includes(SYNTHETIC_KEY));
  });

  // ======================================== Surrounding tooling ===========================================
  await check('child servers never inherit secrets', () => {
    const env = sanitizedChildEnv({ PORT: '0' }, { PATH: '/bin', TYPESAFE_API_KEY: 'x', SUPABASE_URL: 'https://x', SUPABASE_SERVICE_ROLE_KEY: 'y', OPENAI_API_KEY: 'z', GITHUB_TOKEN: 't', DB_PASSWORD: 'p', MONKEY: 'kept', KEYBOARD_LAYOUT: 'kept' });
    assert.deepEqual([env.TYPESAFE_API_KEY, env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.OPENAI_API_KEY, env.GITHUB_TOKEN, env.DB_PASSWORD, env.MONKEY, env.KEYBOARD_LAYOUT, env.PATH, env.PORT], ['', '', '', '', '', '', 'kept', 'kept', '/bin', '0']);
    assert.match(fs.readFileSync('tools/quality-isolated-server.mjs', 'utf8'), /env:sanitizedChildEnv\(/);
    assert.doesNotMatch(fs.readFileSync('tools/quality-isolated-server.mjs', 'utf8'), /\.\.\.process\.env/);
  });
  await check('candidate manifest fingerprint equals the browser suites sourceFingerprint()', async () => {
    // quality-browser.mjs creates its evidence directory on import; keep that out of output/ when run standalone.
    if (!suiteEvidenceDirectory) process.env.BIPX_EVIDENCE_DIR = path.join(temporary, 'quality-browser-evidence');
    const { sourceFingerprint } = await import('./quality-browser.mjs');
    assert.deepEqual(fingerprintSources(process.cwd()), sourceFingerprint());
  });
  await check('device QA module is isolated and loaded by one last script line', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((match) => match[1]);
    assert.equal(scripts.at(-1), './src/qa/device-report.js');
    assert.equal(scripts.filter((src) => src.includes('device-report')).length, 1);
    const source = fs.readFileSync('src/qa/device-report.js', 'utf8');
    assert.doesNotMatch(source, /^\s*import\s/m, 'the QA module must import nothing');
    assert.doesNotMatch(source, /__zombieNightDebug|main\.js['"]/);
    assert.match(source, /Copiar relatório QA/);
    assert.match(source, /min-width:44px;min-height:44px/);
  });
  assert.equal(GATE_POLICY.evidenceCompleteMin, 0.95);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

const summary = { scope: 'Synthetic JEF gate v2 contract tests. Fetch is always mocked; no external request, provider evaluation, or actual game grade.', passed: true, checks };
if (suiteEvidenceDirectory) { fs.mkdirSync(suiteEvidenceDirectory, { recursive: true }); fs.writeFileSync(path.join(suiteEvidenceDirectory, 'jef-gate-contract.json'), `${JSON.stringify(summary, null, 2)}\n`); }
console.log(JSON.stringify({ passed: true, checks: checks.length }));
