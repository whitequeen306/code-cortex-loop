---
name: dead-code-and-deps
description: Detects dead code, unused exports, orphaned files, and dependency issues (unused, outdated, vulnerable). Use during cleanup passes. Always ask before deleting — never silently remove code or dependencies.
---

# Dead Code and Dependency Cleanup

## Overview

Identify code and dependencies that no longer serve the project, then propose safe removal. Cleanup reduces maintenance burden, shrinks attack surface, and speeds builds — but deletion is irreversible without git, so **always ask before deleting**.

## When to Use

- `/cortexloop` cleanup pass
- After refactors that replace old implementations
- Before release to reduce bundle size and audit surface
- When `npm audit` / `pip audit` / `cargo audit` reports issues
- When dependency count grows without clear value

**When NOT to use:**
- Code is deprecated but still referenced by external consumers
- You're unsure whether something is dead — investigate first (Chesterton's Fence)
- Deletion would break a feature flag path that's temporarily disabled

## Dead Code Detection

### Signals to investigate

| Signal | How to verify |
|--------|---------------|
| Unused exports | grep for import references across codebase |
| Unreachable functions | No callers in repo; check dynamic imports |
| Commented-out blocks | Safe to remove if git history preserves them |
| Orphaned files | No imports reference the file |
| Unused variables/imports | Linter (eslint, ruff, clippy) |
| Legacy shims | Comments like "backwards compat", "TODO remove" |
| Duplicate utilities | Same logic in multiple files — consolidate, don't delete both |
| Empty/stub files | Placeholder never implemented |

### Detection process

```
1. Run project linter — collect unused import/variable warnings
2. For each candidate:
   a. grep -r for symbol name and file path
   b. Check dynamic imports, reflection, config references, test files
   c. Check git blame — understand why it exists
3. Classify: CONFIRMED_DEAD | LIKELY_DEAD | UNCERTAIN
4. NEVER delete UNCERTAIN without asking user
```

### Ask-before-delete template

```
DEAD CODE IDENTIFIED:
- formatLegacyDate() in src/utils/date.ts — replaced by formatDate(), 0 references
- OldTaskCard in src/components/ — replaced by TaskCard, 0 references
- LEGACY_API_URL in src/config.ts — no remaining references

Should I remove these? (yes / no / explain which)
```

## Dependency Audit

### Checks to run (adapt to stack)

| Check | Command (examples) |
|-------|---------------------|
| Vulnerabilities | `npm audit`, `pip audit`, `cargo audit`, `govulncheck` |
| Outdated packages | `npm outdated`, `pip list --outdated` |
| Unused deps | `depcheck` (JS), `pip-autoremove` (Python) |
| License compatibility | `license-checker`, manual review |
| Duplicate packages | Same lib under different names (lodash vs lodash-es) |

### Triage npm audit (decision tree)

```
Critical/High vulnerability reported
├── Is vulnerable code reachable in production?
│   ├── YES → Fix immediately (update, patch, or replace)
│   └── NO (dev-only, unused path) → Fix soon, not a release blocker
└── Fix available?
    ├── YES → Update to patched version
    └── NO → Workaround, replace dep, or allowlist with review date
```

### Before removing a dependency

```
ASK BEFORE REMOVING:
- package-name@version — reason: unused / duplicate / vulnerable with no fix
- Impact: [what breaks if we're wrong]
- Alternative: [replacement if any]
```

## Severity Classification (for /cortexloop aggregation)

| Severity | Criteria |
|----------|----------|
| **Critical** | Known exploitable CVE in production dependency |
| **High** | Confirmed dead code on security-sensitive path; high-severity audit finding |
| **Medium** | Unused dependency adding bundle size; likely dead code with 0 refs |
| **Low** | Unused imports; outdated but patched dep; cosmetic cleanup |
| **Info** | Deprecated API usage (not yet removed) |

## Output Format (Report mode)

```markdown
## Cleanup Findings

### Dead Code

#### [SEVERITY] [symbol or file]
- **Location:** path:line
- **Confidence:** CONFIRMED_DEAD | LIKELY_DEAD | UNCERTAIN
- **Evidence:** [grep results, linter output]
- **Recommendation:** Remove / Keep / Investigate
- **Risk if wrong:** [what breaks]

### Dependencies

#### [SEVERITY] [package@version]
- **Issue:** CVE-XXXX / unused / outdated / duplicate
- **Reachable in production:** yes / no / unknown
- **Recommendation:** Update to X / Remove / Replace with Y
```

## Direct Mode Rules

1. **Never delete without confirmation** for UNCERTAIN or LIKELY_DEAD items
2. **CONFIRMED_DEAD** with 0 references: safe to remove after listing what will be deleted
3. **Dependency updates:** patch/minor first; major version bumps need explicit approval
4. **One category at a time:** dead code first, then deps — run tests between
5. **Keep a removal log** in the final summary

## Verification After Cleanup

```
- [ ] Full test suite passes
- [ ] Build succeeds
- [ ] Linter clean (no new warnings)
- [ ] npm audit / equivalent — no new critical/high issues
- [ ] Bundle size unchanged or smaller (if frontend)
- [ ] No broken imports (grep for removed symbols)
```

## Composition

- **Invoke via:** `/cortexloop` (cleanup pass), or when user asks to clean up dead code or audit dependencies
- **Pairs with:** `simplify` skill (don't remove abstractions that simplify the codebase)
- **Do not invoke from other personas** — orchestration belongs to `/cortexloop`
