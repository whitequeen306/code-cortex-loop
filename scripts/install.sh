#!/usr/bin/env bash

set -euo pipefail



TOOL="${1:-all}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"



copy_tree() {

  local src="$1"

  local dst="$2"

  local label="$3"

  if [ ! -d "$src" ]; then

    echo "[cortexloop] ERROR: missing source directory: $src ($label)" >&2

    exit 1

  fi

  shopt -s nullglob

  local files=("$src"/*)

  shopt -u nullglob

  if [ ${#files[@]} -eq 0 ]; then

    echo "[cortexloop] ERROR: empty source directory: $src ($label)" >&2

    exit 1

  fi

  cp -r "${files[@]}" "$dst/"

}



install_cursor() {

  local target="${HOME}/.cursor"

  echo "[cortexloop] Installing to Cursor: $target"

  mkdir -p "$target"/{commands,agents,skills,rules,scripts}

  copy_tree "$ROOT/commands" "$target/commands" "commands"

  copy_tree "$ROOT/agents" "$target/agents" "agents"

  copy_tree "$ROOT/skills" "$target/skills" "skills"

  copy_tree "$ROOT/rules" "$target/rules" "rules"

  copy_tree "$ROOT/scripts" "$target/scripts" "scripts"

}



install_claude() {

  local target="${HOME}/.claude"

  echo "[cortexloop] Installing to Claude Code: $target"

  mkdir -p "$target"/{commands,agents,skills,scripts}

  copy_tree "$ROOT/commands" "$target/commands" "commands"

  copy_tree "$ROOT/agents" "$target/agents" "agents"

  copy_tree "$ROOT/skills" "$target/skills" "skills"

  copy_tree "$ROOT/scripts" "$target/scripts" "scripts"

  cp "$ROOT/AGENTS.md" "$target/AGENTS.cortexloop.md"

}



install_qoder() {

  local target="${HOME}/.qoder"

  echo "[cortexloop] Installing to Qoder: $target"

  mkdir -p "$target"/{commands,agents,skills,rules,scripts}

  copy_tree "$ROOT/commands" "$target/commands" "commands"

  copy_tree "$ROOT/agents" "$target/agents" "agents"

  copy_tree "$ROOT/skills" "$target/skills" "skills"

  copy_tree "$ROOT/rules" "$target/rules" "rules"

  copy_tree "$ROOT/scripts" "$target/scripts" "scripts"

  cp "$ROOT/AGENTS.md" "$target/AGENTS.cortexloop.md"

}



install_trae() {

  local target="${HOME}/.trae"

  echo "[cortexloop] Installing to Trae (user): $target"

  mkdir -p "$target"/{commands,agents,skills,rules,scripts}

  copy_tree "$ROOT/commands" "$target/commands" "commands"

  copy_tree "$ROOT/agents" "$target/agents" "agents"

  copy_tree "$ROOT/skills" "$target/skills" "skills"

  copy_tree "$ROOT/rules" "$target/rules" "rules"

  copy_tree "$ROOT/scripts" "$target/scripts" "scripts"

  cp "$ROOT/AGENTS.md" "$target/AGENTS.cortexloop.md"

}



install_opencode() {

  local target="${HOME}/.config/opencode"

  echo "[cortexloop] Installing to OpenCode: $target"

  mkdir -p "$target"/{commands,agents,skills,rules,scripts}

  copy_tree "$ROOT/commands" "$target/commands" "commands"

  copy_tree "$ROOT/agents" "$target/agents" "agents"

  copy_tree "$ROOT/skills" "$target/skills" "skills"

  copy_tree "$ROOT/rules" "$target/rules" "rules"

  copy_tree "$ROOT/scripts" "$target/scripts" "scripts"

  cp "$ROOT/AGENTS.md" "$target/AGENTS.cortexloop.md"

  echo "  Restart OpenCode, then type /cortexloop in the TUI."

}



install_codex() {

  local target="${CODEX_HOME:-${HOME}/.codex}"

  echo "[cortexloop] Installing to Codex: $target"

  mkdir -p "$target"/{skills,scripts,prompts}

  copy_tree "$ROOT/skills" "$target/skills" "skills"

  copy_tree "$ROOT/scripts" "$target/scripts" "scripts"

  cp "$ROOT"/commands/*.md "$target/prompts/"

  cp "$ROOT/AGENTS.md" "$target/AGENTS.cortexloop.md"

  local config="$target/config.toml"
  if [ ! -f "$config" ]; then
    cat > "$config" <<'EOF'
[features]
skills = true
EOF
    echo "  created $config with skills enabled"
  else
    echo "  note: ensure $config contains [features] skills = true"
  fi

  echo "  Restart Codex. Use /skills or ask: Use CodeCortexLoop to review this project."
  echo "  Optional deprecated prompt shortcut: /prompts:cortexloop"

}



case "$TOOL" in

  cursor) install_cursor ;;

  claude) install_claude ;;

  qoder)  install_qoder ;;

  trae)   install_trae ;;

  opencode) install_opencode ;;

  codex) install_codex ;;

  all)

    install_cursor

    install_claude

    install_qoder

    install_trae

    install_opencode

    install_codex

    ;;

  *)

    echo "Usage: $0 [cursor|claude|qoder|trae|opencode|codex|all]"

    exit 1

    ;;

esac



echo "[cortexloop] Done."

