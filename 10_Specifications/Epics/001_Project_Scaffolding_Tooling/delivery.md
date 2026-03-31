# 001 Project Scaffolding & Tooling — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Bash Install Script

**Status:** completed

**Description:**
Author the bash install script that Linux and macOS users run to install Scriptor (AC-INST). The script detects the host OS and CPU architecture, downloads the correct binary from the GitHub Release assets, installs it to an appropriate PATH location, and prints an upgrade message if a previous version is already installed.

Install location priority:
- If `~/.local/bin` is on `$PATH` → install there (no `sudo` required)
- Otherwise → `/usr/local/bin` (prompts for `sudo`)

Source path: `20_Applications/tui/src/install`
Output (via `scripts/build.ts`): `dist/install`

- Detect platform with `uname -s` (`Linux` / `Darwin`) and arch with `uname -m` (`x86_64` / `aarch64`)
- Map to binary name: e.g. `scriptor-linux-x64`, `scriptor-darwin-arm64`
- Download URL: `https://github.com/<owner>/scriptor/releases/download/<tag>/<binary>`
- If `scriptor` already exists at install path, read its version, overwrite, and print `Updated scriptor from vX.Y.Z to vA.B.C`
- Exit non-zero on any unrecognized platform or arch

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/tui/src/install.test.ts` that reads `src/install` via `readFileSync` and asserts the file exists and contains the expected logic signatures
- **GREEN:** Write `src/install` to satisfy all assertions
- Cover: file exists and is non-empty; `uname -s` platform detection; `uname -m` arch detection; `~/.local/bin` PATH check; `curl` download with correctly templated URL; presence of upgrade message text `Updated scriptor from`; non-zero exit on unknown platform/arch

**Implementation Notes:**
- Created `20_Applications/tui/src/test-setup.ts` — empty preload file required by `bunfig.toml` (was missing, causing all tests in the workspace to fail with "preload not found")
- Created `20_Applications/tui/src/install.test.ts` — 11 assertions covering: file exists and non-empty; `uname -s`; `uname -m`; `.local/bin` PATH check; `curl`/GitHub URL; upgrade message text; `exit 1` for unknown platform; linux/darwin strings; x86_64/aarch64 strings
- Created `20_Applications/tui/src/install` — executable bash script (`set -euo pipefail`) that: detects OS via `uname -s` (Linux/Darwin/exit 1); detects arch via `uname -m` (x86_64→x64, aarch64/arm64→arm64/exit 1); prefers `~/.local/bin` on PATH else falls back to `/usr/local/bin` with `sudo`; downloads via `curl` from the GitHub Releases URL; detects existing version for upgrade message; prints "Updated scriptor from X to Y" on upgrade
- All 11 tests pass; `bun run lint`, `bun run format`, `bun run typecheck`, and `bun run test:unit` all pass cleanly

---

## Task 2 — PowerShell Install Script

**Status:** completed

**Description:**
Author the PowerShell install script that Windows users run to install Scriptor (AC-INST). Detects CPU architecture, downloads the correct Windows binary, and installs it to `AppData\Local\Microsoft\WindowsApps`. Prints an upgrade message if a previous version already exists.

Source path: `20_Applications/tui/src/install-win`
Output (via `scripts/build.ts`): `dist/install-win`

- Detect arch via `$env:PROCESSOR_ARCHITECTURE` (`AMD64` → `x64`, `ARM64` → `arm64`)
- Construct binary name: `scriptor-windows-x64.exe` or `scriptor-windows-arm64.exe`
- Download URL: same GitHub Release pattern as bash script
- Install to `$env:LOCALAPPDATA\Microsoft\WindowsApps\scriptor.exe`
- If binary already exists, read its version, overwrite, and print `Updated scriptor from vX.Y.Z to vA.B.C`

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/tui/src/install-win.test.ts` that reads `src/install-win` via `readFileSync` and asserts the file exists and contains the expected logic signatures
- **GREEN:** Write `src/install-win` to satisfy all assertions
- Cover: file exists and is non-empty; `PROCESSOR_ARCHITECTURE` arch detection; `AMD64` mapped to `x64`, `ARM64` mapped to `arm64`; correct binary name patterns (`scriptor-windows-x64.exe`, `scriptor-windows-arm64.exe`); `LocalAppData\Microsoft\WindowsApps` install path; upgrade message text `Updated scriptor from`

