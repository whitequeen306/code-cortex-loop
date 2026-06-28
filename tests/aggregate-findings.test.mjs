import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  aggregateFindings,
  findingFingerprint,
  validateReport,
} from '../scripts/lib/shared.mjs';

function baseFinding(overrides = {}) {
  return {
    severity: 'High',
    location: 'src/api.js:4',
    problem: 'SQL injection via string concat',
    evidence: 'userId interpolated into query string',
    confidence: 'high',
    recommendation: 'Use parameterized queries',
    autoFixable: 'yes',
    ...overrides,
  };
}

function makeDir() {
  const dir = join(tmpdir(), `cortexloop-agg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(dir, '.cortexloop/handoff'), { recursive: true });
  return dir;
}

test('aggregateFindings dedupes cross-domain duplicates by fingerprint', () => {
  const dir = makeDir();
  const handoffDir = join(dir, '.cortexloop/handoff');
  try {
    const shared = baseFinding();
    writeFileSync(
      join(handoffDir, '01-correctness.json'),
      JSON.stringify({
        pass: 'review',
        category: 'correctness',
        expert: 'code-reviewer',
        summary: 'ok',
        findings: [shared],
      }),
    );
    // security flags the same fingerprint with a different (higher) severity
    writeFileSync(
      join(handoffDir, '02-security.json'),
      JSON.stringify({
        pass: 'security',
        category: 'security',
        expert: 'security-auditor',
        summary: 'ok',
        findings: [baseFinding({ severity: 'Critical' })],
      }),
    );

    const result = aggregateFindings({ handoffDir, passesConfig: {} });
    assert.equal(result.findings.length, 1, 'duplicate must collapse to one');
    // Critical wins over High during representative selection
    assert.equal(result.findings[0].severity, 'Critical');
    // evidence/confidence carried through
    assert.equal(result.findings[0].evidence, shared.evidence);
    assert.equal(result.findings[0].confidence, 'high');
    // provenance: representative pass first, other discoverers in sources
    assert.equal(result.findings[0].provenance.pass, 'security');
    assert.equal(result.findings[0].provenance.expert, 'security-auditor');
    assert.equal(result.findings[0].provenance.sources.length, 1);
    assert.equal(result.findings[0].provenance.sources[0].pass, 'review');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aggregateFindings preserves distinct fingerprints separately', () => {
  const dir = makeDir();
  const handoffDir = join(dir, '.cortexloop/handoff');
  try {
    writeFileSync(
      join(handoffDir, '01-correctness.json'),
      JSON.stringify({
        pass: 'review',
        category: 'correctness',
        expert: 'code-reviewer',
        summary: 'ok',
        findings: [
          baseFinding({ location: 'src/a.js:1', problem: 'null deref' }),
          baseFinding({ location: 'src/b.js:2', problem: 'off-by-one' }),
        ],
      }),
    );

    const result = aggregateFindings({ handoffDir, passesConfig: {} });
    assert.equal(result.findings.length, 2);
    // sorted by severity desc (both High here), then by location asc
    assert.deepEqual(
      result.findings.map((f) => f.location),
      ['src/a.js:1', 'src/b.js:2'],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aggregateFindings attaches orphanId when finding came from Step 3.5 recycle', () => {
  const dir = makeDir();
  const handoffDir = join(dir, '.cortexloop/handoff');
  try {
    // Step 3.5 recycle added a finding to the review pass handoff at the orphan's source location
    writeFileSync(
      join(handoffDir, '01-correctness.json'),
      JSON.stringify({
        pass: 'review',
        category: 'correctness',
        expert: 'code-reviewer',
        summary: 'catch-up',
        findings: [baseFinding({ location: 'src/ledger.ts:88', problem: 'Race on balance' })],
        crossValidation: [],
      }),
    );

    const orphans = [
      {
        id: 'review←performance:race-on-balance',
        targetPass: 'review',
        discoveredByPass: 'performance',
        sourceLocation: 'src/ledger.ts:88',
        note: 'Race on balance',
      },
    ];

    const result = aggregateFindings({ handoffDir, passesConfig: {}, orphans });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].provenance.orphanId, 'review←performance:race-on-balance');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aggregateFindings skips missing handoff files without throwing', () => {
  const dir = makeDir();
  const handoffDir = join(dir, '.cortexloop/handoff');
  try {
    // only one of seven handoffs present
    writeFileSync(
      join(handoffDir, '02-security.json'),
      JSON.stringify({
        pass: 'security',
        category: 'security',
        expert: 'security-auditor',
        summary: 'ok',
        findings: [baseFinding()],
      }),
    );

    const result = aggregateFindings({ handoffDir, passesConfig: {} });
    assert.equal(result.findings.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aggregated findings pass validateReport when wrapped in a report', () => {
  const dir = makeDir();
  const handoffDir = join(dir, '.cortexloop/handoff');
  try {
    writeFileSync(
      join(handoffDir, '02-security.json'),
      JSON.stringify({
        pass: 'security',
        category: 'security',
        expert: 'security-auditor',
        summary: 'ok',
        findings: [baseFinding()],
      }),
    );

    const result = aggregateFindings({ handoffDir, passesConfig: {} });
    // orchestrator assigns CL-001 after aggregation
    const findings = result.findings.map((f, i) => ({ ...f, id: `CL-${String(i + 1).padStart(3, '0')}` }));
    const report = {
      version: '2.2',
      generatedBy: 'cortexloop',
      timestamp: new Date().toISOString(),
      preset: 'default',
      scope: 'recent',
      mode: 'report',
      scores: { before: { overall: 50 }, after: { overall: 50 } },
      findings,
      summary: { found: { High: 1 }, fixed: {}, deferred: {}, suppressed: 0 },
    };
    const err = validateReport(report);
    assert.equal(err, null, `validateReport should accept aggregated findings: ${err}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aggregation and baseline share the same fingerprint definition', () => {
  // This is the core invariant L-4 enforces: dedup during aggregation and
  // ratchet during baseline diff must agree on "same finding".
  const f = baseFinding();
  const direct = findingFingerprint(f);
  // simulate what aggregateFindings does internally: same f -> same fp
  const viaAggregate = (() => {
    const dir = makeDir();
    const handoffDir = join(dir, '.cortexloop/handoff');
    try {
      writeFileSync(
        join(handoffDir, '02-security.json'),
        JSON.stringify({
          pass: 'security',
          category: 'security',
          expert: 'security-auditor',
          summary: 'ok',
          findings: [f],
        }),
      );
      // pull the fingerprint back out via the public API by re-deriving from
      // the representative finding (aggregateFindings does not expose fps,
      // but the representative is the same object so its fp is unchanged)
      const r = aggregateFindings({ handoffDir, passesConfig: {} });
      return findingFingerprint(r.findings[0]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  })();
  assert.equal(direct, viaAggregate);
});
