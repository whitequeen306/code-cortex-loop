# Qoder Adapter

Qoder does **not** use a `plugin.json` manifest. It loads assets from fixed directories.

## Install (user-level, all projects)

**Windows (PowerShell):**
```powershell
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd cortexloop
.\scripts\install-qoder.ps1
```

**macOS / Linux:**
```bash
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd cortexloop
./scripts/install.sh qoder
```

## Target paths

| Asset | Path |
|-------|------|
| Commands | `~/.qoder/commands/` |
| Skills | `~/.qoder/skills/{name}/SKILL.md` |
| Agents | `~/.qoder/agents/` |
| Rules | `~/.qoder/rules/` |
| Passes | `~/.qoder/passes/` |
| Scripts | `~/.qoder/scripts/` |

## Project-level (team sharing)

Copy into your repo:
```
.qoder/commands/
.qoder/skills/
.qoder/agents/
.qoder/rules/
```

Also copy `AGENTS.md` to project root — Qoder reads it alongside rules.

## Runtime usage (native subagent mode)

CodeCortexLoop on Qoder uses **native subagent delegation** (not single-session fallback):

1. **Restart Qoder** after install so `~/.qoder/agents/` and commands load.
2. **Main chat must have the `Agent` tool available** — subagent delegation goes through Qoder's built-in `Agent` tool. If Agent is disallowed in your session, enable it or run experts manually via slash commands (below).
3. Run `/cortexloop` in **Agent mode** chat. The orchestrator will delegate **one expert per pass** in fixed order via blocking `Agent` calls:
   - `code-reviewer` → `security-auditor` → `test-engineer` → `silent-failure-hunter` → `performance-analyst` → `code-simplifier` → `cleanup-curator`
4. Each expert runs in **isolated context** and must write:
   - Category report under `docs/cortexloop/`
   - Handoff JSON under `.cortexloop/handoff/`
5. Orchestrator validates with `node scripts/validate-handoffs.mjs` before scoring.

### Manual expert trigger (if Agent tool unavailable)

Invoke in pass order with the same deliverables (report + handoff JSON):

```
/code-reviewer
/security-auditor
/test-engineer
/silent-failure-hunter
/performance-analyst
/code-simplifier
/cleanup-curator
```

Paste scope and prior handoff paths into each invocation — subagents do not inherit the main session history.

### SDK / headless (optional)

For programmatic runs, register experts in `options.agents` and set `allowedTools: ['Agent']`. See [Qoder SDK — Subagents](https://docs.qoder.com/en/cli/sdk/agents).

## Verify

1. Restart Qoder IDE
2. Type `/` in chat — you should see `/cortexloop`, `/cortexloop-quick`, etc.
3. Type `/agents` or check `~/.qoder/agents/` — seven experts (`code-reviewer.md`, …) should be present
4. Bootstrap should print `✅ Qoder native subagent mode` (not the single-session fallback warning)
