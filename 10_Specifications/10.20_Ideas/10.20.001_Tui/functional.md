# Scriptor TUI — Functional Specification (Next Generation)

> Defines the intended behavior of the next version of the `tui/` workspace.
> Based on `spec/asbuilt/functional.md`, cleaned up and extended with new features.
> Primary sources: as-built analysis + design review session (March 2026).

---

## Table of Contents

1. [Overview](#1-overview)
2. [CLI Interface & Configuration](#2-cli-interface--configuration)
3. [Host Detection](#3-host-detection)
4. [Startup & Manifest Fetching](#4-startup--manifest-fetching)
5. [Screen Reference](#5-screen-reference)
   - [Persistent UI Elements](#51-persistent-ui-elements)
   - [Script List Screen](#52-script-list-screen)
   - [Input Collection Screen](#53-input-collection-screen)
   - [Confirmation Screen](#54-confirmation-screen)
   - [Elevation Screen](#55-elevation-screen)
   - [Fetch Screen](#56-fetch-screen)
   - [Execution Output](#57-execution-output)
6. [App State Machine](#6-app-state-machine)
7. [Manifest Format (scriptor.yaml)](#7-manifest-format-scriptoryaml)
8. [Script Ordering & Dependencies](#8-script-ordering--dependencies)
9. [Script Execution Pipeline](#9-script-execution-pipeline)
10. [Input System](#10-input-system)
11. [Installed-Items & `creates`](#11-installed-items--creates)
12. [Elevation & Privilege Management](#12-elevation--privilege-management)
13. [Caching & Persistence](#13-caching--persistence)
14. [OAuth Flow](#14-oauth-flow)
15. [Self-Update](#15-self-update)
16. [Data Types Reference](#16-data-types-reference)

---

## 1. Overview

Scriptor is a CLI tool that fetches and runs host-specific setup scripts from a GitHub repository. It:

1. Detects the host platform, architecture, and (on Linux) distribution
2. Fetches `scriptor.yaml` and associated scripts from GitHub (with caching and offline fallback)
3. Checks installed status of scripts by evaluating `creates` paths
4. Presents a filtered, interactive TUI for selecting and executing scripts — organized into collapsible groups
5. Resolves dependencies between scripts and orders them topologically
6. Collects user inputs required by scripts
7. Validates elevation credentials (sudo / admin) as needed
8. Exits the TUI, then executes scripts sequentially streaming output directly to stdout
9. Passes a colon-separated list of already-installed script IDs as the final positional argument to each script

**Entrypoint**: `tui/src/index.ts`
**Top-level React component**: `tui/src/tui/App.tsx`
**Default repository**: `beolson/Scriptor`

---

## 2. CLI Interface & Configuration

### 2.1 Command-Line Options

| Flag | Format | Description |
|------|--------|-------------|
| `--repo` | `owner/repo` | Override the GitHub repository to fetch scripts from |

**Validation**: `--repo` must contain exactly one `/` with non-empty parts on each side. Invalid formats throw `InvalidArgumentError` immediately.

### 2.2 Configuration File

**Location**: `~/.scriptor/config` (YAML format)

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `repo` | string | Persisted repository override (owner/repo format) |

**Priority order** (highest to lowest):
1. `--repo` CLI flag (also persisted to config on use)
2. `repo` field in `~/.scriptor/config`
3. Default: `beolson/Scriptor`

**Behavior**: Config is read silently — missing file, corrupt YAML, or non-object values all fall back to an empty config `{}` with no error.

### 2.3 TTY Guard

Scriptor checks `process.stdin.isTTY` before rendering. If stdin is not a TTY (e.g., piped input), it writes to stderr and exits with code 1:

```
[scriptor] ERROR: Scriptor requires an interactive terminal.
stdin is not a TTY — run Scriptor directly in a terminal, not piped.
```

---

## 3. Host Detection

Scriptor detects the following at startup:

| Property | Detection Method |
|----------|--------------------|
| `platform` | `process.platform` mapped: `win32→windows`, `darwin→mac`, `linux→linux` |
| `arch` | `process.arch` mapped: `x64/ia32→x86`, `arm64/arm→arm` |
| `distro` | Linux only: `NAME` field from `/etc/os-release` |
| `version` | Linux only: `VERSION_ID` field from `/etc/os-release` |
| `isAdmin` | Windows only: spawns `net session`; exit 0 = admin |

**Linux distro detection**: reads `/etc/os-release`, parses `NAME` and `VERSION_ID` (quoted values are unquoted). If the file is missing or unreadable, `distro` and `version` are absent, and all Linux scripts are filtered out.

**Windows admin check**: started in background immediately at launch (before TUI renders), so the result is ready by the time the user reaches the Confirmation screen.

**Header display format**:
- Linux: `[linux / x86 / Debian GNU/Linux 13]`
- Windows/Mac: `[windows / x86]`

---

## 4. Startup & Manifest Fetching

The startup sequence is handled by `tui/src/startup/startup.ts` and emits typed `StartupEvent` objects to the Fetch Screen.

### 4.1 Startup Sequence

1. **Check for local mode**: if `scriptor.yaml` exists in the current directory or a parent, emit `local-mode` and load from disk (no network).

2. **Check for update**: compare installed binary version against latest GitHub release. If a newer version exists, show Update screen before proceeding.

3. **Get latest commit hash** from GitHub API (`/repos/{repo}/commits?per_page=1`).
   - On 401/403: trigger OAuth device flow, then retry.
   - On network failure: emit `offline-warning`, fall back to cache.

4. **Check cache freshness**: compare stored commit hash to latest.
   - If fresh (hashes match): load manifest + scripts from `~/.scriptor/cache/`.
   - If stale: proceed to step 5.

5. **Download manifest**: fetch `scriptor.yaml` from GitHub.
   - On 404: emit `manifest-error`, fall back to cache or fail.
   - On 401/403: retry OAuth, then fall back.
   - On success: parse to get script file paths.

6. **Download scripts**: for each script path in the manifest:
   - Emit `fetching-script` with 1-based index and total count.
   - On fetch failure: emit `script-error`, attempt to use cached copy.

7. **Persist** new commit hash and updated files to cache.

8. **Evaluate installed status**: for every script in the manifest that has a `creates` field, check whether the path exists on disk (with `~` expanded). Scripts whose path exists are marked `installed`.

### 4.2 StartupEvent Types

| Event type | Key properties | Meaning |
|------------|----------------|---------||
| `fetching-manifest` | — | About to download `scriptor.yaml` |
| `fetching-script` | `scriptName`, `scriptPath`, `index` (1-based), `total` | Downloading one script file |
| `offline-warning` | `reason` | Network unavailable; falling back to cache |
| `manifest-error` | `error` | Cannot obtain manifest (network down + no cache) |
| `script-error` | `scriptPath`, `error` | Failed to fetch one script file (non-fatal) |
| `oauth-started` | — | Beginning OAuth device flow |
| `oauth-device-code` | `userCode`, `verificationUri` | Device code ready for user |
| `local-mode` | `cwd` | Using local `scriptor.yaml` |

### 4.3 StartupResult

```typescript
{
  manifestYaml: string;              // Raw YAML string (empty if unavailable)
  scripts: Record<string, string>;   // Repo-relative path → script content
  offline: boolean;                  // true if data came from cache
  installedIds: Set<string>;         // Script IDs whose creates path exists
}
```

---

## 5. Screen Reference

### 5.1 Persistent UI Elements

**Header** — persistent top bar on every screen:
- **Left**: `Scriptor v{version} {hostLabel}` where `hostLabel` is:
  - Linux: `[linux / x86 / Debian GNU/Linux 13]`
  - Non-Linux: `[windows / x86]`
- **Right**: Source label — the GitHub repo URL, or `"local"` in local mode

**Footer** — persistent bottom bar with context-sensitive key binding hints:

| Screen | Bindings shown |
|--------|---------------|
| `fetch` | `↑↓ Navigate`, `Space Select`, `Enter Confirm`, `Q Quit` |
| `script-list` | `↑↓ Navigate`, `Space Select`, `Enter Confirm`, `Q Quit` |
| `input-collection` | *(empty — screen manages its own hints)* |
| `confirmation` | `Y / Enter` (green), `N / Esc` (yellow), `Q Quit` |
| `elevation` | `Esc Back` |
| `update` | *(none during prompt — managed by UpdateScreen)* |

### 5.2 Script List Screen

Multi-select list of scripts available for the detected host, organized into collapsible groups.

**Empty state**: "No scripts available for {hostLabel}" when no scripts match the host.

**Group display**:
```
▶ Developer Tools                    ← collapsed group (cursor on group row)
▼ Security                           ← expanded group
  > [x] Configure SSH                ← focused + user-selected
    [~] Setup SSH Keys (auto)        ← auto-selected dependency
    [✓] Configure SSHD   [installed] ← already installed (creates path exists)
    [ ] Configure TLS Endpoint       ← not selected
  Install System Basics              ← ungrouped script
```

- `▶` / `▼` — collapsed / expanded group header
- `>` prefix (blue) = cursor / focused row
- `[x]` (green) = explicitly selected by user
- `[~]` (cyan, dim) = auto-selected transitive dependency
- `[✓]` (dim) = already installed (creates path exists); shown but skipped by default
- `[ ]` = not selected
- `[installed]` badge (dim) shown on right for installed scripts
- Focused script's `description` shown below the list (dim)

**Group behavior**:
- Pressing `Space` on a group row toggles selection of all scripts in the group
- Groups are expanded by default; `Space` on a group header also toggles collapse
- When a group is collapsed, its selection state is shown on the header row
- Installed scripts are visible within groups but are not selected when selecting a group

**Keyboard**:

| Key | Action |
|-----|--------|
| `↑` | Move cursor up |
| `↓` | Move cursor down |
| `Space` | Toggle selection on focused item (or group) |
| `Enter` | Confirm (requires ≥1 explicit selection; resolves dependencies) |
| `Q` / `Ctrl+C` | Quit |

**Selection behavior**:
- Selecting a script auto-selects all transitive hard `requires` dependencies
- If a dependency is not available on this host, selection is rejected with an inline error (red)
- Inline errors are cleared when the user navigates or re-selects
- Deselecting a script removes it from explicit selection; transitive deps are recalculated
- Already-installed scripts can be explicitly selected to force re-run

**On Enter**: calls `resolveDependencies()` to topologically sort the run set; on error shows inline message; on success advances to input-collection or confirmation.

**Error display**:
- Dependency not available on host: inline red "Cannot select "{name}": dependency "{depId}" is not available for this host"
- Circular dependency: inline red "Circular dependency detected: A → B → A"

### 5.3 Input Collection Screen

Sequentially prompts the user for all inputs across selected scripts, in script declaration order.

**Layout**:
```
Script Name                        ← owning script (dim)
Label: value█                      ← active prompt with cursor
```

**Cancel behavior**: `Q` / `Ctrl+C` shows:
```
Cancel input collection and exit? [y/N]
Press Y to confirm, N to resume.
```
- `Y` → exits cleanly (no scripts run)
- `N` / `Esc` → resumes at current prompt

#### 5.3.1 String Input

- Pre-fills `default` value if declared
- Backspace/Delete remove last character; printable characters append
- **Validation on Enter**: if `required: true` and value is empty/whitespace → error "This field is required."
- Errors clear on any keystroke

#### 5.3.2 Number Input

- Same behavior as String input
- **Additional validation on Enter**: if value is non-empty and not a valid number → "Please enter a valid number."

#### 5.3.3 SSL Certificate Input (Multi-Step)

**Step 1 — URL entry**:
- Prompt: `{label}: {input}█`
- Accepts: `host`, `host:port`, or `https://host/path` (port defaults to 443)
- `Enter` with non-empty value → advances to Step 2

**Step 2 — Fetching**:
- Display: "Fetching certificate chain…" (dim)
- Connects to `host:port` via TLS; walks chain via AIA URLs (max depth 10; 10 s timeout)
- On error: shows error (red), returns to Step 1
- On success: advances to Step 3

**Step 3 — Certificate selection**:
- Certificates displayed **root-first** (reversed from leaf-first fetch order)
- Role labels: `[site]` (leaf), `[root]` (self-signed root), spaces (intermediates)
- Each row shows: CN + expiry date on focused row
- Navigate with `↑` / `↓`, confirm with `Enter`

**Step 4 — Downloading**:
- Display: "Downloading certificate…" (dim)
- Writes to `download_path` in specified format:
  - **PEM**: base64-encoded DER wrapped with `-----BEGIN/END CERTIFICATE-----` headers, 64 chars/line
  - **DER**: raw binary
- On error: shows error (red), returns to Step 3
- On success: calls `onSubmit(downloadPath, certCN)` where CN is extracted from cert subject

### 5.4 Confirmation Screen

Shows the final ordered execution plan before running.

**Display**:
```
The following scripts will run in order:

  1. Script Name — Description text here
      Input Label: value
  2. Another Script — Description
      Cert Label: /tmp/cert.pem (example.com)

Y / Enter — Run these scripts
N / Esc — Go back to the script list
```

- Script index (dim bold), name (default), description (dim)
- Collected inputs indented below script name: `{label}: {value}`
- SSL-cert inputs: `{label}: {downloadPath} ({certCN})`

**Key bindings**:

| Key | Action |
|-----|--------|
| `Y` / `Enter` | Confirm; proceed to elevation check or execution |
| `N` / `Esc` | Back to script list (selections preserved) |
| `Q` / `Ctrl+C` | Quit |

**Post-confirmation routing**:
1. Any selected script has `requires_elevation: true` → **Elevation Screen**
2. Otherwise → exit TUI, begin execution

### 5.5 Elevation Screen

Validates credentials before execution when any selected script requires elevated privileges. Replaces the separate Sudo Screen and Admin Required Screen.

**Unix (Linux / Mac)**:

| Phase | Display |
|-------|---------|
| `checking` | "Checking sudo credentials…" |
| `prompt` | "Sudo authentication required" + `Password: ****` (masked) |
| `validating` | "Validating…" (yellow) |
| `error` | Error message (red), returns to `prompt` |

Flow:
1. On mount: check `sudo -n -v` (non-interactive)
   - Success → silently call `onValidated()`
   - Failure → transition to `prompt`
2. User types password (asterisks shown), presses `Enter`
3. Validate via `sudo -S -v` (password on stdin)
4. Success → start keepalive, call `onValidated()`
5. Failure → show error (red), return to `prompt`

**Windows**:

| Phase | Display |
|-------|---------|
| `checking` | "Checking administrator privileges…" |
| `not-admin` | "Administrator Privileges Required" + instructions (see below) |

Display when not admin:
```
Administrator Privileges Required
This script requires Administrator privileges.
Scriptor is not currently running as Administrator.

To fix this:
  1. Close Scriptor
  2. Right-click scriptor.exe
  3. Select "Run as administrator"
```

**Key bindings** (both platforms):
- `Esc` — go back to Confirmation Screen
- Unix only: printable characters / Backspace / Delete — password editing
- Unix only: `Enter` — submit password

**On validated (Unix)**: exit TUI, begin execution.

**Error display**:
- Unix: "Sudo validation failed. Please try again." (red) + retry prompt
- Windows: no retry (must relaunch as admin)

### 5.6 Fetch Screen

Displays real-time progress during the startup sequence.

| Condition | Display |
|-----------|---------|
| No event yet | "Connecting to GitHub…" (dim) |
| `fetching-manifest` | "Fetching manifest…" |
| `fetching-script` | "Fetching script {index} of {total}: **{scriptName}**" |
| `script-error` | "Error: failed to fetch script {path}" (red) |
| `manifest-error` | "Error: manifest not found." (red) + reason (dim) |
| `offline-warning` | "Warning: GitHub is unreachable. Falling back to cached scripts." (yellow) + reason (dim) |
| `oauth-started` | "Requesting GitHub device authorization…" |
| `oauth-device-code` | "Open **{verificationUri}** and enter this code:" + `{userCode}` (cyan bold) + "Waiting for authorization…" (dim) |
| `local-mode` (loading) | "Loading from local directory…" |
| Done, local mode | "Local mode: Using scriptor.yaml from {cwd}" (cyan) |
| Done, offline | "Warning: GitHub is unreachable. Running from cached scripts." (yellow) |
| Done, online | "Scripts loaded successfully." (green) |

### 5.7 Execution Output

After the Ink TUI exits, execution streams directly to stdout. No Ink rendering occurs during execution.

**While running**:
```
› Script Name
  output line 1
  output line 2

✓ Script Name
✗ Failed Script (exit code 1)
  last output line
```

**Status icons**:
- `·` (dim) — pending
- `›` (cyan) — running
- `✓` (green) — done
- `✗` (red) — failed (includes exit code)

**After completion**:
- Prints: `\nLog file: {absolutePath}\n`
- Exits process with code 0 (or 1 if any script failed)

---

## 6. App State Machine

```
[mount]
  │
  ├─ Update available?
  │    ├─ Yes → Update screen
  │    │         ├─ User accepts → download → "Please restart Scriptor." → exit
  │    │         └─ User skips → Phase 2
  │    └─ No → Phase 2
  │
  ▼
"fetch"  ← runStartup emits StartupEvents
  │
  └─ fetchDone=true → "script-list"
       │
       └─ User confirms selection
            ├─ Selected scripts have inputs? → "input-collection"
            │         └─ All inputs collected → "confirmation"
            └─ No inputs → "confirmation"
                   │
                   ├─ Any script requires_elevation? → "elevation"
                   │         ├─ Esc → "confirmation"
                   │         └─ Validated → exit Ink → execute (stdout)
                   └─ No elevation needed → exit Ink → execute (stdout)
```

**Global quit**: `Q` / `Ctrl+C` exits at any screen **except** `input-collection` (which shows its own cancel confirmation) and `elevation` (which uses `Esc`).

**Update screen**: shown before `fetch` if a newer binary is available. User can accept (download + exit with restart message) or skip (proceed to fetch).

---

## 7. Manifest Format (scriptor.yaml)

### 7.1 Required Fields (all entries)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier; used for dependency references |
| `name` | string | Human-readable name shown in TUI |
| `description` | string | Shown in script-list below focused item |
| `platform` | `windows` \| `linux` \| `mac` | Target OS |
| `arch` | `x86` \| `arm` | Target architecture |
| `script` | string | Repo-relative path to the script file |

### 7.2 Platform-Specific Required Fields

| Platform | Required | Notes |
|----------|----------|-------|
| `linux` | `distro` (string), `version` (string) | OS distro name + version for host matching |
| `windows` | — | — |
| `mac` | — | — |

### 7.3 Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `group` | string | — | Visual group label in TUI; scripts are grouped and the group is collapsible |
| `requires` | string[] | `[]` | Hard ordering: these script IDs must be in the run set (transitive) |
| `after` | string[] | `[]` | Soft ordering: prefer to run after these if also selected |
| `inputs` | InputDef[] | `[]` | User-provided values required before execution |
| `requires_elevation` | boolean | `false` | Script needs sudo (Unix) or Administrator (Windows) |
| `creates` | string | — | Filesystem path created by this script; used for installed-status detection |

### 7.4 Input Definitions

Each entry in `inputs` is one of:

**String input**:
```yaml
- id: email
  type: string
  label: "Email address"
  required: false        # optional, default: false
  default: ""            # optional
```

**Number input**:
```yaml
- id: retries
  type: number
  label: "Number of retries"
  required: false
  default: 3             # optional, numeric
```

**SSL certificate input**:
```yaml
- id: cert
  type: ssl-cert
  label: "Cert URL"
  required: false
  download_path: /tmp/my-cert.pem   # where to save the cert
  format: PEM                        # PEM or DER
```

### 7.5 Validation Rules

- Duplicate `id` values within a script's `inputs` array are rejected
- `distro` / `version` present on a non-`linux` entry is an error
- `distro` / `version` absent on a `linux` entry is an error
- `requires_elevation` is valid on all platforms; behavior is platform-specific

### 7.6 Full Example Entry

```yaml
- id: configure-git
  name: Configure Git
  description: Sets global git user.name and user.email
  platform: linux
  arch: x86
  distro: Debian GNU/Linux
  version: "13"
  script: scripts/Debian/13/configure-git.sh
  group: Developer Tools
  requires:
    - install-git-gh
  after:
    - install-system-basics
  requires_elevation: false
  creates: ~/.gitconfig
  inputs:
    - id: name
      type: string
      label: Full name
      required: true
    - id: email
      type: string
      label: Email address
      required: true
```

---

## 8. Script Ordering & Dependencies

`resolveDependencies(selected, available)` produces a topologically sorted execution order.

### 8.1 Phase 1 — Collect Run Set (DFS)

Starting from the user-selected script IDs, recursively include all `requires` entries (not `after`).

- Throws `MissingDependencyError` if a dependency ID is not in `available`
- Throws `CircularDependencyError` if a cycle is detected in the `requires` graph
- Result: the complete set of scripts that must run

### 8.2 Phase 2 — Topological Sort (DFS post-order)

Predecessors for each script in the sort:
- All entries in `requires` (hard edges — always applied)
- Entries in `after` that are **also in the run set** (soft edges — only when both scripts are running)

`after` IDs not in the run set are silently ignored.

Result: ordered list where every script's predecessors appear before it.

### 8.3 Soft Ordering Semantics (`after`)

`after` expresses a preference without creating a hard requirement.

- Script B declares `after: [A]`
- If only B is selected: A is NOT auto-selected; B runs alone
- If both A and B are selected: A will appear before B in the execution order

**Use case**: A configuration script that *prefers* to run after a package installer, but is also useful on its own.

**Example**:
```yaml
- id: install-bun
  name: Install Bun
  requires: [install-system-basics]

- id: configure-npm-remote
  name: Configure Custom npm Registry
  after: [install-bun]    # soft: if bun is also selected, run after it
```

When user selects only `configure-npm-remote`:
- Run set: `{ configure-npm-remote }` (no hard deps)
- Execution: `[ configure-npm-remote ]`

When user selects `[install-bun, configure-npm-remote]`:
- Run set: `{ install-system-basics, install-bun, configure-npm-remote }`
- Execution: `[ install-system-basics, install-bun, configure-npm-remote ]`

### 8.4 Error Types

| Error | Trigger | User display |
|-------|---------|-------------|
| `MissingDependencyError` | Dependency ID not in `available` | "Cannot select "{name}": dependency "{depId}" is not available for this host" |
| `CircularDependencyError` | Cycle detected | "Circular dependency detected: A → B → A" |

---

## 9. Script Execution Pipeline

### 9.1 ScriptRunner

`ScriptRunner` executes scripts sequentially after the TUI exits, writing directly to stdout.

**Progress events** (used to drive stdout output):

| Event | Properties | When emitted |
|-------|-----------|-------------|
| `pending` | `scriptId` | Once per script, **before** any script starts |
| `running` | `scriptId` | Immediately before spawning the child process |
| `output` | `scriptId`, `line` | For each non-blank stdout/stderr line |
| `done` | `scriptId` | On exit code 0 |
| `failed` | `scriptId`, `exitCode` | On non-zero exit code |

### 9.2 Execution Steps (per script)

1. Emit `running`
2. Build argument list: user inputs (declaration order) + installed-items string as final arg
3. Write script banner to log file (name + start timestamp)
4. Write collected inputs to log file
5. Spawn child process (platform-specific; see §9.3)
6. Stream stdout/stderr to log file and emit `output` events (one per non-blank line; carriage returns stripped)
7. Flush any remaining buffered output when streams close
8. Write script footer to log file (exit code + end timestamp)
9. Emit `done` (exit 0) or `failed` (non-zero) and halt on failure

### 9.3 Child Process Invocation

**Unix**:
```
sh -c {scriptContent} sh {arg1} {arg2} … {installedArg}
```
Arguments become `$1`, `$2`, … inside the script. The installed-items arg is the final positional.

**Windows**:
1. Write script to a temp `.ps1` file: `{tmpdir}/scriptor-{timestamp}-{random}.ps1`
2. Prepend UTF-8 encoding directives:
   ```powershell
   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
   $OutputEncoding = [System.Text.Encoding]::UTF8
   ```
3. Spawn: `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File {tmpfile} {arg1} {arg2} … {installedArg}`
4. `$args[0]`, `$args[1]`, … are user inputs; the last `$args[N]` is the installed-items string.
5. Delete temp file in `finally` block (best-effort; errors ignored)

### 9.4 Halting on Failure

When a script exits with non-zero status, execution halts immediately. Subsequent scripts are never started.

### 9.5 Return Value

```typescript
{ success: true; logFile: string }
// or
{ success: false; logFile: string; failedScript: ScriptEntry; exitCode: number }
```

---

## 10. Input System

### 10.1 Collection Order

Inputs are collected in a flat queue: all inputs for script 1 (in declaration order), then all inputs for script 2, and so on.

### 10.2 Stored Values

```typescript
type CollectedInput = {
  id: string;
  label: string;
  value: string;     // All types stored as string
  certCN?: string;   // SSL-cert only: certificate Common Name
};

type ScriptInputs = Map<string, CollectedInput[]>;  // script ID → inputs
```

### 10.3 Passing Inputs to Scripts

Inputs are passed as positional arguments in declaration order, followed by the installed-items string as the final argument:

- Unix: `$1`, `$2`, … `$N` (where `$N` is installed-items)
- Windows PowerShell: `$args[0]`, `$args[1]`, … `$args[N-1]` (where the last is installed-items)

For SSL-cert inputs, the `download_path` is passed (the cert has already been downloaded before execution).

### 10.4 Confirmation Display

| Input type | Display format |
|------------|---------------|
| `string` / `number` | `{label}: {value}` |
| `ssl-cert` | `{label}: {downloadPath} ({certCN})` |

---

## 11. Installed-Items & `creates`

### 11.1 `creates` Field

An optional field on any script entry specifying the primary filesystem artifact produced by the script:

```yaml
- id: install-bun
  creates: ~/.bun/bin/bun
```

`~` is expanded to the user's home directory at evaluation time.

### 11.2 Installed Status Detection

At the end of startup (after scripts are loaded), Scriptor checks every `creates` path:
- If the path **exists**: the script is marked `installed`
- If the path **does not exist** or the script has no `creates` field: the script is not marked installed

The set of installed script IDs (`installedIds`) is included in `StartupResult`.

### 11.3 Script List Behavior for Installed Scripts

- Installed scripts are shown in the script list with a `[installed]` badge (dim)
- Installed scripts are **not** auto-selected when selecting a group
- Installed scripts **can** be explicitly selected to force a re-run
- When a group contains only installed scripts, the group header shows all-installed state

### 11.4 Installed-Items Arg

Every script receives the installed-items list as its final positional argument — a colon-separated string of script IDs whose `creates` path exists on the current host.

**Format**: `"install-bun:install-git:configure-git"` (colon-separated, no spaces)

**Empty case**: `""` (empty string) if no scripts have `creates` paths that exist.

**Script usage example** (bash):
```bash
#!/bin/bash
# $1 = user input: cert URL
INSTALLED="$2"   # colon-separated installed IDs

configure_bun_cert() {
  if echo "$INSTALLED" | grep -q "install-bun"; then
    bun config set cafile "$1"
  fi
}

configure_git_cert() {
  if echo "$INSTALLED" | grep -q "install-git"; then
    git config --global http.sslCAInfo "$1"
  fi
}

configure_bun_cert "$1"
configure_git_cert "$1"
```

---

## 12. Elevation & Privilege Management

### 12.1 When Elevation Is Required

Any selected script with `requires_elevation: true` triggers the Elevation Screen after Confirmation.

### 12.2 Unix (Linux / Mac) — Sudo

| Function | Command | Purpose |
|----------|---------|---------||
| `checkSudoCached()` | `sudo -n -v` | Non-interactive check; true if credentials cached |
| `validateSudoWithPassword(pw)` | `sudo -S -v` | Validates password via stdin; returns `{ok, reason?}` |
| `startKeepalive()` | `sudo -v` every 4 min | Prevents credential expiry during long execution |
| `invalidateSudo()` | `sudo -k` | Revokes cached credentials after execution |

**Keepalive**: started after successful validation; `sudo -v` runs every 4 minutes. Cleanup runs in a `finally` block after execution, followed by `invalidateSudo()`.

### 12.3 Windows — Admin Check

- Spawned in background at app launch: `net session` (exit 0 = admin)
- Awaited at the Elevation screen
- If not admin: shows instructions screen; user must relaunch as Administrator

---

## 13. Caching & Persistence

### 13.1 Directory Structure

```
~/.scriptor/
├── cache/
│   ├── commit-hash          ← latest fetched GitHub commit SHA
│   ├── scriptor.yaml        ← cached manifest YAML
│   └── scripts/
│       └── {script-id}      ← raw script content keyed by manifest id
├── config                   ← repo override (YAML)
└── logs/
    └── YYYY-MM-DDTHH-MM-SS.log
```

### 13.2 Cache Invalidation

Cache is considered stale if any of the following are true:
- No stored commit hash
- Stored hash differs from the latest hash from GitHub
- Manifest file missing from cache
- Any required script file missing from cache

If stale, the full manifest and all scripts are re-downloaded.

### 13.3 Offline Fallback

If GitHub is unreachable but a cache exists, Scriptor loads from cache and shows an `offline-warning`. If no cache exists, it shows a `manifest-error` and the script list is empty.

### 13.4 Log Files

**Naming**: `~/.scriptor/logs/YYYY-MM-DDTHH-MM-SS.log` (UTC). Multiple runs in the same second append `-1`, `-2`, … suffix.

**Format per script**:
```
============================================================
Script : {name}
Started: {ISO timestamp}
============================================================
  [input] label={label} id={id} value={value}
{stdout/stderr output lines}
============================================================
Ended    : {ISO timestamp}
Exit code: {code}
============================================================
```

---

## 14. OAuth Flow

Triggered when GitHub returns 401/403 during manifest or commit hash fetch.

### 14.1 Steps

1. **Request device code**: POST to `https://github.com/login/device/code` with `scope: "repo"`
2. **Display code**: emit `oauth-device-code` event (Fetch Screen shows instructions)
3. **Open browser** (non-fatal): platform-specific command (`start`, `open`, `xdg-open`)
4. **Poll for token**: POST to `https://github.com/login/oauth/access_token` at `interval` seconds
   - `authorization_pending` → keep polling
   - `slow_down` → increase poll interval by 5 s
   - `expired_token` / `access_denied` → throw `OAuthError`
   - `access_token` present → return token

### 14.2 Token Handling

- Token lives in memory only; **never written to disk**
- Token is lost on app exit; a new OAuth flow is required next run
- Default OAuth client ID: `Ov23liczBZbFw43X0aFI`
- Default scope: `"repo"`

---

## 15. Self-Update

Triggered when the installed binary version is older than the latest GitHub release.

**Version comparison**: Semver-like, segment-by-segment numeric comparison (leading `v` stripped).

**Asset naming convention**:

| Platform | Arch | Asset name |
|----------|------|------------|
| linux | x86 | `scriptor-linux-x64` |
| linux | arm | `scriptor-linux-arm64` |
| mac | x86 | `scriptor-darwin-x64` |
| mac | arm | `scriptor-darwin-arm64` |
| windows | x86 | `scriptor-windows-x64.exe` |
| windows | arm | `scriptor-windows-arm64.exe` |

**Update screen phases**:

| Phase | Display |
|-------|---------|
| `prompt` | "Update available", `v{current} → v{latest}`, `[Y] Update  [N] Skip` |
| `downloading` | "Downloading {assetName}…" (yellow) |
| `done` | "Update applied. Please restart Scriptor." (green); auto-exits after ~80 ms |
| `error` | Error message (red) + `[N] Skip` |

**Key bindings**:
- `Y` / `y` — start download (in `prompt` or `error` phase)
- `N` / `n` / `Esc` — skip update, proceed to startup

**Update behavior**:
- **Unix/Mac**: download to temp file → `chmod 755` → atomic rename over current binary
- **Windows**: cannot replace a running executable; downloads as `scriptor-new.exe` and prompts user to replace manually
- Update check only available for compiled binaries (skipped in `bun run` dev mode)

---

## 16. Data Types Reference

### HostInfo

```typescript
interface HostInfo {
  platform: "windows" | "linux" | "mac";
  arch: "x86" | "arm";
  distro?: string;     // Linux only
  version?: string;    // Linux only
  isAdmin?: boolean;   // Windows only
}
```

### ScriptEntry

```typescript
interface ScriptEntry {
  id: string;
  name: string;
  description: string;
  platform: "windows" | "linux" | "mac";
  arch: "x86" | "arm";
  script: string;              // repo-relative path
  distro?: string;             // Linux only
  version?: string;            // Linux only
  group?: string;              // optional TUI group label
  requires: string[];          // hard-ordered prerequisites
  after: string[];             // soft-ordered preferences
  inputs: InputDef[];
  requires_elevation: boolean; // needs sudo (Unix) or Admin (Windows)
  creates?: string;            // path created by this script; used for installed detection
}
```

### InputDef

```typescript
type InputDef =
  | { id: string; type: "string"; label: string; required?: boolean; default?: string }
  | { id: string; type: "number"; label: string; required?: boolean; default?: number }
  | { id: string; type: "ssl-cert"; label: string; required?: boolean; download_path: string; format: "PEM" | "DER" }
```

### StartupEvent

```typescript
type StartupEvent =
  | { type: "fetching-manifest" }
  | { type: "fetching-script"; scriptName: string; scriptPath: string; index: number; total: number }
  | { type: "offline-warning"; reason: string }
  | { type: "manifest-error"; error: string }
  | { type: "script-error"; scriptPath: string; error: string }
  | { type: "oauth-started" }
  | { type: "oauth-device-code"; userCode: string; verificationUri: string }
  | { type: "local-mode"; cwd: string }
```

### StartupResult

```typescript
interface StartupResult {
  manifestYaml: string;
  scripts: Record<string, string>;
  offline: boolean;
  installedIds: Set<string>;         // IDs of scripts whose creates path exists
}
```

### ProgressEvent

```typescript
type ProgressEvent =
  | { status: "pending"; scriptId: string }
  | { status: "running"; scriptId: string }
  | { status: "output"; scriptId: string; line: string }
  | { status: "done"; scriptId: string }
  | { status: "failed"; scriptId: string; exitCode: number }
```

### ScriptRunResult

```typescript
type ScriptRunResult =
  | { success: true; logFile: string }
  | { success: false; logFile: string; failedScript: ScriptEntry; exitCode: number }
```
