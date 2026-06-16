---
name: cortexloop
description: Full post-coding pipeline with health scores, presets, CI output, and re-verify. Asks Report vs Direct unless --ci.
disable-model-invocation: true
---

# CodeCortexLoop v2.2

You are the **CodeCortexLoop orchestrator**. Run the aggregate pipeline: review, security, tests, performance, simplify, error-handling, cleanup.

## Step 0 — Bootstrap

1. Read rules: `rules/cortexloop-workflow.mdc`, `rules/refactor-safety.mdc`, `rules/security-hardening.mdc`, `rules/baseline-policy.mdc`, `rules/learning-loop.mdc` (or installed equivalents)
2. Load `cortexloop.config.json` from project root if present; else use defaults from `cortexloop.config.example.json`
3. Load skills from installed `skills/` paths
4. Load agents: `code-reviewer`, `security-auditor`, `test-engineer`, `code-simplifier`, `silent-failure-hunter`
5. Read `.cortexloopignore` if present

## Step 0.5 — Consult Playbook (if `learning.enabled`)

Before analysis, query learned fix patterns (suggestions only — still verify every fix):

```bash
node scripts/playbook.mjs query --category=performance,simplicity,errorHandling --lang=<detected> --global-merge
```

Use output as **known patterns to prioritize** during Step 3. Playbook hits do not skip analysis or blind-apply fixes.

## Step 1 — Detect Mode

| Trigger | Behavior |
|---------|----------|
| `/cortexloop --ci` or config `ci.enabled` | **CI mode**: Report only, write JSON/SARIF, run ci-gate, no user prompts |
| `/cortexloop` (default) | Ask user two questions (below) |
| Preset commands | Skip preset question; use locked preset |

### Question 1 — Mode (skip in CI)

- **Report** (recommended first run): write `docs/cortexloop/*`, stop for confirmation
- **Direct**: apply fixes incrementally with test-after-each-group

### Question 2 — Scope (skip in CI if config sets scope)

- **Recent changes** | **Whole project**

## Step 2 — Scope Files

Use git commands from `cortexloop-workflow.mdc`. Apply `config.exclude` and `.cortexloopignore`.

## Step 3 — Parallel Analysis (Read-Only)

Launch parallel Task subagents per enabled passes in config/preset. Apply suppressions when aggregating.

## Step 4 — Aggregate + Score

1. Assign IDs `CL-001`…
2. Deduplicate same file:line + issue
3. Compute **health scores** (before)
4. Write `docs/cortexloop/report.json` always

## Step 5 — Output

### Report / CI

Write markdown reports + `report.json` (+ `report.sarif` if enabled). Include health scores in `00-summary.md`.

### Step 5b — Post-Processing (always after report.json exists)

Run from project root (respect config paths if set):

```bash
node scripts/record-history.mjs docs/cortexloop/report.json
node scripts/make-badge.mjs docs/cortexloop/report.json
node scripts/make-dashboard.mjs docs/cortexloop/report.json
node scripts/pr-comment.mjs docs/cortexloop/report.json
```

If baseline enabled: `node scripts/baseline.mjs diff` before CI gate.

**CI:** run gate (with `--baseline` if config `ci.baseline: true`):

```bash
node scripts/ci-gate.mjs docs/cortexloop/report.json
# or with baseline ratchet:
node scripts/baseline.mjs diff docs/cortexloop/report.json
node scripts/ci-gate.mjs docs/cortexloop/report.json --baseline
```

**Report (non-CI):** STOP. Ask user what to apply.

### Direct

Apply per workflow apply-order. After all groups:

1. **Re-verify**: re-run analysis, compute after scores
2. Write updated `report.json`
3. Re-run post-processing (history, badge, dashboard)
4. Output final summary with before→after scores

## Step 6 — Reflect (Direct only, if `learning.enabled`)

After successful re-verification:

1. Load `skills/reflect/SKILL.md`
2. Write `docs/cortexloop/08-reflection.md` and `.cortexloop/reflection.json` (3–5 generalizable patterns max)
3. Record to playbook:

```bash
node scripts/playbook.mjs record .cortexloop/reflection.json
# append --global if config learning.global is true
```

## Rules

- Parallel analysis, serial apply
- Never skip health scores
- Re-verify required in Direct mode
- Respect `.cortexloopignore` and inline suppressions
- ci-gate exit codes are authoritative in CI mode
- Direct mode: reflect after successful re-verify; playbook hits are suggestions — verify before applying
