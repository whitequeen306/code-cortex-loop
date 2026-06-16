#!/usr/bin/env node
/**
 * CodeCortexLoop baseline management — accept technical debt or diff against it
 *
 * Usage:
 *   node scripts/baseline.mjs accept [report.json] [--out=.cortexloop/baseline.json]
 *   node scripts/baseline.mjs diff [report.json] [--baseline=.cortexloop/baseline.json] [--out=.cortexloop/baseline-diff.json]
 */

import { existsSync } from 'node:fs';
import {
  DEFAULT_BASELINE,
  DEFAULT_BASELINE_DIFF,
  DEFAULT_REPORT,
  findingFingerprint,
  parseArgs,
  readJson,
  writeJson,
} from './lib/shared.mjs';

const { positional, getFlagValue } = parseArgs();
const command = positional[0];
const reportPath = positional[1] || DEFAULT_REPORT;
const baselinePath = getFlagValue('--baseline', DEFAULT_BASELINE);
const diffOut = getFlagValue('--out', DEFAULT_BASELINE_DIFF);

if (!command || !['accept', 'diff'].includes(command)) {
  console.error('Usage: node scripts/baseline.mjs <accept|diff> [report.json]');
  process.exit(1);
}

if (!existsSync(reportPath)) {
  console.error(`[cortexloop] Report not found: ${reportPath}`);
  process.exit(1);
}

const report = readJson(reportPath);
const openFindings = (report.findings || []).filter(
  (f) => f.status !== 'fixed' && f.status !== 'suppressed',
);

function buildBaseline(findings) {
  const items = findings.map((f) => ({
    fingerprint: findingFingerprint(f),
    id: f.id,
    severity: f.severity,
    category: f.category,
    location: f.location,
    problem: f.problem,
  }));
  return {
    version: '2.2',
    acceptedAt: new Date().toISOString(),
    sourceReport: reportPath,
    preset: report.preset,
    scope: report.scope,
    count: items.length,
    items,
  };
}

if (command === 'accept') {
  const baseline = buildBaseline(openFindings);
  writeJson(baselinePath, baseline);
  console.log(`[cortexloop] Baseline accepted: ${baseline.count} findings -> ${baselinePath}`);
  process.exit(0);
}

// diff
if (!existsSync(baselinePath)) {
  console.error(`[cortexloop] Baseline not found: ${baselinePath}`);
  console.error('Run: node scripts/baseline.mjs accept');
  process.exit(1);
}

const baseline = readJson(baselinePath);
const baselineMap = new Map((baseline.items || []).map((i) => [i.fingerprint, i]));

const currentByFp = new Map();
for (const f of openFindings) {
  currentByFp.set(findingFingerprint(f), f);
}

const remaining = [];
const fixed = [];
const newFindings = [];

for (const [fp, item] of baselineMap) {
  if (currentByFp.has(fp)) {
    remaining.push({ ...item, current: currentByFp.get(fp) });
  } else {
    fixed.push(item);
  }
}

for (const [fp, finding] of currentByFp) {
  if (!baselineMap.has(fp)) {
    newFindings.push(finding);
  }
}

const diff = {
  version: '2.2',
  generatedAt: new Date().toISOString(),
  reportPath,
  baselinePath,
  summary: {
    baselineCount: baselineMap.size,
    currentOpen: openFindings.length,
    remaining: remaining.length,
    fixed: fixed.length,
    new: newFindings.length,
    newCritical: newFindings.filter((f) => f.severity === 'Critical').length,
    newHigh: newFindings.filter((f) => f.severity === 'High').length,
  },
  remaining,
  fixed,
  new: newFindings,
};

writeJson(diffOut, diff);
console.log('[cortexloop] Baseline diff');
console.log(`  remaining: ${diff.summary.remaining}`);
console.log(`  fixed:     ${diff.summary.fixed}`);
console.log(`  new:       ${diff.summary.new} (Critical: ${diff.summary.newCritical}, High: ${diff.summary.newHigh})`);
console.log(`  -> ${diffOut}`);
