#!/usr/bin/env node
/**
 * Append a reflection section to docs/cortexloop/08-reflection.md (incremental evolution log).
 *
 * Usage:
 *   node scripts/append-reflection.mjs --file=section.md
 *   node scripts/append-reflection.mjs --text="## Summary\n..."
 */
import { readFileSync } from 'node:fs';
import { appendReflectionSection, loadRunMeta } from './lib/run-artifacts.mjs';

function parseArgs(argv) {
  const opts = { file: null, text: null, metaPath: '.cortexloop/run-meta.json', json: false };
  for (const arg of argv) {
    if (arg === '--json') opts.json = true;
    else if (arg.startsWith('--file=')) opts.file = arg.slice('--file='.length);
    else if (arg.startsWith('--text=')) opts.text = arg.slice('--text='.length);
    else if (arg.startsWith('--meta=')) opts.metaPath = arg.slice('--meta='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/append-reflection.mjs --file=PATH | --text=MARKDOWN');
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
  let body = opts.text;
  if (opts.file) body = readFileSync(opts.file, 'utf8');
  if (!body?.trim()) {
    console.error('[cortexloop] provide --file or --text');
    process.exit(2);
  }
  const meta = loadRunMeta(opts.metaPath);
  const result = appendReflectionSection({ meta, summaryMarkdown: body });
  console.log(`[cortexloop] appended reflection: ${result.displayTime} → ${result.out}`);
  if (opts.json) console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith('append-reflection.mjs')) {
  main();
}
