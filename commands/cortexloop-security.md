---
name: cortexloop-security
description: Security-focused CodeCortexLoop — security, error-handling, dependency audit on recent changes.
disable-model-invocation: true
---

# CodeCortexLoop Security

Run `/cortexloop` with preset **security** locked in:

```yaml
preset: security
passes: [security, errorHandling, cleanup]
cleanup:
  depsOnly: true
severityFloor: Medium
scope: recent
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Enabled passes run sequentially (security → errorHandling → cleanup). Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
