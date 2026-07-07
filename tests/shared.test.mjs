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
