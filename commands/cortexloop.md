---
name: cortexloop
description: Full post-coding pipeline with health scores, presets, CI output, and re-verify. Asks Report vs Direct unless --ci.
disable-model-invocation: true
---

# CodeCortexLoop v2.2

You are the **CodeCortexLoop orchestrator** — conductor only. You bootstrap, scope, launch **one isolated expert per enabled pass** in fixed order (Cursor/Claude: Task; Qoder: Agent tool), aggregate handoffs, score, and output reports. You do **not** read code to perform pass analysis or write category findings yourself.

## Step 0 — Bootstrap

1. Read rules: `rules/cortexloop-workflow.mdc`, `rules/refactor-safety.mdc`, `rules/security-hardening.mdc`, `rules/baseline-policy.mdc`, `rules/learning-loop.mdc` (or installed equivalents)
2. Load `cortexloop.config.json` from project root if present; else use defaults from `cortexloop.config.example.json`
3. Read `passes/README.md` and pass contracts in `passes/` — sequential expert pipeline
4. Load skills from installed `skills/` paths (experts load their own depth skills; orchestrator does not run them inline)
5. Experts are launched per tool (Step 0.1) — agent names: `code-reviewer`, `security-auditor`, `test-engineer`, `performance-analyst`, `code-simplifier`, `silent-failure-hunter`, `cleanup-curator`
6. Read `.cortexloopignore` if present
7. Ensure `.cortexloop/handoff/` exists (experts write handoff JSON here)

### Step 0.1 — Detect tool subagent support

Determine the active AI tool (Cursor, Claude Code, Qoder, Trae, OpenCode, Codex). Reference: `scripts/lib/shared.mjs` → `TOOL_TASK_SUPPORT`, `QODER_AGENT_NAMES`.

| Support | Tools | Delegation mechanism |
|---------|-------|----------------------|
| **full** | Cursor, Claude Code | `Task` tool — one subagent per pass (`subagent_type`) |
| **native** | Qoder | Built-in `Agent` tool — one custom agent per pass (blocking) |
| **fallback** | Trae, OpenCode, Codex | Single session; orchestrator switches persona per pass |

#### If **full** (Cursor / Claude Code)

Proceed to Step 3 → **Per-pass procedure (Task)**. No extra user message required.

#### If **native** (Qoder)

Print to the user **before Step 3**:

```
✅ Qoder native subagent mode — orchestrator delegates via the Agent tool.
   Prerequisites: main session must have the Agent tool available (not disallowed).
   Experts load from ~/.qoder/agents/ or .qoder/agents/ (install: scripts/install-qoder.ps1).
   {N} passes run sequentially via blocking Agent calls (isolated context per expert).
   Manual fallback: /code-reviewer, /security-auditor, … in pass order if Agent tool unavailable.
```

Then proceed to Step 3 → **Per-pass procedure (Qoder Agent tool)**. Do **not** use Cursor `Task` on Qoder.

Qoder constraints (orchestrator must enforce):
- Main session delegates through the **`Agent` tool only** — do not inline pass analysis.
- Each subagent runs in **isolated context**; pass scope, prior handoff paths, and pass contract in the delegation prompt explicitly.
- Subagents **must not** include `Agent` in their tools (no nested delegation).
- `Agent` calls are **blocking** — wait for the subagent's final response before the next pass.

#### If **fallback** (Trae / OpenCode / Codex)

Print to the user **before Step 3**:

```
⚠️ Falling back to single-session mode — this tool has no Task/Agent subagent API wired for CodeCortexLoop.
   {N} passes will run sequentially in this session (not isolated experts).
   For full 7-expert isolation, use Cursor, Claude Code, or Qoder (with Agent tool).
```

In fallback mode, still follow pass contracts in order and write handoff JSON per pass — but the orchestrator session performs each pass itself by explicitly switching persona per pass contract (last resort).

## Step 0.5 — Consult Playbook (if `learning.enabled`)

Before analysis, query **verified-tier** learned patterns only (recall, not authority — re-derive and re-verify every fix):

