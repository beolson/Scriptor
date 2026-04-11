---
status: Ready
created: 2026-04-11
---

# Script Groups and Version Display — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Extend Script type with group fields

**Status:** not started

**Description:**
Add optional `group` and `groupOrder` fields to the `Script` interface in `lib/types.ts`. This is the foundational type change that every other module in this epic depends on. Making these fields optional preserves backward compatibility with all existing code that constructs or consumes `Script` objects. Satisfies the data model prerequisite for UC-001, UC-002, and AC-014.

- Add `group?: string` to `Script` — holds the group ID from frontmatter (e.g., `"linux-dev-setup"`)
- Add `groupOrder?: number` to `Script` — integer sort position within the group; `undefined` sorts last
- Update `lib/types.test.ts` to assert the new optional fields are accepted on a `Script` object and are not required

**TDD Approach:**
- **RED:** Add tests to `20_Applications/scriptor-web/lib/types.test.ts` asserting a `Script` object with `group: "linux-dev-setup"` and `groupOrder: 1` is type-valid, and that a `Script` without these fields is also valid — these fail until the interface is updated
- **GREEN:** Add `group?: string` and `groupOrder?: number` to the `Script` interface in `20_Applications/scriptor-web/lib/types.ts`
- Cover: `Script` with both fields; `Script` without either field; `group` is `string`, `groupOrder` is `number`

---

## Task 2 — Create scripts/groups.json manifest scaffold

**Status:** not started

**Description:**
Create `scripts/groups.json` at the repo root `scripts/` directory. This file is the source of truth for group metadata displayed on the web site (UC-001, UC-002). The manifest is scaffolded with one example entry so `loadGroups.ts` (Task 3) has real data to validate against and the E2E fixture build (Task 11) has a real group to display. Satisfies the `groups.json` data model requirement and is a prerequisite for every subsequent group task.

- Create `scripts/groups.json` as a JSON array of `GroupEntry` objects: `[{ "id": "...", "name": "...", "description": "..." }]`
- Schema: each entry must have `id` (string, unique), `name` (string, human-readable display name), `description` (string, one-line description)
- Scaffold with one placeholder entry (e.g., `"id": "example-linux-setup"`) — real groups will be added as member scripts are authored
- No platform field — platform is inferred from member scripts at build time

**TDD Approach:**
- **RED:** Write a JSON schema validation test in `20_Applications/scriptor-web/lib/loadGroups.test.ts` (scaffolded in this task as a stub) that asserts the real `scripts/groups.json` parses as a valid array with at least one entry having `id`, `name`, and `description` fields — this fails before the file exists
- **GREEN:** Create `scripts/groups.json` with a valid placeholder entry; the parse test passes
- Cover: file is valid JSON; top-level value is an array; first entry has `id`, `name`, `description` as non-empty strings

---

## Task 3 — Implement loadGroups()

**Status:** not started

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

**TDD Approach:**
- **RED:** Write tests in `20_Applications/scriptor-web/lib/loadGroups.test.ts` using injected in-memory deps covering all behaviors listed below — all fail until `loadGroups.ts` exists
- **GREEN:** Implement `loadGroups.ts` to make each test pass
- Cover: returns `[]` and warns on missing file; returns `[]` and warns on malformed JSON; parses valid manifest and returns typed `GroupEntry[]`; calls `writeFile` with runner path and content for a group with valid members; runner content includes `[1/2]` and `[2/2]` progress markers; runner content includes member script raw URLs in declared order; skips runner generation and warns when group has no valid members; throws with group ID and conflicting platforms when member scripts span multiple platforms; members without `groupOrder` sort after members with explicit `groupOrder`, with `id` as tiebreaker; ignores scripts whose `group` field does not match any `groups.json` entry (treats them as ungrouped) and warns

---

## Task 4 — Extend loadScripts.ts to parse group frontmatter fields

**Status:** not started

