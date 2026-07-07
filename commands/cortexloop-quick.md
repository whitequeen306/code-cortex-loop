---
name: cortexloop-quick
description: Deprecated alias for cortexloop-lite.
disable-model-invocation: true
---

# CodeCortexLoop Quick

`/cortexloop-quick` is deprecated. Use `/cortexloop-lite` for the low-cost path.

For compatibility, treat this command as preset **lite**:

```yaml
preset: lite
passes: [review, security, errorHandling]
severityFloor: High
scope: recent
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Enabled passes run in **fixed sequential order** (Task subagent per pass) — see `passes/README.md`. Lite runs steps 1, 2, 4 only.

Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
