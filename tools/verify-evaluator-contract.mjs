import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { evidenceDir } from './quality-browser.mjs';

const rubric = JSON.parse(fs.readFileSync('docs/quality-rubric.json'));
// Owner decision dated 2026-09-19: success is a score STRICTLY ABOVE 9.5 in every dimension (previously `>= 10`).
// Only the numeric target changed; coverage, defect and test requirements below are unchanged.
assert.deepEqual([rubric.threshold.operator, rubric.threshold.value], ['>', 9.5]);
assert.deepEqual([rubric.threshold.decision?.by, rubric.threshold.decision?.date], ['owner', '2026-09-19']);
assert.deepEqual([rubric.threshold.scope, rubric.threshold.missingEvidence], ['every_dimension', 'pending_never_pass']);
const keys = Object.keys(rubric.dimensions);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bipx-jev-contract-'));
const results = [];
try {
  for (const scenario of [
    // Level scores map to 0-10 as 10 * score / 9: 9 -> 10, 8.559 -> 9.51, 8.55 -> exactly 9.5, 8.541 -> 9.49.
    { name: 'ten-complete-passes', score: 9, passed: true },
    { name: '9.51-is-above-9.5', score: 8.559, passed: true },
    { name: 'exactly-9.5-is-not-above-9.5', score: 8.55, passed: false },
    { name: '9.49-is-not-rounded-upward', score: 8.541, passed: false },
    { name: 'missing-evidence-remains-null', score: 9, incomplete: true, passed: false },
    { name: 'known-defect-blocks-pass', score: 9, defect: true, passed: false },
    { name: 'failed-test-blocks-pass', score: 9, failedTest: true, passed: false },
    { name: 'invalid-answer-is-not-score', score: 10, passed: false },
  ]) {
    const input = path.join(temporary, `${scenario.name}-input.json`);
    const output = path.join(temporary, `${scenario.name}-output.json`);
    const evidence = { dimensions: Object.fromEntries(keys.map(key => [key, { coverage: 'complete', observations: ['Synthetic contract-test observation; not game evidence.'], evidence: ['Synthetic fixture'] }])), tests: [{ status: scenario.failedTest ? 'failed' : 'passed' }], openDefects: scenario.defect ? ['Synthetic open defect'] : [] };
    if (scenario.incomplete) evidence.dimensions[keys[0]].coverage = 'pending';
    fs.writeFileSync(input, JSON.stringify(evidence));
    const answers = Object.fromEntries(keys.map(key => [key, { type: 'score', score: scenario.score, confidence: 1 }]));
    answers.evidence_complete = { type: 'noul', noul: 1 };
    answers.major_defect_absent = { type: 'noul', noul: 1 };
    const mock = `globalThis.fetch = async () => new Response(${JSON.stringify(JSON.stringify({ answers }))}, { status: 200, headers: { 'content-type': 'application/json' } });`;
    const fixture = `data:text/javascript;base64,${Buffer.from(mock).toString('base64')}`;
    const child = spawnSync(process.execPath, ['--import', fixture, 'tools/evaluate-jev.mjs', '--state', input, '--output', output], { env: { ...process.env, TYPESAFE_API_KEY: 'synthetic-contract-key-no-external-request' }, encoding: 'utf8' });
    const actual = JSON.parse(fs.readFileSync(output));
    assert.equal(child.status, scenario.passed ? 0 : 1, `${scenario.name}: ${child.stderr}`);
    assert.equal(actual.targetScore, 9.5);
    assert.equal(actual.targetOperator, '>');
    assert.equal(actual.allDimensionsMeetTarget, scenario.passed, scenario.name);
    assert.equal(actual.allDimensionsStrictlyAbove95, scenario.passed, scenario.name);
    assert.equal(actual.fullGoalComplete, false);
    if (scenario.incomplete) assert.equal(actual.dimensions[keys[0]].score0to10, null);
    results.push({ name: scenario.name, passed: true });
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
const report = { scope: 'Synthetic evaluator contract tests. Fetch is replaced before the CLI loads; no external request, provider evaluation, or actual game grade.', passed: true, checks: results };
fs.writeFileSync(path.join(evidenceDir, 'evaluator-contract.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: true, checks: results.length, evidenceDirectory: evidenceDir }));
