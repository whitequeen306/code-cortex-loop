#!/usr/bin/env bash
set -euo pipefail

TOOL="${1:-all}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

install_cursor() {
  local target="${HOME}/.cursor"
  echo "[supercode] Installing to Cursor: $target"
  mkdir -p "$target"/{commands,agents,skills,rules}
  cp -r "$ROOT/commands/"* "$target/commands/" 2>/dev/null || true
  cp -r "$ROOT/agents/"* "$target/agents/" 2>/dev/null || true
  cp -r "$ROOT/skills/"* "$target/skills/" 2>/dev/null || true
  cp -r "$ROOT/rules/"* "$target/rules/" 2>/dev/null || true
}

install_claude() {
  local target="${HOME}/.claude"
  echo "[supercode] Installing to Claude Code: $target"
  mkdir -p "$target"/{commands,agents,skills}
  cp -r "$ROOT/commands/"* "$target/commands/" 2>/dev/null || true
  cp -r "$ROOT/agents/"* "$target/agents/" 2>/dev/null || true
  cp -r "$ROOT/skills/"* "$target/skills/" 2>/dev/null || true
  cp "$ROOT/AGENTS.md" "$target/AGENTS.supercode.md"
}

install_qoder() {
  local target="${HOME}/.qoder"
  echo "[supercode] Installing to Qoder: $target"
  mkdir -p "$target"/{commands,agents,skills,rules}
  cp -r "$ROOT/commands/"* "$target/commands/" 2>/dev/null || true
  cp -r "$ROOT/agents/"* "$target/agents/" 2>/dev/null || true
  cp -r "$ROOT/skills/"* "$target/skills/" 2>/dev/null || true
  cp -r "$ROOT/rules/"* "$target/rules/" 2>/dev/null || true
  cp "$ROOT/AGENTS.md" "$target/AGENTS.supercode.md"
}

install_trae() {
  local target="${HOME}/.trae"
  echo "[supercode] Installing to Trae (user): $target"
  mkdir -p "$target"/{commands,agents,skills,rules}
  cp -r "$ROOT/commands/"* "$target/commands/" 2>/dev/null || true
  cp -r "$ROOT/agents/"* "$target/agents/" 2>/dev/null || true
  cp -r "$ROOT/skills/"* "$target/skills/" 2>/dev/null || true
  cp -r "$ROOT/rules/"* "$target/rules/" 2>/dev/null || true
  cp "$ROOT/AGENTS.md" "$target/AGENTS.supercode.md"
}

case "$TOOL" in
  cursor) install_cursor ;;
  claude) install_claude ;;
  qoder)  install_qoder ;;
  trae)   install_trae ;;
  all)
    install_cursor
    install_claude
    install_qoder
    install_trae
    ;;
  *)
    echo "Usage: $0 [cursor|claude|qoder|trae|all]"
    exit 1
    ;;
esac

echo "[supercode] Done."
