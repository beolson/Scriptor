# Scriptor TUI — Product Requirements Document

| Field | Value |
|-------|-------|
| Product | Scriptor TUI |
| Version | 0.9.0 |
| Status | As-built |
| Date | 2026-03-28 |
| Audience | Developers |

---

## 1. Overview

Scriptor is a command-line tool that helps developers set up new machines by fetching and running host-specific setup scripts from a GitHub repository. It detects the host OS, version, and architecture, then presents an interactive terminal UI where the user selects which scripts to run. Selected scripts are executed sequentially with automatic dependency ordering, input collection, and privilege elevation handling.

The tool supports a multi-repo deployment model. Different teams or organizations maintain their own script repositories, and users switch between them via a CLI flag or persistent configuration. Scripts are defined in a central YAML manifest alongside the script files themselves.

Scriptor compiles to a standalone binary with no runtime dependencies. Six platform-specific binaries are produced (Linux, macOS, and Windows, each for x64 and arm64). The binary self-updates by comparing its version against the latest GitHub release.

---

## 2. User Flow

A complete Scriptor session proceeds through five phases:

### Phase 1: Startup

The user launches the binary. Scriptor verifies that stdin is an interactive terminal (TTY), then detects the host OS name, version, and architecture. It resolves which GitHub repository to use — the CLI `--repo` flag takes priority, followed by the persisted config, falling back to a default repository. If a local cache exists, the user is prompted to check for updates; otherwise Scriptor fetches the manifest and scripts immediately. Private repositories trigger an OAuth device flow, with the resulting token stored in the platform keychain.

### Phase 2: Script Selection

The manifest is parsed, validated, and filtered to only scripts matching the detected host. If no scripts match, Scriptor displays a warning and exits. Each script's installed status is checked by testing whether the path declared in its `creates` field exists on disk. If the manifest defines groups, they appear in the main menu. The user either selects a group (which queues all non-installed member scripts and applies group-level dependencies) or chooses "Individual scripts" to multi-select from the full list. Dependencies are resolved into a topological execution order.

### Phase 3: Pre-Execution

If any selected script declares inputs, Scriptor collects them interactively — text prompts for strings and numbers, a multi-step flow for SSL certificates. An execution plan is displayed showing the ordered scripts and collected inputs. The user confirms or cancels. On Windows, if any script requires elevation, Scriptor checks for administrator privileges and exits with instructions if the session is not elevated.

### Phase 4: Execution

On Unix, if any script requires elevation, Scriptor prompts for the sudo password via a raw TTY input with masked characters. A keepalive timer refreshes sudo credentials every four minutes. Scripts run sequentially in dependency order. Each script receives its collected inputs as positional arguments plus a colon-delimited list of already-installed script IDs. Stdout and stderr are inherited so script output appears directly in the terminal. Execution stops on the first non-zero exit code.

### Phase 5: Exit

Scriptor exits with code 0 on success or code 1 on failure. The failed script and its exit code are reported to the user.

---

## 3. Host Detection

Scriptor detects three properties of the host machine:

| Property | Values | Source |
|----------|--------|--------|
| OS Name | Free-text string (e.g., `Debian GNU/Linux`, `mac`, `windows`) | For macOS: `mac`. For Windows: `windows`. For Linux: the `NAME` field from `/etc/os-release`. |
| OS Version | Free-text string (e.g., `13`, `22.04`) | Linux only. Parsed from the `VERSION_ID` field in `/etc/os-release`. Absent for macOS and Windows. |
| Architecture | `x64`, `arm` | Mapped from the CPU architecture (`arm64` and `arm` to `arm`, all others to `x64`) |

If `/etc/os-release` is missing or unreadable on Linux, Scriptor continues without OS name and version information, meaning no Linux script entries will match.

---

## 4. Manifest System

The manifest is a YAML file named `scriptor.yaml` located at the root of the script repository. It is a YAML object with two top-level keys: `scripts` (required array of script entries) and `groups` (optional array of group entries). All entries are validated at parse time.

