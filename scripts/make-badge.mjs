#!/usr/bin/env node
/**
 * Generate CodeCortexLoop health badge SVG + shields endpoint JSON
 *
 * Usage:
 *   node scripts/make-badge.mjs [report.json] [--out=.cortexloop/health-badge.svg]
 */

import { existsSync } from 'node:fs';
import {
  DEFAULT_BADGE_JSON,
  DEFAULT_BADGE_SVG,
  DEFAULT_REPORT,
  ensureDirFor,
  getOverallScore,
  parseArgs,
  readJson,
  scoreColor,
  writeJson,
} from './lib/shared.mjs';
import { writeFileSync } from 'node:fs';

const { positional, getFlagValue } = parseArgs();
const reportPath = positional[0] || DEFAULT_REPORT;
const svgOut = getFlagValue('--out', DEFAULT_BADGE_SVG);
const jsonOut = getFlagValue('--json', DEFAULT_BADGE_JSON);

if (!existsSync(reportPath)) {
  console.error(`[cortexloop] Report not found: ${reportPath}`);
  process.exit(1);
}

const report = readJson(reportPath);
const score = getOverallScore(report);
if (score == null) {
  console.warn('[cortexloop] No overall score in report — skipping badge generation');
  process.exit(0);
}

const color = scoreColor(score);
const label = 'cortexloop health';
const value = String(Math.round(score));

const labelWidth = label.length * 7 + 10;
const valueWidth = value.length * 7 + 10;
const totalWidth = labelWidth + valueWidth;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>
`;

ensureDirFor(svgOut);
writeFileSync(svgOut, svg, 'utf8');

const badgeJson = {
  schemaVersion: 1,
  label: 'cortexloop health',
  message: value,
  color: color.replace('#', ''),
  score: Math.round(score),
  timestamp: report.timestamp || new Date().toISOString(),
};

writeJson(jsonOut, badgeJson);
console.log(`[cortexloop] Badge -> ${svgOut} (${value})`);
console.log(`[cortexloop] Badge JSON -> ${jsonOut}`);
