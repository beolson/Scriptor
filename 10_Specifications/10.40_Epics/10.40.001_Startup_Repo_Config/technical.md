# Technical Standards — 001 Startup & Repo Config

## Runtime & Language
- Runtime: Bun (compiled binary via `bun build --compile`)
- Language: TypeScript (strict mode, ESNext target, Preserve module resolution)
- Version constraints: Bun latest stable; TypeScript ^5

## Key Libraries & Frameworks
- TUI: `@clack/prompts` (spinner, confirm) + `@clack/core` (custom Prompt base class where needed)
- Config parsing: `js-yaml`
- Input validation: `zod`
- Version comparison: `semver`
- HTTP: native `fetch` (built into Bun — no http client library)
- OAuth device flow: `@octokit/oauth-device` (purpose-built for GitHub device flow; pure JS); requests `scopes: ["repo"]` so the issued token can read private repository content
- No React, no Ink

## Tooling
- Build: `bun build src/index.ts --compile --define 'VERSION="<from package.json>"' --outfile ../dist/scriptor`
  - Build script reads version from `package.json` and passes via `--define`
  - Version accessible in source as the global `VERSION` constant
- Test: `bun test` (co-located `.test.ts` files, injectable deps pattern)
- Lint/Format: Biome (tabs, double quotes)
- Package manager: Bun only — never npm/npx/node

## APIs & External Services
- GitHub REST API — manifest fetch (Contents API: `api.github.com/repos/{owner}/{repo}/contents/scriptor.yaml` with `Accept: application/vnd.github.raw+json`), release version check, OAuth device flow. Note: `raw.githubusercontent.com` does not accept Bearer tokens for private repos and does not reliably resolve `HEAD` — the Contents API is used instead.
- OS keychain — platform CLI tools via Bun subprocess (no native library):
  - macOS: `security` (built-in Keychain CLI)
  - Linux: `secret-tool` (libsecret; may not be installed — treat as no-keychain if absent)
  - Windows: `cmdkey` / `powershell` Credential Manager API
  - Fallback: if CLI tool absent or fails, treat as no-keychain (no token persistence)

## Host Detection (`src/host/`)

- `src/host/types.ts` — `HostInfo { platform: "linux" | "mac" | "windows"; arch: "x86" | "arm"; distro?: string; version?: string }`
- `src/host/detectHost.ts` — `async detectHost(deps?): Promise<HostInfo>`
  - Maps `process.platform`: `win32→windows`, `darwin→mac`, anything else→`linux`
  - Maps `process.arch`: `arm64/arm→arm`, anything else→`x86`
  - On Linux: reads `/etc/os-release` via injectable `readOsRelease` dep; parses `NAME` and `VERSION_ID` (strips surrounding single or double quotes)
  - If `/etc/os-release` throws (missing/unreadable), returns `HostInfo` without `distro`/`version` — non-fatal
  - Non-Linux platforms skip the file read entirely
  - Injectable `DetectHostDeps`: `platform: string`, `arch: string`, `readOsRelease: () => Promise<string>`
- `src/startup/screens.ts` — `showHostInfo(host: HostInfo, deps?): void`
  - Calls `log.info()` with formatted string: `[platform / arch / distro version]` or `[platform / arch]`
  - `ClackDeps.log` extended with `info: (message: string) => void`
- `ManifestResult` (in `orchestrator.ts`) gains `host: HostInfo` so downstream phases can use it without re-detecting
- Platform detection runs before local-mode early-return and before all network/cache calls; `showHostInfo` is called immediately after detection

## Local Mode (`--repo=local`)

- Triggered by passing `--repo=local` on the CLI; intercepted in `program.ts` before `parseRepo` is called
- `StartupOptions.localMode: boolean` signals the orchestrator to take the local path
- `src/startup/localRepo.ts` — `findGitRoot()` and `readLocalManifest()` with injectable deps
  - `findGitRoot`: spawns `git rev-parse --show-toplevel` via `Bun.spawn`; throws `LocalRepoError` on non-zero exit or spawn failure
  - `readLocalManifest`: calls `findGitRoot`, then reads `<gitRoot>/scriptor.yaml` from disk; throws `LocalRepoError` if file absent
- `ManifestResult` gains an optional `localRoot?: string` field (absolute git root path) for use by the future script execution phase
- In local mode the orchestrator skips all of: config read/write, keychain, cache, update prompt, OAuth, and GitHub fetch
- `--repo=local` is never written to `~/.scriptor/config`

## Architecture Patterns
- Config file: `~/.scriptor/config` (YAML via `js-yaml`; missing/corrupt → silent empty config)
- Cache location: `~/.scriptor/cache/<owner>/<repo>/` (per-repo, mirrors GitHub slug)
  - Files: `manifest.yaml`, `scripts/<platform>/<distro>/script-name.sh`
- Cache-first: load from cache before any network call; prompt to update after
- TUI screen mapping (this epic):
  - Repo switch confirmation → `@clack/prompts` `confirm()`
  - Update prompt → `@clack/prompts` `confirm()`
  - Fetch/download progress → `@clack/prompts` `spinner()`
  - OAuth device-flow display → `@clack/prompts` `note()` (URL + user code box) then `spinner('Waiting for authorization…')`

## Binary Self-Update
- Pattern: download → relaunch
  1. Download new binary to `~/.scriptor/scriptor.new` (with progress via `@clack/prompts` spinner)
  2. `chmod +x` the new file (Unix) or set appropriate permissions (Windows)
  3. `exec()` the new binary with a hidden `--apply-update <old-path>` flag
  4. New binary detects `--apply-update`, moves itself over `<old-path>`, then relaunches normally
- Version source: compare current binary version against latest GitHub Release tag
- Download source: GitHub Releases asset URL for the matching platform/arch target

## Constraints & Non-Goals
- All dependencies must be pure JS/TS — no native modules (Bun binary compilation constraint)
- GitHub only — no GitLab, Bitbucket, self-hosted Git
- 6 release targets: `linux/darwin/windows × x64/arm64`
- Keychain support is best-effort; app must be fully functional with no keychain

## Open Questions
- None.
