import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_PLAYBOOK,
  loadLearningConfig,
  PLAYBOOK_DEFAULTS,
} from '../scripts/lib/shared.mjs';

// loadLearningConfig reads cortexloop.config.json relative to cwd, so we
// chdir into a temp project that has its own config file. Tests restore cwd
// on teardown. We DO NOT mutate the real repo's cortexloop.config.json.

let tmpRoot;
const savedCwd = process.cwd();

function setup(configJson) {
  tmpRoot = mkdtempSync(join(tmpdir(), 'clc-learning-'));
  writeFileSync(join(tmpRoot, 'cortexloop.config.json'), JSON.stringify(configJson, null, 2));
  process.chdir(tmpRoot);
}

function teardown() {
  process.chdir(savedCwd);
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
}

test('loadLearningConfig returns built-in defaults when config file missing', () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'clc-empty-'));
  process.chdir(tmpRoot);
  try {
    const cfg = loadLearningConfig();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.playbookPath, DEFAULT_PLAYBOOK);
    assert.equal(cfg.global, false);
    assert.equal(cfg.reflectOn, 'direct');
    assert.equal(cfg.queryVerifiedOnly, true);
    assert.deepEqual(cfg.prune, {
      minConfidence: 0.3,
      maxAgeDays: 180,
      maxEntries: 200,
      dropQuarantined: false,
    });
  } finally {
    teardown();
  }
});

test('loadLearningConfig returns defaults when learning block absent', () => {
  setup({ preset: 'default' });
  try {
    const cfg = loadLearningConfig();
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.playbookPath, DEFAULT_PLAYBOOK);
    assert.equal(cfg.global, false);
    assert.equal(cfg.queryVerifiedOnly, true);
    assert.equal(cfg.prune.maxConfidence ?? 'unset', 'unset', 'prune.maxConfidence is not a real key — PLAYBOOK_DEFAULTS, not learning.prune');
    assert.equal(cfg.prune.minConfidence, 0.3);
  } finally {
    teardown();
  }
});

test('loadLearningConfig reads learning.* keys', () => {
  setup({
    learning: {
      enabled: false,
      playbookPath: 'custom/playbook.json',
      global: true,
      reflectOn: 'direct',
      queryVerifiedOnly: false,
      prune: {
        minConfidence: 0.5,
        maxAgeDays: 90,
        maxEntries: 50,
        dropQuarantined: true,
      },
    },
  });
  try {
    const cfg = loadLearningConfig();
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.playbookPath, 'custom/playbook.json');
    assert.equal(cfg.global, true);
    assert.equal(cfg.queryVerifiedOnly, false);
    assert.equal(cfg.prune.minConfidence, 0.5);
    assert.equal(cfg.prune.maxAgeDays, 90);
    assert.equal(cfg.prune.maxEntries, 50);
    assert.equal(cfg.prune.dropQuarantined, true);
  } finally {
    teardown();
  }
});

test('loadLearningConfig omits tier/decay/outcome keys (still script-internal)', () => {
  setup({
    learning: {
      // These keys are deliberately NOT in the schema — documenting them
      // invited silent-ignored values. loadLearningConfig must not surface
      // them even if a user adds them to a hand-edited config.
      promoteConfidence: 0.99,
      decayPerDay: 0.5,
      someOutcomeWeight: 5,
    },
  });
  try {
    const cfg = loadLearningConfig();
    assert.equal(cfg.promoteConfidence, undefined);
    assert.equal(cfg.decayPerDay, undefined);
    assert.equal(cfg.someOutcomeWeight, undefined);
    // PLAYBOOK_DEFAULTS still drives tier math — config does not override.
    assert.equal(PLAYBOOK_DEFAULTS.promoteConfidence, 0.7);
    assert.equal(PLAYBOOK_DEFAULTS.decayPerDay, 0.01);
  } finally {
    teardown();
  }
});

test('loadLearningConfig treats omitted prune sub-keys with built-in defaults', () => {
  setup({ learning: { prune: { maxEntries: 10 } } });
  try {
    const cfg = loadLearningConfig();
    assert.equal(cfg.prune.maxEntries, 10);
    assert.equal(cfg.prune.minConfidence, 0.3, 'omitted → built-in default');
    assert.equal(cfg.prune.maxAgeDays, 180);
    assert.equal(cfg.prune.dropQuarantined, false);
  } finally {
    teardown();
  }
});
