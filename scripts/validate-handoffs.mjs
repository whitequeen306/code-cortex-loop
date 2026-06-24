#!/usr/bin/env node
/**
 * Validate .cortexloop/handoff/*.json against pass-handoff schema rules.
 * Fail-fast when passes are missing or handoffs are invalid.
 *
 * Usage:
 *   node scripts/validate-handoffs.mjs [--handoff-dir=.cortexloop/handoff] [--config=cortexloop.config.json]
 * Exit: 0 ok, 1 validation errors, 2 usage/config error
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  DEFAULT_HANDOFF_DIR,
  getEnabledPipeline,
  validatePassHandoff,
  loadPassesConfig,
} from './lib/shared.mjs';

function parseArgs(argv) {
  const opts = {
    handoffDir: DEFAULT_HANDOFF_DIR,
    configPath: 'cortexloop.config.json',
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--handoff-dir=')) opts.handoffDir = arg.slice('--handoff-dir='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/validate-handoffs.mjs [--handoff-dir=DIR] [--config=PATH]`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return opts;
}

function loadPassesConfigFromOpts(configPath) {
  try {
    return loadPassesConfig(configPath);
  } catch (err) {
    console.error(`Failed to read config ${configPath}: ${err.message}`);
    process.exit(2);
  }
}

function loadHandoffFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return { __parseError: err.message };
  }
}

function handoffPath(handoffDir, step) {
  return join(handoffDir, basename(step.handoffFile));
}

export function validateHandoffs({ handoffDir = DEFAULT_HANDOFF_DIR, passesConfig = {} } = {}) {
  const enabled = getEnabledPipeline(passesConfig);
  const errors = [];
  const warnings = [];
  const validated = [];

  for (const step of enabled) {
    const filePath = handoffPath(handoffDir, step);
    const fileName = basename(filePath);

    if (!existsSync(filePath)) {
      errors.push({
        type: 'missing',
        pass: step.passKey,
        order: step.order,
        expert: step.expert,
        file: filePath,
        message: `Missing handoff for pass ${step.order} (${step.passKey}): ${filePath}`,
      });
      continue;
    }

    const handoff = loadHandoffFile(filePath);
    if (handoff.__parseError) {
      errors.push({
        type: 'parse',
        pass: step.passKey,
        file: filePath,
        message: `Invalid JSON in ${filePath}: ${handoff.__parseError}`,
      });
      continue;
    }

    const schemaErr = validatePassHandoff(handoff);
    if (schemaErr) {
      errors.push({
        type: 'schema',
        pass: step.passKey,
        file: filePath,
        message: `${fileName}: ${schemaErr}`,
      });
      continue;
    }

    if (handoff.pass !== step.passKey) {
      warnings.push(`${fileName}: pass key "${handoff.pass}" does not match expected "${step.passKey}"`);
    }
    if (handoff.category !== step.category) {
      warnings.push(`${fileName}: category "${handoff.category}" does not match expected "${step.category}"`);
    }
    if (handoff.expert !== step.expert) {
      warnings.push(`${fileName}: expert "${handoff.expert}" does not match expected "${step.expert}"`);
    }

    validated.push({ step, file: filePath, handoff });
  }

  // Orphan handoffs (not in enabled pipeline)
  if (existsSync(handoffDir)) {
    const expected = new Set(enabled.map((s) => basename(s.handoffFile)));
    for (const name of readdirSync(handoffDir).filter((f) => f.endsWith('.json'))) {
      if (!expected.has(name)) {
        warnings.push(`Unexpected handoff file (not in enabled pipeline): ${join(handoffDir, name)}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    enabledCount: enabled.length,
    validatedCount: validated.length,
    errors,
    warnings,
    validated,
    enabled,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const passesConfig = loadPassesConfigFromOpts(opts.configPath);
  const result = validateHandoffs({ handoffDir: opts.handoffDir, passesConfig });

  if (!opts.quiet) {
    console.log(`CodeCortexLoop handoff validation: ${result.validatedCount}/${result.enabledCount} passes OK`);
    for (const w of result.warnings) console.warn(`  warn: ${w}`);
    for (const e of result.errors) console.error(`  error: ${e.message}`);
  }

  if (!result.ok) {
    if (opts.quiet && result.errors.length) {
      for (const e of result.errors) console.error(e.message);
    }
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1]?.endsWith('validate-handoffs.mjs')) {
  main();
}
