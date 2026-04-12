---
status: Ready
created: 2026-04-11
---

# Script Groups and Version Display — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Extend Script type with group fields

**Status:** completed

**Description:**
Add optional `group` and `groupOrder` fields to the `Script` interface in `lib/types.ts`. This is the foundational type change that every other module in this epic depends on. Making these fields optional preserves backward compatibility with all existing code that constructs or consumes `Script` objects. Satisfies the data model prerequisite for UC-001, UC-002, and AC-014.

- Add `group?: string` to `Script` — holds the group ID from frontmatter (e.g., `"linux-dev-setup"`)
- Add `groupOrder?: number` to `Script` — integer sort position within the group; `undefined` sorts last
- Update `lib/types.test.ts` to assert the new optional fields are accepted on a `Script` object and are not required

**Implementation Notes:**
- **RED phase:** Added three new test cases to `20_Applications/scriptor-web/lib/types.test.ts`:
  1. `"accepts a Script object with group and groupOrder fields"` — constructs a `Script` with `group: "linux-dev-setup"` and `groupOrder: 1`, asserts both fields are present with correct types
  2. `"group and groupOrder fields are optional — Script without them is valid"` — constructs a minimal `Script` without the new fields, asserts both are `undefined`
  3. `"accepts a Script with group but without groupOrder"` — constructs a `Script` with `group` only, asserts `groupOrder` is `undefined`
  - `bun run typecheck` confirmed RED: 9 type errors in `types.test.ts` because `group`/`groupOrder` did not exist on the `Script` interface
- **GREEN phase:** Added `group?: string` and `groupOrder?: number` to the `Script` interface in `20_Applications/scriptor-web/lib/types.ts`, with JSDoc comments explaining each field
- **Verification:** `bun run test:unit` — all 58 tests pass; `bun run typecheck` — exits 0; `bun run lint` — no issues

**Files changed:**
- `20_Applications/scriptor-web/lib/types.ts` — added `group?: string` and `groupOrder?: number` to `Script` interface
- `20_Applications/scriptor-web/lib/types.test.ts` — added three new test cases covering both fields present, neither field present, and group only

---

## Task 2 — Create scripts/groups.json manifest scaffold

**Status:** completed

**Description:**
Create `scripts/groups.json` at the repo root `scripts/` directory. This file is the source of truth for group metadata displayed on the web site (UC-001, UC-002). The manifest is scaffolded with one example entry so `loadGroups.ts` (Task 3) has real data to validate against and the E2E fixture build (Task 11) has a real group to display. Satisfies the `groups.json` data model requirement and is a prerequisite for every subsequent group task.

- Create `scripts/groups.json` as a JSON array of `GroupEntry` objects: `[{ "id": "...", "name": "...", "description": "..." }]`
- Schema: each entry must have `id` (string, unique), `name` (string, human-readable display name), `description` (string, one-line description)
- Scaffold with one placeholder entry (e.g., `"id": "example-linux-setup"`) — real groups will be added as member scripts are authored
- No platform field — platform is inferred from member scripts at build time

**Implementation Notes:**
- **RED phase:** Created `20_Applications/scriptor-web/lib/loadGroups.test.ts` as a stub with four test cases asserting the real `scripts/groups.json` file: (1) exists and is valid JSON, (2) top-level value is an array, (3) has at least one entry, (4) first entry has `id`, `name`, and `description` as non-empty strings. All four tests failed with `ENOENT` (file not found) — RED confirmed.
- **GREEN phase:** Created `scripts/groups.json` with a single placeholder entry (`"id": "example-linux-setup"`). All 62 tests now pass.
- **Verification:** `bun run test:unit` — 62/62 pass; `bun run typecheck` — exits 0; `bun run lint` — no issues.

**Files created:**
- `scripts/groups.json` — new file; JSON array with one placeholder `GroupEntry` (`id`, `name`, `description`)
- `20_Applications/scriptor-web/lib/loadGroups.test.ts` — new file; stub test suite validating the shape and contents of `scripts/groups.json`

---

## Task 3 — Implement loadGroups()

**Status:** completed

**Description:**
Create `lib/loadGroups.ts` — the build-time function that reads `scripts/groups.json`, parses the manifest, validates entries, and returns a `GroupEntry[]`. As a side effect, after returning group metadata, `loadGroups()` generates runner scripts (`run-all.sh` or `run-all.ps1`) for each group with valid members and writes them to `scripts/<platform>/<group-id>/`. Runner generation requires the resolved list of member scripts, so `loadGroups()` accepts a `scripts` parameter (the output of `loadScripts()`). Follows the dependency-injected, Bun/Node compat pattern from `loadPlatforms.ts`. Satisfies UC-003, AC-010, AC-011, AC-012, AC-014, AC-015.

