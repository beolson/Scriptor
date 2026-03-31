# Scriptor — Delivery Plan

| Field | Value |
|-------|-------|
| Products | Scriptor TUI + Scriptor Web |
| Status | Planning |
| Date | 2026-03-30 |

---

## Overview

This plan breaks the Scriptor TUI and Scriptor Web products into 12 deliverable epics, ordered by dependency and optimized for parallel delivery where possible. Starting from scratch, the two products share a project scaffold, a manifest data layer, and CI/CD infrastructure. Each epic has a clear theme, a concrete list of deliverables, and an explicit dependency chain.

---

## Epic 1 — Project Scaffolding & Tooling

**Status:** Completed
**Theme:** Foundation shared by both workspaces.

- Bun monorepo: `tui/` and `web/` workspaces with root `package.json` and all turbo task scripts
- Turbo pipeline: `typecheck → build`; `test:e2e → build`
- TypeScript configs: `tui/` (strict, ESNext, preserveModules); `web/` (strict, ES2017/ESNext, `@/*` path alias)
- Biome config: tabs, double quotes, `organizeImports: on`; root config extended by both workspaces
- CI workflow (`ci.yml`): build → lint + typecheck + unit tests → E2E on every push and PR
- Release workflow (`release.yml`): Changesets → 6 platform TUI binaries attached to GitHub Release → GitHub Pages deploy
- Changesets setup (`bun run changeset`)
- Install scripts: `public/install` (bash) and `public/install-win` (PowerShell) for downloading the latest CLI binary

---

## Epic 2 — Host Detection & CLI Foundation

**Status:** Not Started
**Theme:** TUI entry point and runtime environment detection.

- `src/host/detectHost.ts`: Linux `/etc/os-release` parser for `NAME` and `VERSION_ID`; macOS constant `"mac"`; Windows constant `"windows"`; arch mapping (`arm64`/`arm` → `"arm"`, all else → `"x64"`); graceful handling of missing `/etc/os-release`
- `src/index.ts`: Commander entrypoint; `--repo <owner/repo|local>` flag; `--apply-update <old-path>` flag (hidden from help); TTY guard — exit 1 with error if stdin is not an interactive terminal
- Minimal Ink `App.tsx` shell with typed screen-routing state machine (`fetch | script-list | input-collection | confirmation | sudo | execution`)
- `Header` and `Footer` Ink components

---

## Epic 3 — Manifest System

**Status:** Not Started
**Theme:** The shared data spine — parsing, validation, and filtering for both TUI and Web.

**TUI:**
- `src/manifest/parseManifest.ts`: js-yaml parse + Zod schemas for `ScriptEntry`, `GroupEntry`, `InputDef`; validation rules: unique script IDs, unique group IDs, valid group `scripts` refs, unique input IDs per script, valid `run_if` refs; fatal exit (log all errors) on any failure
- `src/manifest/filterManifest.ts`: exact match on `os.name`; optional `os.version` match; exact `os.arch` match
- Full TypeScript data model types: `HostInfo`, `ManifestResult`, `ScriptEntry`, `GroupEntry`, `InputDef`, `CollectedInput`, `ScriptInputs`, `ScriptSelectionResult`, `PreExecutionResult`, `ScriptRunResult`

**Web:**
- `web/lib/types.ts`: `Script` and `Input` TypeScript types (platform, arch, distro, version, inputs, `spec`, `scriptSource`)
- `web/lib/loadScripts.ts`: parse `scriptor.yaml` at build time; populate `scriptSource` from the script file and `spec` from `{script}.spec.md` if it exists; `getScriptsByPlatform()` and `getScriptById()` helpers; invalid platforms default to `linux`; invalid architectures default to `x86`; malformed input entries silently skipped

---

## Epic 4 — Configuration, Keychain & GitHub Client

**Status:** Not Started
**Theme:** Persistence layer and remote data access.

