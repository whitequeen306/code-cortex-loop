#!/usr/bin/env node
/**
 * Marketing-friendly showcase dashboard from report.json (for README / examples).
 * Usage:
 *   node scripts/make-showcase-dashboard.mjs [report.json] --out=path/showcase.html \
 *     --title="LianYu-PC" --subtitle="Vue + Spring Boot · deep scan"
 */
import { writeFileSync } from 'node:fs';
import {
  CATEGORIES,
  CATEGORY_LABELS,
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
const reportPath = positional[0] || 'docs/cortexloop/report.json';
const outPath = getFlagValue('--out', 'docs/cortexloop/showcase.html');
const title = getFlagValue('--title', 'Project');
const subtitle = getFlagValue('--subtitle', '');

const report = readJson(reportPath);
const overall = getOverallScore(report);
const categories = getCategoryScores(report);
const counts = countFindings(report.findings || []);

const topFindings = (report.findings || [])
  .filter((f) => f.status !== 'fixed' && f.status !== 'suppressed')
  .sort((a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  })
  .slice(0, 6);

function ringSvg(score, size = 200) {
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const dash = (pct / 100) * c;
  const color = scoreColor(score);
  const cx = size / 2;
  const cy = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="14"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#ringGrad)" stroke-width="14"
      stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="48" font-weight="800" fill="#f8fafc">${Math.round(score ?? 0)}</text>
    <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="13" fill="rgba(248,250,252,0.65)">健康分</text>
  </svg>`;
}

function severityBar(label, n, total, color) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return `<div class="sev-row">
    <div class="sev-label"><span class="dot" style="background:${color}"></span>${escapeHtml(label)}</div>
    <div class="sev-track"><div class="sev-fill" style="width:${pct}%;background:${color}"></div></div>
    <div class="sev-num">${n}</div>
  </div>`;
}

function categoryCards(categories) {
  return CATEGORIES.map((cat) => {
    const score = categories[cat];
    const pct = Math.max(0, Math.min(100, score ?? 0));
    const color = scoreColor(score);
    const label = CATEGORY_LABELS[cat] || cat;
    return `<div class="cat-card">
      <div class="cat-top"><span class="cat-name">${escapeHtml(label)}</span><span class="cat-score" style="color:${color}">${score != null ? Math.round(score) : '—'}</span></div>
      <div class="cat-track"><div class="cat-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

function findingCards(findings) {
  if (!findings.length) return '<p class="muted">No open findings.</p>';
  return findings
    .map((f) => {
      const color = SEVERITY_COLORS[f.severity] || '#6b7280';
      return `<article class="finding-card">
        <div class="finding-head">
          <span class="badge" style="background:${color}">${escapeHtml(f.severity)}</span>
          <code class="fid">${escapeHtml(f.id)}</code>
          <span class="fcat">${escapeHtml(f.category)}</span>
        </div>
        <h3>${escapeHtml(f.problem)}</h3>
        <p class="floc"><code>${escapeHtml(f.location)}</code></p>
      </article>`;
    })
    .join('');
}

const metaLine = [
  report.preset && `preset · ${report.preset}`,
  report.scope && `scope · ${report.scope}`,
  report.mode && `mode · ${report.mode}`,
  report.generatedAt && new Date(report.generatedAt).toISOString().slice(0, 10),
]
  .filter(Boolean)
  .join('  ·  ');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} — CodeCortexLoop Showcase</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Inter, system-ui, sans-serif;
    background: linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #0f172a 100%);
    color: #e2e8f0;
    min-height: 100vh;
    padding: 28px 20px 36px;
  }
  .frame {
    max-width: 1120px;
    margin: 0 auto;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0,0,0,.45);
    border: 1px solid rgba(255,255,255,.08);
    background: #0b1220;
  }
  .hero {
    padding: 28px 32px 24px;
    background: linear-gradient(120deg, rgba(37,99,235,.25), rgba(124,58,237,.15));
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .brand { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: rgba(148,163,184,.9); }
  .hero h1 { font-size: 32px; font-weight: 800; margin: 8px 0 4px; color: #f8fafc; }
  .hero .sub { color: rgba(226,232,240,.75); font-size: 15px; }
  .hero .meta { margin-top: 10px; font-size: 12px; color: rgba(148,163,184,.85); }
  .body { padding: 24px 28px 28px; display: grid; gap: 20px; }
  .row { display: grid; grid-template-columns: 240px 1fr; gap: 20px; align-items: stretch; }
  @media (max-width: 860px) { .row { grid-template-columns: 1fr; } }
  .panel {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 16px;
    padding: 20px;
  }
  .panel h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: rgba(148,163,184,.95); margin-bottom: 14px; }
  .score-wrap { display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .total-findings { text-align: center; font-size: 13px; color: rgba(148,163,184,.9); }
  .total-findings strong { display: block; font-size: 28px; color: #f8fafc; margin-top: 4px; }
  .sev-row { display: grid; grid-template-columns: 88px 1fr 32px; gap: 10px; align-items: center; margin: 10px 0; font-size: 13px; }
  .sev-label { display: flex; align-items: center; gap: 8px; color: rgba(226,232,240,.85); }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .sev-track { height: 8px; background: rgba(255,255,255,.08); border-radius: 999px; overflow: hidden; }
  .sev-fill { height: 100%; border-radius: 999px; }
  .sev-num { text-align: right; font-weight: 700; color: #f1f5f9; }
  .cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .cat-card { background: rgba(255,255,255,.03); border-radius: 12px; padding: 12px 14px; border: 1px solid rgba(255,255,255,.05); }
  .cat-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
  .cat-name { font-size: 12px; color: rgba(148,163,184,.95); }
  .cat-score { font-size: 20px; font-weight: 800; }
  .cat-track { height: 6px; background: rgba(255,255,255,.08); border-radius: 999px; overflow: hidden; }
  .cat-fill { height: 100%; border-radius: 999px; }
  .findings { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .finding-card {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 14px;
    padding: 14px 16px;
  }
  .finding-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
  .badge { color: #fff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; letter-spacing: .03em; }
  .fid { font-size: 11px; color: #93c5fd; background: rgba(59,130,246,.12); padding: 2px 6px; border-radius: 6px; }
  .fcat { font-size: 11px; color: rgba(148,163,184,.9); }
  .finding-card h3 { font-size: 14px; line-height: 1.45; color: #f1f5f9; font-weight: 600; margin-bottom: 8px; }
  .floc code { font-size: 11px; color: rgba(148,163,184,.95); word-break: break-all; }
  footer { text-align: center; padding: 14px; font-size: 11px; color: rgba(148,163,184,.7); border-top: 1px solid rgba(255,255,255,.06); }
  .muted { color: rgba(148,163,184,.8); font-size: 13px; }
</style>
</head>
<body>
<div class="frame">
  <header class="hero">
    <div class="brand">CodeCortexLoop · Real Project Report</div>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
    <p class="meta">${escapeHtml(metaLine)}</p>
  </header>
  <div class="body">
    <div class="row">
      <div class="panel score-wrap">
        <h2>Overall</h2>
        ${ringSvg(overall)}
        <div class="total-findings">未解决问题<strong>${counts.total}</strong></div>
      </div>
      <div class="panel">
        <h2>Severity breakdown</h2>
        ${severityBar('Critical', counts.Critical, counts.total, SEVERITY_COLORS.Critical)}
        ${severityBar('High', counts.High, counts.total, SEVERITY_COLORS.High)}
        ${severityBar('Medium', counts.Medium, counts.total, SEVERITY_COLORS.Medium)}
        ${severityBar('Low', counts.Low, counts.total, SEVERITY_COLORS.Low)}
      </div>
    </div>
    <div class="panel">
      <h2>Category scores</h2>
      <div class="cats">${categoryCards(categories)}</div>
    </div>
    <div class="panel">
      <h2>Top priorities</h2>
      <div class="findings">${findingCards(topFindings)}</div>
    </div>
  </div>
  <footer>CodeCortexLoop · Report mode · 完整明细见 report.html / report.json</footer>
</div>
</body>
</html>`;

ensureDirFor(outPath);
writeFileSync(outPath, html, 'utf8');
console.log(`[cortexloop] Showcase -> ${outPath}`);
