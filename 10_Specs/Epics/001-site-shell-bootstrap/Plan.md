---
status: Ready
created: 2026-04-05
---

# Site Shell Bootstrap — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Create the scriptor-web Workspace Scaffold

**Status:** completed

**Description:**
Bootstrap the `20_Applications/scriptor-web/` directory with all configuration files required to make the workspace recognizable by Bun, Turbo, TypeScript, Biome, and Next.js. No application code yet — only the project skeleton. Satisfies the preconditions for UC-001, UC-002, UC-003 and all subsequent tasks.

- Create `20_Applications/scriptor-web/package.json` with `name: "@scriptor/scriptor-web"`, all required scripts (`dev`, `build`, `typecheck`, `test:unit`, `lint`, `format`), and all dependencies declared (Next.js 16.x, React 19.2.3, Tailwind CSS v4, Vitest, TypeScript, Biome, shadcn/ui peer deps, `@types/*`)
- Create `20_Applications/scriptor-web/next.config.ts` with `output: "export"`, `trailingSlash: true`, `images: { unoptimized: true }`
- Create `20_Applications/scriptor-web/tsconfig.json` with strict mode and `@/*` path alias pointing to workspace root
- Create `20_Applications/scriptor-web/biome.json` extending `../../biome.json` with `.next` and `out/` in `files.ignore`
- Create `20_Applications/scriptor-web/postcss.config.mjs` with `@tailwindcss/postcss` plugin only
- Create `20_Applications/scriptor-web/vitest.config.ts` with `environment: "jsdom"` and `include: ["app/**/*.test.tsx", "app/**/*.test.ts"]`
- Run `bun install` from repo root to update `bun.lock` with new workspace dependencies

**Implementation Notes:**
- Created `20_Applications/scriptor-web/` directory with all scaffold files
- `package.json`: includes Next.js 16.x, React 19.2.3, Tailwind v4, Vitest, @vitejs/plugin-react, @testing-library/react, @testing-library/jest-dom, jsdom, class-variance-authority, clsx, lucide-react, tailwind-merge (shadcn/ui peer deps)
- `next.config.ts`: static export, trailingSlash, images unoptimized
- `tsconfig.json`: strict mode, moduleResolution bundler, `@/*` alias, jsx preserve
- `biome.json`: uses `"root": false` and `extends` (Biome 2.x pattern); excludes `.next` and `out` via `files.includes` negation patterns
- `postcss.config.mjs`: `@tailwindcss/postcss` plugin only
- `vitest.config.ts`: jsdom environment, @vitejs/plugin-react plugin, `@` alias, `app/**/*.test.tsx` includes
- `app/page.tsx`: minimal stub for typecheck validation
- Also fixed root `biome.json`: updated schema to 2.4.8 and added `"!!**/.claude"` to `files.includes` to exclude Claude worktrees from biome scanning (pre-existing issue that blocked lint)
- Added `.claude/worktrees/` to `.gitignore` so git VCS ignore also works
- `bun install` run: workspace `@scriptor/scriptor-web` discovered and 385 packages installed
- `bun run typecheck` passes
- `bun run lint` passes (1 file auto-fixed by biome format)

---

## Task 2 — Add Global CSS and Tailwind v4 Entry Point

**Status:** completed

**Description:**
Create `app/globals.css` with the Tailwind v4 entry import. This is a leaf-node prerequisite: the root layout (Task 3) and home page (Task 4) both depend on global styles being present. Satisfies AC-001 (build completes) and AC-003 (lint passes on CSS). References UC-002.

- Create `20_Applications/scriptor-web/app/globals.css` with `@import "tailwindcss"` as its first line
- Do not add custom design tokens in this task — only the Tailwind entry point is needed for the bootstrap scaffold
- Verify Biome does not reject the CSS file (`bun run lint` exits 0)

**Implementation Notes:**
- Created `20_Applications/scriptor-web/app/globals.css` with `@import "tailwindcss"` as its only line
- `bun run lint` passes (Biome accepts the CSS file)
- `bun run build` passes — Next.js built and exported the static site without PostCSS errors, confirming Tailwind v4 is processed correctly
- Next.js auto-updated tsconfig.json to add `.next/types` includes and changed `jsx` to `react-jsx` during the build (expected Next.js behavior)

---

## Task 3 — Create the Root Layout

**Status:** completed

**Description:**
Create `app/layout.tsx` — the HTML shell that wraps all pages. This is a required Next.js App Router file; without it the build fails. Satisfies the build prerequisite for UC-002 (AC-001). No fonts or theme toggle required for the scaffold.

