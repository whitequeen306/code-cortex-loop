#!/usr/bin/env node
/**
 * Assess / offer / install optional codegraph deep index before Pass 1.
 *
 * Usage:
 *   node scripts/ensure-codegraph-index.mjs --check [--manifest=PATH] [--ci]
 *   node scripts/ensure-codegraph-index.mjs --record=accept|decline|skipped [--manifest=PATH]
 *   node scripts/ensure-codegraph-index.mjs --install-and-init [--yes] [--root=.]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  detectCodegraphCli,
  detectCodegraphProjectIndex,
  codegraphCliVersion,
  installAndInitCodegraph,
} from './lib/codegraph-install.mjs';
import {
  DEFAULT_SCOPE_MANIFEST,
  loadScopeConfig,
  writeJson,
} from './lib/shared.mjs';

const DEFAULT_CHOICE = '.cortexloop/deep-index-choice.json';

function parseArgs(argv) {
  const opts = {
    check: false,
    installAndInit: false,
    record: null,
    manifest: DEFAULT_SCOPE_MANIFEST,
    choicePath: DEFAULT_CHOICE,
    configPath: 'cortexloop.config.json',
    root: '.',
    ci: false,
    yes: false,
    json: false,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--check') opts.check = true;
    else if (arg === '--install-and-init') opts.installAndInit = true;
    else if (arg === '--ci') opts.ci = true;
    else if (arg === '--yes') opts.yes = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg.startsWith('--record=')) opts.record = arg.slice('--record='.length);
    else if (arg.startsWith('--manifest=')) opts.manifest = arg.slice('--manifest='.length);
    else if (arg.startsWith('--choice-path=')) opts.choicePath = arg.slice('--choice-path='.length);
    else if (arg.startsWith('--config=')) opts.configPath = arg.slice('--config='.length);
    else if (arg.startsWith('--root=')) opts.root = arg.slice('--root='.length);
  }
  if (!opts.check && !opts.installAndInit && !opts.record) opts.check = true;
  return opts;
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Patch manifest.indexStrategy after install/init or user choice.
 * @param {string} manifestPath
 * @param {string} rootDir
 * @param {{ userDecision?: string|null }} [extra]
 */
export function refreshManifestDeepIndexState(manifestPath, rootDir = '.', extra = {}) {
  const manifest = readJson(manifestPath);
  if (!manifest?.indexStrategy?.optionalDeepIndex) return null;

  const cliAvailable = detectCodegraphCli();
  const codegraphPresent = detectCodegraphProjectIndex(rootDir);
  manifest.indexStrategy.optionalDeepIndex.cliAvailable = cliAvailable;
  manifest.indexStrategy.optionalDeepIndex.codegraphPresent = codegraphPresent;
  if (cliAvailable) {
    manifest.indexStrategy.optionalDeepIndex.cliVersion = codegraphCliVersion();
  }
  if (extra.userDecision) {
    manifest.indexStrategy.optionalDeepIndex.userDecision = extra.userDecision;
  }
  manifest.indexStrategy.optionalDeepIndex.offerBeforePass1 =
    Boolean(manifest.indexStrategy.optionalDeepIndex.suggested) &&
    !codegraphPresent &&
    extra.userDecision !== 'decline';

  writeJson(manifestPath, manifest);
  return manifest;
}

/**
 * @param {object} opts
 */
