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

$agentsSrc = Join-Path $Root "agents"
$agentsDst = Join-Path $Target "agents"
if (Test-Path $agentsSrc) {
  node (Join-Path $Root "scripts\generate-codex-agents.mjs") $agentsSrc $agentsDst
  if ($LASTEXITCODE -ne 0) { throw "[cortexloop] generate-codex-agents.mjs failed" }
}

$exampleToml = Join-Path $Root "adapters\codex\codex.cortexloop.example.toml"
if (Test-Path $exampleToml) {
  Copy-Item $exampleToml (Join-Path $Target "codex.cortexloop.example.toml") -Force
  Write-Host "  copied codex.cortexloop.example.toml -> $Target"
}

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
Write-Host "  Merge $Target\codex.cortexloop.example.toml into config.toml ([agents] max_depth = 1)."
Write-Host "  Merge AGENTS.cortexloop.md into project AGENTS.md."
Write-Host "  Restart Codex. Ask: Run CodeCortexLoop Report — spawn subagents one at a time in pass order."
Write-Host "  Optional deprecated prompt shortcut: /prompts:cortexloop"
