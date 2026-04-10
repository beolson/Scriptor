<#
---
platform: windows-11-x64
title: Install VS Code
description: Installs Visual Studio Code via winget.
---
Installs Visual Studio Code using the Windows Package Manager.

## What it does

Uses `winget` to install the latest stable release of Visual Studio Code silently, accepting all source and package agreements automatically.

## Requirements

- Windows 11
- winget (App Installer) available
- PowerShell 5.1 or later
#>

winget install --id Microsoft.VisualStudioCode --silent --accept-source-agreements --accept-package-agreements
