// Evidence lint for the JEF gate v2. Pure: reads local files only, never touches the network.
//
// It answers, in code, everything the text-only judge cannot be trusted with:
//   - every cited artifact exists and matches its recorded SHA-256;
//   - every artifact belongs to the SAME candidate manifest (source hashes, embedded manifest hash, or a bound sidecar);
//   - numeric claims are structured pointers `{claim, value, artifact, pointer}` compared against the JSON artifact;
//   - coverage is COMPUTED from `requiredScenarios` of docs/quality-rubric.json, never self-declared;
//   - `human` / `device` scenarios count only with an authentic `source: "owner"` observation (device + date);
//   - open defects can only disappear versus the previous ledger entry when closed with an artifact.
//
// Findings are split in two classes. ERRORS are integrity failures: the gate makes no API call. GAPS are
// honest incompleteness (uncovered scenarios, open defects, failed tests): a diagnostic query is allowed,
// but the run can never pass. See docs/quality-gates.md, "Evidence file schema v2".

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { findBannedPraise, isOwnerOnly } from './jef-questions.mjs';

export const EVIDENCE_SCHEMA_VERSION = 2;
export const OWNER_SESSIONS_DIR = 'docs/arpg/aaa-loop/owner-sessions';
const OWNER_SESSION_PATH = /^docs\/arpg\/aaa-loop\/owner-sessions\/[^/]+$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SOURCES = ['automation', 'agent', 'owner'];
const INPUT_KINDS = ['natural', 'fixture', 'not_applicable'];
const SELF_DECLARED_KEYS = ['coverage', 'requiredMissing', 'missingDimensions', 'covered', 'complete'];

export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const squash = (text) => String(text).replace(/\s+/g, ' ').trim();

export function resolvePointer(document, pointer) {
  if (pointer === '') return { found: true, value: document };
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return { found: false };
  let current = document;
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length) return { found: false };
      current = current[Number(key)];
    } else if (isObject(current) && Object.prototype.hasOwnProperty.call(current, key)) current = current[key];
    else return { found: false };
  }
  return { found: true, value: current };
}

const sameScalar = (a, b) => ['number', 'string', 'boolean'].includes(typeof a) && typeof a === typeof b && a === b && (typeof a !== 'number' || Number.isFinite(a));

function meetsBound(value, bound) {
  if (!Number.isFinite(value)) return false;
  if (bound.op === '<=') return value <= bound.limit;
  if (bound.op === '<') return value < bound.limit;
  if (bound.op === '>=') return value >= bound.limit;
  if (bound.op === '>') return value > bound.limit;
  throw new Error(`Unsupported bound operator ${bound.op}`);
}

function sourcesOf(document) {
  if (!isObject(document)) return null;
  for (const key of ['sources', 'candidateSources', 'sourceHashes']) if (isObject(document[key]) && Object.keys(document[key]).length) return document[key];
  return null;
}

