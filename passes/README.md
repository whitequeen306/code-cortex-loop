# CodeCortexLoop Pass Modules

Seven **domain experts** run in a fixed **sequential pipeline**. Each expert is a mandatory Task subagent — the orchestrator does not perform pass analysis inline.

## Roles

| Role | Responsibility |
|------|----------------|
| **Orchestrator** | Bootstrap, scope, launch Task per enabled pass, collect handoffs, aggregate, score, Direct apply |
| **Domain expert** | One pass only — read prior handoffs, analyze in-scope, write category report + handoff JSON |

## Pipeline order

Paths below are **legacy defaults**. At runtime read `.cortexloop/run-meta.json` → `reports.categoryReports` and write under `{runDir}/`.

| Step | Pass key | Expert | Contract | Category report | Handoff |
|------|----------|--------|----------|-----------------|---------|
| 1 | `review` | `code-reviewer` | [01-correctness.md](01-correctness.md) | `docs/cortexloop/01-correctness.md` | `.cortexloop/handoff/01-correctness.json` |
| 2 | `security` | `security-auditor` | [02-security.md](02-security.md) | `docs/cortexloop/02-security.md` | `.cortexloop/handoff/02-security.json` |
| 3 | `tests` | `test-engineer` | [03-tests.md](03-tests.md) | `docs/cortexloop/05-tests.md` | `.cortexloop/handoff/03-tests.json` |
| 4 | `errorHandling` | `silent-failure-hunter` | [04-error-handling.md](04-error-handling.md) | `docs/cortexloop/06-error-handling.md` | `.cortexloop/handoff/04-error-handling.json` |
| 5 | `performance` | `performance-analyst` | [05-performance.md](05-performance.md) | `docs/cortexloop/03-performance.md` | `.cortexloop/handoff/05-performance.json` |
| 6 | `simplicity` | `code-simplifier` | [06-simplicity.md](06-simplicity.md) | `docs/cortexloop/04-simplicity.md` | `.cortexloop/handoff/06-simplicity.json` |
| 7 | `cleanup` | `cleanup-curator` | [07-cleanup.md](07-cleanup.md) | `docs/cortexloop/07-cleanup.md` | `.cortexloop/handoff/07-cleanup.json` |

Category report filenames follow legacy `01`–`07` category numbering. Handoff filenames follow **execution order**.

## Presets

Presets disable passes via `cortexloop.config.json` → `passes`. Enabled passes still run in the table order above — never reorder.

Example: **quick** enables `review`, `security`, `errorHandling` → steps 1, 2, 4 only.

## Handoff protocol

Each expert writes:

1. **Category markdown** — human-readable findings for that domain
2. **Handoff JSON** — machine-readable brief for downstream experts

Schema: [schemas/pass-handoff.schema.json](../schemas/pass-handoff.schema.json)

## Context management (large projects)

- Scope paths live in `.cortexloop/scope-paths.json` — never inline in orchestrator prompts
- Orchestrator reads `.cortexloop/handoff-summary.json` — not full handoff JSON
- Experts read prior handoffs **in their own subagent session** from disk
- Experts return **PASS_COMPLETE block only** to orchestrator after writing artifacts

See `commands/cortexloop.md` Step 2 / Step 2.5 and `rules/cortexloop-workflow.mdc`.

```json
{
  "pass": "security",
  "category": "security",
  "expert": "security-auditor",
  "summary": "1-3 sentences for the next expert.",
  "findings": [],
  "deferToLaterPasses": [{ "pass": "performance", "note": "...", "sourceLocation": "src/ledger.ts:88", "sourceContext": "transfer(amount, to)" }],
  "openQuestions": []
}
```

- **summary** — max ~3 sentences; no raw diffs
- **findings** — scored items only (passed depth gate); include Evidence + Confidence
- **deferToLaterPasses** — flag cross-domain concerns without analyzing them. `pass` accepts a passKey (`review`, `security`, …); the category alias (`correctness`) is also accepted and normalized to the canonical passKey, so either spelling resolves to the same orphan defer id. `sourceLocation` (file:line) and `sourceContext` (symbol/snippet) are optional but recommended — `aggregate-findings.mjs` uses `sourceLocation` to stamp an `orphanId` onto the matching finding's `provenance`, and the target expert jumps straight to the site instead of re-reading the whole file.
- **openQuestions** — unresolved items; not scored findings

Downstream experts read **all prior handoff JSON files** plus scope files. They may incorporate defer notes but must not re-run upstream analysis.

## Cross-validation (Step 3.5)

When pass N defers to pass M where **M < N** (target already ran), orchestrator collects orphans and **re-delegates to the target expert** — not a new role. Target expert appends `crossValidation[]` and any new `findings[]` to their existing handoff. See `commands/cortexloop.md` Step 3.5.

## Single source of truth

Pass order and paths are defined in `scripts/lib/shared.mjs` → `PASS_PIPELINE`. Keep contracts aligned with that constant.
