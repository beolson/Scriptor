# Phase 2 — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Web Project Scaffolding & Tooling

**Status:** not started

**Description:**
Initialize the `web/` Next.js project and configure all tooling before any feature work begins. Establishes the foundation for the entire Phase 2 website (referenced by all subsequent tasks).

- Create the `web/` directory at the repository root, peer to `source/`.
- Bootstrap a Next.js + TypeScript + Tailwind + App Router project via `bunx create-next-app@latest`.
- Configure `web/next.config.ts`: `output: 'export'`, `basePath: '/Scriptor'`, `trailingSlash: true`, `images.unoptimized: true`.
- Install Biome in `web/`: add `@biomejs/biome` (dev), create `web/biome.json` matching Phase 1 conventions (tab indent, recommended rules).
- Install additional dependencies: `react-markdown`, `rehype-highlight`, `highlight.js`, `js-yaml`, `@types/js-yaml`, `@playwright/test`.
- Configure Playwright: create `web/playwright.config.ts` pointing at `web/playwright/` for test files and targeting the built `web/out/` static export served locally during test runs.
- Add scripts to `web/package.json`: `dev` → `next dev`, `build` → `next build`, `lint` → `biome check`, `format` → `biome format --write`, `test:e2e` → `playwright test`.
- Create a minimal `web/app/layout.tsx` with `<html>` and `<body>` wrappers and a placeholder `<title>Scriptor</title>`.

**TDD Approach:**
- **RED:** Write `web/playwright/smoke.spec.ts` with a single test asserting the homepage has a `<title>` element containing "Scriptor". The test fails because no pages exist yet.
- **GREEN:** Confirm the full toolchain works end-to-end: `bun run build` produces `web/out/`, `bun run lint` passes (Biome), and `bun run test:e2e` discovers and executes the smoke test (even if the assertion fails — the goal is infrastructure, not the page content).
- Cover: project builds without TypeScript errors, Biome passes with zero violations, Playwright test runner discovers test files.

---

## Task 2 — YAML Schema Extension, Sample Data & Build-Time Loader

**Status:** not started

**Description:**
Define TypeScript types for the extended `scriptor.yaml` schema (FR-2-001), create a sample `scriptor.yaml` at the repository root with the new `spec` field, and implement the data loader that all Next.js pages use at build time.

- Define `web/lib/types.ts`: export a `ScriptEntry` interface with fields `id: string`, `name: string`, `description: string`, `spec?: string`, `platform: 'windows' | 'linux' | 'mac'`, `arch: 'x86' | 'arm'`, `distro?: string`, `version?: string`, `script: string`, `dependencies?: string[]`.
- Create `scriptor.yaml` at the repository root with at least 6 sample entries: at least one Windows, at least two Linux entries (different distros), at least one macOS — and at least two entries with a populated `spec` field (multi-line markdown).
- Implement `web/lib/loadScripts.ts`: reads `../scriptor.yaml` relative to `web/` using `Bun.file()`, parses with `js-yaml`, returns a typed `ScriptEntry[]`.
- Export helper functions: `getScriptsByPlatform(platform: string): ScriptEntry[]`, `getScriptById(id: string): ScriptEntry | undefined`, `getAllScriptIds(): string[]`.

**TDD Approach:**
- **RED:** Write `web/lib/loadScripts.test.ts` using `bun test`. Tests assert: `loadScripts()` returns a non-empty array of `ScriptEntry` objects, `getScriptsByPlatform('linux')` returns only entries with `platform === 'linux'`, `getScriptById('install-docker')` returns the expected entry, `getScriptById('nonexistent')` returns `undefined`, an entry with a `spec` field has it preserved as a string. All tests fail because loader and YAML don't exist yet.
- **GREEN:** Create `scriptor.yaml` and implement the loader to make all tests pass.
- Cover: correct parsing of all fields including optional `spec`, platform filtering returns correct subset, id lookup is exact match, missing optional fields are `undefined` not missing keys, `getAllScriptIds()` returns IDs for every entry.

---

## Task 3 — Homepage: Hero Section & Platform Navigation Cards

**Status:** not started

**Description:**
Build the homepage server component (`app/page.tsx`) with a hero/welcome section and three platform navigation cards (FR-2-003). The install command component is a placeholder here and will be replaced in Task 4.

