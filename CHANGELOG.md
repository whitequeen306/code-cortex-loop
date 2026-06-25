# Changelog

All notable changes to CodeCortexLoop are documented here.

## [2.2.1] - 2026-06-25

### Added
- **Large-project context engineering** — disk-as-relay-bus for 7-pass pipeline on 600+ file scopes
- `scripts/build-scope-manifest.mjs` — scope paths on disk; never inline in orchestrator prompts
- `scripts/handoff-summary.mjs` — compact pass summaries for thin orchestrator
- `scripts/compact-context.mjs` — structured `context-anchor.md` + `run-state.json` after each pass
- Map → Depth phase when `fileCount > scope.mapThreshold` (default 100)
- `PASS_COMPLETE` return protocol — experts write full artifacts; orchestrator receives status only

### Changed
- `commands/cortexloop.md` — Step 2/2.5 context-safe scope, one-pass-per-turn Task chain
- `rules/cortexloop-workflow.mdc` — scope manifest, map phase, compaction hooks
- `passes/*.md` + `cortexloop-expert-core` — ephemeral subagent context + on-demand retrieval
- `scripts/lib/shared.mjs` — scope/context path constants + handoff summary helpers
- README — documents borrowed methods (CodeDelegator, Magistrate, CAT, Cursor Subagents) and problems solved

## [2.2.0] - 2026-06-23

### Added
- **Go-public engineering pass**: case studies on real repos (chokidar, fastify-hello, flask-todo)
- `scripts/validate-handoffs.mjs` — fail-fast handoff validation before scoring
- `scripts/run-summary.mjs` — pass count, duration, estimated token usage
- `scripts/benchmark-perf.mjs` — performance budget documentation generator
- `scripts/install-remote.sh` / `install-remote.ps1` — one-line install without clone
- `docs/GUIDE.md`, `docs/PERFORMANCE.md`, `docs/LAUNCH.md`
- Demo GIF: `docs/assets/cortexloop-demo.gif`
- `TOOL_TASK_SUPPORT` constant — documents full vs fallback tool modes
- CHANGELOG, CONTRIBUTING, GitHub issue/PR templates

### Changed
- README trimmed to quick judgment + case studies + competitor comparison
- `commands/cortexloop.md` — fallback warning, validate-handoffs, run-summary in pipeline
- `AGENTS.md` — fallback behavior column

### Documentation
- Honest tool support matrix: Cursor/Claude Code = full Task; others = single-session fallback

## [2.1.0] - 2026-06-16

### Added
- Playbook bilingual export (`playbook-zh.md` for humans, `playbook.json` for models)
- Health badge, history trending, baseline ratchet
- GitHub composite Action (`action.yml`)

## [2.0.0] - 2026-06-10

### Added
- Seven-expert sequential pipeline with mandatory Task subagents
- Pass contracts (`passes/01-correctness.md` … `07-cleanup.md`)
- Handoff JSON protocol (`schemas/pass-handoff.schema.json`)
- Anti-hallucination Playbook trust model (candidate / verified / quarantined)
- HTML dashboard, CI gate, PR comment generation
- Adapters for Cursor, Claude Code, Qoder, Trae, OpenCode, Codex

[2.2.0]: https://github.com/whitequeen306/code-cortex-loop/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/whitequeen306/code-cortex-loop/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/whitequeen306/code-cortex-loop/releases/tag/v2.0.0
