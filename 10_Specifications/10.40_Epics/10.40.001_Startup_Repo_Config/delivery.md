# 001 Startup & Repo Config — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Package & Build Setup

**Status:** complete

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

**Status:** complete

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

**Status:** complete

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

**Status:** complete

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

**Status:** complete

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

**Status:** complete

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

**Status:** complete

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

**Status:** completed

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

**Implementation Notes:**
- Created `20_Applications/tui/src/update/updateService.ts`:
  - `UpdateInfo` class holds `latestTag` and `assets`
  - `checkForUpdate()` uses `semver.coerce()` to strip the `v` prefix from tags before calling `semver.gt()`
  - `downloadUpdate()` delegates to `githubClient.downloadBinary()` and writes to `~/.scriptor/scriptor.new`
  - `applyUpdate()` runs `chmod +x`, spawns the new binary with `--apply-update`, then calls `process.exit(0)` — integration-level, not unit-tested
  - Injectable `UpdateServiceDeps` interface: `fetchLatestRelease`, `downloadBinary`, `chmod`, `spawn`, `currentVersion`
- Created `20_Applications/tui/src/update/applyUpdateHandler.ts`:
  - `handleApplyUpdate()` renames `process.execPath` → `oldPath`, spawns `oldPath`, exits
  - Injectable `ApplyUpdateHandlerDeps` interface: `rename`, `spawn`, `exit`, `execPath`
- Created `20_Applications/tui/src/update/updateService.test.ts` — 11 tests covering all TDD cases
- Created `20_Applications/tui/src/update/applyUpdateHandler.test.ts` — 4 tests covering rename/spawn/exit behaviour
- All 104 tests pass; lint, format, and typecheck all clean

---

## Task 9 — Startup TUI Screens

**Status:** complete

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

**Implementation Notes:**
- Created `20_Applications/tui/src/startup/screens.ts` exporting `confirmRepoSwitch`, `promptCheckUpdates`, `showFetchProgress`, `showOAuthPrompt`, `showFatalError`
- `ClackDeps` interface covers `confirm`, `note`, `spinner`, and `log.error`; `ScreensDeps` also accepts an injectable `exit` function for `showFatalError`
- Cancel detection uses `typeof result !== "boolean"` rather than `clackPrompts.isCancel()` so that any injected cancel symbol (not just the real clack symbol) is correctly handled in tests
- Created `20_Applications/tui/src/startup/screens.test.ts` — 16 tests covering all TDD cases
- All 120 tests pass; lint, format, and typecheck all clean

---

## Task 10 — Startup Orchestrator

**Status:** complete

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

**Implementation Notes:**
- Created `20_Applications/tui/src/startup/orchestrator.ts` exporting `runStartup`, `StartupOptions`, `ManifestResult`, `OrchestratorDeps`
- `OrchestratorDeps` interface covers all 11 injectable seams: readConfig, writeConfig, cacheExists, readManifest, writeCache, fetchManifest, keychainGet, keychainSet, runDeviceFlow, confirmRepoSwitch, promptCheckUpdates, showFetchProgress, showFatalError
- Default deps use lazy `await import()` for all real service modules to avoid circular deps at import time; `showFatalError` uses `require()` since it is synchronous (`never` return type)
- Created `20_Applications/tui/src/startup/orchestrator.test.ts` — 25 tests covering all TDD cases across 7 describe blocks
- All 145 tests pass; lint, format, and typecheck all clean

---

## Task 11 — CLI Entry Point

**Status:** complete

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

**Implementation Notes:**
- Created `20_Applications/tui/src/program.ts` — Commander `buildProgram(deps: ProgramDeps)` factory function:
  - `ProgramDeps` interface covers all injectable seams: `runStartup`, `handleApplyUpdate`, `intro`, `outro`, `log.success`, `exit`
  - `--repo <owner/repo>` option wired with `parseRepo` as Commander's `parseArg` callback — `InvalidArgumentError` causes Commander to print the error and exit 1 automatically
  - `--apply-update <old-path>` added via `new Option(...).hideHelp()` to keep it hidden from help output
  - Action handler checks `--apply-update` first, calls `handleApplyUpdate()` and returns before any orchestrator logic
  - Calls `deps.intro()` → `deps.runStartup()` → `deps.log.success()` stub → `deps.outro()` for normal flow
  - Separated from `index.ts` so tests can import `buildProgram` without executing `main()`
