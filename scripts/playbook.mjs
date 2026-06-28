#!/usr/bin/env node
/**
 * CodeCortexLoop playbook — learned fix patterns with an anti-hallucination
 * trust model. Memory is RECALL (where to look), not AUTHORITY (what to
 * conclude): every hit is still re-derived and re-verified.
 *
 * Trust model:
 *   - Two tiers: `candidate` (unconfirmed hypothesis) and `verified` (trusted).
 *   - Confidence moves only on verified OUTCOMES, including negative signals.
 *   - External oracles (CI / human) outweigh self-reported success.
 *   - Promotion needs diverse + verified evidence (>=N successes in >=M contexts).
 *   - Trust decays over time until re-validated.
 *
 * Usage:
 *   node scripts/playbook.mjs query   [--category=a,b] [--lang=js] [--global-merge]
 *                                     [--limit=8] [--include-candidates] [--format=md|json]
 *   node scripts/playbook.mjs record  [.cortexloop/reflection.json] [--global]
 *   node scripts/playbook.mjs feedback --signature=<sig> --outcome=external_verified|self_verified|rejected|failed
 *                                     [--context=<key>] [--evidence=<note>] [--global]
 *   node scripts/playbook.mjs prune   [--min-confidence=0.3] [--max-age-days=180]
 *                                     [--max-entries=200] [--drop-quarantined] [--global]
 *   node scripts/playbook.mjs export-zh [--playbook=.cortexloop/playbook.json]
 */

import { existsSync } from 'node:fs';
import {
  DEFAULT_PLAYBOOK,
  DEFAULT_REFLECTION,
  GLOBAL_PLAYBOOK,
  OUTCOME_DELTAS,
  PLAYBOOK_DEFAULTS,
  applyOutcome,
  decayedConfidence,
  loadPlaybook,
  mergePlaybooks,
  parseArgs,
  playbookScore,
  playbookSignature,
  readJson,
  savePlaybook,
  savePlaybookZh,
  playbookZhPathFrom,
  nextPlaybookId,
} from './lib/shared.mjs';

const { positional, flags, getFlagValue } = parseArgs();

function resolvePlaybookPath() {
  if (flags.has('--global')) return GLOBAL_PLAYBOOK;
  return getFlagValue('--playbook', DEFAULT_PLAYBOOK);
}

function parseCategories(raw) {
  if (!raw) return null;
  return raw.split(',').map((c) => c.trim()).filter(Boolean);
}

function filterEntries(entries, categories, lang) {
  return entries.filter((e) => {
    if (categories?.length && !categories.includes(e.category)) return false;
    if (lang && e.language && e.language !== 'any' && e.language !== lang) return false;
    return true;
  });
}

function fileOf(example) {
  if (!example) return null;
  return String(example).replace(/:\d+(:\d+)?$/, '');
}

function printEntry(e) {
  const conf = decayedConfidence(e).toFixed(2);
  console.log(`## ${e.signature} (${e.id}) — ${e.tier || 'candidate'}`);
  console.log(`- **Category:** ${e.category}`);
  console.log(`- **Problem to investigate:** ${e.problemPattern}`);
  console.log(`- **Fix method (re-derive & verify, do not paste):** ${e.fixMethod}`);
  console.log(`- **Confidence:** ${conf} | **Verified:** ${e.verifiedCount ?? 0}x in ${(e.distinctContexts || []).length} context(s)` +
    (e.failedCount ? ` | **Failures:** ${e.failedCount}` : ''));
  if (e.examples?.length) console.log(`- **Examples:** ${e.examples.join(', ')}`);
  console.log('');
}

