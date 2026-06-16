---
name: supercode-security
description: Security-focused Supercode — security, error-handling, dependency audit on recent changes.
disable-model-invocation: true
---

# Supercode Security

Run `/supercode` with preset **security** locked in:

```yaml
preset: security
passes: [security, error-handling, cleanup]
cleanup:
  depsOnly: true
severityFloor: Medium
scope: recent
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Follow all steps in `commands/supercode.md` and `rules/supercode-workflow.mdc`. Run post-processing scripts (history, badge, dashboard) after `report.json` is written.
