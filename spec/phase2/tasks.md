# Phase 2 — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Web Project Scaffolding & Tooling

**Status:** complete

**Implementation notes:**
- `web/` directory already existed with package.json, next.config.ts, biome.json, playwright.config.ts, tsconfig.json, and node_modules from prior scaffolding work.
- Created `web/app/components/`, `web/lib/`, `web/playwright/` directory stubs.
- Created minimal Next.js app: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`.
- Created `web/playwright/smoke.spec.ts` with RED tests (build output assertion + homepage load assertion).
- `bun run build` succeeds; `web/out/index.html` exists and contains "scriptor".
- `bun run lint` passes (Biome check clean).
- `scriptor.yaml` at repo root already contains scripts spanning windows (2), linux (8, including ubuntu), and mac (2) platforms.

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

**Status:** complete

**Implementation notes:**
- `web/app/globals.css`: replaced default starter styles with a full reset plus all 6 color tokens, 14 typography tokens, and all spacing/layout tokens from `UX.requirements.md §2–§4`. Hex values lowercased to satisfy Biome formatter.
- `web/app/layout.tsx`: imports `JetBrains_Mono` (variable `--font-jetbrains`) and `IBM_Plex_Mono` (weights 400/500/700, variable `--font-ibmplex`) from `next/font/google`. Both applied as CSS variables on `<html>` via `className`. Existing `<meta name="viewport">` retained.
- Design verification: inspected `oZMJy` (NavBar), `NV4xD` (CodeBlock), and `dkIKB` (PlatformCard) refs on the homepage frame in `ui/Variant1.pen`. Confirmed `--color-bg: #ffffff`, `--color-border: #e5e7eb`, `--color-accent: #059669`, and font families match the design.
- Playwright tests added to `web/playwright/smoke.spec.ts` (RED→GREEN): `--color-accent` value, monospace font on body, all 6 tokens present, and font CSS variable names non-empty.
- `bun run build` succeeds, `bun run lint` passes.

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

**Status:** complete

**Implementation notes:**
- `web/lib/types.ts`: exports `Script` interface with all required fields (`id`, `name`, `description`, `spec?`, `platform`, `arch`, `distro?`, `version?`, `dependencies?`, `script`).
- `web/lib/loadScripts.ts`: exports `loadScripts(yamlContent?: string): Script[]` (accepts optional YAML string for testing, reads from disk when omitted), `getScriptsByPlatform(scripts, platform)`, and `getScriptById(scripts, id)`. Uses a `RawEntry` type alias to enable dot-notation property access on parsed YAML entries, satisfying Biome's `useLiteralKeys` rule.
- `web/lib/loadScripts.test.ts`: 9 unit tests using `bun:test` with an inline fixture YAML string — covers parsing, optional field defaulting, spec/dependencies fields, platform filtering, empty-match case, and id lookup.
- All 9 tests pass (`bun test`). `bun run lint` exits 0 with no errors.

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

**Status:** complete

