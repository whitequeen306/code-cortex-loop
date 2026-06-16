param(
  [string]$Target = "$env:USERPROFILE\.claude"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$map = @{
  "commands" = Join-Path $Target "commands"
  "agents"   = Join-Path $Target "agents"
  "skills"   = Join-Path $Target "skills"
}

Write-Host "[supercode] Installing to Claude Code: $Target"

foreach ($key in $map.Keys) {
  $src = Join-Path $Root $key
  $dst = $map[$key]
  if (-not (Test-Path $src)) { continue }
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
  Write-Host "  copied $key -> $dst"
}

# AGENTS.md goes to user home as reference (Claude reads project AGENTS.md too)
Copy-Item (Join-Path $Root "AGENTS.md") (Join-Path $Target "AGENTS.supercode.md") -Force
Write-Host "  copied AGENTS.md -> $Target\AGENTS.supercode.md (merge into your AGENTS.md as needed)"

Write-Host "[supercode] Claude Code install complete."
Write-Host "  Or use plugin: claude plugin install ./supercode"
