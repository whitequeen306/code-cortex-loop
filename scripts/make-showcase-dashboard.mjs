#!/usr/bin/env node
/**
 * Showcase dashboard — default layout is before/after compare (Report → Direct).
 * Usage:
 *   node scripts/make-showcase-dashboard.mjs report.json --out=showcase.html \
 *     --title="LianYu-PC" --subtitle="..." --layout=compare
 */
import { writeFileSync } from 'node:fs';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SEVERITY_COLORS,
  computeScores,
  countFindings,
  ensureDirFor,
  escapeHtml,
  parseArgs,
  readJson,
  scoreColor,
} from './lib/shared.mjs';

const { positional, getFlagValue } = parseArgs();
const reportPath = positional[0] || 'docs/cortexloop/report.json';
const outPath = getFlagValue('--out', 'docs/cortexloop/showcase.html');
const title = getFlagValue('--title', 'Project');
const subtitle = getFlagValue('--subtitle', '');
const layout = getFlagValue('--layout', 'compare');

const report = readJson(reportPath);

/** Direct 修复示意：与 LianYu-PC reflection 一致，41 项 = 全部 Critical + High */
function simulateDirectAfter(findings) {
  return (findings || []).map((f) => {
    if (f.severity === 'Critical' || f.severity === 'High') {
      return { ...f, status: 'fixed' };
    }
    return { ...f };
  });
}

