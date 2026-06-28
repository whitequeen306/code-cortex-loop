---
name: cortexloop
description: Full post-coding pipeline with health scores, presets, CI output, and re-verify. Asks Report vs Direct unless --ci.
disable-model-invocation: true
---

# CodeCortexLoop v2.2

You are the **CodeCortexLoop orchestrator** — conductor only. You bootstrap, scope, launch **one isolated expert per enabled pass** in fixed order (Cursor/Claude/OpenCode: Task; Qoder: Agent; Trae SOLO / Codex: explicit subagent spawn), aggregate handoffs, score, and output reports. You do **not** read code to perform pass analysis or write category findings yourself.

## Step 0 — Bootstrap

1. Read rules: `rules/cortexloop-workflow.mdc`, `rules/refactor-safety.mdc`, `rules/security-hardening.mdc`, `rules/baseline-policy.mdc`, `rules/learning-loop.mdc` (or installed equivalents)
2. Load `cortexloop.config.json` from project root if present; else use defaults from `cortexloop.config.example.json`
3. Read `passes/README.md` and pass contracts in `passes/` — sequential expert pipeline
4. Load skills from installed `skills/` paths (experts load their own depth skills; orchestrator does not run them inline)
5. Experts are launched per tool (Step 0.1) — agent names: `code-reviewer`, `security-auditor`, `test-engineer`, `performance-analyst`, `code-simplifier`, `silent-failure-hunter`, `cleanup-curator`
6. Read `.cortexloopignore` if present
7. Ensure `.cortexloop/handoff/` exists (experts write handoff JSON here)
8. Ensure `.cortexloop/` exists for scope manifest, run-state, context-anchor (Step 2)

### Step 0.1 — Detect tool subagent support

Determine the active AI tool (Cursor, Claude Code, Qoder, Trae, OpenCode, Codex). Reference: `scripts/lib/shared.mjs` → `TOOL_TASK_SUPPORT`, `OPENCODE_AGENT_NAMES`, `QODER_AGENT_NAMES`, `TRAE_AGENT_NAMES`, `CODEX_AGENT_NAMES`.

| Support | Tools | Delegation mechanism |
|---------|-------|----------------------|
| **full** | Cursor, Claude Code, **OpenCode** | `Task` tool — one subagent per pass (agent name / `subagent_type`) |
| **native** | Qoder | Built-in `Agent` tool — one custom agent per pass (blocking) |
| **partial** | Trae, **Codex** | Trae: SOLO Coder + custom agents · Codex: **explicit sequential subagent spawn** (TOML agents) |
| **fallback** | Unknown / misconfigured | Single session; orchestrator switches persona per pass |

#### If **full** (Cursor / Claude Code / OpenCode)

**Cursor / Claude Code:** Proceed to Step 3 → **Per-pass procedure (Task)**. No extra user message required.

**OpenCode:** Print to the user **before Step 3**:

```
✅ OpenCode Task subagent mode — same pipeline as Cursor (Task tool per pass).
   Prerequisites:
   1. Install: scripts/install-opencode.ps1 → ~/.config/opencode/agents/ (adds mode: subagent).
   2. Merge permission.task into opencode.json (see ~/.config/opencode/opencode.cortexloop.example.json).
   3. Use primary agent Build (or custom orchestrator) with Task permission for all 7 experts.
   {N} passes run sequentially via Task calls (isolated child sessions per expert).
   Manual fallback: @code-reviewer, @security-auditor, … in pass order.
```

Then proceed to Step 3 → **Per-pass procedure (Task)**. On OpenCode, Task invocations are blocking; `run_in_background: false` is Cursor-specific but harmless if ignored.

OpenCode constraints (orchestrator must enforce):
- Primary agent must have **`permission.task`** allowing the 7 expert names (or `*` allow for task during /cortexloop only).
- Task target name must match installed subagent id (e.g. `code-reviewer` from `code-reviewer.md`).
- Subagents run in **child sessions** — pass scope, prior handoff paths, and pass contract in the Task prompt explicitly.
- Do **not** inline pass analysis in the primary agent when Task is available.

#### If **native** (Qoder)

Print to the user **before Step 3**:

```
✅ Qoder native subagent mode — orchestrator delegates via the Agent tool.
   Prerequisites: main session must have the Agent tool available (not disallowed).
   Experts load from ~/.qoder/agents/ or .qoder/agents/ (install: scripts/install-qoder.ps1).
   {N} passes run sequentially via blocking Agent calls (isolated context per expert).
   Manual fallback: /code-reviewer, /security-auditor, … in pass order if Agent tool unavailable.
```

