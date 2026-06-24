#!/usr/bin/env node
/**
 * Validate orphan defer recycling (Step 3.5) — every backward defer resolved on target handoff.
 *
 * Usage:
 *   node scripts/validate-cross-validation.mjs [--handoff-dir=DIR] [--config=PATH] [--orphans=FILE]
 * Exit: 0 ok (or no orphans), 1 unresolved, 2 usage error
 */
import { existsSync } from 'node:fs';
import {
  DEFAULT_HANDOFF_DIR,
  DEFAULT_ORPHAN_DEFERS,
  validateCrossValidation,
  isCrossValidationEnabled,
  loadPassesConfig,
  readJson,
} from './lib/shared.mjs';

function parseArgs(argv) {
  const opts = {
    handoffDir: DEFAULT_HANDOFF_DIR,
    configPath: 'cortexloop.config.json',
    orphansPath: DEFAULT_ORPHAN_DEFERS,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--handoff-dir=')) opts.handoffDir = arg.slice('--handoff-dir='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg.startsWith('--orphans=')) opts.orphansPath = arg.slice('--orphans='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/validate-cross-validation.mjs [--handoff-dir=DIR] [--config=PATH] [--orphans=FILE]',
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function readPassesConfigCli(configPath) {
  try {
    return loadPassesConfig(configPath);
  } catch (err) {
    console.error(`Failed to read config ${configPath}: ${err.message}`);
    process.exit(2);
  }
}

function loadOrphans(path) {
  if (!existsSync(path)) return null;
  try {
    const data = readJson(path);
    return data.orphans ?? [];
  } catch (err) {
    console.error(`Failed to read orphans file ${path}: ${err.message}`);
    process.exit(2);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!isCrossValidationEnabled(opts.configPath)) {
    if (!opts.quiet) {
      console.log('[cortexloop] Cross-validation disabled in config — skip validation');
    }
    process.exit(0);
  }

  const passesConfig = readPassesConfigCli(opts.configPath);
  const orphans = loadOrphans(opts.orphansPath);

  const result = validateCrossValidation({
    handoffDir: opts.handoffDir,
    passesConfig,
    orphans: orphans ?? undefined,
  });

  if (!opts.quiet) {
    if (result.orphanCount === 0) {
      console.log('[cortexloop] Cross-validation: no orphan defers (skip Step 3.5 dispatch)');
    } else {
      console.log(
        `[cortexloop] Cross-validation: ${result.resolvedCount}/${result.orphanCount} orphan defers resolved`,
      );
    }
    for (const w of result.warnings) console.warn(`  warn: ${w}`);
    for (const e of result.errors) console.error(`  error: ${e}`);
  }

  if (!result.ok) {
    if (opts.quiet && result.errors.length) {
      for (const e of result.errors) console.error(e);
    }
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1]?.endsWith('validate-cross-validation.mjs')) {
  main();
}
