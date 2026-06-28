/**
 * CortexScope Index — deterministic MAP pre-index for large scopes.
 * Zero npm deps; inspired by codegraph "index on disk, query on demand".
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import {
  aggregatePathsByDirectory,
  DEFAULT_DEEP_INDEX_TOP_HOTSPOTS,
  DEFAULT_HOTSPOT_SYMBOL_HINT_FILES,
  DEFAULT_LONG_TAIL_SAMPLE_COUNT,
  DEFAULT_MAP_ENRICH_THRESHOLD,
  DEFAULT_MAP_THRESHOLD,
  DEFAULT_MAP_WEIGHTS,
  DEFAULT_SCOPE_MAP,
  DEFAULT_SMALL_SCOPE_THRESHOLD,
  DEFAULT_DEEP_INDEX_FILE_THRESHOLD,
} from './shared.mjs';
import { isEntryPoint, PASS_CATEGORIES, scanFileForPatterns } from './scope-patterns.mjs';

export const INDEX_LIMITATIONS = ['regex-import-only', 'no-dynamic-dispatch', 'no-path-alias-resolution'];

const IMPORTABLE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.java', '.kt', '.go', '.rs', '.rb', '.vue', '.svelte',
]);

const IMPORT_RE = [
  /import\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /from\s+['"]([^'"]+)['"]\s+import/g,
];

/**
 * @param {unknown} scope
 * @returns {{ mapThreshold: number, smallScopeThreshold: number, deepIndexFileThreshold: number, deepIndexTopHotspots: number, hotspotSymbolHintFiles: number, exclude: string[], mode: string|null, mapWeights: typeof DEFAULT_MAP_WEIGHTS, mapEnrichThreshold: number, longTailSampleCount: number }}
 */
export function normalizeScopeConfig(scope) {
  if (typeof scope === 'string') {
    return {
      mapThreshold: DEFAULT_MAP_THRESHOLD,
      smallScopeThreshold: DEFAULT_SMALL_SCOPE_THRESHOLD,
      deepIndexFileThreshold: DEFAULT_DEEP_INDEX_FILE_THRESHOLD,
      deepIndexTopHotspots: DEFAULT_DEEP_INDEX_TOP_HOTSPOTS,
      hotspotSymbolHintFiles: DEFAULT_HOTSPOT_SYMBOL_HINT_FILES,
      exclude: [],
      mode: scope,
      mapWeights: { ...DEFAULT_MAP_WEIGHTS },
      mapEnrichThreshold: DEFAULT_MAP_ENRICH_THRESHOLD,
      longTailSampleCount: DEFAULT_LONG_TAIL_SAMPLE_COUNT,
    };
  }
  const s = scope && typeof scope === 'object' ? scope : {};
  return {
    mapThreshold: s.mapThreshold ?? DEFAULT_MAP_THRESHOLD,
    smallScopeThreshold: s.smallScopeThreshold ?? DEFAULT_SMALL_SCOPE_THRESHOLD,
    deepIndexFileThreshold: s.deepIndexFileThreshold ?? DEFAULT_DEEP_INDEX_FILE_THRESHOLD,
    deepIndexTopHotspots: s.deepIndexTopHotspots ?? DEFAULT_DEEP_INDEX_TOP_HOTSPOTS,
    hotspotSymbolHintFiles: s.hotspotSymbolHintFiles ?? DEFAULT_HOTSPOT_SYMBOL_HINT_FILES,
    exclude: s.exclude ?? [],
    mode: s.mode ?? null,
    mapWeights: { ...DEFAULT_MAP_WEIGHTS, ...(s.mapWeights ?? {}) },
    mapEnrichThreshold: s.mapEnrichThreshold ?? DEFAULT_MAP_ENRICH_THRESHOLD,
    longTailSampleCount: s.longTailSampleCount ?? DEFAULT_LONG_TAIL_SAMPLE_COUNT,
  };
}