export function assessDeepIndexOffer(opts) {
  const scopeCfg = loadScopeConfig(opts.configPath);
  const manifest = readJson(opts.manifest);
  const choice = readJson(opts.choicePath);
  const cliAvailable = detectCodegraphCli();
  const codegraphPresent = detectCodegraphProjectIndex(opts.root);
  const suggested = Boolean(manifest?.indexStrategy?.optionalDeepIndex?.suggested);

  if (opts.ci || scopeCfg.deepIndexOffer === false) {
    return {
      offer: false,
      reason: opts.ci ? 'ci-mode' : 'disabled-in-config',
      suggested,
      cliAvailable,
      codegraphPresent,
      fileCount: manifest?.fileCount ?? null,
    };
  }

  if (choice?.decision === 'decline') {
    return {
      offer: false,
      reason: 'user-declined',
      suggested,
      cliAvailable,
      codegraphPresent,
      priorChoice: choice,
    };
  }

  if (codegraphPresent) {
    return {
      offer: false,
      reason: 'index-already-present',
      suggested,
      cliAvailable,
      codegraphPresent: true,
      cliVersion: codegraphCliVersion(),
    };
  }

  if (!suggested) {
    return {
      offer: false,
      reason: 'deep-index-not-suggested',
      suggested: false,
      cliAvailable,
      codegraphPresent,
      fileCount: manifest?.fileCount ?? null,
    };
  }

  return {
    offer: true,
    reason: 'large-or-low-confidence-without-codegraph',
    suggested: true,
    cliAvailable,
    codegraphPresent: false,
    fileCount: manifest?.fileCount ?? null,
    deepIndexTargets: manifest?.indexStrategy?.optionalDeepIndex?.deepIndexTargets ?? [],
    prompt:
      'This scope is large or low-confidence. Optional codegraph deep index improves call-chain analysis. Install + init now, or continue with L1 scope-map + grep only?',
    installCommand: 'node scripts/ensure-codegraph-index.mjs --install-and-init --yes',
    declineCommand: 'node scripts/ensure-codegraph-index.mjs --record=decline',
  };
}

function recordChoice(choicePath, decision, meta = {}) {
  const doc = {
    version: '1.0',
    decision,
    decidedAt: new Date().toISOString(),
    ...meta,
  };
  writeJson(choicePath, doc);
  return doc;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.record) {
    if (!['accept', 'decline', 'skipped'].includes(opts.record)) {
      console.error('Invalid --record= value (accept|decline|skipped)');
      process.exit(1);
    }
    const choice = recordChoice(opts.choicePath, opts.record, {
      manifest: opts.manifest,
    });
    refreshManifestDeepIndexState(opts.manifest, opts.root, { userDecision: opts.record });
    if (opts.json) console.log(JSON.stringify({ ok: true, choice }, null, 2));
    else if (!opts.quiet) console.log(`[cortexloop] deep-index choice recorded: ${opts.record}`);
    return;
  }

  if (opts.installAndInit) {
    if (!opts.yes && !opts.ci) {
      console.error('Refusing --install-and-init without --yes (orchestrator must confirm with user first)');
      process.exit(1);
    }
    try {
      const result = installAndInitCodegraph(opts.root);
      recordChoice(opts.choicePath, 'accept', {
        cliInstalled: result.steps.some((s) => s.command?.includes('npm install')),
        indexInitialized: result.indexPresent,
      });
      refreshManifestDeepIndexState(opts.manifest, opts.root, { userDecision: 'accept' });
      if (opts.json) console.log(JSON.stringify({ ok: true, ...result }, null, 2));
      else if (!opts.quiet) {
        console.log(`[cortexloop] codegraph ready — CLI ${result.cliVersion}, index present`);
      }
    } catch (err) {
      console.error(`[cortexloop] codegraph install/init failed: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  const assessment = assessDeepIndexOffer(opts);
  if (opts.json) {
    console.log(JSON.stringify(assessment, null, 2));
    return;
  }
  if (!opts.quiet) {
    if (assessment.offer) {
      console.log('[cortexloop] deep-index offer: YES — ask user before Pass 1');
      console.log(`  reason: ${assessment.reason}`);
      console.log(`  CLI on PATH: ${assessment.cliAvailable}`);
      console.log(`  fileCount: ${assessment.fileCount}`);
    } else {
      console.log(`[cortexloop] deep-index offer: no (${assessment.reason})`);
    }
  }
}

if (process.argv[1]?.endsWith('ensure-codegraph-index.mjs')) {
  main();
}
