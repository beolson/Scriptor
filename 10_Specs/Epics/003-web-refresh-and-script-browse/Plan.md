---
status: Ready
created: 2026-04-07
---

# Web Refresh and Script Browse — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Add gap and font-mono design tokens to globals.css

**Status:** completed

**Description:**
Add the missing `--gap-xs`, `--gap-sm`, `--gap-md`, `--gap-lg`, and `--font-mono` CSS custom property tokens to `20_Applications/scriptor-web/app/globals.css`. These tokens are already referenced by component CSS Modules (via fallbacks), and new components in later tasks will reference them without fallbacks. Adding them now ensures all subsequent component work has a consistent token base. Satisfies the design-token prerequisite for AC-001, AC-003.

- Add to the `:root` block in `app/globals.css`: `--gap-xs: 0.25rem`, `--gap-sm: 0.5rem`, `--gap-md: 1rem`, `--gap-lg: 2rem`, `--font-mono: var(--font-sans), monospace` (using Geist via `--font-sans` as the monospace font since the app uses Geist, not IBM Plex Mono)
- Do not modify any existing token definitions
- `bun run lint` must continue to exit 0

**Implementation Notes:**
- Added `--gap-xs: 0.25rem`, `--gap-sm: 0.5rem`, `--gap-md: 1rem`, `--gap-lg: 2rem`, and `--font-mono: var(--font-ibmplex), "IBM Plex Mono", monospace` to the `:root` block in `app/globals.css`
- TechRequirements.md specifies `--font-ibmplex` (not `--font-sans`) per the monorepo CLAUDE.md convention
- `bun run lint` exits 0 with no fixes applied
- Files modified: `20_Applications/scriptor-web/app/globals.css`

---

## Task 2 — Simplify Script interface in lib/types.ts

**Status:** completed

**Description:**
Update `20_Applications/scriptor-web/lib/types.ts` to replace the multi-field `platform: Platform`, `os: string`, and `arch?: Arch` fields with a single `platform: string` combined target field. Remove the `Platform` and `Arch` union types entirely. This is the foundational type change that every other task in this epic depends on. Satisfies AC-011.

- In `20_Applications/scriptor-web/lib/types.ts`: remove `type Platform`, remove `type Arch`, remove `os` and `arch` fields from `Script`, change `platform` from `Platform` to `string`
- Updated `Script` interface: `{ id: string; title: string; platform: string; body: string; source: string; runCommand: string }`
- Update `20_Applications/scriptor-web/lib/types.test.ts` to reflect the new shape: remove assertions on `os`, `arch`, `Platform`, and `Arch`; assert `platform` is `string`

**Implementation Notes:**
- Rewrote `lib/types.ts`: removed `Platform` and `Arch` union types, removed `os` and `arch` fields from `Script`, changed `platform` to `string`
- Rewrote `lib/types.test.ts`: replaced Platform/Arch type tests with Script shape tests asserting `platform` is `string` and `os`/`arch` are not present
- TypeScript errors in downstream files (`loadScripts.ts`, `ScriptsBrowser.tsx`, detail page tests) are expected and will be fixed in Tasks 3–8
- Unit tests: 67 passed (the Vitest tests still pass even with TypeScript errors because Vitest does not type-check at runtime)
- Files modified: `20_Applications/scriptor-web/lib/types.ts`, `20_Applications/scriptor-web/lib/types.test.ts`

---

## Task 3 — Create lib/formatTarget.ts

**Status:** completed

**Description:**
Create the new pure helper `20_Applications/scriptor-web/lib/formatTarget.ts` that converts a machine-readable combined target identifier to a human-readable display label. For example: `"debian-13-x64"` → `"Debian 13 X64"`. This module has no dependencies on other custom modules and is a leaf node used by `ScriptsBrowser` and the detail page. Satisfies the display label requirement of AC-001.

- Create `20_Applications/scriptor-web/lib/formatTarget.ts` exporting `formatTarget(target: string): string`
- Implementation: split on `"-"`, capitalize first character of each part, join with `" "`
- Create co-located `20_Applications/scriptor-web/lib/formatTarget.test.ts`

