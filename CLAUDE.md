# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Scriptor** is a CLI tool that fetches and runs host-specific setup scripts from a GitHub repository. It detects the host platform/arch/distro and presents a filtered, interactive TUI for selecting and executing scripts.

Monorepo with two workspaces:
- `tui/` — the CLI tool itself (TypeScript + React/Ink, compiled to a binary via `bun build --compile`)
- `web/` — static documentation/marketing site (Next.js 16 App Router, deployed to GitHub Pages)

Scripts and their spec files live in `scripts/`. The manifest of all scripts is `scriptor.yaml` at the repo root.

## Package Manager

**ALWAYS use Bun.** Never use `node`, `npm`, `npx`, or any other package manager. Every install, script run, and execution must use `bun` or `bunx`.

## Running Scripts

Always run scripts through the root `package.json`. Never `cd` into a sub-project and run scripts from there. Use `bun run <script>` from the repository root.

Root scripts:
```
bun run dev           # turbo dev (all workspaces)
bun run dev:tui       # TUI only
bun run dev:web       # web only
bun run build         # turbo build
bun run lint          # biome check . (all workspaces)
bun run format        # biome format --write . (all workspaces)
bun run typecheck     # tsc --noEmit (all workspaces)
bun run test:unit     # bun test (all workspaces)
bun run test:e2e      # playwright (web only; requires build first)
```

Turbo enforces task dependencies: `typecheck` depends on `build`; `test:e2e` depends on `build`. Running via Turbo handles ordering automatically.

## Pre-Commit Checklist

Before committing any changes, run all of the following and fix any issues:

```
bun run lint
bun run format
bun run typecheck
bun run test:unit
bun run test:e2e
```

Do not commit if any of these fail.

## Linting & Formatting

**Biome only** — no ESLint, no Prettier. Root `biome.json` is extended by both workspaces.

- Indentation: tabs
- Quotes: double quotes in JS/TS
- `bun run lint` → `biome check .`
- `bun run format` → `biome format --write .`
- Biome also enforces import organization (`organizeImports: on`).

## TypeScript

Both workspaces use strict mode. Key differences:

| | `tui/` | `web/` |
|---|---|---|
| Target | ESNext | ES2017 |
| Module | Preserve | ESNext |
| Path alias | none | `@/*` → `./` (relative to `web/`) |

In the TUI, use `.js` extensions on imports (e.g. `import { Foo } from "./foo.js"`) even for `.ts` source files — required for bundler-mode module resolution.

## TUI Workspace (`tui/`)

**Purpose**: CLI tool. Entrypoint: `tui/src/index.ts`. Build output: `/dist/scriptor` binary.

**Stack**: TypeScript, React 19, Ink 6 (terminal UI rendering), Commander (CLI args), Zod (input validation), js-yaml.

**Architecture**:
- `src/tui/` — React/Ink screen components (`App.tsx`, `FetchScreen`, `ScriptListScreen`, `ConfirmationScreen`, `SudoScreen`, `ExecutionScreen`, `Header`, `Footer`)
- `src/manifest/` — `parseManifest.ts`, `filterManifest.ts`, `resolveDependencies.ts`
- `src/startup/` — orchestrates GitHub fetch sequence, emits typed `StartupEvent`s
- `src/execution/` — `scriptRunner.ts` runs scripts via Bun process spawning, emits `ProgressEvent`s
- `src/host/` — `detectHost.ts` detects platform/arch/distro
- `src/github/` — `githubClient.ts` (API calls), `oauth.ts` (device-flow OAuth)
- `src/cache/` — `cacheService.ts` persists manifest/scripts to `~/.scriptor/`
- `src/config/` — reads/writes `~/.scriptor/config` (YAML)
- `src/inputs/` — Zod schemas for input types, input collection screens
- `src/sudo/` — on-demand sudo validation with keepalive

**TUI screen flow**: `fetch` → `script-list` → [`input-collection` →] `confirmation` → [`sudo` →] `execution`

**Testing**: Co-located `.test.ts`/`.test.tsx` files, run with `bun test`. Use the injectable deps pattern (pass deps as function args, override in tests) — `detectHost.ts` is the canonical example.

## Web Workspace (`web/`)

**Purpose**: Static documentation site deployed to GitHub Pages via `output: "export"` in `next.config.ts`.

