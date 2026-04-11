<#
---
platform: windows-11-x64
title: Set Up WSL
description: Enables the WSL 2 feature and installs the WSL kernel on Windows 11.
---
Enables the Windows Subsystem for Linux feature and installs the WSL 2 kernel.
Run this once on a fresh Windows 11 system before installing any WSL distributions.

Once complete, run **Setup WSL Debian 13** to install and configure a Debian 13
instance.

## What it does

1. Checks whether WSL is already installed and working.
2. If not, runs `wsl --install --no-distribution` to enable the required Windows
   features and install the WSL 2 kernel.
3. Advises whether a system restart is required to complete setup.

## Requirements

- Windows 11 with virtualization enabled in BIOS/UEFI.
- Must be run as Administrator.
#>

#Requires -RunAsAdministrator
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Tag = '[setup-wsl]'

Write-Host "$Tag Checking WSL status..."

# Check if WSL is already installed and working
$WslCmd = Get-Command wsl.exe -ErrorAction SilentlyContinue
if ($WslCmd) {
    $null = wsl --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "$Tag WSL is already installed and ready." -ForegroundColor Green
        Write-Host "$Tag Run the 'Setup WSL Debian 13' script to install a distribution."
        exit 0
    }
}

Write-Host "$Tag Installing WSL (no default distribution)..."
wsl --install --no-distribution
switch ($LASTEXITCODE) {
    0 {
        Write-Host "$Tag WSL installed successfully." -ForegroundColor Green
        Write-Host "$Tag Run the 'Setup WSL Debian 13' script to install a distribution."
    }
    3010 {
        # 3010 = ERROR_SUCCESS_REBOOT_REQUIRED (standard Windows installer exit code)
        Write-Host "$Tag WSL installed — a system restart is required to complete setup." -ForegroundColor Yellow
        Write-Host "$Tag After restarting, run the 'Setup WSL Debian 13' script."
    }
    default {
        Write-Error "$Tag WSL installation failed (exit code $LASTEXITCODE)."
        exit 1
    }
}