function cmdQuery() {
  const categories = parseCategories(getFlagValue('--category', null));
  const lang = getFlagValue('--lang', null);
  const limit = Number(getFlagValue('--limit', '8'));
  const format = getFlagValue('--format', 'md');
  const playbookPath = getFlagValue('--playbook', DEFAULT_PLAYBOOK);
  const globalMerge = flags.has('--global-merge');
  const includeCandidates = flags.has('--include-candidates');

  const projectPbExists = existsSync(playbookPath);
  const projectPb = loadPlaybook(playbookPath);
  let entries = projectPb.entries;
  const globalExists = globalMerge && existsSync(GLOBAL_PLAYBOOK);
  if (globalExists) {
    entries = mergePlaybooks(projectPb, loadPlaybook(GLOBAL_PLAYBOOK));
  }

  entries = filterEntries(entries, categories, lang)
    .filter((e) => (e.tier || 'candidate') !== 'quarantined');
  entries.sort((a, b) => playbookScore(b) - playbookScore(a));

  const verified = entries.filter((e) => e.tier === 'verified').slice(0, limit);
  const candidates = entries.filter((e) => e.tier !== 'verified').slice(0, limit);

  if (format === 'json') {
    console.log(JSON.stringify(includeCandidates ? [...verified, ...candidates] : verified, null, 2));
    return;
  }

  if (!verified.length && !(includeCandidates && candidates.length)) {
    // First-run guidance: the playbook has no recallable entries yet. Tell the
    // user how the memory loop closes instead of silently printing "no match".
    const playbookEmpty = !projectPbExists && !globalExists;
    console.log('[cortexloop] Playbook: no trusted entries match (analysis proceeds normally).');
    if (candidates.length) {
      console.log(`  (${candidates.length} unconfirmed candidate(s) available via --include-candidates)`);
    }
    if (playbookEmpty) {
      console.log('');
      console.log('  ── First run? Your playbook is empty. ──');
      console.log('  The memory loop fills like this:');
      console.log('    1. Run /cortexloop in Direct mode (applies fixes with test-after-each-group).');
      console.log('    2. Run /cortexloop-reflect — writes .cortexloop/reflection.json from what you fixed.');
      console.log('    3. Run: node scripts/playbook.mjs record .cortexloop/reflection.json');
      console.log('       (add --global to also record to ~/.cortexloop/playbook.json)');
      console.log('  Next run, Step 0.5 query will surface verified patterns here.');
      console.log('  Example playbook: examples/demo-app/.cortexloop/playbook.json');
    }
    return;
  }

  console.log('# CodeCortexLoop Playbook — recall, not authority\n');
  console.log('_These are leads on WHERE to look. Re-derive and re-verify every fix; never paste from memory._\n');

  if (verified.length) {
    console.log('## ✅ Verified patterns (trusted recall)\n');
    for (const e of verified) printEntry(e);
  }

  if (includeCandidates && candidates.length) {
    console.log('## ⚠️ Candidate patterns (UNCONFIRMED hypotheses — do NOT apply, treat as guesses)\n');
    for (const e of candidates) printEntry(e);
  }

  console.log('_Hits must pass refactor-safety + tests. See rules/learning-loop.mdc_');
}

function persistPlaybook(playbookPath, playbook) {
  savePlaybook(playbookPath, playbook);
  const zhPath = savePlaybookZh(playbookPath, playbook);
  return zhPath;
}

// record = positive self_verified signal from a Direct re-verify pass.
function recordSelfVerified(playbook, reflectionEntries) {
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const bySig = new Map((playbook.entries || []).map((e) => [e.signature, e]));

  for (const raw of reflectionEntries) {
    const signature = playbookSignature(raw);
    const context = raw.context || fileOf(raw.example) || 'local';
    let entry = bySig.get(signature);

    if (entry) {
      entry.appliedCount = (entry.appliedCount || 0) + 1;
      if (raw.example && !(entry.examples || []).includes(raw.example)) {
        entry.examples = [...(entry.examples || []), raw.example];
      }
      if (raw.problemPatternZh) entry.problemPatternZh = raw.problemPatternZh;
      if (raw.fixMethodZh) entry.fixMethodZh = raw.fixMethodZh;
      applyOutcome(entry, 'self_verified', { context, now });
      updated++;
    } else {
      entry = {
        id: nextPlaybookId(playbook.entries),
        signature,
        category: raw.category || 'unknown',
        language: raw.language || 'any',
        problemPattern: raw.problemPattern,
        fixMethod: raw.fixMethod,
        problemPatternZh: raw.problemPatternZh || null,
        fixMethodZh: raw.fixMethodZh || null,
        tier: 'candidate',
        confidence: PLAYBOOK_DEFAULTS.newConfidence,
        appliedCount: 1,
        verifiedCount: 0,
        rejectedCount: 0,
        failedCount: 0,
        distinctContexts: [],
        createdAt: now,
        lastUsed: now,
        examples: raw.example ? [raw.example] : [],
        source: 'direct-fix',
      };
      applyOutcome(entry, 'self_verified', { context, now });
      playbook.entries.push(entry);
      bySig.set(signature, entry);
      added++;
    }
  }
  return { added, updated };
}