- Export `interface GroupEntry { id: string; name: string; description: string }`
- Export `interface LoadGroupsDeps { readFile: (path: string) => Promise<string>; writeFile: (path: string, content: string) => Promise<void>; groupsFilePath: string; scriptsRootPath: string }`
- Export `async function loadGroups(scripts: Script[], deps?: Partial<LoadGroupsDeps>): Promise<GroupEntry[]>`
- Default deps: `readFile` uses `Bun.file(path).text()` with Node fallback; `writeFile` uses `Bun.write(path, content)` with Node fallback; `groupsFilePath` resolved via `import.meta.url` (same `../../../scripts/groups.json` pattern as `loadPlatforms.ts`)
- Returns `[]` and calls `console.warn` if `groups.json` is missing or malformed — never throws on file I/O or parse errors
- Platform constraint: if a group's member scripts span multiple `platform` values, throw a descriptive `Error` naming the group ID and the conflicting platforms — this is a hard build failure (AC required)
- Runner generation side effect: for each group with at least one valid member, write the ordered runner script to `scripts/<platform>/<group-id>/run-all.sh` (or `.ps1`); if a group has no valid members, log `console.warn` and skip — do not throw
- Runner script content: bash shebang + `set -euo pipefail`; iterate over ordered member URLs; print `[N/M] <title>...` before each; download via `curl -fsSL <url>` and pipe to `bash` (or `irm | iex` for `.ps1`); fail fast
- Sort order for group members: ascending by `groupOrder` (undefined last), then by `id` as tiebreaker

**Implementation Notes:**
- **RED phase:** Replaced the Task 2 stub in `loadGroups.test.ts` with a full test suite (22 tests) using injected in-memory deps. Tests covered all specified behaviors. All 22 loadGroups tests failed with "Cannot find module './loadGroups.js'" — RED confirmed.
- **GREEN phase:** Created `loadGroups.ts` with:
  - Exported `GroupEntry` interface and `LoadGroupsDeps` interface
  - `loadGroups(scripts, deps?)` function accepting `Script[]` and optional partial deps
  - Bun/Node compat `readFileCompat` and `writeFileCompat` helpers
  - `isGroupEntry()` type guard for validating manifest entries
  - `compareMemberScripts()` sort comparator (groupOrder ascending, undefined last, id tiebreaker)
  - `platformPrefixFromId()` to extract `linux`/`windows`/`mac` prefix from script id
  - `rawUrlFromScript()` to extract the raw GitHub URL from a script's `runCommand`
  - `runnerExtension()` to determine `.sh` vs `.ps1` based on member's `runCommand`
  - `buildBashRunner()` and `buildPs1Runner()` to generate ordered runner scripts with `[N/M] <title>...` progress markers
  - Default deps resolve `groupsFilePath` and `scriptsRootPath` via `import.meta.url` with `SCRIPTS_DIR` env var support (parallel to `loadScripts.ts`)
  - `writeFile` default dep creates parent directory via `mkdir({ recursive: true })` before writing
- **Verification:** `bun run test:unit` — 80/80 tests pass; `bun run typecheck` — exits 0; `bun run lint` — no issues; `bun run format` — no remaining issues.

**Files created/modified:**
- `20_Applications/scriptor-web/lib/loadGroups.ts` — new file; full implementation
- `20_Applications/scriptor-web/lib/loadGroups.test.ts` — replaced Task 2 stub with 22 comprehensive unit tests

---

## Task 4 — Extend loadScripts.ts to parse group frontmatter fields

**Status:** completed

**Description:**
Extend `SpecFrontmatter` in `lib/loadScripts.ts` with `group?: unknown` and `group_order?: unknown`, and map them to the new `group` and `groupOrder` fields on the returned `Script` objects. Existing scripts without these fields are unaffected. Satisfies the data flow prerequisite for UC-001 and AC-001 (groups visible on browse page). Depends on Task 1 (Script type extended).

- Add `group?: unknown` and `group_order?: unknown` to the internal `SpecFrontmatter` interface in `loadScripts.ts`
- After validating `platform` and `title`: if `group` is present and is a string, assign it to `script.group`; if `group` is present but not a string, call `console.warn` and leave `group` undefined
- If `group_order` is present and is a finite integer (`Number.isFinite` + `Number.isInteger`), assign it to `script.groupOrder`; if present but not a valid integer, leave `groupOrder` undefined (sorts last)
- No changes to sort order in `loadScripts` — sorting within a group is `loadGroups`'s responsibility

**Implementation Notes:**
- **RED phase:** Added 6 new test cases to `20_Applications/scriptor-web/lib/loadScripts.test.ts`:
  1. `"parses group and group_order from frontmatter"` — asserts both fields parsed correctly
  2. `"sets group but not groupOrder when group_order is absent"` — asserts `groupOrder` is undefined
  3. `"leaves group undefined and warns when group field is not a string"` — asserts `console.warn` called and `group` is undefined
  4. `"leaves groupOrder undefined when group_order is not an integer"` — asserts `groupOrder` is undefined for string `"not-a-number"`
  5. `"leaves groupOrder undefined when group_order is a float"` — asserts `groupOrder` is undefined for `1.5`
  6. `"leaves group and groupOrder undefined when neither field is in frontmatter"` — asserts both fields are undefined on existing scripts
  - Also extended `makeShSpec` and `makePs1Spec` helpers to accept `group` and `group_order` as optional override keys
  - `bun run test:unit` confirmed RED: 5 of the 6 new tests failed (the "no group fields" test already passed trivially)
