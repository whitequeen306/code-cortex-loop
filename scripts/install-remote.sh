#!/usr/bin/env bash
# One-line install for CodeCortexLoop (no clone required)
# Usage: curl -fsSL https://raw.githubusercontent.com/whitequeen306/code-cortex-loop/main/scripts/install-remote.sh | bash -s cursor
set -euo pipefail

TOOL="${1:-cursor}"
REPO="https://github.com/whitequeen306/code-cortex-loop.git"
TMP="${TMPDIR:-/tmp}/cortexloop-install-$$"

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "[cortexloop] Cloning to temp dir..."
git clone --depth 1 "$REPO" "$TMP"

echo "[cortexloop] Installing for tool: $TOOL"
chmod +x "$TMP/scripts/install.sh"
"$TMP/scripts/install.sh" "$TOOL"

echo "[cortexloop] Done. Restart your AI tool and run /cortexloop"
