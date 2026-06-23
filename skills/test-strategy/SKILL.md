---
name: test-strategy
description: Deep test strategy for /cortexloop pass 3. Coverage gaps, test design, regression risk — go deep on verification; defer production logic bugs to pass 1.
---

# Test Strategy (Deep)

Depth skill for **pass 3 (`tests`)**. Pair with `cortexloop-expert-core` and `edge-case-and-state-analysis`.

**Go deep on verification.** Name missing behaviors, design better tests, spot weak assertions and flaky patterns. Production logic bugs → defer `review`; exploit paths → defer `security`.

## Goal

Not maximum coverage percentage — **confidence that important behavior will not silently regress**. Every finding should name a concrete test someone could write tomorrow.

## Depth checklist — what to examine

### Behavior & contracts

- Public API contracts (inputs, outputs, errors, side effects)
- CLI flags, HTTP status codes, event payloads, schema evolution
- Idempotency and retry semantics **as tested** (not just implemented)
- Feature flags / config branches with no test matrix

### Test level fit

| Level | Use when | Red flags |
|-------|----------|-----------|
| **Unit** | Pure logic, single module | Mocking entire world; testing implementation details |
| **Integration** | DB, FS, queue, HTTP client with real or test double | None — gap if boundary untested |
| **E2E** | Critical user journeys | One E2E replacing 20 unit tests for pure logic |

Find wrong level: brittle E2E for math; unit test that mocks the thing you're trying to verify.

### Boundary & edge coverage

- empty, zero, max, null, malformed, unicode, oversized payload
- first item / last item / single item / duplicate items
- clock skew, timeout, slow dependency (where tests exist)
- permission denied vs resource missing (as **test scenarios**, not auth audit)

### Error & failure paths

- network/DB timeout, 500 from dependency, partial write
- validation failure, conflict, rate limit
- cleanup after failure (teardown, rollback) — **tested?**

> Error **handling quality** (swallowed errors) → defer `errorHandling`. Frame here as "no test proves recovery/failure surface."

### Regression & change sensitivity

- Code changed in this PR without adjacent test update?
- Previously fixed bug class without regression test?
- Copy-pasted logic with tests only on one copy?

Prioritize gaps linked to upstream handoff Critical/High items.

### State & concurrency (test angle)

- Tests assume serial execution but production is concurrent?
- Missing test for double-submit, out-of-order callback, stale cache read
- Time-dependent logic without frozen clock / injectable time

Use `edge-case-and-state-analysis` for scenario design.

### Assertion quality

- `expect(true).toBe(true)`, snapshot of entire DOM without intent
- Asserting mock was called instead of outcome
- Too loose matcher (`toContain` when exact value matters)
- No assertion on error type/code/message

### Flaky & slow patterns

- Real timers, network, race without `waitFor`
- Shared mutable fixtures between tests
- Order-dependent tests
- Non-deterministic ordering compared with strict equality

### Test maintainability (in scope when it hides gaps)

- Test name doesn't describe behavior → hard to know what's missing when deleted
- Giant fixture obscures which fields matter for the scenario

## Evidence gate

Report a missing-test finding only when:

1. **Behavior** is user-visible, data-changing, or release-critical
2. **Specific test** can be named: setup → action → assertion
3. **Existing tests** do not cover it directly or indirectly
4. **Failure it would catch** is a concrete regression class

Do not report "coverage should be 80%" without naming behaviors.

## Severity guidance

| Severity | Test gap examples |
|----------|-------------------|
| **Critical** | No test for payment/data-loss path; security-critical flow untested (defer exploit to pass 2, frame as test gap) |
| **High** | Core workflow branch untested; upstream Critical fix without regression test |
| **Medium** | Important edge case; weak assertion on common path |
| **Low** | Nice-to-have scenario; duplicate coverage at lower level |
| **Info** | Test style / naming improvement |

## Deep finding template

```markdown
### High — No regression test for concurrent order cancel
- **Location:** tests/orders.test.ts (gap) — production: src/orders/cancel.ts:44
- **Category:** tests
- **Problem:** cancel() race fixed in CL-012 but no test simulates in-flight payment + cancel
- **Evidence:** grep shows cancel tests only cover happy path; handoff 01 flagged race at cancel.ts:44
- **Confidence:** high
- **Recommendation:** Add integration test: start payment stub (delay), call cancel, assert neither double-charge nor orphaned pending
- **Recommended Test:** setup pending order + slow payment mock → cancel → assert single terminal state
- **Failure It Would Catch:** reintroduced lost-update on concurrent cancel/pay
- **Auto-fixable:** no
```

## Review procedure

1. Read upstream handoffs — list Critical/High items needing regression tests
2. Map scope files → existing test files (naming conventions, `__tests__`, `.spec.`, `.test.`)
3. For each public behavior changed: locate test or mark gap
4. Read tests **before** re-reading implementation (intent first)
5. For each gap: write the test you would add; if you can't, it's not a finding

## Defer map

| Signal | Defer pass |
|--------|------------|
| Production code is wrong (proven without test angle) | `review` |
| Exploit / missing auth | `security` |
| catch {} swallows errors | `errorHandling` |
| Benchmark missing | `performance` |
| Test helper overly complex | `simplicity` |
| Unused test utility / dep | `cleanup` |

## Anti-patterns

- "Add more tests" without naming behaviors
- Counting lines of coverage
- Suggesting E2E for every gap
- Duplicating pass-1 logic analysis as "needs test" without saying which behavior