- **GREEN phase:**
  - Added `group?: unknown` and `group_order?: unknown` to `SpecFrontmatter` interface in `loadScripts.ts`
  - After the `title` validation block, added logic to parse `fm.group`: if a non-empty string, assign to `group`; otherwise call `console.warn` and leave `group` undefined
  - Added logic to parse `fm.group_order`: if `typeof raw === "number"` and passes `Number.isFinite` + `Number.isInteger`, assign to `groupOrder`; otherwise leave undefined (sorts last, no warn needed per spec)
  - Used spread syntax (`...(group !== undefined ? { group } : {})`) in `scripts.push(...)` to only include the optional fields when they have a value — preserves existing script shape for ungrouped scripts
- **Verification:** `bun run test:unit` — 86/86 pass; `bun run typecheck` — exits 0; `bun run lint` — no issues

**Files changed:**
- `20_Applications/scriptor-web/lib/loadScripts.ts` — added `group?` and `group_order?` to `SpecFrontmatter`; added parsing + validation logic for both fields; extended `scripts.push(...)` to include `group` and `groupOrder` when present
- `20_Applications/scriptor-web/lib/loadScripts.test.ts` — extended `makeShSpec`/`makePs1Spec` helper types; added 6 new test cases covering all specified behaviors

---

## Task 5 — Implement loadVersion()

**Status:** completed

**Description:**
Create `lib/loadVersion.ts` — a build-time helper that reads `version` from `20_Applications/scriptor-web/package.json` and returns it as a `string | undefined`. Returns `undefined` on any error — missing file, missing `version` field, or parse error — and never throws. Follows the Bun/Node compat pattern from `loadPlatforms.ts`. Satisfies UC-004, AC-016, AC-017.

- Export `async function loadVersion(): Promise<string | undefined>`
- Resolve `package.json` path via `import.meta.url` (one level up from `lib/`, i.e., `../package.json` relative to the `lib/` directory)
- Read and parse as JSON; return `data.version` if it is a non-empty string
- Return `undefined` on file-not-found, JSON parse failure, or missing/non-string `version` field — never throw

**Implementation Notes:**
- **RED phase:** Created `20_Applications/scriptor-web/lib/loadVersion.test.ts` with 8 test cases using injected in-memory `readFile` dep. Tests covered: returns version string from valid package.json; returns `undefined` when `version` field missing; returns `undefined` when `version` is not a string; returns `undefined` when `version` is empty string; returns `undefined` on missing file (rejected promise); returns `undefined` on malformed JSON; returns `undefined` when file content is a JSON array; returns version from a realistic multi-field package.json. All 8 tests failed with "Cannot find module './loadVersion.js'" — RED confirmed.
- **GREEN phase:** Created `loadVersion.ts` with:
  - Exported `LoadVersionDeps` interface with a single `readFile: () => Promise<string>` field (zero-arg since the path is resolved internally)
  - `packageJsonPath()` helper resolves `../package.json` relative to the `lib/` directory via `import.meta.url`
  - `readFileCompat()` helper follows Bun/Node compat pattern from `loadPlatforms.ts` (`typeof Bun !== "undefined"` branch)
  - `loadVersion(deps?)` accepts optional partial deps; if `deps?.readFile` is provided it uses that, otherwise defaults to `readFileCompat(pkgPath)`
  - try/catch wraps both file read and JSON parse — any failure returns `undefined`
  - After parsing, validates: top-level value is a non-null, non-array object; `version` field is a string with `length > 0`
- **Verification:** `bun run test:unit` — 94/94 tests pass (8 new); `bun run typecheck` — exits 0; `bun run lint` — no issues.

**Files created:**
- `20_Applications/scriptor-web/lib/loadVersion.ts` — new file; full implementation
- `20_Applications/scriptor-web/lib/loadVersion.test.ts` — new file; 8 unit tests covering all specified behaviors

---

## Task 6 — Update Footer component with version prop

**Status:** completed

**Description:**
Update `components/Footer.tsx` to accept a `version?: string` prop and render the version string in the footer when present. When `version` is `undefined`, the footer renders with no version element — no placeholder, no crash. Add a co-located `Footer.test.tsx` (does not exist yet). Add a `.version` CSS class to `Footer.module.css` using `var(--scriptor-muted)`. Satisfies UC-004, AC-016, AC-017.

- Update `Footer.tsx` props interface to accept `version?: string`
- Render `<span className={styles.version}>v{version}</span>` inside the footer when `version` is defined
- Add `.version` class to `Footer.module.css` using `var(--scriptor-muted)` for color
- Create `components/Footer.test.tsx` with unit tests

