# Phase 2 — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Web Project Scaffolding & Tooling

**Status:** not started

**Description:**
Initialize the Bun/Next.js project in `web/` and configure all tooling before feature work begins. References FR-2-001 (static site, GitHub Pages hosting).

- Create `web/` at repository root. Run `bun create next-app@latest web --ts --no-eslint --no-tailwind --no-src-dir --app` (or manual equivalent) to generate the Bun/Next.js project.
- Configure `web/next.config.ts`: `output: 'export'`, `basePath: '/Scriptor'`, `trailingSlash: true`, `images: { unoptimized: true }`.
- Install runtime deps: `react-markdown`, `rehype-highlight`, `highlight.js`, `js-yaml`.
- Install dev deps: `@biomejs/biome`, `@playwright/test`.
- Add Biome config at `web/biome.json` (same tab-indent, recommended rules as Phase 1).
- Add scripts to `web/package.json`: `dev` → `next dev`, `build` → `next build`, `test:e2e` → `playwright test`, `lint` → `biome check .`, `format` → `biome format --write .`.
- Create `web/playwright.config.ts` pointing at `playwright/` test directory, webServer pointing at built `out/` served locally.
- Create directory stubs: `web/app/components/`, `web/lib/`, `web/playwright/`.
- Create a sample `scriptor.yaml` at the repository root with at least 3 scripts spanning windows, linux (ubuntu), and mac platforms — used by the data layer and Playwright tests.

**TDD Approach:**
- **RED:** Write `web/playwright/smoke.spec.ts` that runs `next build` and asserts `web/out/index.html` exists and contains the text `scriptor`.
- **GREEN:** Complete scaffolding so `bun run build` succeeds and `out/index.html` is generated (can be the default Next.js starter page temporarily).
- Cover: build succeeds without errors, `out/` directory is produced, Biome check passes.

---

## Task 2 — Design Tokens, Fonts & Root Layout

**Status:** not started

**Description:**
Define all CSS custom properties from `UX.requirements.md §2–§4` in `app/globals.css` and establish the root layout with JetBrains Mono and IBM Plex Mono fonts loaded via `next/font/google`.

- `web/app/globals.css`: define all color tokens (`--color-bg`, `--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-muted`, `--color-accent`), typography tokens (`--text-hero`, `--text-h1`, …, `--text-script-name`), and spacing tokens (`--page-max-width`, `--page-px-desktop`, `--page-px-mobile`, `--nav-h`, `--footer-h`, `--gap-*`, etc.) as documented in UX.requirements.md.
- `web/app/layout.tsx`: import `JetBrains_Mono` and `IBM_Plex_Mono` from `next/font/google`, apply both as CSS variables on `<html>`. Import `globals.css`. Include `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Remove or replace the default Next.js starter styles.

**Verify against design:** Use `mcp__pencil__batch_get({ filePath: "ui/Variant1.pen", nodeIds: ["oZMJy", "NV4xD", "dkIKB"], readDepth: 2 })` to confirm token values match the `fill`, `fontSize`, `fontFamily`, and `stroke` properties on the light-mode component refs.

**TDD Approach:**
- **RED:** Write `web/playwright/smoke.spec.ts` (extend existing file) with a test that loads `/` and asserts `getComputedStyle(document.body).getPropertyValue('--color-accent')` equals `#059669`, and that `document.body` uses a monospace font family.
- **GREEN:** Implement globals.css and layout.tsx so the tokens and fonts are applied.
- Cover: all 6 color tokens present, JetBrains Mono and IBM Plex Mono loaded.

---

## Task 3 — Data Layer: Types & Script Loader

**Status:** not started

**Description:**
Define TypeScript types for the `scriptor.yaml` schema (extended with `spec` field per FR-2-001) and implement a `loadScripts()` function that reads and parses the manifest at build time.

- `web/lib/types.ts`: export `Script` interface with fields: `id`, `name`, `description`, `spec` (optional string), `platform` (`'windows' | 'linux' | 'mac'`), `arch` (`'x86' | 'arm'`), `distro` (optional string), `version` (optional string), `dependencies` (optional `string[]`), `script` (string).
- `web/lib/loadScripts.ts`: export `loadScripts(): Script[]` that reads `../scriptor.yaml` via `Bun.file`, parses with `js-yaml`, validates and returns typed entries. Export `getScriptsByPlatform(platform: Script['platform']): Script[]`. Export `getScriptById(id: string): Script | undefined`.
- `web/lib/loadScripts.test.ts`: unit tests using a fixture YAML string (not the real file).