**Implementation Notes:**
- Created `20_Applications/tui/src/install-win.test.ts` — 9 assertions covering: file exists and non-empty; `PROCESSOR_ARCHITECTURE` detection; `AMD64`→`x64` and `ARM64`→`arm64` mappings; literal binary names `scriptor-windows-x64.exe` and `scriptor-windows-arm64.exe`; `LocalAppData\Microsoft\WindowsApps` install path; GitHub releases download URL; upgrade message text
- Created `20_Applications/tui/src/install-win` — PowerShell script (`$ErrorActionPreference = "Stop"`) that: detects arch via `$env:PROCESSOR_ARCHITECTURE` (AMD64/ARM64/exit 1); assigns binary name directly in each switch branch so literals are present for test assertions; resolves latest release tag via GitHub API unless `$env:SCRIPTOR_VERSION` is set; downloads via `Invoke-WebRequest` to a temp file; installs to `$env:LocalAppData\Microsoft\WindowsApps\scriptor.exe`; detects existing version for upgrade message; prints "Updated scriptor from X to Y" on upgrade
- All 20 tests (11 from Task 1 + 9 from Task 2) pass; `bun run lint`, `bun run format`, and `bun run typecheck` all pass cleanly

---

## Task 3 — TUI Build Script

**Status:** completed

**Description:**
Author `20_Applications/tui/scripts/build.ts`, the script invoked by `bun run build` in the TUI workspace (AC-MONO, AC-REL). It must:
1. Cross-compile all 6 platform binaries to `../../dist/` at the repo root using `bun build --compile`
2. Copy `src/install` and `src/install-win` to `../../dist/install` and `../../dist/install-win`
3. Make the copied install scripts executable (`chmod +x`)

The 6 targets:

| Flag | Output filename |
|---|---|
| `bun-linux-x64` | `scriptor-linux-x64` |
| `bun-linux-arm64` | `scriptor-linux-arm64` |
| `bun-darwin-x64` | `scriptor-darwin-x64` |
| `bun-darwin-arm64` | `scriptor-darwin-arm64` |
| `bun-windows-x64` | `scriptor-windows-x64.exe` |
| `bun-windows-arm64` | `scriptor-windows-arm64.exe` |

Use the injectable deps pattern: export a `BuildRunner` interface and a `build(runner)` function so tests inject a mock. The production default uses `Bun.spawn`.

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/tui/scripts/build.test.ts` that imports `build()` and `TARGETS` from `./build.ts`, injects a mock `BuildRunner`, and asserts the correct commands are issued for every target and both install scripts
- **GREEN:** Implement `build.ts` with the injectable `BuildRunner` interface and wire up production `Bun.spawn` calls as the default
- Cover: all 6 `{ target, outfile }` pairs called with correct `--compile --target --outfile` args; `src/install` copied to `../../dist/install`; `src/install-win` copied to `../../dist/install-win`; `chmod +x` called on both copied install scripts

**Implementation Notes:**
- Created `20_Applications/tui/scripts/` directory
- Created `20_Applications/tui/scripts/build.test.ts` — 12 assertions covering: TARGETS array has exactly 6 entries; each target/outfile pair is correct for all 6 platforms; compile called 6 times with `--compile`, `--target=`, and `--outfile=` flags; `src/install` copied to `dist/install`; `src/install-win` copied to `dist/install-win`; `chmod +x` called on both copied install scripts
- Created `20_Applications/tui/scripts/build.ts` — exports `BuildTarget` interface, `TARGETS` constant (6 entries), `BuildRunner` interface (compile/copyFile/chmod), and `build(runner)` function; production default runner uses `Bun.spawn` for compile and `chmod`, and `node:fs/promises` `copyFile` for file copies; runs when `import.meta.main` is true
- All 32 tests (11 Task 1 + 9 Task 2 + 12 Task 3) pass; `bun run lint`, `bun run format`, `bun run typecheck`, and `bun run test:unit` all pass cleanly

---

## Task 4 — Fix CI Workflow Paths

**Status:** completed

**Description:**
The existing `.github/workflows/ci.yml` uses `working-directory: web` for the Playwright install step, but the web workspace lives at `20_Applications/web` (AC-CI). The incorrect path will cause the E2E job to fail because `playwright.config.ts` won't be found.

Change: `working-directory: web` → `working-directory: 20_Applications/web` in the `e2e` job's Playwright install step.

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/tui/src/ci-workflow.test.ts` that reads `../../.github/workflows/ci.yml`, parses it with `js-yaml`, and asserts that every `working-directory` value in the `e2e` job equals `20_Applications/web`
- **GREEN:** Update `ci.yml` with the correct path
- Cover: `Install Playwright browsers` step has `working-directory: 20_Applications/web`; no bare `working-directory: web` remains anywhere in the file

