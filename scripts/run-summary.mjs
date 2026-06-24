#!/usr/bin/env node
/**
 * Summarize a CodeCortexLoop run from handoff JSON files.
 * Prints pass count, duration, and estimated token usage.
 *
 * Usage:
 *   node scripts/run-summary.mjs [--handoff-dir=.cortexloop/handoff] [--out=docs/cortexloop/run-summary.md]
 */
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import {
  DEFAULT_HANDOFF_DIR,
  getEnabledPipeline,
  loadPassesConfig,
} from './lib/shared.mjs';

/** Rough chars-per-token estimate for English/JSON mixed content. */
const CHARS_PER_TOKEN = 4;

function parseArgs(argv) {
  const opts = {
    handoffDir: DEFAULT_HANDOFF_DIR,
    configPath: 'cortexloop.config.json',
    outPath: 'docs/cortexloop/run-summary.md',
    jsonOut: null,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--handoff-dir=')) opts.handoffDir = arg.slice('--handoff-dir='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg.startsWith('--out=')) opts.outPath = arg.slice('--out='.length);
    else if (arg.startsWith('--json-out=')) opts.jsonOut = arg.slice('--json-out='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/run-summary.mjs [--out=PATH] [--json-out=PATH]`);
      process.exit(0);
    }
  }
  return opts;
}

function readPassesConfigLenient(configPath) {
  try {
    return loadPassesConfig(configPath);
  } catch {
    return {};
  }
}

function fileBytes(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function parseTimestamp(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

export function summarizeRun({ handoffDir = DEFAULT_HANDOFF_DIR, passesConfig = {}, runStartedAt = null } = {}) {
  const enabled = getEnabledPipeline(passesConfig);
  const passes = [];
  let totalHandoffBytes = 0;
  let categoryReportBytes = 0;
  const timestamps = [];

  for (const step of enabled) {
    const handoffPath = join(handoffDir, basename(step.handoffFile));
    const exists = existsSync(handoffPath);
    let handoff = null;
    let generatedAt = null;
    let handoffBytes = 0;

    if (exists) {
      handoffBytes = fileBytes(handoffPath);
      totalHandoffBytes += handoffBytes;
      try {
        handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
        generatedAt = handoff.generatedAt ?? handoff.timestamp ?? null;
        const ts = parseTimestamp(generatedAt);
        if (ts != null) timestamps.push(ts);
      } catch {
        handoff = null;
      }
    }

    const reportPath = step.categoryReport;
    const reportBytes = existsSync(reportPath) ? fileBytes(reportPath) : 0;
    categoryReportBytes += reportBytes;

    passes.push({
      order: step.order,
      passKey: step.passKey,
      category: step.category,
      expert: step.expert,
      handoffFile: handoffPath,
      present: exists,
      findingCount: handoff?.findings?.length ?? 0,
      generatedAt,
      handoffBytes,
      reportBytes,
    });
  }

  const executed = passes.filter((p) => p.present);
  const skipped = passes.filter((p) => !p.present);

  let durationMs = null;
  if (timestamps.length >= 2) {
    durationMs = Math.max(...timestamps) - Math.min(...timestamps);
  } else if (runStartedAt && timestamps.length === 1) {
    const start = parseTimestamp(runStartedAt);
    if (start != null) durationMs = timestamps[0] - start;
  }

  const estimatedOutputTokens = Math.ceil((totalHandoffBytes + categoryReportBytes) / CHARS_PER_TOKEN);
  const estimatedTotalTokens = estimatedOutputTokens * 5;

  return {
    generatedAt: new Date().toISOString(),
    enabledPassCount: enabled.length,
    executedPassCount: executed.length,
    skippedPassCount: skipped.length,
    skippedPasses: skipped.map((p) => p.passKey),
    durationMs,
    durationHuman: durationMs != null ? formatDuration(durationMs) : 'unknown (add generatedAt to handoffs)',
    handoffBytes: totalHandoffBytes,
    categoryReportBytes,
    estimatedOutputTokens,
    estimatedTotalTokens,
    estimationNote:
      'Token counts are rough estimates from artifact byte size (÷4 chars/token). Actual LLM usage varies by scope and model.',
    passes,
  };
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min}m ${rem}s` : `${min}m`;
}

function renderMarkdown(summary) {
  const lines = [
    '# CodeCortexLoop Run Summary',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Passes executed | ${summary.executedPassCount} / ${summary.enabledPassCount} |`,
    `| Passes skipped | ${summary.skippedPassCount}${summary.skippedPasses.length ? ` (${summary.skippedPasses.join(', ')})` : ''} |`,
    `| Pipeline duration | ${summary.durationHuman} |`,
    `| Handoff artifact size | ${summary.handoffBytes} bytes |`,
    `| Category report size | ${summary.categoryReportBytes} bytes |`,
    `| Est. output tokens | ~${summary.estimatedOutputTokens.toLocaleString()} |`,
    `| Est. total tokens | ~${summary.estimatedTotalTokens.toLocaleString()} (5× output heuristic) |`,
    '',
    `> ${summary.estimationNote}`,
    '',
    '## Per-pass',
    '',
    '| # | Pass | Expert | Findings | Handoff |',
    '|---|------|--------|----------|---------|',
  ];

  for (const p of summary.passes) {
    const status = p.present ? `${p.findingCount}` : '— (missing)';
    lines.push(`| ${p.order} | ${p.passKey} | ${p.expert} | ${status} | ${basename(p.handoffFile)} |`);
  }

  lines.push('');
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const passesConfig = readPassesConfigLenient(opts.configPath);
  const summary = summarizeRun({ handoffDir: opts.handoffDir, passesConfig });

  const md = renderMarkdown(summary);
  if (opts.outPath) {
    mkdirSync(dirname(opts.outPath), { recursive: true });
    writeFileSync(opts.outPath, md, 'utf8');
  }
  if (opts.jsonOut) {
    mkdirSync(dirname(opts.jsonOut), { recursive: true });
    writeFileSync(opts.jsonOut, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  if (!opts.quiet) {
    console.log('CodeCortexLoop run summary');
    console.log(`  Passes: ${summary.executedPassCount}/${summary.enabledPassCount} executed`);
    console.log(`  Duration: ${summary.durationHuman}`);
    console.log(`  Est. tokens: ~${summary.estimatedTotalTokens.toLocaleString()} (${summary.estimationNote})`);
    if (opts.outPath) console.log(`  Wrote: ${opts.outPath}`);
  }
}

if (process.argv[1]?.endsWith('run-summary.mjs')) {
  main();
}