**TDD Approach:**
- **RED:** Write `web/lib/loadScripts.test.ts` with failing tests using `bun test`: (1) parses valid YAML and returns a typed Script array, (2) `getScriptsByPlatform('linux')` returns only linux entries, (3) `getScriptById('install-docker')` finds the correct entry, (4) missing optional fields default to `undefined`, (5) returns empty array when no scripts match.
- **GREEN:** Implement `loadScripts.ts` to make all tests pass.
- Cover: all 5 scenarios above; `bun run lint` passes.

---

## Task 4 — Atom Components: ArchBadge & DependencyTag

**Status:** not started

**Description:**
Implement the two smallest badge components. Both are static (no interactivity) and share the same visual spec: IBM Plex Mono 11px, `--color-text-muted`, padding `[4px, 6px]`.

- `web/app/components/ArchBadge/ArchBadge.tsx` + `ArchBadge.module.css` — renders `[{arch}]` text. Props: `arch: string`.
- `web/app/components/DependencyTag/DependencyTag.tsx` + `DependencyTag.module.css` — renders `[{dep}]` text. Props: `dep: string`.

**Verify against design:** `mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "u1PM6" })` for ArchBadge and `nodeId: "LUjW3"` for DependencyTag. Confirm `padding: [4, 6]`, `fontSize: 11`, `fontFamily: "IBM Plex Mono"`, `fill: "#6B7280"`.

