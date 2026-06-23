---
name: performance-optimization
description: Deep performance analysis for /cortexloop pass 5. Hot paths, complexity, measurement — go deep with proof; defer correctness and security to other passes.
---

# Performance Optimization

> Methodology adapted from [performance-deity](https://github.com/v0idOS/performance-deity) (MIT). Every optimization must be proven with real numbers.

## Overview

Optimize code by measuring first, analyzing bottlenecks, applying targeted fixes, and proving improvement with before/after benchmarks. Never guess at performance — measure, fix, verify.

## When to Use

- Code review flags slow paths, N+1 queries, or unbounded operations
- `/cortexloop` performance pass
- User reports latency, jank, or high memory usage
- Before/after a refactor that touches hot paths
- React/Next.js apps with unnecessary re-renders
- API endpoints with missing pagination or eager loading

**When NOT to use:**
- Code is not on a hot path and no measurable problem exists
- Premature optimization would harm readability without measurable gain
- You cannot run benchmarks in the current environment (note this and use static analysis only)

## The Four Phases (Required)

Execute all four phases in order. Do not skip any phase when applying fixes in Direct mode.

### Phase 1 — Establish Baseline

1. Identify the exact code path to optimize (function, query, component, endpoint).
2. Run a micro-benchmark:
   - Write a **temporary** benchmark script in the workspace.
   - Include a warm-up phase (≥10 iterations, discard results).
   - Run ≥100 iterations; record **Average** and **P95** execution time.
   - Run via terminal, then **delete** the temporary script.
   - Fallback: use `time` / built-in profilers if the script fails due to missing deps.
3. Record baseline numbers before writing any optimized code.
4. In Report mode, include baseline numbers in the finding even if no fix is applied yet.

### Phase 2 — Algorithmic Analysis

State explicitly:

- **Time complexity** (Big-O) of the current implementation
- **Space complexity** and primary allocation sites
- **Bottleneck** in one precise sentence, e.g.:
  - "Nested loops causing O(n²) scaling"
  - "N+1 query: one SELECT per item in loop"
  - "Full table scan — missing index on `user_id`"
  - "React parent re-render cascades to all list items"
  - "Synchronous file read blocks event loop"

### Phase 3 — Refactoring

Apply fixes in priority order (highest impact first):

| Category | Patterns to fix | Typical fix |
|----------|-----------------|-------------|
| **Database** | N+1, missing indexes, SELECT * | JOIN/batch load, `EXPLAIN ANALYZE`, add index |
| **Algorithm** | O(n²) lookups, repeated scans | Hash map/set, sort + binary search |
| **Memory** | Unbounded arrays, leak refs | Pagination, streaming, weak refs / cleanup |
| **Async** | Sync I/O on hot path | `async/await`, parallel with limits |
| **Network** | Over-fetching, no cache | GraphQL field selection, ETag, compression |
| **Frontend** | Re-renders, large bundles | `memo`, virtualization, code splitting |
| **Build** | Slow CI, cold builds | Cache layers, incremental builds |

After each change in Direct mode:
1. Re-run the benchmark from Phase 1.
2. If not measurably faster → revert and try a different approach.
3. Run existing tests — optimization must not break behavior.

### Phase 4 — Report

Present a Performance Report table for every applied optimization:

| Metric | Baseline | Optimized | Δ |
|--------|----------|-----------|---|
| Average | Xms | Yms | -Z% |
| P95 | Xms | Yms | -Z% |

Follow with a one-paragraph explanation grounded in CPU/memory/I/O theory.

In Report mode (no changes applied), use this table with projected improvements and mark as **estimated** until verified.

## Stack-Specific Checklists

### Database (SQL / ORM)

```
- [ ] Run EXPLAIN ANALYZE on slow queries
- [ ] Check for N+1 (ORM eager vs lazy loading)
- [ ] Verify indexes on WHERE/JOIN/ORDER BY columns
- [ ] Pagination on list endpoints (limit + cursor/offset)
- [ ] Avoid SELECT * — fetch only needed columns
```

### React / Next.js

```
- [ ] Profile with React DevTools — identify avoidable re-renders
- [ ] memo/useMemo/useCallback only where profiling shows benefit
- [ ] Virtualize long lists (react-window, tanstack-virtual)
- [ ] Dynamic import for heavy components
- [ ] Check bundle size impact (next/bundle-analyzer or equivalent)
```

### Node.js / Backend

```
- [ ] No sync fs/crypto on request path
- [ ] Connection pooling for DB/Redis
- [ ] Rate-limit expensive endpoints
- [ ] Cache pure/read-heavy responses with TTL
```

### Python

```
- [ ] Profile with cProfile/py-spy before optimizing
- [ ] Vectorize with numpy/pandas where appropriate
- [ ] Use generators for large datasets
- [ ] Avoid repeated regex compilation in loops
```

## Severity Classification (for /cortexloop aggregation)

| Severity | Criteria |
|----------|----------|
| **Critical** | O(n²) or worse on user-facing path; unbounded memory; blocks event loop |
| **High** | N+1 queries; missing pagination; measurable P95 > 500ms on core flow |
| **Medium** | Avoidable re-renders; missing cache; suboptimal but acceptable |
| **Low** | Micro-optimization; premature unless hot path |

## Output Format (Report mode)

```markdown
## Performance Findings

### [SEVERITY] [Title]
- **Location:** path:line
- **Bottleneck:** [precise description]
- **Current complexity:** O(?)
- **Baseline:** Avg Xms, P95 Yms (or "not measured — static analysis only")
- **Recommendation:** [specific fix]
- **Projected improvement:** [estimate or measured Δ]
```

## Rules

1. **No optimization without measurement** — except static analysis findings flagged as "unverified"
2. **Preserve behavior** — performance changes must pass all existing tests
3. **One change at a time** in Direct mode — benchmark after each
4. **Prefer architectural fixes** over micro-optimizations (fix N+1 before tweaking loops)
5. **Document trade-offs** — if a fix adds complexity, say so
