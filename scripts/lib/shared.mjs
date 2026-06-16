import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

export const DEFAULT_REPORT = 'docs/cortexloop/report.json';
export const DEFAULT_HISTORY = '.cortexloop/history.json';
export const DEFAULT_BASELINE = '.cortexloop/baseline.json';
export const DEFAULT_BASELINE_DIFF = '.cortexloop/baseline-diff.json';
export const DEFAULT_BADGE_SVG = '.cortexloop/health-badge.svg';
export const DEFAULT_BADGE_JSON = '.cortexloop/badge.json';
export const DEFAULT_DASHBOARD = 'docs/cortexloop/report.html';
export const DEFAULT_PR_COMMENT = '.cortexloop/pr-comment.md';
export const DEFAULT_PLAYBOOK = '.cortexloop/playbook.json';
export const DEFAULT_REFLECTION = '.cortexloop/reflection.json';
export const GLOBAL_PLAYBOOK = join(homedir(), '.cortexloop', 'playbook.json');

export const CATEGORIES = [
  'correctness',
  'security',
  'performance',
  'simplicity',
  'tests',
  'errorHandling',
  'cleanup',
];

export const CATEGORY_LABELS = {
  correctness: 'Correctness',
  security: 'Security',
  performance: 'Performance',
  simplicity: 'Simplicity',
  tests: 'Tests',
  errorHandling: 'Error Handling',
  cleanup: 'Cleanup',
};

export const SEVERITY_COLORS = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#ca8a04',
  Low: '#2563eb',
  Info: '#6b7280',
};

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function ensureDirFor(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function readReport(reportPath = DEFAULT_REPORT) {
  if (!existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`);
  }
  return readJson(reportPath);
}

export function getOverallScore(report) {
  const scores = report.scores || {};
  if (scores.after?.overall != null) return scores.after.overall;
  if (scores.before?.overall != null) return scores.before.overall;
  return null;
}

export function getCategoryScores(report) {
  const block = report.scores?.after || report.scores?.before || {};
  return Object.fromEntries(CATEGORIES.map((c) => [c, block[c] ?? null]));
}

export function countFindings(findings, { status = 'open' } = {}) {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0, total: 0 };
  for (const f of findings || []) {
    if (status === 'open' && (f.status === 'fixed' || f.status === 'suppressed')) continue;
    if (counts[f.severity] != null) counts[f.severity]++;
    counts.total++;
  }
  return counts;
}

export function scoreColor(score) {
  if (score == null) return '#6b7280';
  if (score >= 90) return '#059669';
  if (score >= 75) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

export function normalizeLocation(location = '') {
  return String(location)
    .replace(/\\/g, '/')
    .replace(/:\d+:\d+$/, '')
    .replace(/:\d+$/, '')
    .toLowerCase()
    .trim();
}

export function normalizeProblem(problem = '') {
  return String(problem)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[`"'"]/g, '')
    .trim()
    .slice(0, 120);
}

export function findingFingerprint(finding) {
  const payload = [
    finding.category || '',
    normalizeLocation(finding.location),
    normalizeProblem(finding.problem),
  ].join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export function tryGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function tryGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function parseArgs(argv = process.argv.slice(2)) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
  const getFlagValue = (name, fallback) => {
    const inline = argv.find((a) => a.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    return fallback;
  };
  return { positional, flags, getFlagValue };
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function playbookSignature({ category, problemPattern, language }) {
  const slug = slugify(problemPattern || 'unknown');
  const lang = language || 'any';
  return `${category || 'unknown'}:${slug}:${lang}`;
}

export function loadPlaybook(path = DEFAULT_PLAYBOOK) {
  if (!existsSync(path)) {
    return { version: '2.2', updatedAt: null, entries: [] };
  }
  const data = readJson(path);
  if (!Array.isArray(data.entries)) data.entries = [];
  return data;
}

export function savePlaybook(path, data) {
  data.version = '2.2';
  data.updatedAt = new Date().toISOString();
  writeJson(path, data);
}

export function mergePlaybooks(projectPb, globalPb) {
  const map = new Map();

  for (const entry of globalPb.entries || []) {
    map.set(entry.signature, { ...entry, examples: [...(entry.examples || [])] });
  }

  for (const entry of projectPb.entries || []) {
    const existing = map.get(entry.signature);
    if (!existing) {
      map.set(entry.signature, { ...entry, examples: [...(entry.examples || [])] });
      continue;
    }
    map.set(entry.signature, {
      ...entry,
      appliedCount: Math.max(entry.appliedCount || 0, existing.appliedCount || 0),
      confidence: Math.max(entry.confidence || 0, existing.confidence || 0),
      examples: [...new Set([...(entry.examples || []), ...(existing.examples || [])])],
    });
  }

  return [...map.values()];
}

export function playbookScore(entry) {
  const c = entry.confidence ?? 0.5;
  const n = entry.appliedCount ?? 1;
  return c * Math.log(n + 1);
}

export function nextPlaybookId(entries) {
  let max = 0;
  for (const e of entries || []) {
    const m = /^PB-(\d+)$/.exec(e.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PB-${String(max + 1).padStart(3, '0')}`;
}
