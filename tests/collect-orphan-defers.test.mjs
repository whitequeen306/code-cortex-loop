import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  collectOrphanDefers,
  orphanDeferId,
  validateCrossValidation,
  validateCrossValidationEntry,
  validatePassHandoff,
} from '../scripts/lib/shared.mjs';

test('orphanDeferId is stable for same defer', () => {
  const id = orphanDeferId({
    targetPass: 'review',
    discoveredByPass: 'performance',
    note: 'Race on balance read',
  });
  assert.equal(id, orphanDeferId({
    targetPass: 'review',
    discoveredByPass: 'performance',
    note: 'Race on balance read',
  }));
  assert.match(id, /^review←performance:/);
});

test('collectOrphanDefers finds backward defers only', () => {
  const dir = join(tmpdir(), `cortexloop-orphan-${Date.now()}`);
  const handoffDir = join(dir, '.cortexloop/handoff');
  mkdirSync(handoffDir, { recursive: true });

  const baseFinding = {
    severity: 'High',
    location: 'src/a.ts:1',
    problem: 'x',
    evidence: 'y',
    confidence: 'high',
    recommendation: 'z',
    autoFixable: 'no',
  };

  try {
    writeFileSync(
      join(handoffDir, '01-correctness.json'),
      JSON.stringify({
        pass: 'review',
        category: 'correctness',
        expert: 'code-reviewer',
        summary: 'ok',
        findings: [],
        deferToLaterPasses: [{ pass: 'security', note: 'Check auth on endpoint' }],
      }),
    );
    writeFileSync(
      join(handoffDir, '05-performance.json'),
      JSON.stringify({
        pass: 'performance',
        category: 'performance',
        expert: 'performance-analyst',
        summary: 'ok',
        findings: [baseFinding],
        deferToLaterPasses: [{ pass: 'review', note: 'Race on balance read at transfer()' }],
      }),
    );

    const result = collectOrphanDefers({ handoffDir, passesConfig: {} });
    assert.equal(result.orphanCount, 1);
    assert.equal(result.orphans[0].targetPass, 'review');
    assert.equal(result.orphans[0].discoveredByPass, 'performance');
    assert.ok(result.byTarget.review);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validateCrossValidation passes when orphans resolved', () => {
  const dir = join(tmpdir(), `cortexloop-cv-${Date.now()}`);
  const handoffDir = join(dir, '.cortexloop/handoff');
  mkdirSync(handoffDir, { recursive: true });

  const orphan = {
    id: orphanDeferId({
      targetPass: 'review',
      discoveredByPass: 'performance',
      note: 'Race on balance',
    }),
    targetPass: 'review',
    discoveredByPass: 'performance',
    note: 'Race on balance',
  };

  try {
    writeFileSync(
      join(handoffDir, '01-correctness.json'),
      JSON.stringify({
        pass: 'review',
        category: 'correctness',
        expert: 'code-reviewer',
        summary: 'Catch-up applied',
        findings: [
          {
            severity: 'High',
            location: 'src/ledger.ts:88',
            problem: 'Race on balance',
            evidence: 'parallel transfer',
            confidence: 'high',
            recommendation: 'use row lock',
            autoFixable: 'no',
          },
        ],
        crossValidation: [
          {
            orphanId: orphan.id,
            discoveredByPass: 'performance',
            note: 'Race on balance',
            status: 'verified',
            findingLocation: 'src/ledger.ts:88',
            findingProblem: 'Race on balance',
          },
        ],
      }),
    );

    const result = validateCrossValidation({
      handoffDir,
      passesConfig: { review: true, security: false, tests: false, errorHandling: false, performance: true, simplicity: false, cleanup: false },
      orphans: [{ ...orphan, targetExpert: 'code-reviewer', targetHandoffFile: '.cortexloop/handoff/01-correctness.json' }],
    });
    assert.equal(result.ok, true);
    assert.equal(result.resolvedCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validateCrossValidationEntry requires rejectReason when rejected', () => {
  assert.match(
    validateCrossValidationEntry({
      orphanId: 'x',
      discoveredByPass: 'performance',
      note: 'n',
      status: 'rejected',
    }),
    /rejectReason/,
  );
});

test('validatePassHandoff accepts crossValidation array', () => {
  const err = validatePassHandoff({
    pass: 'review',
    category: 'correctness',
    expert: 'code-reviewer',
    summary: 'ok',
    findings: [],
    crossValidation: [
      {
        orphanId: 'review←performance:race',
        discoveredByPass: 'performance',
        note: 'race',
        status: 'rejected',
        rejectReason: 'Already covered in finding CL-001',
      },
    ],
  });
  assert.equal(err, null);
});
