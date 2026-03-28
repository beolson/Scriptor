# scriptor.yaml Reference

`scriptor.yaml` at the repo root is the manifest of all setup scripts. Scriptor reads this file at startup (via the GitHub API), filters entries to those that match the current host, and presents the matching scripts in an interactive TUI for selection and execution.

The file is an array of **script entries**. Each entry describes one script, its target platform, optional user inputs, and dependency ordering.

A JSON Schema is available at `scriptor.schema.json` for IDE validation and autocomplete. Add this comment to the top of `scriptor.yaml` to activate it:

```yaml
# yaml-language-server: $schema=./scriptor.schema.json
```

---

## Script Entry Fields

These are the fields on each top-level entry in the array.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | **yes** | — | Unique identifier across the manifest. Used as the reference key in `dependencies` and `optional_dependencies`. Duplicate IDs cause a fatal parse error. |
| `name` | string | **yes** | — | Short display name shown in the TUI script list. |
| `description` | string | **yes** | — | One-sentence description shown in the TUI and on the documentation website. |
| `platform` | `linux` \| `mac` \| `windows` | **yes** | — | Target OS. Entries not matching the host platform are hidden. |
| `arch` | `x86` \| `arm` | **yes** | — | Target CPU architecture. Entries not matching the host arch are hidden. |
| `script` | string | **yes** | — | Repo-relative path to the script file (e.g. `scripts/Debian/13/install-git-gh.sh`). |
| `distro` | string | linux only | — | Value of `NAME` in `/etc/os-release` (e.g. `Debian GNU/Linux`). Required when `platform: linux`. Must not appear on non-linux entries. |
| `version` | string | linux only | — | Value of `VERSION_ID` in `/etc/os-release` (e.g. `13`, `22.04`). Required when `platform: linux`. Exact string match — `13` does **not** match `13.1`. Must not appear on non-linux entries. |
| `group` | string | no | — | Logical grouping label for TUI display (e.g. `DevTools`). Visual only; does not affect filtering or ordering. |
| `dependencies` | string[] | no | `[]` | Hard-ordered prerequisites (list of `id` values). See [Dependency Resolution](#dependency-resolution). |
| `optional_dependencies` | string[] | no | `[]` | Soft ordering constraints (list of `id` values). See [Dependency Resolution](#dependency-resolution). |
| `requires_elevation` | boolean | no | `false` | When `true`, the TUI validates sudo/admin credentials before executing. |
| `creates` | string | no | — | A `~`-expanded path that the script creates on success. If the path exists at runtime the script is shown as "installed" in the TUI. See [Installed-Status Detection](#installed-status-detection). |
| `inputs` | InputDef[] | no | `[]` | User prompts collected before execution. See [Input Definitions](#input-definition-fields). |

### Platform Values

`platform` maps from the Node.js runtime's `process.platform`:

| YAML value | Node.js platform |
|---|---|
| `linux` | `linux` |
| `mac` | `darwin` |
| `windows` | `win32` |

### Arch Values

`arch` maps from `process.arch`:

| YAML value | Node.js arch |
|---|---|
| `x86` | `x64`, `ia32`, or anything else |
| `arm` | `arm64`, `arm` |

---

## Input Definition Fields

Each entry in the `inputs` array defines a prompt collected from the user before the script executes. Collected values are passed to the script as environment variables.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | **yes** | Unique within the script. Must not be duplicated within the same entry. Used as the environment variable name. |
| `type` | `string` \| `number` \| `ssl-cert` | **yes** | Kind of input. See [Input Types](#input-types) below. |
| `label` | string | **yes** | Prompt text shown to the user. |
| `required` | boolean | no | When `true`, empty input is rejected. When `false` or absent, the user may leave the field blank. |
| `default` | string | no | Pre-filled default value. Used if the user submits without typing. |
| `download_path` | string | ssl-cert only | Absolute path where the downloaded certificate will be written (e.g. `/tmp/my-cert.pem`). |
| `format` | `pem` \| `PEM` \| `der` \| `DER` | ssl-cert only | Encoding format for the downloaded certificate. Case-insensitive. Defaults to PEM. |

> **Note:** Additional fields on an input definition are preserved as-is (passthrough). This allows future input types to carry type-specific metadata without a manifest schema change.

### Input Types

**`string`** — Free-text prompt. Value passed to the script as a string environment variable.

**`number`** — Numeric prompt. The TUI validates that the value is a valid number before proceeding.

**`ssl-cert`** — Four-step TLS certificate flow:
1. User enters a hostname/URL.
2. The TUI fetches the certificate chain from that host.
3. The TUI displays each certificate in the chain (root-first) with its CN, role, and expiry date.
4. The user selects a certificate; it is downloaded to `download_path` in `format` encoding.

The selected certificate's Common Name is shown in the confirmation screen.

### Input Deduplication

When multiple selected scripts share an input with the same `id`, the user is prompted only once. The collected value is reused for every script that declares that `id`. This is intentional — for example, a `private-certs-file` input can appear on several scripts and the user only types the path once.

---

## Platform Rules

The `distro` and `version` fields have strict platform constraints enforced at parse time:

| platform | `distro` | `version` |
|---|---|---|
| `linux` | **required** | **required** |
| `mac` | **must not appear** | **must not appear** |
| `windows` | **must not appear** | **must not appear** |

Violations cause a fatal error and Scriptor exits with a non-zero code. The error message identifies the offending entry by `id`.

`distro` and `version` are compared with exact string equality against the host's `/etc/os-release`. If `/etc/os-release` is unreadable, **all** linux entries are excluded from the filtered set.

---

## Dependency Resolution

Dependencies define execution order and expand the run set.

### `dependencies` (hard)

- The referenced script is **automatically added** to the run set if not already present.
- The referenced script is guaranteed to **execute before** the dependent script.
- If the referenced `id` does not exist in the manifest (or is not available for the current host), loading fails with a `MissingDependencyError`.
- Circular references fail with a `CircularDependencyError`.

### `optional_dependencies` (soft)

- The referenced script is **not** automatically added to the run set.
- If the referenced script **is** already in the run set (because the user selected it, or a hard dependency pulled it in), the ordering constraint is applied: the optional dependency executes first.
- Missing `id` values are silently ignored.

### Execution Order

Resolution is a two-phase process:

1. **Transitive closure** — DFS following `dependencies` to build the full run set.
2. **Topological sort** — Post-order DFS using hard edges (`dependencies`) and any soft edges (`optional_dependencies` entries that are in the run set).

The result is a flat, ordered array of script entries where all prerequisites appear before their dependents.

---

## Installed-Status Detection

The `creates` field specifies a filesystem path that a successfully installed script produces. Before execution, Scriptor expands `~` to the user's home directory and checks whether the path exists.

- If the path **exists**: the script is shown as **installed** in the TUI (dimmed with an indicator). The user can still select and re-run it.
- If the path **does not exist**: the script is shown as **not installed**.

`creates` is only used for display status — it does not skip execution or affect the run set.

Example: `creates: ~/.local/bin/uv` marks the script as installed when `uv` is present at that path.

---

## Examples

### Minimal Windows Entry

```yaml
- id: install-wsl
  name: Install WSL
  description: Enables the Windows Subsystem for Linux feature
  platform: windows
  arch: x86
  requires_elevation: true
  script: scripts/Windows/install-wsl.ps1
```

### Minimal Linux Entry

```yaml
- id: install-system-basics
  name: Install System Basics
  description: Updates system packages and installs curl, wget, and libicu-dev on Debian 13
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/Debian/13/install-system-basics.sh
  requires_elevation: true
```

> Note: `version` should always be quoted in YAML to avoid numeric interpretation (e.g. `"13"` not `13`).

### Entry with String Inputs

```yaml
- id: configure-git
  name: Configure Git
  description: Sets global git user.name and user.email from provided inputs
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/Debian/13/configure-git.sh
  dependencies:
    - install-git-gh
  creates: ~/.config/git/config
  inputs:
    - id: name
      type: string
      label: Full name (e.g. Jane Smith)
      required: true
    - id: email
      type: string
      label: Email address (e.g. jane@example.com)
      required: true
```

### Entry with an SSL-Cert Input

```yaml
- id: test-configure-tls-endpoint
  name: "[TEST] Configure TLS Endpoint"
  description: Simulates configuring a TLS endpoint with a certificate
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/Debian/13/test-configure-tls-endpoint.sh
  inputs:
    - id: cert
      type: ssl-cert
      label: Cert URL
      required: true
      download_path: /tmp/test-tls-cert.pem
      format: PEM
```

### Entry with Hard and Optional Dependencies

```yaml
- id: configure-npm-remote
  name: Configure Custom npm Registry
  description: Configures bun/npm to use a custom registry via ~/.npmrc
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/Debian/13/configure-npm-remote.sh
  dependencies:
    - install-bun          # always runs first; added to run set if not selected
  optional_dependencies:
    - setup-ssh-keys       # ordered before this script only if already in the run set
  inputs:
    - id: registry-url
      type: string
      label: "Registry URL (e.g. https://npm.pkg.github.com)"
      required: true
    - id: auth-token
      type: string
      label: Auth token (leave blank to skip)
      required: false
```

### Windows Entry with a Default Input

```yaml
- id: setup-debian-devbox
  name: Setup Debian Devbox
  description: Installs a named Debian WSL instance and creates a passwordless local user
  platform: windows
  arch: x86
  script: scripts/Windows/setup-debian-devbox.ps1
  inputs:
    - id: instance-name
      type: string
      label: WSL instance name
      required: true
      default: Debian13Dev
```

---

## Validation Errors

The following conditions cause Scriptor to exit with a non-zero code and print an error:

| Condition | Error |
|---|---|
| YAML syntax error | Fatal parse error with line/column |
| Missing required field (`id`, `name`, `description`, `platform`, `arch`, `script`) | Zod schema error identifying the field and entry index |
| `platform` value is not `linux`, `mac`, or `windows` | Zod enum error |
| `arch` value is not `x86` or `arm` | Zod enum error |
| `platform: linux` entry missing `distro` or `version` | Custom validation error identifying the entry `id` |
| Non-linux entry has `distro` or `version` | Custom validation error identifying the entry `id` |
| Duplicate `id` values within a script's `inputs` array | Custom validation error identifying the duplicate `id` |
| `dependencies` references an `id` not available for the current host | `MissingDependencyError` at dependency resolution time |
| `dependencies` forms a cycle | `CircularDependencyError` with the cycle path in the message |
