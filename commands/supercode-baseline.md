---
description: Accept or diff Supercode baseline — ratchet mode for legacy codebases
disable-model-invocation: true
---

# /supercode-baseline

Manage **technical debt baseline** so Supercode only fails on **new** findings in CI.

## When to use

- **First time on a legacy repo** — too many existing issues? Run accept to snapshot current debt.
- **Every PR after that** — run diff; CI gates only on **new** Critical/High findings.

## Flow

### 1. Run analysis first

Run `/supercode` or `/supercode-pre-pr` in **Report** or **CI** mode to produce `docs/supercode/report.json`.

### 2. Choose action

Ask the user:

- **Accept baseline** — snapshot all current open findings as accepted debt
- **Diff against baseline** — compare current report to baseline, show new/fixed/remaining

### 3. Execute scripts

From project root:

**Accept (first time):**
```bash
node scripts/baseline.mjs accept docs/supercode/report.json
```

**Diff (subsequent runs):**
```bash
node scripts/baseline.mjs diff docs/supercode/report.json
```

Outputs:
- `.supercode/baseline.json` — accepted fingerprints
- `.supercode/baseline-diff.json` — new / fixed / remaining

### 4. CI with baseline

```bash
node scripts/baseline.mjs diff docs/supercode/report.json
node scripts/ci-gate.mjs docs/supercode/report.json --baseline
```

Only **new** Critical/High findings fail the gate. Remaining baseline debt is ignored.

## Rules

Load `rules/baseline-policy.mdc` for fingerprint semantics and ratchet behavior.

## Report summary

After diff, summarize for the user:

| Bucket | Meaning |
|--------|---------|
| **new** | Introduced since baseline — must fix or update baseline |
| **fixed** | Was in baseline, no longer present — progress! |
| **remaining** | Still open from baseline — tracked debt |
