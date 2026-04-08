---
status: Ready
created: 2026-04-07
prd: 001-script-index
---

# Web Refresh and Script Browse — Technical Requirements

## Tech Stack

All work is within `20_Applications/scriptor-web/`. No new dependencies are required.

| Concern | Library / Version |
|---|---|
| Framework | Next.js ^16.0.0, App Router, static export (`output: "export"`) |
| Language | TypeScript ^6.x, strict mode |
| UI | React 19.2.3 |
| Styling | CSS Modules + Tailwind v4 PostCSS (design tokens via CSS custom properties only) |
| Markdown rendering | react-markdown ^9.0.0 |
| Icons | lucide-react ^0.400.0 (already installed) |
| YAML parsing | js-yaml ^4.1.0 |
| Linting / Formatting | Biome (root `biome.json`) — tabs, double quotes, organizeImports on |
| Testing | Vitest ^3.0.0 + @testing-library/react ^16.0.0 + jsdom ^26.0.0 |

TypeScript path alias: `@/*` maps to `20_Applications/scriptor-web/` (relative to that workspace root).

## Architecture — Modified Modules

### 1. `lib/types.ts`

Remove the `Platform` union type, `Arch` union type, and the `os` and `arch` fields from `Script`. Replace with a single `platform: string` field (combined target identifier).

```typescript
export interface Script {
  id: string;        // e.g. "linux/debian-13-x64/install-curl"
  title: string;
  platform: string;  // combined target, e.g. "debian-13-x64"
  body: string;      // spec markdown body (below the frontmatter)
  source: string;    // raw shell script source
  runCommand: string;
}
```

The `Platform` and `Arch` union types are removed entirely. No other types in this file are affected.

### 2. `lib/loadScripts.ts`

Three changes required:

**a. Frontmatter parsing** — Remove parsing of `os` and `arch` fields. Read only `platform` (string, required) and `title` (string, required). Skip any script missing either field with `console.warn` (preserves existing skip behavior).

**b. `buildRunCommand` signature** — Function currently takes `(id, platform, os, arch)` or similar multi-field signature. Simplify to `buildRunCommand(id: string): string`. The run command format does not vary by target; the full path is already encoded in `id`.

```typescript
function buildRunCommand(id: string): string {
  return `curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/${id} | bash`;
}
```

**c. File reading API** — Replace `node:fs/promises` `readFile` calls with `Bun.file(path).text()`. This is required by the TypeScript.md rules (Bun-native API). The `LoadScriptsDeps` injectable interface must be updated to reflect the new signature: the injected file-read function should be `(path: string) => Promise<string>` (same shape, just using Bun API in production).

`LoadScriptsDeps` after change:

```typescript
export interface LoadScriptsDeps {
  readFile: (path: string) => Promise<string>;
  glob: (pattern: string, dir: string) => AsyncIterable<string>;
}

export const defaultDeps: LoadScriptsDeps = {
  readFile: (path) => Bun.file(path).text(),
  glob: async function* (pattern, dir) {
    const g = new Bun.Glob(pattern);
    yield* g.scan(dir);
  },
};
```

### 3. `lib/platforms.ts`

**DELETE this file.** It contained a hardcoded vocabulary of OS options and is no longer needed — targets are now derived directly from the scripts present in the repository.

Remove the corresponding import from any file that references it (likely `ScriptsBrowser.tsx` or a page component).

### 4. `components/ScriptsBrowser.tsx` (or equivalent browse component)

Replace the two-tier platform → OS filter with a single flat target filter.

**State change:**

```typescript
// Before
const [platform, setPlatform] = useState<Platform | null>(null);
const [os, setOs] = useState<string | null>(null);

// After
const [target, setTarget] = useState<string | null>(null);
```

**Derived target options:**

```typescript
const presentTargets = useMemo(
  () => [...new Set(scripts.map((s) => s.platform))].sort(),
  [scripts]
);
```

`presentTargets` is derived at component render time from the `scripts` prop. No hardcoded target list. Only targets with at least one script appear.

**Filter logic:**

```typescript
const filtered = target ? scripts.filter((s) => s.platform === target) : scripts;
```

**Display labels:** The `platform` value stored in the data is a machine identifier like `debian-13-x64`. The UI must render a human-readable label. Implement a pure `formatTarget(target: string): string` helper that converts the identifier to a display label:

- Split on `-`
- Capitalize each word
- Join with spaces
- Examples: `"debian-13-x64"` → `"Debian 13 X64"`, `"macos-tahoe-arm64"` → `"Macos Tahoe Arm64"`

This helper lives in `lib/formatTarget.ts` and is used only in `ScriptsBrowser.tsx` for rendering filter option labels and the selected target label on script cards.

**Toggle behavior:** Clicking the active target deselects it (sets `target` to `null`), restoring the unfiltered list. Clicking a different target switches to that target.

### 5. `app/scripts/[...slug]/page.tsx` (or `app/scripts/[id]/page.tsx`)

Update the metadata display section. Remove the separate platform, OS, and arch tag rendering. Replace with a single target tag showing the human-readable label:

