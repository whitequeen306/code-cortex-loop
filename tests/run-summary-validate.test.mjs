import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateHandoffs } from '../scripts/validate-handoffs.mjs';
import { summarizeRun } from '../scripts/run-summary.mjs';
import { TOOL_TASK_SUPPORT, TOOLS_WITH_FULL_TASK_SUPPORT, TOOLS_WITH_NATIVE_AGENT_SUPPORT, TOOLS_WITH_PARTIAL_SUPPORT, PASS_AGENT_NAMES, OPENCODE_AGENT_NAMES } from '../scripts/lib/shared.mjs';

test('validateHandoffs passes when all enabled handoffs exist and valid', () => {
  const dir = join(tmpdir(), `cortexloop-vh-${Date.now()}`);
  const handoffDir = join(dir, '.cortexloop/handoff');
  mkdirSync(handoffDir, { recursive: true });

  const handoff = {
    pass: 'review',
    category: 'correctness',
    expert: 'code-reviewer',
    summary: 'ok',
    findings: [],
    deferToLaterPasses: [],
    openQuestions: [],
  };

  try {
    writeFileSync(join(handoffDir, '01-correctness.json'), JSON.stringify(handoff));
    const result = validateHandoffs({
      handoffDir,
      passesConfig: {
        review: true,
        security: false,
        tests: false,
        errorHandling: false,
        performance: false,
        simplicity: false,
        cleanup: false,
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.validatedCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('validateHandoffs fails when handoff missing', () => {
  const result = validateHandoffs({
    handoffDir: '.cortexloop/handoff-nonexistent',
    passesConfig: { review: true, security: false, tests: false, errorHandling: false, performance: false, simplicity: false, cleanup: false },
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.type === 'missing'));
});

test('summarizeRun counts executed passes from chokidar case study', () => {
  const base = 'examples/case-studies/chokidar';
  if (!existsSync(join(base, '.cortexloop/handoff/01-correctness.json'))) {
    return; // skip if case study not present
  }
  const summary = summarizeRun({
    handoffDir: join(base, '.cortexloop/handoff'),
    passesConfig: {},
  });
  assert.ok(summary.executedPassCount >= 3);
  assert.ok(summary.estimatedTotalTokens > 0);
});

test('TOOL_TASK_SUPPORT marks cursor and claude as full', () => {
  assert.equal(TOOL_TASK_SUPPORT.cursor, 'full');
  assert.equal(TOOL_TASK_SUPPORT.claude, 'full');
  assert.equal(TOOL_TASK_SUPPORT.opencode, 'full');
  assert.ok(TOOLS_WITH_FULL_TASK_SUPPORT.includes('cursor'));
  assert.ok(TOOLS_WITH_FULL_TASK_SUPPORT.includes('opencode'));
  assert.ok(!TOOLS_WITH_FULL_TASK_SUPPORT.includes('codex'));
});

test('PASS_AGENT_NAMES aligns with pipeline experts', () => {
  assert.equal(PASS_AGENT_NAMES.review, 'code-reviewer');
  assert.equal(PASS_AGENT_NAMES.performance, 'performance-analyst');
  assert.equal(PASS_AGENT_NAMES.security, 'security-auditor');
  assert.equal(PASS_AGENT_NAMES.cleanup, 'cleanup-curator');
  assert.equal(OPENCODE_AGENT_NAMES.review, PASS_AGENT_NAMES.review);
});

test('TOOL_TASK_SUPPORT marks qoder as native', () => {
  assert.equal(TOOL_TASK_SUPPORT.qoder, 'native');
  assert.ok(TOOLS_WITH_NATIVE_AGENT_SUPPORT.includes('qoder'));
});

test('TOOL_TASK_SUPPORT marks trae and codex as partial', () => {
  assert.equal(TOOL_TASK_SUPPORT.trae, 'partial');
  assert.equal(TOOL_TASK_SUPPORT.codex, 'partial');
  assert.ok(TOOLS_WITH_PARTIAL_SUPPORT.includes('trae'));
  assert.ok(TOOLS_WITH_PARTIAL_SUPPORT.includes('codex'));
  assert.ok(!TOOLS_WITH_FULL_TASK_SUPPORT.includes('codex'));
});