**Description:**
Extend `SpecFrontmatter` in `lib/loadScripts.ts` with `group?: unknown` and `group_order?: unknown`, and map them to the new `group` and `groupOrder` fields on the returned `Script` objects. Existing scripts without these fields are unaffected. Satisfies the data flow prerequisite for UC-001 and AC-001 (groups visible on browse page). Depends on Task 1 (Script type extended).

- Add `group?: unknown` and `group_order?: unknown` to the internal `SpecFrontmatter` interface in `loadScripts.ts`
- After validating `platform` and `title`: if `group` is present and is a string, assign it to `script.group`; if `group` is present but not a string, call `console.warn` and leave `group` undefined
- If `group_order` is present and is a finite integer (`Number.isFinite` + `Number.isInteger`), assign it to `script.groupOrder`; if present but not a valid integer, leave `groupOrder` undefined (sorts last)
- No changes to sort order in `loadScripts` — sorting within a group is `loadGroups`'s responsibility

**TDD Approach:**
- **RED:** Add test cases to `20_Applications/scriptor-web/lib/loadScripts.test.ts` with fixture scripts that include `group: linux-dev-setup` and `group_order: 2` in frontmatter — assert `script.group === "linux-dev-setup"` and `script.groupOrder === 2`; add cases for non-string `group` (warns, `group` undefined) and non-integer `group_order` (`groupOrder` undefined) — all fail against the current implementation
- **GREEN:** Extend `SpecFrontmatter` and the `scripts.push(...)` call to include the new fields
- Cover: valid `group` and `group_order` parsed correctly; `group` present but not a string: warns and `group` is undefined on `Script`; `group_order` present but not a number: `groupOrder` is undefined; `group_order` present as a float: `groupOrder` is undefined; script with no group fields produces `group: undefined, groupOrder: undefined`

---

## Task 5 — Implement loadVersion()

**Status:** not started

**Description:**
Create `lib/loadVersion.ts` — a build-time helper that reads `version` from `20_Applications/scriptor-web/package.json` and returns it as a `string | undefined`. Returns `undefined` on any error — missing file, missing `version` field, or parse error — and never throws. Follows the Bun/Node compat pattern from `loadPlatforms.ts`. Satisfies UC-004, AC-016, AC-017.

- Export `async function loadVersion(): Promise<string | undefined>`
- Resolve `package.json` path via `import.meta.url` (one level up from `lib/`, i.e., `../package.json` relative to the `lib/` directory)
- Read and parse as JSON; return `data.version` if it is a non-empty string
- Return `undefined` on file-not-found, JSON parse failure, or missing/non-string `version` field — never throw

**TDD Approach:**
- **RED:** Write tests in `20_Applications/scriptor-web/lib/loadVersion.test.ts` using injected in-memory deps covering: returns version string when present; returns `undefined` when `version` field is missing; returns `undefined` when file is missing; returns `undefined` when JSON is malformed — all fail until `loadVersion.ts` exists
- **GREEN:** Implement `loadVersion.ts`
- Cover: returns version string from valid `package.json`; returns `undefined` on missing file; returns `undefined` when `version` is absent from parsed JSON; returns `undefined` when `version` is not a string; returns `undefined` on JSON parse error

---

## Task 6 — Update Footer component with version prop

**Status:** not started

**Description:**
Update `components/Footer.tsx` to accept a `version?: string` prop and render the version string in the footer when present. When `version` is `undefined`, the footer renders with no version element — no placeholder, no crash. Add a co-located `Footer.test.tsx` (does not exist yet). Add a `.version` CSS class to `Footer.module.css` using `var(--scriptor-muted)`. Satisfies UC-004, AC-016, AC-017.

- Update `Footer.tsx` props interface to accept `version?: string`
- Render `<span className={styles.version}>v{version}</span>` inside the footer when `version` is defined
- Add `.version` class to `Footer.module.css` using `var(--scriptor-muted)` for color
- Create `components/Footer.test.tsx` with unit tests

