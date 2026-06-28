# Changelog

All notable changes to CodeCortexLoop are documented here.

## [Unreleased]

### Added
- **`aggregate-findings.mjs`** — machine-checked finding merge + dedup for Step 4. Uses the same `findingFingerprint` as `baseline.mjs` so aggregation and the baseline ratchet agree on what counts as "the same finding." Each aggregated finding carries `evidence` + `confidence` (required by the finding quality gate) and a `provenance` block (`pass`, `expert`, `orphanId` when from Step 3.5 recycle, `sources[]` listing other passes/experts that flagged the same fingerprint).
- `aggregateFindings` + `DEFAULT_AGGREGATED_FINDINGS` exports in `shared.mjs`
- `tests/aggregate-findings.test.mjs` — covers cross-domain dedup, distinct-fingerprint separation, orphanId attachment, missing-handoff tolerance, validateReport pass-through, and the aggregation↔baseline fingerprint invariant
- `evidence` + optional `confidence` + `provenance` fields on the `finding` definition in `cortexloop-report.schema.json`

### Changed
- `validateReport` now rejects report findings missing `evidence` (finding quality gate enforcement at CI gate); invalid `confidence` enum also rejected. Pre-existing report fixtures updated to include evidence.
- Step 4 in `commands/cortexloop.md` now invokes `aggregate-findings.mjs` instead of leaving merge/dedup to inline LLM work; CL-### numbering happens after suppression on the script's severity-first output
- README "质量不会降的原因" updated to describe machine-checked aggregation

## [2.4.0] - 2026-06-25

### Added
- **Per-run archive** — `init-run.mjs` creates `docs/cortexloop/runs/{YYYY-MM-DD_HH-mm}/` with human-readable **运行时间** (not ISO in UI)
- `sync-run-latest.mjs` — copies current run to `docs/cortexloop/` for CI/dashboard latest snapshot
- `append-reflection.mjs` — append-only `08-reflection.md` evolution log
- `tests/run-artifacts.test.mjs`

### Changed
- Each `/cortexloop` invocation gets new run folder; expert reports no longer overwrite prior runs
- `08-reflection.md` is single incremental file for Direct evolution (playbook.json remains model memory)
- `record-history.mjs` stores `runId`, `runDisplayTime`, `runDir`
- Step 1 init-run + Step 5b sync documented in orchestrator workflow

## [2.3.0] - 2026-06-25

### Added
- **CortexScope Index** — deterministic MAP pre-index for large scopes (zero npm deps)
- `scripts/build-scope-map.mjs` + `scripts/lib/scope-index.mjs` + `scripts/lib/scope-patterns.mjs`
- Git churn, regex import graph, entry-point heuristics, pass-category pattern buckets
- `scope-map.json` v2.3: hotspots, mustReview, longTailSample, confidence, indexQuality
- Optional Step 2b-enrich when `confidence < scope.mapEnrichThreshold` (default 0.7)
- `schemas/scope-map.schema.json` + `tests/scope-index.test.mjs`

### Changed
- MAP phase: LLM explore replaced by deterministic index (auto from `build-scope-manifest.mjs`)
- `coveragePolicy: prioritize-with-sampling` — experts must sample longTailSample; non-hotspot not out-of-scope
- `loadScopeConfig` + config schema: `scope` object with mapWeights, mapEnrichThreshold, longTailSampleCount
- `commands/cortexloop.md`, `cortexloop-workflow.mdc`, passes, expert-core updated for CortexScope Index

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