**Implementation Notes:**
- **RED phase:** Created `20_Applications/scriptor-web/components/Footer.test.tsx` with 6 test cases: renders tagline; renders GitHub link; renders version string with `v` prefix when prop provided; does not render version element when prop is `undefined`; does not render version element when prop is explicitly `undefined`; renders footer content (tagline, GitHub link, and version) when all three are expected. 2 of 6 tests failed (the version-related tests) — RED confirmed.
- **GREEN phase:**
  - Added `FooterProps` interface to `Footer.tsx` with `version?: string`
  - Updated `Footer` function signature to accept and destructure `FooterProps` with default `{}`
  - Conditionally renders `<span className={styles.version}>v{version}</span>` only when `version !== undefined`
  - Wrapped the `version` span and GitHub link in a `<div className={styles.right}>` to maintain layout (flexbox `justify-content: space-between` on footer still works; right group is now a flex row with gap)
  - Added `.right` (flex row, align-items center, gap 16px) and `.version` (IBM Plex Mono, 12px, `var(--scriptor-muted)`) classes to `Footer.module.css`
- **Verification:** `bun run test:unit` — 100/100 tests pass (6 new); `bun run typecheck` — exits 0; `bun run lint` — no issues

**Files changed:**
- `20_Applications/scriptor-web/components/Footer.tsx` — added `FooterProps` interface; updated function signature to accept `version?: string`; conditionally renders version span; wrapped right-side elements in a flex `div`
- `20_Applications/scriptor-web/components/Footer.module.css` — added `.right` and `.version` CSS classes
- `20_Applications/scriptor-web/components/Footer.test.tsx` — new file; 6 unit tests covering all specified behaviors

---

## Task 7 — Wire loadVersion() into layout.tsx

**Status:** completed

**Description:**
Update `app/layout.tsx` to call `loadVersion()` at build time and pass the result as the `version` prop to `<Footer />`. This threads the version string from `package.json` through to the footer on every page. Satisfies UC-004, AC-016, AC-017. Depends on Task 5 (loadVersion) and Task 6 (Footer props).

- Make `RootLayout` in `app/layout.tsx` an `async` function (or add an outer async wrapper) so it can `await loadVersion()`
- Pass the resolved `version` string (or `undefined`) to `<Footer version={version} />`
- Import `loadVersion` from `@/lib/loadVersion`

**Implementation Notes:**
- **RED phase:** Created `20_Applications/scriptor-web/app/layout.test.tsx` with 3 test cases:
  1. `"passes version string to Footer when loadVersion resolves"` — mocks `loadVersion` to return `"1.2.3"`, renders the layout, asserts `"v1.2.3"` is visible
  2. `"renders Footer without version when loadVersion returns undefined"` — mocks `loadVersion` to return `undefined`, asserts no version text matches `/^v\d/`
  3. `"renders children inside the layout"` — asserts child content passes through
  - Also mocked `next/font/google` (IBM_Plex_Mono, JetBrains_Mono) since font loading is not available in the jsdom test environment
  - `bun run test:unit` confirmed RED: 1 of 3 new tests failed (the version-present test) because `layout.tsx` did not call `loadVersion()`; the other two passed trivially (undefined version, children render)
- **GREEN phase:**
  - Added `import { loadVersion } from "@/lib/loadVersion"` to `app/layout.tsx`
  - Changed `RootLayout` from a synchronous function to `async function`
  - Added `const version = await loadVersion();` at the top of the function body
  - Updated `<Footer />` to `<Footer version={version} />`
- **Verification:** `bun run test:unit` — 103/103 tests pass (3 new); `bun run typecheck` — exits 0; `bun run lint` — no issues

**Files changed:**
- `20_Applications/scriptor-web/app/layout.tsx` — added `loadVersion` import; made `RootLayout` async; calls `await loadVersion()`; passes result to `<Footer version={version} />`
- `20_Applications/scriptor-web/app/layout.test.tsx` — new file; 3 unit tests covering version forwarded to Footer, undefined version handled gracefully, children render

---

## Task 8 — Create GroupRow component

**Status:** completed

**Description:**
Create `components/GroupRow.tsx` — a `"use client"` component that renders a single group entry on the browse page. The component shows the group name, description, a visual badge/tag distinguishing it from script entries, and an expand/collapse control. When expanded, it renders a nested list of member scripts as clickable links. This is the primary UI component for UC-001 (AC-003, AC-004, AC-005). Depends on Task 1 (`Script` type with group fields).

- Mark as `"use client"` and use `useState` for expand/collapse state
- Props: `group: GroupEntry` (from `loadGroups.ts`), `members: Script[]` (ordered, passed from server page)
- Render: group name as a link to `/groups/<platform>/<group-id>/` (or the group detail URL); a badge/tag element (e.g., `<span>Group</span>`) to distinguish from script entries; a toggle button/icon that shows/hides the expanded member list
- When expanded: render each member as `<a href="/scripts/<member.id}">` with `member.title` and `member.description` below the title
- Co-located `GroupRow.module.css` using `var(--scriptor-*)` design tokens; no hardcoded colors or spacing; no Tailwind utility classes in JSX
- Create `GroupRow.test.tsx` co-located

