---
status: Ready
created: 2026-04-11
---

# Script Groups and Version Display — Codebase Research

## Summary

The existing codebase provides a solid foundation for both features. `loadScripts.ts` drives the entire web build via dependency-injected filesystem I/O. The `Script` type and `SpecFrontmatter` interface are the primary extension points: adding `group` and `group_order` frontmatter fields requires changes in `loadScripts.ts` (parsing), `types.ts` (type shape), and the creation of a parallel `loadGroups.ts` loader for the manifest. No runner-script generation infrastructure exists yet — that is a net-new build-time artifact. The footer (`Footer.tsx`) exists and already participates in the layout but currently contains no version display; adding version requires reading `package.json` at build time and threading a version string prop into `Footer`. The platform-specific browse pages (`linux/page.tsx`, `windows/page.tsx`, `mac/page.tsx`) and the `[platform]/page.tsx` dynamic page are the integration point for UC-001's group display; both call `loadScripts()` directly. The `[...slug]/page.tsx` detail page is the model to replicate for UC-002's group detail page. URL routing for groups will need a new route segment (e.g., `app/scripts/[...slug]/page.tsx` extended, or a dedicated `app/groups/[...slug]/page.tsx`).

---

## Related Code Paths

### Script Data Model and Loader

**Files:**
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/lib/types.ts`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/lib/loadScripts.ts`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/lib/loadScripts.test.ts`

**Description:**

`types.ts` exports a single `Script` interface with fields: `id`, `title`, `description`, `platform`, `body`, `source`, `runCommand`. The `id` is derived by stripping the `.sh` or `.ps1` extension from the relative path (e.g., `linux/debian-13-x64/install-bun` from `linux/debian-13-x64/install-bun.sh`).

`loadScripts.ts` reads all `.sh` and `.ps1` files under `scripts/`, extracts an embedded spec block from each, parses the YAML frontmatter with `js-yaml`, validates required fields (`platform`, `title`), builds a `runCommand` using a hardcoded `RAW_BASE` URL, and returns a sorted `Script[]`. The function accepts an injectable `LoadScriptsDeps` interface for unit testing. The internal `SpecFrontmatter` interface only declares `platform`, `title`, and `description` — no `group` or `group_order` fields yet.

The sort order is: platform ascending, then title ascending. Runner commands are built by `buildRunCommand(id, ext)`, which constructs `curl -fsSL ${RAW_BASE}/${id}${ext} | bash` for `.sh` and `irm ${url} | iex` for `.ps1`.

**Relevance to this epic:**

- `group` and `group_order` must be added to `SpecFrontmatter` and parsed in `loadScripts`.
- The `Script` type must be extended with optional `group?: string` and `groupOrder?: number` fields.
- A parallel `loadGroups.ts` function is needed to read `scripts/groups.json`.
- Runner script generation (AC-014) is not handled here — it will be a separate build-time script.
- The `RAW_BASE` constant (`https://raw.githubusercontent.com/beolson/Scriptor/main/scripts`) is the base URL used to construct generated runner script URLs.

---

### Browse Pages (UC-001)

**Files:**
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/linux/page.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/windows/page.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/mac/page.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/linux/page.module.css`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/[platform]/page.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/ScriptsBrowser.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/ScriptsBrowser.module.css`

**Description:**

There are two browse patterns in the codebase:

1. **Named platform pages** (`linux/page.tsx`, `windows/page.tsx`, `mac/page.tsx`): Static pages that call `loadScripts()` then filter by ID prefix (`id.startsWith("linux/")`). They render `<ScriptRow>` components in a `<div>` list with `Breadcrumb`, a `CodeBlock` showing a one-liner install command, and a count. These do not use dynamic routing.

2. **Dynamic platform page** (`[platform]/page.tsx`): Generates static params from `loadPlatforms()`, then filters scripts by `platform` field. Renders a simple list of `<ScriptRow>` components with no breadcrumb or header code block.

