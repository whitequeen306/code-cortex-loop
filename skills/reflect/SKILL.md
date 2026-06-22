---
name: reflect-and-learn
description: After Direct-mode fixes, summarize what changed and record reusable problem→fix patterns into the playbook. Use when CodeCortexLoop Direct mode completes successfully, or when manually invoked via /cortexloop-reflect.
---

# Reflect and Learn

> CodeCortexLoop v2.2 — turn successful Direct fixes into reusable playbook memory.

## Overview

After a Direct-mode run (or manual reflect), produce a **human retrospective** and a **structured reflection** that `playbook.mjs record` can upsert into `.cortexloop/playbook.json`.

Playbook entries are **recall, not authority** — new entries start as **candidate** until diverse verified evidence promotes them. Never skip analysis or blindly apply stored fixes.

## When to Use

- **Automatically** after CodeCortexLoop Direct mode completes re-verification successfully
- **Manually** via `/cortexloop-reflect` when you want to capture learnings from a recent fix session
- When you have `docs/cortexloop/report.json` (before/after) and know what was actually fixed

**When NOT to use:**

- Report-only runs with no fixes applied
- Failed or incomplete Direct runs (tests still failing)
- One-off project-specific hacks that cannot generalize

## Inputs

Read before writing:

1. `docs/cortexloop/report.json` — findings marked fixed, before/after scores
2. Git diff or your memory of changes applied in Direct mode
3. `cortexloop.config.json` → `learning` block (paths, global flag)
4. `rules/learning-loop.mdc` — curation and verification policy

## Outputs

### 1. Human retrospective — `docs/cortexloop/08-reflection.md`

Structure:

```markdown
# CodeCortexLoop Reflection — <ISO date>

## Summary
What was fixed, overall score delta, test status.

## Effective fixes
Bullet list of what worked and why.

## Pitfalls / false starts
What did not work or required rework.

## Next time
Concrete reminders for similar codebases.
```

Keep it concise (1–2 screens). Focus on **patterns**, not line-by-line diffs.

### 2. Structured reflection — `.cortexloop/reflection.json`

```json
{
  "runTimestamp": "2026-06-16T12:00:00.000Z",
  "mode": "direct",
  "entries": [
    {
      "category": "performance",
      "language": "js",
      "problemPattern": "N+1 query — related rows fetched inside a loop",
      "fixMethod": "Collect ids first, single WHERE id IN (...) or JOIN, map back",
      "problemPatternZh": "N+1 查询 — 在循环内逐条拉取关联数据",
      "fixMethodZh": "先收集 id，再用 WHERE id IN (...) 或 JOIN 一次查回并映射",
      "example": "src/api.js:6"
    }
  ]
}
```

**Curation rules:**

- Record **3–5 most valuable** generalizable patterns only
- `problemPattern` — describe the **class** of problem in **English** (model recall via `playbook.json`)
- `fixMethod` — describe the **technique** in **English** (model recall; not a literal diff)
- `problemPatternZh` — same pattern class in **Chinese** (for humans reading `playbook-zh.md`)
- `fixMethodZh` — same fix technique in **Chinese** (for humans; not fed to `query`)
- `category` — one of: correctness, security, performance, simplicity, tests, errorHandling, cleanup
- `language` — e.g. `js`, `ts`, `py`, or omit for `any`
- `example` — optional `file:line` pointer

Do **not** record:

- Project-specific business rules
- Temporary workarounds
- Secrets, credentials, or environment-specific config

## Record to Playbook

After writing `reflection.json`, run from project root:

```bash
node scripts/playbook.mjs record .cortexloop/reflection.json
```

If `learning.global` is true in config, append `--global` to also upsert into `~/.cortexloop/playbook.json`.

Confirm output shows added/updated counts and the path to `.cortexloop/playbook-zh.md` (Chinese human-readable export; **not** used by `query`).

## Chinese playbook (human-only)

- **Model:** `.cortexloop/playbook.json` — English entries; `playbook.mjs query` reads this only.
- **Humans:** `.cortexloop/playbook-zh.md` — auto-generated after `record` / `feedback` / `prune`; team-facing Chinese summary with tier sections.
- Re-export anytime: `node scripts/playbook.mjs export-zh`

Always fill **both** English and Chinese fields in `reflection.json` so the zh export is useful without machine translation.

## Quality Checklist

- [ ] Each entry is reusable on a **different** codebase
- [ ] fixMethod is actionable without reading the original diff
- [ ] No duplicate of an existing playbook signature unless the fix genuinely evolved
- [ ] Retrospective mentions verification (tests passed)
- [ ] User knows playbook hits are recall — re-derive and verify; use `feedback --outcome=failed` if a recorded pattern fails later
