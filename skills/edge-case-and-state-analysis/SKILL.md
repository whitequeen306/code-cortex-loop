---
name: edge-case-and-state-analysis
description: Deep analysis for hard-to-find boundary, state-machine, idempotency, ordering, and concurrency bugs. Use during /cortexloop review, tests, and error-handling passes.
---

# Edge Case and State Analysis

Use this skill when broad review identifies code with branching, state transitions, retries, caching, queues, async ordering, permissions, or external boundaries. It is designed to find non-obvious bugs without rewarding speculative nitpicks.

## Depth Checklist

Look for:

- Boundary inputs: empty, null, missing fields, duplicates, max/min values, invalid encodings
- State transitions: impossible states, skipped states, stale flags, double-submit, double-close
- Idempotency: repeated requests, retries after partial success, duplicate webhooks/events
- Ordering: out-of-order responses, race between fetch/save/delete, stale cache invalidation
- Concurrency: shared mutable state, non-atomic read-modify-write, listener/timer cleanup
- Partial failure: one item in a batch fails, transaction rollback, cleanup after cancellation
- Authorization state: user/role/resource changes between check and use

## Evidence Gate

A finding must include a plausible trigger path:

```markdown
Trigger: [input/event sequence]
Path: [function A -> branch B -> state C]
Impact: [incorrect result/data loss/security/user-visible failure]
```

If you cannot name the trigger path, do not report it as a scored finding. Put it in "Open Questions" only if it is worth human follow-up.

## Severity Guidance

- **Critical/High:** data loss, security bypass, broken core workflow, unrecoverable silent failure
- **Medium:** incorrect edge behavior with limited blast radius
- **Low/Info:** defensive improvement or unclear reachability

## Rules

1. Do not invent impossible input states when earlier validation rules them out.
2. Respect framework guarantees and type invariants.
3. Prefer one well-proven finding over many speculative warnings.
