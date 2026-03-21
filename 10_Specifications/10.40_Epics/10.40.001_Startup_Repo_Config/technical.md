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
- OAuth device flow: `@octokit/oauth-device` (purpose-built for GitHub device flow; pure JS)
- No React, no Ink

## Tooling
- Build: `bun build src/index.ts --compile --define 'VERSION="<from package.json>"' --outfile ../dist/scriptor`
  - Build script reads version from `package.json` and passes via `--define`
  - Version accessible in source as the global `VERSION` constant
- Test: `bun test` (co-located `.test.ts` files, injectable deps pattern)
- Lint/Format: Biome (tabs, double quotes)
- Package manager: Bun only — never npm/npx/node

## APIs & External Services
- GitHub REST API — manifest fetch, release version check, OAuth device flow
- OS keychain — platform CLI tools via Bun subprocess (no native library):
  - macOS: `security` (built-in Keychain CLI)
  - Linux: `secret-tool` (libsecret; may not be installed — treat as no-keychain if absent)
  - Windows: `cmdkey` / `powershell` Credential Manager API
  - Fallback: if CLI tool absent or fails, treat as no-keychain (no token persistence)

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
