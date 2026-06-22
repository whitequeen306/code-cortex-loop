import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findingFingerprint,
  validateReport,
  applyOutcome,
  recomputeTier,
  decayedConfidence,
  PLAYBOOK_DEFAULTS,
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
