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
  resolveWithinWorkspace,
  validateReport,
} from './lib/shared.mjs';

const { positional, flags, getFlagValue } = parseArgs();
const reportArg = positional[0] || DEFAULT_REPORT;
const maxHighRaw = getFlagValue('--max-high', '0');
const maxHigh = Number(maxHighRaw);
const useBaseline = flags.has('--baseline');
const skipValidation = flags.has('--skip-report-validation');
const baselineDiffPath = getFlagValue('--baseline-diff', DEFAULT_BASELINE_DIFF);
const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();

if (!Number.isInteger(maxHigh) || maxHigh < 0) {
  console.error(`[cortexloop] Invalid --max-high: ${maxHighRaw}`);
  process.exit(3);
}

let reportPath = reportArg;
let report;
try {
  reportPath = resolveWithinWorkspace(reportArg, workspaceRoot);
  report = readJson(reportPath);
} catch (err) {
  console.error(`[cortexloop] Failed to read report: ${reportArg}`);
  console.error(err.message);
  process.exit(3);
}

if (!skipValidation) {
  const validationError = validateReport(report);
  if (validationError) {
    console.error(`[cortexloop] Invalid report: ${validationError}`);
    process.exit(3);
  }
}

let findings = report.findings || [];

if (useBaseline) {
  let diffPath;
  try {
    diffPath = resolveWithinWorkspace(baselineDiffPath, workspaceRoot);
  } catch (err) {
    console.error(`[cortexloop] Invalid baseline diff path: ${baselineDiffPath}`);
    console.error(err.message);
    process.exit(3);
  }
  if (!existsSync(diffPath)) {
    console.error(`[cortexloop] Baseline diff not found: ${baselineDiffPath}`);
    console.error('Run: node scripts/baseline.mjs diff');
    process.exit(3);
  }
  let diff;
  try {
    diff = readJson(diffPath);
  } catch (err) {
    console.error(`[cortexloop] Failed to read baseline diff: ${baselineDiffPath}`);
    console.error(err.message);
    process.exit(3);
  }
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

if (counts.unknown > 0) {
  console.error(`[cortexloop] FAIL — ${counts.unknown} finding(s) with invalid severity`);
  process.exit(3);
}

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
