#!/usr/bin/env node
/**
 * Collect backward defer items for orchestrator cross-validation (Step 3.5).
 *
 * Usage:
 *   node scripts/collect-orphan-defers.mjs [--handoff-dir=DIR] [--config=PATH] [--out=FILE] [--json]
 * Exit: 0 always when run succeeds (orphans may be > 0)
 */
import { existsSync } from 'node:fs';
import {
  DEFAULT_HANDOFF_DIR,
  DEFAULT_ORPHAN_DEFERS,
  collectOrphanDefers,
  readJson,
  writeJson,
} from './lib/shared.mjs';

function parseArgs(argv) {
  const opts = {
    handoffDir: DEFAULT_HANDOFF_DIR,
    configPath: 'cortexloop.config.json',
    out: DEFAULT_ORPHAN_DEFERS,
    json: false,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--handoff-dir=')) opts.handoffDir = arg.slice('--handoff-dir='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/collect-orphan-defers.mjs [--handoff-dir=DIR] [--config=PATH] [--out=FILE] [--json]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function loadPassesConfig(configPath) {
  if (!existsSync(configPath)) return {};
  try {
    const cfg = readJson(configPath);
    return cfg.passes ?? {};
  } catch (err) {
    console.error(`Failed to read config ${configPath}: ${err.message}`);
    process.exit(2);
  }
}

export function runCollectOrphanDefers(opts) {
  const passesConfig = loadPassesConfig(opts.configPath);
  const result = collectOrphanDefers({ handoffDir: opts.handoffDir, passesConfig });
  const payload = {
    generatedAt: new Date().toISOString(),
    orphanCount: result.orphanCount,
    orphans: result.orphans,
    byTarget: result.byTarget,
    warnings: result.warnings,
  };
  writeJson(opts.out, payload);
  return { ...result, payload, outPath: opts.out };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const result = runCollectOrphanDefers(opts);

  if (opts.json) {
    console.log(JSON.stringify(result.payload, null, 2));
  } else if (!opts.quiet) {
    console.log(`[cortexloop] Orphan defers: ${result.orphanCount} → ${opts.out}`);
    for (const w of result.warnings) console.warn(`  warn: ${w}`);
    if (result.orphanCount > 0) {
      for (const [target, items] of Object.entries(result.byTarget)) {
        console.log(`  ${target}: ${items.length} item(s) → re-delegate ${items[0].targetExpert}`);
      }
    }
  }

  process.exit(0);
}

if (process.argv[1]?.endsWith('collect-orphan-defers.mjs')) {
  main();
}
