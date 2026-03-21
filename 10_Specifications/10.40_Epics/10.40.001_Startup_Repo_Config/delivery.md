# 001 Startup & Repo Config — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Package & Build Setup

**Status:** not started

**Description:**
Migrate the TUI workspace from Ink/React to @clack. Install all dependencies required by this epic and wire `VERSION` into the build pipeline so the binary knows its own version at runtime.

- Remove `ink`, `react`, `@types/react` from `20_Applications/tui/package.json`
- Add `@clack/prompts`, `@clack/core`, `semver`, `@octokit/oauth-device`
- Update the `build` script to read version from `package.json` and pass `--define 'VERSION="x.y.z"'` to `bun build`
- Add a `src/version.ts` that exports `declare const VERSION: string` so TypeScript knows the global exists
- Clear the `console.log("meh")` stub in `src/index.ts`

**TDD Approach:**
- **RED:** Write a test in `src/version.test.ts` that imports `VERSION` and asserts it is a non-empty string matching `/^\d+\.\d+\.\d+$/`
- **GREEN:** Add the `declare const VERSION` declaration and update the build script; verify the test passes after a `bun build` that injects the current package version
- Cover: VERSION is defined, is a semver string

---

## Task 2 — Repo Type and Validation

**Status:** not started

**Description:**
Define the `Repo` type and the parsing/validation logic for the `owner/repo` format used by `--repo`. This is the foundational data type for cache keys, API calls, and config storage.

- `src/repo/types.ts` — `Repo { owner: string; name: string }`
- `src/repo/parseRepo.ts` — `parseRepo(input: string): Repo` validates `owner/repo` format (no slashes in owner or name, both non-empty), throws `InvalidArgumentError` on any other format
- Validation via Zod schema
- `repoToString(repo: Repo): string` — returns `"owner/repo"` for storage/display

**TDD Approach:**
- **RED:** Write tests in `src/repo/parseRepo.test.ts` before any implementation
- **GREEN:** Implement schema and parser to pass all cases
- Cover: valid `owner/repo`, missing slash, extra slash (`a/b/c`), empty owner, empty repo, whitespace-only parts, leading/trailing whitespace stripped correctly

---

## Task 3 — Config Service

**Status:** not started

**Description:**
Read and write the YAML config file at `~/.scriptor/config`. Implements the requirement that a missing file, corrupt YAML, or non-object value silently falls back to an empty config with no error.

- `src/config/types.ts` — `Config { repo?: string }` with Zod schema
- `src/config/configService.ts`:
  - `readConfig(deps?): Config` — reads `~/.scriptor/config`, returns `{}` on any read/parse error
  - `writeConfig(config: Config, deps?): void` — writes YAML to `~/.scriptor/config`, creates dir if missing
- Uses injectable deps for `fs` operations so tests don't touch the real filesystem

**TDD Approach:**
- **RED:** Write tests in `src/config/configService.test.ts` using injected fake fs
- **GREEN:** Implement read/write with js-yaml; all error paths silently return empty config
- Cover: file missing, corrupt YAML, non-object YAML, valid config, write creates parent dir, write round-trips correctly

---

## Task 4 — Cache Service

**Status:** not started

**Description:**
Read and write the per-repo file cache at `~/.scriptor/cache/<owner>/<repo>/`. This enables the cache-first startup strategy where Scriptor loads the manifest from disk without a network call.

- `src/cache/cacheService.ts`:
  - `cacheExists(repo: Repo, deps?): boolean` — checks for `~/.scriptor/cache/<owner>/<repo>/manifest.yaml`
  - `readManifest(repo: Repo, deps?): string` — returns raw YAML string
  - `writeCache(repo: Repo, manifest: string, scripts: Map<string, string>, deps?): void` — writes manifest + all script files under `scripts/`
- Uses injectable deps for fs; no network calls in this module

**TDD Approach:**
- **RED:** Write tests in `src/cache/cacheService.test.ts` with injected fake fs
- **GREEN:** Implement using `Bun.file()` / `Bun.write()` with path construction from `Repo`
- Cover: cache missing returns false, cache present returns true, read returns manifest contents, write creates correct directory structure, write creates all script files at expected paths

---

## Task 5 — Keychain Service

**Status:** not started

**Description:**
Store and retrieve the OAuth token using platform CLI tools (no native modules). Graceful fallback when the CLI tool is absent or returns an error — callers receive `null` and must not assume persistence is available.