### Script Entry Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | — | Unique identifier for the script. Duplicate IDs cause a fatal parse error. |
| `name` | string | yes | — | Human-readable display name |
| `description` | string | yes | — | Short description shown in the selection UI |
| `os` | object | yes | — | Target OS specification. Contains `name`, optional `version`, and `arch`. |
| `os.name` | string | yes | — | OS name. For Linux: `NAME` from `/etc/os-release` (e.g. `Debian GNU/Linux`). For macOS: `mac`. For Windows: `windows`. |
| `os.version` | string | no | — | OS version. For Linux: `VERSION_ID` from `/etc/os-release`. If omitted, matches any version of the named OS. |
| `os.arch` | `x64` \| `arm` | yes | — | Target CPU architecture. |
| `script` | string | yes | — | Relative path to the script file (from the `scripts/` directory) |
| `dependencies` | string[] | no | `[]` | IDs of scripts that must run before this one (hard dependencies) |
| `run_after` | string[] | no | `[]` | IDs of scripts that should run before this one if they are also selected (soft ordering) |
| `run_if` | string \| string[] | no | — | One or more script IDs. When set, this script is only added to the run set if all referenced scripts are considered present — either selected by the user this session or already installed on the host (via `creates`). Applies to both individual and group selection. |
| `requires_elevation` | boolean | no | `false` | Whether the script needs sudo (Unix) or administrator (Windows) privileges |
| `creates` | string | no | — | A filesystem path. If this path exists, the script is considered already installed. Supports `~` for the home directory. |
| `inputs` | InputDef[] | no | `[]` | Inputs to collect from the user before execution |

### Group Entry Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | — | Unique group identifier across the manifest |
| `name` | string | yes | — | Display name shown in the TUI main menu |
| `description` | string | yes | — | One-sentence description of the group |
| `scripts` | string[] | yes | — | Script IDs belonging to this group. Each must reference a valid script `id`. A script may appear in multiple groups. |

### Input Definition Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | — | Unique identifier for the input (used for deduplication across scripts) |
| `type` | `string` \| `number` \| `ssl-cert` | yes | — | Input type, determines the collection UI |
| `label` | string | yes | — | Prompt text shown to the user |
| `required` | boolean | no | `false` | Whether the input must be non-empty |
| `default` | string | no | — | Pre-filled default value |
| `download_path` | string | ssl-cert only | — | Absolute path where the downloaded certificate will be written |
| `format` | `pem` \| `PEM` \| `der` \| `DER` | ssl-cert only | — | Certificate encoding format. Case-insensitive. Defaults to PEM. |

Additional passthrough fields are permitted on input definitions to support type-specific configuration.

### Validation Rules

- Every script entry must have a unique `id`. Duplicate script IDs cause a fatal parse error before the user is asked to select scripts.
- Input IDs must be unique within a single script entry.
- Every group entry must have a unique `id`.
- Every script ID referenced in a group's `scripts` array must exist in the `scripts` array.
- The manifest is rejected entirely if any entry fails validation. Scriptor logs the validation errors and exits.

---

## 5. Script Filtering

After parsing, the manifest is filtered to match the detected host using each entry's `os` field:

- **`os.name`**: Exact string match required against the detected host OS name.
- **`os.version`**: If specified on the entry, exact string match against the detected host OS version. If omitted on the entry, it matches any host version for the given OS name.
- **`os.arch`**: Exact match required against the detected host architecture.

If `/etc/os-release` is unreadable on Linux, all Linux entries are excluded (name and version cannot be determined).

---

## 6. Script Selection

The selection screen presents two modes:

### Group Mode

If the manifest defines group entries, the main menu lists each group as a selectable option (in manifest order). Selecting a group adds all of the group's member scripts to the candidate pool. Groups whose member scripts have all been filtered out (none match the current host) are not shown.

After the candidate set is assembled (from group member scripts or individual picks), Scriptor evaluates `run_if` conditions before proceeding to dependency resolution. Any script whose `run_if` IDs are not all present is silently removed. This applies identically in both group and individual selection modes.

### Individual Mode

Selecting "Individual scripts" from the main menu shows a multi-select list of all filtered scripts. Each script displays its name and description. Already-installed scripts are labeled `[installed]` with a hint showing the `creates` path.

