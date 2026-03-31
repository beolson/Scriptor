# Technical Standards — 001 Project Scaffolding & Tooling

## Runtime & Language

- **Runtime**: Bun (packageManager: `bun@1.3.6`). Never use Node, npm, npx, or yarn anywhere.
- **Language**: TypeScript 5 (strict mode) in both workspaces.
- **CI install**: `bun install --frozen-lockfile` always.

## Workspace Layout

- Monorepo root: `/` (contains `package.json`, `biome.json`, `turbo.json`)
- TUI workspace: `20_Applications/tui/`
- Web workspace: `20_Applications/web/`
- All `bun run <script>` commands are issued from the repo root; never `cd` into a workspace to run scripts.
- Workspace paths in all CI workflows, CLAUDE.md, and tooling config must reflect `20_Applications/tui` and `20_Applications/web`.

## Key Libraries & Frameworks

### Tooling (root)
- **Turbo** `^2.5.4` — task orchestration and caching across workspaces
- **@changesets/cli** `^2.27.12` — version management and changelog generation

### TUI workspace
- TypeScript `^5`, `@types/bun: latest`
- Biome `^2.4.4`

### Web workspace
- Next.js `16.1.6` (App Router, static export `output: "export"`)
- React 19, TypeScript `^5`
- Biome `^2.4.4`
- Playwright `^1.58.2` (E2E, Chromium only)
- Tailwind v4 via PostCSS (plugin infrastructure only — no utility classes in JSX)

## Tooling

### Build

**Root task pipeline (turbo.json)**:
- `build` depends on `^build` (workspaces build in dependency order)
- `typecheck` depends on `^build`
- `test:e2e` depends on `build`
- `lint`, `format`, `test:unit` have no inter-workspace dependencies

**TUI build** (`20_Applications/tui`):
- Build entry: `src/index.ts`
- Build script: `bun run scripts/build.ts` (to be authored as part of this epic)
- Produces all 6 cross-compiled platform binaries on every `bun run build` invocation
- Output directory: `dist/` at repo root (e.g. `../../dist/scriptor-linux-x64`)
- The release workflow calls `bun run build` (via Turbo) rather than running bun build commands inline

**Web build** (`20_Applications/web`):
- `next build` with `output: "export"` → static files in `20_Applications/web/out/`
- E2E test server: `bunx serve out/ -p 3000`

### Binary Cross-Compilation (release workflow only)

Six targets built with `bun build src/index.ts --compile --target=<target>`:

| Target flag | Output filename |
|---|---|
| `bun-linux-x64` | `scriptor-linux-x64` |
| `bun-linux-arm64` | `scriptor-linux-arm64` |
| `bun-darwin-x64` | `scriptor-darwin-x64` |
| `bun-darwin-arm64` | `scriptor-darwin-arm64` |
| `bun-windows-x64` | `scriptor-windows-x64.exe` |
| `bun-windows-arm64` | `scriptor-windows-arm64.exe` |

All binaries go to `dist/` at the repo root.

### Test

- **Unit**: `bun test` — co-located `.test.ts`/`.test.tsx` files
- **E2E**: Playwright (Chromium only) — `20_Applications/web/playwright/`
  - Requires `bun run build` first
  - Test server: `bunx serve out/ -p 3000`

### Lint / Format

- **Biome only** — no ESLint, no Prettier
- Root `biome.json` is extended by both workspace `biome.json` files
- `indentStyle: tab`, `quoteStyle: double`
- `organizeImports: on`
- `bun run lint` → `turbo run lint`
- `bun run format` → `turbo run format`

## TypeScript Configuration

| | `20_Applications/tui/` | `20_Applications/web/` |
|---|---|---|
| Target | ESNext | ES2017 |
| Module | Preserve | ESNext |
| moduleResolution | bundler | bundler |
| jsx | react-jsx | preserve |
| Path alias | none | `@/*` → `./` (relative to `web/`) |
| resolveJsonModule | true | — |

- TUI imports use `.js` extensions on relative imports (bundler-mode resolution requirement).
- `strict: true` in both workspaces.

## APIs & External Services

- **GitHub Actions**: CI (`ci.yml`) and Release (`release.yml`) — no self-hosted runners.
- **softprops/action-gh-release@v2**: Creates GitHub Releases and uploads binary assets.
- **changesets/action@v1**: Manages version bump PRs.
- **actions/configure-pages@v5 + upload-pages-artifact@v3 + deploy-pages@v4**: GitHub Pages deployment.

## Architecture Patterns

### CI Workflow (`ci.yml`)

Triggers: push to `main`, all PRs.

Two jobs:
1. `build-lint-typecheck-test` — runs `turbo run build lint typecheck test:unit`
2. `e2e` (needs job 1) — installs Playwright, runs `turbo run test:e2e`

Playwright install step must use `working-directory: 20_Applications/web`.

### Release Workflow (`release.yml`)

Triggers: push to `main`.

Three jobs (changesets → tui-release + web-release in parallel):
1. `changesets` — runs changesets action; tags release; outputs `released` and `version`
2. `tui-release` (if released) — cross-compiles all 6 binaries; uploads binaries + both install scripts to GitHub Release
3. `web-release` (if released) — builds web; runs E2E; deploys to GitHub Pages

Version source: `20_Applications/tui/package.json` `.version` field.

### Changesets

- Both `tui` and `web` are independently versionable packages.
- `bun run changeset` creates a `.changeset/*.md` file.
- `bun run version` → `changeset version` bumps package versions and generates changelogs.

### Install Scripts

- Source: `20_Applications/tui/install/install` (bash) and `20_Applications/tui/install/install-win` (PowerShell)
- `scripts/build.ts` copies both to `dist/` at the repo root as part of `bun run build`
- The release workflow uploads them from `dist/` as GitHub Release assets alongside the binaries

## Constraints & Non-Goals

- Bun only — never Node, npm, npx, or yarn anywhere in the codebase or CI.
- Biome only — never ESLint or Prettier.
- GitHub Actions only — no self-hosted runners, no other CI platforms.
- E2E: Chromium only — no Safari, Firefox, or multi-browser matrix.
- Install scripts are Release assets only — not shipped as static web files.
- Multi-browser E2E out of scope.

## Version Injection

The TUI binary reads its own version at runtime by importing `package.json` directly:

```ts
import pkg from "../package.json";
const VERSION = pkg.version;
```

`resolveJsonModule: true` in `tsconfig.json` enables this. Bun bundles the JSON file into the compiled binary — no `--define` flags or environment variables needed.
