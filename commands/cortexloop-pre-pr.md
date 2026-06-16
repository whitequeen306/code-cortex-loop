---
name: cortexloop-pre-pr
description: Pre-PR CodeCortexLoop gate — all passes on recent changes, Critical+High must be clean for CI.
disable-model-invocation: true
---

# CodeCortexLoop Pre-PR

Run `/cortexloop` with preset **pre-pr** locked in:

```yaml
preset: pre-pr
passes: all
severityFloor: High
scope: recent
ci:
  failOnCritical: true
  maxHigh: 0
```

Ideal before opening a PR. In CI, use `/cortexloop-pre-pr --ci` or `cortexloop.config.json` with `"preset": "pre-pr"`.

Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
