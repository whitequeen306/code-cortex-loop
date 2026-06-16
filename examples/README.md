# Supercode Demo Walkthrough

This folder contains a **deliberately flawed** mini app plus **pre-generated Supercode outputs** so you can see results without running an AI tool first.

## What's inside

```
examples/demo-app/
├── src/                    # Bug garden (7 pass types)
├── docs/supercode/
│   ├── report.json           # Machine-readable findings
│   └── report.html           # Visual dashboard (open in browser)
└── .supercode/
    ├── history.json          # Score trend (3 runs)
    ├── health-badge.svg      # README-ready badge
    └── baseline.json         # Accepted debt snapshot
```

## Buried issues (by pass)

| Pass | File | Issue |
|------|------|-------|
| Review | `src/utils.js` | Off-by-one loop (`i <= length`) |
| Security | `src/api.js` | SQL injection via string concat |
| Tests | `tests/` | Only smoke test — no api/utils coverage |
| Performance | `src/api.js` | N+1 author fetch in loop |
| Simplify | `src/utils.js` | 35-line nested `processOrder` |
| Error handling | `src/api.js` | Empty catch swallows DB errors |
| Cleanup | `src/utils.js`, `package.json` | Dead export + outdated lodash |

## Try it yourself

### 1. Open pre-generated dashboard

**In browser (interactive):**

```bash
# Windows
start examples/demo-app/docs/supercode/report.html

# macOS
open examples/demo-app/docs/supercode/report.html
```

**Screenshot (for README / docs):**

![Supercode dashboard preview](demo-app/docs/supercode/report-dashboard.png)

The dashboard shows:
- Overall health score ring (58 in demo)
- Score trend across 3 runs
- 7 category score bars
- Open findings table with severity colors

### 2. Run post-processing scripts (from repo root)

```bash
cd examples/demo-app

node ../../scripts/make-badge.mjs docs/supercode/report.json
node ../../scripts/make-dashboard.mjs docs/supercode/report.json --history=.supercode/history.json
node ../../scripts/baseline.mjs accept docs/supercode/report.json
node ../../scripts/pr-comment.mjs docs/supercode/report.json
```

### 3. Run Supercode on the demo (with your AI tool)

```text
cd examples/demo-app
/supercode
```

Choose **Report mode** first. Compare AI output to the bundled `report.json`.

### 4. Direct mode — watch scores improve

```text
/supercode
→ Direct mode
```

After fixes, re-run post-processing:

```bash
node ../../scripts/record-history.mjs docs/supercode/report.json
node ../../scripts/make-dashboard.mjs docs/supercode/report.json
```

Health score should climb in `.supercode/history.json` and the dashboard trend chart.

## Baseline ratchet demo

```bash
cd examples/demo-app
node ../../scripts/baseline.mjs accept docs/supercode/report.json
# fix SC-001 only, re-analyze, then:
node ../../scripts/baseline.mjs diff docs/supercode/report.json
node ../../scripts/ci-gate.mjs docs/supercode/report.json --baseline
```

CI passes if no **new** Critical/High — remaining baseline debt is ignored.

## CI / Action

See [action.yml](../action.yml) and [.github/workflows/supercode-example.yml](../.github/workflows/supercode-example.yml) at repo root.
