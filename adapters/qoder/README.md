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
| Agents | `~/.qoder/agents/` (if supported) |
| Rules | `~/.qoder/rules/` |

## Project-level (team sharing)

Copy into your repo:
```
.qoder/commands/
.qoder/skills/
.qoder/rules/
```

Also copy `AGENTS.md` to project root — Qoder reads it alongside rules.

## Verify

1. Restart Qoder IDE
2. Type `/` in chat — you should see `/cortexloop`, `/cortexloop-quick`, etc.
