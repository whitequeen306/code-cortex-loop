---
name: reflect-and-learn
description: After Direct-mode fixes, summarize what changed and record reusable problem→fix patterns into the playbook. Use when CodeCortexLoop Direct mode completes successfully, or when manually invoked via /cortexloop-reflect.
---

# Reflect and Learn

> CodeCortexLoop v2.2 — turn successful Direct fixes into reusable playbook memory.

## Overview

After a Direct-mode run (or manual reflect), produce a **human retrospective** and a **structured reflection** that `playbook.mjs record` can upsert into `.cortexloop/playbook.json`.

Playbook entries are **recall, not authority** — new entries start as **candidate** until diverse verified evidence promotes them. Never skip analysis or blindly apply stored fixes.

## Scope (what this skill covers)

| Topic | Authoritative doc |
|-------|-------------------|
| When to run reflect, skip conditions, Step 6 gates (`learning.enabled`, Direct + re-verify) | `commands/cortexloop.md` |
| Manual `/cortexloop-reflect` orchestration | `commands/cortexloop-reflect.md` |
| Playbook trust model, signature, tiers, `feedback` / `prune` | `rules/learning-loop.mdc` |

**This skill covers only:** how to extract generalizable patterns from a successful fix session and write high-quality `08-reflection.md` + `reflection.json`. Do not duplicate CLI or trust-model details here — follow the table above when those questions arise.

## When to Use

- **Automatically** after CodeCortexLoop Direct mode completes re-verification successfully (orchestrator loads this skill in Step 6)
- **Manually** via `/cortexloop-reflect` when you want to capture learnings from a recent fix session
- When you have evidence of what was fixed (ideally `docs/cortexloop/report.json` + git diff)

**When NOT to use:**

- Report-only runs with no fixes applied
- Failed or incomplete Direct runs (tests still failing)
- One-off project-specific hacks that cannot generalize

## Inputs

Read before writing:

1. `docs/cortexloop/report.json` — findings marked fixed, before/after scores
2. Git diff of changes applied in Direct mode (**diff wins** if it disagrees with the report)
3. `.cortexloop/playbook.json` — skim existing entries for authoring-time dedup
4. `cortexloop.config.json` → `learning` block (paths, global flag) — for `record` flags only
5. `rules/learning-loop.mdc` — when unsure whether something belongs in playbook memory

## Extraction procedure

Work in this order:

