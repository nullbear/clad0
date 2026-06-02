#Requires -Version 5.0
<#
.SYNOPSIS
    Starts the clad0 Field Journal of the Throat server.

.DESCRIPTION
    Checks for Node.js, starts server.js, and opens the viewer in your
    default browser. Run by right-clicking and choosing
    "Run with PowerShell", or double-clicking if .ps1 files are associated.

.NOTES
    To allow running this script you may need to set execution policy once:
        Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#>

$ErrorActionPreference = 'Stop'

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  clad0  |  Field Journal of the Throat" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ── Check Node.js ─────────────────────────────────────────────────────────────
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Host "  ERROR: Node.js is not installed or not on your PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Download it from: https://nodejs.org" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}

$nodeVersion = & node --version
Write-Host "  Node.js $nodeVersion found." -ForegroundColor Green

# ── Change to script directory ────────────────────────────────────────────────
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# ── Check server.js exists ────────────────────────────────────────────────────
if (-not (Test-Path "server.js")) {
    Write-Host ""
    Write-Host "  ERROR: server.js not found in $scriptDir" -ForegroundColor Red
    Write-Host "  Make sure start.ps1 is in the same folder as server.js." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "  Press Enter to exit"
    exit 1
}

# ── Choose port ───────────────────────────────────────────────────────────────
if (-not $env:PORT) { $env:PORT = "3000" }
$url = "http://localhost:$($env:PORT)"

Write-Host "  Starting server on $url" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

# ── Open browser after 1.5 s ─────────────────────────────────────────────────
$browserJob = Start-Job -ScriptBlock {
    param($u)
    Start-Sleep -Milliseconds 1500
    Start-Process $u
} -ArgumentList $url

# ── Start server (blocking) ───────────────────────────────────────────────────
try {
    & node server.js
} finally {
    Stop-Job $browserJob -ErrorAction SilentlyContinue
    Remove-Job $browserJob -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "  Server stopped." -ForegroundColor DarkGray
    Read-Host "  Press Enter to close"
}
