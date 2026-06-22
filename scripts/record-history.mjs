#!/usr/bin/env node
/**
 * Append a CodeCortexLoop run to .cortexloop/history.json
 *
 * Usage:
 *   node scripts/record-history.mjs [report.json] [--history=.cortexloop/history.json]
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
  console.error(`[cortexloop] Report not found: ${reportPath}`);
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

let history = { version: '2.2', runs: [] };
if (existsSync(historyPath)) {
  try {
    history = readJson(historyPath);
  } catch (err) {
    console.error(`[cortexloop] Failed to read history: ${historyPath}`);
    console.error(err.message);
    process.exit(1);
  }
  if (!Array.isArray(history.runs)) {
    console.warn(`[cortexloop] Warning: history.runs invalid in ${historyPath}, resetting runs array`);
    history.runs = [];
  }
}

history.runs.push(entry);
if (history.runs.length > 100) {
  history.runs = history.runs.slice(-100);
}

writeJson(historyPath, history);
console.log(`[cortexloop] History recorded (${history.runs.length} runs) -> ${historyPath}`);
console.log(`  overall: ${entry.overall ?? 'n/a'} | findings: ${entry.findings.total}`);
