# Scriptor - Phase 1 Functional Requirements
## TUI for Developer Tool Script Management

---

## 1. Product Overview

Scriptor is a Terminal User Interface (TUI) application that enables developers to discover and run curated scripts on their local systems. Scripts support installing and managing developer-centric tools (e.g., Docker, Bun.js, system certificates). Phase 1 focuses exclusively on building the TUI; scripts themselves will be developed in a later phase. Test scripts will be created for verification purposes during Phase 1.

---

## 2. Platform Support

### Target Platforms
- **Windows** (x86, ARM)
- **Linux** (x86, ARM) — categorized by OS distribution and version
- **macOS** (x86, ARM)

### Host Detection
- Platform details (OS, architecture, Linux distro/version) are **detected automatically** at startup via system calls.
- No user interaction or configuration is required.

### Compiled Artifact
- The TUI will be compiled into a **single executable per platform/architecture combination**.

### CLI Parameters
| Parameter | Description |
|---|---|
| `--repo <owner/repo>` | Override the default repository using `owner/repo` shorthand (github.com assumed); persisted for future runs |
| `--token <pat>` | GitHub Personal Access Token for private repositories; persisted with repo URL |

### Host Info Display
- The TUI displays detected host information (OS, architecture, and for Linux: distro + version) persistently in the **header** of the UI.

---

## 3. Script Repository

### Source
- Scripts are hosted in a **GitHub repository**.
- On startup, the TUI connects to the repository via the **GitHub REST API** to pull the latest scripts applicable to the host machine.

### Metadata File
- The repository root contains a **`scriptor.yaml`** metadata file listing all available scripts and their target platforms.

### Repository Configuration
- A **default repository** is hardcoded into the executable.
- Users may specify an **alternative repository** via a **CLI parameter** at startup.
- If a custom repository is provided, it is **persisted** to `~/.scriptor/config` for future runs.

### Startup Fetch & Progress Display
- Scripts and metadata are fetched **once at startup** — there is no in-app refresh.
- During the fetch, the TUI displays a **step-by-step progress sequence**, including:
  - `Fetching manifest...`
  - `Fetching script 1 of N: <script name>`
  - Error states, e.g. `Error: manifest not found`, `Error: failed to fetch script <name>`
- On any fetch error, the TUI falls back to the local cache with an appropriate error message.

### Caching & Offline Mode
- Scripts and metadata are **cached locally** in `~/.scriptor/cache/` after each successful fetch.
- If GitHub is unreachable at startup, the TUI loads from cache and displays a **warning banner**.
- Cached scripts remain **executable** in offline mode.

### Authentication
- The default repository is **public**; no authentication is required for public repos.
- Users may optionally supply a **GitHub Personal Access Token (PAT)** to access private repositories.
- The PAT is persisted alongside the custom repository URL.

---

## 3.5 Technology Stack

| Concern | Choice |
|---|---|
| Runtime / Compiler | **Bun.js** — compiles TypeScript to a single executable per platform |
| TUI Framework | **Ink.js** — React-based component model for terminal UIs |
| Language | **TypeScript** |

---

## 4. TUI Layout

### Persistent UI Elements
- **Header:** Displays detected host information (OS, architecture, distro/version on Linux) and the active repository URL.
- **Footer:** Persistent key binding legend that updates contextually per screen (e.g. `↑↓ Navigate  Space Select  Enter Confirm  Q Quit`).

---

## 4.2 TUI Navigation & Script Selection

- Scripts are presented as a **flat scrollable list**, filtered to the host platform/architecture.
- If no scripts match the host platform, the list area displays an informative **empty state message** (e.g. `"No scripts available for Ubuntu 24.04 ARM"`). The TUI remains open.
- Users may **select multiple scripts** before executing.
- If a selected script has **dependencies** declared in `scriptor.yaml`, those dependencies are **automatically selected** and will run first.
- Execution order respects the dependency graph (dependencies run before dependents).
- If a script's declared dependency is **not available for the host platform**, selection is **blocked** and the TUI displays a clear error identifying the missing dependency.
- Before execution begins, the TUI displays a **confirmation screen** showing the full ordered list of scripts that will run (including auto-selected dependencies). The user must confirm or cancel.
- Scripts execute **sequentially**. If a script fails, execution halts and the TUI reports the failure before proceeding.

