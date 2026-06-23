# OpenCode Adapter

OpenCode supports custom commands, agents, and skills from user-level or project-level config directories. **CodeCortexLoop uses the same Task-based pipeline as Cursor** — primary agent delegates to 7 subagents via the Task tool.

## Install (user-level)

**Windows (PowerShell):**

```powershell
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
.\scripts\install-opencode.ps1
```

**macOS / Linux:**

```bash
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
./scripts/install.sh opencode
```

Install copies commands, agents, skills, rules, and runs `patch-opencode-agents.mjs` to add `mode: subagent` to each expert.

## Target paths

| Asset | Path |
|-------|------|
| Commands | `~/.config/opencode/commands/` |
| Agents | `~/.config/opencode/agents/` |
| Skills | `~/.config/opencode/skills/{name}/SKILL.md` |
| Rules | `~/.config/opencode/rules/` |
| Scripts | `~/.config/opencode/scripts/` |
| Task permission example | `~/.config/opencode/opencode.cortexloop.example.json` |

## Runtime usage (Task subagent mode)

1. **Restart OpenCode** after install.
2. **Merge Task permissions** into your `opencode.json` (global or project). Example shipped at `opencode.cortexloop.example.json`:

```json
{
  "agent": {
    "build": {
      "permission": {
        "task": {
          "*": "deny",
          "code-reviewer": "allow",
          "security-auditor": "allow",
          "test-engineer": "allow",
          "silent-failure-hunter": "allow",
          "performance-analyst": "allow",
          "code-simplifier": "allow",
          "cleanup-curator": "allow"
        }
      }
    }
  }
}
```

3. Use primary agent **Build** (or a custom orchestrator) in the TUI.
4. Run `/cortexloop`. Bootstrap should indicate **OpenCode Task subagent mode**.
5. Orchestrator launches **Task** once per pass in order; each subagent writes report + handoff JSON.

### Manual fallback (`@mention`)

If Task permissions block programmatic delegation, invoke in pass order:

```text
@code-reviewer
@security-auditor
@test-engineer
@silent-failure-hunter
@performance-analyst
@code-simplifier
@cleanup-curator
```

Paste the pass delegation prompt (scope, prior handoffs, deliverables) into each message.

## Project-level install

```text
.opencode/commands/
.opencode/agents/
.opencode/skills/
.opencode/rules/
```

Re-run `node scripts/patch-opencode-agents.mjs .opencode/agents` after copying agents.

## Verify

1. `~/.config/opencode/agents/code-reviewer.md` exists and contains `mode: subagent`
2. `opencode.json` allows Build to Task the 7 expert names
3. `/cortexloop` runs without single-session fallback warning when subagents are configured (Task on OpenCode; spawn on Codex; SOLO on Trae)

## vs Cursor

| | Cursor | OpenCode |
|--|--------|----------|
| Tool | `Task` | `Task` |
| Expert config | subagent types / agents | `~/.config/opencode/agents/*.md` + `mode: subagent` |
| Extra setup | minimal | **`permission.task`** in `opencode.json` |
| Manual | — | `@agent-name` |

Same orchestrator Step 3 (Task procedure); only bootstrap prerequisites differ.
