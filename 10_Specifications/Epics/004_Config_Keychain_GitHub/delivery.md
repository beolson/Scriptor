# 004 Configuration, Keychain & GitHub Client — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — App-level Constants (`src/config.ts`)

**Status:** completed

**Description:**
Create `20_Applications/tui/src/config.ts` as the single flat file of hardcoded app-level constants. This is a pure leaf node — no I/O, no functions, no classes, no project imports. Every downstream module in this epic imports from here.

- `DEFAULT_REPO = "beolson/Scriptor"`
- `GITHUB_CLIENT_ID = "<registered OAuth App client_id>"` (non-secret public value)
- `KEYCHAIN_SERVICE = "scriptor"`
- `KEYCHAIN_ACCOUNT = "github-token"`
- `SCRIPTOR_DIR = \`${process.env.HOME}/.scriptor\``
- `CACHE_DIR = \`${SCRIPTOR_DIR}/cache\``
- `CONFIG_PATH = \`${SCRIPTOR_DIR}/config\``
- Only `export const` declarations — no functions, classes, or I/O

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/tui/src/config.test.ts` that imports `DEFAULT_REPO` from `./config.js` — fails with "Cannot find module" until the file exists
- **GREEN:** Create `src/config.ts` with all constant declarations to make the test pass
- Cover: `DEFAULT_REPO` equals `"beolson/Scriptor"`; `KEYCHAIN_SERVICE` equals `"scriptor"`; `KEYCHAIN_ACCOUNT` equals `"github-token"`; `SCRIPTOR_DIR` is a string containing `"/.scriptor"`; `CACHE_DIR` starts with `SCRIPTOR_DIR`; `CONFIG_PATH` starts with `SCRIPTOR_DIR`

---

## Task 2 — Config File Service (`src/config/configService.ts`)

**Status:** completed

**Description:**
Create `20_Applications/tui/src/config/configService.ts` with three exported functions: `readConfig`, `writeConfig`, and `resolveRepo`. This module handles reading and writing `~/.scriptor/config` as YAML and resolving the final repo string from CLI flag + stored config.

- `readConfig(deps?)` — reads `CONFIG_PATH`, parses with `js-yaml`, validates with Zod (`{ repo: z.string().optional() }`). On any failure (missing file, invalid YAML, schema error) returns `{}` silently (AC-CFG-1). Never throws.
- `writeConfig(config, deps?)` — creates `~/.scriptor/` if missing, writes `config` as valid YAML to `CONFIG_PATH`. Uses `Bun.write()` which creates parent dirs automatically (AC-CFG-5).
- `resolveRepo(cliRepo, deps?)` — implements priority logic (AC-CFG-3, AC-CFG-4):
  1. Read config via `readConfig()`
  2. If `cliRepo` equals `DEFAULT_REPO` and config has a `repo` field → return config repo (no prompt)
  3. If `cliRepo` differs from config `repo` (both set and different) → show `confirm()`: `"--repo flag is different from your saved repo (config). Use [cliRepo] instead of [config.repo]?"`
  4. On confirm → call `writeConfig({ repo: cliRepo })`, return `cliRepo`
  5. On decline → return `config.repo` without writing
  6. If no config repo and `cliRepo` is not default → use `cliRepo` directly (no prompt needed)
- Injectable deps: `readFileFn`, `writeFileFn`, `existsFn`, `confirmFn`

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/config/configService.test.ts` importing all three functions before writing any implementation
- **GREEN:** Implement `configService.ts` using `js-yaml`, Zod, and injectable deps
- Cover: `readConfig` with valid YAML containing a `repo` field → returns `{ repo: "..." }`; `readConfig` with missing file (readFileFn throws) → returns `{}`; `readConfig` with invalid YAML → returns `{}`; `readConfig` with valid YAML but unknown fields → returns `{}` (Zod strips extra fields); `writeConfig` calls `writeFileFn` with valid YAML string; `resolveRepo` returns `DEFAULT_REPO` when no config and no CLI flag; `resolveRepo` returns config repo when `cliRepo` is default and config has a repo; `resolveRepo` shows confirm prompt when `cliRepo` differs from config repo; on confirm → saves `cliRepo` to config and returns `cliRepo`; on decline → returns config repo without writing; `resolveRepo` returns `cliRepo` directly when config has no `repo` and `cliRepo` is non-default

---