### Installed Status

A script is considered installed if its `creates` field is defined and the specified path exists on the filesystem. The `~` prefix is expanded to the user's home directory before checking. Scripts without a `creates` field are never marked as installed.

### Main Menu Structure

The main menu presents options in this order:
1. Each group name (from the `groups` array, in manifest order, filtered to groups with at least one host-matching script)
2. "Individual scripts"
3. "Settings" (currently displays "Settings coming soon." and returns to the menu)

---

## 7. Dependency Resolution

After the user selects scripts (individually or via a group), Scriptor resolves dependencies into a topological execution order using a three-phase process:

**Phase 0 — `run_if` Filtering**: Scripts whose `run_if` condition is not satisfied are removed from the candidate set. A condition is satisfied when every script ID listed in `run_if` is **present** — meaning it is either (a) in the current candidate set — selected by the user this session — or (b) already installed on the host (its `creates` path exists on disk). Scripts without a `creates` field can only satisfy the condition via (a). This pass runs once; removals do not trigger re-evaluation. Scripts removed here do not pull in their hard dependencies.

**Phase 1 — Transitive Run Set**: Starting from the filtered candidate set, recursively follow all hard `dependencies` to build the complete set of scripts that must run.

**Phase 2 — Topological Sort**: Perform a post-order DFS over the run set, following both hard dependencies and soft `run_after` constraints (but only when the referenced script is already in the run set). This produces a valid execution order where every script runs after its dependencies.

### Error Conditions

| Error | Condition | Behavior |
|-------|-----------|----------|
| Missing dependency | A script declares a dependency ID that does not exist in the filtered manifest | Fatal: log error, exit 1 |
| Circular dependency | The dependency graph contains a cycle | Fatal: log error, exit 1 |
| Invalid `run_if` reference | A script's `run_if` array contains an ID that does not exist anywhere in the manifest | Fatal: log error, exit 1 |

---

## 8. Input Collection

If any selected script declares inputs, Scriptor collects them before execution. Inputs are processed in declaration order. If multiple scripts declare an input with the same `id`, the input is collected once (first occurrence wins).

### String and Number Inputs

Presented as a text prompt with the input's `label`. Number inputs are validated to contain a valid numeric value. Required inputs are validated to be non-empty. A default value is pre-filled if defined.

### SSL Certificate Input

The ssl-cert input type triggers a four-step interactive flow:

1. **URL Entry**: The user enters a hostname, optionally with a port (default 443). Accepted formats: `host`, `host:port`, `https://host`.
2. **Chain Fetch**: Scriptor connects via TLS (with certificate verification disabled) to retrieve the leaf certificate, then walks the Authority Information Access (AIA) extensions to fetch the full chain up to the root. Maximum 10 certificates, 10-second timeout per fetch.
3. **Certificate Selection**: The chain is displayed root-first. Each certificate shows its Common Name, expiration date, and role label (`[site]` for the leaf, `[root]` for self-signed, blank for intermediates). The user selects which certificate to download.
4. **Download**: The selected certificate is written to disk in PEM or DER format. The download path and Common Name are stored as the collected input.

If the chain fetch fails, the user is returned to the URL entry step to try again.

### Cancellation

Pressing Escape or Ctrl+C during any input prompt prints "User canceled." and exits with code 0.

---

## 9. Execution

### Execution Plan Confirmation

Before running scripts, Scriptor displays the execution plan: a numbered list of scripts in execution order, with any non-empty collected inputs shown beneath each script. The user confirms with Y/Enter or cancels with N/Esc (which exits with code 0).

### Script Invocation

Scripts run sequentially in dependency order. Each script's name is announced via `log.step()` before execution. The invocation method depends on the platform:

| Platform | Method |
|----------|--------|
| Unix (Linux, macOS) | `sh -c <script-content> sh <args...>` — the script content is passed as the command string to `sh`. Stdout is piped back to Scriptor. |
| Windows | The script content is written to a temporary `.ps1` file (with UTF-8 BOM), then executed via `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File <temp-file> <args...>`. Stdout is piped back to Scriptor. The temp file is deleted after execution. |

