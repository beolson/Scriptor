# scriptor.yaml Reference

`scriptor.yaml` at the repo root is the manifest of all setup scripts and their logical groups. Scriptor reads this file at startup (via the GitHub API), filters entries to those that match the current host, and presents the matching scripts in an interactive TUI for selection and execution.

The file is a YAML object with two top-level keys:

- **`scripts`** (required) — an array of script entries. Each entry describes one setup script, its target OS, optional user inputs, and dependency ordering.
- **`groups`** (optional) — an array of group entries. Each group organises scripts for selection in the TUI. Groups are purely organisational — all ordering, dependencies, and conditional inclusion are declared on individual script entries.

A JSON Schema is available at `scriptor.schema.json` for IDE validation and autocomplete. Add this comment to the top of `scriptor.yaml` to activate it:

```yaml
# yaml-language-server: $schema=./scriptor.schema.json
```

---

## Script Entry Fields

These are the fields on each entry in the `scripts` array.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | **yes** | — | Unique identifier across the manifest. Used as the reference key in `dependencies`, `run_after`, and group `scripts` arrays. Duplicate IDs cause a fatal parse error. |
| `name` | string | **yes** | — | Short display name shown in the TUI script list. |
| `description` | string | **yes** | — | One-sentence description shown in the TUI and on the documentation website. |
| `os` | object | **yes** | — | Target OS specification. See [OS Specification](#os-specification) below. |
| `script` | string | **yes** | — | Repo-relative path to the script file (e.g. `scripts/Debian/13/install-git-gh.sh`). |
| `dependencies` | string[] | no | `[]` | Hard-ordered prerequisites (list of `id` values). See [Dependency Resolution](#dependency-resolution). |
| `run_after` | string[] | no | `[]` | Soft ordering constraints (list of `id` values). See [Dependency Resolution](#dependency-resolution). |
| `run_if` | string \| string[] | no | — | One or more script `id` values. When set, this script is only added to the run set if **all** referenced scripts are considered present — either selected by the user this session or already installed on disk (via `creates`). See [Conditional Inclusion](#conditional-inclusion). |
| `requires_elevation` | boolean | no | `false` | When `true`, the TUI validates sudo/admin credentials before executing. |
| `creates` | string | no | — | A `~`-expanded path that the script creates on success. If the path exists at runtime the script is shown as "installed" in the TUI. See [Installed-Status Detection](#installed-status-detection). |
| `inputs` | InputDef[] | no | `[]` | User prompts collected before execution. See [Input Definition Fields](#input-definition-fields). |

### OS Specification

The `os` field is a required object with the following properties:

| Field | Type | Required | Description |
|---|---|---|---|
| `os.name` | string | **yes** | OS name. For Linux: the `NAME` field from `/etc/os-release` (e.g. `Debian GNU/Linux`, `Ubuntu`). For macOS: `mac`. For Windows: `windows`. Case-sensitive exact match against the detected host OS name. |
| `os.version` | string | no | OS version. For Linux: the `VERSION_ID` field from `/etc/os-release` (e.g. `13`, `22.04`). If omitted, the entry matches **any** version of the named OS. Exact string match when specified — `13` does **not** match `13.1`. |
| `os.arch` | `x64` \| `arm` | **yes** | Target CPU architecture. See [Arch Values](#arch-values) below. |

### Arch Values

`os.arch` maps from `process.arch`:

| YAML value | Node.js arch |
|---|---|
| `x64` | `x64`, `ia32`, or anything else |
| `arm` | `arm64`, `arm` |

> **Note:** `os.version` should always be quoted in YAML to avoid numeric interpretation (e.g. `"13"` not `13`).

---

## Group Entry Fields

These are the fields on each entry in the `groups` array. Groups are purely organisational — they define which scripts are presented together in the TUI menu. All ordering, hard dependencies, and conditional inclusion logic belongs on the individual script entries.

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | **yes** | — | Unique group identifier across the manifest. |
| `name` | string | **yes** | — | Display name shown in the TUI main menu. |
| `description` | string | **yes** | — | One-sentence description of the group. |
| `scripts` | string[] | **yes** | — | Script IDs belonging to this group. Each value must reference a valid script `id`. A script may appear in multiple groups. |

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

## OS Matching Rules

Script entries are filtered against the host machine using the `os` field. All three conditions must be satisfied for an entry to appear in the TUI:

1. **`os.name`** — exact string match against the detected host OS name.
2. **`os.version`** — if specified on the entry, exact string match against the detected host OS version. If omitted, the entry matches any host version for the given OS name.
3. **`os.arch`** — exact match against the detected host architecture.

If `/etc/os-release` is unreadable on Linux, all Linux entries are excluded from the filtered set (name and version cannot be determined).

---

## Dependency Resolution

Dependencies define execution order and expand the run set.

### `dependencies` (hard)

- The referenced script is **automatically added** to the run set if not already present.
- The referenced script is guaranteed to **execute before** the dependent script.
- If the referenced `id` does not exist in the manifest (or is not available for the current host), loading fails with a `MissingDependencyError`.
- Circular references fail with a `CircularDependencyError`.

### `run_after` (soft)

- The referenced script is **not** automatically added to the run set.
- If the referenced script **is** already in the run set (because the user selected it, or a hard dependency pulled it in), the ordering constraint is applied: the referenced script executes first.
- Missing `id` values are silently ignored.

### Execution Order

Resolution is a three-phase process:

**Phase 0 — `run_if` filtering** — scripts whose `run_if` condition is not met are removed from the candidate set before dependency expansion begins. This pass runs once; removals do not trigger re-evaluation.

**Phase 1 — Transitive closure** — DFS following `dependencies` to build the full run set.

**Phase 2 — Topological sort** — Post-order DFS using hard edges (`dependencies`) and soft edges (`run_after` entries that are in the run set).

The result is a flat, ordered array of script entries where all prerequisites appear before their dependents.

---

## Conditional Inclusion

The `run_if` field makes a script's inclusion in the run set conditional on other scripts already being present.

### Semantics

When a script declares `run_if`, Scriptor evaluates the condition **after** the user's selections are assembled into a candidate set but **before** transitive dependency closure. The script is included only if **all** IDs listed in `run_if` are considered **present**. Scripts that fail this check are silently removed.

A referenced script is considered **present** if either condition holds:
1. It is in the **current run set** — the user selected it (individually or via group) in this session.
2. It is **already installed** on the host — it declares a `creates` path and that path currently exists on disk.

Scripts without a `creates` field can only satisfy condition (1).

- A single string and a one-element array are equivalent.
- If the array has multiple entries, **all** must be present (AND semantics).
- If any referenced `id` does not exist in the manifest, Scriptor raises a parse error.
- `run_if` applies identically for individual selection and group selection.

### Example

A "Zscaler" group containing per-tool configuration scripts. Each configure script declares `run_if` referencing its corresponding install script:

```yaml
scripts:
  - id: install-node
    name: Install Node.js
    description: Installs the Node.js LTS runtime
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/install-node.sh
    creates: ~/.local/bin/node        # presence of this path marks node as installed

  - id: configure-node-zscaler
    name: Configure Node.js for Zscaler
    description: Adds the Zscaler CA to the Node.js certificate store
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/configure-node-zscaler.sh
    run_if: install-node              # run only if node is selected this session OR already installed
    run_after:
      - install-node                  # execute after install-node if both are in the run set

  - id: configure-go-zscaler
    name: Configure Go for Zscaler
    description: Adds the Zscaler CA for Go module fetches
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/configure-go-zscaler.sh
    run_if: install-go
    run_after:
      - install-go

groups:
  - id: zscaler-certs
    name: Zscaler Certificate Trust
    description: Configures installed developer tools to trust Zscaler TLS certificates
    scripts:
      - configure-node-zscaler
      - configure-go-zscaler
```

**Scenario A — same session**: User manually selects `install-node`, then selects the `zscaler-certs` group.

1. `install-node` is in the current run set (selected this session).
2. `configure-node-zscaler`: `run_if: install-node` → in run set → **kept**.
3. `configure-go-zscaler`: `run_if: install-go` → not in run set, not installed → **removed**.
4. `configure-node-zscaler` has `run_after: [install-node]` → ordering applied.
5. Final order: `[install-node, configure-node-zscaler]`.

**Scenario B — prior session**: Node was installed in a previous Scriptor run (`~/.local/bin/node` exists on disk). User opens a new session and selects only the `zscaler-certs` group.

1. `install-node` is **not** in the current run set (not selected), but its `creates` path exists → it is **already installed**.
2. `configure-node-zscaler`: `run_if: install-node` → installed on disk → **kept**.
3. `configure-go-zscaler`: `run_if: install-go` → not in run set, not installed → **removed**.
4. Final order: `[configure-node-zscaler]`.

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
scripts:
  - id: install-wsl
    name: Install WSL
    description: Enables the Windows Subsystem for Linux feature
    os:
      name: windows
      arch: x64
    requires_elevation: true
    script: scripts/Windows/install-wsl.ps1
```

### Minimal Linux Entry (Version-Specific)

```yaml
scripts:
  - id: install-system-basics
    name: Install System Basics
    description: Updates system packages and installs curl, wget, and libicu-dev on Debian 13
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/install-system-basics.sh
    requires_elevation: true
```

### Linux Entry Matching Any Version

```yaml
scripts:
  - id: install-common-utils
    name: Install Common Utilities
    description: Installs common utilities on any Debian version
    os:
      name: Debian GNU/Linux
      arch: x64
    script: scripts/Debian/install-common-utils.sh
    requires_elevation: true
```

### Entry with String Inputs

```yaml
scripts:
  - id: configure-git
    name: Configure Git
    description: Sets global git user.name and user.email from provided inputs
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
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
scripts:
  - id: test-configure-tls-endpoint
    name: "[TEST] Configure TLS Endpoint"
    description: Simulates configuring a TLS endpoint with a certificate
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/test-configure-tls-endpoint.sh
    inputs:
      - id: cert
        type: ssl-cert
        label: Cert URL
        required: true
        download_path: /tmp/test-tls-cert.pem
        format: PEM
```

### Entry with Hard and Soft Dependencies

```yaml
scripts:
  - id: configure-npm-remote
    name: Configure Custom npm Registry
    description: Configures bun/npm to use a custom registry via ~/.npmrc
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/configure-npm-remote.sh
    dependencies:
      - install-bun          # always runs first; added to run set if not selected
    run_after:
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
scripts:
  - id: setup-debian-devbox
    name: Setup Debian Devbox
    description: Installs a named Debian WSL instance and creates a passwordless local user
    os:
      name: windows
      arch: x64
    script: scripts/Windows/setup-debian-devbox.ps1
    inputs:
      - id: instance-name
        type: string
        label: WSL instance name
        required: true
        default: Debian13Dev
```

### Groups

Groups are purely organisational. All ordering and dependencies are declared on the script entries themselves.

```yaml
scripts:
  - id: install-system-basics
    name: Install System Basics
    description: Updates system packages and installs core utilities
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/install-system-basics.sh
    requires_elevation: true

  - id: install-git-gh
    name: Install Git & GitHub CLI
    description: Installs git and the gh CLI tool
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/install-git-gh.sh
    requires_elevation: true
    dependencies:
      - install-system-basics   # always runs first; added to run set automatically
    run_after:
      - setup-ssh-keys          # ordered after setup-ssh-keys only if it is also in the run set

  - id: install-bun
    name: Install Bun
    description: Installs the Bun JavaScript runtime
    os:
      name: Debian GNU/Linux
      version: "13"
      arch: x64
    script: scripts/Debian/13/install-bun.sh
    dependencies:
      - install-system-basics

groups:
  - id: devtools
    name: DevTools
    description: Core development tools for Debian 13
    scripts:
      - install-git-gh
      - install-bun
```

---

## Validation Errors

The following conditions cause Scriptor to exit with a non-zero code and print an error. Validation runs at parse time, before the user is asked to select scripts.

| Condition | Error |
|---|---|
| YAML syntax error | Fatal parse error with line/column |
| Missing required field (`id`, `name`, `description`, `os`, `script`) | Zod schema error identifying the field and entry index |
| Missing required `os` sub-field (`name` or `arch`) | Zod schema error identifying the field and entry index |
| `os.arch` value is not `x64` or `arm` | Zod enum error |
| Duplicate `id` values in the `scripts` array | Custom validation error identifying the duplicate `id` |
| Duplicate `id` values within a script's `inputs` array | Custom validation error identifying the duplicate `id` |
| Group `scripts` references a script `id` that does not exist in the manifest | Custom validation error identifying the group `id` and the invalid script reference |
| Duplicate group `id` values | Custom validation error identifying the duplicate group `id` |
| `dependencies` references an `id` not available for the current host | `MissingDependencyError` at dependency resolution time |
| `dependencies` forms a cycle | `CircularDependencyError` with the cycle path in the message |
| `run_if` references an `id` not present in the manifest's `scripts` array | Custom validation error identifying the offending script `id` and the invalid `run_if` reference |
