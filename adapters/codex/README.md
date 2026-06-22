# Codex Adapter

Codex does not currently use CodeCortexLoop as a native `/cortexloop` slash command in the same way Cursor or OpenCode do. Codex custom prompts exist under `~/.codex/prompts/`, but they are deprecated in favor of skills and `AGENTS.md`.

This adapter installs:

- CodeCortexLoop skills to `~/.codex/skills/`
- helper scripts to `~/.codex/scripts/`
- legacy prompt shortcuts to `~/.codex/prompts/`
- `AGENTS.cortexloop.md` as reference instructions to merge into your Codex `AGENTS.md`

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

## Target paths

| Asset | Path |
|-------|------|
| Skills | `$CODEX_HOME/skills/` or `~/.codex/skills/` |
| Scripts | `$CODEX_HOME/scripts/` or `~/.codex/scripts/` |
| Legacy prompts | `$CODEX_HOME/prompts/` or `~/.codex/prompts/` |
| Reference rules | `$CODEX_HOME/AGENTS.cortexloop.md` |

## Usage

Recommended:

1. Ensure Codex skills are enabled in `$CODEX_HOME/config.toml`:

   ```toml
   [features]
   skills = true
   ```

2. Restart Codex.
3. Ask: `Use CodeCortexLoop to review this project`.
4. Or open `/skills` and choose the relevant CodeCortexLoop skill.

Optional legacy prompt shortcut:

```text
/prompts:cortexloop
```

Codex may show this under `prompts:` rather than as a top-level `/cortexloop` command.

## AGENTS.md

Codex reads `AGENTS.md` files automatically. The installer does not overwrite your existing `AGENTS.md`; it writes `AGENTS.cortexloop.md` so you can merge the rules you want into your user or project `AGENTS.md`.
