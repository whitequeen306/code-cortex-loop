#!/usr/bin/env node
/**
 * Ensure CodeCortexLoop agent markdown files are valid OpenCode subagents.
 * Adds `mode: subagent` to frontmatter when missing (OpenCode requirement).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const agentsDir = process.argv[2];
if (!agentsDir) {
  console.error('[cortexloop] Usage: node patch-opencode-agents.mjs <agents-dir>');
  process.exit(1);
}

let patched = 0;
for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
  const path = join(agentsDir, file);
  let text = readFileSync(path, 'utf8');
  if (!text.startsWith('---')) continue;
  if (/^mode:\s/m.test(text.split('---')[1] || '')) continue;

  const next = text.replace(/^---\r?\n/, '---\nmode: subagent\n');
  if (next !== text) {
    writeFileSync(path, next, 'utf8');
    patched += 1;
  }
}

console.log(`[cortexloop] OpenCode agents patched: ${patched} file(s) in ${agentsDir}`);
