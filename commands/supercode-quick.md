---
name: supercode-quick
description: Fast Supercode pass — review, security, error-handling on recent changes. Critical+High only.
disable-model-invocation: true
---

# Supercode Quick

Run `/supercode` with preset **quick** locked in:

```yaml
preset: quick
passes: [review, security, error-handling]
severityFloor: High
scope: recent
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Follow all steps in `commands/supercode.md` and `rules/supercode-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
