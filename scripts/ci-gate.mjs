#!/usr/bin/env node
/**
 * Supercode CI gate — reads report.json and exits with status code.
 *
 * Exit codes:
 *   0 — pass (no Critical, High within threshold)
 *   1 — Critical findings > 0
 *   2 — High findings > maxHigh threshold
 *   3 — invalid/missing report
 *
 * Usage:
 *   node scripts/ci-gate.mjs docs/supercode/report.json
 *   node scripts/ci-gate.mjs docs/supercode/report.json --max-high=2
 *   node scripts/ci-gate.mjs docs/supercode/report.json --baseline
 */

import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_BASELINE_DIFF } from './lib/shared.mjs';

const args = process.argv.slice(2);
const reportPath = args.find((a) => !a.startsWith('--')) || 'docs/supercode/report.json';
const maxHighArg = args.find((a) => a.startsWith('--max-high='));
const maxHigh = maxHighArg ? Number(maxHighArg.split('=')[1]) : 0;
const useBaseline = args.includes('--baseline');
const baselineDiffPath = args.find((a) => a.startsWith('--baseline-diff='))?.split('=')[1] || DEFAULT_BASELINE_DIFF;

function countBySeverity(findings) {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
  for (const f of findings) {
    if (f.status === 'suppressed' || f.status === 'fixed') continue;
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  }
  return counts;
}

let report;
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`[supercode] Failed to read report: ${reportPath}`);
  console.error(err.message);
  process.exit(3);
}

let findings = report.findings || [];

if (useBaseline) {
  if (!existsSync(baselineDiffPath)) {
    console.error(`[supercode] Baseline diff not found: ${baselineDiffPath}`);
    console.error('Run: node scripts/baseline.mjs diff');
    process.exit(3);
  }
  const diff = JSON.parse(readFileSync(baselineDiffPath, 'utf8'));
  findings = diff.new || [];
  console.log('[supercode] Baseline mode — gating on NEW findings only');
  console.log(`  new: ${findings.length} (remaining baseline debt ignored)`);
}

const counts = countBySeverity(findings);

console.log('[supercode] CI gate results');
console.log(`  Report: ${reportPath}`);
console.log(`  Preset: ${report.preset || 'unknown'}`);
console.log(`  Scores: overall ${report.scores?.before?.overall ?? 'n/a'}`);
console.log(`  Critical: ${counts.Critical}`);
console.log(`  High:     ${counts.High}`);
console.log(`  Medium:   ${counts.Medium}`);

if (counts.Critical > 0) {
  console.error('[supercode] FAIL — Critical findings present');
  process.exit(1);
}

if (counts.High > maxHigh) {
  console.error(`[supercode] FAIL — High findings (${counts.High}) exceed max (${maxHigh})`);
  process.exit(2);
}

console.log('[supercode] PASS');
process.exit(0);