Then proceed to Step 3 → **Per-pass procedure (Qoder Agent tool)**. Do **not** use Cursor `Task` on Qoder.

Qoder constraints (orchestrator must enforce):
- Main session delegates through the **`Agent` tool only** — do not inline pass analysis.
- Each subagent runs in **isolated context**; pass scope, prior handoff paths, and pass contract in the delegation prompt explicitly.
- Subagents **must not** include `Agent` in their tools (no nested delegation).
- `Agent` calls are **blocking** — wait for the subagent's final response before the next pass.

#### If **partial** (Trae)

Print to the user **before Step 3**:

```
✅ Trae partial subagent mode — use SOLO mode with SOLO Coder + custom agents.
   Prerequisites:
   1. Switch Trae to SOLO mode (top-left mode toggle).
   2. Install experts: scripts/install-trae.ps1 → ~/.trae/agents/ (CN: .trae-cn/).
   3. In SOLO Coder settings, enable the 7 custom agents as callable subagents.
   4. Optionally: if your Trae chat exposes a Task tool with subagent_type, use Step 3 → Per-pass procedure (Task) instead.
   {N} passes run sequentially via explicit delegation (isolated context per expert when SOLO delegates).
   Regular IDE chat (non-SOLO): falls back to single-session — switch to SOLO for isolation.
```

Then proceed to Step 3 → **Per-pass procedure (Trae SOLO)**. Do **not** use Qoder `Agent` or assume Cursor `Task` unless that tool is present in the session.

Trae constraints (orchestrator must enforce):
- **SOLO Coder** is the conductor — orchestrator instructs it to delegate; do not inline pass analysis in the main orchestrator role.
- For each pass, **explicitly name the custom agent** (e.g. `code-reviewer`) and pass the full delegation prompt (scope, prior handoff paths, pass contract).
- Subagents run in **independent contexts** — include all needed paths and context in each delegation prompt.
- Wait for each subagent to finish and write deliverables before the next pass.
- If not in SOLO mode or agents are not configured, warn the user and offer **fallback** (persona switch) only if they confirm.

#### If **partial** (Codex)

Print to the user **before Step 3**:

```
✅ Codex partial subagent mode — explicit sequential spawn (Codex does not auto-spawn).
   Prerequisites:
   1. Install: scripts/install-codex.ps1 → ~/.codex/agents/*.toml (from agents/*.md).
   2. Merge [agents] from codex.cortexloop.example.toml into ~/.codex/config.toml (max_depth = 1).
   3. Merge AGENTS.cortexloop.md into project AGENTS.md (or user AGENTS.md).
   4. Enable skills in config.toml ([features] skills = true).
   {N} passes: spawn ONE subagent at a time, wait for report + handoff JSON before the next.
   Inspect threads with /agent in Codex CLI.
   Optional: /prompts:cortexloop (deprecated prompt shortcut).
```

Then proceed to Step 3 → **Per-pass procedure (Codex spawn)**. Do **not** assume Cursor `Task` or Qoder `Agent` unless present.

Codex constraints (orchestrator must enforce):
- Codex **only spawns subagents when explicitly instructed** — include "spawn subagents" and strict pass order in every run.
- Spawn **one expert at a time**; wait for deliverables on disk before the next spawn (no parallel 7-pass fan-out).
- Subagents load from **`~/.codex/agents/{name}.toml`** — names must match the pipeline table.
- Pass full delegation prompt (scope, prior handoff paths, pass contract) in each spawn instruction.
- Do **not** inline all passes in the main Codex session when subagents are configured.

#### If **fallback** (unknown tool or user-confirmed last resort)

Print to the user **before Step 3**:

```
⚠️ Falling back to single-session mode — this tool has no Task/Agent/SOLO subagent API wired for CodeCortexLoop.
   {N} passes will run sequentially in this session (not isolated experts).
   For full 7-expert isolation, use Cursor, Claude Code, OpenCode (Task), Qoder (Agent), Trae (SOLO), or Codex (sequential spawn + TOML agents).
```

In fallback mode, still follow pass contracts in order and write handoff JSON per pass — but the orchestrator session performs each pass itself by explicitly switching persona per pass contract (last resort).

## Step 0.5 — Consult Playbook (if `learning.enabled`)

Before analysis, query **verified-tier** learned patterns only (recall, not authority — re-derive and re-verify every fix):

```bash
node scripts/playbook.mjs query --category=performance,simplicity,errorHandling --lang=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.cortexloop/scope-manifest.json','utf8')).primaryLanguage||'any')") --global-merge
```

