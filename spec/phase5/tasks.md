# Phase 5 — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Homepage & Footer Copy Cleanup

**Status:** done

**Description:**
Remove three hardcoded text strings from the homepage and footer. References FR-5-030, FR-5-031, FR-5-032.

- Remove the `"// cross-platform script management"` badge from the homepage hero section in `web/app/page.tsx`
- Remove the `"install, manage, and run scripts across windows, linux, and macos with a single command."` subheadline from the homepage hero section in `web/app/page.tsx`
- Remove the `"// manage your scripts"` text from the footer brand line in `web/app/components/Footer/Footer.tsx`

**TDD Approach:**
- **RED:** Write a failing test in `web/app/page.test.tsx` that asserts the homepage does not contain "cross-platform script management" or "install, manage, and run scripts" text. Write a failing test in `web/app/components/Footer/Footer.test.tsx` that asserts the footer does not contain "manage your scripts". Both tests fail against the current code.
- **GREEN:** Remove the three text strings from the source files to make the tests pass.
- Cover: homepage renders without the two removed strings, footer renders without the removed string, no layout breakage (page still renders hero section and footer), `bun run build` succeeds

---

## Task 2 — Spec File Migration

**Status:** done

**Description:**
Move spec content out of `scriptor.yaml` inline fields and into standalone `.spec.md` files adjacent to each script. Update `loadScripts` to read spec content from the filesystem instead of YAML, and also read script source code for display on the detail page. References FR-5-001, FR-5-002, FR-5-003, FR-5-004, FR-5-005.

- For each script entry in `scriptor.yaml` that has a `spec` field, extract the spec content into a new file named `<script-filename>.spec.md` adjacent to the script (e.g. `scripts/install-docker.sh` → `scripts/install-docker.sh.spec.md`)
- Remove the `spec` field from all entries in `scriptor.yaml`
- Update the `Script` type in `web/lib/types.ts` to add `scriptSource?: string` (the raw script file content for display)
- Update `loadScripts` in `web/lib/loadScripts.ts` to: (1) no longer read `spec` from YAML, (2) for each script entry, check for a `.spec.md` file next to the script path and read it if present, (3) read the script source file and populate `scriptSource`
- The detail page should continue rendering spec content identically — the data source changes but the UI does not

**TDD Approach:**
- **RED:** Write failing tests in `web/lib/loadScripts.test.ts` that assert: (1) `loadScripts` populates `spec` from a `.spec.md` file on disk rather than from the YAML `spec` field, (2) `loadScripts` populates `scriptSource` with the contents of the script file, (3) when no `.spec.md` file exists, `spec` is `undefined`, (4) the YAML `spec` field is ignored even if present
- **GREEN:** Update `loadScripts` to read `.spec.md` files and script source from the filesystem. Create the `.spec.md` files. Remove `spec` from `scriptor.yaml`.
- Cover: spec content loads from `.spec.md` files, script source code is populated, missing spec file results in `undefined`, detail page still renders spec markdown correctly, `bun run build` succeeds

---

## Task 3 — Input Data Model and Loading

**Status:** done

**Description:**
Add an `Input` interface and wire up parsing of the `inputs` array from `scriptor.yaml` so the web UI has access to input metadata. References FR-5-021, FR-5-022 (data layer).

- Add an `Input` interface to `web/lib/types.ts` with fields: `id`, `type`, `label`, `required?`, `default?`, `download_path?`, `format?`
- Add an optional `inputs?: Input[]` field to the `Script` type
- Update `loadScripts` in `web/lib/loadScripts.ts` to parse the `inputs` array from each script entry in `scriptor.yaml`
- Validate that input objects have at minimum `id`, `type`, and `label` fields; skip malformed entries

