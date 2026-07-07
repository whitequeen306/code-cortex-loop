---
name: cortexloop-full
description: Full CodeCortexLoop review — all 7 passes for high-risk changes, large PRs, and release checks.
disable-model-invocation: true
---

# CodeCortexLoop Full

Run `/cortexloop` with preset **full** locked in:

```yaml
preset: full
passes: all
cost: high
```

Skip preset selection. Still ask Report vs Direct and Recent changes vs Whole project unless `--ci` or config already determines them.

Budget Preflight still runs and records risk, recommendation, selected preset, enabled passes, skipped passes, and cost in the run summary. If the preflight recommendation is Lite or Standard, record that Full was user-selected by explicit command.

All 7 passes run in **fixed sequential expert order** (mandatory Task subagent per pass). Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts after `report.json` is written.