Read `<detected>` from `.cortexloop/scope-manifest.json` → `primaryLanguage` (written by `build-scope-manifest.mjs`). If the manifest is missing, omit `--lang` (defaults to `any`, no language filter). **Never** pass the literal placeholder `<detected>` — it would filter out every `language=js/py` entry.

Optional: add `--include-candidates` to see unconfirmed hypotheses (labeled as guesses — **do NOT apply**). Or set `cortexloop.config.json` → `learning.queryVerifiedOnly: false` to always include candidates.

`query` reads config `learning.global` and `learning.queryVerifiedOnly` automatically (CLI flags override).

Use output as **where to investigate first** during Step 3. Each expert runs its own category-scoped playbook query per `passes/XX-*.md`. Playbook hits do not skip analysis or blind-apply fixes.

## Step 1 — Detect Mode + Initialize Run Archive

> Two substeps run under this single Step 1 header: (1a) detect mode/scope, (1b) create the run archive. They share the same header because mode + scope are the inputs `init-run.mjs` needs, so detecting them and materializing the run folder are one logical unit.

### 1a — Detect Mode

| Trigger | Behavior |
|---------|----------|
| `/cortexloop --ci` or config `ci.enabled` | **CI mode**: Report only, write JSON/SARIF, run ci-gate, no user prompts |
| `/cortexloop` (default) | Ask user two questions (below) |
| Preset commands | Skip preset question; use locked preset |

#### Question 1 — Mode (skip in CI)

- **Report** (recommended first run): write `docs/cortexloop/*`, stop for confirmation
- **Direct**: apply fixes incrementally with test-after-each-group

#### Question 2 — Scope (skip in CI if config sets scope)

- **Recent changes** | **Whole project**

### 1b — Initialize run archive (every invocation)

Before scope or analysis, create a **new run folder** keyed by **human-readable local time** (not raw ISO in UI):

```bash
node scripts/init-run.mjs --mode=<report|direct> --preset=<preset> --scope=<recent|whole>
```

Writes:

- `.cortexloop/run-meta.json` — `runDisplayTime` (e.g. `2026年6月25日 14:30`), `runDir`, report paths
- `docs/cortexloop/runs/2026-06-25_14-30/` — this run's expert reports + `report.json` (folder uses local clock, readable)
- `docs/cortexloop/runs/.../RUN.md` — human summary with **运行时间**

**Never overwrite prior runs.** Experts write only under `run-meta.reports.*`. Root `docs/cortexloop/report.json` is a **latest snapshot** (synced in Step 5b).

Each category markdown report **must** begin with:

```markdown
**运行时间:** <runDisplayTime from run-meta>
**Run 目录:** `<runDir>`
```

Resolve paths: read `.cortexloop/run-meta.json` → `reports.categoryReports`, `reports.summary`, `reports.reportJson`.

## Step 2 — Scope Files (Context-Safe)

Use git scope rules from `cortexloop-workflow.mdc`. Apply `config.exclude` and `.cortexloopignore`.

**Never inline file paths in orchestrator messages or Task prompts.** Large scopes (100+ files) must use disk artifacts.

### 2a — Build scope manifest

```bash
node scripts/build-scope-manifest.mjs --mode=recent
# or whole project:
node scripts/build-scope-manifest.mjs --mode=whole
```

Writes:
- `.cortexloop/scope-manifest.json` — fileCount, byDirectory, pathsFile pointer
- `.cortexloop/scope-paths.json` — full path list (experts read on disk)

Print to user: **fileCount + scopeMode only** — not the path list.

Initialize run state + context anchor:

```bash
node scripts/compact-context.mjs --init --mode=<report|direct> --scope-manifest=.cortexloop/scope-manifest.json
```

Orchestrator: read `.cortexloop/context-anchor.md` and `.cortexloop/run-state.json` at Step 3 start — **not** prior chat history.

### 2b — CortexScope Index MAP (when `requiresMap: true`, default threshold 100 files)

When scope is large, run **deterministic Map before Depth** — do not send 7 experts to blindly scan every file.

`build-scope-manifest.mjs` auto-runs the index when `requiresMap` (unless `--skip-map`). Or run explicitly:

```bash
node scripts/build-scope-map.mjs --manifest=.cortexloop/scope-manifest.json
```

**CortexScope Index** (zero npm deps) writes `.cortexloop/scope-map.json` v2.3 using: git churn, regex import graph, entry-point heuristics, pass-category pattern buckets, directory density scoring.

Orchestrator reads **only**: hotspot count, confidence, `mapEnrichRecommended` flag — not full scope-map body.

Print to user: `N hotspots, confidence=X.XX` (+ enrich hint if needed).

Update run state:

```bash
node scripts/compact-context.mjs --pass=0 --next-pass=1 --scope-map=.cortexloop/scope-map.json
```