- `src/keychain/keychainService.ts`:
  - `keychainGet(key: string, deps?): Promise<string | null>`
  - `keychainSet(key: string, value: string, deps?): Promise<void>`
- Platform routing: `process.platform` → `"darwin"` (security), `"linux"` (secret-tool), `"win32"` (cmdkey / powershell)
- Any subprocess exit code ≠ 0 or thrown error → return `null` / swallow silently
- Injectable `spawn` dep so tests never shell out

**TDD Approach:**
- **RED:** Write tests in `src/keychain/keychainService.test.ts` with a fake `spawn` dep
- **GREEN:** Implement subprocess calls per platform; route by `process.platform`
- Cover: macOS get/set success, linux get/set success, windows get/set success, subprocess failure returns null (get) / silently no-ops (set), missing tool (exit 127) treated as no-keychain

---

## Task 6 — GitHub API Client

**Status:** not started

**Description:**
All network calls to GitHub are routed through this module. It detects 401/403 responses and throws a typed `AuthRequired` error that upstream code uses to trigger the OAuth device flow.

- `src/github/githubClient.ts`:
  - `fetchManifest(repo: Repo, token?: string, deps?): Promise<string>` — fetches raw `scriptor.yaml` from the default branch
  - `fetchLatestRelease(deps?): Promise<{ tag: string; assets: ReleaseAsset[] }>` — fetches latest release from the default (`beolson/Scriptor`) repo
  - `downloadBinary(url: string, destPath: string, deps?): Promise<void>` — streams asset to disk
- Throws `AuthRequired` (custom error class) on HTTP 401 or 403
- Throws `NetworkError` on fetch failure or non-2xx that isn't auth-related
- Injectable `fetch` dep

**TDD Approach:**
- **RED:** Write tests in `src/github/githubClient.test.ts` with injected fake fetch
- **GREEN:** Implement with native fetch; check `response.ok` and status codes before parsing
- Cover: 200 manifest fetch, 401 throws AuthRequired, 403 throws AuthRequired, network failure throws NetworkError, release fetch parses tag and assets, download writes bytes to dest path

---

## Task 7 — OAuth Service

**Status:** not started

**Description:**
Runs the GitHub OAuth device flow via `@octokit/oauth-device` and displays the user code and verification URL using `@clack/prompts` `note()` followed by a polling spinner. After successful authentication the access token is returned to the caller.

- `src/oauth/oauthService.ts`:
  - `runDeviceFlow(deps?): Promise<string>` — returns the access token
  - Calls `@clack/prompts` `note()` with the user code and verification URL
  - Calls `spinner('Waiting for authorization…')` during polling
  - On success: stops spinner, returns token
  - On failure/cancel: stops spinner, rethrows
- Injectable `createDeviceFlow` dep and `clack` dep for testability

**TDD Approach:**
- **RED:** Write tests in `src/oauth/oauthService.test.ts` with fake `createDeviceFlow` and fake clack
- **GREEN:** Implement using `@octokit/oauth-device`'s async generator or callback API
- Cover: successful flow returns token, note() called with correct URL and code, spinner started before polling, spinner stopped on success, error during polling rethrows

---

## Task 8 — Binary Self-Update

**Status:** not started

**Description:**
Checks for a newer Scriptor binary, downloads it, and applies it via the download → exec → relaunch pattern. The `--apply-update <old-path>` internal flag causes the new binary to move itself into place and relaunch.

- `src/update/updateService.ts`:
  - `checkForUpdate(deps?): Promise<UpdateInfo | null>` — compares `VERSION` to latest release tag using `semver.gt()`; returns `null` if up to date
  - `downloadUpdate(asset: ReleaseAsset, deps?): Promise<string>` — downloads to `~/.scriptor/scriptor.new`, returns path
  - `applyUpdate(newBinaryPath: string, currentBinaryPath: string): never` — `chmod +x`, then `Bun.spawn([newBinaryPath, '--apply-update', currentBinaryPath])` and `process.exit(0)`
- `src/update/applyUpdateHandler.ts`:
  - `handleApplyUpdate(oldPath: string): never` — moves `process.execPath` to `oldPath`, then `Bun.spawn([oldPath])` to relaunch; `process.exit(0)`

**TDD Approach:**
- **RED:** Write tests in `src/update/updateService.test.ts` with injected fake fetch and fake fs
- **GREEN:** Implement version comparison and download; handler logic is integration-level
- Cover: latest release older than VERSION → null, latest release newer → UpdateInfo with download URL, semver comparison handles `v` prefix on tags, download writes bytes to correct path, `handleApplyUpdate` moves file then relaunches

