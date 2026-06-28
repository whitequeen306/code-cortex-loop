import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndexStrategy } from '../scripts/lib/shared.mjs';
import { buildScopeMapFromPaths, scanSymbolHints } from '../scripts/lib/scope-index.mjs';

const scopeCfg = {
  mapThreshold: 100,
  smallScopeThreshold: 50,
  deepIndexFileThreshold: 300,
  deepIndexTopHotspots: 15,
  hotspotSymbolHintFiles: 8,
  mapEnrichThreshold: 0.7,
  longTailSampleCount: 20,
  mapWeights: { churn: 0.3, importHub: 0.3, density: 0.2, patterns: 0.2 },
  exclude: [],
  mode: null,
};

test('buildIndexStrategy L0 for small scope without map', () => {
  const strategy = buildIndexStrategy({
    fileCount: 40,
    scopeCfg,
    scopeMap: null,
    pathsOut: '.cortexloop/scope-paths.json',
    mapOut: '.cortexloop/scope-map.json',
  });
  assert.equal(strategy.tier, 'L0');
  assert.equal(strategy.tierMax, 'L1');
  assert.equal(strategy.optionalDeepIndex.required, false);
  assert.equal(strategy.optionalDeepIndex.suggested, false);
});

test('buildIndexStrategy L1 guaranteed for large scope — codegraph still optional', () => {
  const scopeMap = {
    confidence: 0.85,
    mapEnrichRecommended: false,
    hotspots: [{ path: 'src/core' }, { path: 'src/api' }],
  };
  const strategy = buildIndexStrategy({
    fileCount: 150,
    scopeCfg,
    scopeMap,
    pathsOut: '.cortexloop/scope-paths.json',
    mapOut: '.cortexloop/scope-map.json',
  });
  assert.equal(strategy.tier, 'L1');
  assert.ok(strategy.guaranteed.L1);
  assert.equal(strategy.optionalDeepIndex.required, false);
  assert.deepEqual(strategy.optionalDeepIndex.deepIndexTargets, ['src/core', 'src/api']);
});

test('buildIndexStrategy suggests optional codegraph for huge or low-confidence scope', () => {
  const lowConfMap = { confidence: 0.55, mapEnrichRecommended: true, hotspots: [] };
  const strategy = buildIndexStrategy({
    fileCount: 150,
    scopeCfg,
    scopeMap: lowConfMap,
    pathsOut: 'p.json',
    mapOut: 'm.json',
  });
  assert.equal(strategy.optionalDeepIndex.suggested, true);

  const huge = buildIndexStrategy({
    fileCount: 400,
    scopeCfg,
    scopeMap: { confidence: 0.9, mapEnrichRecommended: false, hotspots: [] },
    pathsOut: 'p.json',
    mapOut: 'm.json',
  });
  assert.equal(huge.optionalDeepIndex.suggested, true);
});

test('scanSymbolHints extracts export names', () => {
  const content = `
    export function emit() {}
    export class Bus {}
    export const VERSION = 1;
  `;
  const symbols = scanSymbolHints(content);
  assert.ok(symbols.includes('emit'));
  assert.ok(symbols.includes('Bus'));
  assert.ok(symbols.includes('VERSION'));
});

test('buildScopeMapFromPaths includes hotspotSymbolHints', () => {
  const paths = ['src/core/bus.ts', 'src/core/util.ts', 'src/api/routes.ts'];
  const fileContents = {
    'src/core/bus.ts': 'export function emit() {}\nexport class EventBus {}',
    'src/core/util.ts': 'export function util() {}',
    'src/api/routes.ts': 'export function registerRoutes() {}',
  };
  const scopeMap = buildScopeMapFromPaths({ paths, fileContents });
  assert.ok(Array.isArray(scopeMap.hotspotSymbolHints));
  assert.ok(scopeMap.hotspotSymbolHints.length > 0);
  const allSymbols = scopeMap.hotspotSymbolHints.flatMap((h) => h.symbols);
  assert.ok(allSymbols.some((s) => ['emit', 'util', 'registerRoutes'].includes(s)));
});