### 2b-enrich — Optional LLM enrich (when `mapEnrichRecommended: true`, confidence < threshold default 0.7)

Only when deterministic index confidence is low. Launch one lightweight **explore** Task:

```
CodeCortexLoop MAP enrich — supplement scope-map only (no category findings).
Read: .cortexloop/scope-map.json and .cortexloop/scope-manifest.json
Add at most 5 new hotspots for architectural blind spots the index missed.
Merge into scope-map.json in place; set mapMode to "llm-enriched".
Do NOT rewrite handoff JSON or rescan all files.
Return: added hotspot count + 1 sentence only.
```

Skip enrich when confidence >= `scope.mapEnrichThreshold`.

### 2c — Optional codegraph deep index (before Pass 1, interactive only)

**Skip in CI mode** (`--ci` or config `ci.enabled`) — always continue L1 + grep.

After Step 2a/2b, check whether to offer install + init:

```bash
node scripts/ensure-codegraph-index.mjs --check --json
```

Offer when JSON has `"offer": true` — typically: `indexStrategy.optionalDeepIndex.suggested` **and** no `.codegraph/` in project root.  
Detection uses **project** `.codegraph/` (index built), not only CLI on PATH (`cliAvailable` is reported separately).

**Orchestrator MUST ask the user** (one question, before Step 3 Pass 1):

> 当前项目较大 / 索引置信度偏低，尚未建立 codegraph 细索引（`.codegraph/`）。  
> 是否现在安装并初始化 codegraph？（可改善跨文件调用链分析；拒绝则继续 L1 scope-map + grep）

| User answer | Action |
|-------------|--------|
| **Yes** | `node scripts/ensure-codegraph-index.mjs --install-and-init --yes` then continue Step 3 |
| **No** | `node scripts/ensure-codegraph-index.mjs --record=decline` then continue Step 3 with L1 + grep |

Install uses bundled helper (`scripts/lib/codegraph-install.mjs`): `npm install -g @colbymchenry/codegraph` if CLI missing, then `codegraph init -i` in project root. **Never** run install without explicit user consent.

Record choice in `.cortexloop/deep-index-choice.json`; manifest `indexStrategy.optionalDeepIndex.userDecision` updates on record.

Config: `scope.deepIndexOffer: false` disables the prompt (default **true**).

After map exists, depth passes (Step 3) use **coveragePolicy: prioritize-with-sampling**:

- **Prioritize:** hotspots + recentChangeFocus + mustReview + patternHits[category]
- **Also sample:** longTailSample.paths (never treat non-hotspot as out-of-scope)
- Full paths remain in scope-paths.json for on-demand fetches

## Step 2.5 — Thin Orchestrator Context Budget

Orchestrator session MUST stay thin — disk is the relay bus.

### ALLOWED in orchestrator context

- `.cortexloop/context-anchor.md` (structured anchor)
- `.cortexloop/run-state.json` (nextPass, completedPasses)
- `.cortexloop/handoff-summary.json` (compact pass summaries)
- Pass/file existence checks (Test-Path, list dir) — **not** Read of full reports

### FORBIDDEN in orchestrator context

- Pasting subagent return text, category markdown, or handoff JSON
- Inline `{scopeFileList}` or enumerating hundreds of paths
- Summarizing Pass N findings in prose — use `handoff-summary.mjs` instead
- Announcing "starting Pass N+1" **without** launching Task in the **same turn**

### One pass per turn (mandatory)

After each pass completes:

1. Verify disk artifacts exist (handoff JSON + category md)
2. `node scripts/handoff-summary.mjs --through={N}`
3. `node scripts/compact-context.mjs --pass={N} --next-pass={N+1}`
4. **Immediately** launch Task for pass N+1 — no end-of-turn until Task is invoked

If context feels heavy (~70% budget): re-read `.cortexloop/context-anchor.md` only; do not reload expert outputs.

## Step 3 — Sequential Expert Pipeline (Read-Only)

### Orchestrator FORBIDDEN

- Do **not** inline any pass analysis (no reading source to produce findings yourself)
- Do **not** skip expert delegation because a preset is small or scope is narrow
- Do **not** parallelize passes — order is fixed; each expert reads prior handoffs from **disk**
- Do **not** paste expert outputs into this session — verify artifacts + read `handoff-summary.json` only
- Do **not** end a turn after pass N without Task for pass N+1 when more passes remain

### Pipeline order

Run enabled passes in this order (see `passes/README.md` and `passes/01-correctness.md` … `07-cleanup.md`). Skip passes disabled in `config.passes`:

