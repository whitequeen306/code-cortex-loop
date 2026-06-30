---
name: cortexloop-lite
description: Minimal CodeCortexLoop — 3 passes on recent changes, skips Playbook, cross-validation, MAP enrich, and codegraph offer.
disable-model-invocation: true
---

# CodeCortexLoop Lite

Run `/cortexloop` with preset **lite** locked in — the lightest official path for small diffs and first tries.

```yaml
preset: lite
passes: [review, security, error-handling]
severityFloor: High
scope: recent
learning.enabled: false
crossValidation.enabled: false
scope.deepIndexOffer: false
scope.mapEnrichThreshold: 0
```

Skip preset selection. Still ask Report vs Direct unless `--ci`.

Enabled passes run in **fixed sequential order** (Task subagent per pass) — see `passes/README.md`. Lite runs steps 1, 2, 4 only.

### What lite skips (modules stay installed — only toggles behavior)

| Step | Full default | Lite |
|------|--------------|------|
| Step 0.5 Playbook query | on | **off** (`learning.enabled: false`) |
| Step 2b-enrich MAP | when confidence low | **off** (`mapEnrichThreshold: 0`) |
| Step 2c codegraph offer | may ask user | **off** (`deepIndexOffer: false`) |
| Step 3.5 cross-validation | on | **off** (`crossValidation.enabled: false`) |

Disk handoff, scope manifest, and post-processing (badge, dashboard) still run — only optional/heavy steps are skipped.

Follow all steps in `commands/cortexloop.md` and `rules/cortexloop-workflow.mdc`. Run post-processing scripts after `report.json` is written.

Optional: copy [cortexloop.config.minimal.json](../cortexloop.config.minimal.json) or merge the lite keys above into `cortexloop.config.json`.
