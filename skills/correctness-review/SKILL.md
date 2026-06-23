---
name: correctness-review
description: Deep correctness and architecture analysis for /cortexloop pass 1. Logic, invariants, structure, and maintainability — go deep here; defer other domains via handoff.
---

# Correctness & Architecture Review (Deep)

Depth skill for **pass 1 (`review`)**. Pair with `cortexloop-expert-core` and `edge-case-and-state-analysis`.

**Go deep on correctness and architecture.** This is not a shallow lint pass — trace logic, invariants, and structural fit. Other domains (security exploits, test gaps, perf bottlenecks, dead code) get **defer notes**, not scored findings in this pass.

## When to go deep

- New or changed control flow, state, APIs, data transforms
- Bug fixes (verify fix **and** whether the root cause class exists elsewhere)
- Refactors that move logic across modules
- Concurrent, async, or event-driven paths
- Domain rules encoded in multiple places

## Correctness — deep checklist

### Requirements & behavior

- Does observable behavior match the stated task/spec?
- Are success and failure outcomes both defined and reachable?
- Do defaults match domain expectations (not just "non-null")?
- Are implicit assumptions documented in code or violated silently?

### Logic & arithmetic

- Off-by-one, wrong comparator, inverted boolean, wrong operator precedence
- Integer overflow/truncation, float comparison, unit mismatch
- Wrong aggregation (sum vs count, average on empty set)
- Timezone/date boundary errors, DST, leap seconds where relevant

### State & concurrency

- Read-modify-write races, check-then-act gaps
- Stale reads after async gaps; cache not invalidated when state changes
- Double application of events (idempotency missing on **logic** side)
- Shared mutable state across requests/workers without synchronization
- Lifecycle bugs: subscribe without unsubscribe, init order, teardown skipped

### Edge inputs (logic angle)

- null, undefined, empty string, empty array, empty map
- Zero, negative, MAX_INT, empty pagination cursor
- Duplicate keys, partial records, optional fields missing
- Malformed but parseable input that reaches business logic

> Input **sanitization / injection** → defer `security`. **Missing test** for an edge → defer `tests`.

### Error paths (logic angle)

- Happy path works but alternate branch returns wrong type/value
- Early return skips required cleanup of **logical** state
- Guard clause masks a deeper invariant violation

> Swallowed errors, empty catch, bad fallbacks → defer `errorHandling`.

### Data integrity

- Partial writes without rollback story (logic consequence)
- Orphan records, dangling references, inconsistent denormalized fields
- Lost updates, last-write-wins when merge was required

## Architecture — deep checklist

### Module boundaries

- Responsibilities clear? Single reason to change per module?
- Leaky abstractions (caller must know implementation details)
- Feature logic scattered across layers (handler + util + hook all encode same rule)
- God objects / modules that know too much

### Dependencies & direction

- Circular imports or runtime circular requires
- Domain logic depending on UI/transport/framework internals
- Inverted dependency (core imports from adapter incorrectly)
- Duplicated business rules in two modules (will diverge)

### API & contracts

- Callers can invoke functions in invalid order?
- Nullable return where callers assume present?
- Breaking change to public contract without migration path?
- Enum/stringly-typed states that invalid values can enter?

> Authz on API → defer `security`. N+1 in API handler → defer `performance`.

### Pattern consistency

- Same problem solved three different ways in one codebase
- New pattern introduced without justification vs existing convention
- Abstraction added for one call site (premature generalization)

## Readability & maintainability (in scope when it hides bugs)

Focus on clarity that affects **correctness risk**, not style preferences:

- Names that hide wrong semantics (`users` that's actually active users only)
- Control flow that obscures invariants (deep nesting hiding missing else)
- Magic numbers/strings encoding business rules without named constants
- Comments that contradict code (Chesterton's Fence: verify before trusting)

> Pure formatting, rename-only nits, behavior-preserving simplification → defer `simplicity` or Info.

## Review procedure (depth workflow)

### 1. Establish intent

```
- What should this change accomplish?
- What invariants must always hold?
- What did upstream handoffs defer here? (pass 1: usually none)
```

### 2. Read tests first (for intent, not coverage scoring)

- What behavior do tests **claim** is expected?
- Do tests encode wrong assumptions? (logic finding)
- Do not score "missing test" here — note in `deferToLaterPasses` → `tests`

### 3. Trace critical paths

For each hot path in scope:

```
Input → validation (logic) → transform → persist/read → output
Mark: branches taken, state before/after, what can go wrong
```

Use `edge-case-and-state-analysis` for state machines and ordering.

### 4. Compare to neighbors

- How does similar code elsewhere handle the same concern?
- Is this change consistent or an accidental fork of truth?

### 5. Classify findings

| Severity | Correctness examples |
|----------|---------------------|
| **Critical** | Data loss/corruption, broken core workflow, race with production impact |
| **High** | Wrong result on common path, invariant violated under realistic input |
| **Medium** | Edge case wrong with limited blast radius |
| **Low** | Defensive improvement, unclear but currently safe |
| **Info** | Maintainability note without proven bug |

Every scored item needs **Trigger → Path → Expected vs actual → Impact**.

## Defer map (flag, don't score)

| Signal | Defer pass |
|--------|------------|
| SQLi, XSS, secrets, authz bypass | `security` |
| No test for behavior | `tests` |
| catch {} / silent failure | `errorHandling` |
| N+1, unbounded loop, sync I/O on hot path | `performance` |
| Extract method / reduce nesting (same behavior) | `simplicity` |
| Unused symbol / dead file | `cleanup` |

## Deep analysis patterns

### Invariant hunting

State what must always be true:

```
"Invariant: account.balance >= sum(pending debits)"
"Violation path: concurrent debit without lock at L42"
```

### Divergent duplication

Same rule in two files — will one be updated without the other?

### Async gap analysis

```
await fetchUser()
// gap: user may be deleted here
await charge(user.id)
```

### Framework vs app bug

Distinguish misuse of framework from application logic error — cite API doc or guarantee when dismissing.

## Anti-patterns (reviewer)

| Trap | Reality |
|------|---------|
| "LGTM, tests pass" | Tests don't prove architecture or un tested edges |
| Score security/perf here because it's "important" | Important ≠ your pass — defer |
| Speculative bugs without trigger path | openQuestions only |
| 50 Medium findings from style | Focus on proven correctness risk |
| Rubber-stamp upstream defer list | Re-verify deferred items still belong elsewhere |

## Output quality bar

A strong pass-1 finding reads like:

```markdown
### High — Stale balance after async transfer
- **Location:** src/ledger.ts:88
- **Category:** correctness
- **Problem:** transfer() reads balance, awaits external call, writes balance without re-read — concurrent transfer can overwrite
- **Evidence:** Trigger: two parallel transfer(A→B) and transfer(A→C); Path: read balance 100 → both pass check → both write → lost update
- **Confidence:** high
- **Recommendation:** optimistic lock on row version or serializable transaction
- **Auto-fixable:** no
```

Go deep enough that a developer can reproduce the failure class without guessing.
