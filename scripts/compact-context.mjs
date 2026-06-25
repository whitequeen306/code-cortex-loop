#!/usr/bin/env node
/**
 * Proactive structured context compaction for long /cortexloop runs.
 * Writes context-anchor.md + run-state.json — orchestrator reads these, not full pass history.
 *
 * Usage:
 *   node scripts/compact-context.mjs --init --mode=report|direct [--scope-manifest=PATH]
 *   node scripts/compact-context.mjs --pass=N [--next-pass=N+1] [--status=running|done|failed]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  DEFAULT_CONTEXT_ANCHOR,
  DEFAULT_RUN_STATE,
  DEFAULT_SCOPE_MANIFEST,
  DEFAULT_SCOPE_MAP,
  DEFAULT_HANDOFF_SUMMARY,
  loadPassesConfig,
  readJson,
  summarizeHandoffsThrough,
  writeJson,
} from './lib/shared.mjs';

function parseArgs(argv) {
  const opts = {
    init: false,
    pass: null,
    nextPass: null,
    status: 'running',
    mode: 'report',
    scopeManifest: DEFAULT_SCOPE_MANIFEST,
    scopeMap: DEFAULT_SCOPE_MAP,
    anchorOut: DEFAULT_CONTEXT_ANCHOR,
    stateOut: DEFAULT_RUN_STATE,
    configPath: 'cortexloop.config.json',
    intent: 'CodeCortexLoop sequential expert pipeline',
    json: false,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--init') opts.init = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--pass=')) opts.pass = Number(arg.slice('--pass='.length));
    else if (arg.startsWith('--next-pass=')) opts.nextPass = Number(arg.slice('--next-pass='.length));
    else if (arg.startsWith('--status=')) opts.status = arg.slice('--status='.length);
    else if (arg.startsWith('--mode=')) opts.mode = arg.slice('--mode='.length);
    else if (arg.startsWith('--scope-manifest=')) opts.scopeManifest = arg.slice('--scope-manifest='.length);
    else if (arg.startsWith('--scope-map=')) opts.scopeMap = arg.slice('--scope-map='.length);
    else if (arg.startsWith('--intent=')) opts.intent = arg.slice('--intent='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg.startsWith('--anchor-out=')) opts.anchorOut = arg.slice('--anchor-out='.length);
    else if (arg.startsWith('--state-out=')) opts.stateOut = arg.slice('--state-out='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/compact-context.mjs --init [--mode=report|direct] | --pass=N [--next-pass=M] [--status=running|done|failed]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function readManifestSummary(manifestPath) {
  if (!existsSync(manifestPath)) return { fileCount: null, requiresMap: false };
  try {
    const m = readJson(manifestPath);
    return { fileCount: m.fileCount ?? null, requiresMap: Boolean(m.requiresMap) };
  } catch {
    return { fileCount: null, requiresMap: false };
  }
}

function buildHandoffSummaryPayload(through, configPath) {
  const passesConfig = loadPassesConfig(configPath);
  const summaries = summarizeHandoffsThrough({
    throughOrder: through,
    passesConfig,
  });
  return {
    generatedAt: new Date().toISOString(),
    throughOrder: through,
    summaries,
    totalFindings: summaries.reduce((n, s) => n + (s.findingCount || 0), 0),
    totalDefers: summaries.reduce((n, s) => n + (s.deferCount || 0), 0),
  };
}

function buildAnchor({ intent, mode, manifestPath, scopeMapPath, summaryPayload, completedPasses, nextPass, status }) {
  const { fileCount, requiresMap } = readManifestSummary(manifestPath);
  const lines = [
    '# CodeCortexLoop Context Anchor',
    '',
    '## Current Intent',
    intent,
    '',
    '## Run Mode',
    mode,
    '',
    '## Scope',
    `- manifest: \`${manifestPath}\`${fileCount != null ? ` (${fileCount} files)` : ''}`,
    `- scope-map: \`${existsSync(scopeMapPath) ? scopeMapPath : 'none'}\``,
    requiresMap ? '- **map phase required** before depth passes' : '- map phase not required',
    '',
    '## Completed Passes',
  ];

  if (summaryPayload?.summaries?.length) {
    for (const s of summaryPayload.summaries) {
      if (!s.ok) continue;
      lines.push(
        `- Pass ${s.pass ?? '?'} (${s.expert ?? 'expert'}): ${s.findingCount} findings, ${s.deferCount} defers — ${s.summary}`,
      );
    }
  } else if (completedPasses?.length) {
    for (const p of completedPasses) lines.push(`- Pass ${p} complete (see handoff on disk)`);
  } else {
    lines.push('- none yet');
  }

  lines.push(
    '',
    '## Open Items / Defers',
    summaryPayload
      ? `- total defers so far: ${summaryPayload.totalDefers ?? 0}`
      : '- see `.cortexloop/handoff-summary.json`',
    '',
    '## Next Steps',
    nextPass
      ? `- Launch pass ${nextPass} via Task immediately (do not narrate without Task)`
      : status === 'done'
        ? '- Proceed to Step 3.5 / Step 4 aggregation'
        : '- Continue sequential expert pipeline',
    '',
    '## Orchestrator Rules (context budget)',
    '- Never paste expert reports or handoff JSON into this session',
    '- Verify artifacts on disk only; read `.cortexloop/handoff-summary.json` for status',
    '- One pass per turn: Task → verify → compact-context → Task next pass',
    '',
  );
  return lines.join('\n');
}

export function runCompactContext(opts) {
  let runState = existsSync(opts.stateOut) ? readJson(opts.stateOut) : null;

  if (opts.init) {
    runState = {
      runId: randomBytes(8).toString('hex'),
      startedAt: new Date().toISOString(),
      mode: opts.mode,
      status: 'running',
      scopeManifest: opts.scopeManifest,
      scopeMap: existsSync(opts.scopeMap) ? opts.scopeMap : null,
      completedPasses: [],
      nextPass: 1,
    };
  }

  let summaryPayload = null;
  if (opts.pass != null) {
    summaryPayload = buildHandoffSummaryPayload(opts.pass, opts.configPath);
    writeJson(DEFAULT_HANDOFF_SUMMARY, summaryPayload);
    if (!runState) {
      runState = {
        runId: randomBytes(8).toString('hex'),
        startedAt: new Date().toISOString(),
        mode: opts.mode,
        status: opts.status,
        scopeManifest: opts.scopeManifest,
        scopeMap: existsSync(opts.scopeMap) ? opts.scopeMap : null,
        completedPasses: [],
        nextPass: 1,
      };
    }
    const completed = new Set(runState.completedPasses ?? []);
    completed.add(opts.pass);
    runState.completedPasses = [...completed].sort((a, b) => a - b);
    runState.nextPass = opts.nextPass ?? opts.pass + 1;
    runState.status = opts.status;
    runState.updatedAt = new Date().toISOString();
  }

  if (!runState) {
    throw new Error('Provide --init or --pass=N');
  }

  const anchor = buildAnchor({
    intent: opts.intent,
    mode: runState.mode ?? opts.mode,
    manifestPath: runState.scopeManifest ?? opts.scopeManifest,
    scopeMapPath: runState.scopeMap ?? opts.scopeMap,
    summaryPayload,
    completedPasses: runState.completedPasses,
    nextPass: runState.nextPass,
    status: runState.status,
  });

  writeJson(opts.stateOut, runState);
  mkdirSync(dirname(opts.anchorOut), { recursive: true });
  writeFileSync(opts.anchorOut, anchor, 'utf8');

  return { runState, anchorPath: opts.anchorOut, statePath: opts.stateOut };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    const result = runCompactContext(opts);
    if (!opts.quiet) {
      console.log(`[cortexloop] context anchor → ${result.anchorPath}`);
      console.log(`[cortexloop] run state → ${result.statePath} (nextPass=${result.runState.nextPass})`);
    }
    if (opts.json) console.log(JSON.stringify(result.runState, null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('compact-context.mjs')) {
  main();
}
