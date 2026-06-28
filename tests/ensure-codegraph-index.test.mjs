import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assessDeepIndexOffer } from '../scripts/ensure-codegraph-index.mjs';
import { buildIndexStrategy } from '../scripts/lib/shared.mjs';

const scopeCfg = {
  mapThreshold: 100,
  smallScopeThreshold: 50,
  deepIndexFileThreshold: 300,
  deepIndexTopHotspots: 15,
  hotspotSymbolHintFiles: 8,
  deepIndexOffer: true,
  mapEnrichThreshold: 0.7,
  longTailSampleCount: 20,
  mapWeights: { churn: 0.3, importHub: 0.3, density: 0.2, patterns: 0.2 },
  exclude: [],
  mode: null,
};

function writeManifest(dir, indexStrategy) {
  const manifestPath = join(dir, 'scope-manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        fileCount: 400,
        indexStrategy,
      },
      null,
      2,
    ),
  );
  return manifestPath;
}

test('assessDeepIndexOffer returns offer when suggested and no .codegraph', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cortexloop-offer-'));
  const manifestPath = writeManifest(dir, {
    optionalDeepIndex: { suggested: true, deepIndexTargets: ['src/core'] },
  });
  const result = assessDeepIndexOffer({
    manifest: manifestPath,
    choicePath: join(dir, 'choice.json'),
    configPath: join(dir, 'missing-config.json'),
    root: dir,
    ci: false,
  });
  assert.equal(result.offer, true);
  assert.equal(result.codegraphPresent, false);
});

test('assessDeepIndexOffer skips when user declined', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cortexloop-decline-'));
  const manifestPath = writeManifest(dir, {
    optionalDeepIndex: { suggested: true },
  });
  const choicePath = join(dir, 'choice.json');
  writeFileSync(choicePath, JSON.stringify({ decision: 'decline' }));
  const result = assessDeepIndexOffer({
    manifest: manifestPath,
    choicePath,
    configPath: join(dir, 'missing-config.json'),
    root: dir,
  });
  assert.equal(result.offer, false);
  assert.equal(result.reason, 'user-declined');
});

test('assessDeepIndexOffer skips in ci mode', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cortexloop-ci-'));
  const manifestPath = writeManifest(dir, {
    optionalDeepIndex: { suggested: true },
  });
  const result = assessDeepIndexOffer({
    manifest: manifestPath,
    choicePath: join(dir, 'choice.json'),
    configPath: join(dir, 'missing-config.json'),
    root: dir,
    ci: true,
  });
  assert.equal(result.offer, false);
  assert.equal(result.reason, 'ci-mode');
});

test('buildIndexStrategy offerBeforePass1 false after decline', () => {
  const strategy = buildIndexStrategy({
    fileCount: 400,
    scopeCfg,
    scopeMap: { confidence: 0.6, mapEnrichRecommended: true, hotspots: [] },
    pathsOut: 'p.json',
    mapOut: 'm.json',
    userDecision: 'decline',
  });
  assert.equal(strategy.optionalDeepIndex.offerBeforePass1, false);
  assert.equal(strategy.optionalDeepIndex.userDecision, 'decline');
});