- `src/config/`: read/write `~/.scriptor/config` as YAML; resilient to missing, invalid YAML, or schema failures (treat as empty config)
- Repo resolution priority: `--repo` CLI flag → `repo` field in config → default `beolson/Scriptor`; if flag specifies a different repo than config, prompt to confirm switch and persist on confirmation
- `src/keychain/`: platform-specific credential store — macOS `security` CLI, Linux `secret-tool`, Windows PowerShell; key `scriptor-github-token`; silent no-op if tool absent or operation fails
- `src/github/githubClient.ts`: GitHub Contents API fetches using `application/vnd.github.raw+json` accept header; Bearer token auth when available; 3-retry on non-auth failure
- `src/github/oauth.ts`: device flow — triggered by 401/403 response or 404 without a token; display user code + verification URL; poll until authorized; store token via keychain
- `src/cache/cacheService.ts`: cache at `~/.scriptor/cache/<owner>/<repo>/manifest.yaml` and `scripts/<platform>/<distro>/`; cache miss → fetch and write; cache hit → prompt "Check for updates?"; fetch failure with existing cache → fall back to cache

---

## Epic 5 — Dependency Resolution

**Status:** Not Started
**Theme:** Ordering logic that determines the correct execution sequence.

- `src/manifest/resolveDependencies.ts`
- **Phase 0 — `run_if` filter**: remove scripts whose `run_if` IDs are neither in the candidate set nor already installed (creates path exists on disk); single-pass, removals do not cascade; scripts without `creates` can only satisfy via candidate set membership
- **Phase 1 — transitive run set**: recursively follow all hard `dependencies` to build the complete set of scripts that must run
- **Phase 2 — topological sort**: post-order DFS over the run set; respects `dependencies` (hard edges) and `run_after` (soft edges, only when referenced script is already in the run set)
- Error handling: missing dependency ID → fatal log + exit 1; circular dependency → fatal log + exit 1; invalid `run_if` reference (ID not in manifest) → fatal log + exit 1

---

## Epic 6 — TUI Startup & Selection Screens

**Status:** Not Started
**Theme:** The interactive script selection experience.

- `src/startup/` orchestrator emitting typed `StartupEvent`s: fetch start, update prompt, parse result, filter result
- `src/tui/FetchScreen.tsx`: spinner while fetching; update prompt on cache hit; manifest fetch → parse → filter pipeline; error states for network failure and validation failure
- `src/tui/ScriptListScreen.tsx`:
  - Main menu: groups in manifest order (filtered to those with at least one host-matching script) → "Individual scripts" → "Settings"
  - Group mode: selecting a group queues all non-installed member scripts
  - Individual mode: `@clack/prompts` multi-select of all filtered scripts; each script shows name + description; already-installed scripts labeled `[installed]` with creates-path hint
  - "Settings" shows placeholder message and returns to menu
- Installed status check: `creates` path exists on disk; `~` prefix expanded to home directory

---

## Epic 7 — Input Collection

**Status:** Not Started
**Theme:** Gathering user-provided parameters before execution.

- `src/inputs/`: Zod schemas for `string`, `number`, and `ssl-cert` input types; passthrough fields permitted
- String/number text prompts: display `label`; pre-fill `default` if set; validate non-empty for `required` inputs; validate numeric format for `number` type
- SSL cert 4-step flow:
  1. **URL entry**: accept `host`, `host:port`, or `https://host` (default port 443)
  2. **Chain fetch**: connect via TLS with certificate verification disabled; walk AIA extensions to retrieve full chain up to root; max 10 certificates, 10-second timeout per fetch; return user to step 1 on any fetch failure
  3. **Certificate selection**: display chain root-first; each entry shows CN, expiration date, and role label (`[site]` for leaf, `[root]` for self-signed, blank for intermediates); user selects one
  4. **Download**: write selected certificate to `download_path` in PEM or DER format (case-insensitive); store path + CN as the collected input value
