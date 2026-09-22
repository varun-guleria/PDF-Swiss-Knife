# PDF Swiss-Knife — PowerShell Launcher
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Starting PDF Swiss-Knife..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue

if (-not $pythonCmd) {
    Write-Host "[ERROR] Python was not found in your PATH." -ForegroundColor Red
    Write-Host "Please install Python 3.10+ and ensure it is added to your PATH." -ForegroundColor Yellow
    exit 1
}

python run.py
