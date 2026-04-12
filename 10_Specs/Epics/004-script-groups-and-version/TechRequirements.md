---
status: Ready
created: 2026-04-11
---

# Script Groups and Version Display — Technical Requirements

## Tech Stack

| Category | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Bun | 1.3.11 | Primary runtime; Node compat required for Vitest |
| Language | TypeScript | ^6.x | Strict mode, ESNext modules |
| Framework | Next.js | ^16.0.0 | App Router, `output: "export"`, `trailingSlash: true` |
| Testing (unit) | Vitest | ^3.0.0 | Runs under Node; Bun/Node compat required in all loaders |
| Testing (E2E) | Playwright | — | Chromium only; requires build first |
| Linting / Formatting | Biome | 2.4.8 | Tab indent, double quotes, organizeImports on |

## Architecture

_How the new code is structured and where it lives in the project._

### New Modules

| Module | Location | Responsibility |
|---|---|---|
| `loadGroups.ts` | `20_Applications/scriptor-web/lib/` | Reads `scripts/groups.json`; returns parsed group metadata; follows dependency-injected loader pattern |
| `loadGroups.test.ts` | `20_Applications/scriptor-web/lib/` | Unit tests for `loadGroups.ts` |
| `loadVersion.ts` | `20_Applications/scriptor-web/lib/` | Reads `version` from `20_Applications/scriptor-web/package.json` at build time; returns `string \| undefined` |
| `loadVersion.test.ts` | `20_Applications/scriptor-web/lib/` | Unit tests for `loadVersion.ts` |
| `GroupRow.tsx` + `GroupRow.module.css` | `20_Applications/scriptor-web/components/` | `"use client"` component rendering a group entry on browse pages — badge/icon, expand toggle, nested member list |
| `GroupRow.test.tsx` | `20_Applications/scriptor-web/components/` | Unit tests for `GroupRow` |
| `app/groups/[...slug]/page.tsx` | `20_Applications/scriptor-web/app/groups/[...slug]/` | Group detail page; mirrors `app/scripts/[...slug]/page.tsx` layout |
| `app/groups/[...slug]/page.test.tsx` | `20_Applications/scriptor-web/app/groups/[...slug]/` | Unit tests for group detail page |
| `app/groups/[...slug]/detail-page.module.css` | `20_Applications/scriptor-web/app/groups/[...slug]/` | CSS module for group detail page (reuse token-based styles from script detail page) |
| _(no standalone generator)_ | — | Runner scripts are generated as a side effect of `loadGroups()` at build time; no separate entry-point script is needed |

### Modified Modules

| Module | Location | Changes |
|---|---|---|
| `types.ts` | `20_Applications/scriptor-web/lib/` | Add `group?: string` and `groupOrder?: number` to `Script` interface |
| `loadScripts.ts` | `20_Applications/scriptor-web/lib/` | Extend `SpecFrontmatter` with `group?: unknown` and `group_order?: unknown`; parse and map to `Script.group` / `Script.groupOrder` |
| `loadScripts.test.ts` | `20_Applications/scriptor-web/lib/` | Add test cases for scripts with `group` / `group_order` frontmatter |
| `Footer.tsx` | `20_Applications/scriptor-web/components/` | Accept `version?: string` prop; render version string in footer when present |
| `Footer.module.css` | `20_Applications/scriptor-web/components/` | Add style for version span using `var(--scriptor-muted)` token |
| `Footer.test.tsx` (new) | `20_Applications/scriptor-web/components/` | Add unit tests for Footer (version present, version absent) |
| `app/layout.tsx` | `20_Applications/scriptor-web/app/` | Call `loadVersion()` and pass result as `version` prop to `<Footer />` |
| `app/scripts/linux/page.tsx` | `20_Applications/scriptor-web/app/scripts/linux/` | Call `loadGroups()`; render `<GroupRow>` entries first, then `<ScriptRow>` entries for ungrouped scripts |
| `app/scripts/windows/page.tsx` | `20_Applications/scriptor-web/app/scripts/windows/` | Same as linux page |
| `app/scripts/mac/page.tsx` | `20_Applications/scriptor-web/app/scripts/mac/` | Same as linux page |
| `package.json` (root) | `/` | No changes required for runner generation — runners are produced by `loadGroups()` during `next build` |