- Updated `20_Applications/tui/src/index.ts` — wires real implementations to `buildProgram` and calls `program.parseAsync(process.argv)` inside `main()`; unhandled rejection handler logs error and exits 1
- Created `20_Applications/tui/src/index.test.ts` — 9 tests covering all TDD cases:
  - Valid `--repo` parsed and passed to `runStartup`
  - Whitespace stripped from `--repo` value
  - Invalid `--repo` (no slash) causes exit 1
  - Invalid `--repo` (too many slashes) causes exit 1
  - No `--repo` flag passes `undefined` to `runStartup`
  - `--apply-update` calls `handleApplyUpdate` before `runStartup`
  - Without `--apply-update`, `handleApplyUpdate` is never called
  - `intro()` called at startup
  - `outro()` called on clean exit
- All 154 tests pass; lint, format, and typecheck all clean

---

## Change: Private repo 404 triggers OAuth (2026-03-21)

**Summary:** `raw.githubusercontent.com` returns 404 (not 401/403) for private repos when unauthenticated, so the OAuth device flow was never triggered; fixed by treating 404-without-token as `AuthRequired` in `fetchManifest`.

**Files modified:**
- `20_Applications/tui/src/github/githubClient.ts` — added special case in `fetchManifest`: if response is 404 and no token was provided, throw `AuthRequired(404)` instead of calling `throwForStatus`
- `20_Applications/tui/src/github/githubClient.test.ts` — added test: 404 with no token → `AuthRequired`; updated existing 404 test to pass a token (verifying the "genuinely missing file" path still throws `NetworkError`)

**Spec updates:**
- `functional.md` — amended OAuth acceptance criterion to include 404-without-token as a trigger, with explanatory note about `raw.githubusercontent.com` behaviour
- `technical.md` — none

**Tests added/modified:**
- `20_Applications/tui/src/github/githubClient.test.ts` — 1 test added, 1 test updated; 155 total tests pass

---

## Change: Guard spinner stop before start in OAuth flow (2026-03-21)

**Summary:** `clack`'s `spinner().stop()` crashes (`s is not a function`) when called before `spinner().start()` — fixed by tracking whether the spinner was started and only calling `stop()` if it was.

**Root cause:** `createDeviceCode()` throws (e.g., invalid OAuth App client ID) before `onVerification` fires, so `spin.start()` is never called; the catch block then calls `spin.stop()` on an uninitialised spinner, crashing the process.

**Files modified:**
- `20_Applications/tui/src/oauth/oauthService.ts` — added `spinnerStarted` flag; `spin.stop()` in the catch block is now guarded by `if (spinnerStarted)`
- `20_Applications/tui/src/oauth/oauthService.test.ts` — added `errorBeforeVerification` option to `makeCreateDeviceFlow` helper; added 2 new tests covering the pre-verification error path

**Spec updates:**
- `functional.md` — none
- `technical.md` — none

**Tests added/modified:**
- `20_Applications/tui/src/oauth/oauthService.test.ts` — 2 tests added; 157 total tests pass

---

## Change: Switch fetchManifest to GitHub Contents API (2026-03-21)

**Summary:** `raw.githubusercontent.com` does not accept `Authorization: Bearer` tokens for private repos and does not resolve `HEAD` — switched to the GitHub Contents API (`api.github.com`) which supports Bearer auth and defaults to the repo's default branch.

**Files modified:**
- `20_Applications/tui/src/github/githubClient.ts` — `fetchManifest` URL changed from `raw.githubusercontent.com/{owner}/{repo}/HEAD/scriptor.yaml` to `api.github.com/repos/{owner}/{repo}/contents/scriptor.yaml`; Accept header changed from `text/plain` to `application/vnd.github.raw+json`
- `20_Applications/tui/src/github/githubClient.test.ts` — URL assertion updated to check for `api.github.com`

**Spec updates:**
- `functional.md` — none
- `technical.md` — API endpoint documented; reason for not using raw.githubusercontent.com noted

**Tests added/modified:**
- `20_Applications/tui/src/github/githubClient.test.ts` — 1 test updated; 158 total tests pass

---

## Change: Request `repo` scope in OAuth device flow (2026-03-21)

**Summary:** The OAuth device flow requested no scopes, so the issued token had no permissions and GitHub returned 404 again on the retry for private repositories; fixed by adding `scopes: ["repo"]` to the device flow options.

**Files modified:**
- `20_Applications/tui/src/oauth/oauthService.ts` — added `scopes: ["repo"]` to `createDeviceFlow` options
- `20_Applications/tui/src/oauth/oauthService.test.ts` — added test asserting `scopes: ["repo"]` is passed to `createDeviceFlow`