---

## 4.3 Script Execution

- The TUI spawns scripts as **child processes** and manages their lifecycle.
- The TUI displays only:
  - **Status messages**: starting, running, finished
  - **Errors**: any non-zero exit codes or stderr output
- **Full stdout/stderr output** is written to a **log file** located in `~/.scriptor/logs/` (platform-appropriate home directory).
- The TUI remains active during and after script execution.
- During execution, the TUI displays a **progress list** of all queued scripts with status icons:
  - Pending (queued, not yet started)
  - Running (spinner animation)
  - Done (checkmark)
  - Failed (X, with error summary)
- After all scripts have finished (or on failure halt), the TUI **exits automatically** and prints the log file path to stdout.
- If the user attempts to quit (`Q` or `Ctrl+C`) while a script is running, the TUI **blocks exit** and displays a warning (e.g. `"A script is running — please wait for it to finish."`). The quit attempt is ignored.
- **Log file naming:** One file per run, named by timestamp (e.g. `2026-02-28T14-32-00.log`), written to `~/.scriptor/logs/`.
- Within a log file, each script's output is separated by a **prominent visual separator** (e.g. a banner line with the script name, start time, and exit code) to make multi-script runs easy to read.

---

## 4.4 Script Types
- Scripts are written in **Bash**, **PowerShell**, or potentially **ZSH**.
- Platform-appropriate script types are surfaced per host OS.

---

## 5. Script Metadata (`scriptor.yaml`)

Each script entry in `scriptor.yaml` contains the following fields:

| Field | Type | Description |
|---|---|---|
| `id` | string (slug) | Logical identifier for the script (e.g. `install-docker`). Multiple entries may share an `id` across different platform variants. Dependencies reference this `id`; the TUI resolves it to the entry matching the host platform. |
| `name` | string | Human-readable display name |
| `description` | string | Short description shown in the TUI |
| `platform` | enum | `windows`, `linux`, or `mac` |
| `arch` | enum | `x86` or `arm` — each script targets exactly one architecture |
| `script` | string | Path to the script file within the repository |
| `distro` | string _(Linux only)_ | Linux distribution (e.g., `ubuntu`, `debian`, `fedora`) |
| `version` | string _(Linux only)_ | Exact OS version (e.g., `22.04`). No ranges or wildcards — each script targets a single specific version. |
| `dependencies` | list of `id` slugs | Other scripts (by `id`) that must run before this one; auto-selected in TUI |

> **Note:** Each script entry targets exactly one platform/arch combination (and for Linux, one specific distro + version). Windows and macOS entries omit `distro` and `version`. The TUI filters the full manifest to show only entries that exactly match the detected host platform, architecture, and (for Linux) distro + version.

---

## 6. Outstanding Questions

### Priority 1 — Foundational
- [x] ~~What programming language / tech stack should the TUI be built in?~~ → **Bun.js + Ink.js (TypeScript)**

### Priority 2 — Core Architecture
- [x] ~~What is the full schema/structure of `scriptor.yaml`?~~ → See Section 5
- [x] ~~How are scripts executed?~~ → TUI manages execution; displays status (starting/finished) and errors only; full output written to a log file
- [x] ~~Is the GitHub repository public or private?~~ → Public by default; optional GitHub PAT for private repos (token persisted with repo URL)

### Priority 3 — UX & Behavior
- [x] ~~How is the custom repository URL persisted?~~ → `~/.scriptor/config`
- [x] ~~What is the primary navigation model?~~ → Flat scrollable list; multi-select; dependencies auto-selected
- [x] ~~What happens if GitHub is unreachable at startup?~~ → Show cached scripts from last fetch with a warning banner; execution still available
- [x] ~~How is script output displayed?~~ → Status + errors shown in TUI; full output written to a log file

### Priority 4 — Script Features
- [x] ~~Can scripts accept user-provided parameters?~~ → No; scripts are self-contained in Phase 1
- [x] ~~Can scripts declare dependencies on other scripts?~~ → Yes; declared in `scriptor.yaml`; auto-selected in TUI when parent is selected