export function lintEvidence({ evidence, rubric, root = process.cwd(), previousLedgerEntry = null, now = new Date() }) {
  const errors = [];
  const warnings = [];
  const error = (code, where, message, extra = {}) => errors.push({ code, path: where, message, ...extra });
  const warn = (code, where, message, extra = {}) => warnings.push({ code, path: where, message, ...extra });
  const dimensionIds = Object.keys(rubric.dimensions);
  const scenarioIndex = new Map();
  for (const dimensionId of dimensionIds) for (const scenario of rubric.dimensions[dimensionId].requiredScenarios ?? []) scenarioIndex.set(scenario.id, { dimensionId, scenario });
  const absolute = (file) => (path.isAbsolute(file) ? file : path.resolve(root, file));

  // 1. Shape, language, secrets and self-declared coverage -------------------------------------------
  if (!isObject(evidence)) { error('evidence_not_object', '', 'Evidence must be a JSON object.'); evidence = {}; }
  if (evidence.schemaVersion !== EVIDENCE_SCHEMA_VERSION) error('schema_version', '/schemaVersion', `Evidence schemaVersion must be ${EVIDENCE_SCHEMA_VERSION}.`);
  if (evidence.language !== undefined && evidence.language !== 'en') warn('language_not_english', '/language', 'Jev is most accurate in English; keep observations in plain English.');
  if (/apikey_[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]{16,}/.test(JSON.stringify(evidence))) error('secret_in_evidence', '', 'The evidence contains something that looks like a credential. Remove it; evidence is sent to the provider and written to disk.');
  const flagSelfDeclared = (object, where) => { if (isObject(object)) for (const key of SELF_DECLARED_KEYS) if (key in object) error('self_declared_coverage', `${where}/${key}`, `"${key}" is self-declared. Coverage is computed from requiredScenarios; remove the field.`); };
  flagSelfDeclared(evidence, '');

  // 2. Candidate manifest ----------------------------------------------------------------------------
  const candidate = isObject(evidence.candidate) ? evidence.candidate : {};
  const manifestSha = candidate.manifest?.sha256;
  let manifestSources = null;
  if (!isText(candidate.id)) error('candidate_id_missing', '/candidate/id', 'candidate.id is required.');
  if (!isText(candidate.manifest?.path) || !SHA256.test(String(manifestSha))) error('candidate_manifest_missing', '/candidate/manifest', 'candidate.manifest needs {path, sha256}.');
  else {
    const file = absolute(candidate.manifest.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) error('candidate_manifest_not_found', '/candidate/manifest/path', `Candidate manifest not found: ${candidate.manifest.path}`);
    else {
      const bytes = fs.readFileSync(file);
      const actual = sha256(bytes);
      if (actual !== manifestSha) error('candidate_manifest_hash_mismatch', '/candidate/manifest/sha256', 'Candidate manifest SHA-256 does not match the file.', { expected: manifestSha, actual });
      else {
        try { manifestSources = sourcesOf(JSON.parse(bytes)); } catch { /* reported below */ }
        if (!manifestSources) error('candidate_manifest_without_sources', '/candidate/manifest/path', 'Candidate manifest must be JSON with a non-empty `sources` map (path -> sha256). Create it with tools/jef-candidate-manifest.mjs.');
      }
    }
  }

  // 3. Artifacts: existence, hash, candidate binding ---------------------------------------------------
  const artifacts = {};
  const declared = isObject(evidence.artifacts) ? evidence.artifacts : {};
  if (!isObject(evidence.artifacts)) error('artifacts_missing', '/artifacts', '`artifacts` must be a map id -> {path, sha256}.');
  for (const [id, record] of Object.entries(declared)) {
    const where = `/artifacts/${id}`;
    const info = artifacts[id] = { id, path: record?.path ?? null, sha256: record?.sha256 ?? null, exists: false, hashOk: false, bound: false, binding: null, json: undefined, text: null, ownerSession: false, verified: false };
    if (!isObject(record) || !isText(record.path) || !SHA256.test(String(record.sha256))) { error('artifact_record_invalid', where, 'Artifact needs {path, sha256}.'); continue; }
    flagSelfDeclared(record, where);
    const file = absolute(record.path);
    // Owner sessions live in ONE place of the repository root; a look-alike folder elsewhere does not count.
    info.ownerSession = OWNER_SESSION_PATH.test(path.relative(root, file).split(path.sep).join('/'));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { error('artifact_missing', where, `Cited artifact does not exist: ${record.path}`); continue; }
    info.exists = true;
    const bytes = fs.readFileSync(file);
    info.bytes = bytes.length;
    const actual = sha256(bytes);
    if (actual !== record.sha256) { error('artifact_hash_mismatch', where, `Artifact SHA-256 does not match the file: ${record.path}`, { expected: record.sha256, actual }); continue; }
    info.hashOk = true;
    if (bytes.length <= 32 * 1024 * 1024 && !bytes.subarray(0, 8192).includes(0)) {
      info.text = bytes.toString('utf8');
      if (/\.json$/i.test(record.path)) { try { info.json = JSON.parse(info.text); } catch { error('artifact_json_invalid', where, `Artifact is not valid JSON: ${record.path}`); } }
    }
    if (!manifestSha || !manifestSources) continue;
    if (actual === manifestSha) { info.bound = true; info.binding = 'is_candidate_manifest'; continue; }
    const embedded = isObject(info.json) ? (isObject(info.json.sourceHashes) ? info.json.sourceHashes : isObject(info.json.candidate?.sourceHashes) ? info.json.candidate.sourceHashes : null) : null;
    if (embedded && Object.keys(embedded).length) {
      const stray = Object.entries(embedded).find(([file, hash]) => manifestSources[file] !== hash);
      if (stray) { error('artifact_from_other_candidate', where, `Artifact was produced from other sources than the candidate manifest (first difference: ${stray[0]}).`); continue; }
      info.bound = true; info.binding = 'source_hashes';
    } else if (info.text?.includes(manifestSha)) { info.bound = true; info.binding = 'manifest_hash_in_artifact'; }
    if (isObject(info.json) && info.json.sourceChangedDuringRun === true) { info.bound = false; error('artifact_source_changed_during_run', where, 'Artifact reports that sources changed during its run; it cannot describe a stable candidate.'); }
  }
  for (const [id, record] of Object.entries(declared)) {
    const info = artifacts[id];
    if (!info?.hashOk || info.bound || !isText(record.boundBy)) continue;
    const sidecar = artifacts[record.boundBy];
    if (sidecar?.bound && sidecar.text?.includes(info.sha256)) { info.bound = true; info.binding = `sidecar:${record.boundBy}`; }
  }
  for (const info of Object.values(artifacts)) {
    if (info.hashOk && !info.bound && manifestSha && manifestSources && !errors.some((item) => item.path === `/artifacts/${info.id}`)) error('artifact_not_bound_to_candidate', `/artifacts/${info.id}`, `Artifact does not reference the candidate manifest ${manifestSha.slice(0, 12)}… (needs matching sourceHashes, the manifest hash inside the file, or a bound sidecar via "boundBy").`);
    info.verified = info.exists && info.hashOk && info.bound;
  }

  // 4. Observations, claims, owner authenticity, praise ------------------------------------------------
  const dimensions = isObject(evidence.dimensions) ? evidence.dimensions : {};
  if (!isObject(evidence.dimensions)) error('dimensions_missing', '/dimensions', '`dimensions` must be a map of the rubric dimensions.');
  for (const key of Object.keys(dimensions)) if (!rubric.dimensions[key]) error('dimension_unknown', `/dimensions/${key}`, `Unknown dimension "${key}".`);
  const claimsReport = [];
  const observationIds = new Set();
  const usedArtifacts = new Set();
  const perDimension = {};
  const today = new Date(now.getTime() + 36 * 3600 * 1000).toISOString().slice(0, 10);

  for (const dimensionId of dimensionIds) {
    const where = `/dimensions/${dimensionId}`;
    const block = dimensions[dimensionId];
    const result = perDimension[dimensionId] = { observations: [], supports: new Map() };
    if (!isObject(block)) { error('dimension_missing', where, `Dimension "${dimensionId}" is missing (use an empty observations array when there is no evidence yet).`); continue; }
    flagSelfDeclared(block, where);
    if (!Array.isArray(block.observations)) { error('observations_missing', `${where}/observations`, '`observations` must be an array.'); continue; }
    block.observations.forEach((observation, index) => {
      const at = `${where}/observations/${index}`;
      const before = errors.length;
      if (!isObject(observation)) { error('observation_invalid', at, 'Observation must be an object.'); return; }
      flagSelfDeclared(observation, at);
      if (!isText(observation.id)) error('observation_id_missing', `${at}/id`, 'Observation needs an id.');
      else if (observationIds.has(observation.id)) error('observation_id_duplicate', `${at}/id`, `Duplicate observation id "${observation.id}".`);
      else observationIds.add(observation.id);
      if (!SOURCES.includes(observation.source)) error('observation_source_invalid', `${at}/source`, `source must be one of ${SOURCES.join(', ')}.`);
      if (!INPUT_KINDS.includes(observation.inputKind)) error('observation_input_kind_invalid', `${at}/inputKind`, `inputKind must be one of ${INPUT_KINDS.join(', ')} (debug-spawned setups are fixtures).`);
      for (const field of ['method', 'result']) if (!isText(observation[field])) error('observation_text_missing', `${at}/${field}`, `Observation needs a non-empty "${field}".`);
      if (typeof observation.limits !== 'string') error('observation_limits_missing', `${at}/limits`, 'Observation needs a "limits" string stating what it does not establish.');
      const scenarios = Array.isArray(observation.scenarios) ? observation.scenarios : [];
      if (!scenarios.length) error('observation_scenarios_missing', `${at}/scenarios`, 'Observation must name at least one requiredScenarios id.');
      for (const scenarioId of scenarios) {
        const known = scenarioIndex.get(scenarioId);
        if (!known) error('scenario_unknown', `${at}/scenarios`, `Unknown scenario id "${scenarioId}".`);
        else if (known.dimensionId !== dimensionId) error('scenario_wrong_dimension', `${at}/scenarios`, `Scenario "${scenarioId}" belongs to ${known.dimensionId}, not ${dimensionId}.`);
      }
      const cited = Array.isArray(observation.artifacts) ? observation.artifacts : [];
      if (!cited.length) error('observation_artifacts_missing', `${at}/artifacts`, 'Observation must cite at least one artifact id.');
      for (const artifactId of cited) {
        if (!artifacts[artifactId]) error('artifact_unknown', `${at}/artifacts`, `Observation cites unknown artifact id "${artifactId}".`);
        else { usedArtifacts.add(artifactId); if (!artifacts[artifactId].verified) error('observation_cites_unverified_artifact', `${at}/artifacts`, `Observation cites artifact "${artifactId}", which failed verification.`); }
      }
      const isOwner = observation.source === 'owner';
      for (const field of ['method', 'result', 'limits']) {
        const text = observation[field];
        if (typeof text !== 'string') continue;
        const terms = findBannedPraise(text);
        if (terms.length) (isOwner ? warn : error)('banned_praise_term', `${at}/${field}`, `Grading vocabulary (${terms.join(', ')}) instead of a measurement or an observed behaviour. Describe what happened.`, { terms });
        if (text.length > 700) warn('observation_text_long', `${at}/${field}`, 'Keep one fact per observation; long states lower the judge accuracy.');
        if (/[ãõáéíóúâêôàçÃÕÁÉÍÓÚÂÊÔÀÇ]/.test(text)) warn('non_english_text', `${at}/${field}`, 'Non-English text lowers the judge accuracy; keep the original words in "verbatim".');
      }

      // Claims: structured pointers verified in code.
      const verifiedClaims = [];
      const claims = observation.claims === undefined ? [] : observation.claims;
      if (!Array.isArray(claims)) error('claims_invalid', `${at}/claims`, '`claims` must be an array.');
      else claims.forEach((claim, claimIndex) => {
        const claimAt = `${at}/claims/${claimIndex}`;
        const entry = { observation: observation.id ?? null, claim: claim?.claim ?? null, metric: claim?.metric ?? null, scenario: claim?.scenario ?? null, value: claim?.value, artifact: claim?.artifact ?? null, pointer: claim?.pointer ?? null, ok: false };
        claimsReport.push(entry);
        if (!isObject(claim) || !isText(claim.claim) || !['number', 'string', 'boolean'].includes(typeof claim.value) || !isText(claim.artifact) || typeof claim.pointer !== 'string') { error('claim_invalid', claimAt, 'Claim needs {claim, value (number|string|boolean), artifact, pointer}.'); return; }
        if (claim.scenario !== undefined && !scenarios.includes(claim.scenario)) { error('claim_scenario_unknown', claimAt, `Claim scenario "${claim.scenario}" is not listed by this observation.`); return; }
        const target = artifacts[claim.artifact];
        if (!target) { error('claim_artifact_unknown', claimAt, `Claim cites unknown artifact id "${claim.artifact}".`); return; }
        usedArtifacts.add(claim.artifact);
        if (!target.verified) { error('claim_artifact_unverified', claimAt, `Claim cites artifact "${claim.artifact}", which failed verification.`); return; }
        if (target.json === undefined) { error('claim_artifact_not_json', claimAt, `Claims can only point into JSON artifacts ("${claim.artifact}" is not JSON).`); return; }
        const found = resolvePointer(target.json, claim.pointer);
        if (!found.found) { error('claim_pointer_missing', claimAt, `Pointer ${claim.pointer} does not exist in artifact "${claim.artifact}".`); return; }
        entry.actual = found.value;
        if (!sameScalar(found.value, claim.value)) { error('claim_mismatch', claimAt, `Claim "${claim.claim}" says ${JSON.stringify(claim.value)} but the artifact holds ${JSON.stringify(found.value)} at ${claim.pointer}.`, { expected: claim.value, actual: found.value }); return; }
        entry.ok = true;
        verifiedClaims.push({ ...entry, artifactPath: target.path });
      });
      if (!isOwner && !claims.length && /\d/.test(`${observation.result ?? ''}`)) warn('unverified_numbers_in_prose', `${at}/result`, 'Numbers in prose are not checked. Add claims {claim, value, artifact, pointer} so code verifies them.');

      // Owner observations must be authentic.
      let ownerAuthentic = false;
      if (isOwner) {
        const reasons = [];
        if (observation.inspector !== undefined || observation.agent !== undefined) reasons.push('carries an agent/inspector field');
        if (!isText(observation.verbatim)) reasons.push('has no "verbatim" with the owner\'s own words');
        const environment = isObject(observation.environment) ? observation.environment : {};
        if (!isText(environment.device)) reasons.push('has no environment.device');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(environment.date)) || Number.isNaN(Date.parse(environment.date))) reasons.push('has no environment.date (YYYY-MM-DD)');
        else if (environment.date > today) reasons.push('has an environment.date in the future');
        const sessions = cited.map((id) => artifacts[id]).filter((info) => info?.ownerSession && info.verified);
        if (!sessions.length) reasons.push(`cites no verified owner-session file under ${OWNER_SESSIONS_DIR}/`);
        else if (isText(observation.verbatim) && !sessions.some((info) => info.text && squash(info.text).includes(squash(observation.verbatim)))) reasons.push('"verbatim" text is not present in the cited owner-session file');
        if (reasons.length) error('owner_observation_not_authentic', at, `Observation claims source "owner" but ${reasons.join('; ')}.`, { reasons });
        else ownerAuthentic = true;
      } else if (observation.verbatim !== undefined) warn('verbatim_on_non_owner', `${at}/verbatim`, '"verbatim" is only meaningful on owner observations.');

      const valid = errors.length === before;
      const record = { id: observation.id, valid, source: observation.source, scenarios, ownerAuthentic, inspector: observation.inspector ?? null, verifiedClaims, artifacts: cited };
      result.observations.push(record);
      if (!valid) return;

      // Which of the listed scenarios does this observation establish, by kind?
      for (const scenarioId of scenarios) {
        const { scenario } = scenarioIndex.get(scenarioId);
        const environment = isObject(observation.environment) ? observation.environment : {};
        const scoped = verifiedClaims.filter((claim) => claim.scenario === null || claim.scenario === scenarioId);
        let counts = false;
        let reason = null;
        if (scenario.kind === 'automated') { counts = scoped.length > 0; if (!counts) reason = 'automated scenario needs at least one claim verified against a JSON artifact'; }
        else if (scenario.kind === 'agent_observed') { counts = isText(observation.inspector) || ownerAuthentic; if (!counts) reason = 'agent_observed scenario needs a named "inspector"'; }
        else if (scenario.kind === 'human') { counts = ownerAuthentic; if (!counts) reason = 'human scenario counts only with source "owner" (device + date)'; }
        else if (scenario.kind === 'device') { counts = ownerAuthentic && environment.physical === true && isText(environment.os) && isText(environment.browser); if (!counts) reason = 'device scenario counts only with source "owner" and environment {device, os, browser, physical: true, date}'; }
        if (!counts && isOwnerOnly(scenario) && !isOwner) warn('owner_only_scenario_without_owner', at, `Scenario ${scenarioId} is kind "${scenario.kind}": this ${observation.source} observation is kept as support but does not count.`);
        const list = result.supports.get(scenarioId) ?? [];
        list.push({ observation: observation.id, counts, reason, claims: scoped });
        result.supports.set(scenarioId, list);
      }
    });
  }
  // 5. Tests (verified against the real suite output, never trusted as typed) ---------------------------
  const tests = [];
  const declaredTests = evidence.tests === undefined ? [] : evidence.tests;
  if (!Array.isArray(declaredTests)) error('tests_invalid', '/tests', '`tests` must be an array.');
  else declaredTests.forEach((test, index) => {
    const at = `/tests/${index}`;
    if (!isObject(test) || !isText(test.name) || !['passed', 'failed'].includes(test.status)) { error('test_invalid', at, 'Test needs {name, status: passed|failed, dimensions, artifact, pointer, expected}.'); return; }
    const scope = Array.isArray(test.dimensions) ? test.dimensions : [];
    if (!scope.length || scope.some((id) => !rubric.dimensions[id])) error('test_dimensions_invalid', `${at}/dimensions`, 'Test needs a non-empty `dimensions` array of rubric dimension ids.');
    let verified = false;
    if (test.status === 'passed') {
      const target = artifacts[test.artifact];
      if (target) usedArtifacts.add(test.artifact);
      if (!target?.verified || target.json === undefined || typeof test.pointer !== 'string' || test.expected === undefined) error('test_status_unverified', at, `Test "${test.name}" says passed but gives no verified JSON artifact + pointer + expected value.`);
      else {
        const found = resolvePointer(target.json, test.pointer);
        if (!found.found || !sameScalar(found.value, test.expected)) error('test_status_mismatch', at, `Test "${test.name}" says passed but the artifact holds ${JSON.stringify(found.value)} at ${test.pointer} (expected ${JSON.stringify(test.expected)}).`);
        else verified = true;
      }
    } else if (test.artifact !== undefined && artifacts[test.artifact]) usedArtifacts.add(test.artifact);
    tests.push({ name: test.name, status: test.status, dimensions: scope, verified });
  });

  // 6. Defects and the diff against the previous ledger entry ------------------------------------------
  const openDefects = [];
  const closedDefects = [];
  const readDefects = (list, where, handler) => { if (list === undefined) return; if (!Array.isArray(list)) { error('defects_invalid', where, `${where.slice(1)} must be an array.`); return; } list.forEach((item, index) => handler(item, `${where}/${index}`)); };
  readDefects(evidence.openDefects, '/openDefects', (defect, at) => {
    if (!isObject(defect) || !isText(defect.id) || !isText(defect.summary)) { error('defect_invalid', at, 'Open defect needs {id, dimensions, severity, summary}.'); return; }
    const scope = Array.isArray(defect.dimensions) ? defect.dimensions : [];
    if (!scope.length || scope.some((id) => !rubric.dimensions[id])) error('defect_dimensions_invalid', `${at}/dimensions`, 'Open defect needs a non-empty `dimensions` array of rubric dimension ids.');
    if (openDefects.some((known) => known.id === defect.id)) error('defect_duplicate', at, `Duplicate open defect "${defect.id}".`);
    openDefects.push({ id: defect.id, dimensions: scope, severity: defect.severity ?? null, status: defect.status ?? 'open', summary: defect.summary });
  });
  readDefects(evidence.closedDefects, '/closedDefects', (defect, at) => {
    if (!isObject(defect) || !isText(defect.id) || !isText(defect.resolution)) { error('closed_defect_invalid', at, 'Closed defect needs {id, resolution, closedBy: {artifact}}.'); return; }
    const target = artifacts[defect.closedBy?.artifact];
    if (target) usedArtifacts.add(defect.closedBy.artifact);
    if (!target?.verified) error('defect_closed_without_artifact', at, `Defect "${defect.id}" is closed without a verified artifact of this candidate.`);
    if (openDefects.some((known) => known.id === defect.id)) error('defect_open_and_closed', at, `Defect "${defect.id}" is listed both open and closed.`);
    closedDefects.push({ id: defect.id, resolution: defect.resolution, artifact: defect.closedBy?.artifact ?? null, verified: Boolean(target?.verified) });
  });
  const previousOpen = (previousLedgerEntry?.openDefects ?? []).map((item) => (typeof item === 'string' ? item : item?.id)).filter(Boolean);
  const disappeared = previousOpen.filter((id) => !openDefects.some((defect) => defect.id === id) && !closedDefects.some((defect) => defect.id === id && defect.verified));
  for (const id of disappeared) error('defect_disappeared', '/openDefects', `Defect "${id}" was open in the previous ledger entry and is neither open nor closed with an artifact now. Defects do not vanish.`);
  for (const id of Object.keys(artifacts)) if (!usedArtifacts.has(id)) warn('artifact_unused', `/artifacts/${id}`, 'Artifact is not cited by any observation, claim, test or defect closure.');

  // 7. Roles ------------------------------------------------------------------------------------------
  const roles = isObject(evidence.roles) ? evidence.roles : {};
  if (!isText(roles.implementer) || !isText(roles.reviewer)) warn('roles_missing', '/roles', 'Name `roles.implementer` and `roles.reviewer`; the reviewer must not be the implementer.');
  else if (squash(roles.implementer).toLowerCase() === squash(roles.reviewer).toLowerCase()) warn('roles_not_separated', '/roles', 'Implementer and reviewer are the same; confirmation bias is likely.');

  // 8. Coverage, computed --------------------------------------------------------------------------------
  const coverage = {};
  for (const dimensionId of dimensionIds) {
    const scenarios = rubric.dimensions[dimensionId].requiredScenarios ?? [];
    const rows = scenarios.map((scenario) => {
      const supports = perDimension[dimensionId]?.supports.get(scenario.id) ?? [];
      const counting = supports.filter((item) => item.counts);
      let covered = counting.length > 0;
      let reason = covered ? null : supports.find((item) => item.reason)?.reason ?? 'no observation addresses this scenario';
      const bounds = [];
      for (const bound of scenario.bounds ?? []) {
        const values = counting.flatMap((item) => item.claims).filter((claim) => claim.metric === bound.metric);
        const ok = values.length > 0 && values.every((claim) => meetsBound(claim.value, bound));
        bounds.push({ ...bound, values: values.map((claim) => claim.value), ok });
        if (covered && !ok) { covered = false; reason = values.length ? `bound not met: ${bound.metric} ${bound.op} ${bound.limit} (got ${values.map((claim) => claim.value).join(', ')})` : `needs a verified claim with metric "${bound.metric}" (${bound.op} ${bound.limit})`; }
      }
      return { id: scenario.id, kind: scenario.kind, text: scenario.text, ownerOnly: isOwnerOnly(scenario), covered, reason, observations: counting.map((item) => item.observation), ...(bounds.length ? { bounds } : {}) };
    });
    const missing = rows.filter((row) => !row.covered);
    coverage[dimensionId] = {
      status: missing.length === 0 && rows.length ? 'complete' : missing.length === rows.length ? 'none' : 'partial',
      covered: rows.length - missing.length,
      total: rows.length,
      missing: missing.map(({ id, kind, text, ownerOnly, reason }) => ({ id, kind, text, ownerOnly, reason })),
      ownerOnlyMissing: missing.filter((row) => row.ownerOnly).map((row) => row.id),
      scenarios: rows,
    };
  }

  // 9. Verdict ----------------------------------------------------------------------------------------
  const failedTests = tests.filter((test) => test.status !== 'passed').map((test) => test.name);
  const allTestsPassed = tests.length > 0 && failedTests.length === 0 && tests.every((test) => test.verified);
  const coverageComplete = dimensionIds.every((id) => coverage[id].status === 'complete');
  const gaps = [];
  if (!coverageComplete) gaps.push('coverage_incomplete');
  if (openDefects.length) gaps.push('open_defects');
  if (!tests.length) gaps.push('no_tests_recorded'); else if (!allTestsPassed) gaps.push('tests_not_all_passed');
  const ok = errors.length === 0;
  const verifiedArtifacts = Object.values(artifacts).filter((info) => info.verified);
  const artifactHashes = [...new Set(verifiedArtifacts.map((info) => info.sha256))].sort();
  const dimensionArtifactHashes = Object.fromEntries(dimensionIds.map((id) => [id, [...new Set((perDimension[id]?.observations ?? []).flatMap((observation) => [...observation.artifacts, ...observation.verifiedClaims.map((claim) => claim.artifact)]).map((artifactId) => artifacts[artifactId]).filter((info) => info?.verified).map((info) => info.sha256))].sort()]));
  return {
    tool: 'bipx-evidence-lint',
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    rubricSchemaVersion: rubric.schemaVersion ?? null,
    candidate: { id: candidate.id ?? null, manifestSha256: manifestSha ?? null },
    status: !ok ? 'failed' : gaps.length ? 'incomplete' : 'clean',
    ok,
    clean: ok && gaps.length === 0,
    gaps,
    errors,
    warnings,
    artifacts: Object.fromEntries(Object.values(artifacts).map(({ id, path: file, sha256: hash, exists, hashOk, bound, binding, ownerSession, verified, bytes }) => [id, { path: file, sha256: hash, exists, hashOk, bound, binding, ownerSession, verified, bytes: bytes ?? null }])),
    artifactHashes,
    artifactSetSha256: sha256(artifactHashes.join('\n')),
    dimensionArtifactHashes,
    claims: claimsReport,
    coverage,
    coverageComplete,
    tests: { total: tests.length, failed: failedTests, allPassed: allTestsPassed, entries: tests },
    defects: { open: openDefects, closed: closedDefects, disappeared },
    ownerOnlyGaps: dimensionIds.flatMap((id) => coverage[id].missing.filter((row) => row.ownerOnly).map((row) => ({ dimension: id, id: row.id, kind: row.kind, text: row.text }))),
    observations: Object.fromEntries(dimensionIds.map((id) => [id, (perDimension[id]?.observations ?? []).map(({ id: observationId, valid, source, scenarios, ownerAuthentic, verifiedClaims }) => ({ id: observationId, valid, source, scenarios, ownerAuthentic, verifiedClaims: verifiedClaims.map(({ claim, metric, scenario, value, artifact, artifactPath, pointer }) => ({ claim, metric, scenario, value, artifact, artifactPath, pointer })) }))])),
  };
}
