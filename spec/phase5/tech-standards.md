# Phase 5 Tech Standards

_Living document. Updated via Q&A elicitation._

---

## Runtime & Language

| Concern | Decision |
|---|---|
| Language | TypeScript (strict mode) — inherited |
| TUI Runtime / Package Manager | Bun — inherited |
| Root (Monorepo) Package Manager | Bun workspaces — inherited |
| Web Runtime | Node.js (Next.js 16) — inherited |

---

## Key Libraries & Frameworks

| Library | Purpose |
|---|---|
| `next` (v16) | Web framework — inherited |
| `tailwindcss` (v4) | Web styling — inherited |
| `react-markdown` | Render spec markdown — inherited |
| `rehype-highlight` | Syntax highlighting in markdown — inherited |
| `highlight.js` | Syntax highlighting core — inherited |
| `js-yaml` | Parse `scriptor.yaml` — inherited |

---

## Tooling

Inherited from Phase 4 — no changes.

---

## Build-Time Data

- Script source code and spec markdown files are read from the **local filesystem** at `next build` time, consistent with how `scriptor.yaml` is already loaded.
- No GitHub API calls during build. The full repo is checked out in CI, so all files are available locally.
- For each script entry in `scriptor.yaml`, the build reads:
  - The script file (e.g. `../scripts/install-bun.sh`) for source code display
  - The adjacent spec file (e.g. `../scripts/install-bun.sh.spec.md`) if it exists, for the spec section

---

## APIs & External Services

Inherited from Phase 4 — no new services.

---

## Constraints & Non-Goals

- Site remains fully static (Next.js static export).
- Dark mode handled entirely client-side.
- Existing light-mode design tokens unchanged; dark mode is additive.
- TUI unaffected — all changes are web-only.

---

## Dark Mode Implementation

- **Toggle mechanism:** `data-theme` attribute on `<html>` element. Values: `"light"` (default) and `"dark"`.
- **CSS approach:** Dark mode colors defined by overriding CSS custom properties under `[data-theme="dark"]` selector in `globals.css`. Existing light-mode tokens in `:root` are unchanged.
- **Flash prevention:** An inline `<script>` in `<head>` (before any CSS or body content) reads `localStorage` for a persisted theme preference. If none exists, it checks `prefers-color-scheme`. It sets the `data-theme` attribute before first paint.
- **Toggle component:** A client component (`'use client'`) in the site header that reads/writes `localStorage` and updates the `data-theme` attribute on `document.documentElement`.
- **Styling approach:** Continues using CSS Modules with CSS custom properties. No migration to Tailwind utility classes.

---

## Syntax Highlighting (Dark Mode)

- **Dual-scoped CSS:** Both `highlight.js/styles/github.css` (light) and `highlight.js/styles/github-dark.css` (dark) are imported.
- Each theme's selectors are scoped under `[data-theme="light"]` and `[data-theme="dark"]` respectively, so the active theme matches the current mode.
- No dynamic CSS loading — both themes are statically bundled.

---

## Script Source Code Viewer

- **Rendering:** Use `highlight.js` directly — call `hljs.highlight(code, { language })` at build time in the server component.
- **Language detection:** Determine the highlight language from the script file extension (`.sh` → `bash`, `.ps1` → `powershell`, `.zsh` → `zsh`).
- **Output:** Rendered as a `<pre><code>` block with highlight.js CSS classes. No react-markdown involved.
- **Collapsible:** The section is collapsed by default (FR-5-020), implemented as a client component with `details`/`summary` or a toggle state.

---

## Inputs Data Model (Web)

- **Type:** A single flat `Input` interface with optional fields for plugin-specific properties:
  ```typescript
  interface Input {
    id: string;
    type: string;
    label: string;
    required?: boolean;
    default?: string | number;
    download_path?: string;
    format?: string;
  }
  ```
- New plugin-specific fields are added as optional properties.
- The `Script` type gains an optional `inputs?: Input[]` field.
- `loadScripts` is updated to parse the `inputs` array from `scriptor.yaml`.

---

## Architecture Patterns

- **Spec file migration:** `loadScripts` is updated to: (1) no longer read the `spec` field from YAML, (2) for each script entry, check for a `.spec.md` file adjacent to the script path and read it if present, (3) read the script source file for display on the detail page.
- **No new dependencies:** All Phase 5 features are implemented using existing packages (highlight.js, react-markdown, js-yaml, node:fs).
- **Client components:** The theme toggle and collapsible script viewer require client-side interactivity (`'use client'`). All other changes are server-rendered.

---

## Open Questions

_(none)_
