---
name: scriptor
description: Use when creating, modifying, or troubleshooting Scriptor setup scripts, manifest entries in scriptor.yaml, or spec files. Triggers on any work involving the three script artifacts (manifest entry, script file, spec file).
---

# Scriptor Script Management

## Overview

Scriptor defines host-specific setup scripts through three coordinated artifacts:

| Artifact | Path Pattern | Required |
|---|---|---|
| Manifest entry | `scriptor.yaml` (top-level YAML array) | Yes |
| Script file | `scripts/<platform-path>/<script-id>.<sh\|ps1>` | Yes |
| Spec file | `scripts/<platform-path>/<script-filename>.spec.md` | Yes |

### Platform Path Rules

The `<platform-path>` prefix depends on the platform:

| Platform | Path Pattern | Example |
|---|---|---|
| `windows` | `scripts/Windows/` | `scripts/Windows/install-wsl.ps1` |
| `mac` | `scripts/macos/` | `scripts/macos/install-homebrew.sh` |
| `linux` | `scripts/<distro>/<version>/` | `scripts/Debian/13/install-docker.sh` |

For linux, use the **short distro name** (e.g., `Debian` not `Debian GNU/Linux`) as the directory name. The `version` directory matches the manifest `version` value.

All three artifacts must stay consistent. When creating or modifying a script, always touch all three.

## Workflow: Creating a New Script

### Step 1 — Gather Requirements

Determine the following before writing anything:

- **Platform**: `windows`, `linux`, or `mac`
- **Architecture**: `x86` or `arm`
- **Distro + Version** (linux only): e.g., `Debian GNU/Linux` / `"13"`
- **Dependencies**: ids of scripts that must run first
- **Inputs**: any runtime parameters the script needs (see Input Types below)
- **What the script does**: enough detail for the spec file

### Step 2 — Check Existing Manifest

Read `scriptor.yaml` to:

- Verify the chosen `id` is unique
- See naming conventions and field ordering used by existing entries
- Check for scripts that could be reused or depended on

### Step 3 — Write the Script File

Create the script in the platform-appropriate directory (see Platform Path Rules):

- **Windows**: `scripts/Windows/<name>.ps1`
- **Mac**: `scripts/macos/<name>.sh`
- **Linux**: `scripts/<distro>/<version>/<name>.sh` (e.g., `scripts/Debian/13/install-nginx.sh`)
- Use the bash or powershell template below
- If the script has inputs, accept them as positional args `$1`, `$2`, ... in the same order as the `inputs` array in the manifest

### Step 4 — Append Manifest Entry

Add a new entry to `scriptor.yaml`. The `script` field must use the full platform path (e.g., `scripts/Debian/13/install-nginx.sh`). Follow the field order shown in the Manifest Schema section. Always append to the end of the file.

### Step 5 — Write the Spec File

Create `scripts/<platform-path>/<script-filename>.spec.md` alongside the script file (e.g., for `scripts/Debian/13/install-nginx.sh` the spec is `scripts/Debian/13/install-nginx.sh.spec.md`). Use the Spec File Format below.

## Workflow: Modifying an Existing Script

1. Read the manifest entry in `scriptor.yaml`
2. Read the script file
3. Read the spec file
4. Make the requested changes across all three artifacts, keeping them consistent
5. If adding/removing/reordering inputs, update the positional arg handling in the script to match the new manifest `inputs` order

## Manifest Schema

### Required Fields (all platforms)

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier, kebab-case |
| `name` | string | Human-readable display name |
| `description` | string | One-line summary |
| `platform` | enum | `windows` \| `linux` \| `mac` |
| `arch` | enum | `x86` \| `arm` |
| `script` | string | Platform path to script file (e.g., `scripts/Debian/13/install-foo.sh`) |

### Linux-Only Fields (required when platform is linux)

| Field | Type | Description |
|---|---|---|
| `distro` | string | OS distributor name (e.g., `Debian GNU/Linux`, `Ubuntu`, `RedHat`) |
| `version` | string | OS version — **must be quoted** (e.g., `"13"`, `"24.04"`) |

### Optional Fields

| Field | Type | Description |
|---|---|---|
| `dependencies` | string[] | List of script ids that must run before this one (forces those scripts into the run list) |
| `run_after` | string[] | Soft ordering: if this script and a listed id are both selected, the listed script runs first. No effect if the other script is not selected. |
| `inputs` | object[] | Runtime parameters — see Input Types below |
| `requires_sudo` | boolean | `true` if the script uses `sudo` commands (linux/mac only, defaults to `false`) |

### Manifest Entry Template

```yaml
- id: <unique-kebab-case-id>
  name: <Display Name>
  description: <One-line description>
  platform: <windows|linux|mac>
  arch: <x86|arm>
  distro: <Distro Name>        # linux only
  version: "<version>"          # linux only, always quoted
  script: scripts/<platform-path>/<filename>   # e.g., scripts/Debian/13/install-foo.sh
  requires_sudo: true            # optional, linux/mac only
  dependencies:                 # optional
    - <dependency-id>
  run_after:                    # optional - soft ordering only
    - <predecessor-id>
  inputs:                       # optional
    - id: <input-id>
      type: <string|number|ssl-cert>
      label: <Human label>
      required: true
```