3. **`ScriptsBrowser.tsx`**: A "use client" component used from neither browse path currently visible in the route tree — it provides filter-by-target functionality. It renders filter buttons per distinct `platform` value and a flat list of linked script titles (not `ScriptRow`).

The named platform pages (`linux/`, `windows/`, `mac/`) are the primary visible pages and contain the actual browse UI. The `ScriptsBrowser` component is more generic but unused in the named pages.

**Relevance to this epic:**

- UC-001 (Browse Script Groups) modifies these pages to show group entries first, then ungrouped scripts.
- The named platform pages (`linux/page.tsx` etc.) are the likely modification targets.
- Inline group expansion (AC-004) requires a client component with local expand/collapse state — similar to how `ScriptsBrowser` uses `"use client"`.
- A new `GroupRow` component (analogous to `ScriptRow`) will be needed to render group entries with a badge/icon indicator and expand control.

---

### Script Detail Page (UC-002 reference layout)

**Files:**
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/[...slug]/page.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/[...slug]/detail-page.module.css`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/[...slug]/page.test.tsx`

**Description:**

The catch-all route `[...slug]` renders individual script detail pages. Layout: full-width `<detail>` container → `<detailHeader>` (title h1) → `<runSection>` (CodeBlock with copy button) → `<detailBody>` (two-column: `<mainCol>` with spec markdown + source block, `<aside>` sidebar with platform/target metadata card). The page calls `loadScripts()`, finds the script by joining slug segments into an id, and calls `notFound()` for unrecognized slugs. Static params are generated by mapping all scripts to their slug arrays.

The CSS module has these key styles: `.detail`, `.detailHeader`, `.heading`, `.runSection`, `.detailBody`, `.mainCol`, `.sidebar`, `.metadataCard`, `.metaRow`, `.metaKey`, `.metaValue`, `.specContent`, `.sourceBlock`, `.boxLabel`, `.description`, `.badges`, `.badge`.

**Relevance to this epic:**

- UC-002 (Group Detail Page) must match this visual layout (AC-008).
- The group detail page will need its own route. Since `[...slug]` is already reserved for scripts, group routes need a different path — either `app/groups/[...slug]/page.tsx` or a convention like `/scripts/<platform>/<group-name>/` which would conflict with the existing catch-all. A separate `app/groups/` segment is the most likely clean approach.
- `generateStaticParams` must be extended or duplicated for groups.
- The detail CSS module and its token-based styles can be reused or duplicated for the group detail page.

---

### Footer Component (UC-004)

**Files:**
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/Footer.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/Footer.module.css`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/layout.tsx`

**Description:**

`Footer.tsx` is a simple server component. It renders a `<footer>` with two children: a tagline span and a GitHub link. No version display exists. It uses `Footer.module.css` for styling with `var(--scriptor-bg)`, `var(--scriptor-border)`, `var(--scriptor-muted)`, and `var(--scriptor-text)` tokens. The footer is mounted in `app/layout.tsx` as `<Footer />` inside the `<body>`, below `<main>`, ensuring it appears on every page.

The `layout.tsx` imports `Footer` directly from `@/components/Footer` and renders it unconditionally. There are no props passed to `Footer` currently.

**Relevance to this epic:**

- UC-004 (Display Site Version) requires reading `version` from `20_Applications/scriptor-web/package.json` at build time and rendering it inside `Footer`.
- The version must be resolved in a server context (build time), not at runtime. Since `Footer` is already a server component, it can read `package.json` directly or receive version as a prop from `layout.tsx`.
- The footer CSS has space in the flex layout (justify-content: space-between) to accommodate a version string alongside the existing tagline and github link.
- Error case: if `package.json` version is missing, the footer must omit the version field gracefully without crashing (AC-017).

---

### Platform Metadata Loader