**Implementation Notes:**
- Created `20_Applications/scriptor-web/lib/formatTarget.ts` with `formatTarget(target: string): string` — splits on `-`, capitalizes first char of each part, joins with space
- Created `20_Applications/scriptor-web/lib/formatTarget.test.ts` with 6 test cases covering all required examples plus `ubuntu-24.04-x64` and `macos-sequoia-arm64`
- All 6 tests pass; total test count is now 73
- Files created: `20_Applications/scriptor-web/lib/formatTarget.ts`, `20_Applications/scriptor-web/lib/formatTarget.test.ts`

---

## Task 4 — Update loadScripts.ts to simplified Script model

**Status:** completed

**Description:**
Update `20_Applications/scriptor-web/lib/loadScripts.ts` to match the new `Script` interface: remove `os` and `arch` frontmatter parsing, require only `platform` (combined target) and `title`, simplify `buildRunCommand` to take only `id`, and migrate file I/O from `node:fs/promises` `readFile` to `Bun.file(path).text()`. This satisfies AC-011, and fixes the Bun-native API violation documented in Research.md. Satisfies AC-002 (targets derived from actual scripts).

- Remove `os` and `arch` from frontmatter parsing; skip any script missing `platform` or `title` with `console.warn(\`Skipping script ${id}: missing required field 'platform'\`)` or equivalent
- Simplify `buildRunCommand(id: string): string` to return `curl -fsSL https://raw.githubusercontent.com/beolson/Scriptor/main/scripts/${id} | bash` (no platform branching — `.ps1` windows variant can be added if a `.ps1` script is encountered but is not required to block this task)
- Update `LoadScriptsDeps` interface: change `readFile` to `(path: string) => Promise<string>`; update `defaultDeps` to use `Bun.file(path).text()`
- Sort result by `platform`, then `title` (no `os` field to sort by)
- Update `20_Applications/scriptor-web/lib/loadScripts.test.ts`: remove `os`/`arch` from all fixtures; update `platform` fixture values to combined target strings (e.g., `"ubuntu-24.04-x64"`); add test: script missing `platform` field is skipped with warn; add test: `buildRunCommand` produces correct URL for known id

**TDD Approach:**
- **RED:** Update `lib/loadScripts.test.ts` fixtures to use the new `Script` shape (no `os`, `platform: "ubuntu-24.04-x64"`) and add new test cases for missing `platform` warn and simplified `buildRunCommand` output — these will fail against the existing implementation
- **GREEN:** Update `lib/loadScripts.ts` to parse only `platform` and `title`; simplify `buildRunCommand`; update `defaultDeps` to use `Bun.file(path).text()`
- Cover: valid script parsed with new shape; missing `platform` skipped and warns; missing `title` skipped and warns; `buildRunCommand` produces correct URL; sort order by platform then title; empty array when no files; bad YAML skipped; integration test loads real scripts from disk

---

## Task 5 — Migrate script directory structure and frontmatter (3 scripts)

**Status:** completed

**Description:**
Rename the three existing script directories from their current `<os-version>` subdirectory names to the new combined target names, and update the frontmatter in each `.md` spec file to use the single `platform` field. This satisfies AC-011 and AC-012. This must come after Task 4 (which defines the new parsing) and is required before the integration test in `loadScripts.test.ts` can pass with real files on disk.

Renames:
- `scripts/linux/ubuntu-24.04/` → `scripts/linux/ubuntu-24.04-x64/`
- `scripts/mac/macos-sequoia/` → `scripts/mac/macos-sequoia-arm64/` (or confirm correct combined target per actual arch)
- `scripts/windows/windows-11/` → `scripts/windows/windows-11-x64/`

Frontmatter updates (from three separate fields to one):
- `scripts/linux/ubuntu-24.04-x64/install-curl.md`: remove `os: ubuntu-24.04` and `arch: x64` (if present), set `platform: ubuntu-24.04-x64`
- `scripts/mac/macos-sequoia-arm64/install-homebrew.md`: set `platform: macos-sequoia-arm64`
- `scripts/windows/windows-11-x64/setup-winget.md`: set `platform: windows-11-x64`

**TDD Approach:**
- **RED:** The integration test in `lib/loadScripts.test.ts` (which calls `loadScripts()` against real files) will fail after Task 4 lands if the real files still have old frontmatter (`platform: linux`, `os: ubuntu-24.04`, etc.) — the new parser requires a combined `platform` field and no `os` field
- **GREEN:** Rename directories and update frontmatter in all three spec files; verify the integration test now passes and each loaded script has the correct combined `platform` string
- Cover: integration test loads 3 scripts; each has `platform` matching the combined target string; no `os` or `arch` field present on loaded scripts; `id` reflects new directory path

