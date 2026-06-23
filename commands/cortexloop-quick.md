---
name: cortexloop-quick
description: Fast CodeCortexLoop pass — review, security, error-handling on recent changes. Critical+High only.
disable-model-invocation: true
---

# CodeCortexLoop Quick

Run `/cortexloop` with preset **quick** locked in:

```yaml
preset: quick
passes: [review, security, error-handling]
severityFloor: High
scope: recent
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Enabled passes run in **fixed sequential order** (Task subagent per pass) — see `passes/README.md`. Quick runs steps 1, 2, 4 only.

Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
