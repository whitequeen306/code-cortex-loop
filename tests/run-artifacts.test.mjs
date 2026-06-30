import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  allocateRunDirSlug,
  appendReflectionSection,
  formatRunDirSlug,
  formatRunDisplayTimeEn,
  formatRunDisplayTimeZh,
  initCortexloopRun,
  syncRunToLatest,
} from '../scripts/lib/run-artifacts.mjs';

test('formatRunDisplayTimeZh is human-readable not ISO', () => {
  const d = new Date(2026, 5, 25, 14, 30, 0);
  const s = formatRunDisplayTimeZh(d);
  assert.match(s, /2026/);
  assert.match(s, /25/);
  assert.match(s, /14/);
  assert.doesNotMatch(s, /T\d{2}:\d{2}:\d{2}/);
});

test('formatRunDirSlug uses readable local clock', () => {
  const d = new Date(2026, 5, 25, 14, 30, 0);
  assert.equal(formatRunDirSlug(d), '2026-06-25_14-30');
});

test('formatRunDisplayTimeEn is YYYY-MM-DD HH:mm', () => {
  const d = new Date(2026, 5, 25, 9, 5, 0);
  assert.equal(formatRunDisplayTimeEn(d), '2026-06-25 09:05');
});

test('initCortexloopRun stores directFixFloor in direct mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'cortexloop-run-'));
  const runsRoot = join(root, 'docs/cortexloop/runs');
  mkdirSync(runsRoot, { recursive: true });
  const prev = process.cwd();
  try {
    process.chdir(root);
    const meta = initCortexloopRun({ mode: 'direct', fixFloor: 'Medium', runsRoot: 'docs/cortexloop/runs' });
    assert.equal(meta.directFixFloor, 'Medium');
    const onDisk = JSON.parse(readFileSync('.cortexloop/run-meta.json', 'utf8'));
    assert.equal(onDisk.directFixFloor, 'Medium');
  } finally {
    process.chdir(prev);
    rmSync(root, { recursive: true, force: true });
  }
});

test('initCortexloopRun omits directFixFloor in report mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'cortexloop-run-'));
  try {
    const meta = initCortexloopRun({
      mode: 'report',
      preset: 'default',
      scope: 'recent',
      runsRoot: join(root, 'runs'),
      metaPath: join(root, 'run-meta.json'),
    });
    assert.ok(meta.runDisplayTime);
    assert.ok(existsSync(join(root, 'runs', meta.runId, 'RUN.md')));
    assert.match(readFileSync(join(root, 'runs', meta.runId, 'RUN.md'), 'utf8'), /运行时间/);
    assert.equal(JSON.parse(readFileSync(join(root, 'run-meta.json'), 'utf8')).runId, meta.runId);
    assert.equal(meta.directFixFloor, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('allocateRunDirSlug avoids collision', () => {
    const root = mkdtempSync(join(tmpdir(), 'cortexloop-slug-'));
  try {
    mkdirSync(join(root, '2026-06-25_14-30'));
    assert.equal(allocateRunDirSlug(root, '2026-06-25_14-30'), '2026-06-25_14-30_02');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('appendReflectionSection appends with display time', () => {
  const root = mkdtempSync(join(tmpdir(), 'cortexloop-ref-'));
  const out = join(root, '08-reflection.md');
  try {
    appendReflectionSection({
      meta: { runDisplayTime: '2026年6月25日 14:30', runDir: 'docs/cortexloop/runs/x', mode: 'direct' },
      summaryMarkdown: '### Summary\nFixed N+1.',
      out,
    });
    const text = readFileSync(out, 'utf8');
    assert.match(text, /运行记录 · 2026年6月25日 14:30/);
    assert.match(text, /Fixed N\+1/);
    appendReflectionSection({
      meta: { runDisplayTime: '2026年6月26日 10:00', runDir: 'docs/cortexloop/runs/y', mode: 'direct' },
      summaryMarkdown: '### Summary\nSecond run.',
      out,
    });
    const text2 = readFileSync(out, 'utf8');
    assert.match(text2, /2026年6月25日 14:30/);
    assert.match(text2, /2026年6月26日 10:00/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('syncRunToLatest copies run artifacts', () => {
  const root = mkdtempSync(join(tmpdir(), 'cortexloop-sync-'));
  try {
    const runDir = join(root, 'runs', '2026-06-25_14-30');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, 'report.json'), '{"generatedBy":"cortexloop"}', 'utf8');
    const meta = {
      runId: '2026-06-25_14-30',
      runDisplayTime: '2026年6月25日 14:30',
      runDir: runDir.replace(/\\/g, '/'),
    };
    const result = syncRunToLatest({ meta, latestRoot: join(root, 'latest') });
    assert.ok(result.copied.includes('report.json'));
    assert.ok(existsSync(join(root, 'latest', 'report.json')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