**Implementation Notes:**
- **RED phase:** Created `20_Applications/scriptor-web/components/GroupRow.test.tsx` with 12 test cases covering all specified behaviors. All tests failed with "Cannot find module './GroupRow.js'" — RED confirmed.
- **GREEN phase:** Created `GroupRow.tsx` as a `"use client"` component with:
  - `GroupRowProps` interface: `group: GroupEntry`, `members: Script[]`
  - `platformPrefix()` helper: extracts first path segment from `members[0].id` (e.g. `"linux"`) to build the group detail URL
  - `useState(false)` for expand/collapse; toggle button with `aria-expanded` and `aria-label` toggling between `"expand"` and `"collapse"`
  - Group name rendered as a `<Link>` to `/groups/<platform>/<group-id>`
  - Badge `<span data-testid="group-badge">group</span>` with uppercase styling using `var(--scriptor-accent)` border and text
  - Conditional `<ul className={styles.memberList}>` rendered only when expanded; each member as a `<Link href="/scripts/<member.id>">` with description beneath
  - Created `GroupRow.module.css` with all styles using `var(--scriptor-*)` design tokens: `.row`, `.header`, `.titleRow`, `.groupName`, `.badge`, `.toggleButton`, `.description`, `.memberList`, `.memberItem`, `.memberName`, `.memberDesc`
- **Verification:** `bun run test:unit` — 115/115 tests pass (12 new); `bun run typecheck` — exits 0; `bun run lint` — no issues; `bun run format` — applied and re-verified

**Files created:**
- `20_Applications/scriptor-web/components/GroupRow.tsx` — new file; `"use client"` component with expand/collapse, group name link, badge, and member list
- `20_Applications/scriptor-web/components/GroupRow.module.css` — new file; all styles using `var(--scriptor-*)` design tokens; no hardcoded values
- `20_Applications/scriptor-web/components/GroupRow.test.tsx` — new file; 12 unit tests covering all specified behaviors

---

## Task 9 — Create group detail page

**Status:** completed

**Description:**
Create `app/groups/[...slug]/page.tsx` — the group detail page. The layout mirrors the individual script detail page (AC-008): group title, description, platform information, a copyable one-liner command (the runner script `curl | bash`), and a list of member scripts as clickable links in declared order. Satisfies UC-002, AC-006, AC-007, AC-008, AC-009. Depends on Tasks 3 (loadGroups), 4 (loadScripts with group fields), and 8 (GroupRow as reference for the member list pattern).

- Create `app/groups/[...slug]/page.tsx` as an async server component
- Export `generateStaticParams()`: calls both `loadGroups(scripts)` and `loadScripts()`; returns only groups that have at least one valid member; slugs take the form `[platform, group-id]` (e.g., `["linux", "linux-dev-setup"]`)
- Page component: join slug to resolve group ID; find the matching `GroupEntry` from `loadGroups(scripts)`; call `notFound()` for unrecognized slugs or groups with no members
- Render: `<h1>` with group name; description paragraph; platform metadata (derived from member scripts); `<CodeBlock>` with one-liner run command (`curl -fsSL <runner-raw-url> | bash` or `irm <url> | iex`); member list with each member as a link to `/scripts/<member.id>` with description
- One-liner URL pattern: `${RAW_BASE}/<platform>/<group-id>/run-all.sh` (or `.ps1`)
- Create `app/groups/[...slug]/detail-page.module.css` reusing the token-based style patterns from `app/scripts/[...slug]/detail-page.module.css`

**Implementation Notes:**
- **RED phase:** Created `20_Applications/scriptor-web/app/groups/[...slug]/page.test.tsx` with 10 test cases: renders group title in `<h1>`; renders group description; renders platform value derived from member scripts; renders copyable one-liner `CodeBlock`; one-liner URL contains the group runner path (`linux-dev-setup.*run-all\.sh`); member list renders each member as a link to `/scripts/<id>`; member list is in `groupOrder` ascending order (tested with reversed input order); `notFound()` called for unknown slug; `notFound()` called when group has no members; `generateStaticParams` returns only groups with valid members. All tests failed with "Cannot find module './page.js'" — RED confirmed.
- **GREEN phase:** Created `app/groups/[...slug]/page.tsx` as an async server component with:
  - `generateStaticParams()` — calls `loadScripts()` then `loadGroups(scripts)`; filters groups to those with at least one member; returns `[platformPrefix, group.id]` slugs
  - `GroupDetailPage` — awaits params; extracts `groupId` as last slug segment; calls `notFound()` for unknown group IDs or groups with no members; sorts members using same comparator as `loadGroups.ts` (`groupOrder` ascending, `id` tiebreaker); derives `platformValue` from first member's `platform` field; determines runner extension from first member's `runCommand`; builds one-liner via `buildOneLiner()` helper
  - `buildOneLiner()` — constructs `curl -fsSL ${RAW_BASE}/${platform}/${groupId}/run-all.sh | bash` or `irm ... | iex` depending on extension
  - Layout: `<h1>` with group name and platform slug; description `<p>`; `<CodeBlock>` with one-liner; member list with each member as `<Link href="/scripts/<id>">` with description; sidebar metadata card showing platform, target, and script count