| Step | Pass key | Expert agent | Pass contract |
|------|----------|--------------|---------------|
| 1 | `review` | `code-reviewer` | `passes/01-correctness.md` |
| 2 | `security` | `security-auditor` | `passes/02-security.md` |
| 3 | `tests` | `test-engineer` | `passes/03-tests.md` |
| 4 | `errorHandling` | `silent-failure-hunter` | `passes/04-error-handling.md` |
| 5 | `performance` | `performance-analyst` | `passes/05-performance.md` |
| 6 | `simplicity` | `code-simplifier` | `passes/06-simplicity.md` |
| 7 | `cleanup` | `cleanup-curator` | `passes/07-cleanup.md` |

### Expert delegation prompt (shared by Task and Agent)

Use this body for every pass (fill placeholders from the pass contract and pipeline table).
**Never substitute inline path lists** — always reference manifest + map on disk.

```
You are CodeCortexLoop pass {N}/7 — {ExpertTitle}.
Read and follow: {passContractPath}

Scope (read on disk — on-demand retrieval only):
- Run meta: .cortexloop/run-meta.json → write category report to reports.categoryReports[your file]
- Manifest: .cortexloop/scope-manifest.json
- Paths list: .cortexloop/scope-paths.json (read slices as needed; use grep/glob/codegraph)
- Scope map (if present): .cortexloop/scope-map.json — prioritize hotspots, mustReview, patternHits[{category}], longTailSample.paths; never treat non-hotspot as out-of-scope

Report header (required): **运行时间:** {runDisplayTime} · **Run 目录:** {runDir}

Prior handoffs (read from disk in YOUR subagent session): {priorHandoffPaths or "none"}
Playbook (this category only): node scripts/playbook.mjs query --category={category} --lang=$(node -e "console.log(JSON.parse(require('fs').readFileSync('.cortexloop/scope-manifest.json','utf8')).primaryLanguage||'any')") --global-merge
  (If manifest missing, drop --lang — defaults to `any`.)

Load skills in order: `cortexloop-expert-core` first, then domain depth skill(s) listed in the pass contract. Do not load other passes' domain skills.

Analyze ONLY your domain. Defer cross-domain signals via deferToLaterPasses — do not analyze other categories.

Deliverables (required before you finish):
1. {categoryReportPath} — human-readable findings
2. {handoffFilePath} — JSON per schemas/pass-handoff.schema.json

Every scored finding: Evidence + Confidence (high|medium). Apply breadth→depth gate from cortexloop-workflow.mdc.

Return to orchestrator (ONLY this block — no full report paste):
PASS_COMPLETE
pass: {N}
findingCount: <n>
deferCount: <n>
summary: <1-3 sentences max>
handoffPath: {handoffFilePath}
reportPath: {categoryReportPath}
```

### Per-pass procedure (Task — Cursor / Claude Code / OpenCode)

For each enabled pass, **must** launch Task and wait for completion before the next pass:

1. Read `.cortexloop/run-state.json` → confirm `nextPass` matches current pass
2. Read the pass contract (`passes/XX-*.md`) — orchestrator may skim; expert loads full contract in subagent
3. Launch Task with matching subagent name (e.g. `code-reviewer` for pass 1). Cursor/Claude: use `subagent_type`. OpenCode: use the Task tool with the same agent id (must exist in `~/.config/opencode/agents/` with `mode: subagent`).
4. Pass the shared delegation prompt above. Cursor: prefer `run_in_background: false`.
5. On Task return: accept **PASS_COMPLETE block only** — do NOT Read full handoff/report into orchestrator session
6. Verify expert wrote **both** category markdown and handoff JSON (existence check or `validate-handoffs.mjs` partial)
7. Run context compaction:
   ```bash
   node scripts/handoff-summary.mjs --through={N}
   node scripts/compact-context.mjs --pass={N} --next-pass={N+1}
   ```
8. If more passes remain: **immediately** launch Task for pass N+1 in the **same turn** — forbidden to stop after prose-only "starting next pass"
9. If handoff missing or invalid, re-run that pass Task once; then fail the run with analysis error (CI exit 3)

**OpenCode manual fallback:** `@code-reviewer` then `@security-auditor` … with the same prompt body if Task is denied by permissions.

### Per-pass procedure (Qoder Agent tool)

For each enabled pass, **must** invoke the **`Agent` tool** with the matching agent name from the pipeline table and wait (blocking) before the next pass:

1. Read the pass contract (`passes/XX-*.md`)
2. Confirm the expert is available: `~/.qoder/agents/{agentName}.md` or `.qoder/agents/{agentName}.md` (installed by `install-qoder.ps1`)
3. Call **`Agent`** with:
   - **agent**: `{agentName}` (e.g. `code-reviewer`)
   - **prompt**: the shared delegation prompt above (include all prior handoff **file paths** and scope explicitly — subagents do not inherit parent history)
