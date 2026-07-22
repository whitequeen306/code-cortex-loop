import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findingFingerprint,
  validateReport,
  applyOutcome,
  recomputeTier,
  decayedConfidence,
  PLAYBOOK_DEFAULTS,
  REVIEW_PRESETS,
  getPresetPasses,
  normalizeReviewPreset,
  assessReviewRisk,
  recommendPresetForRisk,
  buildReviewRunPlan,
  resolveReviewPreset,
  passesConfigForRunPlan,
  CATEGORIES,
  computeScores,
  normalizeCategory,
  getCategoryScores,
} from '../scripts/lib/shared.mjs';

test('findingFingerprint differs by line number', () => {
  const base = { category: 'security', problem: 'SQL injection in query' };
  const a = findingFingerprint({ ...base, location: 'src/api.js:4' });
  const b = findingFingerprint({ ...base, location: 'src/api.js:14' });
  assert.notEqual(a, b);
});

test('findingFingerprint differs by full problem text', () => {
  const base = { category: 'security', location: 'src/api.js:4' };
  const a = findingFingerprint({ ...base, problem: 'SQL injection in getUserPosts' });
  const b = findingFingerprint({ ...base, problem: 'SQL injection in createUser' });
  assert.notEqual(a, b);
});

test('validateReport requires generatedBy cortexloop', () => {
  assert.match(
    validateReport({ version: '2.2', findings: [], scores: {} }),
    /generatedBy/,
  );
  assert.equal(
    validateReport({ version: '2.2', generatedBy: 'cortexloop', findings: [], scores: {} }),
    null,
  );
});

test('validateReport rejects invalid severity', () => {
  const err = validateReport({
    version: '2.2',
    generatedBy: 'cortexloop',
    scores: {},
    findings: [{ severity: 'Urgent', category: 'tests' }],
  });
  assert.match(err, /severity/i);
});

test('applyOutcome promotes with diverse verified contexts', () => {
  const entry = {
    tier: 'candidate',
    confidence: PLAYBOOK_DEFAULTS.newConfidence,
    verifiedCount: 0,
    distinctContexts: [],
  };
  applyOutcome(entry, 'external_verified', { context: 'project-a' });
  applyOutcome(entry, 'external_verified', { context: 'project-b' });
  entry.confidence = 0.75;
  entry.tier = recomputeTier(entry);
  assert.equal(entry.tier, 'verified');
});

test('decayedConfidence drops when entry is stale', () => {
  const entry = {
    confidence: 0.8,
    lastValidated: new Date(Date.now() - 30 * 86400000).toISOString(),
  };
  const decayed = decayedConfidence(entry);
  assert.ok(decayed < entry.confidence);
});

test('review presets map to expected pass keys', () => {
  assert.deepEqual(REVIEW_PRESETS.lite.passes, ['review', 'security', 'errorHandling']);
  assert.deepEqual(REVIEW_PRESETS.standard.passes, ['review', 'security', 'tests', 'errorHandling']);
  assert.deepEqual(REVIEW_PRESETS.full.passes, ['review', 'security', 'tests', 'errorHandling', 'performance', 'simplicity', 'cleanup']);
});

test('getPresetPasses returns a copy so callers cannot mutate preset definitions', () => {
  const passes = getPresetPasses('lite');
  passes.push('cleanup');
  assert.deepEqual(getPresetPasses('lite'), ['review', 'security', 'errorHandling']);
});

test('normalizeReviewPreset accepts aliases and rejects invalid presets', () => {
  assert.equal(normalizeReviewPreset('quick'), 'lite');
  assert.equal(normalizeReviewPreset('deep'), 'full');
  assert.equal(normalizeReviewPreset('STANDARD'), 'standard');
  assert.throws(() => normalizeReviewPreset('maximum'), /preset/i);
});

test('assessReviewRisk recommends lite for tiny documentation changes', () => {
  const risk = assessReviewRisk({
    changedFiles: ['README.md'],
    changedLines: 12,
    hasImplementationChanges: false,
    hasTestChanges: false,
  });
  assert.equal(risk.score, 0);
  assert.equal(risk.level, 'low');
  assert.equal(risk.recommendedPreset, 'lite');
  assert.deepEqual(risk.reasons, []);
});

test('assessReviewRisk recommends standard for medium implementation changes without tests', () => {
  const risk = assessReviewRisk({
    changedFiles: ['src/api/users.ts', 'src/ui/users.tsx'],
    changedLines: 340,
    hasImplementationChanges: true,
    hasTestChanges: false,
  });
  assert.equal(risk.level, 'medium');
  assert.equal(risk.recommendedPreset, 'standard');
  assert.ok(risk.reasons.includes('changed lines > 300'));
  assert.ok(risk.reasons.includes('api/controller/route path touched'));
  assert.ok(risk.reasons.includes('implementation changed but no tests changed'));
});

