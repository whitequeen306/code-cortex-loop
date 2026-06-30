import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DIRECT_FIX_FLOOR,
  filterFindingsForDirectFix,
  loadDirectConfig,
  normalizeDirectFixFloor,
  severityMeetsDirectFixFloor,
} from '../scripts/lib/shared.mjs';

test('normalizeDirectFixFloor defaults to High', () => {
  assert.equal(normalizeDirectFixFloor(undefined), 'High');
  assert.equal(normalizeDirectFixFloor('high'), 'High');
  assert.equal(normalizeDirectFixFloor('Medium'), 'Medium');
  assert.equal(normalizeDirectFixFloor('low'), 'Low');
});

test('normalizeDirectFixFloor rejects invalid values', () => {
  assert.throws(() => normalizeDirectFixFloor('Critical'), /Invalid direct fix floor/);
});

test('severityMeetsDirectFixFloor High tier', () => {
  assert.equal(severityMeetsDirectFixFloor('Critical', 'High'), true);
  assert.equal(severityMeetsDirectFixFloor('High', 'High'), true);
  assert.equal(severityMeetsDirectFixFloor('Medium', 'High'), false);
  assert.equal(severityMeetsDirectFixFloor('Low', 'High'), false);
  assert.equal(severityMeetsDirectFixFloor('Info', 'High'), false);
});

test('severityMeetsDirectFixFloor Medium tier', () => {
  assert.equal(severityMeetsDirectFixFloor('Medium', 'Medium'), true);
  assert.equal(severityMeetsDirectFixFloor('Low', 'Medium'), false);
});

test('severityMeetsDirectFixFloor Low tier includes Low', () => {
  assert.equal(severityMeetsDirectFixFloor('Low', 'Low'), true);
  assert.equal(severityMeetsDirectFixFloor('Info', 'Low'), false);
});

test('filterFindingsForDirectFix', () => {
  const findings = [
    { id: 'CL-001', severity: 'Critical' },
    { id: 'CL-002', severity: 'High' },
    { id: 'CL-003', severity: 'Medium' },
    { id: 'CL-004', severity: 'Low' },
    { id: 'CL-005', severity: 'Info' },
  ];
  assert.deepEqual(
    filterFindingsForDirectFix(findings, 'High').map((f) => f.id),
    ['CL-001', 'CL-002'],
  );
  assert.deepEqual(
    filterFindingsForDirectFix(findings, 'Medium').map((f) => f.id),
    ['CL-001', 'CL-002', 'CL-003'],
  );
  assert.deepEqual(
    filterFindingsForDirectFix(findings, 'Low').map((f) => f.id),
    ['CL-001', 'CL-002', 'CL-003', 'CL-004'],
  );
});

test('loadDirectConfig uses default when config missing', () => {
  const cfg = loadDirectConfig('nonexistent-cortexloop-config.json');
  assert.equal(cfg.fixFloor, DEFAULT_DIRECT_FIX_FLOOR);
});
