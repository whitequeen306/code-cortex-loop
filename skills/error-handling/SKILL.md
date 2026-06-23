---
name: error-handling
description: Deep error-path analysis for /cortexloop pass 4. Propagation, observability, recovery — go deep on failure semantics; defer security exploits and logic bugs to other passes.
---

# Error Handling (Deep)

Depth skill for **pass 4 (`errorHandling`)**. Pair with `cortexloop-expert-core` and `edge-case-and-state-analysis`.

**Go deep on failure semantics.** Trace what happens when things go wrong — visibility, propagation, recovery, partial failure. Security exploit via error message → defer `security`; wrong business result → defer `review`.

## Goal

Catch **silent failures** and **misleading failure behavior** — not every compact guard clause. A good finding names the hidden failure and who suffers.

## Depth checklist

### Swallowing & masking

- Empty `catch {}` or `catch (e) { log(e) }` then continue on critical path
- `.catch(() => null)` / `Result` ignored / floating promise
- Optional chaining short-circuit hiding undefined from missing upstream failure
- Default fallback values (`|| []`, `?? 0`) that hide absent data or failed fetch

### Propagation

- Error transformed to generic message losing actionable context for callers
- Re-throw without `cause` / wrapped exception losing stack
- Mixed sync/async: callback err not checked; event emitter error unhandled
- Go/Rust: `_ = err` / unwrap in non-test code

### Critical vs non-critical paths

- Same swallow policy for payment write and analytics ping
- Background job failure invisible to operator
- User sees success UI while async step still failing

### Retries & resilience

- Retry without max attempts, exponential backoff, or jitter
- Retry on non-idempotent operation → duplicate side effects
- Circuit breaker missing on cascading failure
- Timeout too long / missing → hung request blocks resources

> Retry **performance** cost → defer `performance`. Frame here as wrong recovery semantics.

### Partial failure & transactions

- Batch: item 3 fails — are items 1–2 committed? User informed?
- Saga/compensation missing after step 2 succeeds, step 3 fails
- File written then DB rollback → orphan artifact
- Dual write inconsistency (cache updated, DB not)

### Observability

- Error logged without correlation id / request context
- Log level wrong (ERROR for expected validation; DEBUG for data loss)
- Metrics never incremented on failure class
- Alerting gap on silent degradation (fallback always used)

### User-visible semantics

- Generic "Something went wrong" with no recovery action
- Error message leaks stack/internal path (note → defer `security` if exploit)
- Wrong HTTP status (500 for validation → 422 expected)
- Partial success response without indicating which parts failed

### Language / framework patterns

**JavaScript/TS:** unhandled rejection, `async` without try in route handler, axios interceptor eating errors

**Python:** bare `except:`, `Exception` catch-all returning None

**Go:** error return ignored, `%v` wrap without chain

**Rust:** `unwrap`/`expect` in prod path, `let _ =`

## Evidence gate

Report only when you can describe:

1. **Failing operation** (what was attempted)
2. **What happens to the error** (swallowed, transformed, lost)
3. **Who doesn't know** (user, operator, downstream, caller)
4. **Concrete scenario** (steps to hit the bad path)
5. **Desired behavior** (propagate, rollback, surface, retry with limit)

Style-only preferences → Info or drop.

## Severity guidance

| Severity | Examples |
|----------|----------|
| **Critical** | Payment/data write fails silently; partial batch loss invisible |
| **High** | Critical path log-and-continue; retry storm without cap |
| **Medium** | Misleading fallback on secondary path; weak error context |
| **Low** | Logging improvement; non-critical path |
| **Info** | Naming/consistency of error types |

## Deep finding template

```markdown
### Critical — Import job marks success when half the rows failed
- **Location:** src/jobs/import.ts:112
- **Category:** errorHandling
- **Problem:** per-row errors caught and logged; loop completes; job status set SUCCESS
- **Evidence:** Trigger: CSV row 50 invalid; Path: catch at L108 → continue → finalize SUCCESS at L112; Impact: operators never retry; 49 rows committed silently partial
- **Confidence:** high
- **Hidden error:** row validation failures never surface to job result
- **User/system impact:** silent partial import; downstream reports wrong totals
- **Recommendation:** accumulate failures; COMPLETED_WITH_ERRORS if any row failed; expose count in API
- **Auto-fixable:** no
```

## Review procedure

1. Read handoffs 01–03 — prioritize error paths for Critical/High upstream items
2. Grep scope for `catch`, `.catch`, `except`, `unwrap`, `||`, `??`, `try`/`Result`
3. For each external I/O boundary: trace success **and** failure return to UI/log/metric
4. For batch/async: enumerate partial-failure states
5. Pair with `edge-case-and-state-analysis` for cancel/timeout mid-flight

## Defer map

| Signal | Defer pass |
|--------|------------|
| Wrong business rule (not failure handling) | `review` |
| SQLi via error detail | `security` |
| No test for error path | `tests` |
| Retry causes load/latency | `performance` |
| Simplify nested try blocks | `simplicity` |
| Dead error handler code | `cleanup` |

## Anti-patterns

- Flag every ternary as "hidden failure"
- Suggest logging alone without propagation fix
- Ignore operator/user visibility
- Confuse validation errors with swallowed infrastructure errors
