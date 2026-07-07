# Cost-Aware Orchestration Design

## Goal

Make `/cortexloop` the smart entry point for CodeCortexLoop: it should inspect the requested scope, estimate risk and cost, recommend a review preset, then ask the user to confirm or override before launching agents.

This keeps the 7-agent pipeline available for high-value situations without making it the default cost for every change.

## Product Principle

CodeCortexLoop should spend tokens in proportion to change risk.

- Low-risk changes should get a low-cost review.
- Normal PRs should get the standard correctness and safety checks.
- High-risk changes should be guided toward the full 7-pass review.
- The user should see why a preset was recommended before agents run.

## Command Model

Common commands:

| Command | Purpose |
| --- | --- |
| `/cortexloop` | Smart router: mode, scope, preflight recommendation, preset confirmation |
| `/cortexloop-lite` | Explicit low-cost review |
| `/cortexloop-standard` | Explicit standard PR review |
| `/cortexloop-full` | Explicit full 7-pass review |
| `/cortexloop-security` | Security-focused workflow |
| `/cortexloop-pre-pr` | PR gate workflow, defaulting to standard unless configured otherwise |

Advanced commands:

| Command | Purpose |
| --- | --- |
| `/cortexloop-baseline` | Manage accepted technical-debt baseline for CI ratcheting |
| `/cortexloop-reflect` | Manually record verified learning-loop reflections |

Deprecated aliases:

| Command | Replacement |
| --- | --- |
| `/cortexloop-quick` | `/cortexloop-lite` |
| `/cortexloop-deep` | `/cortexloop-full` |

## Presets

| Preset | Passes | Cost | Use case |
| --- | --- | --- | --- |
| Lite | `review`, `security`, `errorHandling` with narrow prompts | Low | Small changes, first run, token-sensitive users |
| Standard | `review`, `security`, `tests`, `errorHandling` | Medium | Normal PRs and moderate feature changes |
| Full | All 7 passes | High | Large PRs, release checks, security-sensitive or architecture-heavy changes |

Lite can reuse the existing expert agents with stricter prompts and smaller scope. It does not need separate agent identities unless later evidence shows that separate lite agents reduce cost meaningfully.

## Interactive Flow

`/cortexloop` should ask questions in this order:

1. Mode
   - Report: diagnose and write reports only.
   - Direct: diagnose, then apply fixes according to the selected fix floor.

2. Scope
   - Recent changes.
   - Whole project.

3. Budget Preflight
   - Build the selected scope.
   - Count changed files and changed lines.
   - Detect sensitive paths and structural risk signals.
   - Compute risk score and recommended preset.
   - Estimate cost level for each preset.

4. Preset confirmation
   - Show Lite / Standard / Full, with the recommended option marked.
   - Let the user override the recommendation.

5. Direct fix floor, only if mode is Direct
   - High+: fix Critical and High.
   - Medium+: include Medium.
   - Low+: include Low.

6. Run the selected plan.

The normal `/cortexloop` path should ask at most three questions in Report mode and four in Direct mode.

## Explicit Command Flow

Explicit preset commands should not ask the preset question.

| Command | Ask mode? | Ask scope? | Ask preset? | Run preflight? |
| --- | --- | --- | --- | --- |
| `/cortexloop` | Yes | Yes | Yes | Yes |
| `/cortexloop-lite` | Yes | Yes | No | Yes |
| `/cortexloop-standard` | Yes | Yes | No | Yes |
| `/cortexloop-full` | Yes | Yes | No | Yes |
| `/cortexloop-pre-pr` | Usually no or minimal | Config/default | No unless interactive | Yes |
| `/cortexloop-security` | Yes | Yes | No generic preset | Security preflight |

Preflight still runs for explicit commands so reports can record risk, cost, and whether the user overrode the recommendation.

## Risk Scoring

Start with a simple explainable score.

Changed lines:

| Signal | Points |
| --- | --- |
| `changedLines > 100` | +1 |
| `changedLines > 300` | +2 |
| `changedLines > 800` | +3 |