### Argument Passing

Each script receives positional arguments in this order:
1. For each declared input (in declaration order): the collected value, or an empty string if no value was collected.
2. A final argument containing the IDs of all scripts already marked as installed, joined with colons (e.g., `install-git:install-node`). If no scripts are installed, this is an empty string.

### Output and Failure

Script stdout is piped through `@clack/prompts` `stream.step()`, which displays each line with a `│  ` prefix. ANSI color codes in script output pass through intact. Stderr is inherited by the parent process and appears directly in the terminal without formatting. Stdin is inherited so scripts can read interactive input if needed.

If a script exits with a non-zero code, execution stops immediately. The failed script name and exit code are reported via `log.error()`. Subsequent scripts do not run. Successful completion of each script is reported via `log.success()`.

---

## 10. Sudo and Elevation

### Unix (Linux, macOS)

If any selected script has `requires_elevation: true`, Scriptor handles sudo authentication before execution begins:

1. **Non-interactive check**: A spinner displays while Scriptor runs `sudo -n -v`. If this succeeds (exit 0), sudo credentials are already cached — the spinner stops with a cached-credentials message and no prompt is shown.
2. **Password prompt**: If the non-interactive check fails, the spinner stops and Scriptor calls `@clack/prompts` `password()` with `mask: "*"`. The password is submitted to `sudo -S -v` via piped stdin. On success, `log.success()` confirms validation. On failure, `log.error()` shows an error and the prompt repeats (unlimited retries). Pressing Escape or Ctrl+C cancels via `isCancel()` and exits with code 0.
3. **Keepalive**: During script execution, a background timer runs `sudo -v` every four minutes to prevent credential expiry. When execution completes, the timer is stopped and `sudo -k` invalidates the cached credentials.

### Windows

If any selected script has `requires_elevation: true`, Scriptor runs a pre-flight check by spawning `net session`. If the exit code is non-zero (not running as administrator), Scriptor displays a message instructing the user to relaunch from an elevated terminal, then exits with code 1.

---

## 11. GitHub Integration

### Manifest and Script Fetching

Scriptor uses the GitHub Contents API to fetch files from the script repository. The manifest is fetched from `scriptor.yaml` at the repository root. Individual script files are fetched by their path within the repository. Both requests use the `application/vnd.github.raw+json` accept header to retrieve raw file content.

If an authentication token is available, it is sent as a Bearer token in the Authorization header.

### Authentication

For private repositories, Scriptor uses the GitHub OAuth device flow:

1. A 401 or 403 response (or a 404 without a token, which heuristically indicates a private repo) triggers the OAuth flow.
2. The user is shown a device code and a verification URL to enter it in their browser.
3. Scriptor polls until the user authorizes the application.
4. The resulting token is stored in the platform keychain for future sessions.

Script fetches are retried up to 3 times on failure.

### Release API

The latest release endpoint for the Scriptor repository is used to check for binary updates and to download release assets.

---

## 12. Caching

Scriptor caches the manifest and all host-relevant scripts locally at `~/.scriptor/cache/<owner>/<repo>/`.

### Cache Structure

```
~/.scriptor/cache/<owner>/<repo>/
  manifest.yaml
  scripts/
    <platform>/<distro>/<script-file>
```

### Cache Behavior

- **Cache miss**: Scriptor fetches from GitHub and writes the cache.
- **Cache hit**: Scriptor prompts the user: "Check for updates?" If yes, it fetches and overwrites the cache. If no, it uses the cached manifest.
- **Fetch failure with cache**: If the fetch fails but a cache exists, Scriptor falls back to the cached data.
- **No expiration**: The cache does not expire automatically. Updates are user-driven.

---

## 13. Configuration

Scriptor stores user configuration at `~/.scriptor/config` in YAML format.

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string (optional) | The default repository in `owner/name` format |

### Repo Resolution Priority

1. `--repo` CLI flag (if provided)
2. `repo` field in `~/.scriptor/config` (if present)
3. Default repository: `beolson/Scriptor`

If the CLI flag specifies a different repository than the one stored in config, Scriptor prompts the user to confirm the switch. On confirmation, the new repository is persisted to config.

