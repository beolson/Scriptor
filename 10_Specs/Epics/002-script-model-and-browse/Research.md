---
status: Ready
created: 2026-04-05
---

# Script Model & Browse — Codebase Research

## Summary

The Scriptor monorepo has recently undergone a major restructuring (commit 581cb2d, "chore: begin SimpleScriptor rewrite"), removing the old `web/` and `tui/` workspaces. The new codebase contains a fresh `scriptor-web` workspace (Next.js 16.0.0 static site) and a standalone test workspace `scriptor-web-test` (Playwright E2E tests), both under `20_Applications/`. 

Currently, the web app has only a barebones home page with a "Get Started" button and no data loading infrastructure. The previous codebase contained a manifest-driven approach (`scriptor.yaml`) with centralized script metadata and a complex component architecture for filtering and display. Epic 002 requires replacing this with a **spec-file-driven model** where each script has a co-located `.md` file with YAML frontmatter as the sole source of truth.

Key findings:
- **No `scripts/` folder exists yet** — must be created at repo root
- **No spec file loader exists** — Epic 001 created only the shell; data loading infrastructure must be built from scratch
- **No routes for scripts exist** — the app has only a root home page; `/scripts/browse` and `/scripts/[id]` routes will need to be created
- **Component patterns exist** — Button component using shadcn/ui patterns; Tailwind CSS 4 + Vitest are configured
- **Previous Script type was complex** — had `inputs`, `dependencies`, `requires_sudo` fields; new model is simpler (no inputs/flows)
- **Previous manifest approach** — `scriptor.yaml` was hand-maintained; new approach reads from per-script `.md` files at build time
- **Styling infrastructure is ready** — globals.css has design tokens, Tailwind CSS 4 via `@tailwindcss/postcss`, shadcn/ui patterns established

## Related Code Paths

### Web Application Structure

**Files:**
- `/20_Applications/scriptor-web/next.config.ts` — Static export config (output: "export", trailingSlash: true, unoptimized images)
- `/20_Applications/scriptor-web/package.json` — Dependencies (Next.js 16.0.0, React 19.2.3, Tailwind CSS 4, @base-ui/react, shadcn/cli)
- `/20_Applications/scriptor-web/tsconfig.json` — TypeScript config with @ path alias for app root
- `/20_Applications/scriptor-web/app/layout.tsx` — Root layout with Google Fonts (Geist), metadata
- `/20_Applications/scriptor-web/app/page.tsx` — Home page (minimal: h1 and Button component)
- `/20_Applications/scriptor-web/app/globals.css` — Tailwind directives, CSS variables for design tokens (colors, spacing, typography)
- `/20_Applications/scriptor-web/app/page.test.tsx` — Unit test for home page using Vitest + React Testing Library
- `/20_Applications/scriptor-web/components/ui/button.tsx` — shadcn/ui Button component using @base-ui/react and class-variance-authority
- `/20_Applications/scriptor-web/lib/utils.ts` — Utility function `cn()` for class merging (clsx + tailwind-merge)
- `/20_Applications/scriptor-web/vitest.config.ts` — Vitest config with jsdom environment, test discovery pattern
- `/20_Applications/scriptor-web/postcss.config.mjs` — PostCSS config with @tailwindcss/postcss plugin
- `/20_Applications/scriptor-web/components.json` — shadcn/ui config (base-nova style, Tailwind CSS, lucide icons)

**Description:**
A Next.js 16 static site configured for build-time data loading and static export. The app scaffold is minimal: single home page, one Button component, unit testing infrastructure. No routes, no data loading, no filtering yet. Styling uses Tailwind CSS 4 (via @tailwindcss/postcss), design tokens in globals.css, and shadcn/ui component patterns.

**Relevance to this epic:**
- The next.config.ts is correctly configured for static export; no changes needed
- globals.css provides design token foundation (colors, spacing, typography); new components can reuse these
- Button component shows the shadcn/ui + CVA pattern to follow for new UI elements
- No `/scripts/` routes exist yet; this epic must create `/app/scripts/page.tsx` (browse) and `/app/scripts/[id]/page.tsx` (detail)
- No data loading infrastructure exists; this epic must create utilities to parse spec files and generate static routes

### Test Workspace

