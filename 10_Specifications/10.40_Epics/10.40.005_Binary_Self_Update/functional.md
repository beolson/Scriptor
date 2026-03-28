# 005 Binary Self-Update

## Summary
Implement a self-update mechanism that checks the latest GitHub release at startup, compares it against the installed binary version, and — when a newer version is available — prompts the user to download and apply the update before proceeding. The update replaces the binary atomically on Unix/Mac; Windows requires a manual replacement step due to OS file-locking constraints. The feature is disabled in dev (`bun run`) mode.

---

## Business Value
Users should not need to manually download and reinstall Scriptor to stay current. The self-update feature eliminates that friction: the tool keeps itself up to date on the user's behalf, prompting once at startup whenever a newer version is available. This ensures the installed base naturally converges to the latest release without user effort.

---

## User Stories

- **As a Unix/Mac user**, when I run Scriptor and a newer version is available, I want to be prompted to update in-place so that I can get the latest version without leaving my terminal.
- **As a Windows user**, when a newer version is available, I want to be told where the new binary was downloaded so I can replace the executable manually, since Windows cannot replace a running executable.
- **As a user on a slow or offline connection**, I want Scriptor to silently skip the update check if it fails, so that a network issue never prevents me from using the tool.
- **As a user who does not want to update right now**, I want to skip the update prompt and proceed to script selection without blocking.

---

## Acceptance Criteria

### Update Check

1. On startup, Scriptor compares the installed binary version (from `package.json`) against the latest release version from the GitHub Releases API (`/repos/{owner}/{repo}/releases/latest`).
2. If a stored OAuth token is available in config, it is passed as a Bearer token on the request. If not, the request is made unauthenticated.
3. If the API call fails for any reason (network error, non-2xx response, timeout), the update check is **silently skipped** — no error is shown, and startup proceeds normally.
4. Version comparison is semver-like: leading `v` stripped, then segment-by-segment numeric comparison. If installed < latest, the update flow is triggered.
5. If installed >= latest, startup proceeds directly to Phase 2 (fetch).
6. The update check only runs for compiled binaries. In dev mode (`bun run`), the check is skipped. Detection: `path.basename(process.execPath).startsWith("scriptor")`.

### Update Screen

7. The Update screen is shown **before Phase 2** (before any fetch or OAuth). It is not shown if no update is available.
8. The screen displays:
   - "Update available"
   - `v{current} → v{latest}`
   - `[Y] Update  [N] Skip`
9. Key bindings:
   - `Y` / `y` — starts the download
   - `N` / `n` / `Esc` — skips the update and proceeds to Phase 2
10. Every startup re-prompts if a newer version exists. Skipped versions are not remembered.

### Update Screen Phases

| Phase | Display |
|-------|---------|
| `prompt` | "Update available", `v{current} → v{latest}`, `[Y] Update  [N] Skip` |
| `downloading` | "Downloading {assetName}…" (yellow) |
| `done` | "Update applied. Please restart Scriptor." (green); auto-exits after ~80 ms |
| `error` | Error message (red) + `[N] Skip` — user can skip from error state |

### Asset Resolution

11. The asset to download is selected by matching `platform` + `arch` to the following naming convention:

| Platform | Arch | Asset name |
|----------|------|------------|
| linux | x86 | `scriptor-linux-x64` |
| linux | arm | `scriptor-linux-arm64` |
| mac | x86 | `scriptor-darwin-x64` |
| mac | arm | `scriptor-darwin-arm64` |
| windows | x86 | `scriptor-windows-x64.exe` |
| windows | arm | `scriptor-windows-arm64.exe` |

### Apply Update — Unix/Mac

12. Download the asset to a temp file in the same directory as the current binary.
13. `chmod 755` the temp file.
14. Atomically rename the temp file over `process.execPath`.
15. Show the `done` phase, then auto-exit after ~80 ms. The user must manually restart Scriptor.

### Apply Update — Windows

16. Download the asset to `{binaryDir}/scriptor-new.exe`.
17. Show an error-phase message instructing the user to manually replace the binary:
    > "Automatic update on Windows requires manual replacement. scriptor-new.exe has been downloaded to {binaryDir}. Please close Scriptor and replace scriptor.exe with scriptor-new.exe."
18. The `[N] Skip` binding is available so the user can dismiss and continue using the current version.

---

## Constraints

- **Dev mode**: Self-update must be fully disabled when not running as a compiled binary (detection via `process.execPath` basename).
- **Auth**: Use the stored OAuth token if available; fall back to unauthenticated. Do not trigger an OAuth flow solely for the update check.
- **Failure handling**: Any failure in the update check (API error, parse error, missing asset) must be handled silently — never block startup.
- **No skip memory**: Skipped versions are not persisted. Every startup re-prompts if a newer version is detected.
- **Manual restart only**: After a successful update on Unix/Mac, Scriptor exits and the user must restart manually. No auto-exec of the new binary.

---

## Out of Scope

- Auto-restart / `exec()` replacement of the running process after update.
- User-configurable flag to permanently disable update checks.
- Persisting "skip this version" state across runs.
- Triggering an OAuth device flow specifically to authenticate the release API call.
- Rollback / downgrade support.
- Delta / patch updates (full binary replacement only).

---

## Open Questions
_(none)_