function cmdRecord() {
  const reflectionPath = positional[1] || DEFAULT_REFLECTION;
  const playbookPath = getFlagValue('--playbook', DEFAULT_PLAYBOOK);
  const alsoGlobal = flags.has('--global');

  if (!existsSync(reflectionPath)) {
    console.error(`[cortexloop] Reflection not found: ${reflectionPath}`);
    process.exit(1);
  }

  const reflection = readJson(reflectionPath);
  const entries = reflection.entries || [];
  if (!entries.length) {
    console.log('[cortexloop] Reflection has no entries — nothing to record.');
    return;
  }

  const playbook = loadPlaybook(playbookPath);
  const { added, updated } = recordSelfVerified(playbook, entries);

  if (alsoGlobal) {
    const globalPb = loadPlaybook(GLOBAL_PLAYBOOK);
    const globalBackup = structuredClone(globalPb);
    recordSelfVerified(globalPb, entries);
    try {
      savePlaybook(GLOBAL_PLAYBOOK, globalPb);
      savePlaybookZh(GLOBAL_PLAYBOOK, globalPb);
    } catch (err) {
      console.error(`[cortexloop] Failed to save global playbook: ${err.message}`);
      process.exit(1);
    }
    try {
      persistPlaybook(playbookPath, playbook);
    } catch (err) {
      try {
        savePlaybook(GLOBAL_PLAYBOOK, globalBackup);
        console.error('[cortexloop] Project playbook save failed — global playbook rolled back');
      } catch (rollbackErr) {
        console.error(`[cortexloop] Project save failed AND rollback failed: ${rollbackErr.message}`);
      }
      console.error(`[cortexloop] Failed to save project playbook: ${err.message}`);
      process.exit(1);
    }
    console.log(`[cortexloop] Playbook updated -> ${playbookPath}`);
    console.log(`  added: ${added}, updated: ${updated}, total: ${playbook.entries.length} (new entries start as candidates)`);
    console.log(`[cortexloop] Playbook (中文) -> ${playbookZhPathFrom(playbookPath)}`);
    console.log(`[cortexloop] Global playbook updated -> ${GLOBAL_PLAYBOOK}`);
    console.log(`[cortexloop] Global playbook (中文) -> ${playbookZhPathFrom(GLOBAL_PLAYBOOK)}`);
    console.log(`  total: ${globalPb.entries.length}`);
    return;
  }

  const zhPath = persistPlaybook(playbookPath, playbook);
  console.log(`[cortexloop] Playbook updated -> ${playbookPath}`);
  console.log(`[cortexloop] Playbook (中文) -> ${zhPath}`);
  console.log(`  added: ${added}, updated: ${updated}, total: ${playbook.entries.length} (new entries start as candidates)`);
}

