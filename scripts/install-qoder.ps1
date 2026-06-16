param(
  [string]$Target = "$env:USERPROFILE\.qoder"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$map = @{
  "commands" = Join-Path $Target "commands"
  "agents"   = Join-Path $Target "agents"
  "skills"   = Join-Path $Target "skills"
  "rules"    = Join-Path $Target "rules"
  "scripts"  = Join-Path $Target "scripts"
}

Write-Host "[cortexloop] Installing to Qoder: $Target"

foreach ($key in $map.Keys) {
  $src = Join-Path $Root $key
  $dst = $map[$key]
  if (-not (Test-Path $src)) { continue }
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
  Write-Host "  copied $key -> $dst"
}

Copy-Item (Join-Path $Root "AGENTS.md") (Join-Path $Target "AGENTS.cortexloop.md") -Force
Write-Host "[cortexloop] Qoder install complete. Restart Qoder, type /cortexloop"