### Resilience

If the config file is missing, contains invalid YAML, or fails schema validation, Scriptor treats it as an empty configuration and continues normally.

---

## 14. Keychain

Scriptor stores the GitHub OAuth token in the platform's native credential store:

| Platform | Backend |
|----------|---------|
| macOS | Keychain via the `security` CLI |
| Linux | libsecret via the `secret-tool` CLI |
| Windows | Credential Manager via PowerShell |

The token is stored under the key `scriptor-github-token`.

If the keychain tool is not installed or the operation fails, Scriptor silently continues without persisting the token. The user will be prompted to re-authenticate on the next session.

---

## 15. Self-Update

Scriptor checks for updates by comparing its compiled version against the latest GitHub release tag using semantic versioning. If a newer version is available:

1. The new binary is downloaded to `~/.scriptor/scriptor.new`.
2. The new binary is made executable (Unix).
3. The new binary is spawned with `--apply-update <current-binary-path>`, then the current process exits.
4. The new binary renames itself over the old binary path and relaunches with no flags.

This produces a zero-downtime update with no manual file management.

---

## 16. Local Mode

The `--repo=local` flag switches Scriptor to local mode for script development and testing:

- The manifest is read from `scriptor.yaml` at the root of the current git repository (found via `git rev-parse --show-toplevel`).
- Scripts are read from the local filesystem during execution (not from a cache or GitHub).
- Cache, OAuth, keychain, and update checks are all bypassed.

If the current directory is not inside a git repository or the manifest file is missing, Scriptor exits with an error.

---

## 17. CLI Interface

### Command-Line Flags

| Flag | Description |
|------|-------------|
| `--repo <owner/repo\|local>` | GitHub repository to use, or `local` for local mode |
| `--apply-update <old-path>` | Internal flag used during self-update (hidden from help) |

### TTY Requirement

Scriptor requires an interactive terminal. If stdin is not a TTY (e.g., piped input or a CI environment), Scriptor exits with an error message.

### Terminal UI

All user interaction uses the `@clack/prompts` library, providing:
- **Confirm**: Yes/no prompts (repo switch, update check, execution plan)
- **Select**: Single-choice menus (main menu, certificate selection)
- **Multi-select**: Multiple-choice lists (individual script selection)
- **Text**: Free-text input (string/number inputs, SSL hostname)
- **Password**: Masked input (sudo password collection, `mask: "*"`)
- **Spinner**: Progress indicators (fetching manifest, downloading certs, sudo credential check)
- **Stream**: Formatted output display (`stream.step()` for script stdout with `│  ` prefix, ANSI passthrough)
- **Log**: Status messages (`log.step()` for script start, `log.success()` / `log.error()` for results)
- **Note**: Informational displays (OAuth instructions)

Pressing Escape or Ctrl+C at any prompt cancels the operation and exits with code 0.

---

## 18. Build and Distribution

Scriptor is compiled to a standalone binary using Bun's `--compile` flag. The version string is injected at build time. No runtime dependencies are required.

### Binary Targets

| Platform | Architecture | Binary Name |
|----------|-------------|-------------|
| Linux | x64 | `scriptor-linux-x64` |
| Linux | arm64 | `scriptor-linux-arm64` |
| macOS | x64 | `scriptor-darwin-x64` |
| macOS | arm64 | `scriptor-darwin-arm64` |
| Windows | x64 | `scriptor-windows-x64.exe` |
| Windows | arm64 | `scriptor-windows-arm64.exe` |

### Release Process

Releases are managed with Changesets. Merging a version PR to the main branch triggers the release workflow, which builds all six binaries and attaches them to a GitHub Release. The documentation site is deployed to GitHub Pages in the same workflow.

---

## 19. Data Model Reference

### HostInfo

Represents the detected host machine.

| Field | Type | Description |
|-------|------|-------------|
| `osName` | string | Detected OS name (e.g. `"Debian GNU/Linux"`, `"mac"`, `"windows"`) |
| `osVersion` | string (optional) | Detected OS version. Present on Linux when `/etc/os-release` is readable. Absent on macOS and Windows. |
| `arch` | `"x64"` \| `"arm"` | Detected architecture |