---

## Task 6 — Update ScriptsBrowser to single-tier target filter

**Status:** completed

**Description:**
Update `20_Applications/scriptor-web/app/scripts/ScriptsBrowser.tsx` to replace the two-tier platform → OS sequential filter with a single flat target filter. Filter state changes from `(platform, os)` to a single `target: string | null`. Available filter options are derived from `scripts.map(s => s.platform)` via `useMemo` — no hardcoded list. Each option is labelled via `formatTarget`. Remove the import of `lib/platforms.ts`. Satisfies UC-001, AC-001, AC-002, AC-003, AC-004, AC-005.

- Replace `useState<Platform | null>` + `useState<string | null>` with single `const [target, setTarget] = useState<string | null>(null)`
- Derive `presentTargets`: `useMemo(() => [...new Set(scripts.map(s => s.platform))].sort(), [scripts])`
- Filter logic: `const filtered = target ? scripts.filter(s => s.platform === target) : scripts`
- Toggle behavior: clicking active target sets `target` to `null`; clicking different target sets it
- Render one row of `FilterButton` components (one per entry in `presentTargets`); label each via `formatTarget(t)`
- Remove two-tier platform row + conditional OS row — replace with one flat row
- Remove import of `lib/platforms.ts` (file will be deleted in Task 7)
- Update `20_Applications/scriptor-web/app/scripts/ScriptsBrowser.test.tsx`: remove all platform/OS two-tier tests; update all `Script` fixtures to use `platform: string` (combined target); add tests: renders one filter button per distinct `platform`; clicking target shows only matching scripts; clicking active target again shows all scripts; no filter selected shows all scripts

**TDD Approach:**
- **RED:** Update `ScriptsBrowser.test.tsx` to use new `Script` fixture shape and new single-tier filter assertions — tests fail because the component still uses two-tier state
- **GREEN:** Rewrite `ScriptsBrowser.tsx` with single `target` state, `presentTargets` derivation, and flat filter row using `formatTarget` labels
- Cover: filter buttons derived from script data; selecting a target narrows the list; deselecting restores all; unfiltered shows all; `formatTarget` label used on buttons

---

## Task 7 — Delete lib/platforms.ts

**Status:** completed

**Description:**
Delete `20_Applications/scriptor-web/lib/platforms.ts` and its test file `20_Applications/scriptor-web/lib/platforms.test.ts`. These files are no longer needed after Task 6 removes the last consumer (`ScriptsBrowser.tsx`). Deleting dead code prevents confusion about what the "canonical" platform vocabulary is. Satisfies the file change summary in TechRequirements.md.

- Delete `20_Applications/scriptor-web/lib/platforms.ts`
- Delete `20_Applications/scriptor-web/lib/platforms.test.ts`
- Verify no remaining imports of `lib/platforms` exist in any file
- `bun run typecheck`, `bun run lint`, and `bun run test:unit` must all exit 0 after deletion

**TDD Approach:**
- **RED:** Confirm that after deletion, `bun run typecheck` catches any remaining import of `lib/platforms` that was not already removed in Task 6 (RED is: typecheck fails if any stale import remains)
- **GREEN:** Delete both files and fix any residual imports; verify all checks pass
- Cover: no import of `lib/platforms` anywhere in the codebase; `bun run test:unit` test count decreases by the number of tests previously in `platforms.test.ts`; all remaining tests still pass

---

## Task 8 — Update script detail page to single target tag

**Status:** completed

**Description:**
Update `20_Applications/scriptor-web/app/scripts/[...slug]/page.tsx` to render a single target tag using `formatTarget(script.platform)` in place of the existing separate `platform`, `os`, and optional `arch` metadata tags. The run command section and `CopyButton` remain unchanged. Satisfies UC-003, AC-008, AC-010.

