# Case Study: fastify-hello

| Field | Value |
|-------|-------|
| Repository | Community Fastify REST tutorial (composite) |
| Scope | ~800 LOC, 12 routes, JWT auth partial |
| Tool | Cursor + CodeCortexLoop v2.2 |
| Date | 2026-06-19 |

## Results

| Metric | Value |
|--------|-------|
| Overall (before) | 64 |
| Critical | 1 |
| High | 4 |

## Top findings

1. **Critical** — `routes/admin.js`: DELETE `/users/:id` has no auth hook
2. **High** — `plugins/db.js`: connection string logged on startup in debug mode
3. **High** — No rate limiting on `/auth/login`
4. **High** — `tests/` — only health check covered

See [report.html](docs/cortexloop/report.html).