**Spec updates:**
- `functional.md` — none
- `technical.md` — OAuth device flow library entry updated to note `scopes: ["repo"]` is requested

**Tests added/modified:**
- `20_Applications/tui/src/oauth/oauthService.test.ts` — 1 test added; 159 total tests pass

---

## Change: Add `--repo=local` mode (2026-03-22)

**Summary:** Added `--repo=local` as a reserved keyword that reads `scriptor.yaml` directly from the current git root, bypassing GitHub, caching, OAuth, and the update prompt entirely.

**Files modified:**
- `20_Applications/tui/src/startup/localRepo.ts` — new module: `findGitRoot()`, `readLocalManifest()`, `LocalRepoError`; injectable deps; `Bun.spawn` for `git rev-parse --show-toplevel`
- `20_Applications/tui/src/startup/localRepo.test.ts` — new test file: 15 tests for `findGitRoot` and `readLocalManifest`
- `20_Applications/tui/src/startup/orchestrator.ts` — `StartupOptions` gains `localMode?: boolean`; `ManifestResult` gains `localRoot?: string`; `OrchestratorDeps` gains `readLocalManifest`; local-mode early-return branch added at top of `runStartup`
- `20_Applications/tui/src/startup/orchestrator.test.ts` — added `readLocalManifest` to `makeDeps`; added `local mode` describe block (9 tests)
- `20_Applications/tui/src/program.ts` — `parseRepoArg` intercepts `"local"` before `parseRepo`; action handler passes `localMode: true` to `runStartup`; success stub shows git root path in local mode
- `20_Applications/tui/src/index.test.ts` — updated `ProgramDeps` interface; added `--repo=local flag` describe block (2 tests)

**Spec updates:**
- `functional.md` — added "Local mode" user story; added 5 new acceptance criteria under CLI & Config
- `technical.md` — added "Local Mode" section documenting `localRepo.ts`, `findGitRoot`, `ManifestResult.localRoot`, and no-cache/no-GitHub behaviour

**Tests added/modified:**
- `20_Applications/tui/src/startup/localRepo.test.ts` — 15 new tests
- `20_Applications/tui/src/startup/orchestrator.test.ts` — 9 tests added; `makeDeps` updated
- `20_Applications/tui/src/index.test.ts` — 2 tests added; 183 total tests pass

---

## Change: Platform detection & startup host display (2026-03-22)

**Summary:** Added host platform/arch/distro detection at startup and displays it as a `log.info()` line before any prompts, with `HostInfo` propagated through `ManifestResult` for downstream use.

**Files modified:**
- `20_Applications/tui/src/host/types.ts` — new: `HostInfo` type (`platform`, `arch`, optional `distro`/`version`)
- `20_Applications/tui/src/host/detectHost.ts` — new: `detectHost()` with injectable deps; maps platform/arch, reads `/etc/os-release` on Linux
- `20_Applications/tui/src/host/detectHost.test.ts` — new: 15 tests covering all platform/arch mappings and distro parsing cases
- `20_Applications/tui/src/startup/screens.ts` — added `showHostInfo()`; extended `ClackDeps.log` with `info`
- `20_Applications/tui/src/startup/screens.test.ts` — added `logInfoCalls` tracking to `makeClack`; 6 new `showHostInfo` tests
- `20_Applications/tui/src/startup/orchestrator.ts` — added `detectHost`/`showHostInfo` to `OrchestratorDeps`; host detected first in all modes; `ManifestResult` gains `host: HostInfo`
- `20_Applications/tui/src/startup/orchestrator.test.ts` — `makeDeps` updated; 7 new platform detection tests
- `20_Applications/tui/src/index.test.ts` — `ProgramDeps` updated; all fake `runStartup` returns include `host`

**Spec updates:**
- `functional.md` — added "Platform Detection" section with user story and 9 acceptance criteria
- `technical.md` — added "Host Detection" section documenting `src/host/` module, `showHostInfo`, `ManifestResult.host`

**Tests added/modified:**
- `20_Applications/tui/src/host/detectHost.test.ts` — 15 new tests
- `20_Applications/tui/src/startup/screens.test.ts` — 6 tests added
- `20_Applications/tui/src/startup/orchestrator.test.ts` — 7 tests added; `makeDeps` updated
- `20_Applications/tui/src/index.test.ts` — `ProgramDeps` interface and all fake returns updated; 211 total tests pass

---

## Change: Host info on intro line + script download on fetch (2026-03-22)