- Create `web/app/page.tsx` as a server component (no `'use client'`).
- Render a hero section: Scriptor name as an `<h1>`, a one-sentence tagline describing what Scriptor does.
- Render three platform navigation cards — Windows, Linux, macOS — each as an `<a>` (or Next.js `<Link>`) pointing to `/scripts/windows`, `/scripts/linux`, `/scripts/mac` respectively.
- Render a `<div data-testid="install-command">` placeholder in the hero area (will hold the real component in Task 4).
- Apply Tailwind utility classes for a responsive layout (stacked on mobile, side-by-side cards on desktop).

**TDD Approach:**
- **RED:** Write `web/playwright/homepage.spec.ts` with tests asserting: (1) the page has an `<h1>` containing "Scriptor", (2) exactly three platform cards are present, (3) the Windows card `href` ends with `/scripts/windows`, the Linux card ends with `/scripts/linux`, the macOS card ends with `/scripts/mac`, (4) a `[data-testid="install-command"]` element is present. Tests fail because the page doesn't exist.
- **GREEN:** Implement `app/page.tsx` to make all tests pass.
- Cover: heading text, three cards with correct hrefs (accounting for `basePath: '/Scriptor'`), install command placeholder present, page renders without hydration errors.

---

## Task 4 — OS-Detected Install Command Component

**Status:** not started

**Description:**
Build the `InstallCommand` client component (FR-2-002) that detects the visitor's OS via `navigator.userAgent` and surfaces the appropriate command (PowerShell on Windows, Bash otherwise) in a styled code block with a one-click copy button. Replaces the placeholder from Task 3.

- Create `web/app/components/InstallCommand.tsx` with the `'use client'` directive.
- Before hydration (SSR), render the Bash command (safe default). After hydration, use `useEffect` to check `navigator.userAgent` for Windows patterns and swap to the PowerShell command if detected.
- Bash command (verbatim from FR-2-002):
  ```
  sudo curl -fsSL "https://github.com/beolson/Scriptor/releases/latest/download/scriptor-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/')" -o /usr/local/bin/scriptor && sudo chmod +x /usr/local/bin/scriptor && scriptor
  ```
- PowerShell command (verbatim from FR-2-002):
  ```
  $tmp = "$env:TEMP\scriptor.exe"; Invoke-WebRequest -Uri "https://github.com/beolson/Scriptor/releases/latest/download/scriptor-windows-x64.exe" -OutFile $tmp; & $tmp
  ```
- Render a "Copy" button; on click, call `navigator.clipboard.writeText()` with the current command string and display "Copied!" feedback for 2 seconds.
- Style the code block as a clearly distinct element (dark background, monospace font, horizontal scroll on overflow).
- Replace the `[data-testid="install-command"]` placeholder in `web/app/page.tsx` with `<InstallCommand />`.

**TDD Approach:**
- **RED:** Add tests to `web/playwright/homepage.spec.ts`: (1) the `[data-testid="install-command"]` element contains a `<code>` or `<pre>` child with non-empty text, (2) a "Copy" button is visible, (3) after clicking "Copy" the text "Copied!" appears within the button or adjacent element, (4) in a browser context with a Windows user agent the displayed command contains "Invoke-WebRequest". Tests fail because the component doesn't exist.
- **GREEN:** Implement `InstallCommand.tsx` and wire it into `page.tsx` to make all tests pass.
- Cover: Bash command shown by default (non-Windows UA), Windows UA triggers PowerShell command, copy button visible, "Copied!" feedback appears after click, code block clearly styled.

---

## Task 5 — Platform Listing Pages

**Status:** not started

**Description:**
Build the platform listing pages (`/scripts/[platform]/page.tsx`) for Windows, Linux, and macOS (FR-2-004, FR-2-005), generated fully at build time via `generateStaticParams()`.

- Create `web/app/scripts/[platform]/page.tsx` as a server component.
- Implement `generateStaticParams()` returning `[{ platform: 'windows' }, { platform: 'linux' }, { platform: 'mac' }]`.
- Call `getScriptsByPlatform(platform)` from the data loader; pass the result to the page UI.
- For Windows and macOS: display scripts in a flat alphabetically sorted list.
- For Linux: group scripts by `distro`, render a heading per distro, and sort entries alphabetically by name within each group.
- For each entry render: script `name` as a Next.js `<Link>` to `/scripts/[id]`, `description`, and an arch badge (text label "x86" or "arm" styled as a small pill/badge).
- Apply Tailwind utilities for a responsive layout.

