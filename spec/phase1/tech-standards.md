# Scriptor Phase 1 — Technical Standards & Requirements

_Living document. Updated via Q&A elicitation. Last updated: 2026-02-28._

---

## 1. Core Stack

| Concern | Decision |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime / Compiler | Bun.js — latest stable |
| TUI Framework | Ink.js — latest stable |
| Code Style / Linting | Biome (lint + format) |

> **Rule:** Always use Bun in place of Node.js and npm. This means:
> - `bun` / `bunx` instead of `node` / `npx`
> - `bun install` / `bun add` instead of `npm install`
> - `bun test` instead of any external test runner
> - `bun build` for compilation and bundling
> - `bun run <script>` instead of `npm run <script>`
>
> Do not introduce Node.js-specific APIs, `require()`, or CommonJS modules. All code targets Bun's runtime.

---

## 2. Platform Targets

| OS | Architectures |
|---|---|
| Windows | x86, ARM |
| Linux | x86, ARM |
| macOS | x86, ARM |

Total: **6 binary artifacts** per release.

---

## 3. Distribution & CI/CD

### 3.1 Release Artifacts
- Compiled binaries for all 6 platform/architecture combinations are published as **GitHub Release assets**.
- Each release asset is a **standalone executable** — no installer, no runtime dependency.

### 3.2 Binary Naming Convention
| Platform | Arch | Filename |
|---|---|---|
| Linux | x86 | `scriptor-linux-x64` |
| Linux | ARM | `scriptor-linux-arm64` |
| macOS | x86 | `scriptor-darwin-x64` |
| macOS | ARM | `scriptor-darwin-arm64` |
| Windows | x86 | `scriptor-windows-x64.exe` |
| Windows | ARM | `scriptor-windows-arm64.exe` |

### 3.3 CI/CD Pipeline
- **GitHub Actions** is the CI platform.
- All 6 binaries are produced via **Bun cross-compilation** (`bun build --compile --target=<platform>`) from a single Linux runner — no per-platform build matrix needed.
- Release workflow: on git tag push → compile 6 artifacts → upload all as GitHub Release assets.
- Biome check runs in CI and fails the build on violations.

---

## 4. Authentication (Private Repositories)

- Authentication uses **GitHub OAuth** (Authorization Code Flow) — no static PAT.
- The `--token <pat>` CLI parameter from the functional requirements is **removed**. OAuth is the only auth mechanism. The `--repo` CLI parameter is unchanged.
- The OAuth flow is **only triggered** when a private repository is encountered (e.g. on a 401/403 response). Public repos require no authentication.

### 4.1 OAuth Flow
When a private repo is detected, Scriptor:
1. Spawns a **temporary localhost HTTP server** to receive the OAuth callback.
2. Opens the user's default browser to GitHub's OAuth authorization URL.
3. Receives the auth code at the localhost callback and exchanges it for an access token.
4. Uses the token for all API requests in the current session.

### 4.2 OAuth App Registration
- A **GitHub OAuth App** is registered under the **GitHub organization** (not an individual account).
- The OAuth App's client ID is **embedded in the compiled binary**.
- The OAuth App's registered redirect URIs include all candidate localhost callback ports.

### 4.3 Callback Server Port
- The callback server tries a **fixed primary port** first; falls back to one or more alternate ports if the primary is in use.
- Specific port values TBD at implementation; all candidate ports must be registered in the GitHub OAuth App.

### 4.4 Token Persistence
- The OAuth token is **not persisted to disk** — held in memory for the duration of the current session only.
- The user re-authenticates on each new invocation against a private repository.

---

## 5. GitHub API & Caching

### 5.1 Commit Hash Cache Invalidation
- On each startup, Scriptor calls the **GitHub Commits API** to retrieve the latest commit hash for the script repository.
- The hash is compared to the **last-known commit hash** stored in `~/.scriptor/cache/`.
- If the hash is **unchanged** → cached scripts and manifest are current; no downloads performed.
- If the hash is **newer** → re-fetch `scriptor.yaml` and all applicable scripts.

### 5.2 Script Download Strategy
- When a re-fetch is required, scripts are downloaded **sequentially** — one at a time.
- Progress display (`Fetching script 1 of N: <name>`) directly corresponds to download order.

### 5.3 Network Timeout
- All GitHub API requests have a **10-second timeout**.
- On timeout or network failure, Scriptor falls back to the local cache and displays a warning banner.

### 5.4 Offline Fallback
- Cache (scripts, manifest, and stored commit hash) is used as a fallback when GitHub is unreachable.
- Cached scripts remain executable in offline mode (per functional requirements).

---

## 6. Configuration & Local Storage

### 6.1 Config File
- `~/.scriptor/config` uses **YAML** format.
- Contents: custom repository URL (if set). No token stored (OAuth token is in-memory only).

### 6.2 Cache Directory
- `~/.scriptor/cache/` stores: downloaded scripts, `scriptor.yaml` manifest, and the last-known commit hash.

### 6.3 Log Files
- One log file per run, written to `~/.scriptor/logs/`, named by timestamp (e.g. `2026-02-28T14-32-00.log`).
- **No automatic cleanup** — log files accumulate indefinitely. Users manage their own log history.

---

## 7. Script Execution

- Scripts run as **child processes** with **no execution timeout** — they run until they exit naturally.
- If a script hangs, the user must wait (quit is blocked while any script is running, per functional requirements).

---

## 8. Testing

- **Unit tests only** for Phase 1, using **Bun's built-in test runner** (`bun test`).
- Coverage targets: manifest parsing, platform/arch filtering, dependency graph resolution, CLI argument parsing, config read/write.
- No integration tests or TUI E2E tests in Phase 1.

---

## 9. Outstanding Questions

| # | Area | Question | Status |
|---|---|---|---|
| 1 | OAuth Ports | Specific primary and fallback port values for OAuth callback | Pending (implementation decision) |
| 2 | Default Repo | Default hardcoded script repository (`owner/repo`) | Pending (product decision) |