**Files:**
- `/20_Applications/scriptor-web-test/playwright.config.ts` — Playwright config serving static exports from `../scriptor-web/out/`
- `/20_Applications/scriptor-web-test/tests/smoke.spec.ts` — Basic smoke test (page loads, button visible)
- `/20_Applications/scriptor-web-test/package.json` — Dependencies (@playwright/test, TypeScript), scripts (test:e2e)
- `/20_Applications/scriptor-web-test/tsconfig.json` — TypeScript config (CommonJS, strict)

**Description:**
Standalone Playwright workspace for E2E testing. Currently has one smoke test verifying the home page loads. Tests are run after build (static files in `out/`) and served locally on port 3000.

**Relevance to this epic:**
- The test infrastructure is ready to add browse and detail page tests
- Playwright can be used to test filtering logic, empty states, and navigation
- New tests should follow the pattern in smoke.spec.ts and be added to `/tests/`

### Root Monorepo Configuration

**Files:**
- `/package.json` — Root workspace definition (Bun 1.3.11, Turbo 2.8.20, TypeScript 6.x)
- `/turbo.json` — Task definitions (build, dev, lint, format, typecheck, test:unit, test:e2e)
- `/biome.json` — Root Biome config (VCS: git, formatter: tab indentation, linting rules)

**Description:**
Monorepo is structured with workspaces at `20_Applications/*`, `25_UI_Components/*`, `30_Services/*`, `50_IFX/*`. Turbo orchestrates builds; Biome handles linting/formatting across all workspaces.

**Relevance to this epic:**
- Turbo task definitions already include `build` and `test:e2e` for the web workspace
- scriptor-web workspace must define `build`, `typecheck`, `test:unit`, `test:e2e` scripts in its package.json for Turbo to discover them
- Root `biome.json` already extends to child workspaces; scriptor-web/biome.json may extend root if needed

### Previous Implementation (Removed, Historical Reference Only)

**Files (from commit 581cb2d^):**
- `/web/lib/types.ts` — Defined `Script` interface with fields: id, name, description, spec, platform, arch, distro, version, dependencies, script, scriptSource, inputs
- `/web/lib/loadScripts.ts` — Loaded scripts from `scriptor.yaml` manifest file, parsed YAML, validated required fields, cached results
- `/scriptor.yaml` — Central manifest file listing all scripts with metadata (id, name, description, platform, arch, distro, version, inputs, dependencies, requires_sudo)
- `/web/app/components/ScriptFilter/ScriptFilter.tsx` — Client-side filtering component with state for arch, distro, version; filtered script list based on selection
- Previous component library: NavBar, Footer, ThemeToggle, ScriptFilter, ScriptRow, CodeBlock, etc.

**Why it was removed:**
The old model had a hand-maintained manifest, complex input handling, and dependency chains — all being removed per product requirements (no CLI inputs, no flows, no central manifest). Epic 002 replaces this with spec files as the sole source of truth.

## Existing Patterns

### Static Export Configuration

**Where used:** `/20_Applications/scriptor-web/next.config.ts`

**How it works:**
```typescript
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
```

Next.js exports to static HTML/CSS/JS in the `out/` directory. Trailing slashes are enforced for cleaner URLs. Image optimization is disabled (no server runtime). This enables deployment as a static site (e.g., GitHub Pages).

**Apply to this epic:**
- Yes. Keep this configuration as-is. It's essential for UC-001 and UC-002 (browsing and viewing details).

### Component Pattern with CVA

**Where used:** `/20_Applications/scriptor-web/components/ui/button.tsx`

**How it works:**
```typescript
"use client";
const buttonVariants = cva("... styles ...", {
  variants: {
    variant: { default: "...", outline: "...", ghost: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
});

function Button({ variant = "default", size = "default", ...props }) {
  return <ButtonPrimitive className={cn(buttonVariants({ variant, size }))} {...props} />;
}
```

Components use CVA (class-variance-authority) for variant-based styling with Tailwind CSS classes. The `cn()` utility merges classes safely.

**Apply to this epic:**
- Yes. Any new components (FilterButton, ScriptCard, CopyButton) should follow this pattern for consistency.

### Tailwind CSS v4 Setup