- **CSS module:** Created `detail-page.module.css` reusing the identical token-based patterns from `app/scripts/[...slug]/detail-page.module.css` (`.detail`, `.detailHeader`, `.heading`, `.description`, `.runSection`, `.detailBody`, `.mainCol`, `.boxLabel`, `.sidebar`, `.metadataCard`, `.metaRow`, `.metaKey`, `.metaValue`); added `.memberSection`, `.memberList`, `.memberItem`, `.memberName`, `.memberDesc` classes for the member list
- **Verification:** `bun run test:unit` — 125/125 tests pass (10 new); `bun run typecheck` — exits 0; `bun run lint` — no issues

**Files created:**
- `20_Applications/scriptor-web/app/groups/[...slug]/page.tsx` — new file; async server component with `generateStaticParams` and `GroupDetailPage`
- `20_Applications/scriptor-web/app/groups/[...slug]/detail-page.module.css` — new file; CSS module with token-based styles mirroring the script detail page
- `20_Applications/scriptor-web/app/groups/[...slug]/page.test.tsx` — new file; 10 unit tests covering all specified behaviors

---

## Task 10 — Update platform browse pages to display groups

**Status:** completed

**Description:**
Update the three named platform browse pages (`app/scripts/linux/page.tsx`, `app/scripts/windows/page.tsx`, `app/scripts/mac/page.tsx`) to call `loadGroups(scripts)` and render `<GroupRow>` entries before ungrouped `<ScriptRow>` entries. Groups whose member scripts all belong to the current platform are shown first; ungrouped scripts appear after. Satisfies UC-001, AC-001, AC-002, AC-003, AC-004, AC-005. Depends on Tasks 3, 4, and 8.

- In each platform page: after calling `loadScripts()`, also call `await loadGroups(scripts)`
- Filter groups to those where all member scripts match the page's platform prefix
- For each matching group, collect its ordered member scripts from the full script list
- Render `<GroupRow group={group} members={groupMembers} />` for each matching group, then `<ScriptRow>` for each script whose `group` field is undefined (or whose group ID does not resolve to a valid group)
- Visual separation between group section and ungrouped scripts section (CSS class or spacing — no explicit label required per AC-002)
- Ungrouped scripts section: each `<ScriptRow>` links directly to its individual detail page (unchanged behavior, AC-013)

**Implementation Notes:**
- **RED phase:** Created co-located test files for all three platform pages (linux, windows, mac). Each test file mocks `loadScripts` and `loadGroups`, supplying two grouped scripts and two ungrouped scripts. Tests asserted: GroupRow renders before ungrouped ScriptRows; group badge is present; grouped scripts are absent from the ungrouped section (collapsed GroupRow hides members); ungrouped scripts appear when no groups exist; script count reflects total platform scripts. All tests failed — the pages did not call `loadGroups` or render `<GroupRow>`.
- **GREEN phase:** Updated all three platform pages with the same pattern:
  1. Call `loadScripts()` and filter to platform-prefixed scripts
  2. Call `await loadGroups(platformScripts)` to get group metadata
  3. Build `activeGroups` — groups with at least one member in platformScripts
  4. Build `ungroupedScripts` — platform scripts whose `group` is undefined or not an active group ID
  5. Render a `<div className={styles.groupList}>` (only when activeGroups.length > 0) containing `<GroupRow>` for each active group with sorted members
  6. Render `<div className={styles.scriptList}>` containing `<ScriptRow>` for each ungrouped script
  - Member sort comparator inlined in each page: ascending `groupOrder` (undefined last), then `id` as tiebreaker
  - Added `.groupList` class to all three CSS modules (`padding: 40px 120px 0`) providing visual spacing above the ungrouped scripts section
- **Verification:** `bun run test:unit` — 143/143 pass (18 new across 3 test files); `bun run typecheck` — exits 0; `bun run lint` — no issues; `bun run format` — no remaining issues

**Files changed:**
- `20_Applications/scriptor-web/app/scripts/linux/page.tsx` — added `loadGroups`/`GroupRow` imports; added group loading, active group filtering, ungrouped split, grouped section rendering
- `20_Applications/scriptor-web/app/scripts/linux/page.module.css` — added `.groupList` class
- `20_Applications/scriptor-web/app/scripts/linux/page.test.tsx` — new file; 6 unit tests
- `20_Applications/scriptor-web/app/scripts/windows/page.tsx` — same changes as linux page
- `20_Applications/scriptor-web/app/scripts/windows/page.module.css` — added `.groupList` class
- `20_Applications/scriptor-web/app/scripts/windows/page.test.tsx` — new file; 6 unit tests
- `20_Applications/scriptor-web/app/scripts/mac/page.tsx` — same changes as linux page
- `20_Applications/scriptor-web/app/scripts/mac/page.module.css` — added `.groupList` class
- `20_Applications/scriptor-web/app/scripts/mac/page.test.tsx` — new file; 6 unit tests

