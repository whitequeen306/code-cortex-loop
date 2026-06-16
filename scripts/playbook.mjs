#!/usr/bin/env node
/**
 * CodeCortexLoop playbook — query / record / prune learned fix patterns
 *
 * Usage:
 *   node scripts/playbook.mjs query [--category=performance,simplicity] [--lang=js] [--global-merge] [--limit=8]
 *   node scripts/playbook.mjs record [.cortexloop/reflection.json] [--global]
 *   node scripts/playbook.mjs prune [--min-confidence=0.3] [--max-age-days=180] [--max-entries=200] [--global]
 */

import { existsSync } from 'node:fs';
import {
  DEFAULT_PLAYBOOK,
  DEFAULT_REFLECTION,
  GLOBAL_PLAYBOOK,
  loadPlaybook,
  mergePlaybooks,
  nextPlaybookId,
  parseArgs,
  playbookScore,
  playbookSignature,
  readJson,
  savePlaybook,
} from './lib/shared.mjs';

const { positional, flags, getFlagValue } = parseArgs();

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

function cmdQuery() {
  const categories = parseCategories(getFlagValue('--category', null));
  const lang = getFlagValue('--lang', null);
  const limit = Number(getFlagValue('--limit', '8'));
  const format = getFlagValue('--format', 'md');
  const playbookPath = getFlagValue('--playbook', DEFAULT_PLAYBOOK);
  const globalMerge = flags.has('--global-merge');

  let entries = loadPlaybook(playbookPath).entries;
  if (globalMerge && existsSync(GLOBAL_PLAYBOOK)) {
    entries = mergePlaybooks(loadPlaybook(playbookPath), loadPlaybook(GLOBAL_PLAYBOOK));
  }

  entries = filterEntries(entries, categories, lang);
  entries.sort((a, b) => playbookScore(b) - playbookScore(a));
  entries = entries.slice(0, limit);

  if (!entries.length) {
    console.log('[cortexloop] Playbook: no matching entries (analysis proceeds normally).');
    return;
  }

  if (format === 'json') {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  console.log('# CodeCortexLoop Playbook — known patterns (suggestions, not mandatory)\n');
  for (const e of entries) {
    console.log(`## ${e.signature} (${e.id})`);
    console.log(`- **Category:** ${e.category}`);
    console.log(`- **Problem:** ${e.problemPattern}`);
    console.log(`- **Fix method:** ${e.fixMethod}`);
    console.log(`- **Confidence:** ${(e.confidence ?? 0.5).toFixed(2)} | **Applied:** ${e.appliedCount ?? 1}x`);
    if (e.examples?.length) console.log(`- **Examples:** ${e.examples.join(', ')}`);
    console.log('');
  }
  console.log('_Apply only after verification — see rules/learning-loop.mdc_');
}

function upsertReflectionIntoPlaybook(playbook, reflectionEntries, source = 'direct-fix') {
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const raw of reflectionEntries) {
    const signature = playbookSignature(raw);
    let entry = playbook.entries.find((e) => e.signature === signature);

    if (entry) {
      entry.appliedCount = (entry.appliedCount || 0) + 1;
      entry.confidence = Math.min(0.95, (entry.confidence || 0.5) + 0.1);
      entry.lastUsed = now;
      if (raw.example && !(entry.examples || []).includes(raw.example)) {
        entry.examples = [...(entry.examples || []), raw.example];
      }
      updated++;
    } else {
      entry = {
        id: nextPlaybookId(playbook.entries),
        signature,
        category: raw.category || 'unknown',
        language: raw.language || 'any',
        problemPattern: raw.problemPattern,
        fixMethod: raw.fixMethod,
        appliedCount: 1,
        confidence: 0.5,
        createdAt: now,
        lastUsed: now,
        examples: raw.example ? [raw.example] : [],
        source,
      };
      playbook.entries.push(entry);
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
  const { added, updated } = upsertReflectionIntoPlaybook(
    playbook,
    entries,
    reflection.mode || 'direct-fix',
  );
  savePlaybook(playbookPath, playbook);
  console.log(`[cortexloop] Playbook updated -> ${playbookPath}`);
  console.log(`  added: ${added}, updated: ${updated}, total: ${playbook.entries.length}`);

  if (alsoGlobal) {
    const globalPb = loadPlaybook(GLOBAL_PLAYBOOK);
    const g = upsertReflectionIntoPlaybook(globalPb, entries, reflection.mode || 'direct-fix');
    savePlaybook(GLOBAL_PLAYBOOK, globalPb);
    console.log(`[cortexloop] Global playbook updated -> ${GLOBAL_PLAYBOOK}`);
    console.log(`  added: ${g.added}, updated: ${g.updated}, total: ${globalPb.entries.length}`);
  }
}

function cmdPrune() {
  const minConf = Number(getFlagValue('--min-confidence', '0.3'));
  const maxAgeDays = Number(getFlagValue('--max-age-days', '180'));
  const maxEntries = Number(getFlagValue('--max-entries', '200'));
  const playbookPath = flags.has('--global') ? GLOBAL_PLAYBOOK : getFlagValue('--playbook', DEFAULT_PLAYBOOK);

  const playbook = loadPlaybook(playbookPath);
  const before = playbook.entries.length;
  const cutoff = Date.now() - maxAgeDays * 86400000;

  playbook.entries = playbook.entries.filter((e) => {
    if ((e.confidence ?? 0.5) < minConf) return false;
    if (e.lastUsed && Date.parse(e.lastUsed) < cutoff) return false;
    return true;
  });

  if (playbook.entries.length > maxEntries) {
    playbook.entries.sort((a, b) => playbookScore(b) - playbookScore(a));
    playbook.entries = playbook.entries.slice(0, maxEntries);
  }

  savePlaybook(playbookPath, playbook);
  const removed = before - playbook.entries.length;
  console.log(`[cortexloop] Playbook pruned -> ${playbookPath}`);
  console.log(`  removed: ${removed}, remaining: ${playbook.entries.length}`);
}

const command = positional[0];
if (!command || !['query', 'record', 'prune'].includes(command)) {
  console.error('Usage: node scripts/playbook.mjs <query|record|prune> [...]');
  process.exit(1);
}

if (command === 'query') cmdQuery();
else if (command === 'record') cmdRecord();
else if (command === 'prune') cmdPrune();
