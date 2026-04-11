<#
---
platform: windows-11-x64
title: Install Dev Apps
description: Installs Windows Terminal, VS Code, and Google Chrome via winget.
---
Installs a standard set of developer applications using the Windows Package Manager
(`winget`). Each package is checked first — already-installed apps are skipped so
the script is safe to run more than once.

## What it does

1. Verifies `winget` is available.
2. Installs **Windows Terminal** — the modern tabbed terminal for PowerShell, CMD, and WSL.
3. Installs **Visual Studio Code** — lightweight code editor.
4. Installs **Google Chrome** — web browser.

## Requirements

- Windows 11
- winget (App Installer) — pre-installed on Windows 11; update via the Microsoft Store if needed.
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

Install-WingetPackage -Id 'Microsoft.WindowsTerminal' -Name 'Windows Terminal'
Install-WingetPackage -Id 'Microsoft.VisualStudioCode' -Name 'Visual Studio Code'
Install-WingetPackage -Id 'Google.Chrome'              -Name 'Google Chrome'

Write-Host "All apps installed." -ForegroundColor Green