test('assessReviewRisk recommends full for high-risk auth and migration changes', () => {
  const risk = assessReviewRisk({
    changedFiles: ['src/auth/session.ts', 'db/migrations/20260707_users.sql'],
    changedLines: 920,
    hasImplementationChanges: true,
    hasTestChanges: false,
    crossModuleChange: true,
  });
  assert.equal(risk.level, 'high');
  assert.equal(risk.recommendedPreset, 'full');
  assert.ok(risk.score >= 7);
  assert.ok(risk.reasons.includes('auth/permission/session/token path touched'));
  assert.ok(risk.reasons.includes('database/migration/schema path touched'));
});

test('recommendPresetForRisk maps score thresholds', () => {
  assert.equal(recommendPresetForRisk(2).preset, 'lite');
  assert.equal(recommendPresetForRisk(3).preset, 'standard');
  assert.equal(recommendPresetForRisk(6).preset, 'standard');
  assert.equal(recommendPresetForRisk(7).preset, 'full');
});

test('resolveReviewPreset uses auto recommendation when uncapped', () => {
  const result = resolveReviewPreset({
    requestedPreset: 'auto',
    recommendedPreset: 'full',
    maxPreset: 'full',
  });
  assert.equal(result.preset, 'full');
  assert.equal(result.reason, 'recommended');
});

test('resolveReviewPreset respects maxPreset budget cap', () => {
  const result = resolveReviewPreset({
    requestedPreset: 'auto',
    recommendedPreset: 'full',
    maxPreset: 'standard',
  });
  assert.equal(result.preset, 'standard');
  assert.equal(result.reason, 'budget.maxPreset=standard');
});

test('buildReviewRunPlan normalizes decisions into enabled passes and cost', () => {
  const plan = buildReviewRunPlan({
    mode: 'direct',
    scope: 'recent',
    requestedPreset: 'auto',
    maxPreset: 'standard',
    directFixFloor: 'Medium',
    risk: {
      score: 8,
      level: 'high',
      recommendedPreset: 'full',
      reasons: ['auth/permission/session/token path touched'],
    },
  });
  assert.equal(plan.mode, 'direct');
  assert.equal(plan.scope, 'recent');
  assert.equal(plan.preset, 'standard');
  assert.equal(plan.recommendedPreset, 'full');
  assert.equal(plan.selectionReason, 'budget.maxPreset=standard');
  assert.deepEqual(plan.enabledPasses, ['review', 'security', 'tests', 'errorHandling']);
  assert.deepEqual(plan.skippedPasses, ['performance', 'simplicity', 'cleanup']);
  assert.equal(plan.cost.level, 'medium');
  assert.equal(plan.cost.estimatedPasses, 4);
  assert.equal(plan.directFixFloor, 'Medium');
});

test('passesConfigForRunPlan disables skipped passes for post-processing scripts', () => {
  const passesConfig = passesConfigForRunPlan({
    enabledPasses: ['review', 'security', 'errorHandling'],
  });
  assert.deepEqual(passesConfig, {
    review: true,
    security: true,
    tests: false,
    errorHandling: true,
    performance: false,
    simplicity: false,
    cleanup: false,
  });
});

// ── computeScores: deterministic health score (spec: cortexloop-workflow.mdc) ──
// 7 categories. category_score = max(0, 100 - sum(per-open-finding penalty)).
// overall = weighted average: security & correctness weight 1.5x, others 1x.
// Penalties: Critical -25, High -10, Medium -4, Low -1, Info 0.
// Denominator = 1.5 + 1.5 + 1*5 = 8.

test('computeScores: empty findings give 100 overall and 100 per category', () => {
  const { overall, categories } = computeScores([]);
  assert.equal(overall, 100);
  for (const c of CATEGORIES) assert.equal(categories[c], 100);
});

test('computeScores: one Critical in correctness drops that category to 75', () => {
  const { overall, categories } = computeScores([
    { category: 'correctness', severity: 'Critical', status: 'open' },
  ]);
  assert.equal(categories.correctness, 75);
  // (75*1.5 + 100*1.5 + 100*5) / 8 = 762.5/8 = 95.3 -> 95
  assert.equal(overall, 95);
});

