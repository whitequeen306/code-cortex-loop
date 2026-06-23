---
name: edge-case-and-state-analysis
description: Deep boundary and state-machine analysis for passes 1, 3, 4. Find non-obvious triggers — apply findings within your pass category.
---

# Edge Case & State Analysis (Deep)

Auxiliary depth skill for passes **1 (correctness)**, **3 (tests)**, **4 (errorHandling)**. Pair with the pass domain skill.

**Go deep on triggers and state.** This skill finds *how* bugs happen — your pass contract decides *how to score* them (logic bug vs missing test vs silent failure).

## When to apply

- Branching, flags, enums, status fields
- Retries, queues, webhooks, async callbacks
- Caching, invalidation, read-your-writes
- Permissions/roles checked then used later (timing)
- Batch, pagination, cursor, streaming
- Init/shutdown, subscribe/unsubscribe

## Depth checklist

### Boundary inputs

| Class | Examples to trace |
|-------|-------------------|
| Empty | `[]`, `{}`, `""`, no rows, first page empty |
| Extremes | max length, max int, zero quantity, negative where unsigned expected |
| Missing | optional field absent vs null vs undefined vs wrong type |
| Duplicate | double click, replayed idempotency key, duplicate message |
| Malformed | parse succeeds but semantic garbage reaches logic |

Respect validation: don't invent states ruled out upstream unless you prove validator bypass.

### State machines

- Draw states and transitions mentally or inline in finding
- Impossible state reachable? (PAID + CANCELLED)
- Skipped transition? (DRAFT → SHIPPED without PAY)
- Terminal state re-entered?
- Stale flag after async gap

### Idempotency & duplication

- Same request twice — same outcome or corrupt?
- Webhook redelivery, at-least-once queue consumption
- Client retry after timeout — server already applied?

### Ordering & races

- Response B arrives before A; UI or handler assumes order
- Delete during fetch; update during delete
- Cache read between write and invalidate
- check-then-act without lock

### Concurrency

- Shared map/array mutated from parallel tasks
- Non-atomic read-modify-write on counter/balance
- Timer/interval not cleared; listener leak changes behavior over time

### Partial failure

- 3 of 10 items succeed — what's the aggregate state?
- Rollback partial? Compensation? User sees what?
- Cancel mid-flight — resources cleaned?

### Authorization timing

- Role checked at T0, resource ownership changes at T1, action at T2
- Token valid but session revoked

Score **within your category**:

- pass 1: wrong state / wrong result
- pass 3: no test for transition X→Y under event Z
- pass 4: failure during X→Y not surfaced

Other categories → `deferToLaterPasses`.

## Trigger path template (required for scored findings)

```markdown
Trigger: [concrete input/event sequence]
Path: [A → branch B → state C → outcome D]
Impact: [in YOUR pass category vocabulary]
```

Example (pass 1):

```
Trigger: double POST /checkout with same Idempotency-Key within 200ms
Path: handler1 read none → create; handler2 read none → create (race)
Impact: duplicate charge records (correctness)
```

Example (pass 3):

```
Trigger: (same)
Path: no test uses parallel requests with same key
Impact: regression class untested (tests)
```

## Severity (category-neutral trigger quality)

- **Strong:** reproducible sequence, realistic timing/concurrency
- **Medium:** plausible single-thread edge
- **Weak:** requires impossible input → openQuestions only

## Techniques

### Timeline sketch

```
T0 user clicks Pay
T1 request A in flight
T2 user clicks Cancel
T3 A completes, C completes — final state?
```

### Invariant check

"What must never happen?" — hunt for path that violates it.

### Pairwise branches

When A and B each have 2 outcomes, consider combinations (especially async).

## Rules

1. Prefer one proven trigger over five vague "what if"s
2. Respect types, validators, framework guarantees — cite when dismissing
3. Don't label as security finding in pass 1 — defer exploitable auth bypass to pass 2
4. Depth here supports domain skill — use both together