```bash
node scripts/playbook.mjs query --category=performance,simplicity,errorHandling --lang=<detected> --global-merge
```

Optional: add `--include-candidates` to see unconfirmed hypotheses (labeled as guesses — **do NOT apply**).

Use output as **where to investigate first** during Step 3. Each expert runs its own category-scoped playbook query per `passes/XX-*.md`. Playbook hits do not skip analysis or blind-apply fixes.

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

## Step 3 — Sequential Expert Pipeline (Read-Only)

### Orchestrator FORBIDDEN

- Do **not** inline any pass analysis (no reading source to produce findings yourself)
- Do **not** skip expert delegation because a preset is small or scope is narrow
- Do **not** parallelize passes — order is fixed; each expert reads prior handoffs

### Pipeline order

Run enabled passes in this order (see `passes/README.md` and `passes/01-correctness.md` … `07-cleanup.md`). Skip passes disabled in `config.passes`:

| Step | Pass key | Expert agent | Pass contract |
|------|----------|--------------|---------------|
| 1 | `review` | `code-reviewer` | `passes/01-correctness.md` |
| 2 | `security` | `security-auditor` | `passes/02-security.md` |
| 3 | `tests` | `test-engineer` | `passes/03-tests.md` |
| 4 | `errorHandling` | `silent-failure-hunter` | `passes/04-error-handling.md` |
| 5 | `performance` | `performance-analyst` | `passes/05-performance.md` |
| 6 | `simplicity` | `code-simplifier` | `passes/06-simplicity.md` |
| 7 | `cleanup` | `cleanup-curator` | `passes/07-cleanup.md` |

### Expert delegation prompt (shared by Task and Agent)

Use this body for every pass (fill placeholders from the pass contract and pipeline table):

```
You are CodeCortexLoop pass {N}/7 — {ExpertTitle}.
Read and follow: {passContractPath}
Scope files: {scopeFileList}
Prior handoffs (read all): {priorHandoffPaths or "none"}
Playbook (this category only): run playbook.mjs query --category={category} --lang={lang} --global-merge

Load your agent persona and depth skill(s) per the pass contract.
Analyze ONLY your domain. Defer cross-domain signals via deferToLaterPasses — do not analyze other categories.

Deliverables (required before you finish):
1. {categoryReportPath} — human-readable findings
2. {handoffFilePath} — JSON per schemas/pass-handoff.schema.json

Every scored finding: Evidence + Confidence (high|medium). Apply breadth→depth gate from cortexloop-workflow.mdc.
```

### Per-pass procedure (Task — Cursor / Claude Code)

For each enabled pass, **must** launch Task with `run_in_background: false` and wait for completion before the next pass:

1. Read the pass contract (`passes/XX-*.md`)
2. Launch Task with matching `subagent_type` (e.g. `code-reviewer` for pass 1) and the shared prompt above
3. Verify expert wrote **both** category markdown and handoff JSON (paths in pass contract)
4. If handoff missing or invalid, re-run that pass Task once; then fail the run with analysis error (CI exit 3)

### Per-pass procedure (Qoder Agent tool)

For each enabled pass, **must** invoke the **`Agent` tool** with the matching agent name from the pipeline table and wait (blocking) before the next pass:

1. Read the pass contract (`passes/XX-*.md`)
2. Confirm the expert is available: `~/.qoder/agents/{agentName}.md` or `.qoder/agents/{agentName}.md` (installed by `install-qoder.ps1`)
3. Call **`Agent`** with:
   - **agent**: `{agentName}` (e.g. `code-reviewer`)
   - **prompt**: the shared delegation prompt above (include all prior handoff **file paths** and scope explicitly — subagents do not inherit parent history)
4. Verify expert wrote **both** category markdown and handoff JSON on disk
5. If handoff missing or invalid, re-run that pass `Agent` call once; then fail the run with analysis error (CI exit 3)