const SYMBOL_HINT_RES = [
  /export\s+(?:async\s+)?function\s+(\w+)/g,
  /export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/g,
  /export\s+(?:const|let|var)\s+(\w+)\s*=/g,
  /export\s+default\s+function\s+(\w+)/g,
];

/**
 * Lightweight export-name scan for hotspot entry files (L1 enhancement — not a call graph).
 * @param {string} content
 * @param {number} [maxSymbols]
 */
export function scanSymbolHints(content, maxSymbols = 12) {
  const names = new Set();
  for (const re of SYMBOL_HINT_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null && names.size < maxSymbols) {
      if (m[1]) names.add(m[1]);
    }
  }
  return [...names].slice(0, maxSymbols);
}

/**
 * @param {Array<{ path: string, entryFiles?: string[] }>} hotspots
 * @param {string[]} normalizedPaths
 * @param {Record<string, string>|undefined} fileContents
 * @param {string} rootDir
 * @param {number} maxFiles
 */
export function buildHotspotSymbolHints(hotspots, normalizedPaths, fileContents, rootDir, maxFiles = 8) {
  /** @type {string[]} */
  const files = [];
  for (const h of hotspots) {
    const candidates = [...(h.entryFiles || [])];
    if (candidates.length === 0) {
      candidates.push(
        ...normalizedPaths.filter((p) => p.startsWith(`${h.path}/`) || p === h.path).slice(0, 2),
      );
    }
    for (const f of candidates) {
      if (files.includes(f)) continue;
      files.push(f);
      if (files.length >= maxFiles) break;
    }
    if (files.length >= maxFiles) break;
  }

  /** @type {Array<{ file: string, symbols: string[] }>} */
  const hints = [];
  for (const file of files) {
    let content = fileContents?.[file];
    if (content == null) {
      const abs = resolve(rootDir, file);
      if (!existsSync(abs)) continue;
      try {
        content = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
    }
    const symbols = scanSymbolHints(content);
    if (symbols.length > 0) hints.push({ file, symbols });
  }
  return hints;
}

function gitLines(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {string[]} paths
 * @param {number} sinceDays
 * @returns {{ fileScores: Map<string, number>, dirScores: Map<string, number>, recentChangeFocus: string[] }}
 */
export function collectChurnScores(paths, sinceDays = 90) {
  const pathSet = new Set(paths.map((p) => p.replace(/\\/g, '/')));
  const fileScores = new Map();
  for (const p of pathSet) fileScores.set(p, 0);

  const lines = gitLines(`git log --since=${sinceDays}.days.ago --name-only --pretty=format:`);
  for (const line of lines) {
    const norm = line.replace(/\\/g, '/');
    if (!pathSet.has(norm)) continue;
    fileScores.set(norm, (fileScores.get(norm) || 0) + 1);
  }

  /** @type {Map<string, number>} */
  const dirScores = new Map();
  for (const [file, score] of fileScores) {
    if (score <= 0) continue;
    const parts = file.split('/');
    const dir = parts.length > 1 ? parts.slice(0, 2).join('/') : '.';
    dirScores.set(dir, (dirScores.get(dir) || 0) + score);
  }

  const recentChangeFocus = [...fileScores.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([p]) => p);

  return { fileScores, dirScores, recentChangeFocus };
}

/**
 * @param {string} spec
 * @param {string} fromFile
 * @param {Set<string>} pathSet
 * @param {string} rootDir
 * @returns {string|null}
 */
export function resolveImportSpec(spec, fromFile, pathSet, rootDir) {
  if (!spec || spec.startsWith('node:') || !spec.startsWith('.')) return null;
  const fromDir = dirname(fromFile.replace(/\\/g, '/'));
  let candidate = normalize(join(fromDir, spec)).replace(/\\/g, '/');
  if (pathSet.has(candidate)) return candidate;

  const exts = ['', ...IMPORTABLE_EXT];
  for (const ext of exts) {
    const withExt = candidate.endsWith(ext) ? candidate : candidate + ext;
    if (pathSet.has(withExt)) return withExt;
    const indexPath = join(withExt, 'index.ts').replace(/\\/g, '/');
    const indexJs = join(withExt, 'index.js').replace(/\\/g, '/');
    if (pathSet.has(indexPath)) return indexPath;
    if (pathSet.has(indexJs)) return indexJs;
  }
  return null;
}

/**
 * @param {string} content
 * @returns {string[]}
 */
export function extractImportSpecs(content) {
  const specs = new Set();
  for (const re of IMPORT_RE) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m[1]) specs.add(m[1]);
    }
  }
  return [...specs];
}

