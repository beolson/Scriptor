## Overview

Enables the Windows Subsystem for Linux (WSL) feature. Run this once before
installing any WSL distribution. Requires administrator privileges.

## Prerequisites

- Windows 10 version 2004 or later, or Windows 11
- Administrator account

## Steps

1. Check if WSL is already installed and functional (`wsl --status`)
2. If already ready, exit immediately with no changes
3. Otherwise, run `wsl --install --no-distribution` to enable the feature
4. Verify `wsl.exe` is present after installation
5. Report success or prompt for reboot if the feature was newly enabled

## Inputs

None.

## Verification

```powershell
wsl --status   # should print WSL version info with exit code 0
```

## Notes

- If WSL was newly enabled and `wsl.exe` is present but `wsl --status` still
  returns non-zero, a reboot is required before installing distributions.
- Run `setup-debian-devbox` after rebooting to install a Debian instance.
