// JEF gate v2 (design: docs/arpg/aaa-loop/jef-research.md §2.1). tools/evaluate-jev.mjs stays as history.
//
//   node tools/jef-gate.mjs --evidence <file> --out <dir> [--dry-run] [--dimension <id>] [--force "<reason>"]
//                           [--ledger <file>] [--root <dir>] [--rubric <file>] [--lint-only]
//   node tools/jef-gate.mjs --calibrate --out <dir> [--dry-run] [--dimension <id>]
//
// Order of operations: evidence lint in code (failure => no API call) -> ledger re-query rule -> ONE small
// request per dimension + canaries built in code -> decisions in code -> report.json, delta.md, ledger line.
// Exit codes: 0 passed / dry run / lint ok / calibration done; 1 requires_further_work, judge_unreliable or
// partial_run; 2 evaluation_error or pending_credential; 3 lint_failed or corrupt ledger; 4 refused_requery.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintEvidence, sha256 } from './lib/evidence-lint.mjs';
import { createJefClient, redactSecrets } from './lib/jef-client.mjs';
import { readLedger, appendLedgerEntry, lastEvaluation, lastEvaluationWithRubric, lastDimensionQuery, DEFAULT_LEDGER } from './lib/jef-ledger.mjs';
import { PROVIDER, GATE_POLICY, CANARY_KINDS, buildDimensionRequest, buildCanaryRequest, buildIdealCeilingRequest, evaluateCanary, readScoreAnswer, readNoulAnswer, requirementQuestionId, meetsThreshold } from './lib/jef-questions.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_FILE = path.join(here, 'lib', 'jef-questions.mjs');
const DEFAULT_RUBRIC = path.join(here, '..', 'docs', 'quality-rubric.json');
const ENVIRONMENT_KEYS = ['device', 'os', 'browser', 'physical', 'date', 'hardware', 'qualityMode', 'viewport'];
const USAGE = 'Usage: node tools/jef-gate.mjs --evidence <file> --out <dir> [--dry-run] [--dimension <id>] [--force "<reason>"] [--ledger <file>] [--root <dir>] [--rubric <file>] [--lint-only]\n       node tools/jef-gate.mjs --calibrate --out <dir> [--dry-run] [--dimension <id>]';

