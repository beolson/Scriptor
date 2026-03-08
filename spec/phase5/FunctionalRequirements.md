# Phase 5 Functional Requirements

## Summary

Phase 5 focuses on cleaning up and enhancing the Scriptor marketing website. The work covers six areas:

1. **Dark mode** — Add dark mode support using system preferences for automatic detection, plus a manual toggle in the upper-right corner of the site.
2. **Homepage copy cleanup** — Remove the "// cross-platform script management" tagline, the "Install, manage, and run scripts across Windows, Linux, and macOS with a single command." line, and the "// manage your scripts" text from the footer.
3. **Script detail page: script viewer** — Below the spec section on the script detail page, add a section that displays the actual script source code.
4. **Script detail page: inputs panel** — On the right side of the script detail page, add a box showing the script's declared inputs.
5. **Spec file migration** — Move the `spec` field out of `scriptor.yaml` and into a standalone markdown file adjacent to the script file (e.g. `install-bun.sh.spec.md`).

## User Stories

- As a visitor who prefers dark mode, I want the site to automatically match my system theme so I don't get blinded by a bright page.
- As a visitor, I want to manually toggle between light and dark mode and have my choice remembered.
- As a developer reviewing a script, I want to see the actual source code on the detail page so I can understand what it does before installing.
- As a developer reviewing a script, I want to see what inputs a script expects so I know what I'll be prompted for in the TUI.
- As a script author, I want to write spec documentation in a standalone markdown file rather than inline YAML so it's easier to maintain.

## Functional Requirements

### Dark Mode

- FR-5-010: The website supports a dark color scheme in addition to the existing light scheme.
- FR-5-011: On first visit, the theme is determined by the user's system preference (`prefers-color-scheme` media query).
- FR-5-012: A manual theme toggle is displayed in the upper-right corner of the site header.
- FR-5-013: When the user manually toggles the theme, the preference is persisted in `localStorage` and takes precedence over system settings on subsequent visits.
- FR-5-014: The toggle must avoid a flash of incorrect theme on page load (i.e. the persisted preference should be applied before first paint).
- FR-5-015: The dark mode color scheme is inspired by a retro green-screen terminal aesthetic (e.g. dark/black backgrounds with green-tinted text, accents, and UI elements).
- FR-5-016: The theme toggle uses standard sun/moon icons (sun for light mode, moon for dark mode).

### Spec File Migration

- FR-5-001: The `spec` field is removed from the `scriptor.yaml` schema entirely.
- FR-5-002: Spec content is stored in a standalone markdown file named `<script-filename>.spec.md`, placed adjacent to the script file in the repository (e.g. `scripts/install-bun.sh` → `scripts/install-bun.sh.spec.md`).
- FR-5-003: The website build process discovers spec files by convention: for each script entry, it looks for a `.spec.md` file next to the script path declared in `scriptor.yaml`. If no spec file exists, the spec section is omitted on the detail page.
- FR-5-004: Spec files are fetched from the GitHub repository at build time using the same API mechanism used for script files.
- FR-5-005: Script source code is also fetched at build time and baked into the static site for display on the detail page.

### Script Detail Page Enhancements

- FR-5-020: Below the spec section, a new "Script" section displays the full source code of the script in a syntax-highlighted, read-only code block (no copy button). The section is collapsible (collapsed by default) and uses internal scrolling when expanded for long scripts.
- FR-5-021: On the right side of the script detail page, an "Inputs" panel displays all declared inputs for the script.
- FR-5-022: Each input in the panel shows: label, type, required/optional badge, default value (if any), and plugin-specific fields (e.g. `download_path` and `format` for `ssl-cert` inputs).
- FR-5-023: If a script has no declared inputs, the inputs panel is either hidden or displays an empty-state message.
- FR-5-024: On narrow/mobile screens, the layout switches from two-column to single-column: the inputs panel stacks below the spec and script sections.

### Homepage & Footer Cleanup

- FR-5-030: Remove the "// cross-platform script management" tagline from the homepage.
- FR-5-031: Remove the "Install, manage, and run scripts across Windows, Linux, and macOS with a single command." line from the homepage.
- FR-5-032: Remove the "// manage your scripts" text from the site footer.

## Constraints

- The site remains fully static (Next.js static export). Dark mode is handled entirely client-side.
- The existing light-mode design and color tokens are unchanged; dark mode is additive.
- The TUI is not affected by this phase — all changes are web-only.

## Out of Scope

- Dark mode for the TUI application (web only).
- Script editing or authoring via the website.
- Search or filtering on the scripts listing pages.
- Download/copy functionality for the script source code viewer.
- Custom dark-mode color configuration by the user (only light vs. dark toggle).

## Open Questions

_(none — requirements sufficiently defined)_