---

## Task 9 — Startup TUI Screens

**Status:** not started

**Description:**
Clack-backed UI functions for each interactive moment in the startup flow. These are thin wrappers that keep the orchestrator free of direct clack calls, enabling the orchestrator to be tested without a TTY.

- `src/startup/screens.ts`:
  - `confirmRepoSwitch(oldRepo: string, newRepo: string, deps?): Promise<boolean>` — wraps `@clack/prompts` `confirm()`
  - `promptCheckUpdates(deps?): Promise<boolean>` — wraps `confirm()`
  - `showFetchProgress<T>(label: string, fn: () => Promise<T>, deps?): Promise<T>` — wraps `spinner()`
  - `showOAuthPrompt(userCode: string, verificationUrl: string, deps?): void` — calls `note()` with the user code and URL
  - `showFatalError(message: string): never` — calls `@clack/prompts` `log.error()` then `process.exit(1)`
- All clack calls injectable via deps

**TDD Approach:**
- **RED:** Write tests in `src/startup/screens.test.ts` with a fake clack dep
- **GREEN:** Implement as thin wrappers; screens have no business logic
- Cover: confirmRepoSwitch returns true when confirm resolves true, returns false on cancel symbol, promptCheckUpdates same, showFetchProgress calls fn and returns its result, showOAuthPrompt calls note with URL and code visible, showFatalError calls process.exit(1)

---

## Task 10 — Startup Orchestrator

**Status:** not started

**Description:**
Coordinates all services and screens into the startup sequence. This is the core logic of the epic: resolve repo, load config, check cache, prompt for updates, download if needed, trigger OAuth on 401/403, persist token.

Implements all acceptance criteria in the functional.md sections: CLI & Config, Cache-First Startup, First Run (No Cache).

- `src/startup/orchestrator.ts` — `runStartup(opts: StartupOptions, deps?): Promise<ManifestResult>`
- Startup sequence:
  1. Resolve repo: `opts.repo` flag → `config.repo` → `"beolson/Scriptor"` default
  2. If flag differs from stored → `confirmRepoSwitch()` → update config if confirmed
  3. Check keychain for stored token
  4. If cache exists → `promptCheckUpdates()` → skip or fetch
  5. If no cache → fetch immediately (no prompt)
  6. Fetch: call `githubClient.fetchManifest()`; on `AuthRequired` → `runDeviceFlow()` → store token → retry
  7. If fetch fails with no cache → `showFatalError()`
  8. Write cache after successful fetch
  9. Return parsed manifest
- All deps injectable

**TDD Approach:**
- **RED:** Write tests in `src/startup/orchestrator.test.ts` with all deps injected as fakes
- **GREEN:** Implement the sequence; each branch is driven by a failing test first
- Cover: fresh run with no cache fetches immediately, cached run prompts for updates, user declines update → uses cache, user accepts update → refetches and writes cache, stored token sent proactively, 401 without token triggers OAuth flow, 401 with stored token re-triggers OAuth (treats as expired), no cache + network failure calls showFatalError, repo flag switches config after confirmation, repo switch declined → uses old repo

---

## Task 11 — CLI Entry Point

**Status:** not started

**Description:**
Wire Commander, the `--repo` flag, the hidden `--apply-update` flag, and the orchestrator into the binary's `main()` function. This is the outermost layer and the only place that calls `process.exit`.

- `src/index.ts`:
  - Commander program with `--repo <owner/repo>` option
  - `InvalidArgumentError` thrown by `parseRepo()` causes Commander to print the error and exit 1 automatically
  - Hidden `--apply-update <old-path>` option — if present, call `handleApplyUpdate(oldPath)` before any other logic
  - On successful `runStartup()`: continue to script-list phase (out of scope for this epic — stub with a `log.success()` message for now)
  - `@clack/prompts` `intro()` at startup, `outro()` on clean exit
- `src/index.ts` must remain the only file that imports Commander

**TDD Approach:**
- **RED:** Write tests in `src/index.test.ts` that exercise flag parsing by calling the program with string args (Commander supports `.parseAsync(['--repo', 'bad/format/here'])`)
- **GREEN:** Wire `parseRepo` as Commander's `parseArg`; tests assert exit code and error output
- Cover: valid `--repo` parsed correctly, invalid `--repo` format exits with error message, no `--repo` falls back to config/default, `--apply-update` detected and handler called before orchestrator, missing old-path argument for `--apply-update` exits with error
