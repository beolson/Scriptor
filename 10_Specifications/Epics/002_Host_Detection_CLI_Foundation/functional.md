# 002 Host Detection & CLI Foundation

## Summary

Implement the TUI entry point and runtime environment detection. This epic covers two areas: (1) `src/host/detectHost.ts` — detecting the host OS name, version, and CPU architecture from the runtime environment; and (2) `src/index.ts` — the Commander-based CLI entrypoint with TTY guard, flag parsing, default repo resolution, and the top-level async orchestrator that sequences all downstream phases via named stubs.

## Business Value

Every downstream phase (script filtering, selection, execution) depends on accurate host information. Without knowing the OS and architecture, Scriptor cannot determine which scripts are relevant to the current machine. This epic delivers:

- **Accurate platform targeting**: OS name, version, and architecture are detected at startup so later epics can filter the script manifest to only what's applicable to the current host.
- **Clean entry-point UX**: The TTY guard, flag validation, and default-repo fallback ensure the tool behaves predictably before any expensive operations (network calls, UI rendering) begin.
- **A wired orchestrator skeleton**: Naming and sequencing all phase stubs in `src/index.ts` establishes the data-flow contract that subsequent epics fill in, preventing interface drift between epics.

## User Stories

1. **As a developer running Scriptor for the first time**, I want the tool to automatically detect my OS, version, and architecture so I only see scripts relevant to my machine — without having to tell it what platform I'm on.

2. **As a developer targeting a specific repository**, I want to run `scriptor --repo owner/repo` so the session uses that repository without me having to modify any config file.

3. **As a developer testing scripts locally**, I want to run `scriptor --repo=local` from within my script repository and have Scriptor immediately validate that I'm inside a git repo, failing with a clear error if I'm not.

4. **As a CI system or automated pipeline**, I want Scriptor to fail immediately with a clear error message when stdin is not a TTY, so the process doesn't hang waiting for interactive input.

## Acceptance Criteria

### Host Detection (`src/host/detectHost.ts`)

1. On Linux with a readable `/etc/os-release`:
   - `osName` is set to the value of the `NAME` field.
   - `osVersion` is set to the value of the `VERSION_ID` field (or `undefined` if `VERSION_ID` is absent from the file).
2. On Linux when `/etc/os-release` is missing or unreadable:
   - `osName` and `osVersion` are both `undefined`.
   - The function does not throw; it returns gracefully.
3. On macOS: `osName` is `"mac"` and `osVersion` is `undefined`.
4. On Windows: `osName` is `"windows"` and `osVersion` is `undefined`.
5. Architecture detection:
   - `arm64` and `arm` CPU architectures map to `"arm"`.
   - All other CPU architectures map to `"x64"`.
6. WSL (Windows Subsystem for Linux) is treated as Linux: `/etc/os-release` is read normally. No WSL-specific detection is performed.
7. `detectHost()` returns a `HostInfo` object: `{ osName?: string; osVersion?: string; arch: "x64" | "arm" }`.

### CLI Entrypoint (`src/index.ts`)

8. **TTY guard**: If stdin is not an interactive terminal, Scriptor logs `"Scriptor requires an interactive terminal."` via `log.error()` and exits with code 1. This check runs before any other logic.
9. **`--repo <owner/repo|local>` flag**: Accepted as an optional CLI argument. Its raw value (or `undefined` if absent) is passed to the startup orchestrator stub.
10. **Default repo fallback**: When `--repo` is absent, the resolved repo is `beolson/Scriptor`. This default is applied in `src/index.ts`; config-based lookup is deferred to Epic 4.
11. **`--repo=local` guard**: When the `local` value is detected, `src/index.ts` immediately runs `git rev-parse --show-toplevel`. If the command fails (not inside a git repo), Scriptor logs an error and exits with code 1. On success, the git root path is passed to the startup stub.
12. **`--apply-update <old-path>` flag**: Registered with Commander and hidden from help output (`--help` does not list it). Its handler throws `"not implemented"`. Epic 10 replaces this handler.
13. **Orchestrator sequence**: The top-level async function calls the following named stubs in order: `runStartup()` → `runScriptSelection()` → `runInputCollection()` → `runConfirmation()` → `runSudo()` → `runExecution()`. Each stub throws `"not implemented"`.
14. **Top-level error boundary**: Unhandled errors from the orchestrator are caught, reported via `log.error()`, and result in exit code 1.

## Constraints

- WSL is treated as Linux: `/etc/os-release` is read normally. WSL distros present standard os-release content and are treated identically to native Linux.
- The top-level orchestrator in `src/index.ts` wires up the full phase call sequence using named stub functions that throw `"not implemented"`. Later epics replace each stub with a real implementation.
- TTY error message: `"Scriptor requires an interactive terminal."` — exit code 1.
- `--apply-update` is registered with Commander and hidden from help output in this epic. Its handler is a stub; Epic 10 provides the real implementation.
- This epic applies the default repo fallback (`beolson/Scriptor`) when `--repo` is absent. Config-based repo lookup and the repo-switch confirmation prompt belong to Epic 4.
- When `--repo=local` is detected, `src/index.ts` immediately validates that the current directory is inside a git repo (via `git rev-parse --show-toplevel`) and exits with an error if not. The local-mode manifest read and script execution remain in Epic 10.

## Out of Scope

- Config file read/write — Epic 4.
- Repo resolution from `~/.scriptor/config` — Epic 4.
- Repo-switch confirmation prompt when `--repo` differs from config — Epic 4.
- Manifest fetching, parsing, and filtering — Epics 3 and 6.
- GitHub authentication and caching — Epics 4 and 6.
- Self-update logic (`--apply-update` handler) — Epic 10.
- Local mode manifest read and script execution from the local filesystem — Epic 10.

## Open Questions

_None._