**Files:**
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/lib/loadPlatforms.ts`
- `/home/beolson/src/h4h/Scriptor/scripts/platforms.json`

**Description:**

`loadPlatforms.ts` reads `scripts/platforms.json` at build time using a Bun/Node compat pattern. Returns a `Record<string, string>` mapping platform IDs to display names. Returns `{}` on error with a `console.warn`. `platforms.json` currently maps `"debian-13-x64"` → `"Debian 13 x64"` and `"windows-11-x64"` → `"Windows 11 X64"`. Note: `scripts/platforms.json` lives inside the `scripts/` directory, not at the repo root.

**Relevance to this epic:**

- The new `loadGroups.ts` function should follow the same pattern: read `scripts/groups.json`, return `{}` on error, support Bun/Node compat.
- `scripts/groups.json` does not yet exist and must be created alongside this epic.
- The path resolution pattern (navigate from `lib/` up to repo root, then into `scripts/`) is established and should be replicated.

---

### Shared UI Components

**Files:**
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/ScriptRow.tsx` + `ScriptRow.module.css`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/CodeBlock.tsx` + `CodeBlock.module.css`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/Breadcrumb.tsx` + `Breadcrumb.module.css`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/ui/copy-button.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/ui/filter-button.tsx`
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/ui/empty-state.tsx`

**Description:**

`ScriptRow` renders a script title as a link + description as a muted comment. Used by all named platform pages. `CodeBlock` renders a labeled code block with a `CopyButton`. `CopyButton` is a `"use client"` component using `navigator.clipboard`. `FilterButton` is `"use client"` using `class-variance-authority` for active/disabled variant styling. `EmptyState` renders a "no scripts found" message.

**Relevance to this epic:**

- The group detail page (UC-002) reuses `CodeBlock` for the group one-liner (analogous to the script run command).
- A new `GroupRow` component is needed for the browse page to render group entries — it will be similar to `ScriptRow` but with an expand toggle (requiring `"use client"`) and a badge/tag element.
- `CopyButton` is already available for the group one-liner copy action.
- The inline expand behavior in UC-001 (AC-004) requires client-side state; the group row component must be `"use client"` or wrap a client sub-component.

---

### Script File Structure and RAW URL Convention

**Files:**
- `/home/beolson/src/h4h/Scriptor/scripts/linux/debian-13-x64/install-bun.sh` (representative)
- `/home/beolson/src/h4h/Scriptor/scripts/windows/windows-11-x64/install-apps.ps1` (representative)
- `/home/beolson/src/h4h/Scriptor/scripts-fixture/` (test fixtures)

**Description:**

Scripts live at `scripts/<os>/<platform>/<script-name>.sh` (or `.ps1`). The `RAW_BASE` in `loadScripts.ts` is `https://raw.githubusercontent.com/beolson/Scriptor/main/scripts`. So a script at `scripts/linux/debian-13-x64/install-bun.sh` has the raw URL `https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/linux/debian-13-x64/install-bun.sh`.

The `scripts-fixture/` directory mirrors this structure for test isolation. The CI `test:e2e` task uses `SCRIPTS_DIR=scripts-fixture` to point the build at fixtures instead of real scripts.

**Relevance to this epic:**

- Generated runner scripts live at `scripts/<os>/<platform>/<group-name>/run-all.sh` — a new sub-directory level under the platform directory.
- The runner's raw URL would be `${RAW_BASE}/<os>/<platform>/<group-name>/run-all.sh`.
- Runner generation must happen before the Next.js build (or as a build step) so the runner files are committed and accessible. The Functional spec requires committing the generated runners.
- The `scripts-fixture/` directory should gain fixture group runner scripts for E2E test coverage.

---

### Build Process and Static Export

**Files:**
- `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/next.config.ts`
- `/home/beolson/src/h4h/Scriptor/package.json`
- `/home/beolson/src/h4h/Scriptor/.github/workflows/ci.yml`

**Description:**

`next.config.ts` uses `output: "export"` for static site generation. `trailingSlash: true` is set. All pages are generated at build time via `generateStaticParams`. The root `package.json` orchestrates with Turbo; `bun run build` runs `turbo run build`. E2E tests use `SCRIPTS_DIR=scripts-fixture` to avoid using real scripts. There is no existing build step for generating runner scripts.

