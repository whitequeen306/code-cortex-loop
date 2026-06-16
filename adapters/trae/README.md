# Trae Adapter

Trae does **not** use a `plugin.json` manifest. It loads from `.trae/` (international) or `.trae-cn/` (China edition).

## Install (user-level)

**Windows:**
```powershell
git clone https://github.com/whitequeen306/supercode.git
cd supercode
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

For Trae CN edition, replace `.trae` with `.trae-cn`.

## Verify

1. Restart Trae IDE
2. Type `/supercode` in agent chat
3. Rules in `.trae/rules/` are auto-loaded
