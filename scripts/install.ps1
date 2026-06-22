param(
  [ValidateSet("cursor", "claude", "qoder", "trae", "opencode", "codex", "all")]
  [string]$Tool = "all"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

switch ($Tool) {
  "cursor" { & "$ScriptDir\install-cursor.ps1" }
  "claude" { & "$ScriptDir\install-claude.ps1" }
  "qoder"  { & "$ScriptDir\install-qoder.ps1" }
  "trae"   { & "$ScriptDir\install-trae.ps1" }
  "opencode" { & "$ScriptDir\install-opencode.ps1" }
  "codex" { & "$ScriptDir\install-codex.ps1" }
  "all" {
    & "$ScriptDir\install-cursor.ps1"
    & "$ScriptDir\install-claude.ps1"
    & "$ScriptDir\install-qoder.ps1"
    & "$ScriptDir\install-trae.ps1"
    & "$ScriptDir\install-opencode.ps1"
    & "$ScriptDir\install-codex.ps1"
  }
}