**TDD Approach:**
- **RED:** Create `20_Applications/scriptor-web/components/Footer.test.tsx` with tests asserting: renders version string when `version` prop is provided; does not render any version element when `version` is `undefined` — both fail because `Footer` does not accept a `version` prop yet
- **GREEN:** Update `Footer.tsx` to accept and render the `version` prop; update `Footer.module.css` with the `.version` class
- Cover: version string rendered with `v` prefix when prop provided; no version element in DOM when prop is undefined; footer still renders its existing content (tagline, GitHub link) regardless of version prop

---

## Task 7 — Wire loadVersion() into layout.tsx

**Status:** not started

**Description:**
Update `app/layout.tsx` to call `loadVersion()` at build time and pass the result as the `version` prop to `<Footer />`. This threads the version string from `package.json` through to the footer on every page. Satisfies UC-004, AC-016, AC-017. Depends on Task 5 (loadVersion) and Task 6 (Footer props).

- Make `RootLayout` in `app/layout.tsx` an `async` function (or add an outer async wrapper) so it can `await loadVersion()`
- Pass the resolved `version` string (or `undefined`) to `<Footer version={version} />`
- Import `loadVersion` from `@/lib/loadVersion`

**TDD Approach:**
- **RED:** Update or create a test for `app/layout.tsx` (or verify via the existing page test) that mocks `loadVersion` to return `"1.2.3"` and asserts the rendered footer contains `"v1.2.3"` — fails until `layout.tsx` calls `loadVersion()`
- **GREEN:** Make `RootLayout` async; call `await loadVersion()`; pass result to `<Footer version={version} />`
- Cover: `loadVersion()` return value forwarded to Footer; layout renders with version present; layout renders correctly when `loadVersion()` returns `undefined` (footer omits version, no crash)

---

## Task 8 — Create GroupRow component

**Status:** not started

**Description:**
Create `components/GroupRow.tsx` — a `"use client"` component that renders a single group entry on the browse page. The component shows the group name, description, a visual badge/tag distinguishing it from script entries, and an expand/collapse control. When expanded, it renders a nested list of member scripts as clickable links. This is the primary UI component for UC-001 (AC-003, AC-004, AC-005). Depends on Task 1 (`Script` type with group fields).

- Mark as `"use client"` and use `useState` for expand/collapse state
- Props: `group: GroupEntry` (from `loadGroups.ts`), `members: Script[]` (ordered, passed from server page)
- Render: group name as a link to `/groups/<platform>/<group-id>/` (or the group detail URL); a badge/tag element (e.g., `<span>Group</span>`) to distinguish from script entries; a toggle button/icon that shows/hides the expanded member list
- When expanded: render each member as `<a href="/scripts/<member.id}">` with `member.title` and `member.description` below the title
- Co-located `GroupRow.module.css` using `var(--scriptor-*)` design tokens; no hardcoded colors or spacing; no Tailwind utility classes in JSX
- Create `GroupRow.test.tsx` co-located

**TDD Approach:**
- **RED:** Create `20_Applications/scriptor-web/components/GroupRow.test.tsx` with tests for all behaviors below — all fail until `GroupRow.tsx` exists
- **GREEN:** Implement `GroupRow.tsx` and `GroupRow.module.css`
- Cover: renders group name; renders group description; renders a badge/tag element visually distinguishing from scripts; expand toggle defaults to collapsed (member list not visible); clicking expand toggle reveals member list; member list shows each member as a link; member link href is `/scripts/<member.id>`; member description renders beneath title; clicking group name link navigates to group detail URL (correct href); collapsed state shows no member items

---

## Task 9 — Create group detail page

**Status:** not started

**Description:**
Create `app/groups/[...slug]/page.tsx` — the group detail page. The layout mirrors the individual script detail page (AC-008): group title, description, platform information, a copyable one-liner command (the runner script `curl | bash`), and a list of member scripts as clickable links in declared order. Satisfies UC-002, AC-006, AC-007, AC-008, AC-009. Depends on Tasks 3 (loadGroups), 4 (loadScripts with group fields), and 8 (GroupRow as reference for the member list pattern).