**Relevance to this epic:**

- Group runner script generation (AC-014) needs to run before `next build`. This could be a standalone Bun script invoked before or as part of `bun run build`, or as a Turbo task with the right dependency graph.
- A new route `app/groups/[...slug]/page.tsx` must call `generateStaticParams` to enumerate all groups for static export.
- `generateStaticParams` for the group detail page will need to call both `loadGroups()` and `loadScripts()` to resolve group membership.

---

## Existing Patterns

### Dependency-Injected File Loader

**Where used:** `loadScripts.ts`, replicated pattern in `loadPlatforms.ts`

**How it works:** `loadScripts` accepts an optional `LoadScriptsDeps` interface with `glob`, `readFile`, and `scriptsDir`. When called without deps, it uses `defaultDeps` which uses Bun native APIs (`Bun.file().text()`) with a Node fallback for Vitest. Unit tests inject in-memory fixtures via `makeDeps()`. Integration tests use `defaultDeps(fixtureDir)` against `scripts-fixture/`.

**Apply to this epic:** `loadGroups.ts` should follow the same pattern — accept optional injectable deps for unit testing, use `Bun.file().text()` with Node fallback, resolve path relative to `import.meta.url`.

---

### Bun/Node Compat File Reading

**Where used:** `loadScripts.ts` (`readFileCompat`), `loadPlatforms.ts` (`readJson`)

**How it works:** Both functions check `typeof Bun !== "undefined"` and branch to `Bun.file(path).text()` or `fsReadFile(path, "utf8")`. This is needed because unit tests run under Vitest/Node.

**Apply to this epic:** Any new loader (`loadGroups.ts`, `loadVersion.ts`) must replicate this compat check.

---

### Server Component Data Fetching at Build Time

**Where used:** `app/scripts/linux/page.tsx`, `app/scripts/[platform]/page.tsx`, `app/scripts/[...slug]/page.tsx`, `app/page.tsx`

**How it works:** Page components are `async` functions that call data loaders (`loadScripts()`, `loadPlatforms()`) directly. No client-side fetching or API routes. All data is resolved at build time via `output: "export"`.

**Apply to this epic:** The group detail page and modified browse pages follow the same pattern. Version display in `Footer` can read `package.json` synchronously at module init or in an `async` footer function.

---

### CSS Modules with Design Tokens

**Where used:** Every component has a co-located `.module.css` file. All color/spacing values use `var(--scriptor-text)`, `var(--scriptor-muted)`, `var(--scriptor-accent)`, `var(--scriptor-border)`, `var(--scriptor-bg)` tokens from `globals.css`.

**How it works:** CSS Modules provide local scoping. The `globals.css` defines both `:root` (light) and `.dark` token sets. No inline styles or Tailwind utility classes in JSX (except existing `style={{ display: "flex", ... }}` in `layout.tsx` body tag).

**Apply to this epic:** Every new component (`GroupRow`, group detail page, version span in footer) needs a co-located `.module.css`. All token references must use `var(--scriptor-*)`. No hardcoded colors or spacing.

---

### "use client" for Interactive Components

**Where used:** `ScriptsBrowser.tsx`, `CopyButton.tsx`, `FilterButton.tsx`

**How it works:** Components needing `useState` or browser APIs are marked `"use client"`. They are composed into server component pages as leaf nodes.

**Apply to this epic:** The inline group expand control (AC-004) requires client-side state. The group row component (or a sub-component of it) must be `"use client"`. The expanded member list can be rendered client-side from data passed as props from the server page.

---

### Vitest Unit Tests Co-Located with Source

**Where used:** `lib/loadScripts.test.ts`, `lib/formatTarget.test.ts`, `lib/types.test.ts`, `app/page.test.tsx`, `app/scripts/ScriptsBrowser.test.tsx`, `app/scripts/[...slug]/page.test.tsx`