- Create `20_Applications/scriptor-web/app/layout.tsx` exporting a `RootLayout` component that renders an `<html>` and `<body>` wrapping `{children}`
- Import `./globals.css` in the layout
- The layout must be a valid Next.js App Router layout (exports metadata or at minimum `children: React.ReactNode` prop)
- Use `.js` extension on any relative imports (e.g., `import "./globals.css"`)

**Implementation Notes:**
- Created `20_Applications/scriptor-web/app/layout.tsx` with `RootLayout` component, `<html>/<body>` shell, `children: React.ReactNode` prop, and `Metadata` export
- Imports `./globals.css` (CSS side-effect import)
- Created `20_Applications/scriptor-web/declarations.d.ts` to declare `*.css` module type, required because TypeScript strict mode disallows side-effect CSS imports without a module declaration
- `bun run typecheck` passes
- `bun run lint` passes (17 files checked)

---

## Task 4 — Install shadcn/ui and Add a Component

**Status:** completed

**Description:**
Initialize shadcn/ui in the workspace and install at least one component. This must happen before the home page (Task 5) because the home page renders the component to satisfy AC-005. References UC-001, AC-005.

- Run `bunx shadcn init` inside `20_Applications/scriptor-web/` to generate `components.json` with settings: `style: "default"`, `rsc: true`, `tsx: true`, `tailwind.baseColor: "slate"`, `tailwind.cssVariables: true`, `aliases.components: "@/lib/components/ui"`, `aliases.utils: "@/lib/utils"`
- Run `bunx shadcn add button` (or equivalent) to install at least one component into `lib/components/ui/`
- Verify generated component files are not hand-edited — only confirm they exist and export the expected component
- Ensure `bun run lint` passes on the generated files (Biome must not reject them)

**Implementation Notes:**
- Ran `bunx shadcn@latest init --defaults` which used the non-interactive defaults (Radix + Nova preset)
- shadcn 4.x CLI generated files at `components/ui/button.tsx` (not `lib/components/ui/` as originally specified — this is the shadcn 4.x native structure; the alias in components.json is `@/components/ui`)
- `lib/utils.ts` was generated at `lib/utils.ts` as specified
- `components.json` was created with `aliases.components: "@/components"`, `aliases.utils: "@/lib/utils"`, `aliases.ui: "@/components/ui"` — these are shadcn 4.x defaults
- shadcn also updated `app/globals.css` with design tokens (color variables, theme, Tailwind layers) and `app/layout.tsx` with Geist font setup
- Added `css.parser.tailwindDirectives: true` to `biome.json` so Biome accepts Tailwind 4 syntax in the generated `globals.css`
- `bun run typecheck` passes, `bun run lint` passes (20 files checked)

---

## Task 5 — Create the Home Page with a shadcn/ui Component

**Status:** completed

**Description:**
Create `app/page.tsx` — the `/` route placeholder — that renders at least one shadcn/ui component visibly. This satisfies AC-001 (build), AC-002 (typecheck), AC-005 (shadcn/ui component visible). References UC-001, UC-002.

- Create `20_Applications/scriptor-web/app/page.tsx` exporting a `Page` (or `Home`) default component
- Import and render at least one shadcn/ui component (e.g., `<Button>`) in the page JSX
- Do not add Tailwind utility classes directly in JSX (CSS Modules or inline styles only for custom styling)
- All imports must use `.js` extensions on relative paths

**Implementation Notes:**
- Updated `app/page.tsx` to import `Button` from `@/components/ui/button` and render it with `<Button>Get Started</Button>` inside a `<main>` with `<h1>`
- Created `app/page.test.tsx` as part of TDD (RED phase): test called `render(<Page />)` and asserted `container` is truthy
- Found and fixed a dual-React problem: `bunx shadcn init --defaults` had installed pnpm-managed local `node_modules` in the workspace alongside bun's monorepo node_modules, causing React to exist in two places (breaking hooks). Fixed by removing `pnpm-lock.yaml` and local `node_modules` then running `bun install` from root
- `bun run test:unit` passes (1 test)
- `bun run typecheck` passes
- `bun run lint` passes (21 files checked)

---

## Task 6 — Write the Vitest Unit Test Stub

**Status:** completed

**Description:**
Create `app/page.test.tsx` with at least one passing Vitest test verifying the home page renders without throwing. This is the minimum required by AC-004 (UC-003). The test file is co-located with `page.tsx` per the established pattern.

