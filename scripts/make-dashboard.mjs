#!/usr/bin/env node
/**
 * Generate self-contained Supercode HTML dashboard
 *
 * Usage:
 *   node scripts/make-dashboard.mjs [report.json] [--history=.supercode/history.json] [--out=docs/supercode/report.html]
 */

import { existsSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DEFAULT_DASHBOARD,
  DEFAULT_HISTORY,
  DEFAULT_REPORT,
  SEVERITY_COLORS,
  countFindings,
  ensureDirFor,
  escapeHtml,
  getCategoryScores,
  getOverallScore,
  parseArgs,
  readJson,
  scoreColor,
} from './lib/shared.mjs';

const { positional, getFlagValue } = parseArgs();
const reportPath = positional[0] || DEFAULT_REPORT;
const historyPath = getFlagValue('--history', DEFAULT_HISTORY);
const outPath = getFlagValue('--out', DEFAULT_DASHBOARD);

if (!existsSync(reportPath)) {
  console.error(`[supercode] Report not found: ${reportPath}`);
  process.exit(1);
}

const report = readJson(reportPath);
const history = existsSync(historyPath) ? readJson(historyPath) : { runs: [] };
const runs = Array.isArray(history.runs) ? history.runs : [];

const overall = getOverallScore(report);
const categories = getCategoryScores(report);
const counts = countFindings(report.findings || []);
const before = report.scores?.before?.overall;
const after = report.scores?.after?.overall;

function ringSvg(score, size = 140) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const dash = (pct / 100) * c;
  const color = scoreColor(score);
  const cx = size / 2;
  const cy = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="12"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="12"
      stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="32" font-weight="700" fill="#111827">${Math.round(score ?? 0)}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="#6b7280">overall</text>
  </svg>`;
}

function sparklineSvg(runs, key = 'overall', w = 280, h = 60) {
  const values = runs.map((r) => r[key]).filter((v) => v != null);
  if (values.length < 2) {
    return `<svg width="${w}" height="${h}"><text x="10" y="30" fill="#9ca3af" font-size="12">Need 2+ runs for trend</text></svg>`;
  }
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 20) + 10;
    const y = h - 10 - ((v - min) / range) * (h - 20);
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline fill="none" stroke="#2563eb" stroke-width="2.5" points="${pts.join(' ')}"/>
    <circle cx="${pts[pts.length - 1].split(',')[0]}" cy="${pts[pts.length - 1].split(',')[1]}" r="4" fill="#2563eb"/>
    <text x="${w - 8}" y="16" text-anchor="end" font-size="12" fill="#2563eb" font-weight="600">${Math.round(last)}</text>
  </svg>`;
}

function categoryBars(categories) {
  return CATEGORIES.map((cat) => {
    const score = categories[cat];
    const pct = Math.max(0, Math.min(100, score ?? 0));
    const color = scoreColor(score);
    const label = CATEGORY_LABELS[cat] || cat;
    return `<div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bar-value">${score != null ? Math.round(score) : '—'}</div>
    </div>`;
  }).join('\n');
}

function findingsTable(findings) {
  const open = (findings || []).filter((f) => f.status !== 'fixed' && f.status !== 'suppressed');
  if (!open.length) return '<p class="muted">No open findings. Nice work.</p>';
  const rows = open.slice(0, 50).map((f) => {
    const sevColor = SEVERITY_COLORS[f.severity] || '#6b7280';
    return `<tr>
      <td><span class="sev" style="background:${sevColor}">${escapeHtml(f.severity)}</span></td>
      <td><code>${escapeHtml(f.id)}</code></td>
      <td>${escapeHtml(f.category)}</td>
      <td><code>${escapeHtml(f.location)}</code></td>
      <td>${escapeHtml(f.problem)}</td>
      <td>${escapeHtml(f.recommendation)}</td>
    </tr>`;
  }).join('\n');
  const more = open.length > 50 ? `<p class="muted">… and ${open.length - 50} more in report.json</p>` : '';
  return `<table><thead><tr><th>Severity</th><th>ID</th><th>Category</th><th>Location</th><th>Problem</th><th>Recommendation</th></tr></thead><tbody>${rows}</tbody></table>${more}`;
}

