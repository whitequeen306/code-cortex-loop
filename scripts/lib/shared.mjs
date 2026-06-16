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
      verifiedCount: Math.max(entry.verifiedCount || 0, existing.verifiedCount || 0),
      confidence: Math.max(entry.confidence || 0, existing.confidence || 0),
      tier: entry.tier === 'verified' || existing.tier === 'verified' ? 'verified' : (entry.tier || existing.tier || 'candidate'),
      examples: [...new Set([...(entry.examples || []), ...(existing.examples || [])])],
      distinctContexts: [...new Set([...(entry.distinctContexts || []), ...(existing.distinctContexts || [])])],
    });
  }

  return [...map.values()];
}

// ── Anti-hallucination learning loop ──────────────────────────────
// Memory is RECALL, not AUTHORITY. Confidence only moves on verified
// outcomes (incl. negative signals); external oracles (CI / human)
// outweigh self-reported success; promotion to the trusted tier needs
// diverse, verified evidence; trust decays until re-validated.

export const PLAYBOOK_DEFAULTS = {
  newConfidence: 0.3,        // unconfirmed hypothesis starts low
  maxConfidence: 0.95,
  minConfidence: 0,
  promoteConfidence: 0.7,    // tier candidate -> verified threshold
  demoteConfidence: 0.4,     // verified -> candidate when it drops below
  quarantineConfidence: 0.2, // hidden from query until pruned
  minVerified: 2,            // verified successes needed to promote
  minDistinctContexts: 2,    // diversity: must succeed in >=2 contexts
  decayPerDay: 0.01,         // confidence lost per day since lastValidated
};

// Signed confidence deltas per outcome. External oracle > self-report.
// Negatives are stronger than positives (asymmetric: a wrong memory is
// far costlier than a missed recall).
export const OUTCOME_DELTAS = {
  external_verified: 0.2,   // CI passed / PR merged / human accepted
  self_verified: 0.1,       // Direct re-verify + local tests passed
  rejected: -0.1,           // suggested but judged not applicable
  failed: -0.4,             // applied then tests failed / reverted
};

export function clampConfidence(c, cfg = PLAYBOOK_DEFAULTS) {
  return Math.max(cfg.minConfidence, Math.min(cfg.maxConfidence, c));
}

// Time decay on trust: an entry not re-validated recently loses authority.
// Returns a new confidence value (does not mutate). Verified outcomes
// reset the clock via lastValidated.
export function decayedConfidence(entry, now = Date.now(), cfg = PLAYBOOK_DEFAULTS) {
  const base = entry.confidence ?? cfg.newConfidence;
  const anchor = entry.lastValidated || entry.lastUsed || entry.createdAt;
  if (!anchor) return base;
  const days = Math.max(0, (now - Date.parse(anchor)) / 86400000);
  return clampConfidence(base - days * (cfg.decayPerDay ?? 0), cfg);
}

// Decide tier from evidence. Promotion requires diverse + verified
// successes; a single failure or low confidence demotes/quarantines.
export function recomputeTier(entry, cfg = PLAYBOOK_DEFAULTS) {
  const conf = entry.confidence ?? cfg.newConfidence;
  const verified = entry.verifiedCount ?? 0;
  const contexts = (entry.distinctContexts || []).length;

  if (conf < cfg.quarantineConfidence) return 'quarantined';
  if (
    conf >= cfg.promoteConfidence &&
    verified >= cfg.minVerified &&
    contexts >= cfg.minDistinctContexts
  ) {
    return 'verified';
  }
  if (entry.tier === 'verified' && conf <= cfg.demoteConfidence) return 'candidate';
  return entry.tier === 'verified' ? 'verified' : 'candidate';
}

// Apply one outcome signal to an entry in place. `external` outcomes
// and `self_verified` count as validation (reset decay clock + bump
// verifiedCount + record distinct context). Returns the entry.
export function applyOutcome(entry, outcome, { context, evidence, now } = {}, cfg = PLAYBOOK_DEFAULTS) {
  const ts = now || new Date().toISOString();
  const delta = OUTCOME_DELTAS[outcome] ?? 0;
  entry.confidence = clampConfidence((entry.confidence ?? cfg.newConfidence) + delta, cfg);
  entry.lastUsed = ts;

  const isPositive = outcome === 'external_verified' || outcome === 'self_verified';
  if (isPositive) {
    entry.verifiedCount = (entry.verifiedCount ?? 0) + 1;
    entry.lastValidated = ts;
    if (context) {
      entry.distinctContexts = [...new Set([...(entry.distinctContexts || []), context])];
    }
  } else {
    entry.rejectedCount = (entry.rejectedCount ?? 0) + (outcome === 'rejected' ? 1 : 0);
    entry.failedCount = (entry.failedCount ?? 0) + (outcome === 'failed' ? 1 : 0);
  }
  if (evidence) {
    entry.evidence = [...new Set([...(entry.evidence || []), evidence])].slice(-5);
  }
  entry.tier = recomputeTier(entry, cfg);
  return entry;
}

// Ranking: trust × breadth, with verified tier strongly favored and
// failures penalized. Uses decayed confidence so stale memory sinks.
export function playbookScore(entry, now = Date.now(), cfg = PLAYBOOK_DEFAULTS) {
  const c = decayedConfidence(entry, now, cfg);
  const n = entry.verifiedCount ?? entry.appliedCount ?? 1;
  const tierWeight = entry.tier === 'verified' ? 1.5 : entry.tier === 'quarantined' ? 0.1 : 1;
  const failPenalty = 1 / (1 + (entry.failedCount ?? 0));
  return c * Math.log(n + 1) * tierWeight * failPenalty;
}

export function nextPlaybookId(entries) {
  let max = 0;
  for (const e of entries || []) {
    const m = /^PB-(\d+)$/.exec(e.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PB-${String(max + 1).padStart(3, '0')}`;
}
