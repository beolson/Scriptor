# Scriptor Web — Product Requirements Document

| Field | Value |
|-------|-------|
| Product | Scriptor Web |
| Version | 0.1.0 |
| Status | As-built |
| Date | 2026-03-28 |
| Audience | Developers (internal teams and open-source community) |

---

## 1. Overview

Scriptor Web is a static documentation and catalog site for the Scriptor CLI tool. It provides a browsable, filterable directory of host-specific setup scripts organized by platform (Windows, Linux, macOS). Users discover scripts, read their specifications and source code, and get OS-detected install commands to set up the CLI. All script execution happens through the CLI — the web app is read-only.

The site is built with Next.js using static export (`output: "export"`), producing plain HTML/CSS/JS deployable to any CDN or static host (currently GitHub Pages). Script data is sourced from `scriptor.yaml` at the repository root and baked into pages at build time. There are no runtime API calls or server-side logic.

---

## 2. User Flows

### Home → Platform → Script Detail

1. **Home page** (`/`): The user lands on a terminal-styled hero with an auto-detected install command (Windows PowerShell or Unix curl) and three platform cards linking to Windows, Linux, and macOS script catalogs.

2. **Platform listing** (`/scripts/linux`, `/scripts/windows`, `/scripts/mac`): All scripts for the selected platform are displayed in a filterable list. Filter tabs allow narrowing by architecture (x86/arm), and on Linux by distribution and version. Linux scripts are grouped under distro headers. A platform-specific install command is shown at the top.

3. **Script detail** (`/scripts/[id]`): A two-column layout shows:
   - **Main column**: collapsible markdown specification (rendered via react-markdown) and collapsible syntax-highlighted script source (via highlight.js).
   - **Sidebar**: metadata card (platform, architecture, distro, version), dependencies list, and inputs panel (label, type, required/optional, default value, download path, format).

Breadcrumb navigation on listing and detail pages provides back-navigation. A 404 page handles unknown routes.

---

## 3. Data Model

All data originates from `scriptor.yaml`, a YAML array of script entries read at build time.

### Script

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier (kebab-case) |
| `name` | string | yes | Display name |
| `description` | string | yes | Short description shown in listings |
| `platform` | `windows` \| `linux` \| `mac` | yes | Target operating system |
| `arch` | `x86` \| `arm` | yes | Target CPU architecture |
| `script` | string | yes | Relative path to the script file |
| `distro` | string | no | Linux distribution name (e.g., `Debian GNU/Linux`) |
| `version` | string | no | Distribution version (e.g., `13`) |
| `dependencies` | string[] | no | IDs of scripts that must run first |
| `inputs` | Input[] | no | Parameters the script accepts |
| `spec` | string | — | Populated at build time from `{script}.spec.md` if the file exists |
| `scriptSource` | string | — | Populated at build time by reading the script file contents |

### Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier for the input |
| `type` | string | yes | Input type (e.g., `string`, `number`, `ssl-cert`) |
| `label` | string | yes | Human-readable label |
| `required` | boolean | no | Whether the input is mandatory |
| `default` | string | no | Default value |
| `download_path` | string | no | Filesystem path for downloaded files |
| `format` | string | no | Expected format (e.g., `PEM`) |

### Build-Time Loading

`lib/loadScripts.ts` parses the YAML, reads spec and script source files from disk, validates required fields, and caches the result. Helper functions `getScriptsByPlatform()` and `getScriptById()` filter the loaded data for page generation. Invalid platforms default to `linux`; invalid architectures default to `x86`. Malformed input entries are silently skipped.

---

## 4. Features

### Script Filtering

Platform listing pages provide up to three filter dimensions, each rendered as a tab bar:

- **Architecture**: x86 / arm (shown when both exist for the platform)
- **Distribution**: Linux only; dynamically computed from available scripts
- **Version**: context-aware; resets when the distro filter changes and the current selection is no longer valid

Filters use client-side state (`useState` + `useMemo`). The filtered count is displayed below the filters.

### Install Commands

The home page detects the visitor's OS at runtime (`navigator.userAgent`) and displays the appropriate install command:

- **Windows**: `iwr {origin}/install-win | iex`
- **Unix**: `curl -fsSL {origin}/install | bash`

Platform listing pages show a static install command for their platform. All install commands use the `CodeBlock` component with a copy-to-clipboard button that shows `[copy]` → `[copied]` feedback for 2 seconds.

### Script & Spec Viewing

- **SpecViewer**: Renders `.spec.md` markdown content using react-markdown with rehype-highlight for code blocks. Collapsible, collapsed by default.
- **ScriptViewer**: Syntax-highlights script source using highlight.js. Language auto-detected from file extension (`.sh` → bash, `.ps1` → powershell, `.py` → python, etc.). Collapsible, collapsed by default. Returns null when no source is available.

### Theme Support

Dark and light themes controlled by a `data-theme` attribute on `<html>`. An inline script in the layout reads `localStorage` (falling back to `prefers-color-scheme`) and sets the attribute before first paint to prevent flash. The `ThemeToggle` component in the navbar persists the preference and swaps sun/moon icons.

### Version Badge

The footer displays the application version from the `NEXT_PUBLIC_VERSION` environment variable, falling back to `dev`.

---

## 5. Design System

The site uses a terminal-inspired aesthetic built on two monospace font families:

- **JetBrains Mono** — headings, navigation, code display
- **IBM Plex Mono** — body text, labels, captions

### Design Tokens (CSS custom properties in `globals.css`)

| Category | Examples |
|----------|----------|
| Colors (light) | bg `#ffffff`, surface `#f9fafb`, text `#111111`, accent `#059669` |
| Colors (dark) | bg `#121212`, surface `#111411`, text `#d4e8d4`, accent `#33ff33` |
| Typography | hero 48px, h1 28px, body 14px, caption 12px, code 13px |
| Spacing | xs 6px, sm 8px, md 12px, lg 16px, xl 24px, 2xl 32px, 3xl 48px |
| Page margins | 120px desktop, 24px mobile |

All styling uses CSS Modules scoped to each component, referencing design tokens via `var(--token-name)`. No Tailwind utility classes appear in JSX. The responsive breakpoint is 768px.

Syntax highlighting themes (GitHub Light / GitHub Dark) are scoped to `[data-theme]` selectors in `hljs-themes.css`.

---

## 6. Deployment

- **Build**: `next build` produces a static export in the `out/` directory
- **Hosting**: GitHub Pages (or any static CDN)
- **CI**: GitHub Actions runs build → lint + typecheck + unit tests → E2E on every push
- **Release**: Changesets workflow deploys the static site on merge to `main`
- **Install scripts**: `public/install` (bash) and `public/install-win` (PowerShell) download the latest CLI binary from GitHub Releases

---

## 7. Future Work

The following are not currently implemented but are candidates for future development:

| Item | Notes |
|------|-------|
| **Script grouping** | `group` field exists in `scriptor.yaml` but is not surfaced in the web UI. Could enable category-based browsing. |
| **Elevation indicator** | `requires_elevation` / `requires_sudo` field exists in the manifest but is not displayed. Could warn users that a script needs admin privileges. |
| **Search** | No text search across script names, descriptions, or specs. Would improve discoverability as the catalog grows. |