## Task 3 — Keychain Service (`src/keychain/keychainService.ts`)

**Status:** completed

**Description:**
Create `20_Applications/tui/src/keychain/keychainService.ts` with three synchronous exported functions: `getToken`, `setToken`, `deleteToken`. All use `Bun.spawnSync` to invoke platform-native CLI tools. All silently no-op on any failure (AC-KEY-2).

Platform dispatch keyed on `process.platform`:

| Platform | `get` | `set` | `delete` |
|---|---|---|---|
| `darwin` | `security find-generic-password -s scriptor -a github-token -w` | `security add-generic-password -s scriptor -a github-token -w <token> -U` | `security delete-generic-password -s scriptor -a github-token` |
| `linux` | `secret-tool lookup service scriptor account github-token` | `secret-tool store --label=scriptor service scriptor account github-token` (token via stdin) | `secret-tool clear service scriptor account github-token` |
| `win32` | `cmdkey /list` + parse output for `scriptor:github-token` entry | `cmdkey /add:scriptor:github-token /user:github-token /pass:<token>` | `cmdkey /delete:scriptor:github-token` |

- `getToken()` returns `string | undefined` — the raw stdout on success (trimmed), `undefined` on any failure or non-zero exit
- `setToken(token)` — void, silently no-ops on failure
- `deleteToken()` — void, silently no-ops on failure
- Unknown platform → all operations silently no-op and return `undefined`
- Injectable deps: `spawnSyncFn`, `platformFn`

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/keychain/keychainService.test.ts` that import and call all three functions with injected `spawnSyncFn` and `platformFn` before writing any implementation
- **GREEN:** Implement `keychainService.ts` with platform dispatch and silent error handling
- Cover: `getToken` on `darwin` calls `security find-generic-password ...` and returns trimmed stdout; `getToken` when spawnSync returns non-zero exit code → returns `undefined`; `getToken` when spawnSync throws → returns `undefined`; `setToken` on `darwin` calls `security add-generic-password` with `-U` flag; `deleteToken` on `darwin` calls `security delete-generic-password`; `getToken` on `linux` calls `secret-tool lookup ...`; `setToken` on `linux` passes token via stdin; `getToken` on `win32` parses cmdkey output; `getToken` on unknown platform → returns `undefined`; `setToken` on unknown platform → no-ops silently; `deleteToken` on unknown platform → no-ops silently

---

## Task 4 — OAuth Device Flow (`src/github/oauth.ts`)

**Status:** completed

**Description:**
Create `20_Applications/tui/src/github/oauth.ts` exporting a single async function `runDeviceFlow(deps?)` that wraps `@octokit/auth-oauth-device`'s `createOAuthDeviceAuth`. The library handles the full polling loop internally (AC-OA-2 steps 1–6).

- Uses `createOAuthDeviceAuth({ clientType: "oauth-app", clientId: GITHUB_CLIENT_ID, scopes: ["repo"], onVerification })` (AC-OA-2)
- `onVerification` calls `log.note(...)` displaying the verification URI and user code (AC-OA-2 step 2)
- Returns `token` string from `auth({ type: "oauth" })`
- On `expired_token` or `access_denied` the library throws — let errors propagate to the caller (`githubClient` handles them)
- No user-facing timeout (AC-OA-3) — polls until user acts or GitHub rejects
- Injectable deps: `createAuthFn` (replaces `createOAuthDeviceAuth`), `logNoteFn` (replaces `log.note`)

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/github/oauth.test.ts` that import `runDeviceFlow` and inject mock deps before writing any implementation
- **GREEN:** Implement `oauth.ts` using `createOAuthDeviceAuth` and injectable deps
- Cover: `runDeviceFlow` calls `createAuthFn` with `clientId` from `GITHUB_CLIENT_ID` and `scopes: ["repo"]`; `onVerification` callback calls `logNoteFn` with a string containing the verification URI and user code; `runDeviceFlow` returns the token string on success; when `createAuthFn` throws, `runDeviceFlow` lets it propagate (does not swallow)

---

## Task 5 — GitHub API Client (`src/github/githubClient.ts`)

**Status:** completed

**Description:**
Create `20_Applications/tui/src/github/githubClient.ts` exporting `fetchContent(path, repo, token, deps?)`. This is the most complex module in the epic: it handles the Contents API, bearer auth, exponential-backoff retry on network errors, and transparent OAuth re-authentication on 401/403/404.

