---
name: cortexloop-deep
description: Deep CodeCortexLoop pass — all 7 passes, whole project, benchmarks required for perf fixes.
disable-model-invocation: true
---

# CodeCortexLoop Deep

Run `/cortexloop` with preset **deep** locked in:

```yaml
preset: deep
passes: all
severityFloor: Low
scope: whole
performance:
  requireBenchmark: true
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
