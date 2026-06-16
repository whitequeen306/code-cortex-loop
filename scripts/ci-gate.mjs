#!/usr/bin/env node
/**
 * CodeCortexLoop CI gate — reads report.json and exits with status code.
 *
 * Exit codes:
 *   0 — pass (no Critical, High within threshold)
 *   1 — Critical findings > 0
 *   2 — High findings > maxHigh threshold
 *   3 — invalid/missing report
 *
 * Usage:
 *   node scripts/ci-gate.mjs docs/cortexloop/report.json
 *   node scripts/ci-gate.mjs docs/cortexloop/report.json --max-high=2
 *   node scripts/ci-gate.mjs docs/cortexloop/report.json --baseline
 */

import { existsSync } from 'node:fs';
import {
  DEFAULT_BASELINE_DIFF,
  DEFAULT_REPORT,
  countFindings,
  parseArgs,
  readJson,
} from './lib/shared.mjs';

const { positional, flags, getFlagValue } = parseArgs();
const reportPath = positional[0] || DEFAULT_REPORT;
const maxHigh = Number(getFlagValue('--max-high', '0'));
const useBaseline = flags.has('--baseline');
const baselineDiffPath = getFlagValue('--baseline-diff', DEFAULT_BASELINE_DIFF);

let report;
try {
  report = readJson(reportPath);
} catch (err) {
  console.error(`[cortexloop] Failed to read report: ${reportPath}`);
  console.error(err.message);
  process.exit(3);
}

let findings = report.findings || [];

if (useBaseline) {
  if (!existsSync(baselineDiffPath)) {
    console.error(`[cortexloop] Baseline diff not found: ${baselineDiffPath}`);
    console.error('Run: node scripts/baseline.mjs diff');
    process.exit(3);
  }
  const diff = readJson(baselineDiffPath);
  findings = diff.new || [];
  console.log('[cortexloop] Baseline mode — gating on NEW findings only');
  console.log(`  new: ${findings.length} (remaining baseline debt ignored)`);
}

const counts = countFindings(findings);

console.log('[cortexloop] CI gate results');
console.log(`  Report: ${reportPath}`);
console.log(`  Preset: ${report.preset || 'unknown'}`);
console.log(`  Scores: overall ${report.scores?.before?.overall ?? 'n/a'}`);
console.log(`  Critical: ${counts.Critical}`);
console.log(`  High:     ${counts.High}`);
console.log(`  Medium:   ${counts.Medium}`);

if (counts.Critical > 0) {
  console.error('[cortexloop] FAIL — Critical findings present');
  process.exit(1);
}

if (counts.High > maxHigh) {
  console.error(`[cortexloop] FAIL — High findings (${counts.High}) exceed max (${maxHigh})`);
  process.exit(2);
}

console.log('[cortexloop] PASS');
process.exit(0);