test('computeScores: 1.5x weighting makes security & correctness Criticals cost more than performance', () => {
  const sec = computeScores([{ category: 'security', severity: 'Critical', status: 'open' }]);
  const cor = computeScores([{ category: 'correctness', severity: 'Critical', status: 'open' }]);
  const perf = computeScores([{ category: 'performance', severity: 'Critical', status: 'open' }]);
  // security & correctness weighted 1.5x -> identical overall
  assert.equal(sec.overall, cor.overall);
  assert.equal(sec.overall, 95);
  // performance weighted 1x -> penalty diluted, higher overall
  // (100*1.5 + 100*1.5 + 75*1 + 100*4) / 8 = 775/8 = 96.9 -> 97
  assert.equal(perf.overall, 97);
});

test('computeScores: category score is floored at 0 (never negative)', () => {
  const five = Array.from({ length: 5 }, () => ({ category: 'correctness', severity: 'Critical', status: 'open' }));
  const { overall, categories } = computeScores(five);
  assert.equal(categories.correctness, 0);
  // (0*1.5 + 100*1.5 + 100*5) / 8 = 650/8 = 81.25 -> 81
  assert.equal(overall, 81);
});

test('computeScores: fixed and suppressed findings are not counted', () => {
  const { overall, categories } = computeScores([
    { category: 'correctness', severity: 'Critical', status: 'fixed' },
    { category: 'security', severity: 'High', status: 'suppressed' },
  ]);
  assert.equal(overall, 100);
  assert.equal(categories.correctness, 100);
  assert.equal(categories.security, 100);
});

test('computeScores: findings with no status default to open (counted)', () => {
  const { categories } = computeScores([
    { category: 'tests', severity: 'Medium' },
  ]);
  assert.equal(categories.tests, 96);
});

test('computeScores: Info severity has zero penalty', () => {
  const { categories } = computeScores([
    { category: 'tests', severity: 'Info', status: 'open' },
  ]);
  assert.equal(categories.tests, 100);
});

test('computeScores: unknown category is skipped without throwing', () => {
  const { overall } = computeScores([
    { category: 'nope', severity: 'Critical', status: 'open' },
  ]);
  assert.equal(overall, 100);
});

test('computeScores: normalizes kebab-case "error-handling" to errorHandling (real LianYu findings use kebab)', () => {
  // The LianYu-PC report.json writes category as "error-handling"; this MUST
  // count toward the errorHandling bucket, not be silently dropped.
  const { categories } = computeScores([
    { category: 'error-handling', severity: 'Critical', status: 'open' },
  ]);
  assert.equal(categories.errorHandling, 75);
  assert.equal(categories['error-handling'], undefined); // canonical key only
});

test('computeScores: normalizes snake_case category too', () => {
  const { categories } = computeScores([
    { category: 'error_handling', severity: 'High', status: 'open' },
  ]);
  assert.equal(categories.errorHandling, 90);
});

test('normalizeCategory: unknown returns null, canonical passes through', () => {
  assert.equal(normalizeCategory('correctness'), 'correctness');
  assert.equal(normalizeCategory('error-handling'), 'errorHandling');
  assert.equal(normalizeCategory('nope'), null);
  assert.equal(normalizeCategory(123), null);
});

// ── getCategoryScores: must read the nested shape compute-scores.mjs writes ──

test('getCategoryScores reads new nested scores.before.categories shape', () => {
  const report = {
    scores: {
      before: {
        overall: 28,
        categories: {
          correctness: 0, security: 55, performance: 22,
          simplicity: 39, tests: 0, errorHandling: 0, cleanup: 81,
        },
        computedBy: 'cortexloop-compute-scores',
      },
    },
  };
  const cats = getCategoryScores(report);
  assert.equal(cats.security, 55);
  assert.equal(cats.correctness, 0);
  assert.equal(cats.cleanup, 81);
  assert.equal(cats.errorHandling, 0);
});

test('getCategoryScores still reads legacy flat shape (backward compat)', () => {
  const report = {
    scores: {
      before: {
        overall: 50,
        correctness: 80, security: 70, performance: 90,
        simplicity: 85, tests: 60, errorHandling: 75, cleanup: 95,
      },
    },
  };
  const cats = getCategoryScores(report);
  assert.equal(cats.security, 70);
  assert.equal(cats.correctness, 80);
  assert.equal(cats.errorHandling, 75);
});

test('getCategoryScores prefers after over before when both present', () => {
  const report = {
    scores: {
      after: {
        overall: 84,
        categories: { correctness: 88, security: 75, performance: 72, simplicity: 79, tests: 92, errorHandling: 100, cleanup: 81 },
      },
      before: {
        overall: 28,
        categories: { correctness: 0, security: 55, performance: 22, simplicity: 39, tests: 0, errorHandling: 0, cleanup: 81 },
      },
    },
  };
  const cats = getCategoryScores(report);
  assert.equal(cats.correctness, 88); // after wins
});
