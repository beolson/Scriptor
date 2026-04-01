# Technical Standards — 004 Configuration, Keychain & GitHub Client

## Runtime & Language

All standards from Epic 001 apply. Key constraints repeated for reference:

- **Runtime**: Bun only. Never use Node, npm, npx, or yarn.
- **Language**: TypeScript 5, strict mode.
- **Imports**: `.js` extensions on all relative imports (bundler-mode resolution).

## Key Libraries & Frameworks

No new runtime dependencies are introduced in this epic. All required packages are already in `20_Applications/tui/package.json`:

- **`@octokit/auth-oauth-device` ^8.0.3** — handles the full OAuth device flow (code request, polling, token retrieval) via `createOAuthDeviceAuth`
- **`@clack/prompts` ^0.10.0** — `confirm()` for repo-switch and cache-update prompts; `log.note()` for OAuth device code display
- **`js-yaml` ^4.1.1** — parses and serializes `~/.scriptor/config` YAML
- **`@types/js-yaml` ^4.0.9** — type definitions for js-yaml
- **`zod` ^4.3.6** — validates the parsed config struct

## Module Locations

| Module | Path |
|--------|------|
| App-level constants | `20_Applications/tui/src/config.ts` |
| Config file service | `20_Applications/tui/src/config/configService.ts` |
| Keychain service | `20_Applications/tui/src/keychain/keychainService.ts` |
| GitHub API client | `20_Applications/tui/src/github/githubClient.ts` |
| OAuth device flow | `20_Applications/tui/src/github/oauth.ts` |
| Cache service | `20_Applications/tui/src/cache/cacheService.ts` |

### `src/config.ts` — hardcoded constants

All app-level hardcoded values live in a single flat file. This is the canonical source of truth for constants used across modules:

```ts
export const DEFAULT_REPO = "beolson/Scriptor";
export const GITHUB_CLIENT_ID = "<registered OAuth App client_id>";
export const KEYCHAIN_SERVICE = "scriptor";
export const KEYCHAIN_ACCOUNT = "github-token";
export const SCRIPTOR_DIR = `${process.env.HOME}/.scriptor`;
export const CACHE_DIR = `${SCRIPTOR_DIR}/cache`;
export const CONFIG_PATH = `${SCRIPTOR_DIR}/config`;
```

