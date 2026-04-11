<#
---
platform: windows-11-x64
title: Setup WSL Debian 13
description: Installs a named Debian 13 WSL instance and creates a local user account.
---
Installs a WSL 2 Debian 13 instance, creates a user account matching your Windows
username, adds it to the `sudo` group, and sets it as the default login user.

The script prompts for an instance name before doing anything — enter any identifier
you like (e.g. `Debian13Dev`, `work`, `personal`).

## What it does

1. Verifies `wsl.exe` is present on the system.
2. Checks that the target instance name does not already exist.
3. Installs Debian from the Microsoft Store via `wsl --install` without launching
   the interactive first-run setup.
4. Creates a user account inside the distro matching the current Windows username.
5. Adds the user to the `sudo` group.
6. Writes `/etc/wsl.conf` to set the new user as the default login.
7. Terminates the instance so the configuration takes effect on next launch.

## Requirements

- Windows 11 with WSL 2 support enabled.
- `wsl.exe` installed. If not present, run: `wsl --install --no-distribution`
- Must be run as Administrator.
#>

#Requires -RunAsAdministrator
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$InstanceName = ''
while (-not $InstanceName.Trim()) {
    $InstanceName = (Read-Host 'Enter a name for the WSL instance (e.g. Debian13Dev)').Trim()
}

$WinUser = $env:USERNAME
$Tag = '[setup-wsl-debian13]'

Write-Host "$Tag Starting..."
Write-Host "$Tag Instance name: $InstanceName"
Write-Host "$Tag Windows user:  $WinUser"

# Verify WSL is installed
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Error "$Tag wsl.exe not found. Install WSL first:`n  wsl --install --no-distribution"
    exit 1
}

# Check the instance does not already exist
# wsl --list --quiet outputs UTF-16LE; normalize before comparing
$ExistingInstances = (wsl --list --quiet 2>$null) |
    ForEach-Object { $_.Trim("`0").Trim() } |
    Where-Object { $_ -ne '' }

if ($ExistingInstances -contains $InstanceName) {
    Write-Error "$Tag WSL instance '$InstanceName' already exists. Remove it first:`n  wsl --unregister $InstanceName"
    exit 1
}

# Install Debian without triggering the interactive first-run wizard
Write-Host "$Tag Installing Debian WSL instance '$InstanceName'..."
wsl --install -d Debian --name $InstanceName --no-launch
if ($LASTEXITCODE -ne 0) {
    Write-Error "$Tag Failed to install WSL instance."
    exit 1
}

# Create user account (run as root — no default user exists yet)
# useradd is used instead of adduser: Debian 13 ships adduser 4.0 which dropped
# the --gecos flag, and PowerShell drops empty-string args when passing to WSL.
Write-Host "$Tag Creating user '$WinUser'..."
wsl --distribution $InstanceName --user root -- useradd --create-home --shell /bin/bash $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Error "$Tag Failed to create user '$WinUser'."
    exit 1
}

# Add user to the sudo group
Write-Host "$Tag Adding '$WinUser' to sudo group..."
wsl --distribution $InstanceName --user root -- usermod -aG sudo $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Error "$Tag Failed to add '$WinUser' to sudo group."
    exit 1
}

# Write /etc/wsl.conf so the new user is the default login
Write-Host "$Tag Setting default user in /etc/wsl.conf..."
wsl --distribution $InstanceName --user root -- bash -c "printf '[user]\ndefault=$WinUser\n' > /etc/wsl.conf"
if ($LASTEXITCODE -ne 0) {
    Write-Error "$Tag Failed to write /etc/wsl.conf."
    exit 1
}

# Terminate so wsl.conf takes effect on next launch
Write-Host "$Tag Terminating instance to apply configuration..."
wsl --terminate $InstanceName
if ($LASTEXITCODE -ne 0) {
    Write-Error "$Tag Failed to terminate instance."
    exit 1
}

Write-Host "$Tag Done. WSL instance '$InstanceName' is ready." -ForegroundColor Green
Write-Host "$Tag Verify with: wsl --distribution $InstanceName -- whoami"
