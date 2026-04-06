---
status: Ready
created: 2026-04-05
---

# Script Model & Browse — Technical Requirements

## Tech Stack

| Category | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Bun | 1.3.11 | Used for build-time script loading (`Bun.Glob`, `Bun.file`) |
| Language | TypeScript | 6.x | Strict mode; `.js` extensions on imports in Next.js app router |
| Framework | Next.js | 16.0.0 | App Router, `output: "export"` static site |
| UI | React | 19.2.3 | Server components for data loading, client components for filtering |
| Styling | Tailwind CSS | 4.0.0 | Via `@tailwindcss/postcss`; CVA for component variants |
| YAML parsing | js-yaml | latest | Parse spec frontmatter at build time; add to `dependencies` |
| Markdown rendering | react-markdown | latest | Render spec body on detail page; add to `dependencies` |
| Unit testing | Vitest | 3.0.0 | jsdom environment; co-located `.test.tsx` files |
| E2E testing | Playwright | 1.x | In `scriptor-web-test` workspace |
| Linting | Biome | (root) | Extends root `biome.json` |

## Architecture

### Script Folder Structure

Scripts live at the repo root under `scripts/`, nested by platform and OS:

```
scripts/
  linux/
    ubuntu-24.04/
      install-docker.sh
      install-docker.md
  windows/
    windows-11/
      setup-winget.ps1
      setup-winget.md
  mac/
    macos-sequoia/
      install-homebrew.sh
      install-homebrew.md
```

The spec `.md` file lives alongside its script source and has the same base name with a `.md` extension. There is no central manifest — the folder tree is the manifest.

### New Modules

| Module | Location | Responsibility |
|---|---|---|
| Type definitions | `20_Applications/scriptor-web/lib/types.ts` | `Script` type and platform/OS/arch vocabulary |
| Script loader | `20_Applications/scriptor-web/lib/loadScripts.ts` | Glob `scripts/**/*.md`, parse frontmatter + body, validate, return `Script[]` |
| Platform config | `20_Applications/scriptor-web/lib/platforms.ts` | Controlled vocabulary for `os` values per platform |
| Browse page | `20_Applications/scriptor-web/app/scripts/page.tsx` | Server component; loads all scripts at build time, passes to client |
| Browse client | `20_Applications/scriptor-web/app/scripts/ScriptsBrowser.tsx` | `"use client"` component; owns filter state and filtered list |
| Detail page | `20_Applications/scriptor-web/app/scripts/[...slug]/page.tsx` | Server component; `generateStaticParams` + script detail display |
| FilterButton | `20_Applications/scriptor-web/components/ui/filter-button.tsx` | Toggle button with disabled/greyed state for unavailable options |
| CopyButton | `20_Applications/scriptor-web/components/ui/copy-button.tsx` | Clipboard copy with transient "Copied!" feedback |
| EmptyState | `20_Applications/scriptor-web/components/ui/empty-state.tsx` | Message shown when no scripts match active filters |

### Modified Modules

| Module | Location | Changes |
|---|---|---|
| Home page | `20_Applications/scriptor-web/app/page.tsx` | Add link/navigation to `/scripts` browse page |
| `vitest.config.ts` | `20_Applications/scriptor-web/vitest.config.ts` | Extend `include` pattern to cover `lib/**/*.test.ts` |

## API Contracts

### `Script` type

```typescript
// lib/types.ts

export type Platform = "linux" | "windows" | "mac";
export type Arch = "x64" | "arm64";

export interface Script {
  /** Unique identifier derived from folder path: e.g., "linux/ubuntu-24.04/install-docker" */
  id: string;
  /** Human-readable display name from frontmatter `title` field */
  title: string;
  platform: Platform;
  /** OS/distro value from controlled vocabulary, e.g. "ubuntu-24.04" */
  os: string;
  /** Target architecture; undefined means arch-agnostic */
  arch?: Arch;
  /** Full Markdown body of the spec file (rendered on detail page) */
  body: string;
  /** Raw source code of the script file */
  source: string;
  /** One-liner run command for the terminal */
  runCommand: string;
}
```

### `loadScripts()`

```typescript
// lib/loadScripts.ts

/**
 * Reads all spec files from /scripts/ at build time.
 * Skips specs with missing required frontmatter fields (no build error).
 * Returns Script[] sorted by platform, then os, then title.
 */
export async function loadScripts(): Promise<Script[]>
```

### Platform config

```typescript
// lib/platforms.ts

export const PLATFORMS: Record<Platform, { label: string; osValues: string[] }> = {
  linux: {
    label: "Linux",
    osValues: ["ubuntu-24.04", "ubuntu-22.04", "debian-12", "fedora-40", "arch"],
  },
  windows: {
    label: "Windows",
    osValues: ["windows-11", "windows-10"],
  },
  mac: {
    label: "macOS",
    osValues: ["macos-sequoia", "macos-sonoma", "macos-ventura"],
  },
};
```

### `ScriptsBrowser` props

```typescript
// app/scripts/ScriptsBrowser.tsx

interface ScriptsBrowserProps {
  scripts: Script[];
}
```

### `generateStaticParams` (detail page)

```typescript
// app/scripts/[...slug]/page.tsx

export async function generateStaticParams(): Promise<{ slug: string[] }[]>
// Returns one entry per script: { slug: ["linux", "ubuntu-24.04", "install-docker"] }

interface PageProps {
  params: Promise<{ slug: string[] }>;
}
```