**Where used:**
- `/20_Applications/scriptor-web/postcss.config.mjs` (PostCSS plugin)
- `/20_Applications/scriptor-web/app/globals.css` (@import "tailwindcss")
- `/20_Applications/scriptor-web/package.json` (dependencies: @tailwindcss/postcss, tailwindcss 4.0.0)

**How it works:**
Tailwind v4 uses PostCSS plugin (`@tailwindcss/postcss`). No separate tailwind.config.js file is needed. Directives like `@import`, `@layer`, `@theme` are processed at build time. The globals.css imports "tailwindcss" to load all utilities.

**Apply to this epic:**
- Yes. Keep this setup as-is. Design tokens and utility classes are already available for styling new components.

### Testing with Vitest + Testing Library

**Where used:** `/20_Applications/scriptor-web/app/page.test.tsx`, `/20_Applications/scriptor-web/vitest.config.ts`

**How it works:**
```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.tsx", "app/**/*.test.ts"],
    globals: true,
  },
});

// page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
test("renders a button", () => {
  render(<Page />);
  const button = screen.getByRole("button");
  expect(button).toBeTruthy();
});
```

Unit tests use Vitest with jsdom environment (no browser), React Testing Library for component rendering, and describe/it/expect global functions. Tests match the pattern `app/**/*.test.tsx`.

**Apply to this epic:**
- Yes. New components (FilterButton, ScriptCard, etc.) should have co-located `.test.tsx` files following this pattern.

### E2E Testing with Playwright

**Where used:** `/20_Applications/scriptor-web-test/playwright.config.ts`, `/20_Applications/scriptor-web-test/tests/smoke.spec.ts`

**How it works:**
```typescript
// playwright.config.ts
webServer: {
  command: "bunx serve ../scriptor-web/out/ -p 3000",
  url: "http://localhost:3000",
  reuseExistingServer: !process.env.CI,
}

// tests/smoke.spec.ts
test("home page loads and renders a button", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button");
  await expect(button).toBeVisible();
});
```

Playwright spins up a static server serving `out/` directory during tests. Tests use page object model for navigation and assertions. In CI, a fresh server is used; locally, an existing server is reused.

**Apply to this epic:**
- Yes. New E2E tests for browse page (filtering, empty state) and detail page (display metadata, copy button) should be added following this pattern.

## Integration Points

### Data Loading at Build Time

**Challenge:**
Static export (output: "export") means there's no Node.js runtime to load data at request time. Data must be generated or loaded at build time and embedded into static HTML/JSON.

**Current approach (needs implementation):**
1. At build time, scan `/scripts/` folder for `.md` spec files
2. For each spec file, parse YAML frontmatter (platform, os, arch, title) and store in memory
3. Generate static HTML pages for:
   - `/scripts/browse` — displays all scripts with filters
   - `/scripts/[id]` — displays individual script details
4. Optionally export script list as JSON for client-side filtering

**Integration:** 
- The `next build` command will run `loadScripts()` utility (to be created)
- Scripts must be discoverable at build time; the `/scripts/` folder must exist and be populated before build

### Route Structure for Scripts

**Current state:**
- `/` — home page (exists)
- `/scripts` — needs to be created (browse page)
- `/scripts/[id]` — needs to be created (detail page)

**Files to create:**
- `/20_Applications/scriptor-web/app/scripts/page.tsx` — browse page with filters
- `/20_Applications/scriptor-web/app/scripts/[id]/page.tsx` — detail page
- `/20_Applications/scriptor-web/app/scripts/[id]/layout.tsx` — optional detail layout (if shared with browse)

**Data:** Scripts loaded from `/scripts/` folder at build time, made available to these components via props or context.

### Type System for Scripts

**Current:** No types defined.

**Required (from Functional.md):**
```typescript
interface ScriptSpec {
  platform: "linux" | "windows" | "mac";
  os: string; // e.g., "ubuntu-24.04", "windows-11", "macos-13"
  arch?: string; // e.g., "x64", "arm64"; optional (defaults to any/all)
  title: string; // display name
  body: string; // full markdown description (no separate short description)
}

interface LoadedScript extends ScriptSpec {
  id: string; // derived from filename (e.g., "setup-debian.md" → "setup-debian")
  filePath: string; // full path to .md file
  scriptPath: string; // inferred path to script file (e.g., setup-debian.sh or .ps1)
  runCommand: string; // derived from script path (curl | bash pattern, to be defined)
}
```