- Input deduplication: if multiple selected scripts declare an input with the same `id`, it is collected once (first occurrence wins)

---

## Epic 8 — Pre-Execution, Sudo & Elevation

**Status:** Not Started
**Theme:** Safety gates before any scripts run.

- `src/tui/ConfirmationScreen.tsx`: display numbered execution plan in dependency order; list non-empty collected inputs beneath each script entry; Y/Enter confirms, N/Esc cancels (exit 0)
- `src/sudo/` Unix sudo flow:
  1. Spinner while running `sudo -n -v`; if exit 0, display cached-credentials confirmation and skip prompt
  2. If non-interactive check fails: `@clack/prompts` `password()` with `mask: "*"`
  3. Submit password to `sudo -S -v` via piped stdin; `log.success()` on pass; `log.error()` and retry on failure (unlimited retries); Esc/Ctrl+C → exit 0
  4. Keepalive: background timer runs `sudo -v` every 4 minutes during execution; stopped and followed by `sudo -k` when execution completes
- Windows elevation: spawn `net session`; non-zero exit → display relaunch-as-administrator instructions, exit 1
- `src/tui/SudoScreen.tsx`

---

## Epic 9 — Script Execution Engine

**Status:** Not Started
**Theme:** Running selected scripts and surfacing their output.

- `src/execution/scriptRunner.ts` emitting typed `ProgressEvent`s
- **Unix invocation**: `sh -c <script-content> sh <args…>` — script content passed as command string; stdout piped back to Scriptor
- **Windows invocation**: write script content to a temp `.ps1` file (UTF-8 BOM); execute via `powershell.exe -NonInteractive -NoProfile -ExecutionPolicy Bypass -File <temp> <args…>`; delete temp file after execution
- **Argument order**: for each declared input in declaration order — collected value or empty string; final argument is colon-delimited IDs of already-installed scripts (empty string if none)
- **Output handling**: stdout piped through `stream.step()` → `│  ` prefix with ANSI color passthrough; stderr and stdin inherited directly by parent process
- Per-script `log.step()` before execution; `log.success()` on exit 0; non-zero exit → `log.error()` with script name and exit code, stop all subsequent scripts, exit 1
- `src/tui/ExecutionScreen.tsx`

---

## Epic 10 — Self-Update & Local Mode

**Status:** Not Started
**Theme:** Developer workflow helpers and CLI maintenance.

**Self-Update:**
- Compare compiled version against latest GitHub Release tag using semantic versioning
- Download new binary to `~/.scriptor/scriptor.new`; chmod executable on Unix
- Spawn `~/.scriptor/scriptor.new --apply-update <current-binary-path>`, then exit current process
- `--apply-update` handler: rename new binary over the old path, relaunch with no flags (producing zero-downtime update)

**Local Mode (`--repo=local`):**
- Detect `--repo=local` flag; run `git rev-parse --show-toplevel` to find the git root (exit 1 with error if not in a git repo)
- Read manifest from `scriptor.yaml` at the git root; exit 1 with error if file is missing
- Read script files from the local filesystem during execution
- Bypass all of: cache reads/writes, OAuth flow, keychain access, and self-update check

---

## Epic 11 — Web Design System & Home Page

**Status:** Not Started
**Theme:** Brand, visual foundation, and entry point for the web app.

