---
name: cortexloop-deep
description: Deprecated alias for cortexloop-full.
disable-model-invocation: true
---

# CodeCortexLoop Deep

`/cortexloop-deep` is deprecated. Use `/cortexloop-full` for the complete 7-pass path.

For compatibility, treat this command as preset **full**:

```yaml
preset: full
passes: all
severityFloor: Low
scope: whole
performance:
  requireBenchmark: true
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

All 7 passes run in **sequential expert order** (mandatory Task per pass). Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
