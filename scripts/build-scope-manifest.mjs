#!/usr/bin/env node
/**
 * Build scope manifest for large-project context management.
 * Paths live in scope-paths.json — never inline in orchestrator prompts.
 *
 * Usage:
 *   node scripts/build-scope-manifest.mjs --mode=recent|whole [--config=PATH] [--out=MANIFEST] [--paths-out=PATHS]
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { buildScopeMap } from './lib/scope-index.mjs';
import {
  DEFAULT_SCOPE_MANIFEST,
  DEFAULT_SCOPE_MAP,
  DEFAULT_SCOPE_PATHS,
  aggregatePathsByDirectory,
  loadScopeConfig,
  tryGitBranch,
  tryGitCommit,
  writeJson,
} from './lib/shared.mjs';

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.java', '.kt', '.go', '.rs', '.rb', '.php',
  '.vue', '.svelte', '.cs', '.swift', '.scala',
  '.sql', '.graphql', '.proto',
  '.md', '.mdc',
]);

function parseArgs(argv) {
  const opts = {
    mode: 'recent',
    configPath: 'cortexloop.config.json',
    out: DEFAULT_SCOPE_MANIFEST,
    pathsOut: DEFAULT_SCOPE_PATHS,
    json: false,
    quiet: false,
    skipMap: false,
    mapOut: DEFAULT_SCOPE_MAP,
  };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--skip-map') opts.skipMap = true;
    else if (arg.startsWith('--map-out=')) opts.mapOut = arg.slice('--map-out='.length);
    else if (arg.startsWith('--mode=')) opts.mode = arg.slice('--mode='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length);
    else if (arg.startsWith('--paths-out=')) opts.pathsOut = arg.slice('--paths-out='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/build-scope-manifest.mjs --mode=recent|whole [--config=PATH] [--out=MANIFEST] [--paths-out=PATHS]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (!['recent', 'whole'].includes(opts.mode)) {
    console.error('--mode must be recent or whole');
    process.exit(2);
  }
  return opts;
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

function loadIgnorePatterns() {
  const patterns = [];
  if (existsSync('.cortexloopignore')) {
    for (const line of readFileSync('.cortexloopignore', 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      patterns.push(t);
    }
  }
  return patterns;
}

function matchesIgnore(filePath, patterns) {
  const norm = filePath.replace(/\\/g, '/');
  for (const p of patterns) {
    if (p.endsWith('/')) {
      if (norm.startsWith(p) || norm.includes(`/${p}`)) return true;
    } else if (norm === p || norm.endsWith(`/${p}`) || norm.includes(p)) {
      return true;
    }
  }
  return false;
}

function isSourceFile(filePath) {
  const lower = filePath.toLowerCase();
  for (const ext of SOURCE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function collectRecentPaths() {
  const mergeBase =
    gitLines('git merge-base HEAD main 2>/dev/null')[0] ||
    gitLines('git merge-base HEAD master 2>/dev/null')[0] ||
    'HEAD~1';
  const sets = [
    gitLines('git diff --name-only HEAD'),
    gitLines('git diff --name-only --cached'),
    gitLines(`git diff --name-only ${mergeBase}...HEAD`),
  ];
  return [...new Set(sets.flat())];
}

function collectWholePaths(exclude = []) {
  const tracked = gitLines('git ls-files');
  if (tracked.length > 0) {
    return tracked.filter(isSourceFile);
  }
  return [];
}

export function buildScopeManifest(opts) {
  const scopeCfg = loadScopeConfig(opts.configPath);
  const ignore = [...loadIgnorePatterns(), ...scopeCfg.exclude];
  let paths =
    opts.mode === 'whole' ? collectWholePaths(scopeCfg.exclude) : collectRecentPaths();
  paths = paths
    .map((p) => p.replace(/\\/g, '/'))
    .filter((p) => isSourceFile(p))
    .filter((p) => !matchesIgnore(p, ignore));
  paths = [...new Set(paths)].sort();

  const byDirectory = aggregatePathsByDirectory(paths, 2);
  const manifest = {
    version: '2.3',
    generatedAt: new Date().toISOString(),
    generatedBy: 'cortexloop',
    scopeMode: opts.mode,
    fileCount: paths.length,
    gitCommit: tryGitCommit(),
    gitBranch: tryGitBranch(),
    pathsFile: opts.pathsOut,
    scopeMapFile: opts.mapOut,
    byDirectory: byDirectory.slice(0, 40),
    mapThreshold: scopeCfg.mapThreshold,
    requiresMap: paths.length > scopeCfg.mapThreshold,
    instructions:
      'Experts: Read pathsFile on disk. Prioritize scope-map hotspots + mustReview + longTailSample. Never require full inline path list in prompts.',
  };

  writeJson(opts.pathsOut, {
    version: '2.2',
    generatedAt: manifest.generatedAt,
    scopeMode: opts.mode,
    paths,
  });
  writeJson(opts.out, manifest);

  let scopeMap = null;
  if (manifest.requiresMap && !opts.skipMap) {
    scopeMap = buildScopeMap({
      manifestPath: opts.out,
      pathsPath: opts.pathsOut,
      configPath: opts.configPath,
      out: opts.mapOut,
      scopeCfg,
    });
    writeJson(opts.mapOut, scopeMap);
  }

  return { manifest, paths, scopeMap, outPath: opts.out, pathsOut: opts.pathsOut, mapOut: opts.mapOut };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = buildScopeManifest(opts);
  if (!opts.quiet) {
    console.log(
      `[cortexloop] scope manifest: ${result.manifest.fileCount} files (${result.manifest.scopeMode}) → ${result.outPath}`,
    );
    if (result.manifest.requiresMap) {
      if (result.scopeMap) {
        console.log(
          `[cortexloop] scope-map: ${result.scopeMap.hotspots.length} hotspots, confidence=${result.scopeMap.confidence} → ${result.mapOut}`,
        );
        if (result.scopeMap.mapEnrichRecommended) {
          console.log('[cortexloop] LLM enrich recommended — run Step 2b-enrich before Step 3');
        }
      } else {
        console.log(
          `[cortexloop] map phase recommended (fileCount > ${result.manifest.mapThreshold}) — run build-scope-map.mjs`,
        );
      }
    }
  }
  if (opts.json) console.log(JSON.stringify(result.manifest, null, 2));
}

if (process.argv[1]?.endsWith('build-scope-manifest.mjs')) {
  main();
}