export function parseArgs(argv) {
  const options = { dryRun: false, lintOnly: false, calibrate: false };
  const valued = { '--evidence': 'evidence', '--out': 'out', '--dimension': 'dimension', '--force': 'force', '--ledger': 'ledger', '--root': 'root', '--rubric': 'rubric' };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--dry-run') options.dryRun = true;
    else if (flag === '--lint-only') options.lintOnly = true;
    else if (flag === '--calibrate') options.calibrate = true;
    else if (valued[flag]) { const value = argv[index + 1]; if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value.\n${USAGE}`); options[valued[flag]] = value; index += 1; }
    else throw new Error(`Unknown argument ${flag}.\n${USAGE}`);
  }
  return options;
}

const stable = (value) => JSON.stringify(value);
const round = (value, digits = 4) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

async function pool(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
    while (cursor < items.length) { const index = cursor; cursor += 1; results[index] = await worker(items[index], index); }
  }));
  return results;
}

function stateInputs({ evidence, lint, rubric, dimensionId, root }) {
  const block = evidence.dimensions[dimensionId];
  // Paths are only identifiers for the judge: never send the local home directory to the provider.
  const displayPath = (file) => { if (!path.isAbsolute(file)) return file; const relative = path.relative(root, file); return relative.startsWith('..') ? path.basename(file) : relative; };
  const observations = block.observations.map((observation) => ({
    id: observation.id,
    source: observation.source,
    ...(observation.inspector ? { inspector: observation.inspector } : {}),
    input_kind: observation.inputKind,
    ...(observation.environment ? { environment: Object.fromEntries(ENVIRONMENT_KEYS.filter((key) => observation.environment[key] !== undefined).map((key) => [key, observation.environment[key]])) } : {}),
    method: observation.method,
    result: observation.result,
    limits: observation.limits,
    ...(observation.source === 'owner' ? { owner_verbatim: observation.verbatim } : {}),
    artifacts: observation.artifacts.map((id) => displayPath(evidence.artifacts[id].path)),
  }));
  const verifiedMeasurements = lint.observations[dimensionId].flatMap((observation) => observation.verifiedClaims.map((claim) => `${claim.claim}: ${JSON.stringify(claim.value)} (observation ${observation.id}; checked by code against ${displayPath(claim.artifactPath)})`));
  for (const row of lint.coverage[dimensionId].scenarios) for (const bound of row.bounds ?? []) verifiedMeasurements.push(`Required bound ${bound.metric} ${bound.op} ${bound.limit}: ${bound.ok ? 'met' : bound.values.length ? 'not met' : 'no verified measurement'} (compared by code)`);
  const tests = lint.tests.entries.filter((test) => test.dimensions.includes(dimensionId)).map((test) => ({ name: test.name, status: test.status }));
  const testSummary = lint.tests.total === 0 ? 'No test suite is recorded.' : lint.tests.failed.length ? `Some recorded test suites failed: ${lint.tests.failed.join(', ')}.` : 'All recorded test suites passed.';
  return {
    rubric, dimensionId,
    candidate: { id: evidence.candidate.id, manifestSha256: evidence.candidate.manifest.sha256 },
    observations, verifiedMeasurements,
    requirementsWithoutEvidence: lint.coverage[dimensionId].missing.map((row) => row.text),
    openDefects: lint.defects.open.filter((defect) => defect.dimensions.includes(dimensionId)).map(({ id, severity, status, summary }) => ({ id, severity, status, summary })),
    tests, testSummary,
  };
}

// Typed answers -> the judge record stored in the ledger. Returns null when any expected answer is invalid.
function readJudge(rubric, dimensionId, answers) {
  const dimension = rubric.dimensions[dimensionId];
  const score = readScoreAnswer(answers?.score, rubric.levels.length);
  const evidenceComplete = readNoulAnswer(answers?.evidence_complete);
  const majorDefectAbsent = readNoulAnswer(answers?.major_defect_absent);
  const unbackedPraise = readNoulAnswer(answers?.lint_unbacked_praise);
  const requirementNouls = Object.fromEntries(dimension.requiredScenarios.map((scenario) => [scenario.id, readNoulAnswer(answers?.[requirementQuestionId(scenario.id)])]));
  const invalid = [!score && 'score', evidenceComplete === null && 'evidence_complete', majorDefectAbsent === null && 'major_defect_absent', unbackedPraise === null && 'lint_unbacked_praise', ...Object.entries(requirementNouls).filter(([, value]) => value === null).map(([id]) => requirementQuestionId(id))].filter(Boolean);
  if (invalid.length) return { invalid };
  return { levelScore: score.levelScore, confidence: score.confidence, pAtLeast8: score.pAtLeast8, probabilities: score.probabilities, evidenceComplete, majorDefectAbsent, unbackedPraise, requirementNouls };
}

// Judge record + CURRENT code-computed coverage -> the dimension result. Used for fresh and carried-forward answers.
function deriveDimension({ rubric, dimensionId, judge, lint, canaries, carriedForward = null, stale = false }) {
  const policy = GATE_POLICY;
  const coverage = lint.coverage[dimensionId];
  const preliminary = (10 * judge.levelScore) / (rubric.levels.length - 1);
  const complete = coverage.status === 'complete';
  const matrix = coverage.scenarios.map((row) => ({ id: row.id, kind: row.kind, ownerOnly: row.ownerOnly, coveredInCode: row.covered, reason: row.reason, noul: judge.requirementNouls[row.id] ?? null, text: row.text }))
    .sort((a, b) => Number(a.coveredInCode) - Number(b.coveredInCode) || (a.noul ?? 0) - (b.noul ?? 0) || a.id.localeCompare(b.id));
  const blockers = [];
  if (!complete) blockers.push('coverage_incomplete');
  if (!meetsThreshold(preliminary, rubric.threshold)) blockers.push('score_not_above_threshold');
  if (judge.evidenceComplete < policy.evidenceCompleteMin) blockers.push('evidence_complete_below_min');
  if (judge.majorDefectAbsent < policy.majorDefectAbsentMin) blockers.push('major_defect_absent_below_min');
  if (judge.unbackedPraise >= policy.unbackedPraiseBlockAt) blockers.push('unbacked_praise_flagged');
  for (const row of matrix) if (row.noul !== null && row.noul < policy.requirementNoulBlockBelow) blockers.push(`requirement_not_established:${row.id}`);
  if (lint.defects.open.some((defect) => defect.dimensions.includes(dimensionId))) blockers.push('open_defects');
  if (canaries.some((canary) => !canary.sane)) blockers.push('canary_failed');
  if (stale) blockers.push('stale_answers_requery_refused');
  const marginWarnings = [];
  if (judge.pAtLeast8 !== null && judge.pAtLeast8 < policy.pAtLeast8Target) marginWarnings.push(`P(level >= 8) ${judge.pAtLeast8} is below ${policy.pAtLeast8Target}`);
  if (judge.confidence !== null && judge.confidence < policy.confidenceTarget) marginWarnings.push(`confidence ${judge.confidence} is below ${policy.confidenceTarget}`);
  const uncertain = matrix.filter((row) => row.noul !== null && row.noul >= policy.requirementNoulBlockBelow && row.noul < policy.requirementNoulTarget).map((row) => row.id);
  if (uncertain.length) marginWarnings.push(`requirement nouls below ${policy.requirementNoulTarget}: ${uncertain.join(', ')}`);
  return {
    name: rubric.dimensions[dimensionId].name,
    score0to10: complete ? round(preliminary) : null, // pending never passes: no accepted score without complete coverage
    preliminaryScore0to10: round(preliminary),
    levelScore: judge.levelScore,
    pAtLeast8: judge.pAtLeast8,
    confidence: judge.confidence,
    probabilities: judge.probabilities,
    evidenceComplete: judge.evidenceComplete,
    majorDefectAbsent: judge.majorDefectAbsent,
    unbackedPraise: judge.unbackedPraise,
    coverage: { status: coverage.status, covered: coverage.covered, total: coverage.total, ownerOnlyMissing: coverage.ownerOnlyMissing },
    requirementMatrix: matrix,
    canaries,
    meetsThreshold: blockers.length === 0,
    blockers,
    marginWarnings,
    ...(carriedForward ? { carriedForward } : {}),
  };
}

function formatNumber(value, digits = 2) { return Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '—'; }

function renderDelta(report) {
  const lines = [];
  const push = (text = '') => lines.push(text);
  push(`# JEF gate v2 — ${report.status}`);
  push();
  push(`- Avaliado em: ${report.evaluatedAt}${report.mode === 'dry_run' ? ' (dry-run: nenhuma chamada à API)' : ''}`);
  push(`- Candidato: \`${report.candidate.id}\` — manifesto \`${String(report.candidate.manifestSha256).slice(0, 16)}…\``);
  push(`- Rubrica \`${report.rubricSha256.slice(0, 16)}…\` (schema ${report.rubricSchemaVersion}) · perguntas \`${report.questionsSha256.slice(0, 16)}…\` · modelo \`${report.requestedModel}\``);
  push(`- Alvo: nota ${report.threshold.operator} ${formatNumber(report.threshold.value, 1)} em TODAS as dimensões (decisão do dono de ${report.threshold.decision?.date ?? 's/d'}), lint limpo, canários sãos, zero defeito aberto e todos os testes passando.`);
  push(`- Lint: **${report.lint.status}** — ${report.lint.errors} erro(s), ${report.lint.warnings} aviso(s)${report.lint.gaps.length ? `, lacunas: ${report.lint.gaps.join(', ')}` : ''}.`);
  if (report.canaries) push(`- Canários: ${report.canaries.sane ? 'sãos' : '**FALHARAM — juiz não confiável nesta execução**'} (${report.canaries.results.length} checados).`);
  if (report.forced) push(`- Reconsulta FORÇADA. Motivo registrado: "${report.forced.reason}"`);
  push(`- Comparação: ${report.delta?.against ? `entrada de ${report.delta.against.evaluatedAt} (mesma rubrica${report.delta.against.sameCandidate ? ', mesmo candidato' : ', candidato diferente'}${report.delta.against.sameQuestions ? '' : '; PERGUNTAS MUDARAM — comparação apenas indicativa'})` : 'nenhuma entrada anterior com a mesma rubrica no ledger'}.`);
  if (report.usage) push(`- Uso: ${report.usage.requests} request(s), ${report.usage.inputTokens} tokens de entrada (~US$ ${report.usage.estimatedCostUsd.toFixed(5)}).`);
  push();
  if (report.dimensions && Object.keys(report.dimensions).length) {
    push('| Dimensão | Nota/10 | Δ | P(nível ≥ 8) | Confiança | Cobertura (código) | Só-do-dono em falta | Bloqueios |');
    push('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const [id, dimension] of Object.entries(report.dimensions)) {
      if (dimension.requestOk === false) { push(`| ${id} | erro | — | — | — | — | — | ${dimension.error} |`); continue; }
      const delta = report.delta?.dimensions?.[id]?.scoreDelta;
      const score = dimension.score0to10 === null ? `${formatNumber(dimension.preliminaryScore0to10)} (preliminar)` : formatNumber(dimension.score0to10);
      push(`| ${id}${dimension.carriedForward ? ' ↺' : ''} | ${score} | ${Number.isFinite(delta) ? `${delta >= 0 ? '+' : ''}${formatNumber(delta)}` : '—'} | ${formatNumber(dimension.pAtLeast8)} | ${formatNumber(dimension.confidence)} | ${dimension.coverage.covered}/${dimension.coverage.total} | ${dimension.coverage.ownerOnlyMissing.join(', ') || '—'} | ${dimension.blockers.join(', ') || '—'} |`);
    }
    push();
    push('↺ = resposta reaproveitada do ledger (mesmo candidato e rubrica, sem artefato novo nessa dimensão). Nota "preliminar" = cobertura incompleta; não conta como nota aceita.');
    push();
    push('## Matriz de requisitos (pior primeiro)');
    for (const [id, dimension] of Object.entries(report.dimensions)) {
      if (!dimension.requirementMatrix) continue;
      push();
      push(`### ${id} — ${dimension.name}`);
      push();
      push('| Req | Tipo | Coberto (código) | JEF noul | Requisito | Motivo da falta |');
      push('| --- | --- | --- | --- | --- | --- |');
      for (const row of dimension.requirementMatrix) push(`| ${row.id} | ${row.kind} | ${row.coveredInCode ? 'sim' : '**não**'} | ${formatNumber(row.noul)} | ${row.text} | ${row.reason ?? '—'} |`);
      if (dimension.marginWarnings.length) { push(); push(`Margem: ${dimension.marginWarnings.join('; ')}.`); }
    }
    push();
  } else if (report.lint.coverage) {
    push('## Cobertura calculada em código (sem resposta do JEF nesta execução)');
    push();
    push('| Dimensão | Cobertura | Requisitos sem evidência válida |');
    push('| --- | --- | --- |');
    for (const [id, coverage] of Object.entries(report.lint.coverage)) push(`| ${id} | ${coverage.covered}/${coverage.total} (${coverage.status}) | ${coverage.missing.map((row) => `${row.id}${row.ownerOnly ? ' (dono)' : ''}`).join(', ') || '—'} |`);
    push();
    push('Motivo de cada falta e texto de cada requisito: `lint.json` → `coverage.<dimensão>.missing`.');
    push();
  }
  push('## Lacunas que só o dono fecha');
  push();
  if (report.ownerOnlyGaps.length) for (const gap of report.ownerOnlyGaps) push(`- \`${gap.id}\` (${gap.dimension}, ${gap.kind}): ${gap.text}`);
  else push('- Nenhuma.');
  push();
  push('Roteiro das sessões do dono: `docs/arpg/aaa-loop/owner-session-form.md`.');
  if (report.canaries && !report.canaries.sane) { push(); push('## Canários que falharam'); push(); for (const canary of report.canaries.results.filter((item) => !item.sane)) push(`- ${canary.dimension} / ${canary.kind}: ${canary.violations.join('; ')}`); }
  if (report.lint.errorList?.length) { push(); push('## Erros do lint (nenhuma chamada à API foi feita)'); push(); for (const item of report.lint.errorList) push(`- \`${item.code}\` ${item.path}: ${item.message}`); }
  if (report.lint.warningList?.length) { push(); push('## Avisos do lint'); push(); for (const item of report.lint.warningList.slice(0, 40)) push(`- \`${item.code}\` ${item.path}: ${item.message}`); }
  push();
  push('_O JEF lê apenas texto: esta nota é uma avaliação indireta das observações escritas. Aceite visual e sonoro continua separado (`fullGoalComplete` permanece `false` nesta ferramenta)._');
  return `${lines.join('\n')}\n`;
}

export async function runGate(options, deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((text) => console.log(text));
  const apiKey = env.TYPESAFE_API_KEY || '';
  if (!options.out) throw new Error(`--out is required.\n${USAGE}`);
  const outDir = path.resolve(options.out);
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, value) => { const file = path.join(outDir, name); fs.writeFileSync(file, typeof value === 'string' ? redactSecrets(value, [apiKey]) : `${JSON.stringify(redactSecrets(value, [apiKey]), null, 2)}\n`); return file; };

  const rubricBytes = fs.readFileSync(options.rubric ? path.resolve(options.rubric) : DEFAULT_RUBRIC);
  const rubric = JSON.parse(rubricBytes);
  if (!['>', '>='].includes(rubric.threshold?.operator) || !Number.isFinite(rubric.threshold?.value)) throw new Error('Invalid evaluation threshold in the rubric.');
  const rubricSha256 = sha256(rubricBytes);
  const questionsSha256 = sha256(fs.readFileSync(QUESTIONS_FILE));
  const allDimensions = Object.keys(rubric.dimensions);
  if (options.dimension && !rubric.dimensions[options.dimension]) throw new Error(`Unknown dimension "${options.dimension}". Known: ${allDimensions.join(', ')}`);
  const requested = options.dimension ? [options.dimension] : allDimensions;
  const base = { tool: 'bipx-jef-gate', version: 2, provider: PROVIDER, requestedModel: rubric.model, evaluatedAt: now().toISOString(), evaluationMode: 'indirect_text_evidence_only', directVisualEvaluation: false, directAudioEvaluation: false, rubricSha256, rubricSchemaVersion: rubric.schemaVersion ?? null, questionsSha256, threshold: rubric.threshold, policy: GATE_POLICY, fullGoalComplete: false };
  const finish = (report, exitCode) => { log(JSON.stringify({ status: report.status, exitCode, out: outDir })); return { exitCode, status: report.status, report, outDir }; };

  const send = async (requests) => {
    const client = createJefClient({ apiKey, fetch: deps.fetch ?? globalThis.fetch, sleep: deps.sleep, ...(deps.clientOptions ?? {}) });
    return pool(requests, GATE_POLICY.concurrency, async (request) => ({ request, response: await client.ask(request.body) }));
  };
  const usageOf = (exchanges) => { const inputTokens = exchanges.reduce((sum, item) => sum + (item.response.body?.usage?.input_tokens ?? 0), 0); return { requests: exchanges.length, inputTokens, outputTokens: exchanges.reduce((sum, item) => sum + (item.response.body?.usage?.output_tokens ?? 0), 0), estimatedCostUsd: inputTokens * GATE_POLICY.usdPerInputToken }; };
  const responseLog = (exchanges) => exchanges.map(({ request, response }) => ({ id: request.id, ok: response.ok, httpStatus: response.status, attempts: response.attempts, latencyMs: response.latencyMs, error: response.error ?? null, body: response.body ?? null, rawText: response.rawText }));

  // ---- Calibration: synthetic states only. No evidence, no candidate, no ledger, never a game score. ----
  if (options.calibrate) {
    const requests = requested.flatMap((dimensionId) => [...CANARY_KINDS.map((kind) => ({ id: `canary:${dimensionId}:${kind}`, kind: 'canary', canary: kind, dimension: dimensionId, body: buildCanaryRequest(rubric, dimensionId, kind) })), { id: `ceiling:${dimensionId}`, kind: 'ideal_ceiling', dimension: dimensionId, body: buildIdealCeilingRequest(rubric, dimensionId) }]);
    write('requests.json', requests);
    const report = { ...base, mode: options.dryRun ? 'dry_run' : 'real', kind: 'calibration', note: 'SYNTHETIC calibration of the judge. These are not candidate scores and must never be reported as the game grade.' };
    if (options.dryRun) { report.status = 'dry_run_not_evaluated'; write('calibration.json', report); return finish(report, 0); }
    if (!apiKey) { report.status = 'pending_credential'; report.reason = 'TYPESAFE_API_KEY is not set. No external evaluation was performed.'; write('calibration.json', report); return finish(report, 2); }
    const exchanges = await send(requests);
    write('responses.json', responseLog(exchanges));
    report.usage = usageOf(exchanges);
    report.dimensions = {};
    let failed = false;
    for (const dimensionId of requested) {
      const dimension = rubric.dimensions[dimensionId];
      const row = report.dimensions[dimensionId] = { canaries: [] };
      for (const { request, response } of exchanges.filter((item) => item.request.dimension === dimensionId)) {
        if (!response.ok) { failed = true; row.error = response.error; continue; }
        if (request.kind === 'canary') { const verdict = evaluateCanary(request.canary, response.body.answers, rubric.levels.length, dimension); if (!verdict.valid) failed = true; row.canaries.push(verdict); }
        else { const score = readScoreAnswer(response.body.answers?.score, rubric.levels.length); if (!score) { failed = true; continue; } row.idealCeiling = { score0to10: round(score.score0to10), pAtLeast8: score.pAtLeast8, confidence: score.confidence, reachesThreshold: meetsThreshold(score.score0to10, rubric.threshold) }; }
      }
      row.flatterable = row.canaries.some((canary) => canary.kind === 'flattery' && !canary.sane);
      row.canariesSane = row.canaries.length === CANARY_KINDS.length && row.canaries.every((canary) => canary.sane);
    }
    report.status = failed ? 'evaluation_error' : 'calibration_completed';
    report.summary = failed ? null : { flatterableDimensions: requested.filter((id) => report.dimensions[id].flatterable), insaneCanaryDimensions: requested.filter((id) => !report.dimensions[id].canariesSane), ceilingBelowThreshold: requested.filter((id) => !report.dimensions[id].idealCeiling?.reachesThreshold) };
    write('calibration.json', report);
    write('calibration.md', [`# Calibração sintética do JEF — ${report.status}`, '', '_Estados sintéticos construídos em código. NÃO é nota do jogo._', '', '| Dimensão | Bajulação (nível ≤ 5) | Irrelevante (nível ≤ 2) | Defeito conhecido (< 0,5) | Teto ideal /10 | Passa do limiar? |', '| --- | --- | --- | --- | --- | --- |', ...requested.map((id) => { const row = report.dimensions[id]; const pick = (kind) => row.canaries.find((canary) => canary.kind === kind); const cell = (canary, field) => (canary?.valid ? `${formatNumber(canary[field])} ${canary.sane ? 'ok' : '**FALHOU**'}` : 'erro'); return `| ${id} | ${cell(pick('flattery'), 'levelScore')} | ${cell(pick('irrelevant'), 'levelScore')} | ${cell(pick('known_defect'), 'majorDefectAbsent')} | ${formatNumber(row.idealCeiling?.score0to10)} | ${row.idealCeiling ? (row.idealCeiling.reachesThreshold ? 'sim' : '**não**') : 'erro'} |`; }), '', 'Se "Bajulação" falha, o juiz é bajulável nessa dimensão e nenhuma nota dela é confiável. Se o "teto ideal" não passa do limiar, o alvo é inalcançável com a redação atual dos níveis: levar ao dono antes de investir em evidência.', ''].join('\n'));
    return finish(report, failed ? 2 : 0);
  }

  // ---- Lint first. ------------------------------------------------------------------------------------
  if (!options.evidence) throw new Error(`--evidence is required.\n${USAGE}`);
  const evidenceBytes = fs.readFileSync(path.resolve(options.evidence));
  const evidence = JSON.parse(evidenceBytes);
  const evidenceSha256 = sha256(evidenceBytes);
  const ledgerFile = path.resolve(options.ledger ?? env.BIPX_JEF_LEDGER ?? DEFAULT_LEDGER);
  const ledger = readLedger(ledgerFile);
  const root = path.resolve(options.root ?? process.cwd());
  const lint = lintEvidence({ evidence, rubric, root, previousLedgerEntry: lastEvaluation(ledger.entries), now: now() });
  write('lint.json', { ...lint, evidenceSha256, rubricSha256 });
  const lintSummary = { status: lint.status, ok: lint.ok, clean: lint.clean, errors: lint.errors.length, warnings: lint.warnings.length, gaps: lint.gaps, errorList: lint.errors, warningList: lint.warnings, coverage: Object.fromEntries(allDimensions.map((id) => [id, { status: lint.coverage[id].status, covered: lint.coverage[id].covered, total: lint.coverage[id].total, missing: lint.coverage[id].missing }])) };
  const report = { ...base, mode: options.dryRun ? 'dry_run' : 'real', candidate: lint.candidate, evidenceSha256, artifactSetSha256: lint.artifactSetSha256, dimensionsRequested: requested, lint: lintSummary, ownerOnlyGaps: lint.ownerOnlyGaps, openDefects: lint.defects.open.map((defect) => defect.id), tests: { total: lint.tests.total, failed: lint.tests.failed, allPassed: lint.tests.allPassed }, ledger: { file: ledgerFile, entries: ledger.entries.length } };
  const record = (entry) => (options.dryRun || options.lintOnly ? null : appendLedgerEntry(ledgerFile, redactSecrets({ at: report.evaluatedAt, candidateManifestSha256: lint.candidate.manifestSha256, candidateId: lint.candidate.id, rubricSha256, questionsSha256, evidenceSha256, artifactSetSha256: lint.artifactSetSha256, dimensionsRequested: requested, ...entry }, [apiKey])));
  const save = () => { write('report.json', report); write('delta.md', renderDelta(report)); };

  if (!ledger.ok) { report.status = 'ledger_corrupt'; report.reason = ledger.problems.join('; '); save(); return finish(report, 3); }
  if (!lint.ok) { report.status = 'lint_failed'; report.reason = 'Evidence lint failed. No API call was made.'; record({ type: 'lint_failed', status: 'lint_failed', errorCodes: [...new Set(lint.errors.map((item) => item.code))] }); save(); return finish(report, 3); }
  if (options.lintOnly) { report.status = lint.clean ? 'lint_clean' : 'lint_ok_incomplete'; save(); return finish(report, 0); }

  // ---- Re-query rule: same candidate + rubric is asked again only where the evidence GAINED artifacts. ----
  const forced = options.force ? { reason: String(options.force) } : null;
  if (forced) report.forced = forced;
  const plan = requested.map((dimensionId) => {
    const body = buildDimensionRequest(stateInputs({ evidence, lint, rubric, dimensionId, root }));
    const stateSha256 = sha256(stable(body.state));
    const prior = lastDimensionQuery(ledger.entries, { candidateManifestSha256: lint.candidate.manifestSha256, rubricSha256, dimensionId });
    const gained = prior ? lint.dimensionArtifactHashes[dimensionId].filter((hash) => !prior.record.artifactHashes.includes(hash)) : [];
    const dropped = prior ? prior.record.artifactHashes.filter((hash) => !lint.dimensionArtifactHashes[dimensionId].includes(hash)) : [];
    return { dimensionId, body, stateSha256, prior, gained, dropped, query: !prior || gained.length > 0 || Boolean(forced) };
  });
  report.requeryPlan = plan.map(({ dimensionId, prior, gained, dropped, query, stateSha256 }) => ({ dimension: dimensionId, query, previouslyEvaluatedAt: prior?.entry.at ?? null, gainedArtifacts: gained.length, droppedArtifacts: dropped.length, stateChangedWithoutNewArtifact: Boolean(prior) && !gained.length && prior.record.stateSha256 !== stateSha256 }));
  const toQuery = options.dryRun ? plan : plan.filter((item) => item.query);
  const requests = toQuery.flatMap((item) => [{ id: `dimension:${item.dimensionId}`, kind: 'dimension', dimension: item.dimensionId, body: item.body }, ...CANARY_KINDS.map((kind) => ({ id: `canary:${item.dimensionId}:${kind}`, kind: 'canary', canary: kind, dimension: item.dimensionId, body: buildCanaryRequest(rubric, item.dimensionId, kind) }))]);
  write('requests.json', requests);

  if (options.dryRun) { report.status = 'dry_run_not_evaluated'; report.requestCount = requests.length; save(); return finish(report, 0); }
  if (!toQuery.length) {
    report.status = 'refused_requery';
    report.reason = 'This candidate + rubric was already evaluated and the evidence gained no artifact. Rewording is not new evidence. Add artifacts, change the candidate, or pass --force "<reason>" (the reason is recorded).';
    record({ type: 'refused_requery', status: 'refused_requery' }); save(); return finish(report, 4);
  }
  if (!apiKey) { report.status = 'pending_credential'; report.reason = 'TYPESAFE_API_KEY is not set. No external evaluation was performed.'; save(); return finish(report, 2); }

  const exchanges = await send(requests);
  write('responses.json', responseLog(exchanges));
  report.usage = usageOf(exchanges);
  report.responseModels = [...new Set(exchanges.map((item) => item.response.body?.model).filter(Boolean))];

  // ---- Decisions, all in code. --------------------------------------------------------------------------
  report.dimensions = {};
  const ledgerDimensions = {};
  const canaryResults = [];
  let requestFailed = false;
  for (const item of plan) {
    const { dimensionId } = item;
    if (!item.query) {
      const stale = item.prior.record.stateSha256 !== item.stateSha256;
      report.dimensions[dimensionId] = { requestOk: true, ...deriveDimension({ rubric, dimensionId, judge: item.prior.record.judge, lint, canaries: item.prior.record.canaries, stale, carriedForward: { fromEntrySha256: item.prior.entry.entrySha256, evaluatedAt: item.prior.entry.at, stateChanged: stale } }) };
      ledgerDimensions[dimensionId] = { queried: false, carriedFromEntrySha256: item.prior.entry.entrySha256 };
      continue;
    }
    const mine = exchanges.filter((exchange) => exchange.request.dimension === dimensionId);
    const main = mine.find((exchange) => exchange.request.kind === 'dimension').response;
    const canaries = mine.filter((exchange) => exchange.request.kind === 'canary').map(({ request, response }) => (response.ok ? { dimension: dimensionId, ...evaluateCanary(request.canary, response.body.answers, rubric.levels.length, rubric.dimensions[dimensionId]) } : { dimension: dimensionId, kind: request.canary, valid: false, sane: false, violations: [`request failed: ${response.error}`] }));
    canaryResults.push(...canaries);
    const judge = main.ok ? readJudge(rubric, dimensionId, main.body.answers) : null;
    const problem = !main.ok ? main.error : judge.invalid ? `invalid or missing typed answers: ${judge.invalid.join(', ')}` : canaries.some((canary) => !canary.valid) ? 'a canary request failed or returned invalid answers' : null;
    if (problem) { requestFailed = true; report.dimensions[dimensionId] = { requestOk: false, error: problem }; ledgerDimensions[dimensionId] = { queried: true, requestOk: false, error: problem }; continue; }
    const derived = deriveDimension({ rubric, dimensionId, judge, lint, canaries });
    report.dimensions[dimensionId] = { requestOk: true, latencyMs: main.latencyMs, ...derived };
    ledgerDimensions[dimensionId] = { queried: true, requestOk: true, stateSha256: item.stateSha256, artifactHashes: lint.dimensionArtifactHashes[dimensionId], judge, canaries, preliminaryScore0to10: derived.preliminaryScore0to10, score0to10: derived.score0to10, coverage: derived.coverage };
  }
  report.canaries = { sane: canaryResults.every((canary) => canary.sane), results: canaryResults };

  const fullRun = requested.length === allDimensions.length;
  const everyDimensionPasses = requested.every((id) => report.dimensions[id].requestOk && report.dimensions[id].meetsThreshold);
  report.allDimensionsStrictlyAboveThreshold = fullRun && requested.every((id) => report.dimensions[id].requestOk && meetsThreshold(report.dimensions[id].score0to10, rubric.threshold));
  report.passConditions = { fullRun, lintClean: lint.clean, allRequestsSucceeded: !requestFailed, canariesSane: report.canaries.sane, noOpenDefects: lint.defects.open.length === 0, allTestsPassed: lint.tests.allPassed, everyDimensionPasses };
  if (requestFailed) report.status = 'evaluation_error';
  else if (!report.canaries.sane) report.status = 'judge_unreliable';
  else if (!fullRun) report.status = 'partial_run';
  else report.status = Object.values(report.passConditions).every(Boolean) ? 'passed' : 'requires_further_work';
  report.interpretation = 'Scores judge text evidence only. Full goal completion requires independently inspected visual/audio/runtime evidence and all explicit requirements; this client does not declare it.';

  // ---- Delta versus the previous ledger entry with the SAME rubric hash. ---------------------------------
  const previous = lastEvaluationWithRubric(ledger.entries, rubricSha256);
  report.delta = { against: previous ? { evaluatedAt: previous.at, entrySha256: previous.entrySha256, candidateManifestSha256: previous.candidateManifestSha256, sameCandidate: previous.candidateManifestSha256 === lint.candidate.manifestSha256, sameQuestions: previous.questionsSha256 === questionsSha256, status: previous.status } : null, dimensions: {} };
  if (previous) {
    for (const id of requested) {
      const before = previous.results?.[id];
      const after = report.dimensions[id];
      if (!before || !after.requestOk) continue;
      report.delta.dimensions[id] = { scoreBefore: before.preliminaryScore0to10, scoreAfter: after.preliminaryScore0to10, scoreDelta: round(after.preliminaryScore0to10 - before.preliminaryScore0to10), coveredBefore: before.covered, coveredAfter: after.coverage.covered };
    }
    report.delta.openDefects = { added: report.openDefects.filter((id) => !(previous.openDefects ?? []).includes(id)), removed: (previous.openDefects ?? []).filter((id) => !report.openDefects.includes(id)) };
  }

  record({ type: 'evaluation', status: report.status, forced, queryCompleted: !requestFailed, canariesSane: report.canaries.sane, openDefects: report.openDefects, dimensions: ledgerDimensions, results: Object.fromEntries(requested.filter((id) => report.dimensions[id].requestOk).map((id) => [id, { preliminaryScore0to10: report.dimensions[id].preliminaryScore0to10, score0to10: report.dimensions[id].score0to10, covered: report.dimensions[id].coverage.covered, total: report.dimensions[id].coverage.total, carriedForward: Boolean(report.dimensions[id].carriedForward) }])), usage: report.usage });
  save();
  return finish(report, report.status === 'passed' ? 0 : report.status === 'evaluation_error' ? 2 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const result = await runGate(parseArgs(process.argv.slice(2))); process.exitCode = result.exitCode; }
  catch (error) { console.error(redactSecrets(String(error?.message ?? error), [process.env.TYPESAFE_API_KEY || ''])); process.exitCode = 2; }
}