const delta = before != null && after != null ? after - before : null;
const deltaText = delta != null ? (delta >= 0 ? `+${delta}` : `${delta}`) : '—';
const deltaClass = delta != null ? (delta >= 0 ? 'up' : 'down') : '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Supercode Report — ${escapeHtml(String(Math.round(overall ?? 0)))}</title>
<style>
  :root { --bg:#f8fafc; --card:#fff; --text:#111827; --muted:#6b7280; --border:#e5e7eb; --accent:#2563eb; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Inter,Segoe UI,system-ui,sans-serif; background:var(--bg); color:var(--text); }
  .wrap { max-width:1100px; margin:0 auto; padding:32px 20px 48px; }
  header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:24px; }
  h1 { margin:0; font-size:28px; }
  .meta { color:var(--muted); font-size:14px; margin-top:6px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; margin-bottom:16px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:20px; box-shadow:0 8px 24px rgba(17,24,39,.04); }
  .card h2 { margin:0 0 12px; font-size:16px; }
  .score-row { display:flex; align-items:center; gap:20px; }
  .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:12px; }
  .stat { background:#f9fafb; border-radius:10px; padding:10px; text-align:center; }
  .stat .n { font-size:22px; font-weight:700; }
  .stat .l { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .delta { font-size:18px; font-weight:700; margin-top:8px; }
  .delta.up { color:#059669; } .delta.down { color:#dc2626; }
  .bar-row { display:grid; grid-template-columns:120px 1fr 36px; gap:8px; align-items:center; margin:8px 0; font-size:13px; }
  .bar-track { height:8px; background:#f3f4f6; border-radius:999px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:999px; }
  .bar-value { text-align:right; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th,td { border-bottom:1px solid var(--border); padding:10px 8px; text-align:left; vertical-align:top; }
  th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
  code { font-family:ui-monospace,Consolas,monospace; font-size:12px; }
  .sev { display:inline-block; color:#fff; font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; }
  .muted { color:var(--muted); font-size:13px; }
  footer { margin-top:24px; color:var(--muted); font-size:12px; text-align:center; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>Supercode Report</h1>
      <div class="meta">preset: ${escapeHtml(report.preset || 'unknown')} · scope: ${escapeHtml(report.scope || 'recent')} · mode: ${escapeHtml(report.mode || 'report')} · ${escapeHtml(report.timestamp || '')}</div>
    </div>
    <div style="text-align:right">
      <div class="meta">Generated by Supercode v2.1</div>
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <h2>Health Score</h2>
      <div class="score-row">
        ${ringSvg(overall)}
        <div>
          ${before != null ? `<div class="meta">Before: <strong>${Math.round(before)}</strong></div>` : ''}
          ${after != null ? `<div class="meta">After: <strong>${Math.round(after)}</strong></div>` : ''}
          <div class="delta ${deltaClass}">${deltaText !== '—' ? `Change: ${deltaText}` : ''}</div>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n" style="color:#dc2626">${counts.Critical}</div><div class="l">Critical</div></div>
        <div class="stat"><div class="n" style="color:#ea580c">${counts.High}</div><div class="l">High</div></div>
        <div class="stat"><div class="n" style="color:#ca8a04">${counts.Medium}</div><div class="l">Medium</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Score Trend</h2>
      ${sparklineSvg(runs)}
      <p class="muted">${runs.length} run(s) in history</p>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <h2>Category Scores</h2>
    ${categoryBars(categories)}
  </div>

  <div class="card">
    <h2>Open Findings (${counts.total})</h2>
    ${findingsTable(report.findings)}
  </div>

  <footer>Supercode — one-command post-coding pipeline · MIT</footer>
</div>
</body>
</html>`;

ensureDirFor(outPath);
writeFileSync(outPath, html, 'utf8');
console.log(`[supercode] Dashboard -> ${outPath}`);
