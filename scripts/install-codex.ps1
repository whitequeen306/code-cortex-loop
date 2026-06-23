param(
  [string]$Target = $(if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE ".codex" })
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

$ExpectedTarget = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE ".codex" }
$ResolvedTarget = [IO.Path]::GetFullPath($Target)
$AllowedTarget = [IO.Path]::GetFullPath($ExpectedTarget)
if ($ResolvedTarget -ne $AllowedTarget) {
  throw "[cortexloop] Refusing install: Target must be $AllowedTarget (got $ResolvedTarget)"
}

Write-Host "[cortexloop] Installing to Codex: $Target"

$map = @{
  "skills"  = Join-Path $Target "skills"
  "scripts" = Join-Path $Target "scripts"
  "passes"  = Join-Path $Target "passes"
}

foreach ($key in $map.Keys) {
  $src = Join-Path $Root $key
  $dst = $map[$key]
  if (-not (Test-Path $src)) { continue }
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
  Write-Host "  copied $key -> $dst"
}

$prompts = Join-Path $Target "prompts"
New-Item -ItemType Directory -Path $prompts -Force | Out-Null
Copy-Item -Path (Join-Path $Root "commands\*.md") -Destination $prompts -Force
Write-Host "  copied commands -> $prompts (deprecated Codex prompts; invoke as /prompts:cortexloop)"

Copy-Item (Join-Path $Root "AGENTS.md") (Join-Path $Target "AGENTS.cortexloop.md") -Force
Write-Host "  copied AGENTS.md -> $Target\AGENTS.cortexloop.md"

$config = Join-Path $Target "config.toml"
if (-not (Test-Path $config)) {
  @"
[features]
skills = true
"@ | Set-Content -Path $config -Encoding utf8
  Write-Host "  created $config with skills enabled"
} else {
  Write-Host "  note: ensure $config contains [features] skills = true"
}

Write-Host "[cortexloop] Codex install complete."
Write-Host "  Restart Codex. Use /skills or ask: Use CodeCortexLoop to review this project."
Write-Host "  Optional deprecated prompt shortcut: /prompts:cortexloop"
