# CodeCortexLoop Performance Budget

> Methodology: post-processing measured on `examples/demo-app` (5 runs, median). AI-side estimates use handoff artifact sizes + published pass counts. **Your mileage will vary** by project size, model, and scope.

## Post-processing scripts (deterministic, zero LLM)

| Script bundle | Median time |
|---------------|-------------|
| badge + dashboard + history | ~416ms |

These run after every `/cortexloop` completion. Negligible vs AI analysis time.

## AI pipeline estimates

| Mode | Passes | Est. wall time* | Est. tokens* |
|------|--------|-----------------|--------------|
| `/cortexloop-quick` | 3 (review, security, errorHandling) | ~2–4 min | ~80k–150k |
| `/cortexloop` (full) | 7 | ~5–12 min | ~200k–450k |
| `/cortexloop-deep` | 7 + whole repo | ~10–25 min | ~400k–900k |

\* Wall time and tokens are **estimates** for Cursor/Claude Code with Task subagents on a ~500-line project. Scale roughly linearly with scoped file count.

## When NOT to run full pipeline

- Typo-only change → skip; use your linter
- <50 lines changed → `/cortexloop-quick`
- Pre-PR on feature branch → `/cortexloop-pre-pr` (recent scope, High+ floor)

## Measuring your project

After a run, check:

```bash
node scripts/run-summary.mjs --out=docs/cortexloop/run-summary.md
```

Add `generatedAt` timestamps to handoff JSON for accurate duration tracking.
