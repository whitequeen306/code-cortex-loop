# CodeCortexLoop Reflection — 2026-06-15

## Summary

Direct-mode run on demo-app fixed 4 high-impact patterns. Overall health score improved from 58 → 82. Smoke tests passed after each fix group.

## Effective fixes

- **N+1 in `getUserPosts`**: Batching author lookups with a single `IN` query eliminated per-row round trips.
- **SQL injection**: Parameterized queries replaced template literals in `getUserPosts` and `createUser`.
- **Silent catch**: Added logging and explicit error return in `createUser` so failures are visible to callers.
- **Giant utility function**: Split validation from formatting in `utils.js` — easier to test in isolation.

## Pitfalls / false starts

- Initial JOIN attempt made the query harder to read; batch-then-map was clearer for this codebase.
- Almost suppressed CL-003 (empty catch) — worth fixing even when tests pass, because production failures would be invisible.

## Next time

- Query playbook **before** analysis — PB-001 and PB-004 would have surfaced these issues faster.
- Run performance pass after security fixes; parameterized queries sometimes reveal missing indexes.
