// Harnesses that were written against a staging tree under output/ (untracked: absent on a clean clone, a worktree or CI).
// Instead of dying with ENOENT/ERR_MODULE_NOT_FOUND they report an explicit status and exit with NEEDS_STAGING_EXIT, which
// tools/run-quality-suite.mjs records as `skipped` / `needs-staging-artefact` (neither a pass nor a failure).
import fs from 'node:fs';
import path from 'node:path';

export const NEEDS_STAGING_EXIT = 78; // sysexits EX_CONFIG; 75 already means "GPU busy" in the older wrappers
export const NEEDS_STAGING_STATUS = 'needs-staging-artefact';

export function missingStagingArtefacts(paths) { return paths.filter(file => !fs.existsSync(file)); }

/** Exits with the explicit status when any of `paths` is missing; returns normally when the staging tree is present. */
export function requireStagingArtefacts(paths, { suite = path.basename(process.argv[1] || 'harness', '.mjs'), note = '' } = {}) {
  const missing = missingStagingArtefacts(paths);
  if (!missing.length) return;
  const status = { status: NEEDS_STAGING_STATUS, suite, missing, passed: null,
    note: note || 'These inputs live under the untracked output/ tree. Restore the staging artefact (or run from the checkout that has it) to execute this harness.' };
  if (process.env.BIPX_EVIDENCE_DIR) {
    fs.mkdirSync(process.env.BIPX_EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.BIPX_EVIDENCE_DIR, `${suite}.status.json`), `${JSON.stringify(status, null, 2)}\n`);
  }
  console.log(JSON.stringify(status));
  process.exit(NEEDS_STAGING_EXIT);
}
