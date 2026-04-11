<#
---
platform: windows-11-x64
title: Install Apps
description: Upgrades winget, then installs Windows Terminal, VS Code, Git, and Chrome.
---
Installs a standard set of developer applications using the Windows Package Manager
(`winget`). Each package is checked first — already-installed apps are skipped so
the script is safe to run more than once.

## What it does

1. Upgrades **winget** (App Installer) to the latest version.
2. Installs **Windows Terminal** — the modern tabbed terminal for PowerShell, CMD, and WSL.
3. Installs **Visual Studio Code** — lightweight code editor.
4. Installs **Git for Windows** — version control.
5. Installs **Google Chrome** — web browser.

## Requirements

- Windows 11
- winget (App Installer) — pre-installed on Windows 11; update via the Microsoft Store if
  the upgrade step fails.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Install-WingetPackage {
    param(
        [string]$Id,
        [string]$Name
    )

    $installed = winget list --id $Id --exact 2>$null
    if ($installed -match [regex]::Escape($Id)) {
        Write-Host "$Name is already installed, skipping."
        return
    }

    Write-Host "Installing $Name..."
    winget install --id $Id --exact --silent --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install $Name."
        exit 1
    }
    Write-Host "$Name installed." -ForegroundColor Green
}

# Verify winget is present
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error "winget (App Installer) is required but was not found. Install it from the Microsoft Store."
    exit 1
}

# Upgrade winget itself first
Write-Host "Upgrading winget (App Installer)..."
winget upgrade --id Microsoft.AppInstaller --silent --accept-source-agreements
# Non-zero exit here just means no upgrade was needed; don't treat as fatal

Install-WingetPackage -Id 'Microsoft.WindowsTerminal'   -Name 'Windows Terminal'
Install-WingetPackage -Id 'Microsoft.VisualStudioCode'  -Name 'Visual Studio Code'
Install-WingetPackage -Id 'Git.Git'                     -Name 'Git for Windows'
Install-WingetPackage -Id 'Google.Chrome'               -Name 'Google Chrome'

Write-Host "All apps installed." -ForegroundColor Green
