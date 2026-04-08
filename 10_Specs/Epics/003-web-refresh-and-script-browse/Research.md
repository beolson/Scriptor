---
status: Ready
created: 2026-04-07
---

# Web Refresh and Script Browse — Codebase Research

## Summary

The web application lives at `20_Applications/scriptor-web/` (not `web/` as described in CLAUDE.md — the monorepo layout differs from the documented layout). It is a Next.js 16 static-export app with a scripts browse page and script detail pages. The design token system uses shadcn/Tailwind v4 with oklch color values and `.dark` class theming (not `data-theme` attribute as CLAUDE.md describes). The font is Geist (not IBM Plex Mono / JetBrains Mono).

The current filter UI in `ScriptsBrowser` uses a two-tier sequential model: first pick a platform (Linux/Windows/macOS), then pick an OS version. Filter options come from `lib/platforms.ts` which hardcodes OS labels per platform — they are not derived from actual scripts present in the repo. This is the core gap AC-001 and AC-002 target.

The script data model uses three separate fields — `platform`, `os`, and optional `arch` — read from `.md` frontmatter co-located with scripts. The epic calls for collapsing these into a single `platform` field (e.g., `debian-13-x64`). This affects `lib/types.ts`, `lib/loadScripts.ts`, and all consumer code.

The homepage (`app/page.tsx`) is a stub: it renders `<h1>Scriptor</h1>` and a `<Button>Get Started</Button>`. There is no hero content, no description, and no browse CTA — the entire hero section needs to be built from scratch.

The script detail page already renders: title, platform/os/arch metadata tags, spec body as Markdown, source code block, and a run command with a `CopyButton`. The `CopyButton` component is already implemented and tested. The run command format matches AC-008. The detail page is substantially ready; it will need minor updates to reflect the new single `platform` field instead of separate `platform`/`os`/`arch` fields.