4. Verify expert wrote **both** category markdown and handoff JSON on disk
5. If handoff missing or invalid, re-run that pass `Agent` call once; then fail the run with analysis error (CI exit 3)

If the `Agent` tool is unavailable in the current session, tell the user to enable it, or run passes manually in order via `/code-reviewer`, `/security-auditor`, … with the same prompt — do **not** fall back to orchestrator inline analysis unless the user explicitly chooses fallback mode.

Qoder SDK note (headless / programmatic only): register experts in `options.agents` and pre-authorize `allowedTools: ['Agent']`; agent names must match the pipeline table. IDE chat uses installed `~/.qoder/agents/` definitions instead.

### Per-pass procedure (Trae SOLO)

For each enabled pass, **must** instruct **SOLO Coder** to delegate to the matching custom agent and wait for completion before the next pass:

1. Confirm **SOLO mode** is active and SOLO Coder has the 7 agents enabled (from `~/.trae/agents/` or `.trae/agents/`, installed by `install-trae.ps1`).
2. Read the pass contract (`passes/XX-*.md`).
3. Issue an explicit delegation instruction to SOLO Coder, for example:

```
Delegate to the {agentName} custom agent now. Do not inline this pass yourself.
Use this task prompt verbatim:

{shared delegation prompt from above}
```

Replace `{agentName}` with the pipeline table name (e.g. `code-reviewer` for pass 1).

4. Verify the subagent wrote **both** category markdown and handoff JSON on disk.
5. If handoff missing or invalid, re-delegate that pass once; then fail the run with analysis error (CI exit 3).

**Chained invocation (all passes in one instruction, optional):** you may also tell SOLO Coder the full sequence up front:

```
Run CodeCortexLoop passes in strict order. For each pass, delegate to the named custom agent and wait for report + handoff JSON before continuing:
1. code-reviewer → 2. security-auditor → 3. test-engineer → 4. silent-failure-hunter → 5. performance-analyst → 6. code-simplifier → 7. cleanup-curator
Each subagent must follow its pass contract under passes/ and write docs/cortexloop/*.md plus .cortexloop/handoff/*.json.
```

Prefer **one pass at a time** when handoffs must be validated between steps.

If the session exposes a **`Task` tool** with `subagent_type` matching installed agent names, use **Per-pass procedure (Task)** instead (same as Cursor).

If SOLO mode or custom agents are unavailable, warn the user — do **not** silently fall back to inline analysis unless they confirm fallback mode.

### Per-pass procedure (Codex spawn)

For each enabled pass, **must** explicitly instruct Codex to **spawn** the matching TOML subagent and wait for completion before the next pass:

1. Confirm experts exist: `~/.codex/agents/{agentName}.toml` (installed by `install-codex.ps1` / `generate-codex-agents.mjs`).
2. Read the pass contract (`passes/XX-*.md`).
3. Issue an explicit spawn instruction, for example:

```
Spawn the {agentName} subagent now for CodeCortexLoop pass {N}/7. Wait for it to finish before continuing. Do not inline this pass in the main session.
Use this task prompt verbatim:

{shared delegation prompt from above}
```

Replace `{agentName}` with the pipeline table name (e.g. `code-reviewer` for pass 1).

4. Verify the subagent wrote **both** category markdown and handoff JSON on disk.
5. Use **`/agent`** in Codex CLI to inspect the subagent thread if needed.
6. If handoff missing or invalid, re-spawn that pass once; then fail the run with analysis error (CI exit 3).

**Full sequence (one upfront instruction, optional):**

```
Run CodeCortexLoop Report on scope {files}. Spawn subagents strictly ONE AT A TIME in this order; wait for each to write report + handoff JSON before the next:
code-reviewer → security-auditor → test-engineer → silent-failure-hunter → performance-analyst → code-simplifier → cleanup-curator
Do not run all seven passes inline in this session.
After all passes: node scripts/validate-handoffs.mjs
```

Prefer **one spawn per pass** when validating handoffs between steps.

If TOML agents or spawn API are unavailable, warn the user — fallback to persona switch only if they confirm.

### After all passes

Proceed to **Step 3.5 — Cross-validation (defer recycle)** before aggregation.

## Step 3.5 — Cross-validation (defer recycle)

Orchestrator **supervisor** step: recover backward defers so downstream discoveries are not lost. **Do not** analyze code inline — re-delegate to the **target pass expert** only.

### When this runs