## API Contracts

_Interfaces, types, and function signatures that define module boundaries._

```ts
// types.ts additions
interface Script {
  // ... existing fields ...
  group?: string;       // group ID from frontmatter
  groupOrder?: number;  // integer sort position within group
}

// groups.json schema (array of GroupEntry)
interface GroupEntry {
  id: string;          // unique group ID, e.g. "linux-dev-setup"
  name: string;        // human-readable display name
  description: string; // one-line description shown on browse + detail pages
}

// loadGroups.ts
interface LoadGroupsDeps {
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  groupsFilePath: string;
  scriptsRootPath: string;    // repo-root `scripts/` directory; used when writing runner files
}
function loadGroups(deps?: Partial<LoadGroupsDeps>): Promise<GroupEntry[]>
// Side effect: writes runner scripts to scripts/<platform>/<group-id>/run-all.{sh,ps1}
// Returns [] and console.warn on missing or malformed groups.json

// loadVersion.ts
function loadVersion(): Promise<string | undefined>
// Returns the version string from package.json, or undefined if unavailable — never throws

// GroupRow.tsx props
interface GroupRowProps {
  group: GroupEntry;
  members: Script[];   // ordered member scripts; passed from server page as props
}

// Footer.tsx props (updated)
interface FooterProps {
  version?: string;
}
```

## Data Models

_New or modified data structures._

**`scripts/groups.json`** — new file, JSON array:
```json
[
  {
    "id": "linux-dev-setup",
    "name": "Linux Dev Setup",
    "description": "Installs Bun, Go, .NET, and GitHub CLI on a fresh Linux machine."
  }
]
```

**Script frontmatter extension** (`.sh` and `.ps1` files):
```yaml
group: linux-dev-setup   # optional; must match an id in groups.json
group_order: 2           # optional integer; omit to sort after explicit-order members
```

**Generated runner script** (`scripts/<platform>/<group-name>/run-all.sh`):
- Hard-codes ordered member script raw GitHub URLs
- Prints `[N/M] <title>...` progress before each script
- Fails fast on first error

**Platform of a group** — derived at build time by inspecting member script `platform` fields; not declared in `groups.json`.

## Testing Strategy

### Unit Tests

- **Location:** Co-located with source (e.g., `lib/loadGroups.test.ts`, `components/GroupRow.test.tsx`)
- **Framework:** Vitest with `@testing-library/react` for component tests
- **Naming:** `<module>.test.ts` / `<component>.test.tsx`
- **Coverage targets:**
  - `loadGroups`: empty array on missing file; parses valid JSON; warns and returns `[]` on malformed JSON; calls `writeFile` with correct runner content for a valid group; skips runner generation and warns when group has no valid members; throws with group ID and conflicting platforms when a group's members span multiple platforms
  - `loadVersion`: returns version string; returns `undefined` on missing version field; returns `undefined` on missing file
  - `loadScripts` additions: scripts with `group`/`group_order` parse correctly; invalid `group` type warns and is skipped; invalid `group_order` type defaults to `undefined`
  - `GroupRow`: renders group name and description; expand toggle shows/hides members; member links have correct hrefs
  - `Footer`: renders version when provided; omits version when not provided
  - Group detail page: renders group title, description, platform, one-liner, member list

### Integration Tests

- **Location:** `20_Applications/scriptor-web-test/tests/`
- **Framework:** Playwright (Chromium)
- **What to test:**
  - Browse page shows group entries before ungrouped scripts (new `browse.spec.ts` additions)
  - Group entry expand/collapse works
  - Group entry click navigates to group detail page
  - Group detail page shows title, one-liner, member list with links (new `group-detail.spec.ts`)
  - Footer shows version string on every page (new assertions in `smoke.spec.ts` or `browse.spec.ts`)
  - E2E tests use `scripts-fixture/` with manually authored fixture groups and fixture `run-all.sh` runner

## Error Handling

