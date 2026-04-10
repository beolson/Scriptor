<#
---
platform: windows-11-x64
title: Setup winget
description: Ensures the Windows Package Manager (winget) is up to date.
---
Ensures the Windows Package Manager (`winget`) is up to date on Windows 11.

## What it does

Checks for the latest version of the App Installer package (which provides `winget`) and upgrades it if a newer release is available from the Microsoft Store.

## Requirements

- Windows 11
- PowerShell 5.1 or later
#>

winget upgrade --id Microsoft.AppInstaller --silent --accept-source-agreements
