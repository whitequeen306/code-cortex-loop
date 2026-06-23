import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASS_PIPELINE,
  PASS_KEYS,
  getEnabledPipeline,
  priorHandoffFiles,
  validatePassHandoff,
} from '../scripts/lib/shared.mjs';

test('PASS_PIPELINE has 7 steps in fixed order', () => {
  assert.equal(PASS_PIPELINE.length, 7);
  assert.deepEqual(
    PASS_PIPELINE.map((p) => p.order),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(PASS_KEYS, [
    'review',
    'security',
    'tests',
    'errorHandling',
    'performance',
    'simplicity',
    'cleanup',
  ]);
});

test('each pipeline step has contract paths', () => {
  for (const step of PASS_PIPELINE) {
    assert.match(step.passContract, /^passes\//);
    assert.match(step.categoryReport, /^docs\/cortexloop\//);
    assert.match(step.handoffFile, /^\.cortexloop\/handoff\//);
    assert.equal(step.agent, step.expert);
  }
});

test('getEnabledPipeline respects config.passes', () => {
  const enabled = getEnabledPipeline({
    review: true,
    security: true,
    tests: false,
    errorHandling: true,
    performance: false,
    simplicity: false,
    cleanup: false,
  });
  assert.deepEqual(
    enabled.map((p) => p.passKey),
    ['review', 'security', 'errorHandling'],
  );
});

test('priorHandoffFiles returns earlier handoffs only', () => {
  const step3 = PASS_PIPELINE.find((p) => p.passKey === 'tests');
  const priors = priorHandoffFiles(step3);
  assert.deepEqual(priors, [
    '.cortexloop/handoff/01-correctness.json',
    '.cortexloop/handoff/02-security.json',
  ]);
});

test('validatePassHandoff accepts valid handoff', () => {
  const err = validatePassHandoff({
    pass: 'security',
    category: 'security',
    expert: 'security-auditor',
    summary: 'Two SQL injection sites in api layer.',
    findings: [
      {
        severity: 'Critical',
        location: 'src/api.js:4',
        problem: 'SQL injection via string concat',
        evidence: 'userId interpolated into query string',
        confidence: 'high',
        recommendation: 'Use parameterized queries',
        autoFixable: 'yes',
      },
    ],
    deferToLaterPasses: [{ pass: 'tests', note: 'Add injection regression tests' }],
    openQuestions: [],
  });
  assert.equal(err, null);
});

test('validatePassHandoff rejects missing evidence', () => {
  const err = validatePassHandoff({
    pass: 'review',
    category: 'correctness',
    expert: 'code-reviewer',
    summary: 'ok',
    findings: [
      {
        severity: 'High',
        location: 'src/a.js:1',
        problem: 'bug',
        confidence: 'high',
        recommendation: 'fix',
        autoFixable: 'no',
      },
    ],
  });
  assert.match(err, /evidence/i);
});