## Input Types

| Type | Value Passed to Script | Notes |
|---|---|---|
| `string` | The literal string value | General text input |
| `number` | The numeric value as string | Numeric input (port, count, etc.) |
| `ssl-cert` | The `download_path` value | Certificate downloaded to `download_path` before script runs |

### Input Field Reference

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique within this script's inputs, kebab-case |
| `type` | Yes | `string` \| `number` \| `ssl-cert` |
| `label` | Yes | Human-readable label for the TUI |
| `required` | No | `true` or `false` (default: false) |
| `default` | No | Default value (type-appropriate) |
| `download_path` | ssl-cert only | Filesystem path where the cert is saved before the script runs |
| `format` | ssl-cert only | Certificate format (e.g., `PEM`, `DER`) |

### Input Rules

- Input `id` values must be unique within a single script entry
- Inputs are passed to the script as positional arguments (`$1`, `$2`, `$3`, ...) **in declaration order**
- For `ssl-cert` inputs, the script receives the `download_path` as its positional argument (the file is already downloaded)

## Script File Conventions

### Bash Template (`.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# If script has inputs, assign positional args:
# SERVICE_NAME="$1"
# PORT="$2"

echo "[<script-id>] Starting..."

# ... script logic ...

echo "[<script-id>] Done."
```

### PowerShell Template (`.ps1`)

```powershell
#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

# If script has inputs:
# param(
#     [string]$ServiceName = $args[0],
#     [int]$Port = $args[1]
# )

Write-Host "[<script-id>] Starting..."

# ... script logic ...

Write-Host "[<script-id>] Done."
```

### Sudo Guidelines

- Use `sudo` on individual commands that need root (e.g., `sudo apt-get install -y git`), not at the script level
- Do NOT add root checks (`if [[ $(/usr/bin/id -u) -ne 0 ]]`) — the TUI handles sudo credential caching before scripts run
- Set `requires_sudo: true` in the manifest for any script that uses `sudo` commands
- Never use `requires_sudo` on `platform: windows` entries — use `#Requires -RunAsAdministrator` instead
- Leave unprivileged commands (e.g., `mktemp`, `echo`, `wget`) without `sudo`

### Script Conventions

- Log lines prefixed with `[<script-id>]` matching the manifest `id`
- Bash: always `#!/usr/bin/env bash` + `set -euo pipefail`
- PowerShell: always `$ErrorActionPreference = "Stop"`
- Use `sleep` calls to simulate progress for demo/stub scripts

## Spec File Format

Path: `scripts/<platform-path>/<script-filename>.spec.md` — the spec file lives alongside the script in the same directory.

Examples:
- `scripts/Debian/13/install-bun.sh` -> `scripts/Debian/13/install-bun.sh.spec.md`
- `scripts/Windows/install-wsl.ps1` -> `scripts/Windows/install-wsl.ps1.spec.md`
- `scripts/macos/install-homebrew.sh` -> `scripts/macos/install-homebrew.sh.spec.md`

### Spec Template

```markdown
## Overview

<1-2 sentence description of what the script does and on which platform.>

## Steps

1. <Step one>
2. <Step two>
3. ...

## Verification

\`\`\`bash
<command to verify the script worked>
\`\`\`
```

Optional additional sections (use when relevant): `## Prerequisites`, `## Post-install`, `## Inputs`.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Missing `distro`/`version` on linux entries | Always include both when `platform: linux` |
| Unquoted `version` value | Always quote: `version: "13"` not `version: 13` |
| Spec file named without script extension | Include full filename: `install-foo.sh.spec.md` not `install-foo.spec.md` |
| Script placed in flat `scripts/` directory | Use platform path: `scripts/Debian/13/`, `scripts/Windows/`, or `scripts/macos/` |
| Using full distro name as directory (e.g., `Debian GNU/Linux`) | Use short name for directory: `Debian`, `Ubuntu`, `RedHat` |
| Input positional arg order doesn't match manifest | `$1` = first input in `inputs` array, `$2` = second, etc. |
| Duplicate script `id` in manifest | Read `scriptor.yaml` first and verify uniqueness |
| Missing `download_path` on ssl-cert input | Always provide `download_path` and `format` for ssl-cert type |
| Forgetting to update all three artifacts | A change to any artifact likely requires changes to the other two |
| Adding `distro`/`version` to windows or mac entries | These fields are linux-only; omit them for other platforms |
| Log prefix doesn't match manifest id | Use `[<id>]` where `<id>` is the exact `id` from the manifest entry |
| Missing `requires_sudo` on scripts that use `sudo` | Set `requires_sudo: true` in the manifest for any script with `sudo` commands |
| Using root checks instead of per-command `sudo` | Remove `if [[ $(/usr/bin/id -u) -ne 0 ]]` checks; use `sudo` on individual commands |
| Adding `requires_sudo` to windows entries | Windows uses `#Requires -RunAsAdministrator`, not `requires_sudo` |
| Using `dependencies` when you only need ordering | Use `run_after` if the other script shouldn't be forced to run — `dependencies` always adds the dep to the run list regardless of user selection |
| Using `run_after` when guaranteed execution is needed | Use `dependencies` if the prerequisite must always run regardless of selection |
