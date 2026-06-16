#!/usr/bin/env node
/**
 * Append a Supercode run to .supercode/history.json
 *
 * Usage:
 *   node scripts/record-history.mjs [report.json] [--history=.supercode/history.json]
 */

import { existsSync } from 'node:fs';
import {
  DEFAULT_HISTORY,
  DEFAULT_REPORT,
  countFindings,
  getCategoryScores,
  getOverallScore,
  parseArgs,
  readJson,
  tryGitBranch,
  tryGitCommit,
  writeJson,
} from './lib/shared.mjs';

const { positional, getFlagValue } = parseArgs();
const reportPath = positional[0] || DEFAULT_REPORT;
const historyPath = getFlagValue('--history', DEFAULT_HISTORY);

if (!existsSync(reportPath)) {
  console.error(`[supercode] Report not found: ${reportPath}`);
  process.exit(1);
}

const report = readJson(reportPath);
const findings = report.findings || [];
const counts = countFindings(findings);

const entry = {
  timestamp: report.timestamp || new Date().toISOString(),
  preset: report.preset || 'unknown',
  scope: report.scope || 'recent',
  mode: report.mode || 'report',
  commit: tryGitCommit(),
  branch: tryGitBranch(),
  overall: getOverallScore(report),
  categories: getCategoryScores(report),
  findings: {
    Critical: counts.Critical,
    High: counts.High,
    Medium: counts.Medium,
    Low: counts.Low,
    Info: counts.Info,
    total: counts.total,
  },
};

let history = { version: '2.1', runs: [] };
if (existsSync(historyPath)) {
  history = readJson(historyPath);
  if (!Array.isArray(history.runs)) history.runs = [];
}

history.runs.push(entry);
if (history.runs.length > 100) {
  history.runs = history.runs.slice(-100);
}

writeJson(historyPath, history);
console.log(`[supercode] History recorded (${history.runs.length} runs) -> ${historyPath}`);
console.log(`  overall: ${entry.overall ?? 'n/a'} | findings: ${entry.findings.total}`);