After Step 3 completes for all enabled passes. Also after Direct-mode **re-verify** (full Step 3 + 3.5 on same scope).

Skip dispatch when orphan count is 0. Respect `config.crossValidation.enabled` (default `true`).

### 3.5a — Collect orphan defers

```bash
node scripts/collect-orphan-defers.mjs
```

Writes `.cortexloop/orphan-defers.json`. An **orphan** is a `deferToLaterPasses` entry whose target pass **already ran** (backward defer).

Print to user when orphans > 0:

```
⚡ Cross-validation — {N} backward defer(s) need target expert re-run (orchestrator dispatch, not inline analysis).
```

### 3.5b — Re-delegate by target pass (mandatory when orphans > 0)

Group orphans by `targetPass` (see `byTarget` in manifest). For **each target group**, launch **one** Task / Agent / SOLO / spawn to the **target expert** (same agent as original pass — domain 专权 unchanged).

**Cross-validation delegation prompt:**

```
CodeCortexLoop cross-validation (defer recycle) — targeted re-run for pass {targetOrder}/7.
You are {targetExpert}. Domain category: {targetCategory} ONLY.

Read your pass contract: {targetPassContract}
Scope (read on disk):
- Manifest: .cortexloop/scope-manifest.json
- Paths: .cortexloop/scope-paths.json
- Scope map (if present): .cortexloop/scope-map.json — prioritize hotspots + mustReview + patternHits[{targetCategory}]
Prior handoffs (read from disk): {allHandoffPaths}

Orphan defer items assigned to YOU (from later passes — verify each, do not re-scan whole scope):

{orphanItemsJson}

For EACH orphan item:
1. Investigate the cited context in scope (narrow focus).
2. If valid for YOUR category:
   - Append a scored finding to findings[] in your existing handoff (merge in place).
   - Update your category markdown report with the new finding.
   - Append crossValidation[] entry: status "verified", orphanId, findingLocation and/or findingProblem.
3. If invalid or outside your category:
   - Append crossValidation[] entry: status "rejected", orphanId, rejectReason (required).
   - Do NOT score in another category.

Update IN PLACE (do not replace prior findings):
- Handoff: {targetHandoffFile}
- Report: {targetCategoryReport}

Load skills: cortexloop-expert-core + your domain depth skills. This supplements Step 3; prior findings stay unless amended with evidence.
```

Wait for target expert to finish before the next target group. Re-run failed group once.

### 3.5c — Validate resolutions

```bash
node scripts/validate-cross-validation.mjs
```

Exit code 1 = orphan without matching `crossValidation` entry on target handoff — re-run that target expert group. CI mode: exit 3.

Then continue to Step 4.

### Orchestrator rules (Step 3.5)

- **Never** score orphan items yourself — dispatch only (Supervisor pattern).
- **Never** spawn a new “cross-validator” agent — use existing pipeline experts.
- One target expert may resolve multiple orphans in one invocation.
- Forward defers (pass 1 → security) are not orphans — handled in normal Step 3 order.

---

Collect findings from all handoff JSON files (including cross-validation additions). Apply suppressions when aggregating in Step 4. Category markdown files are written by experts — orchestrator may add cross-links in `00-summary.md` only.

## Step 4 — Aggregate + Score

Prerequisite: Step 3.5c cross-validation passed (`validate-cross-validation.mjs` exit 0) when orphans were collected.

1. **Validate handoffs** (fail-fast before scoring):

```bash
node scripts/validate-handoffs.mjs
```

Exit code 1 = missing or invalid handoff — re-run failed pass (Task, Agent, SOLO/spawn delegation, or fallback persona). In CI mode, exit 3.

2. **Aggregate findings** (machine-checked merge + dedup):

```bash
node scripts/aggregate-findings.mjs --orphans=.cortexloop/orphan-defers.json
```

Reads `.cortexloop/aggregated-findings.json` — a deduplicated, severity-sorted findings array. Dedup uses the **same `findingFingerprint`** as `baseline.mjs`, so aggregation and the baseline ratchet agree on what counts as "the same finding." Each finding carries `evidence` + `confidence` (required by the finding quality gate) and a `provenance` block (`pass`, `expert`, `orphanId` when it came from Step 3.5 recycle, `sources[]` listing other passes/experts that flagged the same fingerprint).

3. Apply `.cortexloopignore` suppressions to the aggregated list, then assign IDs `CL-001`… in the order the script produced (severity-first). Do **not** re-sort after numbering — CL ids must reflect urgency.
4. Compute **health scores** (before)
5. Write `report.json` to **run archive** (`run-meta.reports.reportJson`) and include `"generatedBy": "cortexloop"`, plus `runId`, `runDisplayTime`, `runDir` from run-meta. Every finding in `report.json` must include `evidence` and `confidence` — `ci-gate.mjs`/`validateReport` reject reports whose findings lack evidence.

