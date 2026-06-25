#!/usr/bin/env node
/**
 * Compact handoff summaries for thin orchestrator context.
 *
 * Usage:
 *   node scripts/handoff-summary.mjs [--through=N] [--handoff-dir=DIR] [--config=PATH] [--out=FILE] [--json]
 */
import {
  DEFAULT_HANDOFF_DIR,
  DEFAULT_HANDOFF_SUMMARY,
  loadPassesConfig,
  summarizeHandoffsThrough,
  writeJson,
} from './lib/shared.mjs';

function parseArgs(argv) {
  const opts = {
    through: 7,
    handoffDir: DEFAULT_HANDOFF_DIR,
    configPath: 'cortexloop.config.json',
    out: DEFAULT_HANDOFF_SUMMARY,
    json: false,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--through=')) opts.through = Number(arg.slice('--through='.length));
    else if (arg.startsWith('--handoff-dir=')) opts.handoffDir = arg.slice('--handoff-dir='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/handoff-summary.mjs [--through=N] [--handoff-dir=DIR] [--config=PATH] [--out=FILE] [--json]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

export function runHandoffSummary(opts) {
  const passesConfig = loadPassesConfig(opts.configPath);
  const summaries = summarizeHandoffsThrough({
    handoffDir: opts.handoffDir,
    throughOrder: opts.through,
    passesConfig,
  });
  const payload = {
    generatedAt: new Date().toISOString(),
    throughOrder: opts.through,
    summaries,
    totalFindings: summaries.reduce((n, s) => n + (s.findingCount || 0), 0),
    totalDefers: summaries.reduce((n, s) => n + (s.deferCount || 0), 0),
  };
  writeJson(opts.out, payload);
  return { payload, outPath: opts.out };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { payload, outPath } = runHandoffSummary(opts);
  if (!opts.quiet) {
    for (const s of payload.summaries) {
      if (!s.ok) {
        console.log(`  [missing] ${s.path}`);
        continue;
      }
      console.log(
        `  pass ${s.pass ?? '?'}: ${s.findingCount} findings, ${s.deferCount} defers — ${s.summary.slice(0, 80)}`,
      );
    }
    console.log(`[cortexloop] handoff summary → ${outPath}`);
  }
  if (opts.json) console.log(JSON.stringify(payload, null, 2));
}

if (process.argv[1]?.endsWith('handoff-summary.mjs')) {
  main();
}