**TDD Approach:**
- **RED:** In `web/playwright/smoke.spec.ts`, add a test that loads the built homepage and asserts an element with `data-testid="arch-badge"` exists and has `font-family` containing `IBM Plex Mono` and computed `font-size` of `11px`. The test fails because the component isn't on the homepage yet.
- **GREEN:** Implement both components (they'll be integrated in later page tasks; the Playwright test passes once the homepage uses ArchBadge via ScriptRow via the listing pages — final validation happens in Task 10).
- Cover: correct text format `[x86]` / `[arm]`, correct font/size/color via CSS vars, `data-testid` attributes present.

---

## Task 5 — Row Components: Breadcrumb, MetadataRow, DistroGroupHeader

**Status:** not started

**Description:**
Implement three list/row display components used in platform listings and script detail pages.

- `web/app/components/Breadcrumb/Breadcrumb.tsx` + `Breadcrumb.module.css` — Props: `segments: Array<{ label: string; href?: string }>`. Renders `home > scripts > active` with `>` separators. Ancestor segments in `--color-text-muted`, active segment in `--color-text-primary`. IBM Plex Mono 12px, gap 6px. Pen node: `kUgWo`.
- `web/app/components/MetadataRow/MetadataRow.tsx` + `MetadataRow.module.css` — Props: `label: string; value: string`. Bottom border only, padding `[10px, 0]`, space-between. IBM Plex Mono 12px. Pen node: `ItHPc`.
- `web/app/components/DistroGroupHeader/DistroGroupHeader.tsx` + `DistroGroupHeader.module.css` — Props: `distro: string`. Renders `// {distro}`, IBM Plex Mono 12px, `letter-spacing: 1px`, bottom border, padding `[12px, 0]`. Pen node: `c1v1c`.

**Verify against design:** `mcp__pencil__get_screenshot` for each: `kUgWo`, `ItHPc`, `c1v1c`. Confirm border colors, spacing, text styles match `--color-border` and `--color-text-muted`.

**TDD Approach:**
- **RED:** In `web/playwright/detail.spec.ts`, write a failing test that loads `/scripts/install-docker` and asserts `data-testid="breadcrumb"` is visible, `data-testid="metadata-row"` elements exist, and contain text `platform`. Test fails because the page doesn't exist yet.
- **GREEN:** Implement all three components. They pass via the detail page task (Task 11); this task just creates the components and verifies lint passes.
- Cover: breadcrumb renders correct number of segments, MetadataRow has `space-between` layout, DistroGroupHeader has `letter-spacing`.

---

## Task 6 — CodeBlock Component

**Status:** not started

**Description:**
Implement the interactive code block component with copy-to-clipboard. This is a `'use client'` component per FR-2-002. Pen node: `NV4xD` (`lm_comp_code_block`).

- `web/app/components/CodeBlock/CodeBlock.tsx` + `CodeBlock.module.css`
- Props: `language: string` (rendered as `// {language}`); `command: string` (the copyable text).
- `'use client'` directive — uses `useState` for `[copy]` → `[copied]` toggle (2 s revert via `setTimeout`), `navigator.clipboard.writeText()` on click.
- Border 1px `--color-border`. Header row: label left (IBM Plex Mono 11px, muted), `[copy]` right (JetBrains Mono 12px, muted). Command: `--color-accent`, JetBrains Mono 13px, `white-space: pre`, `word-break: break-all`.
- Default width: 400px; apply `width: 600px` via a `wide` prop; `width: 100%` via a `fullWidth` prop.

**Verify against design:** `mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "NV4xD" })`. Confirm border `#E5E7EB`, command text `#059669`, label `11px` IBM Plex Mono, `[copy]` `12px` JetBrains Mono.

**TDD Approach:**
- **RED:** In `web/playwright/homepage.spec.ts`, write a failing test that loads `/` and: (1) finds `data-testid="code-block"`, (2) clicks `[copy]`, (3) asserts the label changes to `[copied]`, (4) waits 2.5 s and asserts it reverts to `[copy]`. Test fails because the homepage doesn't use CodeBlock yet.
- **GREEN:** Implement `CodeBlock.tsx` and integrate it into the homepage (Task 9 will finalize, but the component itself is complete here).
- Cover: copy button state toggle, clipboard API called with command text, revert after 2 s.

---

## Task 7 — ScriptRow & PlatformCard Components

**Status:** not started

**Description:**
Implement the two card/row components used in platform listing pages. Both use `ArchBadge` from Task 4.

- `web/app/components/ScriptRow/ScriptRow.tsx` + `ScriptRow.module.css` — Props: `name: string; description: string; arch: string; href: string`. Full-width, bottom border only, space-between, padding `[16px, 0]`, gap 16px. Left column: name (JetBrains Mono 14px weight 500, `--color-text-primary`), description prefixed `//` (IBM Plex Mono 12px, `--color-text-muted`). Right: `<ArchBadge>` + `>>` arrow. Entire row links to `href`. Pen node: `P8pAa`.
- `web/app/components/PlatformCard/PlatformCard.tsx` + `PlatformCard.module.css` — Props: `prompt: string; name: string; description: string; href: string`. Width 300px desktop / 100% mobile. Border 1px `--color-border`, vertical layout, gap 12px, padding 24px. Prompt (JetBrains Mono 12px, muted), name (JetBrains Mono 18px bold, primary), description (IBM Plex Mono 13px, muted, fixed-width). `> view scripts` link in `--color-accent`. Entire card links to `href`. Pen node: `dkIKB`.

**Verify against design:** `mcp__pencil__get_screenshot` for `P8pAa` and `dkIKB`. Confirm border, spacing, font sizes, and `--color-accent` on `> view scripts`.

**TDD Approach:**
- **RED:** In `web/playwright/listings.spec.ts`, write a failing test that loads `/scripts/windows`, finds `data-testid="script-row"` elements, and asserts the first row contains a script name and a `>>` arrow. Test fails because the page doesn't exist.
- **GREEN:** Implement `ScriptRow.tsx` and `PlatformCard.tsx`. Full Playwright validation happens in Task 10.
- Cover: ScriptRow renders name + description + badge + arrow, PlatformCard renders prompt + name + description + link.

---

## Task 8 — NavBar & Footer Components

**Status:** not started

**Description:**
Implement the global layout chrome components used on every page. Pen nodes: `oZMJy` (NavBar), `5Bddv` (Footer).

- `web/app/components/NavBar/NavBar.tsx` + `NavBar.module.css` — Full-width, 56px height, sticky, `--color-bg` background, bottom border `--color-border`. Left: `> scriptor` (JetBrains Mono 16px bold, `--color-text-primary`). Right: `github` link (JetBrains Mono 13px, `--color-text-muted`). Horizontal padding: 120px desktop / 24px mobile.
- `web/app/components/Footer/Footer.tsx` + `Footer.module.css` — Full-width, 80px height desktop (auto mobile). Top border `--color-border`, `--color-bg`. Left: `> scriptor // manage your scripts` (IBM Plex Mono 13px, muted). Right: `github` link (JetBrains Mono 12px, muted). Mobile: vertical layout, padding `[32px, 24px]`.

**Verify against design:** `mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "oZMJy" })` and `nodeId: "5Bddv"`. Confirm fill `#FFFFFF`, stroke `#E5E7EB`, logo text color `#111111`.

**TDD Approach:**
- **RED:** In `web/playwright/smoke.spec.ts`, add tests that load `/` and assert `data-testid="navbar"` is visible with text `> scriptor`, and `data-testid="footer"` is visible with text `manage your scripts`. Tests fail because the homepage doesn't compose these components yet.
- **GREEN:** Implement `NavBar.tsx` and `Footer.tsx`. Integrate into `app/layout.tsx` so both appear on every page.
- Cover: NavBar is sticky (position fixed/sticky), Footer `github` link is present, mobile layout switches to vertical at 768px.

---

## Task 9 — Homepage (`/`)

**Status:** not started

**Description:**
Implement the homepage at `/`. Server component hosts static content; a `'use client'` `InstallCommand` subcomponent handles OS detection (FR-2-002, FR-2-003). Pen nodes: desktop `kIl3i`, mobile `gVj9a`.

- `web/app/page.tsx` — server component. Renders: hero section (badge, headline `> scriptor`, subheadline), `<InstallCommand />`, note text, platforms section (label, heading `> browse by platform`, 3 `<PlatformCard>` components linking to `/Scriptor/scripts/windows|linux|mac`).
- `web/app/components/InstallCommand/InstallCommand.tsx` — `'use client'`. Reads `navigator.userAgent` on mount. Windows → PowerShell command; all others → Bash command (exact strings from FR-2-002). Renders `<CodeBlock wide language="// detected: windows|linux" command="..." />`.
- Default (SSR): render the Bash command (prevents hydration mismatch; swap after mount).
- Hero padding: `[80px, 120px]` desktop / `[48px, 24px]` mobile. Platforms section: `[60px, 120px]` desktop / `[40px, 24px]` mobile.

**Verify against design:**
```
mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "kIl3i" })   // desktop
mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "gVj9a" })   // mobile
```
Confirm hero gap 32px desktop / 24px mobile, platform cards 3-column desktop / stacked mobile.

**TDD Approach:**
- **RED:** In `web/playwright/homepage.spec.ts`, write failing tests: (1) hero headline `> scriptor` is visible; (2) CodeBlock shows a command string; (3) clicking `[copy]` changes label to `[copied]`; (4) three platform cards are visible with titles `windows`, `linux`, `macos`; (5) clicking the Windows card navigates to `/Scriptor/scripts/windows`.
- **GREEN:** Implement `app/page.tsx` and `InstallCommand.tsx` composing all previous components.
- Cover: all 5 scenarios above; mobile layout at 390px viewport shows stacked platform cards.

---

## Task 10 — Platform Listing Pages (`/scripts/windows|linux|mac`)

**Status:** not started

**Description:**
Implement the three platform listing pages reading `scriptor.yaml` at build time (FR-2-001, FR-2-004, FR-2-005). Pen nodes: desktop `8PTul` (Windows), `576mM` (Linux), `M9XtD` (macOS); mobile `Ox3IY`.

- `web/app/scripts/windows/page.tsx` — Server component. Calls `getScriptsByPlatform('windows')`. Renders: NavBar (via layout), Breadcrumb (`home > scripts > windows`), heading `> windows scripts`, `<CodeBlock wide>` with Windows install command, arch filter tabs (static display), script count, ScriptRows sorted alphabetically, Footer (via layout).
- `web/app/scripts/linux/page.tsx` — Same structure. Groups scripts by `distro`, renders `<DistroGroupHeader>` before each group. Shows distro and version filter tabs (FR-2-004 Linux sub-grouping). Pen nodes: `cvp9b` (page header), `O3L96` (script list).
- `web/app/scripts/mac/page.tsx` — Same structure, macOS scripts only. Pen node: `M9XtD`.
- All three pages: `data-testid="platform-header"`, `data-testid="script-list"`.

**Verify against design:**
```
mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "8PTul" })
mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "576mM" })
mcp__pencil__snapshot_layout({ filePath: "ui/Variant1.pen", parentId: "576mM", maxDepth: 3 })
```
Confirm Linux page has distro group headers, arch/distro/version filter rows.

**TDD Approach:**
- **RED:** In `web/playwright/listings.spec.ts`, write failing tests: (1) `/scripts/windows` shows heading `> windows scripts` and at least one `data-testid="script-row"`; (2) `/scripts/linux` has at least one `data-testid="distro-group-header"`; (3) clicking a ScriptRow navigates to `/scripts/{id}`; (4) Breadcrumb shows `home > scripts > windows`.
- **GREEN:** Implement all three platform pages composing `getScriptsByPlatform`, `Breadcrumb`, `CodeBlock`, `DistroGroupHeader` (Linux only), and `ScriptRow`.
- Cover: all 4 scenarios; scripts sorted alphabetically within groups; script count text visible.

---

## Task 11 — Script Detail Page (`/scripts/[id]`)

**Status:** not started

**Description:**
Implement the script detail page at `/scripts/[id]` (FR-2-001, FR-2-006). Pen nodes: desktop `rK8aO`, mobile `dWPZd`.

- `web/app/scripts/[id]/page.tsx` — `generateStaticParams()` returns all script IDs from `loadScripts()`. `getScriptById(id)` fetches the script or `notFound()`. Renders:
  - `detail_header`: Breadcrumb (`home > {platform} > {id}`), heading `> {id}` (28px desktop / 22px mobile), description (IBM Plex Mono 16px, muted), badge row (`<ArchBadge>` for platform and arch).
  - `detail_body` (2-column desktop, stacked mobile): `main_col` with `// spec` label and `<ReactMarkdown>` rendering the `spec` field; `sidebar` with `metadata_card` (`<MetadataRow>` for platform/arch/shell/version) and `deps_card` (`<DependencyTag>` per dependency).
- Install `react-markdown` and `rehype-highlight`; import a Highlight.js CSS theme globally in `app/layout.tsx`.
- `detail_body` horizontal layout: gap 48px desktop, stacked mobile. `sidebar` width: 280px desktop.

**Verify against design:**
```
mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "rK8aO" })   // desktop
mcp__pencil__get_screenshot({ filePath: "ui/Variant1.pen", nodeId: "dWPZd" })   // mobile
mcp__pencil__batch_get({ filePath: "ui/Variant1.pen", nodeIds: ["jfP70", "7ByTR", "pi34T"], readDepth: 3 })
```
Confirm sidebar 280px, deps_card gap 12px, metadata_card padding 20px.

**TDD Approach:**
- **RED:** In `web/playwright/detail.spec.ts`, write failing tests: (1) `/scripts/install-docker` shows heading `> install-docker`; (2) `data-testid="metadata-row"` elements present; (3) `data-testid="arch-badge"` present; (4) `data-testid="spec-content"` contains rendered markdown (at least one `<p>` or `<h2>`); (5) `data-testid="deps-card"` lists at least one dependency tag.
- **GREEN:** Implement `app/scripts/[id]/page.tsx` composing Breadcrumb, ArchBadge, DependencyTag, MetadataRow, and ReactMarkdown.
- Cover: all 5 scenarios; missing `spec` field shows empty markdown section without errors; 404 for unknown id.

---

## Task 12 — GitHub Actions CI/CD Pipeline

**Status:** not started

**Description:**
Implement the deploy workflow so every push to `main` builds and deploys the site to GitHub Pages (FR-2-001 "rebuilt whenever scriptor.yaml changes").

- `.github/workflows/deploy.yml`: trigger on `push` to `main` and on changes to `scriptor.yaml`.
- Steps: checkout, setup Bun, `cd web && bun install`, `bun run lint`, `bun run build`, `bunx playwright install --with-deps`, serve `out/` locally, `bun run test:e2e`, upload `out/` as pages artifact, deploy to GitHub Pages.
- Required permissions: `pages: write`, `id-token: write`.
- Use `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`.

**TDD Approach:**
- **RED:** Push a branch with the workflow file and a deliberate lint error; assert the CI job fails on the lint step. Fix the lint error; assert the job proceeds to build.
- **GREEN:** Implement the full workflow YAML. Confirm on a test push that all steps pass and the site is reachable at `beolson.github.io/Scriptor`.
- Cover: lint failure blocks deploy, Playwright test failure blocks deploy, successful run deploys to Pages.