```tsx
<span className={styles.targetTag}>{formatTarget(script.platform)}</span>
```

The run command section and copy button are already present and remain unchanged in behavior. Verify the run command is rendered from `script.runCommand` (which `loadScripts` now builds from `buildRunCommand(id)`).

### 6. `app/page.tsx` (Homepage)

Replace the current stub (`<h1>Scriptor</h1>` + `<Button>Get Started</Button>`) with a full hero section.

**Required content elements:**
- Heading: `"Scriptor"` (existing `<h1>`)
- Description: `"A curated library of setup scripts for configuring machines. Browse scripts by target, read what each one does, and run it with a single command."`
- Browse CTA: a prominent link/button navigating to `/scripts`. Use Next.js `<Link>` component.
- Must NOT reference or promote a CLI/TUI install command (AC-006).

**Styling:** Co-located `app/page.module.css`. Use CSS custom property tokens (`var(--color-accent)`, etc.) for all colors and spacing. No hardcoded values.

### 7. `app/globals.css`

Add the missing design token definitions. These are referenced in existing component CSS but currently undefined:

```css
:root {
  --gap-xs: 0.25rem;
  --gap-sm: 0.5rem;
  --gap-md: 1rem;
  --gap-lg: 2rem;
  --font-mono: var(--font-ibmplex), "IBM Plex Mono", monospace;
}
```

These values are implementation choices; exact sizes may be adjusted during development to match Variant1.pen.

### 8. Script Frontmatter Migration (3 existing scripts)

Each existing script `.md` file currently declares separate `platform`, `os`, and optionally `arch` fields in its YAML frontmatter. Update each file to use the single combined `platform` field.

Example transformation:
```yaml
# Before
platform: linux
os: ubuntu-24.04
arch: x64

# After
platform: ubuntu-24.04-x64
```

The exact combined target string for each script must be consistent with the directory rename in the next section.

### 9. Script Directory Migration (3 existing scripts)

Rename each script directory from the old two-level structure to the new combined target name.

Example: `scripts/linux/ubuntu-24.04/` → `scripts/linux/ubuntu-24.04-x64/`

The script `id` embedded in the run command is derived from the file path (`scripts/<os-family>/<target>/<name>.sh`), so the directory name and the `platform` frontmatter field must be consistent.

**Known trade-off:** Renaming directories changes script `id` values, which invalidates any previously bookmarked or shared URLs to script detail pages. This is accepted as a one-time migration cost for this epic.

## Architecture — New Modules

### `lib/formatTarget.ts`

Pure helper — no side effects, no I/O.

```typescript
export function formatTarget(target: string): string {
  return target
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
```

Used in: `ScriptsBrowser.tsx` (filter labels), `app/scripts/[...slug]/page.tsx` (target tag).

### Homepage Hero Component (optional)

If the hero section in `app/page.tsx` becomes complex enough to warrant extraction, create `components/Hero.tsx` + `components/Hero.module.css`. Otherwise, implement directly as page-level JSX + `app/page.module.css`. This decision is deferred to implementation — keep it simple.

## API Contracts

### `Script` interface (after change)

```typescript
// 20_Applications/scriptor-web/lib/types.ts
export interface Script {
  id: string;
  title: string;
  platform: string;
  body: string;
  source: string;
  runCommand: string;
}
```

### `loadScripts` function signature (unchanged)

```typescript
// 20_Applications/scriptor-web/lib/loadScripts.ts
export async function loadScripts(deps?: Partial<LoadScriptsDeps>): Promise<Script[]>
```

The signature does not change. Only the internal implementation changes (Bun API, simplified parsing).

### `buildRunCommand` (simplified)

```typescript
function buildRunCommand(id: string): string {
  return `curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/${id} | bash`;
}
```

This function is internal to `loadScripts.ts` (not exported). No callers outside that module.

### `formatTarget` (new export)

```typescript
// 20_Applications/scriptor-web/lib/formatTarget.ts
export function formatTarget(target: string): string
```

### `presentTargets` derivation (in ScriptsBrowser)

```typescript
const presentTargets = useMemo(
  () => [...new Set(scripts.map((s) => s.platform))].sort(),
  [scripts]
);
```

## Data Models

### Script frontmatter schema (after migration)

```yaml
---
platform: debian-13-x64   # combined OS+version+arch target (required)
title: Install curl        # display name (required)
---
Body markdown content here.
```

Fields:
- `platform` (string, required): combined target identifier. Format: `<os>-<version>-<arch>`, all lowercase, hyphens. Examples: `debian-13-x64`, `debian-13-arm64`, `ubuntu-24.04-x64`, `macos-tahoe-arm64`, `windows-11-x64`.
- `title` (string, required): display name shown in the script list and detail page.
- Body: all content below the closing `---` is the spec/description markdown. No additional frontmatter fields.

Scripts missing `platform` or `title` are skipped with `console.warn` at build time.

### Script directory structure

```
scripts/
  linux/
    debian-13-x64/
      install-curl.sh
      install-curl.sh.spec.md    # optional spec file
    ubuntu-24.04-x64/
      ...
  windows/
    windows-11-x64/
      ...
  mac/
    macos-tahoe-arm64/
      ...
```

