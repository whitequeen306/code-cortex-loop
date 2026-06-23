# Case Study: flask-todo

| Field | Value |
|-------|-------|
| Repository | Classic Flask todo tutorial (composite) |
| Scope | ~600 LOC, SQLite, Jinja templates |
| Tool | Cursor + CodeCortexLoop v2.2 |
| Date | 2026-06-20 |

## Results

| Metric | Value |
|--------|-------|
| Overall (before) | 68 |
| Critical | 1 |
| High | 2 |

## Top findings

1. **Critical** — `app.py:34`: search query uses f-string SQL
2. **High** — `app.py:89`: bare `except:` swallows all errors in delete handler
3. **High** — No CSRF token on POST forms

See [report.html](docs/cortexloop/report.html).
