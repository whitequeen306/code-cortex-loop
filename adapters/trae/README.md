# Trae Adapter

Trae does **not** use a `plugin.json` manifest. It loads from `.trae/` (international) or `.trae-cn/` (China edition).

## Install (user-level)

**Windows:**
```powershell
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd cortexloop
.\scripts\install-trae.ps1
```

**Project-level:**
```powershell
.\scripts\install-trae.ps1 -Scope project -ProjectPath C:\path\to\your\project
```

**macOS / Linux:**
```bash
./scripts/install.sh trae
```

## Target paths

| Asset | User scope | Project scope |
|-------|------------|---------------|
| Commands | `~/.trae/commands/` | `.trae/commands/` |
| Skills | `~/.trae/skills/` | `.trae/skills/` |
| Agents | `~/.trae/agents/` | `.trae/agents/` |
| Rules | `~/.trae/rules/` | `.trae/rules/` |
| Passes | `~/.trae/passes/` | `.trae/passes/` |
| Scripts | `~/.trae/scripts/` | `.trae/scripts/` |

For Trae CN edition, replace `.trae` with `.trae-cn`.

## Runtime usage (SOLO mode — partial subagent)

CodeCortexLoop on Trae uses **SOLO mode + custom agents** for isolated 7-expert runs (not regular IDE chat fallback):

1. **Install** experts: `.\scripts\install-trae.ps1`, then **restart Trae**.
2. **Switch to SOLO mode** (top-left mode toggle in Trae).
3. **Configure SOLO Coder** to call the 7 custom agents installed under `~/.trae/agents/`:
   - `code-reviewer`, `security-auditor`, `test-engineer`, `silent-failure-hunter`, `performance-analyst`, `code-simplifier`, `cleanup-curator`
4. Run `/cortexloop` in SOLO. Bootstrap should print `✅ Trae partial subagent mode`.
5. SOLO Coder delegates **one agent per pass** in order; each writes:
   - Category report under `docs/cortexloop/`
   - Handoff JSON under `.cortexloop/handoff/`
6. Orchestrator runs `node scripts/validate-handoffs.mjs` before scoring.

### Explicit delegation prompt (per pass)

Tell SOLO Coder:

```
Delegate to the code-reviewer custom agent. Pass this task prompt:
You are CodeCortexLoop pass 1/7 …
(read passes/01-correctness.md, write docs/cortexloop/01-correctness.md and .cortexloop/handoff/01-correctness.json)
```

Repeat for each pass in pipeline order. Include **scope file list** and **prior handoff paths** in every delegation — subagents do not inherit SOLO Coder's full history.

### Chained invocation (optional)

```
Run CodeCortexLoop in order: delegate to code-reviewer, then security-auditor, … cleanup-curator.
Each must write its pass contract report + handoff JSON before the next starts.
```

Prefer one pass at a time when validating handoffs between steps.

### Regular IDE chat (non-SOLO)

Without SOLO mode, Trae falls back to **single-session** persona switching — no guaranteed subagent isolation. Switch to SOLO for the full pipeline experience.

### Task tool (optional)

Some Trae builds expose a `Task` tool with `subagent_type` matching custom agent names. If present, `/cortexloop` may use the same flow as Cursor (see `commands/cortexloop.md` → Per-pass procedure Task).

## Verify

1. Restart Trae IDE
2. Switch to **SOLO mode**
3. Type `/cortexloop` — bootstrap shows Trae partial mode (not single-session fallback)
4. Confirm `~/.trae/agents/code-reviewer.md` (and six others) exist

## ZCode (not Trae)

**ZCode** (智谱 Z.ai ADE) is a **separate product** from Trae. It has its own ZCode Agent and subagents — not covered by this adapter. Use Cursor, Claude Code, Qoder, or Trae SOLO for CodeCortexLoop today.
