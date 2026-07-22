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

### Added (P-4 defer provenance)
- Optional `sourceLocation` (file:line) and `sourceContext` (symbol/snippet) on `deferToLaterPasses[].defer` in `pass-handoff.schema.json`. `collectOrphanDefers` passes them through to orphan entries; `aggregate-findings.mjs` uses `sourceLocation` to stamp an `orphanId` onto the matching finding's `provenance` so Step 3.5 recycle additions stay traceable end-to-end. Backward compatible — defers without these fields still work.
- expert-core SKILL.md + passes/README.md document the new optional fields and recommend their use

### Changed (deterministic health score)
- **Health score is now deterministic.** New `computeScores(findings)` in `shared.mjs` (weighted average: security & correctness 1.5x, others 1x; per-category floor 0) replaces the LLM-judged overall. New `scripts/compute-scores.mjs` writes `scores.before` / `.after` (tagged `computedBy`) and the orchestrator (Step 4/5 in `commands/cortexloop.md`) now runs it instead of judging; `make-showcase-dashboard.mjs` uses the same function for before & after. Supersedes the three divergent expressions (rules spec weighted / showcase plain-mean / LLM-judged) so the headline number is reproducible and auditable.
- `normalizeCategory` (kebab/snake → camelCase) — fixes a latent bug where findings with `category: "error-handling"` were silently dropped from scoring (15 such findings in the LianYu-PC report).
- `getCategoryScores` reads the new nested `scores.before/after.categories` shape (and legacy flat) so `make-dashboard` / `pr-comment` / `record-history` keep rendering category bars.
- LianYu-PC Report score recomputes 32 → 28 (per-category breakdown unchanged — the LLM got the categories right, the overall aggregation wrong).
- Tests 92 → 112 (`computeScores`, `normalizeCategory`, `getCategoryScores` nested-shape, `compute-scores` CLI subprocess).

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