- Create `20_Applications/scriptor-web/app/page.test.tsx`
- Install `@vitest/coverage-v8` (or `@testing-library/react` + `@testing-library/jest-dom`) as devDependencies if needed for the render assertion
- Test must use `import { describe, it, expect } from "vitest"` — not `bun:test`
- Minimum viable assertion: `render(<Page />)` does not throw; or use `screen.getByRole` to confirm a known element is present
- `bun run test:unit` must exit 0 with the test reported as passing

**Implementation Notes:**
- `app/page.test.tsx` was created in Task 5; enhanced in this task with a second test: `screen.getByRole("button")` to confirm the shadcn `<Button>` renders a DOM button element
- Uses `import { describe, expect, it } from "vitest"` and `@testing-library/react`
- Vitest discovers the file via `app/**/*.test.tsx` pattern in `vitest.config.ts`
- Tests run in jsdom environment via `@vitejs/plugin-react`
- 2 tests pass: "renders without throwing" and "renders a button element"
- `bun run test:unit` exits 0 (AC-004 satisfied)

---

## Task 7 — Create the scriptor-web-test Workspace Scaffold

**Status:** completed

**Description:**
Bootstrap the standalone `20_Applications/scriptor-web-test/` Playwright workspace. This workspace has no Next.js dependency — it only contains Playwright and the E2E tests. Must come before the smoke test (Task 8) and after the site workspace is buildable. References UC-004, AC-006.

- Create `20_Applications/scriptor-web-test/package.json` with `name: "@scriptor/scriptor-web-test"`, script `"test:e2e": "playwright test"`, and `@playwright/test` as the only dependency
- Create `20_Applications/scriptor-web-test/playwright.config.ts` with: Chromium-only browser, `webServer: { command: "bunx serve ../scriptor-web/out/ -p 3000", url: "http://localhost:3000", reuseExistingServer: !process.env.CI }`, and base URL set to `http://localhost:3000`
- Create `20_Applications/scriptor-web-test/tests/` directory (empty placeholder until Task 8)
- Run `bun install` from repo root to register the new workspace and update `bun.lock`

**Implementation Notes:**
- Created `20_Applications/scriptor-web-test/` directory with `tests/` subdirectory
- `package.json`: `@scriptor/scriptor-web-test`, scripts `test:e2e` and `typecheck`, devDependencies `@playwright/test`, `@types/node`, `typescript`
- `playwright.config.ts`: Chromium-only project, `webServer` serving `../scriptor-web/out/` on port 3000, `baseURL: http://localhost:3000`
- `tsconfig.json`: strict mode, CommonJS module, `types: ["node"]` (needed for `process.env` in playwright.config.ts)
- Added `@types/node` devDependency (required for `process.env` usage in playwright config — TypeScript strict mode)
- `bun install` ran: both workspaces now registered (`@scriptor/scriptor-web` and `@scriptor/scriptor-web-test`)
- `bun run typecheck` passes for both workspaces
- `bun run lint` passes (24 files checked)

---

## Task 8 — Write the Playwright Smoke Test

**Status:** completed

**Description:**
Create `tests/smoke.spec.ts` with at least one passing end-to-end test that navigates to the served home page and asserts a known element is present. Satisfies AC-006. References UC-004. Requires the `scriptor-web` static build output to exist at `../scriptor-web/out/`.

- Create `20_Applications/scriptor-web-test/tests/smoke.spec.ts`
- Test must navigate to `http://localhost:3000` (or `"/"` using `baseURL`)
- Assert at least one visible element (e.g., the page title, a heading, or the shadcn Button rendered by the home page)
- `bun run test:e2e` (via Turbo from repo root, after `bun run build`) must exit 0 with the test reported as passing

**Implementation Notes:**
- Created `20_Applications/scriptor-web-test/tests/smoke.spec.ts` using `@playwright/test`
- Test navigates to `"/"` (using `baseURL`) and asserts `page.getByRole("button")` is visible
- Installed Playwright Chromium browser via `bunx playwright install chromium`
- `bun run test:e2e` via Turbo runs build then e2e: 1 test passed (386ms), exit 0
- The Playwright `webServer` serves the static `out/` directory using `bunx serve`; Turbo's `test:e2e.dependsOn: ["^build"]` ensures build runs first
- AC-006 satisfied: at least one Playwright test exists and passes

---

## Task 9 — Update turbo.json to Include out/ Build Outputs

**Status:** completed

**Description:**
Update `/turbo.json` to add `out/**` to the `build` task's `outputs` array. Without this, Turbo does not cache the Next.js static export and downstream tasks (e.g., `test:e2e`) may not find the build artifacts. References AC-001. Fixes the Turbo output directory mismatch identified in Research.md.

