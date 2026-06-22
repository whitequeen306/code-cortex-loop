import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ciGate = join(root, 'scripts', 'ci-gate.mjs');
const fixture = (name) => join(root, 'tests', 'fixtures', name);

function runGate(args) {
  return spawnSync(process.execPath, [ciGate, ...args], {
    encoding: 'utf8',
    cwd: root,
  });
}

test('ci-gate passes clean report', () => {
  const r = runGate([fixture('report-pass.json')]);
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test('ci-gate exit 1 on Critical', () => {
  const r = runGate([fixture('report-critical.json')]);
  assert.equal(r.status, 1);
});

test('ci-gate exit 2 when High exceeds max-high', () => {
  const r = runGate([fixture('report-high.json'), '--max-high=0']);
  assert.equal(r.status, 2);
});

test('ci-gate exit 3 without generatedBy', () => {
  const r = runGate([fixture('report-no-provenance.json')]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /generatedBy/i);
});

test('ci-gate baseline mode gates on new findings only', () => {
  const report = fixture('report-pass.json');
  const diff = fixture('baseline-diff.json');
  const r = runGate([report, '--baseline', `--baseline-diff=${diff}`, '--max-high=0']);
  assert.equal(r.status, 2, r.stderr || r.stdout);
  assert.match(r.stdout, /Baseline mode/i);
});

test('ci-gate rejects invalid max-high', () => {
  const r = runGate([fixture('report-pass.json'), '--max-high=abc']);
  assert.equal(r.status, 3);
});
