---
name: supercode-pre-pr
description: Pre-PR Supercode gate — all passes on recent changes, Critical+High must be clean for CI.
disable-model-invocation: true
---

# Supercode Pre-PR

Run `/supercode` with preset **pre-pr** locked in:

```yaml
preset: pre-pr
passes: all
severityFloor: High
scope: recent
ci:
  failOnCritical: true
  maxHigh: 0
```

Ideal before opening a PR. In CI, use `/supercode-pre-pr --ci` or `supercode.config.json` with `"preset": "pre-pr"`.

Follow all steps in `commands/supercode.md` and `rules/supercode-workflow.mdc`.
