# 004 Configuration, Keychain & GitHub Client

## Summary

This epic builds the persistence layer and remote data access foundation for Scriptor. It covers three tightly related subsystems: the local YAML configuration file (`~/.scriptor/config`), the platform-native keychain for storing a single shared GitHub OAuth token, and the GitHub API client including OAuth device flow, retries with exponential backoff, and manifest/script caching. Together these subsystems enable Scriptor to remember the user's preferred repo, authenticate against private GitHub repositories, and avoid redundant network fetches on repeat runs.

---

## Business Value

- Users who run Scriptor frequently on the same machine get instant startup (no refetch) when their scripts haven't changed.
- Organizations using private script repositories can authenticate once and never re-enter credentials.
- Users working with non-default repositories (team or org repos) don't have to pass `--repo` on every run once they've confirmed a switch.

---

## User Stories

**US-1 — Persistent repo preference**
As a user who regularly runs a team's private script repo, I want Scriptor to remember my preferred `--repo` so I don't have to supply it on every invocation.

**US-2 — Repo switch confirmation**
As a user who accidentally passes `--repo=wrong/repo`, I want Scriptor to warn me that this differs from my saved repo and let me fall back to my saved one.

**US-3 — Private repo access**
As a user whose script repo is private on GitHub, I want Scriptor to authenticate me via a browser-based device flow so I can access my scripts without managing tokens manually.

**US-4 — Transparent re-authentication**
As a user whose stored GitHub token has expired or been revoked, I want Scriptor to detect this automatically and prompt me to re-authenticate without requiring a manual fix.

**US-5 — Fast subsequent runs**
As a user who runs Scriptor regularly, I want the manifest and my host's scripts to be cached locally so subsequent runs start instantly.

**US-6 — On-demand update check**
As a user who wants to pick up a new script that was just added to the repo, I want to be prompted to refresh the cache when one already exists.

---

## Acceptance Criteria

### Config (AC-CFG)

**AC-CFG-1**: Scriptor reads `~/.scriptor/config` as YAML on startup. If the file is missing, contains invalid YAML, or fails schema validation, it treats the config as empty and continues normally — no error is shown.

**AC-CFG-2**: The config file contains a single optional field: `repo` (string, `owner/name` format). All other fields are ignored.

**AC-CFG-3**: Repo resolution follows this priority order:
1. `--repo` CLI flag (if provided)
2. `repo` field in `~/.scriptor/config` (if present and valid)
3. Default: `beolson/Scriptor`

**AC-CFG-4**: When the `--repo` flag specifies a value different from the `repo` field in config, Scriptor displays a confirmation prompt: `"--repo flag is different from your saved repo (config). Use [flag value] instead of [config value]?"`. If the user confirms, the new repo is saved to config and used for this session. If the user declines, the config repo is used for this session and the config is not modified.

**AC-CFG-5**: Config is written as valid YAML. If the parent directory `~/.scriptor/` does not exist, it is created before writing.

---

### Keychain (AC-KEY)

**AC-KEY-1**: Scriptor stores a single shared GitHub OAuth token under the key `scriptor-github-token` in the platform-native credential store:

| Platform | Tool | Command |
|----------|------|---------|
| macOS | `security` CLI | `security add-generic-password` / `security find-generic-password` / `security delete-generic-password` |
| Linux | `secret-tool` CLI | `secret-tool store` / `secret-tool lookup` / `secret-tool clear` |
| Windows | PowerShell | `[System.Security.CredentialManagement.Credential]` via `cmdkey` or equivalent |

**AC-KEY-2**: If the keychain tool is not installed, not on PATH, or the operation fails for any reason, Scriptor silently continues without storing or retrieving the token. No error is shown to the user.

**AC-KEY-3**: A stored token that receives a 401 or 403 response from GitHub is treated as expired/revoked. Scriptor deletes it from the keychain and immediately triggers a new OAuth device flow (see AC-OA below). This is transparent to the user — no manual action required.

**AC-KEY-4**: Token is stored as a single string value. The keychain service name is `scriptor` and the account name is `github-token`.

---

### GitHub Client (AC-GH)

**AC-GH-1**: All GitHub API requests use the Contents API endpoint (`GET /repos/{owner}/{repo}/contents/{path}`) with the `Accept: application/vnd.github.raw+json` header to retrieve raw file content.

**AC-GH-2**: When an OAuth token is available, it is sent as `Authorization: Bearer <token>`.