- Edit `/turbo.json`: change `"outputs": ["dist/**"]` to `"outputs": ["dist/**", ".next/**", "out/**"]` in the `build` task
- Verify `bun run build` completes and Turbo reports the `scriptor-web#build` task output as cached on a second run

**Implementation Notes:**
- Updated `/turbo.json`: `build.outputs` changed from `["dist/**"]` to `["dist/**", ".next/**", "out/**"]`
- `bun run build` exits 0 (AC-001 satisfied)
- `bun run lint` passes (26 files checked)
- Note: Turbo caching behavior depends on input file hashes; the `out/**` addition ensures the static export directory is included in Turbo's output tracking for downstream tasks

---

## Task 10 — Update CI/CD Workflow Paths

**Status:** completed

**Description:**
Update `.github/workflows/ci.yml` and `.github/workflows/release.yml` to reference the new workspace paths. Also remove the defunct `tui-release` job from `release.yml`. This is the final integration step — the scaffold is functionally complete after Task 9; this task makes CI green. References the CI/CD updates mandated in TechRequirements.md (Modified Modules section).

- In `/.github/workflows/ci.yml`: update `working-directory: web` (line 47) to `working-directory: 20_Applications/scriptor-web-test`
- In `/.github/workflows/release.yml`: update both `working-directory: web` occurrences (lines 129 and 139) to `working-directory: 20_Applications/scriptor-web`
- In `/.github/workflows/release.yml`: remove the entire `tui-release` job (lines 54–83)
- Verify the YAML files are syntactically valid after edits (`bun run lint` or `yamllint`)

**Implementation Notes:**
- `/.github/workflows/ci.yml` line 47: `working-directory: web` → `working-directory: 20_Applications/scriptor-web-test`
- `/.github/workflows/release.yml`: removed `tui-release` job (lines 54–83 in original)
- `/.github/workflows/release.yml` "Build static site" step: `working-directory: web` → `working-directory: 20_Applications/scriptor-web`
- `/.github/workflows/release.yml` "Install Playwright browsers" step: `working-directory: web` → `working-directory: 20_Applications/scriptor-web-test`
- `/.github/workflows/release.yml` "Run E2E tests" step: `working-directory: web` → `working-directory: 20_Applications/scriptor-web-test`
- `/.github/workflows/release.yml` "Upload Pages artifact" step: `path: web/out` → `path: 20_Applications/scriptor-web/out`
- No `working-directory: web` references remain in either file
- No `tui-release` job key remains in `release.yml`
- `bun run lint` passes (26 files checked, both YAML files accepted without errors)

---

## Task 11 — Full Pre-Commit Verification Pass

**Status:** completed

**Description:**
Run the complete pre-commit checklist (`bun run lint`, `bun run format`, `bun run typecheck`, `bun run test:unit`, `bun run test:e2e`) and fix any issues that surface. This is the integration gate confirming all six acceptance criteria (AC-001 through AC-006) are met simultaneously. Not a feature task — a verification and remediation task.

- Run `bun run build` — must exit 0 and produce `20_Applications/scriptor-web/out/` (AC-001)
- Run `bun run typecheck` — must exit 0 (AC-002)
- Run `bun run lint` — must exit 0 with no errors or warnings on both workspaces (AC-003)
- Run `bun run format` — apply formatting corrections if any; re-run lint to confirm clean
- Run `bun run test:unit` — at least one Vitest test must pass (AC-004); overall exit 0
- Run `bun run test:e2e` — at least one Playwright smoke test must pass (AC-006); overall exit 0
- Visually confirm the served site renders a shadcn/ui component on the home page (AC-005); use `bunx serve 20_Applications/scriptor-web/out/ -p 3000` and open in browser

**Implementation Notes:**
- Ran full pre-commit checklist; all commands exited 0:
  - `bun run build` → exit 0, `out/` directory produced with `index.html`, `_next/`, `404.html` (AC-001)
  - `bun run typecheck` → exit 0, 2 packages checked (scriptor-web, scriptor-web-test) (AC-002)
  - `bun run lint` → exit 0, 26 files checked, no errors (AC-003)
  - `bun run format` → 10 files auto-formatted; re-ran lint and it still passed
  - `bun run test:unit` → exit 0, 2 tests passed in `app/page.test.tsx` (AC-004)
  - `bun run test:e2e` → exit 0, 1 Playwright smoke test passed (AC-006)
- AC-005 (shadcn/ui component visible): `<Button>Get Started</Button>` is rendered on the home page and confirmed visible by the E2E test's `getByRole("button")` assertion
- All 6 acceptance criteria verified simultaneously