Changed files:

| Signal | Points |
| --- | --- |
| `changedFiles > 5` | +1 |
| `changedFiles > 15` | +2 |
| `changedFiles > 30` | +3 |

Sensitive paths:

| Signal | Points |
| --- | --- |
| auth, permission, session, token | +3 |
| payment, billing | +3 |
| database, migration, schema | +2 |
| api, controller, route | +2 |
| file upload, filesystem | +2 |
| external URL, webhook, HTTP client | +2 |
| config, CI, build | +1 |

Test and structural signals:

| Signal | Points |
| --- | --- |
| implementation changed but no tests changed | +1 |
| tests deleted or weakened | +2 |
| cross-module change | +2 |
| large deletion | +2 |
| dependency file changed | +1 |

Preset mapping:

| Score | Risk | Recommended preset |
| --- | --- | --- |
| 0-2 | Low | Lite |
| 3-6 | Medium | Standard |
| 7+ | High | Full |

The scoring should favor explainability over precision. Every recommendation must include the reasons that affected the score.

## CI Behavior

CI must be non-interactive. It should read all choices from command flags or config.

Recommended config shape:

```json
{
  "budget": {
    "defaultPreset": "auto",
    "askBeforeRun": true,
    "askBeforeFull": true,
    "maxPreset": "full"
  },
  "ci": {
    "preset": "standard",
    "upgradeToFullOnHighRisk": true
  }
}
```

CI rules:

- If `preset` is explicit, run it unless blocked by `budget.maxPreset`.
- If `preset` is `auto`, run preflight and select the recommended preset.
- If `upgradeToFullOnHighRisk` is true and preflight risk is High, select Full unless `maxPreset` prevents it.
- If `maxPreset` prevents the recommended preset, run the maximum allowed preset and record the cap in the report.

## Run Plan

All decisions should be normalized into one run plan before launching passes.

```json
{
  "mode": "report",
  "scope": "recent",
  "preset": "standard",
  "directFixFloor": null,
  "risk": {
    "score": 6,
    "level": "medium",
    "recommendedPreset": "standard",
    "reasons": [
      "auth path touched",
      "changed lines > 300",
      "implementation changed but no tests changed"
    ]
  },
  "enabledPasses": [
    "review",
    "security",
    "tests",
    "errorHandling"
  ],
  "cost": {
    "level": "medium",
    "estimatedPasses": 4
  }
}
```

The orchestrator should use this run plan as the single source of truth for enabled passes, reporting, handoff validation, and post-processing.

## Observability

Reports should show the cost and recommendation story, not only findings.

Add a run-cost section to summary outputs:

```text
Preset: Standard
Executed passes: 4/7
Skipped passes: performance, simplicity, cleanup
Risk score: 6 Medium
Recommended preset: Standard
User selected: Standard
Estimated cost: Medium
Recommendation reasons:
- auth path touched
- changed lines > 300
- implementation changed but no tests changed
```

If the user overrides the recommendation, record both values:

```text
Recommended preset: Full
User selected: Standard
Reason: user override
```

If config caps the preset:

```text
Recommended preset: Full
Executed preset: Standard
Reason: budget.maxPreset=standard
```

## Non-Goals

- Do not require exact token accounting in the first version.
- Do not add separate lite agents unless reuse of existing agents proves too expensive.
- Do not add more interactive prompts for MAP or codegraph in the common path. Those should remain automatic or config-driven except when a large, low-confidence scope needs one explicit confirmation.
- Do not remove baseline or reflect commands; they should become advanced commands rather than common-path commands.

## Success Criteria

- `/cortexloop` no longer defaults to Full without user confirmation.
- A normal Report run asks no more than three questions.
- A Direct run asks no more than four questions.
- Every run records preset, risk score, recommendation reasons, selected pass count, and skipped passes.
- CI can run the same logic without interaction.
- Users can explicitly choose low-cost or full-depth behavior with direct commands.
