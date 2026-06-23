# One-line install for CodeCortexLoop (no clone required)
# Usage: irm .../install-remote.ps1 | iex; Install-CodeCortexLoop -Tool cursor

function Install-CodeCortexLoop {
    param(
        [ValidateSet('cursor', 'claude', 'qoder', 'trae', 'opencode', 'codex', 'all')]
        [string]$Tool = 'cursor'
    )

    $tmp = Join-Path $env:TEMP "cortexloop-install-$(Get-Random)"
    $repo = "https://github.com/whitequeen306/code-cortex-loop.git"

    Write-Host "[cortexloop] Cloning to $tmp..."
    git clone --depth 1 $repo $tmp
    if ($LASTEXITCODE -ne 0) { throw "git clone failed" }

    Write-Host "[cortexloop] Installing for tool: $Tool"
    & (Join-Path $tmp "scripts\install.ps1") -Tool $Tool

    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    Write-Host "[cortexloop] Done. Restart your AI tool and run /cortexloop"
}

if ($MyInvocation.InvocationName -ne '.') {
    Install-CodeCortexLoop @args
}