function ringSvg(score, size = 160, gradId = 'ringGrad') {
  const r = (size - 20) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0));
  const dash = (pct / 100) * c;
  const color = scoreColor(score);
  const cx = size / 2;
  const cy = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <defs>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="12"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#${gradId})" stroke-width="12"
      stroke-linecap="round" stroke-dasharray="${dash} ${c}" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="40" font-weight="800" fill="#f8fafc">${Math.round(score ?? 0)}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="11" fill="rgba(248,250,252,.65)">健康分</text>
  </svg>`;
}

function categoryCompareRows(beforeCats, afterCats) {
  return CATEGORIES.map((cat) => {
    const b = beforeCats[cat] ?? 0;
    const a = afterCats[cat] ?? 0;
    const delta = a - b;
    const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
    const deltaColor = delta > 0 ? '#34d399' : delta < 0 ? '#f87171' : 'rgba(148,163,184,.8)';
    const label = CATEGORY_LABELS[cat] || cat;
    return `<div class="cmp-row">
      <span class="cmp-name">${escapeHtml(label)}</span>
      <span class="cmp-before">${Math.round(b)}</span>
      <span class="cmp-arrow">→</span>
      <span class="cmp-after" style="color:${scoreColor(a)}">${Math.round(a)}</span>
      <span class="cmp-delta" style="color:${deltaColor}">${deltaStr}</span>
    </div>`;
  }).join('');
}

function severityMini(counts) {
  return ['Critical', 'High', 'Medium', 'Low']
    .map((sev) => {
      const n = counts[sev] ?? 0;
      const color = SEVERITY_COLORS[sev];
      return `<span class="pill" style="border-color:${color};color:${color}">${sev} ${n}</span>`;
    })
    .join('');
}

function buildCompareHtml() {
  // Both before & after are computed deterministically from findings by the
  // shared canonical scorer (same as the main pipeline / compute-scores.mjs):
  // weighted average, security & correctness 1.5x. before = the raw findings;
  // after = the same findings with all Critical+High marked fixed (simulated).
  const before = computeScores(report.findings || []);
  const beforeOverall = before.overall;
  const beforeCats = before.categories;
  const beforeCounts = countFindings(report.findings || []);

  const afterFindings = simulateDirectAfter(report.findings);
  const after = computeScores(afterFindings);
  const afterOverall = after.overall;
  const afterCats = after.categories;
  const afterCounts = countFindings(afterFindings);

  const delta = afterOverall - beforeOverall;

  const metaLine = [
    report.preset && `${report.preset}`,
    report.scope && `${report.scope}`,
    report.generatedAt && new Date(report.generatedAt).toISOString().slice(0, 10),
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} — Report → Direct</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", Inter, system-ui, sans-serif;
    background: linear-gradient(145deg, #0f172a, #1e293b);
    color: #e2e8f0;
    padding: 24px 16px;
  }
  .frame {
    max-width: 960px;
    margin: 0 auto;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.08);
    background: #0b1220;
    box-shadow: 0 20px 60px rgba(0,0,0,.4);
  }
  .hero {
    padding: 22px 28px;
    background: linear-gradient(120deg, rgba(37,99,235,.22), rgba(16,185,129,.12));
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .brand { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: rgba(148,163,184,.9); }
  .hero h1 { font-size: 26px; font-weight: 800; margin: 6px 0 2px; }
  .hero .sub { font-size: 14px; color: rgba(226,232,240,.75); }
  .hero .meta { margin-top: 8px; font-size: 11px; color: rgba(148,163,184,.85); }
  .compare {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
    padding: 24px 28px;
    align-items: center;
  }
  @media (max-width: 720px) { .compare { grid-template-columns: 1fr; } .mid-arrow { transform: rotate(90deg); } }
  .col {
    background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 14px;
    padding: 18px;
    text-align: center;
  }
  .col h2 { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: rgba(148,163,184,.95); margin-bottom: 12px; }
  .col .mode { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 8px; }
  .col .hint { font-size: 11px; color: rgba(148,163,184,.85); margin-bottom: 12px; min-height: 28px; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 12px; }
  .pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; border: 1px solid; }
  .mid-arrow {
    font-size: 28px;
    font-weight: 800;
    color: #34d399;
    text-align: center;
    line-height: 1.2;
  }
  .mid-arrow small { display: block; font-size: 13px; color: #6ee7b7; margin-top: 4px; }
  .cats { padding: 0 28px 24px; }
  .cats h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: rgba(148,163,184,.95); margin-bottom: 12px; }
  .cmp-row {
    display: grid;
    grid-template-columns: 110px 36px 24px 36px 40px;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,.04);
  }
  .cmp-name { color: rgba(148,163,184,.95); }
  .cmp-before { text-align: right; color: rgba(226,232,240,.7); }
  .cmp-arrow { text-align: center; color: rgba(148,163,184,.6); }
  .cmp-after { font-weight: 800; text-align: right; }
  .cmp-delta { text-align: right; font-size: 12px; font-weight: 700; }
  footer { padding: 12px; text-align: center; font-size: 10px; color: rgba(148,163,184,.65); border-top: 1px solid rgba(255,255,255,.06); }
</style>
</head>
<body>
<div class="frame">
  <header class="hero">
    <div class="brand">CodeCortexLoop · 真实项目 · Report → Direct</div>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ''}
    <p class="meta">${escapeHtml(metaLine)}</p>
  </header>
  <div class="compare">
    <div class="col">
      <h2>Step 1</h2>
      <div class="mode">Report 诊断</div>
      <div class="hint">七专家扫描 · 结构化报告</div>
      ${ringSvg(beforeOverall, 160, 'ringBefore')}
      <div class="pills">${severityMini(beforeCounts)}</div>
      <div class="hint" style="margin-top:10px">未解决 <strong>${beforeCounts.total}</strong> 项</div>
    </div>
    <div class="mid-arrow">→<small>${delta >= 0 ? '+' : ''}${delta} 分</small></div>
    <div class="col">
      <h2>Step 2</h2>
      <div class="mode">Direct 修复 + 复验</div>
      <div class="hint">Critical/High 清零后重算*</div>
      ${ringSvg(afterOverall, 160, 'ringAfter')}
      <div class="pills">${severityMini(afterCounts)}</div>
      <div class="hint" style="margin-top:10px">未解决 <strong>${afterCounts.total}</strong> 项</div>
    </div>
  </div>
  <div class="cats">
    <h3>七维类别 · 修复前 → 修复后</h3>
    ${categoryCompareRows(beforeCats, afterCats)}
  </div>
  <footer>* 得分由确定性 computeScores 从 findings 计算（同主流水线口径：加权，security & correctness 1.5x）。Direct 为示意：按 reflection 修复全部 Critical+High 后重算，非完整七专家复验。</footer>
</div>
</body>
</html>`;
}

const html = layout === 'compare' ? buildCompareHtml() : buildCompareHtml();

ensureDirFor(outPath);
writeFileSync(outPath, html, 'utf8');
console.log(`[cortexloop] Showcase (${layout}) -> ${outPath}`);
