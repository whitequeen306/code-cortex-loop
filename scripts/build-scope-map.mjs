#!/usr/bin/env node
/**
 * Build deterministic scope-map.json (CortexScope Index) for MAP phase.
 *
 * Usage:
 *   node scripts/build-scope-map.mjs --manifest=.cortexloop/scope-manifest.json
 */
import { existsSync } from 'node:fs';
import { buildScopeMap } from './lib/scope-index.mjs';
import { DEFAULT_SCOPE_MAP, writeJson } from './lib/shared.mjs';

function parseArgs(argv) {
  const opts = {
    manifest: '.cortexloop/scope-manifest.json',
    paths: null,
    config: 'cortexloop.config.json',
    out: DEFAULT_SCOPE_MAP,
    rootDir: '.',
    json: false,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--manifest=')) opts.manifest = arg.slice('--manifest='.length);
    else if (arg.startsWith('--paths=')) opts.paths = arg.slice('--paths='.length);
    else if (arg.startsWith('--config=')) opts.config = arg.slice('--config='.length);
    else if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length);
    else if (arg.startsWith('--root=')) opts.rootDir = arg.slice('--root='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/build-scope-map.mjs [--manifest=PATH] [--paths=PATH] [--config=PATH] [--out=PATH]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(opts.manifest)) {
    console.error(`[cortexloop] manifest not found: ${opts.manifest}`);
    process.exit(1);
  }

  const scopeMap = buildScopeMap({
    manifestPath: opts.manifest,
    pathsPath: opts.paths,
    configPath: opts.config,
    out: opts.out,
    rootDir: opts.rootDir,
  });

  writeJson(opts.out, scopeMap);

  if (!opts.quiet) {
    console.log(
      `[cortexloop] scope-map: ${scopeMap.hotspots.length} hotspots, confidence=${scopeMap.confidence} → ${opts.out}`,
    );
    if (scopeMap.mapEnrichRecommended) {
      console.log(
        `[cortexloop] LLM enrich recommended (confidence < ${scopeMap.mapEnrichThreshold}) — run Step 2b-enrich`,
      );
    }
  }
  if (opts.json) console.log(JSON.stringify(scopeMap, null, 2));
}

if (process.argv[1]?.endsWith('build-scope-map.mjs')) {
  main();
}

export { main as buildScopeMapCli };