**How it works:** Test files sit next to their subjects with `.test.ts` or `.test.tsx` extensions. Vitest is used (not Jest), with `@testing-library/react` for component tests. Server component pages are tested by directly awaiting the async component function. Mocks use `vi.mock()` for module-level replacement.

**Apply to this epic:** New modules (`loadGroups.ts`, `loadVersion.ts`) need co-located `.test.ts` files. New components (`GroupRow`, group detail page) need `.test.tsx` files using the same patterns.

---

### Playwright E2E Tests Using scripts-fixture

**Where used:** `20_Applications/scriptor-web-test/tests/browse.spec.ts`, `detail.spec.ts`, `smoke.spec.ts`

**How it works:** E2E tests run against `bun run build` output (static export). CI passes `SCRIPTS_DIR=scripts-fixture` to use fixture data. Tests navigate pages and assert visible content. Fixture files follow the same frontmatter format as real scripts.

**Apply to this epic:** E2E tests will need fixture group data. A `scripts-fixture` group directory with a `run-all.sh` runner fixture, plus fixture scripts with `group` frontmatter, will be needed. A new `group-detail.spec.ts` and additions to `browse.spec.ts` will cover UC-001 and UC-002.

---

## Integration Points

### `loadScripts.ts` — Frontmatter Parsing Extension

**Module:** `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/lib/loadScripts.ts`

**Interface:**
```ts
interface SpecFrontmatter {
  platform?: unknown;
  title?: unknown;
  description?: unknown;
  // NEW:
  group?: unknown;
  group_order?: unknown;
}
```

**Notes:** `group` and `group_order` are optional and must be parsed without breaking existing scripts that don't include them. The `Script` type in `types.ts` must gain `group?: string` and `groupOrder?: number` fields. Validation: if `group` is present but not a string, warn and skip the group assignment. If `group_order` is present but not a number, default to `undefined` (sort last).

---

### `types.ts` — Script Type Extension

**Module:** `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/lib/types.ts`

**Interface:** The `Script` interface needs two new optional fields:
```ts
group?: string;       // group ID from frontmatter
groupOrder?: number;  // integer sort position within the group
```

**Notes:** Making these optional preserves backward compatibility with all existing code that constructs or consumes `Script` objects.

---

### Browse Pages — Group Display Integration

**Module:** `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/app/scripts/linux/page.tsx` (and `windows/`, `mac/`)

**Interface:** Pages currently call `loadScripts()` and render `<ScriptRow>` per script. Post-epic, pages will also call `loadGroups()` and assemble a mixed list: group entries first (rendered by a new `GroupRow`), then ungrouped scripts (still `ScriptRow`).

**Notes:** The group filtering logic (UC-001 alternative flow: only show groups where all member scripts match the active platform) happens here. Since all member scripts in a valid group share the same platform, filtering is straightforward.

---

### Footer Version Display

**Module:** `/home/beolson/src/h4h/Scriptor/20_Applications/scriptor-web/components/Footer.tsx`

**Interface:** `Footer` currently takes no props. It can either:
- Read `package.json` internally (making it an async server component), or
- Accept a `version?: string` prop passed from `layout.tsx`.

**Notes:** The `layout.tsx` calls `<Footer />` with no props. Reading version in `layout.tsx` and passing as a prop is cleaner since `layout.tsx` already imports `Footer`. Either approach works with the static export model.

---

### Static Params — Group Detail Page

**Module:** New `app/groups/[...slug]/page.tsx` (does not yet exist)

**Interface:** Must export `generateStaticParams` returning group slugs. Groups will have paths like `/groups/linux/debian-13-x64/linux-dev-setup`. Static param generation requires reading both `scripts/groups.json` and all scripts to verify groups have members.

**Notes:** The `output: "export"` constraint means every group URL must be declared at build time via `generateStaticParams`.

---

## Dependencies

