import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImportGraph,
  buildLongTailSample,
  buildScopeMapFromPaths,
  resolveImportSpec,
} from '../scripts/lib/scope-index.mjs';
import { scanFileForPatterns } from '../scripts/lib/scope-patterns.mjs';

const FIXTURE_PATHS = [
  'src/core/bus.ts',
  'src/core/util.ts',
  'src/auth/token.ts',
  'src/api/UserController.ts',
  'src/api/routes.ts',
  'src/data/sync.ts',
  'src/utils/format.ts',
  'tests/api.test.ts',
];

const FIXTURE_CONTENT = {
  'src/core/bus.ts': `
    import { util } from './util';
    export function emit() {}
  `,
  'src/core/util.ts': `export function util() {}`,
  'src/auth/token.ts': `
    const password = process.env.SECRET;
    export function signJwt() {}
  `,
  'src/api/UserController.ts': `
    import { emit } from '../core/bus';
    export class UserController {}
  `,
  'src/api/routes.ts': `import { UserController } from './UserController';`,
  'src/data/sync.ts': `export async function sync() {}`,
  'src/utils/format.ts': `export function fmt() {}`,
  'tests/api.test.ts': `describe('api', () => { it('works', () => {}); });`,
};

test('resolveImportSpec resolves relative imports within scope', () => {
  const pathSet = new Set(FIXTURE_PATHS);
  const resolved = resolveImportSpec('./util', 'src/core/bus.ts', pathSet, '.');
  assert.equal(resolved, 'src/core/util.ts');
});

test('buildImportGraph ranks bus.ts as import hub', () => {
  const graph = buildImportGraph(FIXTURE_PATHS, FIXTURE_CONTENT, '.');
  assert.ok(graph.inbound.get('src/core/bus.ts') >= 1);
  assert.ok(graph.edgesResolved >= 2);
});

test('scanFileForPatterns detects security hits in auth token file', () => {
  const hits = scanFileForPatterns(FIXTURE_CONTENT['src/auth/token.ts'], 'src/auth/token.ts');
  assert.ok(hits.security.length > 0);
  assert.ok(hits.security.includes('password') || hits.security.includes('jwt'));
});

test('buildScopeMapFromPaths puts hub directory in top hotspots', () => {
  const scopeMap = buildScopeMapFromPaths({
    paths: FIXTURE_PATHS,
    fileContents: FIXTURE_CONTENT,
    churnOverride: {
      fileScores: new Map([
        ['src/data/sync.ts', 5],
        ['src/auth/token.ts', 3],
      ]),
      dirScores: new Map([
        ['src/data', 5],
        ['src/auth', 3],
        ['src/api', 2],
        ['src/core', 2],
      ]),
      recentChangeFocus: ['src/data/sync.ts', 'src/auth/token.ts'],
    },
  });

  assert.equal(scopeMap.version, '2.3');
  assert.equal(scopeMap.generatedBy, 'cortexloop-scope-index');
  assert.equal(scopeMap.coveragePolicy, 'prioritize-with-sampling');
  assert.ok(scopeMap.hotspots.length > 0);
  const topPaths = scopeMap.hotspots.map((h) => h.path);
  assert.ok(topPaths.some((p) => p.startsWith('src/core') || p.startsWith('src/api')));
});

test('mustReview includes pattern hits and recent changes', () => {
  const scopeMap = buildScopeMapFromPaths({
    paths: FIXTURE_PATHS,
    fileContents: FIXTURE_CONTENT,
    churnOverride: {
      fileScores: new Map([['src/auth/token.ts', 2]]),
      dirScores: new Map([['src/auth', 2]]),
      recentChangeFocus: ['src/auth/token.ts'],
    },
  });

  assert.ok(scopeMap.mustReview.includes('src/auth/token.ts'));
  assert.ok(scopeMap.patternHits.security.includes('src/auth/token.ts'));
});

test('buildLongTailSample covers dirs outside hotspots', () => {
  const hotspotDirs = new Set(['src/core', 'src/api']);
  const sample = buildLongTailSample(FIXTURE_PATHS, hotspotDirs, 10);
  assert.ok(sample.includes('src/utils/format.ts') || sample.includes('src/data/sync.ts'));
  assert.ok(!sample.every((p) => p.startsWith('src/core') || p.startsWith('src/api')));
});

test('confidence decreases when import resolution is weak', () => {
  const sparsePaths = ['src/a.ts', 'src/b.ts'];
  const sparseContent = {
    'src/a.ts': `import x from 'unknown-package';`,
    'src/b.ts': `export const b = 1;`,
  };
  const scopeMap = buildScopeMapFromPaths({
    paths: sparsePaths,
    fileContents: sparseContent,
    churnOverride: {
      fileScores: new Map(),
      dirScores: new Map(),
      recentChangeFocus: [],
    },
  });
  assert.ok(scopeMap.confidence < 0.85);
  assert.equal(scopeMap.mapMode, 'deterministic');
});
