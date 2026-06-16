---
name: supercode-deep
description: Deep Supercode pass — all 7 passes, whole project, benchmarks required for perf fixes.
disable-model-invocation: true
---

# Supercode Deep

Run `/supercode` with preset **deep** locked in:

```yaml
preset: deep
passes: all
severityFloor: Low
scope: whole
performance:
  requireBenchmark: true
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Follow all steps in `commands/supercode.md` and `rules/supercode-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