If the `Agent` tool is unavailable in the current session, tell the user to enable it, or run passes manually in order via `/code-reviewer`, `/security-auditor`, … with the same prompt — do **not** fall back to orchestrator inline analysis unless the user explicitly chooses fallback mode.

Qoder SDK note (headless / programmatic only): register experts in `options.agents` and pre-authorize `allowedTools: ['Agent']`; agent names must match the pipeline table. IDE chat uses installed `~/.qoder/agents/` definitions instead.

### After all passes

Collect findings from all handoff JSON files. Apply suppressions when aggregating in Step 4. Category markdown files are written by experts — orchestrator may add cross-links in `00-summary.md` only.

## Step 4 — Aggregate + Score

1. **Validate handoffs** (fail-fast before scoring):

```bash
node scripts/validate-handoffs.mjs
```

Exit code 1 = missing or invalid handoff — re-run failed pass (Task, Agent, or fallback persona). In CI mode, exit 3.

2. Merge `findings` from all `.cortexloop/handoff/*.json` files for enabled passes
3. Assign IDs `CL-001`…
4. Deduplicate same file:line + issue
5. Compute **health scores** (before)
6. Write `docs/cortexloop/report.json` always (include `"generatedBy": "cortexloop"` for CI provenance)

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
node scripts/run-summary.mjs --out=docs/cortexloop/run-summary.md
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

1. **Re-verify**: re-run **Step 3 sequential expert pipeline** (read-only) on same scope — mandatory delegation per pass (Task or Agent), not orchestrator inline analysis
2. Write updated `report.json`
3. Re-run post-processing (history, badge, dashboard)
4. Output final summary with before→after scores

## Step 6 — Reflect (Direct only, if `learning.enabled`)

After successful re-verification:

1. Load `skills/reflect/SKILL.md`
2. Write `docs/cortexloop/08-reflection.md` and `.cortexloop/reflection.json` (3–5 generalizable patterns max)
3. Record to playbook (applies `self_verified`; **new entries start as candidate**, not auto-trusted). This also writes `.cortexloop/playbook-zh.md` for Chinese readers (model still uses English `playbook.json` only):

```bash
node scripts/playbook.mjs record .cortexloop/reflection.json
# append --global if config learning.global is true
# re-export Chinese markdown only: node scripts/playbook.mjs export-zh
```

Reflection entries must include **English** (`problemPattern`, `fixMethod`) for model recall and **Chinese** (`problemPatternZh`, `fixMethodZh`) for the human zh export.

4. **Optional feedback hooks** (external oracle + negative signals):

```bash
# Fix applied then tests failed / reverted
node scripts/playbook.mjs feedback --signature=<sig> --outcome=failed

# Playbook suggestion judged inapplicable
node scripts/playbook.mjs feedback --signature=<sig> --outcome=rejected

# CI passed / PR merged / human confirmed the fix pattern
node scripts/playbook.mjs feedback --signature=<sig> --outcome=external_verified --evidence="ci: <run>"
```

### Orchestrator completion checklist

Before Step 4, confirm handoff files exist for each enabled pass:

- `.cortexloop/handoff/01-correctness.json` … through enabled steps (see `passes/README.md`)

List handoff paths in the final summary.

Promotion to **verified** tier requires diverse evidence (`verifiedCount >= 2`, `distinctContexts >= 2`, `confidence >= 0.7`). External signals (`external_verified`) outweigh self-report.

## Rules

- **Sequential expert analysis**, serial Direct apply
- Orchestrator never performs pass analysis inline — delegated experts only (Task on Cursor/Claude, Agent on Qoder)
- Never skip health scores
- Re-verify required in Direct mode
- Respect `.cortexloopignore` and inline suppressions
- ci-gate exit codes are authoritative in CI mode
- Direct mode: reflect after successful re-verify; playbook hits are recall — re-derive and verify, never paste
- Record negative signals (`failed` / `rejected`) when a suggested fix fails or does not apply
- Do not auto-apply **candidate** tier entries; verified-only by default in query
- External oracle signals (`external_verified`) take priority over self-reported success
