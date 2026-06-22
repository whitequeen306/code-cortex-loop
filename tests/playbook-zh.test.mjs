import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  playbookZhPathFrom,
  renderPlaybookZhMarkdown,
  savePlaybookZh,
  DEFAULT_PLAYBOOK,
  DEFAULT_PLAYBOOK_ZH,
} from '../scripts/lib/shared.mjs';

test('playbookZhPathFrom pairs with playbook.json', () => {
  assert.equal(
    playbookZhPathFrom('.cortexloop/playbook.json'),
    '.cortexloop/playbook-zh.md',
  );
  assert.equal(
    playbookZhPathFrom('/home/user/.cortexloop/playbook.json'),
    '/home/user/.cortexloop/playbook-zh.md',
  );
});

test('renderPlaybookZhMarkdown uses Chinese fields and tier sections', () => {
  const md = renderPlaybookZhMarkdown({
    updatedAt: '2026-06-22T00:00:00.000Z',
    entries: [
      {
        id: 'PB-001',
        signature: 'perf-n-plus-one',
        category: 'performance',
        tier: 'verified',
        problemPattern: 'N+1 query in loop',
        fixMethod: 'Batch fetch with IN clause',
        problemPatternZh: '循环内 N+1 查询',
        fixMethodZh: '先收集 id，再用 IN 批量查询',
        confidence: 0.85,
        verifiedCount: 3,
        distinctContexts: ['api', 'jobs'],
        examples: ['src/api.js:6'],
      },
      {
        id: 'PB-002',
        signature: 'sec-sql-injection',
        category: 'security',
        tier: 'candidate',
        problemPattern: 'Raw SQL concatenation',
        fixMethod: 'Parameterized queries',
        confidence: 0.4,
        verifiedCount: 0,
        distinctContexts: [],
      },
    ],
  });

  assert.match(md, /仅供阅读/);
  assert.match(md, /不会.*playbook\.mjs query/);
  assert.match(md, /## ✅ 已验证模式/);
  assert.match(md, /循环内 N\+1 查询/);
  assert.match(md, /问题（英文，供模型）/);
  assert.match(md, /## ⚠️ 候选模式/);
  assert.match(md, /PB-002/);
  assert.match(md, /Raw SQL concatenation/);
});

test('savePlaybookZh writes markdown next to playbook.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cortexloop-zh-'));
  const playbookPath = join(dir, 'playbook.json');
  const playbook = {
    version: '2.2',
    updatedAt: '2026-06-22T00:00:00.000Z',
    entries: [
      {
        id: 'PB-001',
        signature: 'test-sig',
        category: 'tests',
        tier: 'verified',
        problemPattern: 'Missing assertion',
        fixMethod: 'Add explicit expect',
        problemPatternZh: '缺少断言',
        fixMethodZh: '补充明确的 expect',
        confidence: 0.8,
        verifiedCount: 2,
        distinctContexts: ['unit'],
      },
    ],
  };

  try {
    const zhPath = savePlaybookZh(playbookPath, playbook);
    assert.equal(zhPath, join(dir, 'playbook-zh.md'));
    const body = readFileSync(zhPath, 'utf8');
    assert.match(body, /缺少断言/);
    assert.match(body, /PB-001/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('DEFAULT_PLAYBOOK_ZH constant matches derived path', () => {
  assert.equal(playbookZhPathFrom(DEFAULT_PLAYBOOK), DEFAULT_PLAYBOOK_ZH);
});
