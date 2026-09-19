// Append-only, hash-chained ledger of JEF gate runs (default: output/jef-ledger.jsonl).
// One JSON object per line; `prev` is the SHA-256 of the previous line, so an edited or removed line is
// detected and the gate refuses to run. Entries are keyed by candidate manifest hash + rubric hash.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_LEDGER = 'output/jef-ledger.jsonl';
const hashLine = (line) => crypto.createHash('sha256').update(line).digest('hex');

export function readLedger(file) {
  if (!fs.existsSync(file)) return { entries: [], ok: true, problems: [], lastSha256: null };
  const entries = [];
  const problems = [];
  let previous = null;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    let entry = null;
    try { entry = JSON.parse(line); } catch { problems.push(`line ${index + 1} is not JSON`); }
    if (entry && (entry.prev ?? null) !== previous) problems.push(`line ${index + 1} breaks the hash chain (an earlier line was edited or removed)`);
    previous = hashLine(line);
    if (entry) entries.push({ ...entry, entrySha256: previous });
  });
  return { entries, ok: problems.length === 0, problems, lastSha256: previous };
}

export function appendLedgerEntry(file, entry) {
  const ledger = readLedger(file);
  if (!ledger.ok) throw new Error(`Ledger ${file} is corrupt: ${ledger.problems.join('; ')}`);
  const line = JSON.stringify({ ...entry, prev: ledger.lastSha256 });
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.appendFileSync(file, `${line}\n`, { flag: 'a' });
  return { ...entry, prev: ledger.lastSha256, entrySha256: hashLine(line) };
}

const evaluations = (entries) => entries.filter((entry) => entry.type === 'evaluation');

// Baseline for the defect diff: the latest real evaluation, whatever its candidate or rubric.
export const lastEvaluation = (entries) => evaluations(entries).at(-1) ?? null;

// Baseline for score deltas: only entries with the SAME rubric hash are comparable.
export const lastEvaluationWithRubric = (entries, rubricSha256) => evaluations(entries).filter((entry) => entry.rubricSha256 === rubricSha256).at(-1) ?? null;

// Latest completed query of one dimension for this exact candidate + rubric.
export function lastDimensionQuery(entries, { candidateManifestSha256, rubricSha256, dimensionId }) {
  for (const entry of evaluations(entries).reverse()) {
    if (entry.candidateManifestSha256 !== candidateManifestSha256 || entry.rubricSha256 !== rubricSha256) continue;
    const record = entry.dimensions?.[dimensionId];
    if (record?.queried && record.requestOk) return { entry, record };
  }
  return null;
}