| Dependency | Type | Version | Purpose |
|---|---|---|---|
| `js-yaml` | Runtime | `^4.1.0` | Already used in `loadScripts.ts` for frontmatter parsing — will be used in `loadGroups.ts` if manifest uses YAML; but `groups.json` is JSON so `JSON.parse` suffices |
| `react-markdown` | Runtime | `^9.0.0` | Already used on script detail page; group detail page description may also use it |
| `class-variance-authority` | Dev | `^0.7.1` | Used by `FilterButton`; the badge/tag on `GroupRow` may use it for variant styling |
| Node `node:fs/promises` | Built-in | — | Used as Vitest fallback in file loaders; `loadGroups.ts` will need the same |
| Node `node:path` | Built-in | — | Used for path resolution in all loaders |
| `vitest` | Dev | `^3.0.0` | Unit test runner for new loader and component tests |
| `@playwright/test` | Dev | — | E2E test runner; `scriptor-web-test` package |

No new external dependencies are required by this epic. All needed packages are already present.

---

## Gaps & Risks

- **`scripts/groups.json` does not exist.** The manifest file must be created before any group functionality works. Its schema (array vs object, required fields) must be decided in TechRequirements.
- **No `group` or `group_order` fields in any existing script.** The `SpecFrontmatter` interface does not recognize them; they would be silently dropped today. Parser extension is required.
- **No `loadGroups.ts` module.** Must be created. Its interface (what it returns, how it handles missing/malformed files) must be defined.
- **No runner script generation infrastructure.** AC-014 requires generating `run-all.sh` / `run-all.ps1` files and committing them. There is no existing build-time script generation mechanism. A Bun script (`scripts/generate-runners.ts` or similar) invoked via a root `package.json` script before `bun run build` is the most likely approach, but this is a new pattern.
- **URL routing conflict risk.** The `[...slug]` catch-all for scripts at `app/scripts/[...slug]/page.tsx` could conflict if group detail pages are placed under `/scripts/`. A group runner script path `scripts/<os>/<platform>/<group-name>/run-all.sh` would have an ID of `<os>/<platform>/<group-name>/run-all`, which would be caught by the existing slug page and return 404 (not found in scripts list). Groups must either use a distinct URL prefix (e.g., `/groups/`) or the existing slug page must be extended to also resolve groups.
- **No `loadVersion.ts` or version-reading utility.** Reading `package.json` at build time is a new pattern. The path resolution must account for the module location relative to `package.json` (`20_Applications/scriptor-web/package.json`).
- **`scripts-fixture/` has no group fixtures.** E2E tests for groups will require new fixture runner scripts and fixture scripts with `group` frontmatter. The `scripts-fixture/` is not under `scripts/` so runner generation must be tested separately or fixture runners must be written manually.
- **Platform constraint validation.** The Functional spec requires an error if group members span multiple platforms. No validation infrastructure exists today. Where this error surfaces (build error vs. console warning vs. group silently hidden) must be decided.
- **Expand/collapse state on browse page.** The named platform pages (`linux/page.tsx` etc.) are currently pure server components. Adding inline group expand requires introducing a `"use client"` component into these pages. This is a pattern established by `ScriptsBrowser` but not used in the named pages.
- **`ScriptsBrowser` vs. named pages disconnect.** Two browse patterns exist: `ScriptsBrowser.tsx` (client, generic, used from `app/scripts/page.tsx` which redirects) and named platform pages (server, hardcoded per platform). The named pages are the live browse surface. UC-001 should modify the named pages; `ScriptsBrowser` may become redundant or should be refactored.
- **No footer unit tests.** `Footer.tsx` has no co-located test file. Adding version display should come with a test.
- **`app/scripts/[platform]/page.tsx` is separate from named pages.** It exists and generates params from `platforms.json`, but the named pages (`linux/`, `windows/`, `mac/`) appear to be the primary browse surface. It's unclear whether the `[platform]` page is actively used or superseded. Groups should be added to whichever pages are canonical.
