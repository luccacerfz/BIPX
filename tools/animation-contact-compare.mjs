import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Compare the archived controller against current runtime using identical audit,
// meshes, loaders and sidecars. Only an isolated copy receives the old source.
const currentReport = process.argv[2];
if (!currentReport) throw new Error('Pass a fresh sole-contact-audit JSON');
const root = process.cwd();
const current = JSON.parse(await fs.readFile(currentReport, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.resolve(`output/arpg-animation/contact-comparison-${stamp}`);
const isolated = path.join(out, 'baseline');
const controller = 'src/assets/hero-locomotion.js';
const archive = 'output/arpg-animation/baseline/hero-locomotion.js';
const baseline = await fs.readFile(archive);
if (hash(baseline) !== 'b958aca3ff8a0c1353c8af8007dbade40c69ab446ec258aea4bab92502bcabc6') throw new Error('Unexpected baseline');
for (const [file, sha] of Object.entries(current.after)) {
  const bytes = await fs.readFile(file);
  if (hash(bytes) !== sha) throw new Error(`Current audit is stale: ${file}`);
  const dest = path.join(isolated, file);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, file === controller ? baseline : bytes);
}
await fs.writeFile(path.join(isolated, 'package.json'), '{"type":"module"}\n');
const result = spawnSync(process.execPath, ['docs/arpg/review/sole-contact-audit.mjs'], { cwd: isolated, encoding: 'utf8' });
await fs.writeFile(path.join(out, 'baseline-audit.log'), result.stdout + result.stderr);
if (result.status !== 0) throw new Error(`Baseline audit failed: ${result.status}`);
const last = JSON.parse(result.stdout.trim().split('\n').at(-1));
const old = JSON.parse(await fs.readFile(last.output, 'utf8'));
const differences = Object.keys(current.after).filter(file => current.after[file] !== old.after[file]);
if (differences.length !== 1 || differences[0] !== controller) throw new Error('Comparison must change only the controller');
const liveDrift = [];
for (const [file, sha] of Object.entries(current.after)) if (hash(await fs.readFile(file)) !== sha) liveDrift.push(file);
const report = {
  scope: 'Independent CPU audit replay in isolated copy; same verifier/dependencies/meshes, only archived controller differs. No runtime mutation or visual acceptance.',
  currentReport, baselineReport: path.relative(root, last.output),
  currentController: current.after[controller], baselineController: old.after[controller],
  auditSha256: current.after['docs/arpg/review/sole-contact-audit.mjs'],
  changedComparisonFiles: differences, liveDrift,
  sourceStable: current.sourceStable && old.sourceStable && !liveDrift.length,
  acceptedNoSliding: false,
  results: current.results.map(now => {
    const before = old.results.find(value => value.id === now.id && value.direction === now.direction);
    return { id: now.id, direction: now.direction, speed: now.speed, before, after: now };
  }),
};
await fs.writeFile(path.join(out, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out: path.relative(root, path.join(out, 'comparison.json')), sourceStable: report.sourceStable, changedComparisonFiles: differences, cases: report.results.length }));
if (!report.sourceStable) process.exitCode = 2;