**Stack**: Next.js 16.1.6, App Router only (no `pages/` directory), React 19, TypeScript.

**Data flow**: `scriptor.yaml` at repo root → read at build time by `web/lib/loadScripts.ts` → passed as props to page components. Script source files and `.spec.md` files are read from disk and embedded into the `Script` type (`scriptSource`, `spec` fields). Key types: `web/lib/types.ts`.

**Route structure**:
- `/` → `app/page.tsx` (hero + platform cards)
- `/scripts/linux` → `app/scripts/linux/page.tsx`
- `/scripts/windows` → `app/scripts/windows/page.tsx`
- `/scripts/mac` → `app/scripts/mac/page.tsx`
- `/scripts/[id]` → `app/scripts/[id]/page.tsx` (uses `generateStaticParams`)

**Testing**:
- Unit: co-located `.test.tsx`/`.test.ts` files, run via `bun run test:unit`
- E2E: Playwright in `web/playwright/` (Chromium only). Requires `bun run build` first. Test server: `bunx serve out/ -p 3000`.

## Web Styling Rules

- **CSS Modules only** — every component has a co-located `ComponentName.module.css`
- **No Tailwind utility classes in JSX** — Tailwind v4 is present via PostCSS but only for its plugin infrastructure. Never use `className="flex gap-4"` or similar.
- **Design tokens** live in `web/app/globals.css` as CSS custom properties. Always use `var(--color-accent)`, `var(--gap-lg)`, etc. in CSS modules — never hardcode colors, spacing, or font sizes.
- **Fonts**: IBM Plex Mono (`--font-ibmplex`, body/UI) and JetBrains Mono (`--font-jetbrains`, code). Loaded via `next/font/google` in `app/layout.tsx`.
- **Theming**: Dark/light via `data-theme` attribute on `<html>`. Tokens defined for both themes in `globals.css`. Inline script in `layout.tsx` sets theme before first paint (reads `localStorage`). `<html>` has `suppressHydrationWarning` for this reason.

## Adding a New Script

1. Add the script to `scripts/<Platform>/<distro-version>/script-name.sh` (or `.ps1` for Windows).
2. Optionally add `scripts/<Platform>/<distro-version>/script-name.sh.spec.md`.
3. Add an entry to `scriptor.yaml` at the repo root.
4. The web site picks up the new script automatically at the next build — no code changes needed.

**`scriptor.yaml` field reference** (from `tui/src/manifest/parseManifest.ts`):
- `platform`: `windows` | `linux` | `mac` (required)
- `arch`: `x86` | `arm` (required)
- `requires_sudo`: boolean (default false)
- `dependencies`: list of script IDs that must run first
- `inputs`: list of `{ id, type, label, required?, default? }` where `type` is `string`, `number`, or `ssl-cert`

## Release Process

Uses [Changesets](https://github.com/changesets/changesets) for version management.

1. `bun run changeset` — create a changeset file (commit alongside the code)
2. Open a PR and merge to `main`
3. CI auto-creates a "chore: version packages" PR
4. Merging the version PR triggers release:
   - **TUI**: 6 platform binaries (`linux/darwin/windows × x64/arm64`) uploaded to GitHub Release
   - **Web**: Static site built and deployed to GitHub Pages

## WSL Detection & Headed Browser

### Detecting WSL

Before launching a browser, check if you're running in WSL:

```bash
cat /proc/version        # contains "microsoft-standard-WSL2" if in WSL
echo $WSL_DISTRO_NAME    # non-empty if in WSL (e.g. "Debian13Dev")
```

### Opening a Headed Chrome Browser in WSL

When running in WSL, use the Windows Chrome executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` with the `playwright-cli` skill and the `--headed` flag:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
  playwright-cli open --headed https://example.com
```

This launches Chrome as a headed Windows process (visible on the Windows desktop) while being controlled from WSL via Playwright.

## CI/CD

GitHub Actions only. Two workflows:
- `.github/workflows/ci.yml` — on push to `main` and all PRs: build → lint + typecheck + unit tests → E2E
- `.github/workflows/release.yml` — on push to `main`: Changesets → binary builds → GitHub Pages deploy

CI uses `bun install --frozen-lockfile`. Playwright installed with `bunx playwright install --with-deps chromium`.

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `web/node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->
