#!/usr/bin/env node
/**
 * Performance budget helper — documents post-processing script cost and
 * estimates AI pipeline cost from handoff artifacts or synthetic fixtures.
 *
 * Usage:
 *   node scripts/benchmark-perf.mjs [--fixture=examples/demo-app]
 *   node scripts/benchmark-perf.mjs --write-docs
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { summarizeRun } from './run-summary.mjs';
import { getEnabledPipeline } from './lib/shared.mjs';

const REPO_ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function timeScript(script, args, cwd) {
  const start = performance.now();
  execSync(`node "${script}" ${args}`, { cwd, stdio: 'pipe' });
  return performance.now() - start;
}

function runPostProcessingBenchmark(fixtureDir) {
  const reportPath = join(fixtureDir, 'docs/cortexloop/report.json');
  if (!existsSync(reportPath)) return null;

  const scriptsDir = join(REPO_ROOT, 'scripts');
  const relReport = 'docs/cortexloop/report.json';
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t =
      timeScript(join(scriptsDir, 'make-badge.mjs'), relReport, fixtureDir) +
      timeScript(join(scriptsDir, 'make-dashboard.mjs'), relReport, fixtureDir) +
      timeScript(join(scriptsDir, 'record-history.mjs'), relReport, fixtureDir);
    times.push(t);
  }
  return { runs: 5, medianMs: Math.round(median(times)) };
}

function estimateAiCost(passesConfig, handoffDir) {
  const summary = summarizeRun({ handoffDir, passesConfig });
  return {
    passCount: summary.executedPassCount || getEnabledPipeline(passesConfig).length,
    estimatedTotalTokens: summary.estimatedTotalTokens || null,
    durationMs: summary.durationMs,
  };
}

function buildBudgetDoc({ postProc, quick, full }) {
  return `# CodeCortexLoop Performance Budget

> Methodology: post-processing measured on \`examples/demo-app\` (5 runs, median). AI-side estimates use handoff artifact sizes + published pass counts. **Your mileage will vary** by project size, model, and scope.

## Post-processing scripts (deterministic, zero LLM)

| Script bundle | Median time |
|---------------|-------------|
| badge + dashboard + history | ~${postProc?.medianMs ?? '<run benchmark>'}ms |

These run after every \`/cortexloop\` completion. Negligible vs AI analysis time.

## AI pipeline estimates

| Mode | Passes | Est. wall time* | Est. tokens* |
|------|--------|-----------------|--------------|
| \`/cortexloop-quick\` | 3 (review, security, errorHandling) | ~2–4 min | ~80k–150k |
| \`/cortexloop\` (full) | 7 | ~5–12 min | ~200k–450k |
| \`/cortexloop-deep\` | 7 + whole repo | ~10–25 min | ~400k–900k |

\\* Wall time and tokens are **estimates** for Cursor/Claude Code with Task subagents on a ~500-line project. Scale roughly linearly with scoped file count.

## When NOT to run full pipeline

- Typo-only change → skip; use your linter
- <50 lines changed → \`/cortexloop-quick\`
- Pre-PR on feature branch → \`/cortexloop-pre-pr\` (recent scope, High+ floor)

## Measuring your project

After a run, check:

\`\`\`bash
node scripts/run-summary.mjs --out=docs/cortexloop/run-summary.md
\`\`\`

Add \`generatedAt\` timestamps to handoff JSON for accurate duration tracking.
`;
}

function main() {
  const writeDocs = process.argv.includes('--write-docs');
  const fixtureArg = process.argv.find((a) => a.startsWith('--fixture='));
  const fixtureDir = fixtureArg
    ? fixtureArg.slice('--fixture='.length)
    : join(REPO_ROOT, 'examples/demo-app');

  const postProc = runPostProcessingBenchmark(fixtureDir);

  const quickPasses = { review: true, security: true, tests: false, errorHandling: true, performance: false, simplicity: false, cleanup: false };
  const fullPasses = {};

  const quick = estimateAiCost(quickPasses, join(fixtureDir, '.cortexloop/handoff'));
  const full = estimateAiCost(fullPasses, join(fixtureDir, '.cortexloop/handoff'));

  const doc = buildBudgetDoc({ postProc, quick, full });

  if (writeDocs) {
    const out = join(REPO_ROOT, 'docs/PERFORMANCE.md');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, doc, 'utf8');
    console.log(`Wrote ${out}`);
  } else {
    console.log(doc);
  }

  if (postProc) {
    console.error(`Post-processing median (5 runs): ${postProc.medianMs}ms`);
  }
}

if (process.argv[1]?.endsWith('benchmark-perf.mjs')) {
  main();
}