**TDD Approach:**
- **RED:** Write failing tests in `web/lib/loadScripts.test.ts` that assert: (1) a script with an `inputs` array in YAML produces `Script.inputs` with the correct `Input` objects, (2) each input has `id`, `type`, `label` populated, (3) optional fields (`required`, `default`, `download_path`, `format`) are preserved when present, (4) a script with no `inputs` key has `inputs` as `undefined`, (5) malformed input entries (missing `id`/`type`/`label`) are skipped
- **GREEN:** Add the `Input` interface, update the `Script` type, and update `loadScripts` to parse inputs.
- Cover: inputs parsing with all field types, missing inputs, malformed inputs, `bun run typecheck` passes, `bun run build` succeeds

---

## Task 4 — Dark Mode CSS Custom Properties

**Status:** done

**Description:**
Define the dark color scheme as CSS custom property overrides under `[data-theme="dark"]` in `globals.css`. The dark theme uses a retro green-screen terminal aesthetic. The existing light-mode `:root` tokens are unchanged. References FR-5-010, FR-5-015.

- Add a `[data-theme="dark"]` selector block in `web/app/globals.css` that overrides color custom properties: `--color-bg`, `--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-muted`, `--color-accent`, and any other color tokens used by existing components
- The dark palette should use dark/black backgrounds with green-tinted text and accents (retro terminal aesthetic)
- Ensure all existing component CSS modules already reference custom properties (they do based on the current codebase) so the override takes effect site-wide
- Add `[data-theme="light"]` selector that mirrors the existing `:root` values (needed for explicit light theme scoping of highlight.js in a later task)

**TDD Approach:**
- **RED:** Write a test in `web/app/globals.test.ts` (or equivalent) that reads `globals.css` and asserts: (1) a `[data-theme="dark"]` rule block exists, (2) it defines `--color-bg`, `--color-text-primary`, `--color-accent`, and `--color-surface` overrides, (3) a `[data-theme="light"]` rule block exists
- **GREEN:** Add the dark and light theme selector blocks to `globals.css`.
- Cover: dark theme variables are defined, light theme variables are explicitly scoped, existing `:root` values unchanged, `bun run build` succeeds, no visual regression in default (light) mode

---

## Task 5 — Dark Mode Toggle and Flash Prevention

**Status:** done

**Description:**
Add a theme toggle to the site header and an inline script to prevent flash of incorrect theme on page load. The toggle uses sun/moon icons and persists preference to `localStorage`. References FR-5-011, FR-5-012, FR-5-013, FR-5-014, FR-5-016.

- Create a `ThemeToggle` client component (`'use client'`) in `web/app/components/ThemeToggle/` that reads the current `data-theme` attribute, displays a sun icon (in light mode) or moon icon (in dark mode), and on click toggles the theme by updating `document.documentElement.dataset.theme` and writing to `localStorage`
- Add the `ThemeToggle` component to the `NavBar` component in the upper-right area
- Add an inline `<script>` in `web/app/layout.tsx` inside `<head>` (before CSS/body) that reads `localStorage` for a saved theme preference; if none exists, checks `prefers-color-scheme` media query; sets `data-theme` on `<html>` before first paint

**TDD Approach:**
- **RED:** Write failing tests in `web/app/components/ThemeToggle/ThemeToggle.test.tsx` that assert: (1) the toggle renders a button with an accessible label, (2) clicking the toggle switches `data-theme` on `document.documentElement`, (3) clicking the toggle writes the new preference to `localStorage`, (4) on mount, the toggle reads the current `data-theme` to display the correct icon
- **GREEN:** Create the `ThemeToggle` component, add it to `NavBar`, and add the inline head script.
- Cover: toggle switches theme, localStorage persistence, correct icon for each theme, flash prevention script sets `data-theme` before body renders, `bun run build` succeeds

---

## Task 6 — Syntax Highlighting Dual Theme

**Status:** done

**Description:**
Scope the highlight.js CSS themes so syntax highlighting matches the active light/dark theme. Both themes are statically bundled — no dynamic loading. References tech-standards (Syntax Highlighting section).

- Replace the single `import "highlight.js/styles/github.css"` in `web/app/layout.tsx` with imports of both `github.css` (light) and `github-dark.css` (dark)
- Create scoped CSS (e.g. `web/app/hljs-themes.css`) that wraps the light theme selectors under `[data-theme="light"]` and the dark theme selectors under `[data-theme="dark"]`, or use an equivalent approach with CSS layers/nesting
- Verify that code blocks in spec markdown render correctly in both themes