// feedback = outcome signal from an external oracle (CI / human) or a
// negative result (rejected suggestion / failed-and-reverted fix).
function cmdFeedback() {
  const outcome = getFlagValue('--outcome', null);
  if (!outcome || !(outcome in OUTCOME_DELTAS)) {
    console.error(`[cortexloop] --outcome must be one of: ${Object.keys(OUTCOME_DELTAS).join(', ')}`);
    process.exit(1);
  }

  let signature = getFlagValue('--signature', null);
  if (!signature) {
    const category = getFlagValue('--category', null);
    const problemPattern = getFlagValue('--problem', null);
    const language = getFlagValue('--lang', null);
    if (category && problemPattern) {
      signature = playbookSignature({ category, problemPattern, language });
    }
  }
  if (!signature) {
    console.error('[cortexloop] Provide --signature, or --category and --problem (with optional --lang).');
    process.exit(1);
  }

  const context = getFlagValue('--context', null);
  const evidence = getFlagValue('--evidence', null);
  const playbookPath = resolvePlaybookPath();

  const playbook = loadPlaybook(playbookPath);
  const entry = playbook.entries.find((e) => e.signature === signature);
  if (!entry) {
    console.error(`[cortexloop] No entry with signature: ${signature}`);
    process.exit(1);
  }

  const beforeTier = entry.tier || 'candidate';
  const beforeConf = (entry.confidence ?? PLAYBOOK_DEFAULTS.newConfidence).toFixed(2);
  applyOutcome(entry, outcome, { context, evidence });
  const zhPath = persistPlaybook(playbookPath, playbook);

  console.log(`[cortexloop] Feedback '${outcome}' applied -> ${signature}`);
  console.log(`  confidence: ${beforeConf} -> ${entry.confidence.toFixed(2)} | tier: ${beforeTier} -> ${entry.tier}`);
  console.log(`  verified: ${entry.verifiedCount ?? 0} in ${(entry.distinctContexts || []).length} context(s)` +
    (entry.failedCount ? `, failures: ${entry.failedCount}` : ''));
  console.log(`[cortexloop] Playbook (中文) -> ${zhPath}`);
}

function cmdPrune() {
  const minConf = Number(getFlagValue('--min-confidence', '0.3'));
  const maxAgeDays = Number(getFlagValue('--max-age-days', '180'));
  const maxEntries = Number(getFlagValue('--max-entries', '200'));
  const dropQuarantined = flags.has('--drop-quarantined');
  const playbookPath = resolvePlaybookPath();

  const playbook = loadPlaybook(playbookPath);
  const before = playbook.entries.length;
  const now = Date.now();
  const cutoff = now - maxAgeDays * 86400000;

  playbook.entries = playbook.entries.filter((e) => {
    // Prune on decayed (effective) confidence so stale trust is dropped.
    if (decayedConfidence(e, now) < minConf) return false;
    if (e.lastUsed && Date.parse(e.lastUsed) < cutoff) return false;
    if (dropQuarantined && (e.tier || 'candidate') === 'quarantined') return false;
    return true;
  });

  if (playbook.entries.length > maxEntries) {
    playbook.entries.sort((a, b) => playbookScore(b) - playbookScore(a));
    playbook.entries = playbook.entries.slice(0, maxEntries);
  }

  const zhPath = persistPlaybook(playbookPath, playbook);
  const removed = before - playbook.entries.length;
  console.log(`[cortexloop] Playbook pruned -> ${playbookPath}`);
  console.log(`[cortexloop] Playbook (中文) -> ${zhPath}`);
  console.log(`  removed: ${removed}, remaining: ${playbook.entries.length}`);
}

function cmdExportZh() {
  const playbookPath = getFlagValue('--playbook', DEFAULT_PLAYBOOK);
  const playbook = loadPlaybook(playbookPath);
  const zhPath = savePlaybookZh(playbookPath, playbook);
  console.log(`[cortexloop] Playbook (中文) exported -> ${zhPath}`);
  console.log(`  entries: ${playbook.entries.length}`);
}

const command = positional[0];
const COMMANDS = ['query', 'record', 'feedback', 'prune', 'export-zh'];
if (!command || !COMMANDS.includes(command)) {
  console.error(`Usage: node scripts/playbook.mjs <${COMMANDS.join('|')}> [...]`);
  process.exit(1);
}

if (command === 'query') cmdQuery();
else if (command === 'record') cmdRecord();
else if (command === 'feedback') cmdFeedback();
else if (command === 'prune') cmdPrune();
else if (command === 'export-zh') cmdExportZh();
