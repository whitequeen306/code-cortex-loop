#!/usr/bin/env node
/**
 * CodeCortexLoop deterministic health-score writer.
 *
 * Computes before/after scores from report.json findings via the shared
 * computeScores (weighted average: security & correctness 1.5x, others 1x)
 * and writes them back onto report.scores — replacing LLM-judged scores so
 * the headline number is reproducible and auditable.
 *
 * Spec: rules/cortexloop-workflow.mdc → "Health Score (0–100 per category)".
 * Same function the showcase dashboard uses, so before/after agree everywhere.
 *
 * Run twice in the pipeline:
 *   Step 4 (after aggregation, before any fix): node scripts/compute-scores.mjs report.json
 *   Step 5 (after Direct re-verify):            node scripts/compute-scores.mjs report.json --as=after
 * Both compute from the findings array AS IT STANDS at that moment (status
 * reflects fixed/open at that point), so the only difference between the two
 * runs is which findings carry status:'fixed'.
 *
 * Usage:
 *   node scripts/compute-scores.mjs [report.json] [--as=before|after] [--quiet]
 *
 * Exit codes: 0 ok · 2 bad args / missing findings.
 */
import {
  CATEGORIES,
  DEFAULT_REPORT,
  computeScores,
  parseArgs,
  readJson,
  writeJson,
} from './lib/shared.mjs';

const { positional, flags, getFlagValue } = parseArgs();
const reportPath = positional[0] || DEFAULT_REPORT;
const as = getFlagValue('--as', 'before');
const quiet = flags.has('--quiet');

if (as !== 'before' && as !== 'after') {
  console.error(`[cortexloop] --as must be 'before' or 'after', got: ${as}`);
  process.exit(2);
}

let report;
try {
  report = readJson(reportPath);
} catch (err) {
  console.error(`[cortexloop] Failed to read report: ${reportPath}`);
  console.error(err.message);
  process.exit(2);
}
if (!Array.isArray(report.findings)) {
  console.error(`[cortexloop] ${reportPath} has no findings array — run aggregate-findings first`);
  process.exit(2);
}

const { overall, categories } = computeScores(report.findings);

// Guard against a legacy scalar scores field (e.g. `scores: 72`).
if (typeof report.scores !== 'object' || report.scores === null) report.scores = {};
const prevOverall = report.scores[as]?.overall;

// Prune stale flat per-category root fields (legacy shape) so the only
// category values on the root are the canonical nested block written below.
for (const c of CATEGORIES) {
  if (Object.hasOwn(report.scores, c)) delete report.scores[c];
}

report.scores[as] = {
  overall,
  categories,
  computedBy: 'cortexloop-compute-scores',
};
// Top-level scores.overall: prefer after when it exists, else this run's value.
report.scores.overall =
  as === 'after' ? overall : (report.scores.after?.overall ?? overall);

writeJson(reportPath, report);

if (!quiet) {
  const prev = prevOverall != null ? ` (was ${prevOverall})` : '';
  console.log(`[cortexloop] scores.${as} -> ${reportPath}`);
  console.log(`  overall: ${overall}${prev}`);
  console.log(`  computedBy: cortexloop-compute-scores (deterministic, weighted 1.5x sec/correctness)`);
}