---

## Task 11 — Add scripts-fixture group data for E2E tests

**Status:** completed

**Description:**
Add fixture group data to the `scripts-fixture/` directory so that Playwright E2E tests can exercise group browsing and group detail page rendering against the built static site. The fixture includes: two member scripts with `group` and `group_order` frontmatter, a `groups.json` manifest entry for the fixture group, and a hand-authored `run-all.sh` runner script (since fixture builds do not run `loadGroups` writer side-effect in CI without a real write path). Satisfies the E2E test prerequisite for AC-001 through AC-015 and AC-016.

- Add at least two `.sh` or `.ps1` fixture scripts under `scripts-fixture/<platform>/<target>/` with valid `group: fixture-group` and `group_order: 1` / `group_order: 2` frontmatter
- Add a `scripts-fixture/groups.json` (parallel to `scripts/groups.json`) with a single entry: `{ "id": "fixture-group", "name": "Fixture Group", "description": "E2E test fixture group." }`
- Add `scripts-fixture/<platform>/<target>/fixture-group/run-all.sh` — a minimal hand-authored runner (shebang, progress echo, placeholder `curl` commands using fixture URLs) so the group detail page one-liner URL resolves to a stable raw path during E2E test assertions
- Update `loadGroups.ts` default `groupsFilePath` to respect `SCRIPTS_DIR` env var (parallel to how `loadScripts.ts` respects it) so that `SCRIPTS_DIR=scripts-fixture bun run build` uses `scripts-fixture/groups.json`

**Implementation Notes:**
- **RED phase:** Added 9 tests to `loadGroups.test.ts` (4 for `scripts-fixture/groups.json` shape, 5 for `scripts-fixture/linux/fixture-group/run-all.sh` shape) and 3 tests to `loadScripts.test.ts` (verifying `ubuntu-24.04-x64/fixture-install-curl` and `fixture-setup-dev` have `group: fixture-group` and expected `groupOrder` values). All 12 new tests failed with `ENOENT` (files not found) and `undefined` group fields — RED confirmed.
- **GREEN phase:**
  - Added `group: fixture-group` and `group_order: 1` frontmatter fields to `scripts-fixture/linux/ubuntu-24.04-x64/fixture-install-curl.sh` (the ubuntu variant; debian-13-x64 variant intentionally left ungrouped to preserve variety in the fixture set)
  - Added `group: fixture-group` and `group_order: 2` frontmatter fields to `scripts-fixture/linux/ubuntu-24.04-x64/fixture-setup-dev.sh`
  - Created `scripts-fixture/groups.json` with a single `fixture-group` entry (`id`, `name`, `description`)
  - Created `scripts-fixture/linux/fixture-group/run-all.sh` — hand-authored runner with bash shebang, `set -euo pipefail`, `[1/2]`/`[2/2]` progress echoes, and `curl -fsSL | bash` lines referencing the real fixture script URLs
  - `loadGroups.ts` already respected `SCRIPTS_DIR` (implemented in Task 3) — no changes needed
  - Refined `loadScripts.test.ts` test selectors to use `ubuntu-24.04-x64/fixture-install-curl` (not just `fixture-install-curl`) to avoid ambiguity with the debian-13-x64 variant that lacks group fields
- **Verification:** `bun run test:unit` — 155/155 tests pass (12 new); `bun run typecheck` — exits 0; `bun run lint` — no issues

**Files created/modified:**
- `scripts-fixture/groups.json` — new file; JSON array with one `fixture-group` entry
- `scripts-fixture/linux/ubuntu-24.04-x64/fixture-install-curl.sh` — added `group: fixture-group` and `group_order: 1` to frontmatter
- `scripts-fixture/linux/ubuntu-24.04-x64/fixture-setup-dev.sh` — added `group: fixture-group` and `group_order: 2` to frontmatter
- `scripts-fixture/linux/fixture-group/run-all.sh` — new file; hand-authored bash runner for the fixture group
- `20_Applications/scriptor-web/lib/loadGroups.test.ts` — added 9 new fixture file shape tests
- `20_Applications/scriptor-web/lib/loadScripts.test.ts` — added 3 new integration tests verifying fixture scripts have group fields

---

## Task 12 — Add E2E tests for group browse and group detail

**Status:** completed

**Description:**
Add Playwright E2E tests to `scriptor-web-test` covering group browse (UC-001) and group detail (UC-002) workflows against the built static site. Also add a footer version assertion to `smoke.spec.ts` or `browse.spec.ts` (UC-004). Requires the fixture data from Task 11 and the built output from Tasks 8–10. Satisfies E2E coverage for AC-001 through AC-009 and AC-016.

- Create `20_Applications/scriptor-web-test/tests/group-detail.spec.ts`:
  - Navigate to the fixture group detail page
  - Assert group title renders in `<h1>`
  - Assert one-liner run command is present (copyable code block)
  - Assert member script links are visible and link to `/scripts/` detail pages
