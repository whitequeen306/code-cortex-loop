# CodeCortexLoop Case Studies

Real open-source repositories analyzed with CodeCortexLoop v2.2 on **Cursor** (full Task subagent pipeline). Each folder contains pre-generated reports — no AI tool required to preview results.

| Repository | Language | Scope | Score (before) | Top findings | Report |
|------------|----------|-------|----------------|--------------|--------|
| [chokidar](chokidar/) | Node.js | ~3.2k LOC, file watcher | 71 | Race in `awaitWriteFinish`, unhandled `error` on watchers | [report.html](chokidar/docs/cortexloop/report.html) |
| [fastify-hello](fastify-hello/) | Node.js | ~800 LOC, REST API | 64 | Missing auth on admin routes, no rate limit | [report.html](fastify-hello/docs/cortexloop/report.html) |
| [flask-todo](flask-todo/) | Python | ~600 LOC, CRUD app | 68 | SQL injection in search, bare `except:` | [report.html](flask-todo/docs/cortexloop/report.html) |

## How these were produced

1. Clone repo at pinned commit (see each case study README)
2. Run `/cortexloop` in **Report mode**, scope = whole project
3. Run post-processing: `make-dashboard`, `make-badge`, `run-summary`
4. Optional **Direct mode** on subset — see reflection docs

> These are **real analysis outputs**, not synthetic demo data. Findings reference actual file paths at the pinned commit.

## Compare with demo-app

[../demo-app/](../demo-app/) is a **deliberately flawed** mini app for learning the tool. Case studies show behavior on **real** codebases strangers might recognize.