**AC-GH-3**: On any non-auth HTTP error (i.e., not 401 or 403) or network failure, Scriptor retries up to 3 times with exponential backoff: 1 second before retry 1, 2 seconds before retry 2, 4 seconds before retry 3. After 3 failures, the error is surfaced to the caller.

**AC-GH-4**: On a 401 or 403 response, Scriptor does not retry — it triggers the OAuth device flow (AC-OA-1). On a 404 response when no token is available, it also triggers the OAuth flow (heuristic: private repo returning 404 to unauthenticated requests).

---

### OAuth Device Flow (AC-OA)

**AC-OA-1**: The OAuth device flow is triggered when:
- A GitHub API request returns 401 or 403
- A GitHub API request returns 404 and no token is currently held

**AC-OA-2**: The device flow proceeds as follows:
1. Scriptor requests a device code from GitHub with scope `repo` (read access to private repos — GitHub's classic OAuth device flow does not support fine-grained scopes directly).
2. Scriptor displays the user code and verification URL using `log.note()`.
3. Scriptor polls the GitHub token endpoint until the user authorizes or an error occurs.
4. On success, the token is stored via the keychain (AC-KEY-1) and the original request is retried.
5. On `authorization_pending`, Scriptor continues polling at the interval GitHub specifies.
6. On `slow_down`, Scriptor increases the poll interval by the specified amount.
7. On `expired_token` or `access_denied`, Scriptor surfaces an error and exits with code 1.

**AC-OA-3**: Scriptor does not implement a user-facing timeout on the device flow. It polls until the user acts or GitHub rejects the code.

---

### Cache (AC-CACHE)

**AC-CACHE-1**: Cached files are stored under `~/.scriptor/cache/<owner>/<repo>/`:
- Manifest: `manifest.yaml`
- Script files: mirror the `script` field path from the manifest entry (e.g., `scripts/Debian/13/install-bun.sh` is stored at `cache/<owner>/<repo>/scripts/Debian/13/install-bun.sh`)

**AC-CACHE-2 — Cache miss**: When no cache exists for the current repo, Scriptor fetches the manifest from GitHub, parses and filters it against the detected host, then fetches only the host-matching script files. All fetched files are written to the cache. Fetching happens with a spinner.

**AC-CACHE-3 — Cache hit**: When a cache exists, Scriptor prompts the user: `"Cache found. Check for updates?"`. If the user says yes, Scriptor fetches the manifest and re-fetches scripts as in a cache miss, overwriting the cache. If the user says no, Scriptor uses the cached manifest and scripts directly.

**AC-CACHE-4 — Fetch failure with cache**: If a network fetch fails (after retries) but a local cache exists, Scriptor logs a warning and falls back to the cached data. If no cache exists and the fetch fails, Scriptor exits with code 1.

**AC-CACHE-5**: The cache has no automatic expiry. Updates are user-driven via the "Check for updates?" prompt (AC-CACHE-3).

**AC-CACHE-6**: Cache directory and all parent directories are created automatically before writing if they do not exist.

---

## Constraints

- No new runtime dependencies beyond those already in the TUI workspace. Keychain operations use platform CLI tools (available by default on macOS/Linux; PowerShell on Windows).
- The config and cache directories live under `~/.scriptor/`. No other file system locations are used.
- This epic does not implement any UI screens beyond the two prompts defined above (repo switch confirmation, update check). All GitHub interaction is headless except for the OAuth device flow note.

---

## Out of Scope

- Per-repo keychain tokens — a single shared token covers all repos.
- Config fields beyond `repo` — future epics may extend the config schema.
- Cache compression or encryption.
- Manual cache-clear command — that is Epic 10 / CLI tooling.
- Self-update version checking — that is Epic 10.
- Local mode (`--repo=local`) bypass logic — the config and cache modules are bypassed by the orchestrator in Epic 6; this epic only implements the modules themselves.

---

## Open Questions

- [answered] Repo switch decline: use config repo instead (ignore the CLI flag for this session)
- [answered] Token expiry/revoke: delete from keychain and re-run device flow transparently
- [answered] Token scope: single shared token (key: `scriptor-github-token`) — not per-repo
- [answered] Cache path: mirror the `script` field value exactly (e.g. `scripts/Debian/13/install-bun.sh` → cache sub-path unchanged)
- [answered] Retry backoff: exponential — 1s, 2s, 4s between retries (3 retries total)
- [answered] OAuth scope: GitHub classic OAuth device flow uses `repo` scope (fine-grained scopes not supported by device flow)
- [answered] Script fetch strategy: host-filtered only — fetch and cache only scripts matching the current host