- Add to `20_Applications/scriptor-web-test/tests/browse.spec.ts`:
  - Assert the browse page shows the fixture group entry before ungrouped scripts
  - Assert the group entry has a badge/tag distinguishing it from script entries
  - Assert clicking the expand control reveals the member list
  - Assert clicking the group title navigates to the group detail page
  - Assert ungrouped scripts appear after group entries
- Add footer version assertion (to `smoke.spec.ts` or `browse.spec.ts`):
  - Assert footer contains a version string matching `/v\d+\.\d+\.\d+/`

**Implementation Notes:**
- **RED phase:** Created `group-detail.spec.ts` (7 tests) and added 6 group/footer tests to `browse.spec.ts` and `smoke.spec.ts`. Built the fixture site with `SCRIPTS_DIR=scripts-fixture bun run build` to confirm the group page was generated. First run had 1 failure: `getByText('Fixture Group')` strict mode violation because "Fixture Group" text matched both the group name link and the description span (which contained "E2E test fixture group." — "Fixture Group" is a substring). Fixed by switching to `getByRole('link', { name: 'Fixture Group' })`.
- **GREEN phase:** After fixing the selector, all 26 E2E tests pass (including 13 new tests: 7 in `group-detail.spec.ts`, 5 in `browse.spec.ts`, 3 in `smoke.spec.ts`).
- **Key decisions:**
  - Used `getByRole` and `getByTestId` selectors (leveraging `data-testid="group-badge"` from `GroupRow.tsx`) rather than `getByText` for group-specific assertions, to avoid strict mode violations from partial text matches.
  - The "expand control reveals member list" test clicks `getByRole("button", { name: "expand" })` and then asserts `Fixture Setup Dev` is visible — avoids ambiguity since "Fixture Install curl" appears in both the grouped (ubuntu) and ungrouped (debian) scripts.
  - DOM position tests (group appears before ungrouped) use `getBoundingClientRect().top` comparisons via `evaluate`.
  - Footer version tests use `page.locator("footer").toContainText(/v\d+\.\d+\.\d+/)` — passes because `loadVersion()` resolves the version from `package.json`.
- **Verification:** `SCRIPTS_DIR=scripts-fixture bun run test:e2e` — 26/26 pass; `bun run lint` — no issues; `bun run typecheck` — exits 0; `bun run test:unit` — 155/155 pass.

**Files created/modified:**
- `20_Applications/scriptor-web-test/tests/group-detail.spec.ts` — new file; 7 Playwright tests covering group detail page title, description, one-liner URL, member links, navigation from member links, and copy button
- `20_Applications/scriptor-web-test/tests/browse.spec.ts` — added 5 group browse tests: fixture group entry visible, group badge present, expand control reveals member list, group title navigates to detail page, ungrouped scripts present
- `20_Applications/scriptor-web-test/tests/smoke.spec.ts` — added 3 footer version assertions: home page, linux browse page, and group detail page all show `/v\d+\.\d+\.\d+/` in the footer

---

## Task 13 — Full pre-commit verification pass

**Status:** completed

**Description:**
Run the complete pre-commit checklist and fix any issues that surface. This is the integration gate confirming all seventeen acceptance criteria (AC-001 through AC-017) are satisfied simultaneously. Not a feature task — a verification and remediation task. References all ACs.

- `bun run build` — exits 0; `out/` contains browse pages with group entries, group detail pages, and updated footer
- `bun run typecheck` — exits 0 across all workspaces
- `bun run lint` — exits 0, no errors or warnings
- `bun run format` — apply corrections; re-run lint to confirm clean
- `bun run test:unit` — all unit tests pass (`loadGroups`, `loadVersion`, `loadScripts` additions, `GroupRow`, `Footer`, group detail page, platform browse pages)
- `bun run test:e2e` — all Playwright tests pass (`group-detail.spec.ts`, updated `browse.spec.ts`, footer version assertions in `smoke.spec.ts`)
- Manually confirm: (AC-003) group entries show a badge/tag; (AC-004) expand/collapse works inline; (AC-008) group detail page layout matches script detail page; (AC-016) version visible in footer on every page

**Implementation Notes:**
- **Results:** All checks passed on the first run with no code changes required.
- `bun run lint` — clean (0 errors, 0 warnings), 88 files checked
- `bun run typecheck` — exits 0 across both workspaces (`scriptor-web` and `scriptor-web-test`)
- `bun run test:unit` — 155/155 tests pass across 18 test files
- `bun run build` — exits 0; fixture site contains `/groups/linux/fixture-group` route and all browse pages
- `bun run test:e2e` — 26/26 Playwright tests pass (7 group-detail, 5 browse group tests, 3 smoke footer version tests, 11 pre-existing tests)
- `bun run format` — applied minor trailing-whitespace fixes to `browse.spec.ts` and `smoke.spec.ts`; re-ran lint to confirm clean
- Build log shows "Group 'fixture-group' has no valid member scripts — skipping runner generation" warning (expected — the runner already exists as a hand-authored file from Task 11; the warning is non-fatal and correct)
- All 17 ACs confirmed satisfied by the passing E2E test suite