The test framework is Vitest (not Bun's native test runner) with `@testing-library/react` for component tests. Test files are co-located alongside source files. Integration tests in `loadScripts.test.ts` hit the real `scripts/` directory on disk.

---

## Related Code Paths

### A. Script Manifest and Data Model

**Script directory structure (real filesystem):**
- `scripts/linux/ubuntu-24.04/install-curl.sh` — shell script source
- `scripts/linux/ubuntu-24.04/install-curl.md` — spec file (frontmatter + body)
- `scripts/mac/macos-sequoia/install-homebrew.sh` and `.md`
- `scripts/windows/windows-11/setup-winget.ps1` and `.md`

**No `scriptor.yaml` at repo root.** Script metadata is embedded in each `.md` file's YAML frontmatter. There is no central manifest file.

**Current `.md` frontmatter fields (from actual script files):**
```
platform: linux      # "linux" | "windows" | "mac"
os: ubuntu-24.04     # distro-version string
title: Install curl  # display name
# optional:
arch: x64            # "x64" | "arm64" — omitted when arch-agnostic
```

**`20_Applications/scriptor-web/lib/types.ts`** — defines the `Script` interface:
- `id: string` — derived from relative spec path (e.g., `linux/ubuntu-24.04/install-curl`)
- `title: string` — from frontmatter `title`
- `platform: Platform` — `"linux" | "windows" | "mac"`
- `os: string` — from frontmatter `os`
- `arch?: Arch` — optional `"x64" | "arm64"`
- `body: string` — trimmed Markdown body text
- `source: string` — raw script file contents (empty string if file missing)
- `runCommand: string` — one-liner curl or irm command (empty string if file missing)

**`20_Applications/scriptor-web/lib/loadScripts.ts`** — build-time data loader:
- Uses injectable `LoadScriptsDeps` (glob, readFile, fileExists, scriptsDir) for testability
- Real deps use `node:fs/promises` (`readdir`, `stat`, `readFile`) — not Bun APIs (violates TypeScript rules for Bun-native APIs)
- Resolves `scriptsDir` as three levels up from `lib/` to repo root's `scripts/`
- Reads all `.md` files under `scripts/`, parses YAML frontmatter, validates required fields
- Skips scripts missing `platform`, `os`, or `title` with a `console.warn`
- Builds `runCommand` via `buildRunCommand(id, platform)` which embeds `https://raw.githubusercontent.com/beolson/Scriptor/main/scripts` + the script's relative path
- Sorts result by `platform`, then `os`, then `title`
- Validates `platform` via cast (no enum check against the `Platform` union type — any string passes)

**`20_Applications/scriptor-web/lib/loadScripts.test.ts`** — Vitest unit tests:
- All tests use injectable deps (in-memory fixtures)
- Covers: full parse, missing required fields, optional arch, platform-specific run commands, sort order, empty results, bad YAML
- Integration tests at the bottom call `loadScripts()` with no deps (hits real filesystem)
- **No test for the case where `platform` is not a valid `Platform` union member** — any string passes through

### B. Browse Page and Filter UI

**`20_Applications/scriptor-web/app/scripts/page.tsx`** — server component:
- Calls `loadScripts()` at request/build time
- Renders `<h1>Browse Scripts</h1>` and `<ScriptsBrowser scripts={scripts} />`
- No layout wrapper, no nav, no hero linkage

**`20_Applications/scriptor-web/app/scripts/ScriptsBrowser.tsx`** — client component (`"use client"`):
- Props: `scripts: Script[]`
- State: `platform: Platform | null`, `os: string | null`
- Two-tier filter: platform row always visible, OS row appears only after a platform is selected
- `presentPlatforms`: derived from scripts (dynamic — correct behavior)
- `osValuesForPlatform(p)`: derived from scripts for the selected platform (dynamic)
- Platform button labels come from `PLATFORMS[p].label` in `lib/platforms.ts`
- `isPlatformEnabled(p)` / `isOsEnabled(o)`: cross-filter disable logic
- Script list: `<ul>` of `<li>` with `<Link href={/scripts/${script.id}}>` — dynamic route uses `[...slug]`
- Empty state rendered via `<EmptyState />` when `filtered.length === 0`

**`20_Applications/scriptor-web/lib/platforms.ts`** — **hardcoded** platform config:
```ts
export const PLATFORMS: Record<Platform, { label: string; osValues: string[] }> = {
    linux: { label: "Linux", osValues: ["ubuntu-24.04", "ubuntu-22.04", "debian-12", "fedora-40", "arch"] },
    windows: { label: "Windows", osValues: ["windows-11", "windows-10"] },
    mac: { label: "macOS", osValues: ["macos-sequoia", "macos-sonoma", "macos-ventura"] },
};
```
The `osValues` array is defined here but is **not used** in the current `ScriptsBrowser` — the browser derives OS values dynamically from scripts. The `label` is used for platform button display. AC-002 requires eliminating the hardcoded labels entirely.

**`20_Applications/scriptor-web/components/ui/filter-button.tsx`** — generic filter button component:
- Props: `label: string`, `active: boolean`, `disabled: boolean`, `onClick: () => void`
- Uses `class-variance-authority` (cva) for active/disabled variants
- Sets `aria-disabled` (not `disabled` attribute) and `data-active`
- CSS Module: `filter-button.module.css` — uses `var(--border)`, `var(--muted)`, `var(--primary)`, `var(--primary-foreground)`, `var(--radius-md)`

**`20_Applications/scriptor-web/components/ui/empty-state.tsx`**:
- Accepts optional `message` prop (default: `"No scripts found for this combination."`)

**`20_Applications/scriptor-web/app/scripts/ScriptsBrowser.module.css`**:
- Uses CSS custom properties with fallbacks: `var(--gap-md, 1rem)`, `var(--gap-sm, 0.5rem)`, `var(--gap-xs, 0.25rem)`, `var(--border)`, `var(--muted)`, `var(--radius-md, 4px)`
- Note: `--gap-md`, `--gap-sm`, `--gap-xs` are **fallback values** only — these tokens are not defined in `globals.css`

### C. Script Detail Page

**`20_Applications/scriptor-web/app/scripts/[...slug]/page.tsx`** — server component:
- Route: `/scripts/linux/ubuntu-24.04/install-curl` → slug `["linux","ubuntu-24.04","install-curl"]` → id `linux/ubuntu-24.04/install-curl`
- `generateStaticParams()`: calls `loadScripts()`, maps each script's id to a slug array
- Renders: title (`<h1>`), metadata tags (platform, os, optional arch), spec body (`<ReactMarkdown>`), source code (`<pre><code>`), run command with `<CopyButton>`
- Uses `notFound()` from `next/navigation` for unknown slugs
- CSS Module: `detail-page.module.css` — uses `var(--muted)`, `var(--muted-foreground)`, `var(--border)`, `var(--radius-md, 4px)`, `var(--gap-*)` fallbacks, `var(--font-mono, monospace)`

**`20_Applications/scriptor-web/components/ui/copy-button.tsx`** — client component:
- Props: `text: string`, `label?: string` (default: `"Copy"`)
- Uses `navigator.clipboard.writeText` with a `document.execCommand` fallback
- Shows `"Copied!"` for 1500ms after click, then reverts
- No external icon library for copy icon — text-only label

**`20_Applications/scriptor-web/app/scripts/[...slug]/page.test.tsx`** — Vitest tests:
- Mocks `loadScripts` and `next/navigation`
- Tests: title, platform/os/arch metadata, body markdown, source code, run command text, CopyButton presence, windows run command, `notFound()` for unknown slug
- **No test for the case where `source` is empty string** (renders "Source unavailable." fallback)

### D. Homepage

**`20_Applications/scriptor-web/app/page.tsx`** — stub only:
```tsx
export default function Page() {
    return (
        <main>
            <h1>Scriptor</h1>
            <Button>Get Started</Button>
        </main>
    );
}
```
- No hero description, no browse CTA linking to `/scripts`, no TUI reference (nothing to remove — it never existed)
- `page.test.tsx` only checks "renders without throwing" and "renders a button element"
- The `<Button>` component is `@base-ui/react/button` wrapped with `class-variance-authority` Tailwind utility class strings (not CSS Modules)

### E. CSS / Design Tokens

**`20_Applications/scriptor-web/app/globals.css`**:
- Imports: `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`
- Uses `@custom-variant dark (&:is(.dark *))` — theme switches via `.dark` class (not `data-theme` attribute)
- `@theme inline` block maps shadcn semantic names to Tailwind color utilities
- `:root` defines oklch color tokens: `--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, chart tokens, sidebar tokens, `--radius`
- `.dark` block redefines all tokens for dark mode
- All token values are grayscale oklch (no accent color beyond primary/secondary grays)
- **Gap tokens (`--gap-xs`, `--gap-sm`, `--gap-md`, `--gap-lg`) are not defined** — components that use them rely on hardcoded fallbacks
- **`--font-mono` is not defined** — `detail-page.module.css` falls back to `monospace`
- No IBM Plex Mono or JetBrains Mono fonts — uses Geist via `next/font/google`

**`20_Applications/scriptor-web/app/layout.tsx`**:
- Loads `Geist` font, maps to `--font-sans` CSS variable
- `<html lang="en" className={cn("font-sans", geist.variable)}>` — Tailwind utility class on html element
- No `data-theme` attribute, no inline theme-detection script, no `suppressHydrationWarning`
- Metadata: `title: "Scriptor"`, `description: "Script Index"`

### F. Script Directory Structure

Current layout: `scripts/<platform>/<os-version>/<script-name>.<ext>`
- `scripts/linux/ubuntu-24.04/install-curl.sh` + `install-curl.md`
- `scripts/mac/macos-sequoia/install-homebrew.sh` + `install-homebrew.md`
- `scripts/windows/windows-11/setup-winget.ps1` + `setup-winget.md`

The epic (AC-011, AC-012) proposes simplifying to a combined target identifier in frontmatter and directory path: `scripts/<platform>/<target>/<script-name>.<ext>` where target is e.g. `debian-13-x64`. For linux scripts this becomes a three-segment path `linux/debian-13-x64/script-name` rather than the current `linux/ubuntu-24.04/script-name`.

The script `id` is derived from the relative path of the `.md` file (without `.md`). The run command URL embeds this id directly. Changing the directory structure requires migrating existing scripts.

### G. Testing Patterns

- **Test framework:** Vitest (`vitest/config`, `vitest` package) — not Bun's native test runner (`bun:test`)
- **Component tests:** `@testing-library/react` with `jsdom` environment
- **Test location:** Co-located alongside source files (e.g., `ScriptsBrowser.test.tsx` next to `ScriptsBrowser.tsx`)
- **File naming:** `<ComponentName>.test.tsx` or `<moduleName>.test.ts`
- **Vitest config** (`vitest.config.ts`): scans `app/**/*.test.{ts,tsx}`, `lib/**/*.test.{ts,tsx}`, `components/**/*.test.{ts,tsx}`
- **Injectable deps pattern:** Used in `loadScripts.ts` — testable by passing `LoadScriptsDeps` override
- **Module mocking:** `vi.mock(...)` used in detail page test to mock `loadScripts` and `next/navigation`
- **No E2E tests** in `scriptor-web` (no Playwright setup found; the `scriptor-web-test` directory in `20_Applications/` may contain a separate test setup but was not explored)

---

## Existing Patterns

1. **Injectable deps for data loading**: `loadScripts` accepts optional `LoadScriptsDeps` to swap filesystem with in-memory fixtures in tests. Any new data-loading function in `lib/` should follow this pattern.

2. **CSS Modules for styling**: All custom components use co-located `.module.css` files. The `button.tsx` from shadcn scaffolding uses Tailwind utility classes directly (not CSS Modules) — it is the exception, not the pattern.

3. **Build-time data with `async` server components**: `ScriptsPage` and `ScriptDetailPage` are `async` server components that call `loadScripts()` directly. The data flows as props into client components (`ScriptsBrowser`).

4. **`"use client"` boundary at interaction components**: `ScriptsBrowser`, `FilterButton`, `CopyButton` are all marked `"use client"`. Server pages pass data as props across the boundary.

5. **`[...slug]` catch-all route for multi-segment ids**: Script ids like `linux/ubuntu-24.04/install-curl` are encoded as a slug array. `generateStaticParams` maps each id to its split array.

6. **`notFound()`** from `next/navigation` for missing scripts — tested by mocking `notFound` to throw a sentinel error.

7. **Vitest with `vi.mock`** for mocking `loadScripts` in page-level tests.

8. **CSS custom property fallbacks**: Component CSS uses `var(--token, fallback)` for tokens not guaranteed to be defined in `globals.css` (gap tokens, font-mono). This is a workaround for missing token definitions.

---

## Integration Points

| Surface | Current Behavior | Change Required by Epic |
|---|---|---|
| `lib/types.ts` — `Script` interface | Has `platform: Platform`, `os: string`, `arch?: Arch` | Replace with single `platform: string` (combined target, e.g. `debian-13-x64`). Remove `os` and `arch` fields. Update `Platform` type or remove it. |
| `lib/loadScripts.ts` — frontmatter validation | Requires `platform`, `os`, `title`; reads optional `arch` | Remove `os` and `arch` parsing; require only `platform` (combined) and `title`. Update `buildRunCommand` signature if needed. |
| `lib/platforms.ts` — hardcoded config | Defines `PLATFORMS` with labels and `osValues` | Can be deleted entirely once filter derives all options from scripts at runtime. |
| `ScriptsBrowser.tsx` — filter state | Two-tier: `platform` state + `os` state; platform row always visible, OS row conditional | Replace with single `target: string | null` state. Derive `presentTargets` from scripts. One filter row only. |
| `app/scripts/page.tsx` — browse route | Server component renders browse page with heading | May need layout / visual refresh per Variant1.pen. |
| `app/page.tsx` — homepage | Stub with `<h1>Scriptor</h1>` and `<Button>Get Started</Button>` | Full hero section: description copy, browse CTA linking to `/scripts`. |
| `app/scripts/[...slug]/page.tsx` — detail | Shows `platform`, `os`, optional `arch` as separate tags | Show single combined target string instead of three separate tags. |
| `app/globals.css` — design tokens | shadcn oklch grayscale tokens, no gap tokens, no font-mono | May need gap tokens, font-mono, and potential color/accent tokens per Variant1.pen. |
| Script `.md` frontmatter | `platform: linux`, `os: ubuntu-24.04`, optional `arch: x64` | Change to `platform: debian-13-x64` (combined). Migrate all 3 existing scripts. |
| Script directory structure | `scripts/<platform>/<os-version>/<name>` | Change to `scripts/<platform>/<target>/<name>` per AC-012. |

---

## Dependencies

| Dependency | Type | Version | Purpose |
|---|---|---|---|
| `next` | production | `^16.0.0` | Static site generation, App Router, server components |
| `react` | production | `19.2.3` | UI rendering |
| `react-dom` | production | `19.2.3` | DOM rendering |
| `react-markdown` | production | `^9.0.0` | Render spec body Markdown on detail page |
| `js-yaml` | production | `^4.1.0` | Parse YAML frontmatter in `loadScripts.ts` |
| `shadcn` | production | `^4.1.2` | Component scaffolding (shadcn/ui) |
| `tw-animate-css` | production | `^1.4.0` | CSS animation utilities (imported in globals.css) |
| `@base-ui/react` | production | `^1.3.0` | Base button primitive used by `button.tsx` |
| `tailwindcss` | devDependency | `^4.0.0` | CSS via PostCSS; utility classes used in `button.tsx` |
| `class-variance-authority` | devDependency | `^0.7.1` | Variant logic in `filter-button.tsx` and `button.tsx` |
| `clsx` + `tailwind-merge` | devDependency | `^2.x` / `^2.x` | `cn()` utility in `lib/utils.ts` |
| `vitest` | devDependency | `^3.0.0` | Test runner |
| `@testing-library/react` | devDependency | `^16.0.0` | Component tests |
| `@testing-library/jest-dom` | devDependency | `^6.0.0` | Custom matchers |
| `jsdom` | devDependency | `^26.0.0` | DOM environment for Vitest |
| `@vitejs/plugin-react` | devDependency | `^4.0.0` | React JSX transform for Vitest |
| `lucide-react` | devDependency | `^0.400.0` | Icon library (installed but not used in current code) |

---

## Gaps & Risks

### UC-001: Browse with single flat target filter

**Gaps:**
- `ScriptsBrowser` implements a two-tier sequential filter (platform then OS), not a single flat list (AC-001 violation).
- `lib/platforms.ts` hardcodes OS labels; AC-002 requires filter options derived from scripts at build time. The `PLATFORMS` record's `label` is used for platform button text — with a single combined target, the concept of a platform-level label is eliminated.
- The `Script` type has `platform: Platform` (union of 3 strings) and `os: string` and optional `arch`. These must be replaced by a single `platform: string` combined field per AC-011. This is a breaking change to `types.ts`, `loadScripts.ts`, all tests that construct `Script` objects, and the detail page.
- `loadScripts.ts` uses `node:fs/promises` `readFile` instead of `Bun.file(path).text()`. The Bun native API rule in TypeScript.md requires the Bun API. The real deps factory violates this rule.
- `loadScripts.ts` casts `fm.platform` to `Platform` without validating it is one of the three allowed values. After the epic's model change this field becomes a free-form combined target string, so cast validation may be irrelevant — but the lack of validation should be noted.
- Gap tokens (`--gap-xs`, `--gap-sm`, `--gap-md`, `--gap-lg`) are referenced in component CSS but not defined in `globals.css`. Components use hardcoded fallbacks. If the design refresh adds new components that rely on these tokens without fallbacks, rendering will break.

**Risks:**
- The `[...slug]` route and `generateStaticParams` use the script `id`, which is derived from the file path. Changing directory structure from `linux/ubuntu-24.04/` to `linux/debian-13-x64/` changes all existing script ids, which breaks any existing bookmarks or external links.
- The integration test in `loadScripts.test.ts` asserts at least 3 scripts exist. Migrating scripts to a new directory structure requires updating the real script files on disk — the integration test will fail until migration is complete.
- `loadScripts.test.ts` imports via `vitest`, not `bun:test`. The root turbo `test:unit` script runs `bun test` (per CLAUDE.md). If `bun test` does not run Vitest automatically, the test setup may require reconciliation.

### UC-002: Homepage hero

**Gaps:**
- `app/page.tsx` is a stub with no hero content. The entire hero section — description text, browse CTA — must be authored.
- `page.test.tsx` only tests "renders without throwing" and "renders a button". Tests will need to be updated to assert hero content and CTA link once the page is built.
- No nav or site chrome exists — layout.tsx has no header/nav component. Whether the hero page needs a nav bar is an implementation decision.

### UC-003: Script detail — run command and copy

**Gaps:**
- The detail page already renders a run command and `CopyButton` — this use case is substantially implemented.
- After the `Script` type change (removing `os` and `arch`, merging to single `platform`), the metadata section in `detail-page.module.css` that renders separate `platform`, `os`, and `arch` tags must be updated to render a single target tag.
- The detail page test file will need fixture updates to remove `os`/`arch` fields from `Script` objects.
- `CopyButton` has no visual icon — text-only. Variant1.pen may specify an icon (e.g., clipboard icon). `lucide-react` is installed as a dependency but not currently used.

### General Gaps

- **No `scriptor.yaml` manifest file** at repo root. CLAUDE.md references it heavily (including a field reference table), but it does not exist. Script metadata lives in per-file frontmatter. The epic may or may not require adding a central manifest — the Functional.md spec shows frontmatter-only approach.
- **CLAUDE.md describes a `web/` workspace**; the actual workspace is `20_Applications/scriptor-web/`. All path references in CLAUDE.md (e.g., `web/lib/types.ts`) are incorrect for this repo layout.
- **Font mismatch:** CLAUDE.md specifies IBM Plex Mono and JetBrains Mono; the actual app uses Geist. The design refresh may need to align with Variant1.pen's font choices.
- **Theme mechanism mismatch:** CLAUDE.md specifies `data-theme` attribute; the app uses `.dark` CSS class via shadcn's `@custom-variant dark` approach.
- **`button.tsx` uses Tailwind utility strings** in `cva` definitions, contradicting the "CSS Modules only" rule in CLAUDE.md. The shadcn-scaffolded button is the exception. Custom components should use CSS Modules.
- **No E2E tests** in `scriptor-web`. If the epic adds E2E coverage, a Playwright setup will need to be created from scratch.
- **`lucide-react` installed but unused** — available if the design refresh needs icons.
