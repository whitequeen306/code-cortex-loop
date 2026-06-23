# Case Study: chokidar

| Field | Value |
|-------|-------|
| Repository | [paulmillr/chokidar](https://github.com/paulmillr/chokidar) |
| Pinned commit | `7f6b645` (representative 3.x tree) |
| Tool | Cursor + CodeCortexLoop v2.2 |
| Mode | Report → Direct (2 High fixes) |
| Date | 2026-06-18 |

## Why this repo

Popular npm file watcher (~50M weekly downloads). Small enough for a full 7-pass scan, complex enough for real concurrency and error-handling findings.

## Results

| Metric | Before | After Direct |
|--------|--------|--------------|
| Overall | 71 | 79 |
| Critical | 0 | 0 |
| High | 3 | 1 |
| Duration (7 passes) | ~8m 20s | — |

## Top findings (before)

1. **High** — `lib/fsevents-handler.js`: race between `add` and `change` when `awaitWriteFinish` polling interval is shorter than write latency
2. **High** — `index.js`: `error` events on individual watchers not forwarded when `ignoreInitial` + glob root
3. **Medium** — `lib/nodefs-handler.js`: synchronous `fs.statSync` in hot path for large directory trees

## Artifacts

- [report.json](docs/cortexloop/report.json) — machine-readable
- [report.html](docs/cortexloop/report.html) — dashboard
- [08-reflection.md](docs/cortexloop/08-reflection.md) — Direct mode learnings
- [.cortexloop/handoff/](.cortexloop/handoff/) — 7 expert handoffs

## Reproduce

```bash
git clone https://github.com/paulmillr/chokidar.git
cd chokidar && git checkout 7f6b645
# Install CodeCortexLoop, then in Cursor:
/cortexloop
```
