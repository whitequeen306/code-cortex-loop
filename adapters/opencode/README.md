# OpenCode Adapter

OpenCode supports custom commands, agents, and skills from user-level or project-level config directories.

## Install (user-level)

**Windows (PowerShell):**

```powershell
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
.\scripts\install.ps1 -Tool opencode
```

**macOS / Linux:**

```bash
git clone https://github.com/whitequeen306/code-cortex-loop.git
cd code-cortex-loop
chmod +x scripts/install.sh
./scripts/install.sh opencode
```

## Target paths

| Asset | Path |
|-------|------|
| Commands | `~/.config/opencode/commands/` |
| Agents | `~/.config/opencode/agents/` |
| Skills | `~/.config/opencode/skills/{name}/SKILL.md` |
| Rules | `~/.config/opencode/rules/` |
| Scripts | `~/.config/opencode/scripts/` |

## Usage

1. Restart OpenCode.
2. Type `/` in the TUI.
3. Run `/cortexloop`, `/cortexloop-quick`, `/cortexloop-deep`, or another installed command.

## Project-level install

For team-shared OpenCode config, copy the same folders into your repository:

```text
.opencode/commands/
.opencode/agents/
.opencode/skills/
.opencode/rules/
```

Keep `scripts/` available in the repository root or adapt command prompts to point at the installed script path.
