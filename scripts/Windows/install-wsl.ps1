#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[install-wsl] Checking WSL status..."

$wslExe = Get-Command wsl.exe -ErrorAction SilentlyContinue
if ($wslExe) {
    wsl --status *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[install-wsl] WSL is already installed and ready."
        exit 0
    }
}

Write-Host "[install-wsl] Enabling WSL feature..."
wsl --install --no-distribution *> $null

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Host "[install-wsl] ERROR: wsl.exe not found after install. Installation failed."
    exit 1
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "[install-wsl] WSL installed successfully."
} else {
    Write-Host "[install-wsl] WSL feature enabled. A system reboot is required before installing distributions."
}
