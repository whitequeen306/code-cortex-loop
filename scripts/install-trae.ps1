param(
  [ValidateSet("user", "project")]
  [string]$Scope = "user",
  [string]$ProjectPath = (Get-Location).Path
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if ($Scope -eq "user") {
  $Target = Join-Path $env:USERPROFILE ".trae"
} else {
  $Target = Join-Path $ProjectPath ".trae"
}

Write-Host "[cortexloop] Installing to Trae ($Scope scope): $Target"

$map = @("commands", "agents", "skills", "rules", "scripts")
foreach ($key in $map) {
  $src = Join-Path $Root $key
  $dst = Join-Path $Target $key
  if (-not (Test-Path $src)) { continue }
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
  Write-Host "  copied $key -> $dst"
}

Copy-Item (Join-Path $Root "AGENTS.md") (Join-Path $Target "AGENTS.cortexloop.md") -Force
Write-Host "[cortexloop] Trae install complete."
Write-Host "  CN edition: copy to .trae-cn instead if needed."