> **Note**: `GITHUB_CLIENT_ID` is a non-secret public value (like GitHub CLI's `client_id`). Safe to commit.

Only `export const` declarations — no functions, classes, or I/O.

## APIs & External Services

- **`@octokit/auth-oauth-device` `createOAuthDeviceAuth()`** — device flow; handles code request, `onVerification` callback, polling loop
- **`fetch()`** (Bun global) — all GitHub Contents API requests
- **`Bun.file(path).text()` / `Bun.write(path, content)`** — reads and writes config and cache files
- **`Bun.file(path).exists()`** — cache and config existence checks
- **`Bun.spawnSync()`** — invokes platform-native keychain CLI tools
- **`process.platform`** — keychain platform dispatch

## Architecture Patterns

### configService — config file read/write + repo resolution

```ts
// Read — always returns a Config (possibly empty {}). Never throws.
export async function readConfig(deps?: ConfigDeps): Promise<Config>

// Write — creates ~/.scriptor/ if missing, then writes valid YAML.
export async function writeConfig(config: Config, deps?: ConfigDeps): Promise<void>

// Resolve final repo string from CLI flag + config, including repo-switch prompt.
// Returns the resolved repo string.
export async function resolveRepo(cliRepo: string, deps?: ConfigDeps): Promise<string>
```

**`resolveRepo` logic** (AC-CFG-3, AC-CFG-4):
1. Read config via `readConfig()`.
2. If `cliRepo` matches default AND config has a `repo` field → use config repo.
3. If `cliRepo` differs from config `repo` (both non-default, or explicitly passed `--repo`) → show `confirm()` prompt.
4. On confirm: save `cliRepo` to config via `writeConfig()`, return `cliRepo`.
5. On decline: return config repo without modifying config.
6. Priority: CLI flag → config repo → `DEFAULT_REPO`.

On `readConfig` failure (missing file, invalid YAML, schema error) → return `{}` silently (AC-CFG-1).

### keychainService — platform-native keychain

Three operations: `get`, `set`, `delete`. All use `Bun.spawnSync` to invoke the platform CLI. All silently no-op on any failure (AC-KEY-2).

```ts
export function getToken(deps?: KeychainDeps): string | undefined
export function setToken(token: string, deps?: KeychainDeps): void
export function deleteToken(deps?: KeychainDeps): void
```

**Platform dispatch** (keyed on `process.platform`):

| `process.platform` | CLI | `get` | `set` | `delete` |
|---|---|---|---|---|
| `darwin` | `security` | `find-generic-password -s scriptor -a github-token -w` | `add-generic-password -s scriptor -a github-token -w <token> -U` | `delete-generic-password -s scriptor -a github-token` |
| `linux` | `secret-tool` | `lookup service scriptor account github-token` | `store --label=scriptor service scriptor account github-token` (token via stdin) | `clear service scriptor account github-token` |
| `win32` | `cmdkey` | `cmdkey /list` + parse output for `scriptor:github-token` entry | `cmdkey /add:scriptor:github-token /user:github-token /pass:<token>` | `cmdkey /delete:scriptor:github-token` |

Functions are synchronous (`spawnSync`) since keychain operations are fast and blocking is acceptable at startup.

### githubClient — Contents API + auth + retry

```ts
export async function fetchContent(
  path: string,
  repo: Repo,
  token: string | undefined,
  deps?: GithubClientDeps,
): Promise<string>
```

**Retry logic** (AC-GH-3): up to 3 retries on non-auth errors with exponential backoff: `[1000, 2000, 4000]` ms. Custom implementation — no retry library.

**Auth handling** (AC-GH-4) — handled internally:
1. Receive 401, 403, or (404 with no token).
2. Call `runDeviceFlow()` (from `src/github/oauth.ts`) to get a fresh token.
3. Store token via `keychainService.setToken()`.
4. Retry the request once with the new token.
5. If the retry also fails, throw.

Callers receive a result string or a thrown `Error`. No auth complexity leaks to callers.

### oauth — device flow

```ts
export async function runDeviceFlow(deps?: OAuthDeps): Promise<string>
```

Uses `createOAuthDeviceAuth`:

```ts
const auth = createOAuthDeviceAuth({
  clientType: "oauth-app",
  clientId: GITHUB_CLIENT_ID,
  scopes: ["repo"],
  onVerification: (v) => {
    log.note(`Open ${v.verification_uri}\nEnter code: ${v.user_code}`);
  },
});
const { token } = await auth({ type: "oauth" });
return token;
```

`@octokit/auth-oauth-device` handles the full polling loop internally (AC-OA-2 steps 1–6), including `authorization_pending`, `slow_down`, `expired_token`, and `access_denied`.

On `expired_token` or `access_denied`: the library throws; `runDeviceFlow` lets it propagate. The caller (githubClient) surfaces it via `log.error()` and `process.exit(1)`.

No user-facing timeout (AC-OA-3).

### cacheService — manifest and script file cache

```ts
export async function readCachedManifest(repo: Repo, deps?: CacheDeps): Promise<string | undefined>
export async function writeCachedManifest(repo: Repo, content: string, deps?: CacheDeps): Promise<void>
export async function readCachedScript(repo: Repo, scriptPath: string, deps?: CacheDeps): Promise<string | undefined>
export async function writeCachedScript(repo: Repo, scriptPath: string, content: string, deps?: CacheDeps): Promise<void>
export async function cacheExists(repo: Repo, deps?: CacheDeps): Promise<boolean>

// Prompts "Cache found. Check for updates?" and returns the user's choice.
export async function promptCacheUpdate(deps?: CacheDeps): Promise<boolean>
```

Cache root: `~/.scriptor/cache/<owner>/<repo>/`. `Bun.write()` creates parent directories automatically.

Cache miss/hit behaviour (AC-CACHE-2, AC-CACHE-3) is orchestrated by the **caller** (Epic 6's `fetch.ts`). `cacheService` provides the read/write/exists primitives and the `promptCacheUpdate()` prompt — it does not implement the full fetch-or-use-cache decision loop itself.

### Injectable deps pattern

All I/O modules accept an optional typed `deps` argument for unit testability (same pattern as `detectHost` in Epic 002):

| Module | Injected dep(s) |
|---|---|
| `configService` | `readFileFn`, `writeFileFn`, `existsFn`, `confirmFn` |
| `keychainService` | `spawnSyncFn`, `platformFn` |
| `githubClient` | `fetchFn`, `runDeviceFlowFn`, `setTokenFn`, `sleepFn` |
| `oauth` | `createAuthFn`, `logNoteFn` |
| `cacheService` | `readFileFn`, `writeFileFn`, `existsFn`, `confirmFn` |

Production callers pass no `deps`. Tests inject mocks.

## Tooling

No new tooling. Same as Epic 001: Bun test, Biome, TypeScript strict.

## Constraints & Non-Goals

- No new npm/bun runtime packages. All required packages are already present.
- Keychain operations are synchronous (`spawnSync`) and silently no-op on any failure (AC-KEY-2).
- Cache has no TTL or automatic expiry — user-driven refresh only (AC-CACHE-5).
- `src/config.ts` contains only `export const` declarations — no classes, functions, or I/O.
- `readConfig` never throws — all errors produce an empty `{}`.
- Per-repo keychain tokens are out of scope (single shared token).
- Config fields beyond `repo` are out of scope.
- Startup orchestration (`src/startup/`) and spinner UX are Epic 6, not this epic.

## Open Questions

_None remaining._
