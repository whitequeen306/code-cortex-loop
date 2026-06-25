---
description: Manually reflect on recent Direct fixes and record learnings to the playbook
disable-model-invocation: true
---

# /cortexloop-reflect

Manually trigger **reflect-and-learn** — the automatic step that runs after Direct mode.

## When to use

- You applied fixes outside `/cortexloop` but want to capture reusable patterns
- A Direct run completed but reflect was skipped
- You want to curate playbook entries after reviewing a successful fix session

## Prerequisites

- Recent fixes with passing tests (or you clearly document what was fixed)
- Ideally `docs/cortexloop/report.json` exists (before/after scores help)

## Flow

### 1. Load context

Read:

- `skills/reflect/SKILL.md` (installed reflect skill)
- `rules/learning-loop.mdc`
- `cortexloop.config.json` → `learning` block (if present)
- `docs/cortexloop/report.json` and relevant git diff

### 2. Produce outputs

1. **Append** section to `docs/cortexloop/08-reflection.md` (incremental log — use **运行时间** from run-meta, not ISO)
2. **`.cortexloop/reflection.json`** — structured entries (max 3–5 generalizable patterns)

Follow curation rules in the reflect skill: methods not diffs, patterns not one-offs.

### 3. Record to playbook

From project root:

```bash
node scripts/playbook.mjs record .cortexloop/reflection.json
```

Add `--global` if `learning.global` is enabled in config.

### 4. Confirm

Report:

- How many entries added vs updated
- Playbook path(s) written
- Reminder: playbook hits are **suggestions** — next run still verifies via refactor-safety + tests

## Notes

- This command does **not** re-run analysis or apply fixes
- For a full pipeline with auto-reflect, use `/cortexloop` in **Direct** mode instead
