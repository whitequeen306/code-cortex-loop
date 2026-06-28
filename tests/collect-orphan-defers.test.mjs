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
  resolveDeferTarget,
} from '../scripts/lib/shared.mjs';

test('resolveDeferTarget accepts both passKey and category alias', () => {
  // Canonical passKey "review" resolves to step 1.
  const byKey = resolveDeferTarget('review');
  assert.equal(byKey.canonicalKey, 'review');
  assert.equal(byKey.step.order, 1);
  // Category alias "correctness" must resolve to the SAME canonical passKey.
  const byCat = resolveDeferTarget('correctness');
  assert.equal(byCat.canonicalKey, 'review');
  assert.equal(byCat.step.order, 1);
  // All other passKeys where passKey === category resolve unchanged.
  const sec = resolveDeferTarget('security');
  assert.equal(sec.canonicalKey, 'security');
  // Unknown key resolves to nothing.
  const unknown = resolveDeferTarget('nope');
  assert.equal(unknown.step, null);
  assert.equal(unknown.canonicalKey, null);
});

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

test('collectOrphanDefers accepts category alias "correctness" as defer target for step 1', () => {
  const dir = join(tmpdir(), `cortexloop-alias-${Date.now()}`);
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
        deferToLaterPasses: [],
      }),
    );
    // Expert wrote the category alias "correctness" instead of passKey "review".
    writeFileSync(
      join(handoffDir, '05-performance.json'),
      JSON.stringify({
        pass: 'performance',
        category: 'performance',
        expert: 'performance-analyst',
        summary: 'ok',
        findings: [baseFinding],
        deferToLaterPasses: [{ pass: 'correctness', note: 'Race on balance read at transfer()' }],
      }),
    );

    const result = collectOrphanDefers({ handoffDir, passesConfig: {} });
    // Alias must be normalized to canonical passKey "review", not dropped or warned.
    assert.equal(result.orphanCount, 1);
    assert.equal(result.orphans[0].targetPass, 'review');
    assert.equal(result.orphans[0].discoveredByPass, 'performance');
    assert.ok(result.byTarget.review);
    assert.equal(
      result.warnings.filter((w) => w.includes('unknown defer target') || w.includes('disabled pass')).length,
      0,
      `unexpected alias warnings: ${JSON.stringify(result.warnings)}`,
    );
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

test('collectOrphanDefers passes sourceLocation/sourceContext through to orphans (P-4)', () => {
  const dir = join(tmpdir(), `cortexloop-prov-${Date.now()}`);
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
        deferToLaterPasses: [],
      }),
    );
    // Expert attaches provenance to the defer so the target expert can jump to the site.
    writeFileSync(
      join(handoffDir, '05-performance.json'),
      JSON.stringify({
        pass: 'performance',
        category: 'performance',
        expert: 'performance-analyst',
        summary: 'ok',
        findings: [baseFinding],
        deferToLaterPasses: [
          {
            pass: 'review',
            note: 'Race on balance read at transfer()',
            sourceLocation: 'src/ledger.ts:88',
            sourceContext: 'transfer(amount, to)',
          },
        ],
      }),
    );

    const result = collectOrphanDefers({ handoffDir, passesConfig: {} });
    assert.equal(result.orphanCount, 1);
    const orphan = result.orphans[0];
    assert.equal(orphan.sourceLocation, 'src/ledger.ts:88');
    assert.equal(orphan.sourceContext, 'transfer(amount, to)');
    assert.equal(orphan.targetPass, 'review');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('collectOrphanDefers tolerates defers without sourceLocation (backward compatible)', () => {
  const dir = join(tmpdir(), `cortexloop-noprov-${Date.now()}`);
  const handoffDir = join(dir, '.cortexloop/handoff');
  mkdirSync(handoffDir, { recursive: true });

  try {
    writeFileSync(
      join(handoffDir, '01-correctness.json'),
      JSON.stringify({
        pass: 'review',
        category: 'correctness',
        expert: 'code-reviewer',
        summary: 'ok',
        findings: [],
      }),
    );
    // Old-style defer: only pass + note, no provenance fields.
    writeFileSync(
      join(handoffDir, '05-performance.json'),
      JSON.stringify({
        pass: 'performance',
        category: 'performance',
        expert: 'performance-analyst',
        summary: 'ok',
        findings: [],
        deferToLaterPasses: [{ pass: 'review', note: 'Race on balance' }],
      }),
    );

    const result = collectOrphanDefers({ handoffDir, passesConfig: {} });
    assert.equal(result.orphanCount, 1);
    assert.equal(result.orphans[0].sourceLocation, null);
    assert.equal(result.orphans[0].sourceContext, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