- Create `app/groups/[...slug]/page.tsx` as an async server component
- Export `generateStaticParams()`: calls both `loadGroups(scripts)` and `loadScripts()`; returns only groups that have at least one valid member; slugs take the form `[platform, group-id]` (e.g., `["linux", "linux-dev-setup"]`)
- Page component: join slug to resolve group ID; find the matching `GroupEntry` from `loadGroups(scripts)`; call `notFound()` for unrecognized slugs or groups with no members
- Render: `<h1>` with group name; description paragraph; platform metadata (derived from member scripts); `<CodeBlock>` with one-liner run command (`curl -fsSL <runner-raw-url> | bash` or `irm <url> | iex`); member list with each member as a link to `/scripts/<member.id>` with description
- One-liner URL pattern: `${RAW_BASE}/<platform>/<group-id>/run-all.sh` (or `.ps1`)
- Create `app/groups/[...slug]/detail-page.module.css` reusing the token-based style patterns from `app/scripts/[...slug]/detail-page.module.css`

**TDD Approach:**
- **RED:** Create `20_Applications/scriptor-web/app/groups/[...slug]/page.test.tsx` — mock `loadGroups` and `loadScripts`; write tests for all required renders — all fail until the page exists
- **GREEN:** Implement the group detail page and CSS module
- Cover: renders group title in `<h1>`; renders group description; renders platform value derived from member scripts; renders copyable one-liner `CodeBlock`; one-liner URL contains the group runner path; member list renders each member as a link to `/scripts/<id>`; member list is in `groupOrder` ascending order; `notFound()` called for unknown slug; `notFound()` called when group has no members; `generateStaticParams` returns only groups with valid members

---

## Task 10 — Update platform browse pages to display groups

**Status:** not started

**Description:**
Update the three named platform browse pages (`app/scripts/linux/page.tsx`, `app/scripts/windows/page.tsx`, `app/scripts/mac/page.tsx`) to call `loadGroups(scripts)` and render `<GroupRow>` entries before ungrouped `<ScriptRow>` entries. Groups whose member scripts all belong to the current platform are shown first; ungrouped scripts appear after. Satisfies UC-001, AC-001, AC-002, AC-003, AC-004, AC-005. Depends on Tasks 3, 4, and 8.

- In each platform page: after calling `loadScripts()`, also call `await loadGroups(scripts)`
- Filter groups to those where all member scripts match the page's platform prefix
- For each matching group, collect its ordered member scripts from the full script list
- Render `<GroupRow group={group} members={groupMembers} />` for each matching group, then `<ScriptRow>` for each script whose `group` field is undefined (or whose group ID does not resolve to a valid group)
- Visual separation between group section and ungrouped scripts section (CSS class or spacing — no explicit label required per AC-002)
- Ungrouped scripts section: each `<ScriptRow>` links directly to its individual detail page (unchanged behavior, AC-013)

**TDD Approach:**
- **RED:** Update or create page-level tests for each platform page; mock `loadGroups` and `loadScripts` to return a group with two members and two ungrouped scripts; assert `GroupRow` renders before ungrouped `ScriptRow`; assert ungrouped `ScriptRow` entries are present — all fail until pages call `loadGroups` and render `<GroupRow>`
- **GREEN:** Update each platform page to call `loadGroups(scripts)`, split scripts into grouped vs. ungrouped, and render both sections
- Cover: groups rendered before ungrouped scripts; group entries present when groups exist; ungrouped scripts rendered after groups; scripts belonging to a group are not duplicated in the ungrouped section; platform pages without any groups show only the ungrouped scripts section (no empty group section)

---

## Task 11 — Add scripts-fixture group data for E2E tests

**Status:** not started