**Implementation Notes:**
- Created `20_Applications/tui/src/ci-workflow.test.ts` — 3 assertions covering: YAML parses successfully; `Install Playwright browsers` step has `working-directory: 20_Applications/web`; no step in any job has bare `working-directory: web`
- Updated `.github/workflows/ci.yml` — changed `working-directory: web` to `working-directory: 20_Applications/web` in the `e2e` job's `Install Playwright browsers` step
- Note: path in test uses `../../../.github/workflows/ci.yml` (3 levels up from `src/`) to reach the repo root correctly
- All 35 tests (11 Task 1 + 9 Task 2 + 12 Task 3 + 3 Task 4) pass; `bun run lint`, `bun run format`, `bun run typecheck`, and `bun run test:unit` all pass cleanly

---

## Task 5 — Fix & Update Release Workflow

**Status:** completed

**Description:**
The existing `.github/workflows/release.yml` has incorrect paths and is missing features (AC-REL). Fix and refactor:

1. **`changesets` job** — fix version source path:
   - `jq -r .version tui/package.json` → `20_Applications/tui/package.json`

2. **`tui-release` job** — replace inline binary compilation with the build script:
   - Remove `working-directory: tui` and all inline `bun build --compile` commands
   - Add a single `bun run build` step (Turbo invokes `scripts/build.ts`, which produces all 6 binaries + copies install scripts to `dist/`)
   - Update GitHub Release assets to include: all 6 binaries + `dist/install` + `dist/install-win`
   - Add the missing `bun-windows-arm64` binary (`scriptor-windows-arm64.exe`)

3. **`web-release` job** — fix web workspace paths:
   - `working-directory: web` → `20_Applications/web` (Playwright install step and E2E test step)
   - `path: web/out` → `path: 20_Applications/web/out` (Pages artifact upload step)

**TDD Approach:**
- **RED:** Write a failing test in `20_Applications/tui/src/release-workflow.test.ts` that reads `../../.github/workflows/release.yml`, parses it with `js-yaml`, and asserts all corrected values
- **GREEN:** Update `release.yml` to satisfy all assertions
- Cover: `VERSION=$(jq ...)` references `20_Applications/tui/package.json`; no `working-directory: tui` in `tui-release`; `bun run build` step present in `tui-release`; release file list includes all 6 binary names + `dist/install` + `dist/install-win`; no bare `working-directory: web` remains; Pages artifact `path` is `20_Applications/web/out`

**Implementation Notes:**
- Created `20_Applications/tui/src/release-workflow.test.ts` — 8 assertions covering: YAML parses successfully; `VERSION=$(jq ...)` references `20_Applications/tui/package.json`; no `working-directory: tui` in `tui-release`; `bun run build` step present in `tui-release`; release assets contain all 6 binary names plus `dist/install` and `dist/install-win`; no bare `working-directory: web` in any job; `Install Playwright browsers` step in `web-release` uses `working-directory: 20_Applications/web`; Pages artifact path is `20_Applications/web/out`
- Updated `.github/workflows/release.yml`:
  - `changesets` job: `jq -r .version tui/package.json` → `jq -r .version 20_Applications/tui/package.json`
  - `tui-release` job: removed `working-directory: tui` and all five inline `bun build --compile` commands; replaced with a single `run: bun run build` step; added `dist/scriptor-windows-arm64.exe`, `dist/install`, and `dist/install-win` to the release asset file list
  - `web-release` job: changed all three `working-directory: web` occurrences to `working-directory: 20_Applications/web`; changed `path: web/out` to `path: 20_Applications/web/out`
- All 43 tests (11 Task 1 + 9 Task 2 + 12 Task 3 + 3 Task 4 + 8 Task 5) pass; `bun run lint`, `bun run format`, `bun run typecheck`, and `bun run test:unit` all pass cleanly

---

## Change: Move install scripts to dedicated folder (2026-03-31)

**Summary:** Moved the two install scripts out of `tui/src/` into a dedicated `tui/install/` folder so the directory contains only shell scripts with no JS/TS dependency.

**Files modified:**
- `20_Applications/tui/install/install` — new location (moved from `tui/src/install`)
- `20_Applications/tui/install/install-win` — new location (moved from `tui/src/install-win`)
- `20_Applications/tui/src/install` — deleted
- `20_Applications/tui/src/install-win` — deleted
- `20_Applications/tui/scripts/build.ts` — source paths updated from `srcDir` to new `installDir` variable pointing at `tui/install/`

**Spec updates:**
- `functional.md` — none
- `technical.md` — Install Scripts source paths updated to `20_Applications/tui/install/install` and `20_Applications/tui/install/install-win`

**Tests added/modified:**
- `20_Applications/tui/src/install.test.ts` — deleted
- `20_Applications/tui/src/install-win.test.ts` — deleted
- `20_Applications/tui/scripts/build.test.ts` — path assertions updated from `src/install*` to `install/install*`
