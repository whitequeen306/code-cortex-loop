---
name: test-strategy
description: Deep test coverage analysis for /cortexloop. Use with the test-engineer agent to verify that important behavior, boundaries, regressions, and failure paths are actually covered.
---

# Test Strategy

Use this skill to turn broad test concerns into concrete, high-signal findings. The goal is not maximum coverage; it is confidence that important behavior will not silently regress.

## Depth Checklist

Check whether tests cover:

- Public behavior and contracts, not private implementation details
- Boundary values: empty, zero, max/min, null/undefined, malformed input
- Error paths: network/database failure, timeout, invalid permissions, partial writes
- Regression tests for code that was recently changed or previously broken
- State transitions and idempotency: repeated calls, retries, cancellation, out-of-order completion
- Integration boundaries: filesystem, database, queue, cache, external APIs, browser events

## Evidence Gate

Report a missing-test finding only when:

- The untested behavior is user-visible, security-sensitive, data-changing, or release-critical
- A specific test can be named, including setup, action, and expected assertion
- Existing tests do not already cover the behavior indirectly

Do not report "coverage should be higher" as a finding without naming the missing behavior.

## Finding Fields

Every finding must include:

- **Evidence:** current test gap and why existing tests do not cover it
- **Confidence:** high | medium
- **Recommended Test:** exact behavior to test
- **Failure It Would Catch:** the concrete regression or bug class

Low-confidence test ideas belong in recommendations, not scored findings.
