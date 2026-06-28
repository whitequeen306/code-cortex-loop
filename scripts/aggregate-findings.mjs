#!/usr/bin/env node
/**
 * CodeCortexLoop finding aggregation — merge findings from all enabled-pass
 * handoffs into a deduplicated list keyed by the same fingerprint baseline.mjs
 * uses, preserving evidence/confidence and attaching provenance.
 *
 * This is the machine-checked half of Step 4 ("Merge findings … Deduplicate
 * same file:line + issue"). The orchestrator LLM still assigns CL-### IDs and
 * applies suppressions; this script guarantees the merge is deterministic and
 * that cross-domain duplicates stay traceable.
 *
 * Usage:
 *   node scripts/aggregate-findings.mjs [--handoff-dir=DIR] [--config=PATH] [--out=FILE] [--orphans=FILE] [--json]
 *
 * --orphans points at the collect-orphan-defers.mjs output so findings added
 * during Step 3.5 cross-validation recycle get an orphanId in provenance.
 */
import { existsSync } from 'node:fs';
import {
  DEFAULT_AGGREGATED_FINDINGS,
  DEFAULT_HANDOFF_DIR,
  DEFAULT_ORPHAN_DEFERS,
  aggregateFindings,
  loadPassesConfig,
  parseArgs,
  readJson,
  writeJson,
} from './lib/shared.mjs';

const { positional, flags, getFlagValue } = parseArgs();
const handoffDir = getFlagValue('--handoff-dir', DEFAULT_HANDOFF_DIR);
const configPath = getFlagValue('--config', 'cortexloop.config.json');
const outPath = getFlagValue('--out', DEFAULT_AGGREGATED_FINDINGS);
const orphansPath = getFlagValue('--orphans', DEFAULT_ORPHAN_DEFERS);
const asJson = flags.has('--json');
const quiet = flags.has('--quiet');

if (flags.has('--help') || flags.has('-h')) {
  console.log(
    'Usage: node scripts/aggregate-findings.mjs [--handoff-dir=DIR] [--config=PATH] [--out=FILE] [--orphans=FILE] [--json]',
  );
  process.exit(0);
}

let passesConfig = {};
try {
  passesConfig = loadPassesConfig(configPath);
} catch (err) {
  console.error(`Failed to read config ${configPath}: ${err.message}`);
  process.exit(2);
}

let orphans = [];
if (existsSync(orphansPath)) {
  try {
    const payload = readJson(orphansPath);
    orphans = Array.isArray(payload?.orphans) ? payload.orphans : [];
  } catch (err) {
    console.error(`Failed to read orphans ${orphansPath}: ${err.message}`);
    process.exit(2);
  }
}

const result = aggregateFindings({ handoffDir, passesConfig, orphans });
const payload = {
  generatedAt: new Date().toISOString(),
  findingCount: result.findings.length,
  findings: result.findings,
};
writeJson(outPath, payload);

if (asJson) {
  console.log(JSON.stringify(payload, null, 2));
} else if (!quiet) {
  console.log(`[cortexloop] Aggregated findings: ${result.findings.length} -> ${outPath}`);
  const withProvenance = result.findings.filter((f) => f.provenance?.sources?.length > 0).length;
  const fromOrphans = result.findings.filter((f) => f.provenance?.orphanId).length;
  if (withProvenance > 0) {
    console.log(`  cross-domain duplicates merged: ${withProvenance}`);
  }
  if (fromOrphans > 0) {
    console.log(`  from Step 3.5 cross-validation: ${fromOrphans}`);
  }
}

process.exit(0);
