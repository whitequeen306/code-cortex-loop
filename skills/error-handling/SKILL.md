---
name: error-handling
description: Deep error-path analysis for /cortexloop. Use with silent-failure-hunter to verify propagation, observability, fallback behavior, retries, and user-visible failure semantics.
---

# Error Handling

Use this skill to verify that error paths are explicit, observable, and recoverable. The goal is to catch real silent failures, not to punish every compact guard clause.

## Depth Checklist

Inspect:

- Empty or overly broad `catch` blocks
- Errors that are logged but then ignored on critical paths
- Fallback values that hide data loss, partial failure, or security failure
- Retry loops without max attempts, backoff, cancellation, or final user-visible error
- Async callbacks/promises without rejection handling
- Batch/transaction flows where partial success is not surfaced
- Error messages that expose internals or omit actionable context

## Evidence Gate

Report only when you can describe:

- The failing operation
- The swallowed or distorted error
- The user/system impact
- The desired propagation, rollback, logging, or recovery behavior

If the behavior is merely a style preference, drop it or mark it `Info`.

## Finding Fields

Every finding must include:

- **Evidence:** specific suppressed/poorly surfaced error path
- **Confidence:** high | medium
- **Hidden error:** what becomes invisible or misleading
- **User/system impact:** practical consequence

Critical/High findings need a concrete failure scenario.
