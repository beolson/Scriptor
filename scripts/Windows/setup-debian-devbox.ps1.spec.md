## Overview

Creates a named Debian WSL instance with automatic user setup (matching the
Windows username) and SSH key transfer from the Windows host.

## Prerequisites

- Windows 11 22H2 or later (required for `wsl --install --name` and `--no-launch` flags)
- WSL feature enabled (`wsl --install` must have been run at least once previously, or the Windows feature is enabled)
- An existing `.ssh` directory under the Windows user profile (optional; script warns if missing)

## Steps

1. Accept an optional instance name (default: `Debian13Dev`)
2. Verify WSL is installed (prints install command if missing)
3. Check if a WSL instance with that name already exists (prints unregister command if it does)
4. Install Debian via `wsl --install -d Debian --name <name> --no-launch`
5. Create a passwordless user matching the Windows username
6. Add the user to the `sudo` group with passwordless sudo
7. Set the user as the default in `/etc/wsl.conf`
8. Terminate the instance to apply the configuration
9. Copy SSH files from the Windows home directory into the WSL instance
10. Set correct SSH file permissions (700 for `.ssh/`, 600 for private keys, 644 for public keys)

## Inputs

| Input | Type | Required | Default | Description |
|---|---|---|---|---|
| `instance-name` | string | No | `Debian13Dev` | Name for the WSL instance |

## Verification

```powershell
wsl --distribution Debian13Dev -- whoami          # should show Windows username
wsl --distribution Debian13Dev -- ls -la ~/.ssh/  # should show copied SSH files
wsl --distribution Debian13Dev -- sudo whoami     # should show "root" (passwordless sudo)
```
