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
node scripts/validate-handoffs.mjs
node scripts/run-summary.mjs --out=docs/cortexloop/run-summary.md
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
| Playbook (model) | `.cortexloop/playbook.json` |
| Playbook (中文阅读) | `.cortexloop/playbook-zh.md` |
| Handoff (per pass) | `.cortexloop/handoff/*.json` |
| Reflection (structured) | `.cortexloop/reflection.json` |
| Reflection (human) | `docs/cortexloop/08-reflection.md` |

## Orchestrator vs domain experts

| Role | Does | Must not | Qoder / Trae / Fallback |
|------|------|----------|-------------------------|
| **Orchestrator** | Bootstrap, scope, delegate one expert per pass, aggregate handoffs, score, Direct apply | Inline pass analysis (full/native/partial mode), write category findings without pass contract | **OpenCode/Cursor:** Task tool; **Qoder:** `Agent` tool; **Trae:** SOLO Coder; **Codex:** explicit spawn; **Fallback:** persona switch |
| **Domain expert** | Single-domain analysis, read prior handoffs, write category md + handoff json | Analyze other categories, invoke other agents | **Qoder/Trae:** isolated subagent when delegated; **Fallback:** orchestrator absorbs pass |

Sequential order: see `passes/README.md`. **Full Task**: Cursor, Claude Code, OpenCode (`full`). **Native Agent**: Qoder (`native`). **Partial**: Trae SOLO, Codex spawn (`partial`). See `OPENCODE_AGENT_NAMES`, `QODER_AGENT_NAMES`, `TRAE_AGENT_NAMES`, `CODEX_AGENT_NAMES` in `scripts/lib/shared.mjs`.

## Domain experts (Task subagent types)

| Agent | Pass | Domain |
|-------|------|--------|
| `code-reviewer` | 1 | Correctness & architecture |
| `security-auditor` | 2 | Security |
| `test-engineer` | 3 | Test strategy & coverage |
| `silent-failure-hunter` | 4 | Error handling |
| `performance-analyst` | 5 | Performance |
| `code-simplifier` | 6 | Simplicity |
| `cleanup-curator` | 7 | Dead code & dependencies |

Experts do not invoke each other — orchestrator runs the pipeline in order.

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
