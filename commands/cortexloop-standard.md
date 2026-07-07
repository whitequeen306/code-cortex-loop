---
name: cortexloop-standard
description: Standard CodeCortexLoop PR review — correctness, security, tests, and error handling.
disable-model-invocation: true
---

# CodeCortexLoop Standard

Run `/cortexloop` with preset **standard** locked in:

```yaml
preset: standard
passes: [review, security, tests, errorHandling]
cost: medium
```

Skip preset selection. Still ask Report vs Direct and Recent changes vs Whole project unless `--ci` or config already determines them.

Budget Preflight still runs and records risk, recommendation, selected preset, enabled passes, skipped passes, and cost in the run summary. If the preflight recommendation differs from Standard, record that Standard was user-selected by explicit command.

Enabled passes run in **fixed sequential order** (Task subagent per pass) — see `passes/README.md`. Standard runs steps 1, 2, 3, and 4 only.

Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts after `report.json` is written.