**TDD Approach:**
- **RED:** Write a test in `web/app/hljs-themes.test.ts` that asserts: (1) the layout no longer imports the unscoped `highlight.js/styles/github.css` directly, (2) both light and dark highlight.js theme styles are present and scoped under `[data-theme]` selectors
- **GREEN:** Create the dual-scoped CSS file, update the layout import, and verify syntax highlighting renders in both modes.
- Cover: light theme highlight.js styles active when `data-theme="light"`, dark theme styles active when `data-theme="dark"`, no unscoped highlight.js CSS leaking, `bun run build` succeeds, spec markdown code blocks render correctly

---

## Task 7 — Script Viewer Component

**Status:** done

**Description:**
Add a collapsible "Script" section below the spec section on the script detail page that displays the full script source code with syntax highlighting. References FR-5-020, FR-5-005.

- Create a `ScriptViewer` client component (`'use client'`) in `web/app/components/ScriptViewer/` that renders a collapsible section (collapsed by default) with a `<pre><code>` block containing syntax-highlighted source code
- Use `highlight.js` directly (call `hljs.highlight(code, { language })`) at build time in the server component or pass pre-highlighted HTML to the client component
- Determine the highlight language from the script file extension (`.sh` → `bash`, `.ps1` → `powershell`, `.zsh` → `zsh`)
- The section uses internal scrolling when expanded for long scripts (CSS `max-height` + `overflow-y: auto`)
- Integrate the component into `web/app/scripts/[id]/page.tsx` below the spec section, passing `scriptSource` from the `Script` data

**TDD Approach:**
- **RED:** Write failing tests in `web/app/components/ScriptViewer/ScriptViewer.test.tsx` that assert: (1) the component renders a collapsible section that is collapsed by default, (2) when expanded, the script source code is visible in a `<pre><code>` block, (3) the section title is "Script" or similar, (4) when `scriptSource` is empty/undefined, the section is not rendered
- **GREEN:** Create the `ScriptViewer` component, style it with CSS modules, and add it to the detail page.
- Cover: collapsed by default, expandable, syntax-highlighted output, internal scrolling for long scripts, hidden when no source code, `bun run build` succeeds

---

## Task 8 — Inputs Panel and Detail Page Layout

**Status:** done

**Description:**
Add an "Inputs" panel to the script detail page showing declared inputs, and restructure the detail page into a two-column layout (content left, inputs right) that collapses to single-column on mobile. References FR-5-021, FR-5-022, FR-5-023, FR-5-024.

- Create an `InputsPanel` component in `web/app/components/InputsPanel/` that displays a list of inputs, each showing: label, type, required/optional badge, default value (if any), and plugin-specific fields (`download_path`, `format`)
- If a script has no declared inputs, the panel displays an empty-state message (e.g. "No inputs required")
- Restructure `web/app/scripts/[id]/page.tsx` to use a two-column layout: left column contains the existing spec section and script viewer; right column contains the inputs panel
- On narrow/mobile screens (`@media` breakpoint), the layout switches to single-column with the inputs panel stacking below the spec and script sections
- Update `web/app/scripts/[id]/detail.module.css` with the two-column grid/flex layout and responsive breakpoint

**TDD Approach:**
- **RED:** Write failing tests in `web/app/components/InputsPanel/InputsPanel.test.tsx` that assert: (1) the panel renders each input's label, type, and required/optional badge, (2) default values are displayed when present, (3) plugin-specific fields (`download_path`, `format`) are displayed when present, (4) when no inputs are provided, an empty-state message is shown, (5) the panel has a heading (e.g. "Inputs")
- **GREEN:** Create the `InputsPanel` component, update the detail page layout to two columns, and add responsive CSS.
- Cover: all input fields rendered, required/optional badges, default values, plugin fields, empty state, two-column layout on desktop, single-column on mobile, `bun run build` succeeds