**Files to create:**
- `/20_Applications/scriptor-web/lib/types.ts` — Define ScriptSpec, LoadedScript interfaces
- `/20_Applications/scriptor-web/lib/loadScripts.ts` — Scan `/scripts/`, parse frontmatter, build LoadedScript array

## Build & Data Pipeline

**Turbo Task:** `build`

**Current behavior:**
- Runs `next build` in scriptor-web workspace
- Outputs to `out/` directory (static HTML/CSS/JS)
- `out/` is published to GitHub Pages via CI/CD

**Required changes for Epic 002:**
1. Before `next build`, ensure `/scripts/` folder exists with spec files
2. `next build` invokes loadScripts() to generate the script list
3. Routes `/scripts/browse` and `/scripts/[id]` are statically pre-rendered with data
4. Optional: Pre-generate `/scripts/index.json` for client-side filtering fallback

**No changes to turbo.json needed** — Turbo already includes build task for scriptor-web.

## Spec File Format (Defined, Not Yet Parsed)

**Location:** `/scripts/<name>.md` (alongside `/scripts/<name>.sh`, `/scripts/<name>.ps1`, etc.)

**Format:**
```markdown
---
platform: linux
os: ubuntu-24.04
arch: x64
title: Install System Basics
---

# Install System Basics

This script updates system packages and installs curl, wget, and libicu-dev on Debian 13.

## Prerequisites

- Ubuntu 24.04 with sudo access

## What it does

1. Updates apt package lists
2. Installs curl, wget, libicu-dev

## Notes

Requires sudo privileges.
```

**Parsing requirements (from Functional.md, AC-002):**
- Frontmatter fields: `platform` (required), `os` (required), `arch` (optional), `title` (required)
- Body: Full Markdown description (displayed on detail page; no separate short description)
- Missing required fields: script is excluded from site (no build error)
- No spec file for a script: script not displayed

**Example run command (from Functional.md, Data Requirements):**
- Format: `curl | bash` (Linux) or `curl | pwsh` (Windows)
- URL: Raw script URL on GitHub (exact format TBD in TechRequirements)

## Dependencies

| Dependency | Type | Version | Purpose |
|---|---|---|---|
| next | dependency | 16.0.0 | Next.js framework, static export |
| react | dependency | 19.2.3 | React for components |
| react-dom | dependency | 19.2.3 | React DOM |
| @base-ui/react | dependency | 1.3.0 | Unstyled component library (Button primitive) |
| tailwindcss | devDependency | 4.0.0 | Utility-first CSS framework |
| @tailwindcss/postcss | devDependency | 4.0.0 | PostCSS plugin for Tailwind v4 |
| class-variance-authority | devDependency | 0.7.1 | Variant-based component styling |
| clsx | devDependency | 2.1.1 | Conditional className merging |
| tailwind-merge | devDependency | 2.6.1 | Safe Tailwind CSS class merging |
| lucide-react | devDependency | 0.400.0 | Icon library (for copy button, filters, etc.) |
| vitest | devDependency | 3.0.0 | Unit testing framework |
| @testing-library/react | devDependency | 16.0.0 | Component testing utilities |
| @playwright/test | (scriptor-web-test) | 1.0.0 | E2E testing framework |
| typescript | devDependency | 6.x | TypeScript compiler |

**Missing (not yet added):**
- YAML parser (e.g., `js-yaml`) — needed to parse frontmatter in spec files
- Glob matcher (e.g., `glob`) — needed to discover spec files at build time
- Markdown parser (e.g., `markdown-it` or `remark`) — if body needs to be processed at build time; optional if served as-is

## Gaps & Risks

### Data Loading Infrastructure (Critical Gap)

- **Gap:** No utility to load spec files from `/scripts/` directory
- **Impact:** Without this, the browse and detail pages cannot access script data
- **Risk:** If YAML parser not added to dependencies, build will fail
- **Mitigation:** Must create `lib/loadScripts.ts` early in implementation; include YAML parser in package.json

### Script File Location & Naming Convention (Not Yet Defined)

- **Gap:** Epic 002 doesn't specify where `/scripts/` should be (repo root? web app?) or naming convention
- **Current assumption:** `/scripts/` at repo root with parallel structure (script.md + script.sh/.ps1)
- **Risk:** If not clarified, team may create scripts in wrong location
- **Mitigation:** TechRequirements document should define folder structure explicitly