- Builds URL: `https://api.github.com/repos/{owner}/{name}/contents/{path}` with `Accept: application/vnd.github.raw+json` header (AC-GH-1)
- Sends `Authorization: Bearer <token>` when token is present (AC-GH-2)
- **Retry logic** (AC-GH-3): on non-auth HTTP error or network failure, retry up to 3 times with delays `[1000, 2000, 4000]` ms (custom implementation — no retry library). After 3 failures, throw.
- **Auth handling** (AC-GH-4): on 401, 403, or (404 with no token) — call `runDeviceFlow()` to get a fresh token, store it via `setToken()`, retry the request once. If the retry also fails, throw.
- On success (2xx) — return response body as string
- On 404 with a token present — throw immediately (repo genuinely not found — do not trigger OAuth)
- Injectable deps: `fetchFn`, `runDeviceFlowFn`, `setTokenFn`, `sleepFn`

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/github/githubClient.test.ts` that import `fetchContent` and inject all deps before writing any implementation
- **GREEN:** Implement `githubClient.ts` with retry and auth logic
- Cover: successful 200 response → returns body string; request includes `Accept: application/vnd.github.raw+json`; request includes `Authorization: Bearer <token>` when token is provided; request omits Authorization header when token is `undefined`; network error on first call → retries; retries at 1 s, 2 s, 4 s delays; three consecutive failures → throws; 401 response → calls `runDeviceFlowFn`, stores token via `setTokenFn`, retries with new token; 403 response → same re-auth flow as 401; 404 with no token → triggers re-auth flow; 404 with a token present → throws immediately (no retry, no re-auth); retry after re-auth fails → throws; re-auth happy path → original request succeeds after token stored

---

## Task 6 — Cache Service (`src/cache/cacheService.ts`)

**Status:** completed

**Description:**
Create `20_Applications/tui/src/cache/cacheService.ts` with five read/write/exists primitives and one UI prompt. This module provides the building blocks for the cache hit/miss decision loop that Epic 6 orchestrates — it does not implement the loop itself.

Cache root: `~/.scriptor/cache/<owner>/<repo>/` (derived from `CACHE_DIR` constant).

- `readCachedManifest(repo, deps?)` → reads `<cache-root>/manifest.yaml`, returns content string or `undefined` if not present
- `writeCachedManifest(repo, content, deps?)` → writes to `<cache-root>/manifest.yaml`; parent dirs created automatically by `Bun.write()`
- `readCachedScript(repo, scriptPath, deps?)` → reads `<cache-root>/<scriptPath>`, returns content or `undefined` if not present. `scriptPath` mirrors the manifest `script` field verbatim (e.g. `scripts/Debian/13/install-bun.sh`) (AC-CACHE-1)
- `writeCachedScript(repo, scriptPath, content, deps?)` → writes to `<cache-root>/<scriptPath>`; parent dirs created automatically
- `cacheExists(repo, deps?)` → returns `true` if `<cache-root>/manifest.yaml` exists, `false` otherwise (AC-CACHE-2, AC-CACHE-3)
- `promptCacheUpdate(deps?)` → displays `confirm()` prompt with message `"Cache found. Check for updates?"`, returns the boolean result (AC-CACHE-3)
- Cache root is constructed as `path.join(CACHE_DIR, repo.owner, repo.name)`
- Injectable deps: `readFileFn`, `writeFileFn`, `existsFn`, `confirmFn`

**TDD Approach:**
- **RED:** Write failing tests in `20_Applications/tui/src/cache/cacheService.test.ts` that import all six exports and inject mock deps before writing any implementation
- **GREEN:** Implement `cacheService.ts` with all six functions
- Cover: `cacheExists` returns `true` when `existsFn` returns `true` for the manifest path; `cacheExists` returns `false` when `existsFn` returns `false`; `readCachedManifest` calls `readFileFn` with the correct path and returns content; `readCachedManifest` returns `undefined` when `readFileFn` throws; `writeCachedManifest` calls `writeFileFn` with the correct path and content; `readCachedScript` uses `scriptPath` verbatim as the sub-path under cache root; `writeCachedScript` writes to the same path; `promptCacheUpdate` calls `confirmFn` with the exact message `"Cache found. Check for updates?"` and returns its boolean result; cache root includes `repo.owner` and `repo.name` as path segments; two different `Repo` values produce different cache roots