**Implementation notes:**
- `web/app/components/ArchBadge/ArchBadge.tsx` + `ArchBadge.module.css`: renders `[{arch}]` as an inline `<span>` with `data-testid="arch-badge"`. IBM Plex Mono via `--font-ibmplex` CSS variable, 11px, `--color-text-muted`, padding `--badge-py`/`--badge-px` (4px/6px).
- `web/app/components/DependencyTag/DependencyTag.tsx` + `DependencyTag.module.css`: renders `[{dep}]` as an inline `<span>` with `data-testid="dependency-tag"`. Identical visual spec to ArchBadge (same font, size, color, padding).
- Design verified against Pen nodes `u1PM6` (ArchBadge) and `LUjW3` (DependencyTag): `padding: [4, 6]`, `fontSize: 11`, `fontFamily: "IBM Plex Mono"`, `fill: "#6B7280"` — all match.
- RED test added to `web/playwright/smoke.spec.ts` ("arch-badge has IBM Plex Mono font and 11px font size"). This test will fail until ArchBadge appears on the homepage (deferred to Task 10 per task spec).
- `bun run build` succeeds, `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `web/app/components/Breadcrumb/Breadcrumb.tsx` + `Breadcrumb.module.css`: renders segment array with `>` separators. Ancestor segments colored `--color-text-muted`, active segment `--color-text-primary`. IBM Plex Mono 12px, gap `--gap-xs` (6px). Ancestor segments with `href` render as `<Link>` elements.
- `web/app/components/MetadataRow/MetadataRow.tsx` + `MetadataRow.module.css`: renders `label`/`value` pair with `justify-content: space-between`, padding `var(--meta-py) 0` (10px top/bottom), bottom border `--color-border`, IBM Plex Mono 12px. Label muted, value primary.
- `web/app/components/DistroGroupHeader/DistroGroupHeader.tsx` + `DistroGroupHeader.module.css`: renders `// {distro}`, IBM Plex Mono 12px, `letter-spacing: 1px`, padding `12px 0`, bottom border `--color-border`, muted color.
- Design verified against `comp_breadcrumb` (id `uYndP`), `comp_metadata_row` (id `Fn9B6`), and `comp_distro_group_header` (id `VswOa`) from `ui/Variant1.pen`. All gap/padding/font/color values match.
- `web/playwright/detail.spec.ts` created with RED tests: (1) breadcrumb visible on `/scripts/install-docker`; (2) metadata-row elements present and contain text "platform". These fail until Task 11 adds the detail page.
- `bun run build` succeeds, `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `web/app/components/CodeBlock/CodeBlock.tsx` + `CodeBlock.module.css`: `'use client'` component. Props: `language`, `command`, `wide?`, `fullWidth?`. Uses `useState` for `[copy]` → `[copied]` toggle with `setTimeout` 2000ms revert. Calls `navigator.clipboard.writeText(command)` on click.
- CSS: border 1px `--color-border`; header row flexbox with `language` (IBM Plex Mono 11px, muted) left and copy button (JetBrains Mono 12px, muted) right; command area (JetBrains Mono 13px, `--color-accent`, `white-space: pre`, `word-break: break-all`).
- Width variants: default 400px, `wide` 600px, `fullWidth` 100%.
- `data-testid="code-block"` on wrapper, `data-testid="copy-button"` on button.
- Integrated into `web/app/page.tsx` (temporary placeholder) so Playwright tests can run against the built output.
- `web/playwright/homepage.spec.ts` created with 3 tests: code-block visible, [copy] toggles to [copied], reverts after 2.5s. All 3 pass.
- `bun run build` succeeds, `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `web/app/components/ScriptRow/ScriptRow.tsx` + `ScriptRow.module.css`: full-width `<Link>` row, bottom border only, `space-between`, padding `var(--gap-lg) 0` (16px), gap 16px. Left column: name (JetBrains Mono 14px weight 500, `--color-text-primary`), description prefixed `"// "` (IBM Plex Mono 12px, `--color-text-muted`). Right: `<ArchBadge>` + `>>` arrow (JetBrains Mono 12px, muted). `data-testid="script-row"`.
- `web/app/components/PlatformCard/PlatformCard.tsx` + `PlatformCard.module.css`: 300px desktop / 100% mobile. Border 1px `--color-border`, vertical layout, gap 12px (`--gap-md`), padding 24px (`--card-p`). Prompt (JetBrains Mono 12px, muted), name (JetBrains Mono 18px bold, primary), description wrapped in div (IBM Plex Mono 13px, muted). `> view scripts` in `--color-accent`. Entire card is a `<Link>`. `data-testid="platform-card"`.
- Design verified against `gAmQi` (comp_script_row) and `83vWD` (comp_platform_card) in `ui/Variant1.pen`. Font sizes, weights, colors, gap, padding, border all match.
- `web/playwright/listings.spec.ts` created with 5 RED tests (pages `/scripts/windows` and `/scripts/linux` do not exist yet — tests fail at page load time until Task 10).
- `bun run build` succeeds, `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `web/app/components/NavBar/NavBar.tsx` + `NavBar.module.css`: `<nav>` with `data-testid="navbar"`. Sticky, 56px height (`--nav-h`), `--color-bg` background, bottom border `--color-border`. Left: `> scriptor` (JetBrains Mono 16px bold, `--color-text-primary`). Right `<div>` with `github` `<a>` link (JetBrains Mono 13px, `--color-text-muted`). Horizontal padding: `--page-px-desktop` (120px) desktop / `--page-px-mobile` (24px) mobile via media query.
- `web/app/components/Footer/Footer.tsx` + `Footer.module.css`: `<footer>` with `data-testid="footer"`. `--footer-h` (80px) min-height, top border `--color-border`, `--color-bg`. Left: `> scriptor // manage your scripts` (IBM Plex Mono 13px, `--color-text-muted`). Right: `github` `<a>` link (JetBrains Mono 12px, muted). Mobile: flex-direction column, padding `[32px, 24px]`, at `max-width: 768px`.
- Both components integrated into `web/app/layout.tsx` as siblings wrapping `{children}`.
- Design verified against `ANshg` (comp_nav_bar) and `QhPVI` (comp_footer) in `ui/Variant1.pen`. Fill `#FFFFFF`, border `#E5E7EB`, logo `#111111`, github `#6B7280` all confirmed.
- JSX Biome lint issue: `//` in JSX text treated as comment — resolved by wrapping with `{"//"}`.
- RED tests added to `web/playwright/smoke.spec.ts` ("layout chrome — Task 8"): navbar visible with `> scriptor`, navbar contains `github`, footer visible with `manage your scripts`, footer contains `github`.
- `bun run build` succeeds, `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `web/app/components/InstallCommand/InstallCommand.tsx`: `'use client'` component. Reads `navigator.userAgent` on mount via `useEffect`. Default (SSR) state is `"other"` (renders Bash command) to prevent hydration mismatch; swaps to Windows PowerShell command if Windows is detected. Renders `<CodeBlock wide language="// detected: windows|linux" command="..." />`.
- `web/app/page.tsx`: full server component homepage. Renders: hero section (`data-testid="hero-headline"` on `<h1>`), `<InstallCommand />`, note text, platforms section with three `<PlatformCard>` components linking to `/scripts/windows`, `/scripts/linux`, `/scripts/mac`.
- `web/app/page.module.css`: hero `padding [80px, 120px]` desktop / `[48px, 24px]` mobile, gap 32px desktop / 24px mobile; platforms section `padding [60px, 120px]` desktop / `[40px, 24px]` mobile, gap 24px desktop / 20px mobile; cardGrid flex-row desktop / flex-column mobile.
- `web/app/components/CodeBlock/CodeBlock.tsx`: added `data-testid="command-text"` to the command div.
- Design verified against `homepage_desktop` node in `ui/Variant1.pen`: hero padding `[80, 120]` gap 32, subheadline IBM Plex Mono 18px, platforms section padding `[60, 120]` gap 24, card grid gap 16 — all match.
- All 5 Task 9 Playwright tests pass. `bun run build` succeeds. `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `web/app/scripts/windows/page.tsx`: server component. Calls `getScriptsByPlatform('windows')`, sorts alphabetically. Renders Breadcrumb (`home > scripts > windows`), heading `> windows scripts`, `<CodeBlock wide>` with Windows install command, arch filter tabs (static display), script count, and ScriptRows. `data-testid="platform-header"` on the header div, `data-testid="script-list"` on the list div.
- `web/app/scripts/linux/page.tsx`: same structure. Groups scripts by `distro` using a `Map`, renders `<DistroGroupHeader>` before each group. Includes arch, distro, and version filter rows (static display).
- `web/app/scripts/mac/page.tsx`: same structure. macOS scripts only, arch filter only.
- `web/app/scripts/platform-listing.module.css`: shared CSS module for all three pages. Padding `[48px, 120px]` desktop header / `[40px, 120px]` script list; mobile breakpoint at 768px collapses to `[32px, 24px]` / `[24px, 24px]`.
- Fixed `web/lib/loadScripts.ts`: changed `resolve(__dirname, "../../scriptor.yaml")` to `resolve(process.cwd(), "../scriptor.yaml")` so Next.js build-time static rendering can locate the YAML file (Next.js workers run from `web/` as `cwd`).
- All 5 listings Playwright tests pass. `bun run build` succeeds. `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `web/app/scripts/[id]/page.tsx`: async server component. `generateStaticParams()` returns all script IDs from `loadScripts()`. Awaits `params` (Next.js 16 async params). Uses `getScriptById(scripts, id)` or calls `notFound()`. Renders: `detail_header` with Breadcrumb (`home > {platform} > {id}`), heading `> {id}` (28px desktop / 22px mobile), description prefixed `//` (IBM Plex Mono 16px, muted), badge row with two `<ArchBadge>` components for platform and arch.
- `detail_body`: 2-column desktop (gap 48px), stacked mobile. `main_col` contains `// spec` label and `<ReactMarkdown rehypePlugins={[rehypeHighlight]}>` for the `spec` field. `sidebar` (280px desktop) contains `metadata_card` (`<MetadataRow>` for platform/arch/distro/version) and `deps_card` (`<DependencyTag>` per dependency, only rendered when dependencies exist).
- `web/app/scripts/[id]/detail.module.css`: header `padding [48px, 120px]` desktop / `[32px, 24px]` mobile; body `padding [48px, 120px]` desktop / `[24px, 24px]` mobile; sidebar 280px desktop / 100% mobile; markdown prose styles for `h1-h3`, `p`, `ol/ul`, `pre`, `code`.
- `web/app/layout.tsx`: added `import "highlight.js/styles/github.css"` for syntax highlighting in rendered markdown.
- `web/playwright/detail.spec.ts`: extended with 5 Task 11 tests. All 7 tests in the file pass (including the 2 Task 5 RED tests that now pass too).
- `bun run build` succeeds (18 static pages including 12 script detail pages). `bun run lint` exits 0.

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

**Status:** complete

**Implementation notes:**
- `.github/workflows/deploy-web.yml` already existed with the core structure from prior work. Updated it with the following changes:
- Added `actions/configure-pages@v5` step in the build job (after `bun run build`, before `actions/upload-pages-artifact`) to properly configure the GitHub Pages base URL before artifact upload.
- Removed the manual `bunx serve out/ -p 3000 &` + `sleep 2` commands from the test job. The `playwright.config.ts` `webServer` config already handles serving `out/` on port 3000 with `reuseExistingServer: !process.env.CI` — in CI this starts the server automatically, so the manual serve was redundant and caused a port conflict.
- The test job downloads the Pages artifact, extracts it to `web/out`, then runs `bun run test:e2e` — Playwright's webServer starts `bunx serve out/ -p 3000` and the `GITHUB_ACTIONS` env var in `playwright.config.ts` sets `baseURL` to `http://localhost:3000/Scriptor`.
- Workflow structure: `build` job (lint → build → configure-pages → upload artifact) → `test` job (download artifact → extract → E2E) → `deploy` job (deploy-pages). Lint and Playwright failures both block the deploy.
- Required `pages: write` and `id-token: write` permissions are scoped to the deploy job only.

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