**Description:**
Add fixture group data to the `scripts-fixture/` directory so that Playwright E2E tests can exercise group browsing and group detail page rendering against the built static site. The fixture includes: two member scripts with `group` and `group_order` frontmatter, a `groups.json` manifest entry for the fixture group, and a hand-authored `run-all.sh` runner script (since fixture builds do not run `loadGroups` writer side-effect in CI without a real write path). Satisfies the E2E test prerequisite for AC-001 through AC-015 and AC-016.

- Add at least two `.sh` or `.ps1` fixture scripts under `scripts-fixture/<platform>/<target>/` with valid `group: fixture-group` and `group_order: 1` / `group_order: 2` frontmatter
- Add a `scripts-fixture/groups.json` (parallel to `scripts/groups.json`) with a single entry: `{ "id": "fixture-group", "name": "Fixture Group", "description": "E2E test fixture group." }`
- Add `scripts-fixture/<platform>/<target>/fixture-group/run-all.sh` — a minimal hand-authored runner (shebang, progress echo, placeholder `curl` commands using fixture URLs) so the group detail page one-liner URL resolves to a stable raw path during E2E test assertions
- Update `loadGroups.ts` default `groupsFilePath` to respect `SCRIPTS_DIR` env var (parallel to how `loadScripts.ts` respects it) so that `SCRIPTS_DIR=scripts-fixture bun run build` uses `scripts-fixture/groups.json`

**TDD Approach:**
- **RED:** Run `SCRIPTS_DIR=scripts-fixture bun run build` — build fails or group pages are absent because the fixture has no group data
- **GREEN:** Add all fixture files and update `loadGroups.ts` to respect `SCRIPTS_DIR`; rebuild with fixture dir; verify group pages are present in `out/`
- Cover: fixture group entry in `groups.json` parses correctly; fixture member scripts have `group` and `group_order` fields; built output contains `/groups/<platform>/<target>/fixture-group/` page; `run-all.sh` runner file exists in fixture directory

---

## Task 12 — Add E2E tests for group browse and group detail

**Status:** not started

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

**TDD Approach:**
- **RED:** Create `group-detail.spec.ts` and add browse/footer assertions — tests fail because group pages do not exist in the built output yet (or fixture is not set up); run with `SCRIPTS_DIR=scripts-fixture bun run test:e2e` to confirm failures
- **GREEN:** Once Tasks 8–11 are complete and the fixture build succeeds, run `bun run test:e2e` — all new tests pass
- Cover: group detail page renders title, one-liner, member links; browse page shows group entry first; group badge/tag visible; expand reveals members; group title link leads to detail page; footer version present

---

## Task 13 — Full pre-commit verification pass

**Status:** not started

**Description:**
Run the complete pre-commit checklist and fix any issues that surface. This is the integration gate confirming all seventeen acceptance criteria (AC-001 through AC-017) are satisfied simultaneously. Not a feature task — a verification and remediation task. References all ACs.

- `bun run build` — exits 0; `out/` contains browse pages with group entries, group detail pages, and updated footer
- `bun run typecheck` — exits 0 across all workspaces
- `bun run lint` — exits 0, no errors or warnings
- `bun run format` — apply corrections; re-run lint to confirm clean
- `bun run test:unit` — all unit tests pass (`loadGroups`, `loadVersion`, `loadScripts` additions, `GroupRow`, `Footer`, group detail page, platform browse pages)
- `bun run test:e2e` — all Playwright tests pass (`group-detail.spec.ts`, updated `browse.spec.ts`, footer version assertions in `smoke.spec.ts`)
- Manually confirm: (AC-003) group entries show a badge/tag; (AC-004) expand/collapse works inline; (AC-008) group detail page layout matches script detail page; (AC-016) version visible in footer on every page

**TDD Approach:**
- **RED:** Run the full checklist before all prior tasks are complete — at least one check fails
- **GREEN:** Work through each failure; fix lint/type/test issues; re-run until all checks are clean
- Cover: `bun run build` exit 0; `bun run typecheck` exit 0; `bun run lint` exit 0; `bun run test:unit` exit 0 with all tests passing; `bun run test:e2e` exit 0 with all Playwright tests passing
