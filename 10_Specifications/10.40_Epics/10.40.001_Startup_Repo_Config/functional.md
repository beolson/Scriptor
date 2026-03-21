# 001 Startup & Repo Config

## Summary

Covers the full startup phase of Scriptor: accepting a custom GitHub repository via `--repo` CLI flag with confirmation before persisting, using a cache-first strategy for `scriptor.yaml` and script files, prompting the user to check for updates (both the manifest and the Scriptor binary) on subsequent runs, and performing OAuth device-flow login when GitHub returns 401/403, with the token stored in the OS keychain when available.

---

## Business Value

Scriptor is useful beyond its default repository. Both individual developers (who maintain personal script collections) and teams/organizations (who maintain shared, potentially private, script repos) need to point Scriptor at their own repository. Private repo support via OAuth is the critical enabler for team use cases. Token persistence via the OS keychain eliminates repeated re-authentication friction for private repo users on supported platforms.

---

## User Stories

- **Custom repo — first use**: As a user, I can run `scriptor --repo owner/repo` so that Scriptor fetches scripts from my repository and stores that repo for future runs.
- **Custom repo — repeat run**: As a user, I can run `scriptor` with no flags and have it use the previously stored repo, so I don't need to re-specify it every time.
- **Repo switch confirmation**: As a user, if I pass `--repo` with a value that differs from the stored one, I am prompted to confirm the switch (`Switch repo from old/repo to new/repo? [Y/n]`) before the config is updated.
- **Cache-first startup**: As a returning user, Scriptor starts from the cached manifest immediately so I reach the script list without waiting for a network round-trip.
- **Update prompt**: As a returning user, I am asked "Check for updates?" at startup (covering both the manifest and the Scriptor binary) and can choose to fetch the latest or continue with cached data.
- **Binary self-update**: As a user, when a newer Scriptor binary is available and I choose to update, I am prompted to download and apply it before proceeding.
- **Private repo OAuth**: As a user with a private GitHub repository, when GitHub returns 401 or 403, I am guided through an OAuth device-flow login so Scriptor can access my repo.
- **OAuth token persistence (keychain available)**: As a user on a system with an OS keychain, my OAuth token is stored and reused automatically on future runs; if it expires I am re-prompted.
- **OAuth token — no keychain**: As a user on a system without a supported keychain, I understand that I will need to re-authenticate via OAuth on each run that accesses a private repo or requires authentication.
- **First-run, no network**: As a new user with no cache and no network, I receive a clear error message and Scriptor exits — it cannot operate without an initial manifest download.
- **Default repo**: As a new user with no config, Scriptor uses `beolson/Scriptor` automatically with no setup required.

---

## Acceptance Criteria

### CLI & Config

- [ ] `--repo` accepts `owner/repo` format; any other format exits immediately with `InvalidArgumentError` before the TUI starts.
- [ ] If `--repo` is provided and differs from the stored config value, the user is prompted to confirm before the config is updated.
- [ ] If the user declines the repo switch prompt, Scriptor continues with the previously stored (or default) repo.
- [ ] Resolved repo priority: `--repo` flag → stored `~/.scriptor/config` `repo` field → default `beolson/Scriptor`.
- [ ] `~/.scriptor/config` is YAML. Missing file, corrupt YAML, or non-object values silently fall back to an empty config with no error.

### Cache-First Startup

- [ ] If `~/.scriptor/cache/` contains a valid cached manifest for the current repo, Scriptor loads from cache and proceeds to the script list without any network call.
- [ ] After loading from cache, the user is shown a prompt: "Check for updates?" that covers both the manifest and the Scriptor binary.
- [ ] If the user declines the update prompt, Scriptor proceeds with cached data.
- [ ] If the user accepts the update prompt, Scriptor fetches the latest `scriptor.yaml` and all script files from GitHub, replaces the cache, and also checks for a newer Scriptor binary release.

### First Run (No Cache)

- [ ] If no cache exists for the current repo, Scriptor downloads `scriptor.yaml` and all script files immediately without prompting.
- [ ] If the network is unavailable and there is no cache, Scriptor displays a clear fatal error message and exits with a non-zero code.

### Binary Self-Update

- [ ] When the user accepts the update prompt, Scriptor compares the installed binary version against the latest GitHub release tag.
- [ ] If a newer binary is available, the user is prompted to download and apply the update before proceeding.
- [ ] If no binary update is available, this check completes silently.

### OAuth

- [ ] OAuth device flow is triggered when GitHub returns HTTP 401 or 403 (not proactively).
- [ ] During the device flow, the Fetch Screen displays the user code and verification URL for the user to act on.
- [ ] After successful authentication, the failed request is retried with the new token.
- [ ] If an OS keychain is available, the OAuth token is stored there and sent proactively on future startup requests.
- [ ] If a stored token receives a 401/403, the device flow is re-triggered (token treated as expired).
- [ ] If no OS keychain is available, the token is not stored; the user must re-authenticate on each run that requires it.

---

## Constraints

- GitHub is the only supported remote host; GitLab, Bitbucket, and self-hosted Git are not supported.
- OS keychain support is best-effort: available on macOS (Keychain), Linux (libsecret/GNOME Keyring where present), and Windows (Credential Manager). No keychain = no token persistence; the app must remain fully functional in that case.
- Binary self-update must support all 6 release targets: `linux/darwin/windows × x64/arm64`.

---

## Out of Scope

- **Non-GitHub repository hosts**: GitLab, Bitbucket, self-hosted Git — explicitly excluded.
- **Script execution phase**: Selecting and running scripts is a separate epic.
- **Local mode** (auto-detecting `scriptor.yaml` in the current working directory): Replaced by the cache-first strategy defined in this epic.

---

## Open Questions

- None.
