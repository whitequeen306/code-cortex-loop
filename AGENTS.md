# CodeCortexLoop — Agent Rules

These rules apply when running any `/cortexloop*` command. Tool-specific installs copy this to the appropriate rules directory or merge into project `AGENTS.md`.

## When CodeCortexLoop Runs

1. Load `cortexloop.config.json` from project root (optional)
2. Load `.cortexloopignore` (optional)
3. Follow `cortexloop-workflow` for severity, scoring, CI, re-verify, and post-processing
4. Follow `refactor-safety` for all code modifications
5. Follow `baseline-policy` when using `/cortexloop-baseline` or `ci.baseline`
6. Follow `learning-loop` when querying or recording playbook entries

## Finding Quality Gate

Every scored finding must include:

- **Evidence:** trigger path, measurement, test gap, static proof, or audit output
- **Confidence:** `high` or `medium`

Low-confidence speculation must not become a scored finding. Put it in Open Questions or drop it.

## Security Baseline (always during security pass)

Every code change must satisfy:

1. User input sanitized at boundaries
2. SQL parameterized (no string concatenation)
3. No secrets in code, logs, or git
4. Error messages must not leak internals
5. File uploads restricted (type, size, path)
6. External URLs validated (SSRF prevention)

## Refactor Safety (Direct mode)

- Preserve behavior exactly during simplify/perf passes
- Chesterton's Fence: understand before removing
- Ask before deleting dead code or dependencies
- Separate refactors from bug fixes
- Run tests after each logical change group; revert on failure

## Suppression

- Project: `.cortexloopignore` (gitignore syntax)
- Inline: `// cortexloop-ignore CL-001` or `# cortexloop-ignore CL-001`
- Never suppress Critical without explicit user approval

## CI Gate

After CI report generation:

```bash
node scripts/ci-gate.mjs docs/cortexloop/report.json
# Baseline ratchet (new findings only):
node scripts/baseline.mjs diff docs/cortexloop/report.json
node scripts/ci-gate.mjs docs/cortexloop/report.json --baseline
```

Exit codes: `0` pass, `1` Critical, `2` High over threshold, `3` report error.

## Post-Processing (after report.json)

```bash
node scripts/record-history.mjs docs/cortexloop/report.json
node scripts/make-badge.mjs docs/cortexloop/report.json
node scripts/make-dashboard.mjs docs/cortexloop/report.json
node scripts/pr-comment.mjs docs/cortexloop/report.json
```

## Learning Loop (v2.2)

Before analysis:

```bash
node scripts/playbook.mjs query --category=performance,simplicity,errorHandling --lang=<detected> --global-merge
# add --include-candidates to see unconfirmed hypotheses (do NOT apply)
```

After Direct fixes (reflect — applies `self_verified`, new entries start as **candidate**):

```bash
node scripts/playbook.mjs record .cortexloop/reflection.json
```

Feedback (external oracle + negative signals — record failures and rejections):

```bash
node scripts/playbook.mjs feedback --signature=<sig> --outcome=external_verified --evidence="ci: run"
node scripts/playbook.mjs feedback --signature=<sig> --outcome=failed
node scripts/playbook.mjs feedback --signature=<sig> --outcome=rejected
```

Playbook hits are **recall, not authority** — re-derive and verify every fix; record negative signals when suggestions fail.

## Output Locations

| Artifact | Path |
|----------|------|
| Summary | `docs/cortexloop/00-summary.md` |
| Category reports | `docs/cortexloop/01-*.md` … `07-*.md` |
| Machine report | `docs/cortexloop/report.json` |
| Visual dashboard | `docs/cortexloop/report.html` |
| SARIF (optional) | `docs/cortexloop/report.sarif` |
| Score history | `.cortexloop/history.json` |
| Health badge | `.cortexloop/health-badge.svg` |
| Baseline | `.cortexloop/baseline.json` |
| Baseline diff | `.cortexloop/baseline-diff.json` |
| PR comment body | `.cortexloop/pr-comment.md` |
| Playbook | `.cortexloop/playbook.json` |
| Reflection (structured) | `.cortexloop/reflection.json` |
| Reflection (human) | `docs/cortexloop/08-reflection.md` |

## Agents (subagent types)

| Agent | Role |
|-------|------|
| `code-reviewer` | 5-axis review |
| `security-auditor` | OWASP, secrets, auth |
| `test-engineer` | Coverage gaps |
| `performance-analyst` | Broad performance risk discovery |
| `code-simplifier` | Clarity without behavior change |
| `silent-failure-hunter` | Error handling audit |
| `cleanup-curator` | Dead code and dependency curation |

Orchestration belongs to `/cortexloop` — agents do not invoke each other.

## Commands

| Command | Purpose |
|---------|---------|
| `/cortexloop` | Full pipeline |
| `/cortexloop-quick` | Fast pass |
| `/cortexloop-deep` | Whole project deep scan |
| `/cortexloop-security` | Security focus |
| `/cortexloop-pre-pr` | Pre-PR gate |
| `/cortexloop-baseline` | Accept or diff technical debt baseline |
| `/cortexloop-reflect` | Manually reflect and record playbook learnings |