/**
 * @param {string[]} paths
 * @param {Record<string, string>|null} fileContents
 * @param {string} rootDir
 * @returns {{ inbound: Map<string, number>, outbound: Map<string, number>, edgesResolved: number, edgesAttempted: number }}
 */
export function buildImportGraph(paths, fileContents = null, rootDir = '.') {
  const pathSet = new Set(paths.map((p) => p.replace(/\\/g, '/')));
  /** @type {Map<string, number>} */
  const inbound = new Map();
  /** @type {Map<string, number>} */
  const outbound = new Map();
  let edgesResolved = 0;
  let edgesAttempted = 0;

  for (const raw of paths) {
    const file = raw.replace(/\\/g, '/');
    if (!IMPORTABLE_EXT.has(extname(file).toLowerCase())) continue;
    let content = fileContents?.[file];
    if (content == null) {
      const abs = resolve(rootDir, file);
      if (!existsSync(abs)) continue;
      try {
        content = readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
    }
    const specs = extractImportSpecs(content);
    outbound.set(file, specs.length);
    for (const spec of specs) {
      edgesAttempted += 1;
      const resolved = resolveImportSpec(spec, file, pathSet, rootDir);
      if (resolved) {
        edgesResolved += 1;
        inbound.set(resolved, (inbound.get(resolved) || 0) + 1);
      }
    }
  }

  return { inbound, outbound, edgesResolved, edgesAttempted };
}

function normalizeScore(value, max) {
  if (max <= 0) return 0;
  return Math.min(1, value / max);
}

function riskLevelFromScore(score) {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/**
 * @param {string} dir
 * @param {string[]} pathsInDir
 * @param {object} signals
 * @returns {string[]}
 */
function entryFilesForDir(dir, pathsInDir, signals) {
  const entries = pathsInDir.filter(isEntryPoint);
  if (entries.length > 0) return entries.slice(0, 5);
  const hubInDir = signals.topHubs.filter((h) => h.file.startsWith(dir + '/') || h.file.startsWith(dir));
  return hubInDir.slice(0, 3).map((h) => h.file);
}

/**
 * @param {string[]} paths
 * @param {Set<string>} hotspotDirs
 * @param {number} count
 * @returns {string[]}
 */
export function buildLongTailSample(paths, hotspotDirs, count = 20) {
  /** @type {Map<string, string>} */
  const dirToFile = new Map();
  for (const raw of paths) {
    const file = raw.replace(/\\/g, '/');
    const parts = file.split('/');
    const dir = parts.length > 1 ? parts.slice(0, 2).join('/') : '.';
    if (hotspotDirs.has(dir)) continue;
    if (!dirToFile.has(dir)) dirToFile.set(dir, file);
  }
  return [...dirToFile.values()].slice(0, count);
}

/**
 * @param {object} opts
 * @returns {object}
 */
export function buildScopeMapFromPaths(opts) {
  const {
    paths,
    scopeCfg = normalizeScopeConfig({}),
    rootDir = '.',
    fileContents = null,
    churnOverride = null,
    out = DEFAULT_SCOPE_MAP,
  } = opts;

  const normalizedPaths = [...new Set(paths.map((p) => p.replace(/\\/g, '/')))].sort();
  const pathSet = new Set(normalizedPaths);
  const weights = scopeCfg.mapWeights;

  const churn = churnOverride ?? collectChurnScores(normalizedPaths);
  const importGraph = buildImportGraph(normalizedPaths, fileContents, rootDir);
  const byDirectory = aggregatePathsByDirectory(normalizedPaths, 2);

  /** @type {Record<string, string[]>} */
  const patternHits = {};
  for (const cat of PASS_CATEGORIES) patternHits[cat] = [];

  const dirPatternCounts = new Map();
  for (const raw of normalizedPaths) {
    const file = raw.replace(/\\/g, '/');
    let content = fileContents?.[file];
    if (content == null && IMPORTABLE_EXT.has(extname(file).toLowerCase())) {
      const abs = resolve(rootDir, file);
      if (existsSync(abs)) {
        try {
          content = readFileSync(abs, 'utf8');
        } catch {
          content = '';
        }
      } else {
        content = '';
      }
    } else if (content == null) {
      content = '';
    }

    const hits = scanFileForPatterns(content, file);
    for (const cat of PASS_CATEGORIES) {
      if (hits[cat].length > 0) {
        patternHits[cat].push(file);
        const dir = file.split('/').slice(0, 2).join('/') || '.';
        dirPatternCounts.set(dir, (dirPatternCounts.get(dir) || 0) + hits[cat].length);
      }
    }
  }

  const topHubs = [...importGraph.inbound.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([file, inboundCount]) => ({
      file,
      inboundCount,
      outboundCount: importGraph.outbound.get(file) || 0,
    }));

  const hubDirScores = new Map();
  for (const hub of topHubs) {
    const dir = hub.file.split('/').slice(0, 2).join('/') || '.';
    hubDirScores.set(dir, (hubDirScores.get(dir) || 0) + hub.inboundCount);
  }

  const maxChurn = Math.max(1, ...churn.dirScores.values(), 0);
  const maxDensity = Math.max(1, ...byDirectory.map((d) => d.count), 0);
  const maxHub = Math.max(1, ...hubDirScores.values(), 0);
  const maxPattern = Math.max(1, ...dirPatternCounts.values(), 0);

  const signals = { topHubs };

  /** @type {Array<{ path: string, score: number, components: object }>} */
  const dirCandidates = byDirectory.map(({ dir, count }) => {
    const churnScore = normalizeScore(churn.dirScores.get(dir) || 0, maxChurn);
    const densityScore = normalizeScore(count, maxDensity);
    const hubScore = normalizeScore(hubDirScores.get(dir) || 0, maxHub);
    const patternScore = normalizeScore(dirPatternCounts.get(dir) || 0, maxPattern);
    const score =
      weights.churn * churnScore +
      weights.importHub * hubScore +
      weights.density * densityScore +
      weights.patterns * patternScore;
    return {
      path: dir,
      score,
      components: { churnScore, densityScore, hubScore, patternScore },
    };
  });

  dirCandidates.sort((a, b) => b.score - a.score);
  const topDirs = dirCandidates.slice(0, 15);

  const hotspots = topDirs.map((d, i) => {
    const signalTags = [];
    if (d.components.churnScore >= 0.5) signalTags.push('churn:high');
    if (d.components.hubScore >= 0.5) signalTags.push('imports:hub');
    if (d.components.densityScore >= 0.5) signalTags.push('density:high');
    if (d.components.patternScore >= 0.5) signalTags.push('patterns:hit');

    const pathsInDir = normalizedPaths.filter((p) => p.startsWith(d.path + '/') || p === d.path);
    const entryFiles = entryFilesForDir(d.path, pathsInDir, signals);

    const reasons = [];
    if (signalTags.includes('churn:high')) reasons.push('recent git churn');
    if (signalTags.includes('imports:hub')) reasons.push('import hub');
    if (signalTags.includes('density:high')) reasons.push('high file density');
    if (signalTags.includes('patterns:hit')) reasons.push('risk pattern hits');

    return {
      path: d.path,
      score: Math.round(d.score * 1000) / 1000,
      riskLevel: riskLevelFromScore(d.score),
      priority: i + 1,
      signals: signalTags,
      reason: reasons.length > 0 ? reasons.join(' + ') : 'directory aggregate score',
      entryFiles,
    };
  });

  const mustReviewSet = new Set([
    ...churn.recentChangeFocus.slice(0, 15),
    ...Object.values(patternHits).flat(),
  ]);

  const hotspotDirs = new Set(hotspots.map((h) => h.path));
  const longTailPaths = buildLongTailSample(
    normalizedPaths,
    hotspotDirs,
    scopeCfg.longTailSampleCount,
  );

  const resolveRatio =
    importGraph.edgesAttempted > 0
      ? importGraph.edgesResolved / importGraph.edgesAttempted
      : 0;
  const churnCoverage =
    normalizedPaths.length > 0
      ? [...churn.fileScores.values()].filter((s) => s > 0).length / normalizedPaths.length
      : 0;

  let confidence = 0.85;
  if (importGraph.edgesAttempted === 0) confidence -= 0.15;
  else confidence -= (1 - resolveRatio) * 0.25;
  if (churn.recentChangeFocus.length === 0) confidence -= 0.1;
  confidence = Math.max(0.3, Math.min(1, Math.round(confidence * 100) / 100));

  const hotspotSymbolHints = buildHotspotSymbolHints(
    hotspots,
    normalizedPaths,
    fileContents,
    rootDir,
    scopeCfg.hotspotSymbolHintFiles,
  );

  const scopeMap = {
    version: '2.3',
    generatedAt: new Date().toISOString(),
    generatedBy: 'cortexloop-scope-index',
    mapMode: 'deterministic',
    fileCount: normalizedPaths.length,
    confidence,
    mapEnrichRecommended: confidence < scopeCfg.mapEnrichThreshold,
    mapEnrichThreshold: scopeCfg.mapEnrichThreshold,
    coveragePolicy: 'prioritize-with-sampling',
    hotspots,
    recentChangeFocus: churn.recentChangeFocus,
    importHubs: topHubs.slice(0, 20),
    patternHits,
    mustReview: [...mustReviewSet].sort(),
    longTailSample: {
      count: scopeCfg.longTailSampleCount,
      strategy: 'one-per-dir-not-in-hotspot',
      paths: longTailPaths,
    },
    hotspotSymbolHints,
    indexQuality: {
      filesScanned: normalizedPaths.length,
      importEdgesResolved: importGraph.edgesResolved,
      importEdgesAttempted: importGraph.edgesAttempted,
      importResolveRatio: Math.round(resolveRatio * 1000) / 1000,
      churnFilesTracked: [...churn.fileScores.values()].filter((s) => s > 0).length,
      churnCoverage: Math.round(churnCoverage * 1000) / 1000,
      limitations: INDEX_LIMITATIONS,
    },
    scopeMapFile: out,
  };

  return scopeMap;
}

/**
 * @param {object} opts
 * @returns {object}
 */
export function buildScopeMap(opts) {
  const {
    manifestPath = '.cortexloop/scope-manifest.json',
    pathsPath = null,
    configPath = 'cortexloop.config.json',
    out = DEFAULT_SCOPE_MAP,
    rootDir = '.',
  } = opts;

  if (!existsSync(manifestPath)) {
    throw new Error(`manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const resolvedPathsPath = pathsPath || manifest.pathsFile || '.cortexloop/scope-paths.json';
  if (!existsSync(resolvedPathsPath)) {
    throw new Error(`scope paths not found: ${resolvedPathsPath}`);
  }

  const pathsDoc = JSON.parse(readFileSync(resolvedPathsPath, 'utf8'));
  const paths = pathsDoc.paths || [];
  const scopeCfg = normalizeScopeConfig(
    opts.scopeCfg ?? (existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf8'))?.scope : {}),
  );

  if (existsSync(configPath)) {
    const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
    Object.assign(scopeCfg, normalizeScopeConfig(cfg.scope));
  }

  return buildScopeMapFromPaths({ paths, scopeCfg, rootDir, out });
}
