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
5. Prompts you to set a UNIX password for that account (used by `sudo`).
6. Adds the user to the `sudo` group.
7. Writes `/etc/wsl.conf` to set the new user as the default login.
8. Terminates the instance so the configuration takes effect on next launch.

## Requirements

- Windows 11 with WSL 2 installed. If WSL is not set up yet, run the
  **Set Up WSL** script first.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$WinUser = $env:USERNAME
$Tag = '[setup-wsl-debian13]'

# Verify WSL is installed before prompting for anything
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Error "$Tag wsl.exe not found. Run the 'Set Up WSL' script first."
    exit 1
}

# Prompt for instance name, re-prompting if the name is already in use
# wsl --list --quiet outputs UTF-16LE; normalize before comparing
$InstanceName = ''
while ($true) {
    while (-not $InstanceName.Trim()) {
        $InstanceName = (Read-Host 'Enter a name for the WSL instance (e.g. Debian13Dev)').Trim()
    }

    $ExistingInstances = (wsl --list --quiet 2>$null) |
        ForEach-Object { $_.Trim("`0").Trim() } |
        Where-Object { $_ -ne '' }

    if ($ExistingInstances -contains $InstanceName) {
        Write-Host "$Tag Instance '$InstanceName' already exists." -ForegroundColor Yellow
        Write-Host "$Tag To remove it, run:  wsl --unregister $InstanceName"
        Write-Host "$Tag Enter a different name to continue."
        $InstanceName = ''
    } else {
        break
    }
}

Write-Host "$Tag Starting..."
Write-Host "$Tag Instance name: $InstanceName"
Write-Host "$Tag Windows user:  $WinUser"

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

# Set the user's UNIX password (required for sudo)
Write-Host "$Tag Set a password for '$WinUser' (this will be used for sudo inside WSL):"
wsl --distribution $InstanceName --user root -- passwd $WinUser
if ($LASTEXITCODE -ne 0) {
    Write-Error "$Tag Failed to set password for '$WinUser'."
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
