#!/usr/bin/env node
/**
 * Sync current run archive to docs/cortexloop/ latest snapshot (CI, dashboard, badge).
 *
 * Usage:
 *   node scripts/sync-run-latest.mjs [--meta=.cortexloop/run-meta.json]
 */
import { loadRunMeta, syncRunToLatest } from './lib/run-artifacts.mjs';

function parseArgs(argv) {
  const opts = { metaPath: '.cortexloop/run-meta.json', json: false, quiet: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--meta=')) opts.metaPath = arg.slice('--meta='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/sync-run-latest.mjs [--meta=PATH]');
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
  const meta = loadRunMeta(opts.metaPath);
  if (!meta) {
    console.error(`[cortexloop] run meta not found: ${opts.metaPath}`);
    process.exit(1);
  }
  const result = syncRunToLatest({ meta });
  if (!opts.quiet) {
    console.log(
      `[cortexloop] synced run ${meta.runDisplayTime} → docs/cortexloop/ (${result.copied.length} files)`,
    );
  }
  if (opts.json) console.log(JSON.stringify({ meta, ...result }, null, 2));
}

if (process.argv[1]?.endsWith('sync-run-latest.mjs')) {
  main();
}