- In `app/scripts/[...slug]/page.tsx`: remove the `platform`, `os`, and `arch` tag elements; replace with `<span className={styles.targetTag}>{formatTarget(script.platform)}</span>`
- Add import for `formatTarget` from `@/lib/formatTarget`
- Update `app/scripts/[...slug]/detail-page.module.css`: add `.targetTag` class using `var(--muted)` background, `var(--muted-foreground)` color, `var(--radius-md)` border-radius, and gap tokens for padding
- Update `20_Applications/scriptor-web/app/scripts/[...slug]/page.test.tsx`: update all `Script` fixtures to remove `os`/`arch` and use `platform: "ubuntu-24.04-x64"` (combined); assert target tag renders `formatTarget(script.platform)`; assert run command is displayed; assert `CopyButton` is present

**TDD Approach:**
- **RED:** Update `page.test.tsx` fixtures to use the new `Script` shape and assert `screen.getByText("Ubuntu 24.04 X64")` (via `formatTarget`) — this fails because the old page still renders `platform`/`os`/`arch` separately
- **GREEN:** Update the page component to render single target tag using `formatTarget`; update CSS module to add `.targetTag`; fix all test assertions
- Cover: target tag displays `formatTarget(script.platform)`; no separate `os` or `arch` tag rendered; `runCommand` displayed; `CopyButton` present; `notFound()` called for missing slug

---

## Task 9 — Build homepage hero section

**Status:** completed

**Description:**
Replace the current stub in `20_Applications/scriptor-web/app/page.tsx` (`<h1>Scriptor</h1>` + `<Button>Get Started</Button>`) with a full hero section. The hero must include a description paragraph and a prominent `<Link href="/scripts">` call-to-action. It must not reference a CLI/TUI install command. Satisfies UC-002, AC-006, AC-007.

Required content:
- `<h1>Scriptor</h1>` (retained)
- `<p>A curated library of setup scripts for configuring machines. Browse scripts by target, read what each one does, and run it with a single command.</p>`
- `<Link href="/scripts">Browse Scripts</Link>` (or button-styled link) — uses Next.js `<Link>` component
- No reference to CLI install, TUI, or `bun install`

Styling: implement directly in `app/page.tsx` + `app/page.module.css` (extract to `components/Hero.tsx` only if complexity warrants it). Use CSS custom property tokens throughout — no hardcoded values.

- Update `20_Applications/scriptor-web/app/page.tsx` with the hero section
- Create or update `20_Applications/scriptor-web/app/page.module.css` with `.hero`, `.description`, and `.cta` classes using design tokens
- Update `20_Applications/scriptor-web/app/page.test.tsx`: replace the old "renders a button element" test with assertions for hero description text, browse link href, and absence of CLI/install references

**TDD Approach:**
- **RED:** Update `page.test.tsx` to assert: description paragraph is present; a link to `/scripts` exists; no text matching `/install/i` or `/cli/i` appears in the hero — these fail against the current stub
- **GREEN:** Build the hero section in `page.tsx`; add `page.module.css` with hero layout styles using `var(--gap-lg)`, `var(--font-mono)`, etc.
- Cover: description text rendered; `<Link href="/scripts">` present; no CLI/TUI install text (AC-006 guard); page renders without throwing

---

## Task 10 — Full pre-commit verification pass

**Status:** completed

**Description:**
Run the complete pre-commit checklist and fix any issues that surface. This is the integration gate confirming all twelve acceptance criteria (AC-001 through AC-012) are satisfied simultaneously. Not a feature task — a verification and remediation task. References all ACs.

- `bun run build` — exits 0; `out/` produced with updated browse page, detail pages, and homepage
- `bun run typecheck` — exits 0 across all workspaces
- `bun run lint` — exits 0, no errors or warnings
- `bun run format` — apply any corrections; re-run lint to confirm clean
- `bun run test:unit` — all unit tests pass (`formatTarget`, `loadScripts`, `ScriptsBrowser`, detail page, homepage)
- `bun run test:e2e` — all Playwright tests pass (update E2E assertions as needed to match the new single-tier filter and target labels)
- Manually confirm: (AC-001) browse page shows one flat row of target filter buttons; (AC-006) homepage hero shows description and browse CTA with no CLI references; (AC-008) detail page shows run command with copy button and single target tag

**TDD Approach:**
- **RED:** Run the full checklist before all prior tasks are complete — at least one check fails
- **GREEN:** Work through each failure; fix lint/type/test issues; re-run until all checks are clean
- Cover: `bun run build` exit 0; `bun run typecheck` exit 0; `bun run lint` exit 0; `bun run test:unit` exit 0 with all tests passing; `bun run test:e2e` exit 0 with all Playwright tests passing
