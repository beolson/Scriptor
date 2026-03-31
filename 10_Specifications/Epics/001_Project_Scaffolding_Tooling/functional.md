# 001 Project Scaffolding & Tooling

## Summary

Establish the Bun monorepo foundation shared by both the TUI (`tui/`) and Web (`web/`) workspaces. Delivers all developer tooling (TypeScript, Biome, Turbo), CI/CD pipelines, release automation (6 platform binaries + install scripts + GitHub Pages), and end-user install scripts. This epic has no functional user-facing features of its own — its output is the infrastructure that all subsequent epics build upon.

## Business Value

- **Contributors** can clone the repository and immediately build, lint, typecheck, test, and run both workspaces using a small set of consistent commands — no environment setup guesswork.
- **End users** can install the Scriptor binary with a single copy-paste command from the documentation website.
- **Release managers** can cut a versioned release (6 platform binaries + install scripts + web deploy) by merging a version PR — no manual binary builds or file uploads.
- **CI** enforces quality gates on every PR so that broken code cannot be merged.

## User Stories

- As a **contributor**, I want to run `bun run build`, `bun run lint`, `bun run typecheck`, `bun run test:unit`, and `bun run test:e2e` from the repository root so I can verify my changes before pushing.
- As a **contributor**, I want CI to run the same checks automatically on every push and PR so I get early feedback on broken builds or tests.
- As a **release manager**, I want to create a changeset, open a PR, and have the release workflow automatically build and publish all artifacts when the version PR is merged.
- As a **Linux/macOS user**, I want to run a single `curl | bash` command that installs the correct Scriptor binary for my platform and puts it on my PATH.
- As a **Windows user**, I want to run a single PowerShell command that installs the correct Scriptor binary and puts it on my PATH.
- As an **existing user**, I want the install script to overwrite my current binary and tell me what version I upgraded from and to.

## Acceptance Criteria

### Monorepo & Tooling
- The repository is a Bun monorepo with `tui/` and `web/` workspaces wired to a root `package.json`.
- All task scripts (`dev`, `dev:tui`, `dev:web`, `build`, `lint`, `format`, `typecheck`, `test:unit`, `test:e2e`) run from the repository root via `bun run <script>`.
- Turbo enforces: `typecheck` depends on `build`; `test:e2e` depends on `build`.
- Biome is the sole linter and formatter (tabs, double quotes, `organizeImports: on`); the root `biome.json` is extended by both workspaces.
- No ESLint, Prettier, Node, npm, or npx appear anywhere in the project.

### CI (`ci.yml`)
- Runs on every push and every PR.
- Pipeline: build → lint + typecheck + unit tests → E2E (Chromium only).
- Uses `bun install --frozen-lockfile`; Playwright installed via `bunx playwright install --with-deps chromium`.
- A failing step blocks the PR.

### Release (`release.yml`)
- Triggered on push to `main`.
- Uses Changesets to produce version bumps.
- Builds all 6 platform binaries (`linux/darwin/windows × x64/arm64`).
- Publishes binaries + both install scripts (`install`, `install-win`) as assets on a GitHub Release.
- Deploys the web site to GitHub Pages in the same workflow.

### Install Scripts
- A bash install script (`install`) and a PowerShell install script (`install-win`) are published as assets on every GitHub Release.
- The bash script detects the host platform (`linux` / `darwin`) and architecture (`x64` / `arm64`), downloads the correct binary, makes it executable, and installs it to the user's PATH:
  - If `~/.local/bin` is on PATH, install there (no sudo required).
  - Otherwise fall back to `/usr/local/bin` (prompts for sudo).
- The PowerShell script detects the host architecture, downloads the correct binary, and installs it to `AppData\Local\Microsoft\WindowsApps`.
- If a `scriptor` binary already exists at the install location, the script overwrites it and prints a message: "Updated scriptor from vX.Y.Z to vA.B.C".
- The documentation website links to both scripts by their GitHub Release URL so users can copy-paste a single command to install Scriptor.

## Constraints

- **Package manager**: Bun only. `bun install --frozen-lockfile` in CI.
- **Linting/formatting**: Biome only — no ESLint, no Prettier.
- **CI platform**: GitHub Actions only.
- **E2E browsers**: Chromium only (Playwright).
- **Changesets**: version management is handled exclusively by Changesets.

## Out of Scope

- Install scripts deployed as static website files (they are GitHub Release assets only).
- Multi-browser E2E testing.
- Self-hosted CI runners.
- Any application features (host detection, TUI screens, manifest parsing, etc.) — those belong to subsequent epics.

## Open Questions