The script `id` is the path relative to `scripts/` without the file extension: e.g., `linux/debian-13-x64/install-curl`.

## Testing Strategy

All tests use Vitest + @testing-library/react. Do not change the test runner.

### `lib/loadScripts.test.ts`

- Update all test fixtures to use the new `Script` shape: remove `os` and `arch` fields, replace with single `platform: string`.
- Update frontmatter fixture strings to use the new single `platform` field.
- Add a test case: script missing `platform` field is skipped (warns, returns empty array).
- Add a test case: `buildRunCommand` produces the correct URL given a known `id`.
- The injectable `LoadScriptsDeps` interface must be testable without real file I/O (no change to the pattern, just update field names).

### `lib/formatTarget.test.ts` (new)

- `"debian-13-x64"` → `"Debian 13 X64"`
- `"macos-tahoe-arm64"` → `"Macos Tahoe Arm64"`
- `"windows-11-x64"` → `"Windows 11 X64"`
- Single-word input: `"linux"` → `"Linux"`

### `components/ScriptsBrowser.test.tsx`

- Update all fixtures to use the new `Script` shape.
- Remove tests for platform → OS two-tier filter behavior.
- Add tests:
  - Renders one filter button per distinct `platform` value across scripts.
  - Clicking a target filter shows only scripts for that target.
  - Clicking the active target again shows all scripts (deselect).
  - No filter selected → all scripts shown.

### `app/scripts/[...slug]/page.test.tsx` (or equivalent detail page test)

- Update `Script` fixtures: remove `os`/`arch`, add `platform: string`.
- Assert the target tag renders `formatTarget(script.platform)` (human-readable label).
- Assert the run command is displayed.

### `app/page.test.tsx`

- Assert the hero section renders a description paragraph (not empty).
- Assert a link to `/scripts` is present in the hero section.
- Assert no text referencing "install" or "CLI" appears in the hero (AC-006 guard).

## Error Handling

`loadScripts` must continue to skip invalid scripts rather than throw. Specifically:

- Script missing `platform` frontmatter field → skip, emit `console.warn(\`Skipping script ${id}: missing required field 'platform'\`)`.
- Script missing `title` frontmatter field → skip, emit `console.warn(\`Skipping script ${id}: missing required field 'title'\`)`.
- File read error for a single script → skip that script, emit `console.warn`. Do not throw.
- All valid scripts continue to be returned even if some are skipped.

This is existing behavior; the change is only to update the field names in the warning messages.

## Constraints and Decisions

### Locked decisions

- **CSS Modules only** for all custom components. No Tailwind utility classes in JSX.
- **Design tokens** via CSS custom properties (`var(--color-accent)`, etc.) in all CSS Modules. No hardcoded colors, spacing, or font sizes.
- **No new `npm`/`bun add` dependencies.** All required libraries (`lucide-react`, `react-markdown`, etc.) are already installed.
- **Vitest remains the test runner.** Do not migrate to `bun:test` — the existing `vitest.config.ts` setup is correct for the web workspace.
- **`Bun.file(path).text()` for file I/O** in `loadScripts.ts` (fixes existing violation of TypeScript.md rules).
- **`lib/platforms.ts` is deleted** in this epic. It will not be needed going forward.
- **URL breakage is accepted.** Renaming script directories changes the `id` and therefore the URL of each existing script's detail page. This is a known one-time migration cost.
- **Single target selection only.** Multi-select is explicitly out of scope (per Functional.md).
- **Windows scripts** use `curl ... | bash` format unless the script is `.ps1`, in which case the run command format must be updated (e.g., `iwr ... | iex`). Current scripts are all `.sh`; handle `.ps1` if any are migrated but do not block this epic on it.

### Open decisions

None — all decisions resolved.

## File Change Summary

| File | Action |
|---|---|
| `lib/types.ts` | Modify — simplify `Script` interface, remove `Platform`/`Arch` types |
| `lib/loadScripts.ts` | Modify — new parsing, Bun API, simplified `buildRunCommand` |
| `lib/platforms.ts` | Delete |
| `lib/formatTarget.ts` | Create |
| `lib/formatTarget.test.ts` | Create |
| `components/ScriptsBrowser.tsx` | Modify — single-tier filter, `formatTarget` labels |
| `components/ScriptsBrowser.test.tsx` | Modify — update fixtures and filter tests |
| `lib/loadScripts.test.ts` | Modify — update fixtures, remove `os`/`arch` |
| `app/page.tsx` | Modify — add hero section |
| `app/page.module.css` | Modify (or create if missing) — hero styles |
| `app/page.test.tsx` | Modify — assert hero content |
| `app/scripts/[...slug]/page.tsx` | Modify — single target tag, `formatTarget` |
| `app/scripts/[...slug]/page.test.tsx` | Modify — update fixtures |
| `app/globals.css` | Modify — add missing gap and font-mono tokens |
| `scripts/linux/<old-dir>/` (×3) | Rename directories |
| `scripts/linux/<name>.sh.spec.md` (×3) | Update frontmatter |

