import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
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
export const DEFAULT_PLAYBOOK_ZH = '.cortexloop/playbook-zh.md';
export const DEFAULT_REFLECTION = '.cortexloop/reflection.json';
export const GLOBAL_PLAYBOOK = join(homedir(), '.cortexloop', 'playbook.json');
export const GLOBAL_PLAYBOOK_ZH = join(homedir(), '.cortexloop', 'playbook-zh.md');

export const PLAYBOOK_CATEGORY_ZH = {
  correctness: '正确性',
  security: '安全',
  performance: '性能',
  simplicity: '简洁性',
  tests: '测试',
  errorHandling: '错误处理',
  cleanup: '清理',
};

export const PLAYBOOK_TIER_ZH = {
  verified: '已验证（模型默认可召回）',
  candidate: '候选中（未确认，模型默认不可见）',
  quarantined: '已隔离（模型不可见）',
};

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
  const tmp = `${path}.tmp`;
  const body = `${JSON.stringify(data, null, 2)}\n`;
  writeFileSync(tmp, body, 'utf8');
  try {
    renameSync(tmp, path);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/** Resolve a path inside the workspace; reject traversal escapes. */
export function resolveWithinWorkspace(filePath, workspaceRoot = process.cwd()) {
  const root = resolve(workspaceRoot);
  const abs = resolve(root, filePath);
  const rel = relative(root, abs);
  if (rel.startsWith('..') || relative(root, abs).split('..').length > 1) {
    throw new Error(`Path escapes workspace: ${filePath}`);
  }
  return abs;
}

export function readJsonWithinWorkspace(filePath, workspaceRoot = process.cwd()) {
  return readJson(resolveWithinWorkspace(filePath, workspaceRoot));
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
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0, total: 0, unknown: 0 };
  for (const f of findings || []) {
    if (status === 'open' && (f.status === 'fixed' || f.status === 'suppressed')) continue;
    if (counts[f.severity] != null) counts[f.severity]++;
    else counts.unknown++;
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

/** Location for baseline fingerprint — keeps line numbers to avoid same-file collisions. */
export function fingerprintLocation(location = '') {
  return String(location).replace(/\\/g, '/').toLowerCase().trim();
}

export function normalizeProblemForFingerprint(problem = '') {
  return String(problem)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[`"'"]/g, '')
    .trim();
}

function djb2Hex(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function findingFingerprint(finding) {
  const payload = [
    finding.category || '',
    fingerprintLocation(finding.location),
    normalizeProblemForFingerprint(finding.problem),
  ].join('|');
  return djb2Hex(payload);
}

export const VALID_SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'];

/** Ensure report.json was produced by CodeCortexLoop, not hand-edited for CI bypass. */
export function validateReport(report) {
  if (!report || typeof report !== 'object') {
    return 'Report must be a JSON object';
  }
  if (!report.version || !String(report.version).startsWith('2.')) {
    return 'Report version must be 2.x';
  }
  if (report.generatedBy !== 'cortexloop') {
    return 'Report must include generatedBy: "cortexloop" (run /cortexloop --ci or pipeline post-process)';
  }
  if (!Array.isArray(report.findings)) {
    return 'Report must include findings array';
  }
  if (!report.scores || typeof report.scores !== 'object') {
    return 'Report must include scores object';
  }
  for (const f of report.findings) {
    if (!VALID_SEVERITIES.includes(f.severity)) {
      return `Invalid finding severity: ${f.severity ?? '(missing)'}`;
    }
  }
  return null;
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

/** Escape user/report-sourced text embedded in GitHub-flavored markdown. */
export function escapeMarkdown(text) {
  return String(text).replace(/([\\`*_[\]#<>])/g, '\\$1');
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

/** Human-readable Chinese export path paired with playbook.json (not used by query). */
export function playbookZhPathFrom(playbookPath = DEFAULT_PLAYBOOK) {
  if (playbookPath.endsWith('playbook.json')) {
    return playbookPath.replace(/playbook\.json$/, 'playbook-zh.md');
  }
  return join(dirname(playbookPath), 'playbook-zh.md');
}

function formatPlaybookZhEntry(entry, now = Date.now()) {
  const conf = decayedConfidence(entry, now).toFixed(2);
  const tier = entry.tier || 'candidate';
  const category = PLAYBOOK_CATEGORY_ZH[entry.category] || entry.category || '未知';
  const tierLabel = PLAYBOOK_TIER_ZH[tier] || tier;
  const problemZh = entry.problemPatternZh || entry.problemPattern || '—';
  const fixZh = entry.fixMethodZh || entry.fixMethod || '—';
  const problemEn = entry.problemPatternZh ? entry.problemPattern : null;
  const fixEn = entry.fixMethodZh ? entry.fixMethod : null;
  const lines = [
    `### ${entry.id} · ${category} · ${tierLabel}`,
    '',
    `- **问题：** ${problemZh}`,
    `- **修法：** ${fixZh}`,
  ];
  if (problemEn) lines.push(`- **问题（英文，供模型）：** ${problemEn}`);
  if (fixEn) lines.push(`- **修法（英文，供模型）：** ${fixEn}`);
  lines.push(
    `- **置信度：** ${conf} | **验证：** ${entry.verifiedCount ?? 0} 次 | **场景数：** ${(entry.distinctContexts || []).length}`,
  );
  if (entry.failedCount) lines.push(`- **失败次数：** ${entry.failedCount}`);
  if (entry.examples?.length) lines.push(`- **示例位置：** ${entry.examples.join(', ')}`);
  if (entry.evidence?.length) lines.push(`- **外部证据：** ${entry.evidence.join('; ')}`);
  lines.push('');
  return lines.join('\n');
}

/** Render Chinese markdown for humans. Model query still uses playbook.json (English). */
export function renderPlaybookZhMarkdown(playbook, now = Date.now()) {
  const entries = [...(playbook.entries || [])];
  entries.sort((a, b) => playbookScore(b, now) - playbookScore(a, now));

  const verified = entries.filter((e) => e.tier === 'verified');
  const candidates = entries.filter((e) => e.tier !== 'verified' && e.tier !== 'quarantined');
  const quarantined = entries.filter((e) => e.tier === 'quarantined');

  const lines = [
    '# CodeCortexLoop Playbook（中文版 · 仅供阅读）',
    '',
    '> 本文件给**中文用户/团队**阅读与复盘，**不会**被 `playbook.mjs query` 喂给模型。',
    '> 模型在 Step 0.5 读取的是 `.cortexloop/playbook.json`（英文 recall，不是权威结论）。',
    '',
    `**更新时间：** ${playbook.updatedAt || new Date(now).toISOString()}`,
    `**条目总数：** ${entries.length}`,
    '',
  ];

  if (verified.length) {
    lines.push('## ✅ 已验证模式', '');
    for (const e of verified) lines.push(formatPlaybookZhEntry(e, now));
  }
  if (candidates.length) {
    lines.push('## ⚠️ 候选模式（未确认，请勿直接套用）', '');
    for (const e of candidates) lines.push(formatPlaybookZhEntry(e, now));
  }
  if (quarantined.length) {
    lines.push('## 🚫 已隔离（低置信 / 失败过多）', '');
    for (const e of quarantined) lines.push(formatPlaybookZhEntry(e, now));
  }
  if (!entries.length) {
    lines.push('_暂无 Playbook 条目。Direct 模式复验成功后运行 reflect + record 即可生成。_', '');
  }

  lines.push('---', '', '_由 `playbook.mjs` 在 record / feedback / prune 后自动更新。_');
  return `${lines.join('\n')}\n`;
}

export function savePlaybookZh(playbookPath, playbook) {
  const zhPath = playbookZhPathFrom(playbookPath);
  ensureDirFor(zhPath);
  writeFileSync(zhPath, renderPlaybookZhMarkdown(playbook), 'utf8');
  return zhPath;
}

export const TIER_WEIGHTS = {
  verified: 1.5,
  quarantined: 0.1,
  candidate: 1,
};

export function mergeTier(projectTier, globalTier) {
  if (projectTier === 'verified' || globalTier === 'verified') return 'verified';
  if (projectTier === 'quarantined' && globalTier === 'quarantined') return 'quarantined';
  return projectTier || globalTier || 'candidate';
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
      tier: mergeTier(entry.tier, existing.tier),
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
  const tierWeight = TIER_WEIGHTS[entry.tier] ?? TIER_WEIGHTS.candidate;
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