**Summary:** Merged host info into the `intro()` title (single line instead of a separate `log.info`) and added concurrent script downloading alongside `scriptor.yaml` — scripts matching the current platform are fetched, retried up to 3 times each, and written to the cache using the same directory structure as the git repo.

**Files modified:**
- `20_Applications/tui/src/startup/screens.ts` — replaced `showHostInfo()` with `formatHostInfo(host): string` (pure function, no deps); removed `logInfoCalls` from `ClackDeps` usage
- `20_Applications/tui/src/startup/screens.test.ts` — replaced `showHostInfo` tests with `formatHostInfo` tests; cleaned up `makeClack` helper
- `20_Applications/tui/src/startup/orchestrator.ts` — removed `detectHost`/`showHostInfo` from `OrchestratorDeps`; added `host: HostInfo` to `StartupOptions`; added `fetchScript` and `parseAndFilterScripts` to `OrchestratorDeps`; combined manifest + script fetch under one `showFetchProgress("Fetching…")` spinner; added `withRetry` (3 attempts) and `downloadScripts` helpers; cache key strips leading `scripts/` prefix
- `20_Applications/tui/src/startup/orchestrator.test.ts` — rewrote `makeDeps` (no `detectHost`/`showHostInfo`; added `fetchScript`/`parseAndFilterScripts`); all `runStartup` calls now pass `host`; removed platform-detection tests that moved to `index.test.ts`; added 8 script-downloading tests
- `20_Applications/tui/src/github/githubClient.ts` — added `fetchScript(repo, path, token?, deps?): Promise<string>`
- `20_Applications/tui/src/github/githubClient.test.ts` — added 8 tests for `fetchScript`
- `20_Applications/tui/src/program.ts` — added `detectHost` to `ProgramDeps`; action handler detects host first, calls `intro("Scriptor " + formatHostInfo(host))`, passes `host` into `runStartup`
- `20_Applications/tui/src/index.ts` — wired real `detectHost` via lazy `await import()`
- `20_Applications/tui/src/index.test.ts` — added `detectHost` to `ProgramDeps` and fakes; added intro-title format test and 2 `detectHost wiring` tests

**Spec updates:**
- `functional.md` — updated "Host info display" AC (embedded in intro title, not separate line); updated Cache-First and First Run ACs to mention platform-filtered script downloads
- `technical.md` — replaced `showHostInfo` with `formatHostInfo` in Host Detection section; added "Script Download & Caching" section documenting retry count, cache key convention, and local-mode exclusion

**Tests added/modified:**
- `20_Applications/tui/src/github/githubClient.test.ts` — 8 tests added (fetchScript success + errors); 32 total
- `20_Applications/tui/src/startup/screens.test.ts` — `showHostInfo` tests replaced with `formatHostInfo` tests; 21 total
- `20_Applications/tui/src/startup/orchestrator.test.ts` — platform-detection block removed; 8 script-downloading tests added; 45 total
- `20_Applications/tui/src/index.test.ts` — `detectHost` dep added; 3 new tests (intro title format + detectHost wiring); 16 total
- 309 total unit tests pass

---

## Change: Esc/Ctrl+C exits at all prompts (2026-03-24)

**Summary:** Cancel at the repo switch and update prompts now prints "User canceled." and exits immediately instead of silently falling through to the default behavior.

**Files modified:**
- `20_Applications/tui/src/startup/screens.ts` — `ClackDeps` gained `isCancel`/`cancel`; `confirmRepoSwitch` and `promptCheckUpdates` call `clack.cancel("User canceled.")` then `exit(0)` on symbol; `showFetchProgress` gained optional `stopLabel` 4th param; `defaultClack` wired with `clackPrompts.isCancel` and `clackPrompts.cancel`
- `20_Applications/tui/src/startup/orchestrator.ts` — `OrchestratorDeps.showFetchProgress` type extended with `stopLabel?`; `makeDefaultDeps` wires `stopLabel`; `fetchStopLabel = hasCache ? "Scripts updated" : undefined` passed to both `doFetchAll` calls
- `20_Applications/tui/src/startup/screens.test.ts` — `makeClack` gains `isCancel`/`cancel`; cancel tests assert `exit(0)` instead of `false`; `stopLabel` test added

**Spec updates:**
- `functional.md` — split "declines" AC into explicit-No and Esc cases; added Esc-exits criteria for repo switch and update prompts

**Tests added/modified:**
- `20_Applications/tui/src/startup/screens.test.ts` — cancel-symbol tests updated; `stopLabel` test added