## Step 5 — Output

### Report / CI

Write markdown reports under **current runDir** (`run-meta.reports.*`) + `report.json` in runDir. Include health scores in run's `00-summary.md`.

### Step 5b — Post-Processing (always after report.json exists in runDir)

Run from project root:

```bash
node scripts/sync-run-latest.mjs
node scripts/record-history.mjs docs/cortexloop/report.json
node scripts/make-badge.mjs docs/cortexloop/report.json
node scripts/make-dashboard.mjs docs/cortexloop/report.json
node scripts/pr-comment.mjs docs/cortexloop/report.json
node scripts/run-summary.mjs --out=docs/cortexloop/run-summary.md
```

`sync-run-latest` copies this run → `docs/cortexloop/` for CI, badge, and dashboard.

If baseline enabled: `node scripts/baseline.mjs diff` before CI gate.

**CI:** run gate (with `--baseline` if config `ci.baseline: true`):

```bash
node scripts/ci-gate.mjs docs/cortexloop/report.json
# or with baseline ratchet:
node scripts/baseline.mjs diff docs/cortexloop/report.json
node scripts/ci-gate.mjs docs/cortexloop/report.json --baseline
```

**Report (non-CI):** STOP. Ask user what to apply.

### Direct

Apply per workflow apply-order. After all groups:

1. **Re-verify**: re-run **Step 3 + Step 3.5** sequential expert pipeline (read-only) on same scope — mandatory delegation per pass (Task, Agent, or SOLO), not orchestrator inline analysis
2. Write updated `report.json`
3. Re-run post-processing (history, badge, dashboard)
4. Output final summary with before→after scores

## Step 6 — Reflect (Direct only, if `learning.enabled`)

After successful re-verification:

1. Load `skills/reflect/SKILL.md`
2. Write `.cortexloop/reflection.json` (3–5 generalizable patterns max)
3. **Append** to `docs/cortexloop/08-reflection.md` (single incremental evolution log — do **not** replace prior sections). Use human **运行时间** from run-meta as section title:

```bash
node scripts/append-reflection.mjs --file=.cortexloop/reflection-section.md
```

Or append manually:

```markdown
---
## 运行记录 · 2026年6月25日 14:30
> Run: `docs/cortexloop/runs/...` · mode: direct
```

4. Record to playbook:

```bash
node scripts/playbook.mjs record .cortexloop/reflection.json
# `record` reads config learning.global and also-records to the global playbook
# when true — no need to pass --global manually. CLI --global still overrides.
# re-export Chinese markdown only: node scripts/playbook.mjs export-zh
```

Reflection entries must include **English** (`problemPattern`, `fixMethod`) for model recall and **Chinese** (`problemPatternZh`, `fixMethodZh`) for the human zh export.

5. **Optional feedback hooks** (external oracle + negative signals):

```bash
# Fix applied then tests failed / reverted
node scripts/playbook.mjs feedback --signature=<sig> --outcome=failed

# Playbook suggestion judged inapplicable
node scripts/playbook.mjs feedback --signature=<sig> --outcome=rejected

# CI passed / PR merged / human confirmed the fix pattern
node scripts/playbook.mjs feedback --signature=<sig> --outcome=external_verified --evidence="ci: <run>"
```

### Orchestrator completion checklist

Before Step 4, confirm handoff files exist for each enabled pass:

- `.cortexloop/handoff/01-correctness.json` … through enabled steps (see `passes/README.md`)
- If Step 3.5 ran: `.cortexloop/orphan-defers.json` and all orphans resolved (`validate-cross-validation.mjs` exit 0)

List handoff paths and cross-validation count in the final summary.

Promotion to **verified** tier requires diverse evidence (`verifiedCount >= 2`, `distinctContexts >= 2`, `confidence >= 0.7`). External signals (`external_verified`) outweigh self-report.

## Rules

- **Sequential expert analysis**, serial Direct apply
- Orchestrator never performs pass analysis inline — delegated experts only (Task / Agent / SOLO / Codex spawn)
- Never skip health scores
- Re-verify required in Direct mode
- Respect `.cortexloopignore` and inline suppressions
- ci-gate exit codes are authoritative in CI mode
- Direct mode: reflect after successful re-verify; playbook hits are recall — re-derive and verify, never paste
- Record negative signals (`failed` / `rejected`) when a suggested fix fails or does not apply
- Do not auto-apply **candidate** tier entries; verified-only by default in query
- External oracle signals (`external_verified`) take priority over self-reported success
