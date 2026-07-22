import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts', 'compute-scores.mjs');

function tmpReport(findings, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cortexloop-cs-'));
  const path = join(dir, 'report.json');
  writeFileSync(
    path,
    JSON.stringify({ generatedBy: 'cortexloop', version: '2.2', findings, ...extra }, null, 2),
  );
  return { dir, path };
}

function run(path, args = []) {
  return execFileSync(process.execPath, [SCRIPT, path, ...args], { encoding: 'utf8' });
}

function readBack(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('compute-scores --as=before writes nested scores.before + syncs top-level overall', () => {
  // 1 Critical correctness (->75) + 1 High error-handling kebab (->90).
  // weighted: (75*1.5 + 100*1.5 + 100*4 + 90) / 8 = 752.5/8 = 94.06 -> 94
  const { dir, path } = tmpReport([
    { category: 'correctness', severity: 'Critical', status: 'open' },
    { category: 'error-handling', severity: 'High', status: 'open' },
  ]);
  try {
    const out = run(path, ['--as=before']);
    assert.match(out, /scores\.before/);
    const r = readBack(path);
    assert.equal(r.scores.before.overall, 94);
    assert.equal(r.scores.before.computedBy, 'cortexloop-compute-scores');
    assert.equal(r.scores.before.categories.correctness, 75);
    assert.equal(r.scores.before.categories.errorHandling, 90); // kebab normalized
    assert.equal(r.scores.overall, 94); // top-level synced to before (no after yet)
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compute-scores --as=after recomputes from post-fix findings, keeps before, syncs overall to after', () => {
  const { dir, path } = tmpReport([
    { category: 'correctness', severity: 'Critical', status: 'open' },
    { category: 'error-handling', severity: 'High', status: 'open' },
  ]);
  try {
    run(path, ['--as=before']); // before = 94
    // Simulate Direct fixes: mark both findings fixed, then compute after.
    const r = readBack(path);
    r.findings = r.findings.map((f) => ({ ...f, status: 'fixed' }));
    writeFileSync(path, JSON.stringify(r, null, 2));
    run(path, ['--as=after']);
    const r2 = readBack(path);
    assert.equal(r2.scores.before.overall, 94); // preserved
    assert.equal(r2.scores.after.overall, 100); // all fixed -> all categories 100
    assert.equal(r2.scores.overall, 100); // top-level now reflects after
    assert.equal(r2.scores.after.computedBy, 'cortexloop-compute-scores');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compute-scores prunes stale flat per-category root fields from a legacy report', () => {
  const { dir, path } = tmpReport(
    [{ category: 'security', severity: 'High', status: 'open' }],
    { scores: { overall: 50, correctness: 80, security: 70, errorHandling: 60 } },
  );
  try {
    run(path, ['--as=before', '--quiet']);
    const r = readBack(path);
    // flat root fields gone
    assert.equal(Object.hasOwn(r.scores, 'correctness'), false);
    assert.equal(Object.hasOwn(r.scores, 'security'), false);
    assert.equal(Object.hasOwn(r.scores, 'errorHandling'), false);
    // canonical nested block present
    assert.equal(r.scores.before.categories.security, 90);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compute-scores rejects invalid --as with exit 2', () => {
  const { dir, path } = tmpReport([]);
  try {
    let err;
    try {
      run(path, ['--as=foo']);
    } catch (e) {
      err = e;
    }
    assert.ok(err, 'expected non-zero exit');
    assert.equal(err.status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compute-scores exits 2 when report has no findings array', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cortexloop-cs-'));
  const path = join(dir, 'report.json');
  writeFileSync(path, JSON.stringify({ generatedBy: 'cortexloop', version: '2.2' }));
  try {
    let err;
    try {
      run(path, ['--as=before']);
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compute-scores exits 2 when report file is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cortexloop-cs-'));
  const path = join(dir, 'does-not-exist.json');
  try {
    let err;
    try {
      run(path, ['--as=before']);
    } catch (e) {
      err = e;
    }
    assert.ok(err);
    assert.equal(err.status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