- **`loadGroups`**: On file-not-found or JSON parse error → `console.warn(...)` and return `[]`. Never throws. Follows `loadPlatforms.ts` pattern.
- **`loadVersion`**: On missing file, missing `version` field, or parse error → return `undefined`. Never throws. `Footer` renders no version element when `version` is `undefined` (AC-017).
- **`loadScripts` group fields**: If `group` is present but not a string → `console.warn` and leave `group` undefined on the Script. If `group_order` is present but not a number → leave `groupOrder` undefined (sort last).
- **Platform constraint violation**: If a group's member scripts span multiple platforms → `loadGroups()` throws an `Error` that names the group ID and the conflicting platforms. This is a hard build failure: `next build` exits non-zero and no output is produced.
- **Group ID with no manifest entry**: Script's `group` field references an ID not in `groups.json` → the script is treated as ungrouped; `console.warn` naming the unknown group ID.
- **Runner script generation errors**: If `loadGroups()` encounters a file I/O error while writing a runner script, it throws with a descriptive message — this propagates out of the page component and fails the `next build`, blocking the build non-zero. Validation failures (e.g. no valid members for a group) log `console.warn` and skip runner generation for that group rather than failing the build.

## Performance Requirements

- No runtime performance targets beyond what Next.js static export already guarantees.
- Runner generation (side effect inside `loadGroups()`) runs once per `next build`; no performance constraint beyond completing within the normal build window.
- All data loading (`loadGroups`, `loadScripts`, `loadVersion`) happens at build time only — no client-side fetch.

## Constraints & Decisions

- **No new dependencies** — all required packages (`js-yaml`, `react-markdown`, `class-variance-authority`, `vitest`, Playwright) are already installed.
- **URL routing**: Group detail pages live at `/groups/[...slug]/` (new `app/groups/[...slug]/page.tsx` route). This avoids any conflict with the existing `app/scripts/[...slug]/` catch-all. Group URLs take the form `/groups/<platform>/<group-name>/`.
- **Runner generation**: `loadGroups()` generates runner scripts as a side effect — after parsing `groups.json` it writes `scripts/<platform>/<group-id>/run-all.sh` (or `.ps1`) to disk before returning the group metadata. Generation therefore happens automatically as part of `next build` (since page components call `loadGroups()`). Generated runner files are committed to the repository so they are accessible at raw GitHub URLs. Developers must run a local build (or `bun run generate-runners` if a convenience alias is added) and commit the generated files before merging. CI will also produce them during build, but relies on developers having committed them in advance — the build does not auto-commit back to the branch.
- **Browse page architecture**: The named platform pages (`linux/page.tsx`, `windows/page.tsx`, `mac/page.tsx`) are modified directly to add group display. `ScriptsBrowser.tsx` is not refactored as part of this epic (it remains as-is).
- **`GroupRow` expand behavior**: `GroupRow.tsx` is a `"use client"` component using React `useState` for expand/collapse. `<details>`/`<summary>` is not used — the component needs finer control over animation/styling and needs to pass member data as props from the server page.
- **Footer version**: `layout.tsx` calls `loadVersion()` and passes the result as `version?: string` prop to `<Footer />`. `Footer.tsx` remains a simple (non-async) server component.
- **`groups.json` schema**: Array of objects with `id`, `name`, `description` — no additional fields. Platform is inferred from member scripts at build time, not declared in the manifest. Groups are displayed alphabetically by `name` on browse pages (no explicit `order` field).
- **Platform constraint validation**: `loadGroups()` throws a hard `Error` naming the group ID and conflicting platforms. The build fails non-zero immediately. Authors must fix the group membership before the build can succeed.
- **Bun/Node compat**: All new file loaders (`loadGroups`, `loadVersion`) must include the `typeof Bun !== "undefined"` compat branch for Vitest compatibility.
- **CSS Modules + design tokens**: Every new component and page has a co-located `.module.css`. All colors/spacing use `var(--scriptor-*)` tokens from `globals.css`. No hardcoded values, no Tailwind utility classes in JSX.
- **`"use client"` boundary**: `GroupRow` is the only new client component. Group detail page and browse pages remain server components; `GroupRow` is composed in as a leaf node.
- **`generateStaticParams`** for the group detail page calls both `loadGroups()` and `loadScripts()` to resolve which groups have valid members. Only groups with at least one valid member are included in static params.
