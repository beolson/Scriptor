## Overview

Installs a named Debian WSL instance and creates a passwordless local user
matching the Windows username. Does not require administrator privileges on
Windows 11 when WSL is already enabled.

## Prerequisites

- Windows 11 22H2 or later (required for `wsl --install --name` and `--no-launch` flags)
- WSL feature already enabled (run the `Install WSL` script first if needed)

## Steps

1. Accept an optional instance name (default: `Debian13Dev`)
2. Verify WSL is installed (prints install guidance if missing)
3. Check if a WSL instance with that name already exists (prints unregister command if it does)
4. Install Debian via `wsl --install -d Debian --name <name> --no-launch`
5. Create a user matching the Windows username with no password (`passwd -d`)
6. Set the user as the default in `/etc/wsl.conf`
7. Terminate the instance to apply the configuration

## Inputs

| Input | Type | Required | Default | Description |
|---|---|---|---|---|
| `instance-name` | string | No | `Debian13Dev` | Name for the WSL instance |

## Verification

```powershell
wsl --distribution Debian13Dev -- whoami   # should show Windows username
```
