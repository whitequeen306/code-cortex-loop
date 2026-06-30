#!/usr/bin/env node
/**
 * Initialize a new CodeCortexLoop run archive (human-readable time folder).
 *
 * Usage:
 *   node scripts/init-run.mjs --mode=report|direct [--preset=default] [--scope=recent|whole] [--fix-floor=High|Medium|Low]
 */
import { initCortexloopRun } from './lib/run-artifacts.mjs';
import { normalizeDirectFixFloor } from './lib/shared.mjs';

function parseArgs(argv) {
  const opts = {
    mode: 'report',
    preset: 'default',
    scope: 'recent',
    fixFloor: null,
    json: false,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--mode=')) opts.mode = arg.slice('--mode='.length);
    else if (arg.startsWith('--preset=')) opts.preset = arg.slice('--preset='.length);
    else if (arg.startsWith('--scope=')) opts.scope = arg.slice('--scope='.length);
    else if (arg.startsWith('--fix-floor=')) opts.fixFloor = arg.slice('--fix-floor='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/init-run.mjs --mode=report|direct [--preset=NAME] [--scope=recent|whole] [--fix-floor=High|Medium|Low]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  if (!['report', 'direct', 'ci'].includes(opts.mode)) {
    console.error('--mode must be report, direct, or ci');
    process.exit(2);
  }
  if (opts.fixFloor != null) {
    try {
      opts.fixFloor = normalizeDirectFixFloor(opts.fixFloor);
    } catch (err) {
      console.error(err.message);
      process.exit(2);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const meta = initCortexloopRun(opts);
  if (!opts.quiet) {
    console.log(`[cortexloop] run initialized: ${meta.runDisplayTime}`);
    console.log(`  runDir: ${meta.runDir}`);
    console.log(`  reports: ${meta.reports.summary}`);
  }
  if (opts.json) console.log(JSON.stringify(meta, null, 2));
}

if (process.argv[1]?.endsWith('init-run.mjs')) {
  main();
}

export { main as initRunCli };
