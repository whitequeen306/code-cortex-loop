# Codex Adapter

Codex does not expose a native `/cortexloop` slash command like Cursor or OpenCode. Codex custom prompts live under `~/.codex/prompts/` but are **deprecated** in favor of skills, `AGENTS.md`, and **custom subagents** (`~/.codex/agents/*.toml`).

CodeCortexLoop on Codex uses **partial subagent mode**: the orchestrator must **explicitly instruct Codex to spawn** one TOML subagent per pass, in order, and wait for deliverables before the next spawn. Codex does **not** auto-spawn subagents.

## Install

**Windows (PowerShell):**

```powershell
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
.\scripts\install.ps1 -Tool codex
```

**macOS / Linux:**

```bash
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
chmod +x scripts/install.sh
./scripts/install.sh codex
```

If `CODEX_HOME` is set, the installer uses that directory. Otherwise it uses `~/.codex`.

## What gets installed

| Asset | Path |
|-------|------|
| Skills | `$CODEX_HOME/skills/` or `~/.codex/skills/` |
| Scripts | `$CODEX_HOME/scripts/` or `~/.codex/scripts/` |
| **TOML subagents** | `$CODEX_HOME/agents/*.toml` (from `agents/*.md` via `generate-codex-agents.mjs`) |
| Example config | `$CODEX_HOME/codex.cortexloop.example.toml` |
| Legacy prompts | `$CODEX_HOME/prompts/` (invoke as `/prompts:cortexloop`) |
| Reference rules | `$CODEX_HOME/AGENTS.cortexloop.md` |

## Post-install setup

1. Merge `[features]` and `[agents]` from `codex.cortexloop.example.toml` into `$CODEX_HOME/config.toml`:

   ```toml
   [features]
   skills = true

   [agents]
   max_threads = 6
   max_depth = 1
   ```

2. Merge `AGENTS.cortexloop.md` into your user or project `AGENTS.md`.
3. Restart Codex.
4. Confirm seven experts exist: `~/.codex/agents/code-reviewer.toml`, … `cleanup-curator.toml`.

## Usage (partial spawn mode)

Ask Codex with **explicit sequential spawn** language, for example:

```text
Run CodeCortexLoop Report on this project. Spawn subagents strictly ONE AT A TIME in pass order; wait for each to write report + handoff JSON before the next:
code-reviewer → security-auditor → test-engineer → silent-failure-hunter → performance-analyst → code-simplifier → cleanup-curator
After all passes: node scripts/validate-handoffs.mjs
```

Bootstrap should print `✅ Codex partial subagent mode` (not the single-session fallback warning).

Inspect subagent threads in the Codex CLI with `/agent`.

Optional legacy prompt shortcut:

```text
/prompts:cortexloop
```

## Constraints

- **No auto-spawn** — every run must say "spawn subagents" and name the pass order.
- **One expert at a time** — do not fan out all seven passes in parallel or inline in the main session when TOML agents are configured.
- **`max_depth = 1`** — subagents must not spawn nested subagents.
- Subagent names must match the pipeline table (`code-reviewer`, `security-auditor`, …).

## Fallback

If TOML agents are missing or spawn is unavailable, Codex falls back to **single-session persona switch** only when the user confirms. For full 7-expert isolation, prefer Cursor, Claude Code, OpenCode (Task), Qoder (Agent), or Trae (SOLO).

## AGENTS.md

The installer does not overwrite your existing `AGENTS.md`; it writes `AGENTS.cortexloop.md` so you can merge the rules you want.