### Run Command Format (Partially Defined)

- **Gap:** Functional.md says "curl | bash" or "curl | pwsh" but doesn't specify the exact GitHub raw URL format
- **Risk:** Detail page copy button needs exact one-liner; wrong format breaks functionality
- **Mitigation:** TechRequirements (TBD) must define the URL pattern (e.g., `curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/install-system-basics.sh | bash`)

### Static Route Generation for Dynamic Routes

- **Gap:** Next.js app router uses dynamic segments `[id]`; static export requires either:
  1. Pre-generated static files for each script (slow at build time if many scripts)
  2. Client-side loading from JSON (requires getStaticProps or dynamic route handling)
- **Risk:** If route handling not clarified, detail pages may fail to generate or render
- **Mitigation:** Implement either:
  - `generateStaticParams()` function to pre-render all script detail pages at build time
  - OR export script list as JSON and fetch client-side (but this defeats static export for detail pages)

### No Scripts Folder Exists Yet

- **Gap:** `/scripts/` directory doesn't exist; no example spec files or script files are present
- **Impact:** Build will fail if code tries to load from non-existent folder
- **Risk:** Tests cannot verify filtering or detail display without sample data
- **Mitigation:** Create `/scripts/` directory at repo root; add at least 2-3 sample `.md` + `.sh` pairs for testing

### Component Library Incomplete

- **Gap:** Only one Button component exists; new components needed:
  - FilterButton (with greyed-out state for unavailable options)
  - ScriptCard (displays title + metadata)
  - CopyButton (with visual feedback)
  - EmptyState (message when no scripts match)
  - ScriptViewer (displays code block with syntax highlighting)
- **Impact:** All UI must be built from scratch (using existing Button pattern as guide)
- **Risk:** Styling consistency and accessibility may vary if components not standardized
- **Mitigation:** Create reusable components in `/components/` following Button pattern (CVA + Tailwind)

### Testing Coverage

- **Gap:** No tests for filtering logic, empty state, copy functionality, or data loading
- **Impact:** Edge cases and errors may not be caught
- **Risk:** Broken filtering or missing scripts in output
- **Mitigation:** Add unit tests for loadScripts() logic; add E2E tests for browse/detail workflows

### No Error Boundary or Error Handling

- **Gap:** If build-time script loading fails, no graceful degradation
- **Risk:** Build fails completely; site doesn't deploy
- **Mitigation:** Add error handling to loadScripts(); log warnings for invalid specs; continue build even if some specs are invalid

### Accessibility Not Yet Addressed

- **Gap:** Filtering UI must be keyboard-navigable and screen-reader accessible
- **Risk:** Filter buttons, detail navigation may not be accessible
- **Mitigation:** Use semantic HTML (button elements, labels); test with ARIA attributes; validate with axe or similar

## Summary Table: Implementation Checklist

| Item | Status | Notes |
|---|---|---|
| `/scripts/` folder structure | Not started | Must define and create at repo root |
| Spec file format (YAML frontmatter + Markdown body) | Defined (Functional.md) | Ready for implementation |
| YAML parser dependency | Not added | Add `js-yaml` to package.json |
| `lib/loadScripts.ts` utility | Not started | Must parse spec files, validate frontmatter, build LoadedScript array |
| `lib/types.ts` types | Not started | Define ScriptSpec, LoadedScript, etc. |
| `/app/scripts/page.tsx` (browse) | Not started | Display script list, render filter buttons, handle filtering logic |
| `/app/scripts/[id]/page.tsx` (detail) | Not started | Display script metadata, full spec body, source code, copy button |
| FilterButton component | Not started | With greyed-out state for unavailable options |
| ScriptCard component | Not started | Displays script title (list view) |
| CopyButton component | Not started | Copy run command to clipboard with visual feedback |
| EmptyState component | Not started | Message when no scripts match filters |
| Sample spec files | Not started | At least 2-3 `.md` + `.sh` pairs for testing |
| Unit tests for loadScripts() | Not started | Test YAML parsing, validation, filtering |
| E2E tests for browse page | Not started | Test filtering interactions, empty state |
| E2E tests for detail page | Not started | Test display of metadata, source, copy button |