**TDD Approach:**
- **RED:** Write `web/playwright/listings.spec.ts` with tests: (1) `/scripts/windows` shows only Windows scripts (no Linux or macOS entries), (2) `/scripts/linux` renders at least one distro sub-group heading element, (3) each listing entry contains an arch badge with text "x86" or "arm", (4) clicking a script name navigates to a URL matching `/scripts/[id]`. Tests fail because pages don't exist.
- **GREEN:** Implement the listing page to make all tests pass.
- Cover: platform filtering correct, Linux distro grouping present, alphabetical ordering within groups, arch badge visible, entry links navigate to correct detail URL.

---

## Task 6 — Script Detail Page with Markdown Rendering

**Status:** not started

**Description:**
Build the script detail page (`/scripts/[id]/page.tsx`) that renders the full script specification as markdown and displays all script metadata (FR-2-006).

- Create `web/app/scripts/[id]/page.tsx` as a server component.
- Implement `generateStaticParams()` calling `getAllScriptIds()` from the data loader.
- Call `getScriptById(params.id)`; call `notFound()` from `next/navigation` if the id is unknown.
- Render metadata: `name` as an `<h1>`, `description`, platform, arch badge, `distro` + `version` (Linux only), and `dependencies` as a list of links to `/scripts/[dep-id]`.
- If `spec` is present, render it with `<ReactMarkdown rehypePlugins={[rehypeHighlight]}>{entry.spec}</ReactMarkdown>`.
- Import a highlight.js theme globally: add `import 'highlight.js/styles/github.css'` to `web/app/layout.tsx`.

**TDD Approach:**
- **RED:** Write `web/playwright/detail.spec.ts` with tests: (1) `/scripts/install-docker` (or whichever sample Linux entry has a `spec`) has an `<h1>` containing the script name, (2) the arch badge is visible, (3) the rendered spec markdown contains `<h2>` or `<p>` elements (i.e. markdown was converted to HTML), (4) a dependency link is present and its `href` ends with `/scripts/[dep-id]`. Tests fail because the page doesn't exist.
- **GREEN:** Implement the detail page and add the highlight.js import to `layout.tsx` to make all tests pass.
- Cover: name heading present, description text rendered, arch badge, spec markdown → HTML (headings, paragraphs, code blocks), dependency links correct, `notFound()` reached for unknown id.

---

## Task 7 — GitHub Actions Build-and-Deploy Pipeline

**Status:** not started

**Description:**
Create the GitHub Actions workflow that builds the static site, runs Biome and Playwright, and deploys to GitHub Pages on every push to `main` that touches `web/**` or `scriptor.yaml` (FR-2-001, Constraints).

- Create `.github/workflows/deploy-web.yml`.
- Triggers: `push` to `main` filtered to paths `web/**` and `scriptor.yaml`.
- `build` job: check out repo, install Bun, run `bun install` inside `web/`, run `bun run lint` (Biome — fail on violations), run `bun run build`, upload `web/out/` as a GitHub Pages artifact via `actions/upload-pages-artifact`.
- `test` job (depends on `build`): serve `web/out/` with a local static server (`bunx serve web/out/ -p 3000`), run `bun run test:e2e` via Playwright against `http://localhost:3000/Scriptor`.
- `deploy` job: depends on both `build` and `test`; uses `actions/deploy-pages` to publish the artifact.
- Set `permissions: pages: write` and `id-token: write` on the deploy job for OIDC-based Pages deployment.
- Set `concurrency` group on the deploy job to prevent overlapping deployments.

**TDD Approach:**
- **RED:** Write `web/lib/workflow.test.ts` using `bun test`. Parse `.github/workflows/deploy-web.yml` with `js-yaml` and assert: the `on.push.paths` array includes `'scriptor.yaml'` and `'web/**'`, at least one step contains `bun run build`, at least one step references `actions/deploy-pages`, at least one step references `bun run lint`. Test fails because the file doesn't exist.
- **GREEN:** Create the workflow file to make all assertions pass.
- Cover: trigger paths include `scriptor.yaml`, Biome lint step present, build step produces artifact, deploy step uses deploy-pages action, deploy depends on both build and test jobs.
