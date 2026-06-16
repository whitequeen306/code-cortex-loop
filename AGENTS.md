# Supercode — Agent Rules

These rules apply when running any `/supercode*` command. Tool-specific installs copy this to the appropriate rules directory or merge into project `AGENTS.md`.

## When Supercode Runs

1. Load `supercode.config.json` from project root (optional)
2. Load `.supercodeignore` (optional)
3. Follow `supercode-workflow` for severity, scoring, CI, and re-verify
4. Follow `refactor-safety` for all code modifications

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

- Project: `.supercodeignore` (gitignore syntax)
- Inline: `// supercode-ignore SC-001` or `# supercode-ignore SC-001`
- Never suppress Critical without explicit user approval

## CI Gate

After CI report generation, run:

```bash
node scripts/ci-gate.mjs docs/supercode/report.json
```

Exit codes: `0` pass, `1` Critical, `2` High over threshold, `3` report error.

## Output Locations

| Artifact | Path |
|----------|------|
| Summary | `docs/supercode/00-summary.md` |
| Category reports | `docs/supercode/01-*.md` … `07-*.md` |
| Machine report | `docs/supercode/report.json` |
| SARIF (optional) | `docs/supercode/report.sarif` |

## Agents (subagent types)

| Agent | Role |
|-------|------|
| `code-reviewer` | 5-axis review |
| `security-auditor` | OWASP, secrets, auth |
| `test-engineer` | Coverage gaps |
| `code-simplifier` | Clarity without behavior change |
| `silent-failure-hunter` | Error handling audit |

Orchestration belongs to `/supercode` — agents do not invoke each other.
