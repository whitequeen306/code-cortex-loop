/**
 * Per-run report paths and human-readable run times (not raw ISO in UI).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { PASS_PIPELINE, tryGitBranch, tryGitCommit, writeJson } from './shared.mjs';

export const DEFAULT_RUN_META = '.cortexloop/run-meta.json';
export const DEFAULT_RUNS_ROOT = 'docs/cortexloop/runs';
export const DEFAULT_REFLECTION_LOG = 'docs/cortexloop/08-reflection.md';
export const DEFAULT_LATEST_POINTER = 'docs/cortexloop/latest-run.json';

/** @param {Date} [date] */
export function formatRunDisplayTimeZh(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** @param {Date} [date] */
export function formatRunDisplayTimeEn(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

/** Filesystem-safe run folder slug from local time (human-readable, not ISO). */
export function formatRunDirSlug(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}_${h}-${min}`;
}

/**
 * @param {string} runsRoot
 * @param {string} baseSlug
 */
export function allocateRunDirSlug(runsRoot, baseSlug) {
  let slug = baseSlug;
  let n = 2;
  while (existsSync(join(runsRoot, slug))) {
    slug = `${baseSlug}_${String(n).padStart(2, '0')}`;
    n += 1;
  }
  return slug;
}

/**
 * @param {string} runDir
 */
export function buildRunReportsMap(runDir) {
  const dir = runDir.replace(/\\/g, '/');
  /** @type {Record<string, string>} */
  const categoryReports = {};
  for (const step of PASS_PIPELINE) {
    const name = basename(step.categoryReport);
    categoryReports[name.replace(/\.md$/, '')] = `${dir}/${name}`;
  }
  return {
    summary: `${dir}/00-summary.md`,
    reportJson: `${dir}/report.json`,
    reportHtml: `${dir}/report.html`,
    runSummary: `${dir}/run-summary.md`,
    categoryReports,
  };
}

/**
 * @param {object} opts
 */
export function initCortexloopRun(opts = {}) {
  const {
    mode = 'report',
    preset = 'default',
    scope = 'recent',
    runsRoot = DEFAULT_RUNS_ROOT,
    metaPath = DEFAULT_RUN_META,
  } = opts;

  const now = new Date();
  const baseSlug = formatRunDirSlug(now);
  const runId = allocateRunDirSlug(runsRoot, baseSlug);
  const runDir = join(runsRoot, runId).replace(/\\/g, '/');
  mkdirSync(runDir, { recursive: true });

  const runDisplayTime = formatRunDisplayTimeZh(now);
  const runDisplayTimeEn = formatRunDisplayTimeEn(now);
  const reports = buildRunReportsMap(runDir);

  const meta = {
    version: '2.4',
    runId,
    runDisplayTime,
    runDisplayTimeEn,
    runDir,
    startedAt: now.toISOString(),
    mode,
    preset,
    scope,
    gitCommit: tryGitCommit(),
    gitBranch: tryGitBranch(),
    reports,
    reflectionLog: DEFAULT_REFLECTION_LOG,
  };

  writeJson(metaPath, meta);
  writeJson(join(runDir, 'run-meta.json'), meta);

  const runReadme = `# CodeCortexLoop 运行记录

- **运行时间:** ${runDisplayTime}
- **Run ID:** \`${runId}\`
- **模式:** ${mode}
- **范围:** ${scope}
- **预设:** ${preset}
${meta.gitCommit ? `- **Git:** \`${meta.gitCommit.slice(0, 7)}\` (${meta.gitBranch || 'detached'})` : ''}

本目录保存此次运行的专家报告与 \`report.json\`。最新一次运行会同步到 \`docs/cortexloop/report.json\` 供看板/CI 使用。
`;
  writeFileSync(join(runDir, 'RUN.md'), runReadme, 'utf8');

  writeJson(DEFAULT_LATEST_POINTER, {
    runId,
    runDisplayTime,
    runDir,
    syncedAt: now.toISOString(),
  });

  return meta;
}

/** @param {string} [metaPath] */
export function loadRunMeta(metaPath = DEFAULT_RUN_META) {
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {object|null} meta
 */
export function getPipelineForRun(meta = loadRunMeta()) {
  if (!meta?.reports?.categoryReports) {
    return PASS_PIPELINE.map((step) => ({ ...step }));
  }
  return PASS_PIPELINE.map((step) => {
    const name = basename(step.categoryReport).replace(/\.md$/, '');
    const reportPath = meta.reports.categoryReports[name] || step.categoryReport;
    return { ...step, categoryReport: reportPath };
  });
}

const SYNC_FILES = [
  '00-summary.md',
  '01-correctness.md',
  '02-security.md',
  '03-performance.md',
  '04-simplicity.md',
  '05-tests.md',
  '06-error-handling.md',
  '07-cleanup.md',
  'report.json',
  'report.html',
  'run-summary.md',
];

/**
 * @param {object} [opts]
 */
export function syncRunToLatest(opts = {}) {
  const meta = opts.meta ?? loadRunMeta(opts.metaPath);
  if (!meta?.runDir) {
    throw new Error('run-meta.json missing or has no runDir — run init-run.mjs first');
  }
  const runDir = meta.runDir.replace(/\\/g, '/');
  const latestRoot = opts.latestRoot ?? 'docs/cortexloop';
  mkdirSync(latestRoot, { recursive: true });

  const copied = [];
  for (const file of SYNC_FILES) {
    const src = join(runDir, file);
    if (!existsSync(src)) continue;
    const dst = join(latestRoot, file);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    copied.push(file);
  }

  writeJson(DEFAULT_LATEST_POINTER, {
    runId: meta.runId,
    runDisplayTime: meta.runDisplayTime,
    runDir: meta.runDir,
    syncedAt: new Date().toISOString(),
    copiedFiles: copied,
  });

  return { copied, runDir, latestRoot };
}

/**
 * @param {object} opts
 */
export function appendReflectionSection(opts) {
  const {
    meta = loadRunMeta(),
    summaryMarkdown,
    out = DEFAULT_REFLECTION_LOG,
  } = opts;

  if (!summaryMarkdown?.trim()) {
    throw new Error('summaryMarkdown is required');
  }

  const displayTime = meta?.runDisplayTime ?? formatRunDisplayTimeZh();
  const runDir = meta?.runDir ?? '(unknown run)';
  const mode = meta?.mode ?? 'direct';
  const commit = meta?.gitCommit ? meta.gitCommit.slice(0, 7) : 'n/a';

  const section = [
    '',
    '---',
    '',
    `## 运行记录 · ${displayTime}`,
    '',
    `> Run: \`${runDir}\` · 模式: ${mode} · commit: \`${commit}\``,
    '',
    summaryMarkdown.trim(),
    '',
  ].join('\n');

  mkdirSync(dirname(out), { recursive: true });
  if (!existsSync(out)) {
    writeFileSync(
      out,
      `# CodeCortexLoop 自进化日志\n\n同一文件增量追加；模型记忆写入 \`.cortexloop/playbook.json\`。\n`,
      'utf8',
    );
  }
  writeFileSync(out, readFileSync(out, 'utf8') + section, 'utf8');
  return { out, displayTime };
}