### Os

The target OS specification on a script entry.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | OS name. For Linux: `NAME` from `/etc/os-release`. For macOS: `"mac"`. For Windows: `"windows"`. |
| `version` | string (optional) | OS version. If omitted, matches any version of the named OS. |
| `arch` | `"x64"` \| `"arm"` | Target CPU architecture. |

### Repo

Identifies a GitHub repository.

| Field | Type | Description |
|-------|------|-------------|
| `owner` | string | Repository owner |
| `name` | string | Repository name |

### Config

Persisted user configuration.

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string (optional) | Default repository in `owner/name` format |

### ScriptEntry

A single script in the `scripts` array. See [Section 4: Manifest System](#4-manifest-system) for the full field reference.

### GroupEntry

A logical group of scripts in the `groups` array. See [Section 4: Manifest System](#4-manifest-system) for the full field reference.

### InputDef

An input declaration on a script. See [Section 4: Manifest System](#4-manifest-system) for the full field reference.

### CollectedInput

A user-provided input value.

| Field | Type | Description |
|-------|------|-------------|
| `value` | string | The collected value |
| `certCN` | string (optional) | Common Name of the selected certificate (ssl-cert inputs only) |

### ScriptInputs

`Map<string, CollectedInput>` — maps input IDs to their collected values.

### ManifestResult

The output of the startup phase.

| Field | Type | Description |
|-------|------|-------------|
| `repo` | Repo | The resolved repository |
| `manifest` | string | Raw manifest YAML |
| `host` | HostInfo | Detected host information |
| `localRoot` | string (optional) | Git root path (local mode only) |

### ScriptSelectionResult / PreExecutionResult

The output of the selection and pre-execution phases (same shape).

| Field | Type | Description |
|-------|------|-------------|
| `orderedScripts` | ScriptEntry[] | Scripts in topological execution order |
| `inputs` | ScriptInputs | Collected input values |
| `installedIds` | Set\<string\> | IDs of scripts already installed on the host |

### ScriptRunResult

The output of the execution phase.

| Variant | Fields | Description |
|---------|--------|-------------|
| Success | `{ success: true }` | All scripts completed with exit code 0 |
| Failure | `{ success: false, failedScript: ScriptEntry, exitCode: number }` | A script failed; includes which script and its exit code |

---

## 20. Error Handling Summary

| Error | Condition | Behavior |
|-------|-----------|----------|
| TTY guard | stdin is not an interactive terminal | Log error, exit 1 |
| YAML parse error | Manifest contains invalid YAML | Log error, exit 1 |
| Schema validation | Manifest entries fail Zod validation | Log all errors, exit 1 |
| Duplicate script ID | Two or more entries in the `scripts` array share the same `id` | Log error, exit 1 |
| Invalid group script ref | A group's `scripts` array references an `id` not in the manifest | Log error, exit 1 |
| Invalid `run_if` reference | A script's `run_if` references an `id` not present in the manifest | Log error, exit 1 |
| Duplicate group ID | Two or more groups share the same `id` | Log error, exit 1 |
| Missing dependency | A declared dependency ID (script-level or group-level) is not in the filtered manifest | Log error, exit 1 |
| Circular dependency | The dependency graph contains a cycle | Log error, exit 1 |
| Auth required | GitHub returns 401/403, or 404 without a token | Trigger OAuth device flow, retry |
| Network error | GitHub API call fails for non-auth reasons | If cache exists, fall back to cache. Otherwise, log error and exit 1 |
| SSL fetch error | TLS connection or AIA fetch fails during ssl-cert input | Show error, return user to URL entry |
| Local repo error | `--repo=local` used outside a git repo, or manifest missing | Log error, exit 1 |
| Windows elevation | Selected scripts require elevation but session is not admin | Show instructions, exit 1 |
| Script failure | A script exits with non-zero code | Stop execution, report failed script and exit code, exit 1 |
| User cancellation | User presses Esc or Ctrl+C at any prompt | Print "User canceled.", exit 0 |