1. **List fixes** — from `report.json`, collect findings that were actually fixed; note category, location, score impact.
2. **Verify with diff** — read the git diff; drop anything the report claims but code does not show.
3. **Generalize each fix** — ask: *Would this pattern help on a different codebase?* If no → discard (may still mention in md Pitfalls).
4. **Merge siblings** — multiple fixes of the same class (e.g. three N+1 sites) → one playbook entry, several `example` pointers if needed.
5. **Select 3–5** — apply [Selection heuristic](#selection-heuristic); fewer is fine.
6. **Apply authoring gates** — every surviving entry must pass [Authoring gates](#authoring-gates) and [Authoring-time dedup](#authoring-time-dedup).
7. **Write outputs** — `08-reflection.md` first or in parallel with `reflection.json`; bilingual fields must be written together per entry.
8. **Record** — only if `entries.length > 0`; see [Record to Playbook](#record-to-playbook).

## Selection heuristic

When more fixes exist than you can record:

- **Prefer** patterns that transfer across files/modules over single-point renames or formatting
- **Prefer** fixes tied to clear score or severity improvement in the report
- **Tie-break** (highest first): security / correctness → performance → errorHandling → tests → simplicity → cleanup
- **Cap at 5** entries; **1–2 strong entries beats 5 weak ones**
- **Never invent** patterns to hit a quota — see [Empty or weak session](#empty-or-weak-session)

## Authoring gates

Every `reflection.json` entry must pass both gates before you write it.

### Generalization gate

- `problemPattern` describes a **class** of bug, not a specific symbol, table, or business entity
- OK: "N+1 query — related rows fetched inside a loop"
- Not OK: "N+1 in `UserOrderService.fetchLineItems`"
- `fixMethod` describes a **technique**, not a pasteable diff

### Bilingual parity gate

- `problemPatternZh` / `fixMethodZh` must describe the **same** pattern and technique as the English fields
- Chinese is for humans reading `playbook-zh.md` — not a loose summary, not more specific than English
- If you cannot write accurate Chinese for an entry, do not include that entry

## Authoring-time dedup

Before adding an entry, skim `.cortexloop/playbook.json`:

- Same problem class already recorded → **skip** unless the fix method genuinely evolved (then update wording to reflect the new technique; `record` will merge by signature)
- Unsure if it's duplicate → compare problem **class**, not file path
- Skipped near-duplicates can be noted in `08-reflection.md` under **Pitfalls / false starts** or **Next time**

Signature and tier mechanics live in `learning-loop.mdc` — do not re-derive them here.

## Outputs

### 1. Human evolution log — `docs/cortexloop/08-reflection.md` (**append only**)

**Do not overwrite** prior runs. Append after `---` with **运行时间** from run-meta (e.g. `2026年6月25日 14:30` — not raw ISO in titles).

```markdown
---
## 运行记录 · 2026年6月25日 14:30

> Run: `docs/cortexloop/runs/2026-06-25_14-30` · mode: direct

### Summary
What was fixed, overall score delta, test status.

### Effective fixes
Bullet list of what worked and why.

### Pitfalls / false starts
What did not work or required rework.

### Next time
Concrete reminders for similar codebases.
```

Orchestrator may run: `node scripts/append-reflection.mjs --file=.cortexloop/reflection-section.md`

Keep each section concise (1–2 screens). Focus on **patterns**, not line-by-line diffs.

### 2. Structured reflection — `.cortexloop/reflection.json`

```json
{
  "runDisplayTime": "2026年6月25日 14:30",
  "runId": "2026-06-25_14-30",
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

**Field rules:**

- Record **3–5 most valuable** generalizable patterns when available (fewer is OK)
- `problemPattern` / `fixMethod` — **English** (model recall via `playbook.json`)
- `problemPatternZh` / `fixMethodZh` — **Chinese** (human `playbook-zh.md`; not fed to `query`)
- `category` — one of: correctness, security, performance, simplicity, tests, errorHandling, cleanup
- `language` — e.g. `js`, `ts`, `py`, or omit for `any`
- `example` — optional `file:line` pointer

Do **not** record:

- Project-specific business rules
- Temporary workarounds
- Secrets, credentials, or environment-specific config

## Empty or weak session

If no fix generalizes to a reusable pattern:

1. Still write a short `08-reflection.md` explaining what was fixed and **why nothing was recorded**
2. Write `reflection.json` with `"entries": []`
3. **Do not run** `record` — empty entries are a no-op and should not be forced

Do not fabricate patterns to fill the array.

## Record to Playbook

Run **only when** `reflection.json` has one or more entries:

```bash
node scripts/playbook.mjs record .cortexloop/reflection.json
```

If `learning.global` is true in config, append `--global`. Confirm stdout shows added/updated counts and `playbook-zh.md` path.

- **English JSON** (`.cortexloop/playbook.json`) — sole source for `playbook.mjs query`
- **Chinese markdown** (`.cortexloop/playbook-zh.md`) — auto-generated for team reading; re-export: `node scripts/playbook.mjs export-zh`

Post-record feedback hooks (`failed`, `rejected`, `external_verified`) → see `rules/learning-loop.mdc`.

## Quality Checklist

- [ ] Extraction followed diff-verified fixes, not report claims alone
- [ ] Each entry passes generalization + bilingual parity gates
- [ ] Each entry is reusable on a **different** codebase
- [ ] `fixMethod` is actionable without reading the original diff
- [ ] Near-duplicates in existing playbook were skipped or evolved intentionally
- [ ] Retrospective mentions verification (tests passed)
- [ ] `record` run only when `entries` is non-empty
- [ ] User knows playbook hits are recall — re-derive and verify; use `feedback --outcome=failed` if a recorded pattern fails later