## Data Models

### Script ID

Derived from the file path relative to the repo-root `scripts/` directory, without the `.md` extension:

```
scripts/linux/ubuntu-24.04/install-docker.md  →  id = "linux/ubuntu-24.04/install-docker"
```

The ID maps directly to the URL slug (`/scripts/linux/ubuntu-24.04/install-docker`) and is the join key between a spec file and its corresponding script source file.

### Run Command Format

The run command is derived at build time from the script file path and the GitHub repository details.

**Linux / macOS (bash):**
```
curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/ubuntu-24.04/install-docker.sh | bash
```

**Windows (PowerShell):**
```
irm https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/windows/windows-11/setup-winget.ps1 | iex
```

The base URL `https://raw.githubusercontent.com/beolson/Scriptor/main` is a build-time constant. The script path segment is appended from the `Script.id` plus the platform-appropriate file extension (`.sh` for linux/mac, `.ps1` for windows).

### Spec File Format

```markdown
---
platform: linux
os: ubuntu-24.04
arch: x64
title: Install Docker
---

Full Markdown description of what the script does.
```

Required frontmatter: `platform`, `os`, `title`. Optional: `arch`. Specs missing any required field are silently skipped at build time.

## Filtering Logic

Filtering is entirely client-side. At build time, `loadScripts()` returns the full `Script[]` array which is serialised into the browse page as a server component prop. The `ScriptsBrowser` client component owns three pieces of filter state:

```typescript
const [platform, setPlatform] = useState<Platform | null>(null);
const [os, setOs] = useState<string | null>(null);
const [arch, setArch] = useState<Arch | null>(null);
```

**Filter application:** A script matches when every active (non-null) filter matches its corresponding field. `arch: undefined` on a script matches any arch filter value (arch-agnostic scripts are always included).

**Greyed-out options (AC-008):** Before rendering each filter button, compute whether selecting that value would yield at least one match given the other active filters. If zero matches, render the button as `disabled`.

**Deferred:** Architecture filter buttons are not rendered in the v1 UI. The `arch` field is stored on `Script` but the filter row is omitted.

## Route Structure

| URL | File | Type | Data source |
|---|---|---|---|
| `/scripts` | `app/scripts/page.tsx` | Server → Client | `loadScripts()` at build time |
| `/scripts/linux/ubuntu-24.04/install-docker` | `app/scripts/[...slug]/page.tsx` | Server | `loadScripts()` + slug lookup |

The catch-all `[...slug]` route mirrors the folder structure of `scripts/` and produces clean, readable URLs.

## Testing Strategy

### Unit Tests

- **Location:** Co-located with source — `lib/loadScripts.test.ts`, `lib/platforms.test.ts`; component tests at `components/ui/*.test.tsx`
- **Framework:** Vitest with jsdom
- **Key cases for `loadScripts`:** valid spec parsed correctly; spec with missing required field is skipped; spec with no matching script source still loads (source is empty string); arch-agnostic spec has `arch: undefined`
- **Key cases for filtering logic:** all active filters match; no filters = all scripts; greyed-out calculation correct for edge combinations; empty result
- **Key cases for components:** `FilterButton` renders disabled state; `CopyButton` shows "Copied!" feedback after click; `EmptyState` renders

### E2E Tests

- **Location:** `20_Applications/scriptor-web-test/tests/`
- **Framework:** Playwright (Chromium)
- **What to test:**
  - Browse page loads with full script list
  - Selecting a platform filter narrows the list
  - Greyed-out filter buttons are not clickable
  - Clearing all filters restores full list
  - Empty state renders when no scripts match
  - Clicking a script navigates to the detail page
  - Detail page shows title, metadata, spec body, source, and run command
  - Copy button copies run command to clipboard

## Error Handling

- **Invalid spec frontmatter:** `loadScripts()` catches parse errors per file, logs a warning to stdout (`console.warn`), and continues. The script is excluded from the output. The build does not fail.
- **Missing script source file:** `loadScripts()` sets `source: ""` and `runCommand: ""`. The detail page renders a "Source unavailable" message in place of the code block.
- **`scripts/` folder missing:** `loadScripts()` returns `[]` and logs a warning. The browse page renders the empty state.
- **Clipboard API unavailable (UC-003):** `CopyButton` catches the rejection and falls back to selecting the text in a temporary `<textarea>` for manual copy.

## Constraints & Decisions

- **Bun-native APIs for file I/O:** `Bun.Glob` for discovering spec files; `Bun.file(path).text()` for reading file contents. No `node:fs` for read operations.
- **`js-yaml` for frontmatter:** Consistent with `tui/` workspace. Add to `dependencies` in `scriptor-web/package.json`.
- **Static export is non-negotiable:** `output: "export"` stays. All data loading happens at build time via server components or `generateStaticParams`. No `getServerSideProps`, no API routes.
- **Client-side filtering only:** All script data is embedded in the browse page at build time. No runtime API calls for filter operations.
- **Catch-all route `[...slug]`:** Chosen over a flat `[id]` route so URLs mirror the `scripts/` folder structure and are human-readable.
- **Arch filter deferred:** `arch` is parsed and stored on `Script` but the filter UI row is not rendered in v1. The data model supports it for a future release.
- **No Markdown pre-processing:** The spec body is stored as raw Markdown string and rendered client-side via `react-markdown`. No remark/rehype pipeline needed for v1.
