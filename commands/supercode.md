---
name: supercode
description: Full post-coding pipeline with health scores, presets, CI output, and re-verify. Asks Report vs Direct unless --ci.
disable-model-invocation: true
---

# Supercode v2.1

You are the **Supercode orchestrator**. Run the aggregate pipeline: review, security, tests, performance, simplify, error-handling, cleanup.

## Step 0 — Bootstrap

1. Read rules: `rules/supercode-workflow.mdc`, `rules/refactor-safety.mdc`, `rules/security-hardening.mdc`, `rules/baseline-policy.mdc` (or installed equivalents)
2. Load `supercode.config.json` from project root if present; else use defaults from `supercode.config.example.json`
3. Load skills from installed `skills/` paths
4. Load agents: `code-reviewer`, `security-auditor`, `test-engineer`, `code-simplifier`, `silent-failure-hunter`
5. Read `.supercodeignore` if present

## Step 1 — Detect Mode

| Trigger | Behavior |
|---------|----------|
| `/supercode --ci` or config `ci.enabled` | **CI mode**: Report only, write JSON/SARIF, run ci-gate, no user prompts |
| `/supercode` (default) | Ask user two questions (below) |
| Preset commands | Skip preset question; use locked preset |

### Question 1 — Mode (skip in CI)

- **Report** (recommended first run): write `docs/supercode/*`, stop for confirmation
- **Direct**: apply fixes incrementally with test-after-each-group

### Question 2 — Scope (skip in CI if config sets scope)

- **Recent changes** | **Whole project**

## Step 2 — Scope Files

Use git commands from `supercode-workflow.mdc`. Apply `config.exclude` and `.supercodeignore`.

## Step 3 — Parallel Analysis (Read-Only)

Launch parallel Task subagents per enabled passes in config/preset. Apply suppressions when aggregating.

## Step 4 — Aggregate + Score

1. Assign IDs `SC-001`…
2. Deduplicate same file:line + issue
3. Compute **health scores** (before)
4. Write `docs/supercode/report.json` always

## Step 5 — Output

### Report / CI

Write markdown reports + `report.json` (+ `report.sarif` if enabled). Include health scores in `00-summary.md`.

### Step 5b — Post-Processing (always after report.json exists)

Run from project root (respect config paths if set):

```bash
node scripts/record-history.mjs docs/supercode/report.json
node scripts/make-badge.mjs docs/supercode/report.json
node scripts/make-dashboard.mjs docs/supercode/report.json
node scripts/pr-comment.mjs docs/supercode/report.json
```

If baseline enabled: `node scripts/baseline.mjs diff` before CI gate.

**CI:** run gate (with `--baseline` if config `ci.baseline: true`):

```bash
node scripts/ci-gate.mjs docs/supercode/report.json
# or with baseline ratchet:
node scripts/baseline.mjs diff docs/supercode/report.json
node scripts/ci-gate.mjs docs/supercode/report.json --baseline
```

**Report (non-CI):** STOP. Ask user what to apply.

### Direct

Apply per workflow apply-order. After all groups:

1. **Re-verify**: re-run analysis, compute after scores
2. Write updated `report.json`
3. Re-run post-processing (history, badge, dashboard)
4. Output final summary with before→after scores

## Rules

- Parallel analysis, serial apply
- Never skip health scores
- Re-verify required in Direct mode
- Respect `.supercodeignore` and inline suppressions
- ci-gate exit codes are authoritative in CI mode
