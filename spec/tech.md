# Scriptor — Technology Stack Summary

_Derived from Phase 1 Functional Requirements. Last updated: 2026-02-28._

---

## Core Stack

| Concern | Choice | Notes |
|---|---|---|
| Language | **TypeScript** | Strict typing across the codebase |
| Runtime / Compiler | **Bun.js** | Compiles TypeScript to a single self-contained executable per platform/architecture |
| TUI Framework | **Ink.js** | React-based component model for terminal UIs |

---

## Platform Targets

| OS | Architectures |
|---|---|
| Windows | x86, ARM |
| Linux | x86, ARM (filtered by distro + version) |
| macOS | x86, ARM |

Each platform/architecture combination produces one standalone binary artifact.

---

## External Integrations

| Integration | Details |
|---|---|
| GitHub REST API | Fetches `scriptor.yaml` manifest and script files at startup |
| GitHub PAT (optional) | Authenticates access to private repositories |

---

## Local Filesystem Layout

| Path | Purpose |
|---|---|
| `~/.scriptor/config` | Persisted configuration (custom repo URL, optional PAT) |
| `~/.scriptor/cache/` | Locally cached scripts and manifest from last successful fetch |
| `~/.scriptor/logs/` | Per-run log files named by timestamp (e.g. `2026-02-28T14-32-00.log`) |

---

## Script Execution

- Scripts are spawned as **child processes** managed by the TUI
- Supported script types: **Bash**, **PowerShell**, **ZSH**
- Scripts execute sequentially; a failure halts execution
- Full stdout/stderr is written to log files; TUI shows only status + errors

---

## Repository Metadata

- `scriptor.yaml` at the root of the script repository defines all available scripts
- Fields: `id`, `name`, `description`, `platform`, `arch`, `script`, `distro` (Linux), `version` (Linux), `dependencies`