- `web/app/globals.css`: CSS custom property design tokens — colors (light: bg `#ffffff`, accent `#059669`; dark: bg `#121212`, accent `#33ff33`), typography scale (hero 48px, h1 28px, body 14px, code 13px), spacing (xs–3xl), page margins (120px desktop, 24px mobile)
- CSS Modules pattern: every component has a co-located `.module.css`; no Tailwind utility classes in JSX; all values via `var(--token)`; responsive breakpoint 768px
- Fonts: IBM Plex Mono (body/UI) + JetBrains Mono (headings/code) via `next/font/google` in `app/layout.tsx`
- Dark/light theme: `data-theme` attribute on `<html>`; inline script before first paint reads `localStorage` (fallback `prefers-color-scheme`) and sets attribute; `suppressHydrationWarning` on `<html>`; `ThemeToggle` component (sun/moon icon swap, persists to `localStorage`)
- Syntax highlighting: `hljs-themes.css` — GitHub Light / GitHub Dark themes scoped to `[data-theme="light"]` / `[data-theme="dark"]` selectors
- Navbar with `ThemeToggle`; `app/layout.tsx` with font setup and theme inline script
- Home page (`/`): terminal-styled hero; OS-detected install command at runtime (`navigator.userAgent` → PowerShell `iwr` or Unix `curl`); `CodeBlock` component with copy-to-clipboard (`[copy]` → `[copied]` for 2 seconds); three platform cards (Windows, Linux, macOS) linking to listing pages
- Platform listing pages: static platform-specific install command at top using `CodeBlock`
- 404 page; footer with version badge from `NEXT_PUBLIC_VERSION` (fallback `"dev"`)

---

## Epic 12 — Web Script Catalog

**Status:** Not Started
**Theme:** Browsable, filterable directory of all scripts.

**Platform listing pages** (`/scripts/linux`, `/scripts/windows`, `/scripts/mac`):
- Client-side filter state with `useState` + `useMemo`
- Tab bars: architecture (x86/arm — shown only when both exist for the platform); distro (Linux only, dynamically computed); version (context-aware, resets when distro filter changes and current selection becomes invalid)
- Filtered script count displayed below filters
- Linux scripts grouped under distro headers
- Breadcrumb navigation

**Script detail page** (`/scripts/[id]`):
- `generateStaticParams` for full static export compatibility
- Two-column layout
- `SpecViewer`: renders `.spec.md` via react-markdown with rehype-highlight; collapsible, collapsed by default
- `ScriptViewer`: syntax-highlights script source via highlight.js; language auto-detected from file extension (`.sh` → bash, `.ps1` → powershell, `.py` → python, etc.); collapsible, collapsed by default; returns null when no source is available
- Sidebar metadata card: platform, architecture, distro, version
- Dependencies list
- Inputs panel: label, type, required/optional badge, default value, download path, format
- Breadcrumb navigation

---

## Delivery Sequence

| Order | Epic | Key Dependencies | Status |
|-------|------|-----------------|--------|
| 1 | Epic 1: Project Scaffolding & Tooling | — | Completed |
| 2 | Epic 2: Host Detection & CLI Foundation | Epic 1 | Not Started |
| 3 | Epic 3: Manifest System | Epic 1 | Not Started |
| 4 | Epic 4: Configuration, Keychain & GitHub Client | Epics 1, 2 | Not Started |
| 5 | Epic 5: Dependency Resolution | Epic 3 | Not Started |
| 6 | Epic 6: TUI Startup & Selection Screens | Epics 4, 5 | Not Started |
| 7 | Epic 7: Input Collection | Epic 3 | Not Started |
| 8 | Epic 8: Pre-Execution, Sudo & Elevation | Epics 6, 7 | Not Started |
| 9 | Epic 9: Script Execution Engine | Epic 8 | Not Started |
| 10 | Epic 10: Self-Update & Local Mode | Epics 3, 4 | Not Started |
| 11 | Epic 11: Web Design System & Home Page | Epic 1 | Not Started |
| 12 | Epic 12: Web Script Catalog | Epics 3, 11 | Not Started |

### Parallel Tracks

After Epic 3 completes, two independent tracks can proceed simultaneously:

**TUI track**: Epic 4 → Epic 5 → Epic 6 → Epics 7 & 8 (parallel) → Epic 9 → Epic 10

**Web track**: Epic 11 → Epic 12

Epic 10 (Self-Update & Local Mode) can also be developed in parallel with Epic 9 since it shares no execution dependencies with the execution engine.
