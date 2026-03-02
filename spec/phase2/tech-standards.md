# Phase 2 Tech Standards

_Living document. Updated via Q&A elicitation. Last updated: 2026-03-02._

---

## Runtime & Language

| Concern | Decision |
|---|---|
| Language | TypeScript (strict mode) — inherited from Phase 1 |
| Runtime / Package Manager | Bun — inherited from Phase 1 |
| Framework | Next.js (latest stable) — static export mode (`output: 'export'`) |

> **Rule:** All Phase 1 Bun conventions apply. Use `bun` / `bunx` / `bun install` / `bun run` / `bun test`. Do not use `node`, `npm`, `yarn`, or `npx`.

---

## Project Structure

- The website is a **separate Bun/Next.js project** in a new top-level `web/` directory at the repository root — peer to `source/` (the CLI).
- `scriptor.yaml` lives at the **repository root** (`/scriptor.yaml`). The website reads it via the filesystem at build time (e.g. `Bun.file('../scriptor.yaml')`).
- YAML parsing at build time uses **js-yaml** (already a project dependency).

```
/ (repo root)
├── scriptor.yaml          ← scripts manifest (read by web/ at build time)
├── source/                ← Phase 1 CLI project
└── web/                   ← Phase 2 Next.js website project
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── app/
    │   ├── page.tsx       ← / (homepage)
    │   ├── scripts/
    │   │   ├── [platform]/
    │   │   │   └── page.tsx   ← /scripts/windows|linux|mac
    │   │   └── [id]/
    │   │       └── page.tsx   ← /scripts/[id]
    └── playwright/
        └── *.spec.ts
```

---

## Key Libraries & Frameworks

| Library | Version | Purpose |
|---|---|---|
| `next` | latest stable | Static site framework |
| `react` / `react-dom` | latest stable (React 19) | UI rendering |
| `tailwindcss` | latest stable | Utility-first CSS |
| `react-markdown` | latest stable | Render `spec` field as markdown |
| `rehype-highlight` | latest stable | Syntax highlighting for code blocks in markdown |
| `highlight.js` | latest stable | Highlight.js core (peer dep of rehype-highlight) |
| `js-yaml` | ^4 (inherited) | Parse `scriptor.yaml` at build time |
| `@playwright/test` | latest stable | E2E testing |

No UI component library — all components are custom, built with Tailwind utilities.

---

## Tooling

| Concern | Tool |
|---|---|
| Build | `bun run build` → `next build` (produces `out/` via static export) |
| Dev server | `bun run dev` → `next dev` |
| Lint / Format | Biome (inherited from Phase 1; same config conventions) |
| Testing | Playwright E2E (`bun run test:e2e` → `playwright test`) |
| Package manager | `bun install` |

---

## Next.js Configuration

- **`output: 'export'`** — fully static, no Node.js server at runtime.
- **`basePath: '/Scriptor'`** — required for GitHub Pages deployment under `beolson.github.io/Scriptor`.
- **`images.unoptimized: true`** — required for static export (no Next.js image optimization server).
- **`trailingSlash: true`** — recommended for GitHub Pages compatibility.

---

## Styling

- **Tailwind CSS** — utility-first, no runtime overhead.
- No UI component library. All interactive elements (copy button, nav cards, badges) are custom Tailwind components.
- Site must be **responsive** (usable on mobile and desktop).
- The install command block is styled as a clearly distinct copyable code element.

---

## Markdown Rendering

- **`react-markdown`** renders the `spec` field string on script detail pages.
- **`rehype-highlight`** plugin provides syntax highlighting for fenced code blocks.
- A **highlight.js theme CSS** is imported globally (e.g. `github` or `github-dark`).
- No MDX — spec fields are plain markdown strings from YAML, not JSX.

---

## Build-Time Data

- All script data is loaded from `scriptor.yaml` at **`next build` time** — no runtime API calls.
- Pages are rebuilt whenever `scriptor.yaml` changes (triggered via GitHub Actions).
- Static params for `/scripts/[id]` are generated via `generateStaticParams()` reading the parsed YAML.

---

## Client-Side OS Detection

- The install command on the homepage detects OS **client-side** via `navigator.userAgent` or `navigator.platform`.
- Default (SSR/prerender): show the non-Windows (Bash) command; swap to PowerShell command after hydration if Windows is detected.
- Logic lives in a client component (`'use client'`).

---

## APIs & External Services

| Service | Purpose |
|---|---|
| GitHub Pages (`beolson.github.io/Scriptor`) | Static site hosting |
| GitHub Actions | CI/CD build and deploy pipeline |
| GitHub Releases | Source of install command binary URLs (baked in as constants, not fetched at runtime) |

No server-side API calls at request time. All external data is baked in at build time.

---

## CI/CD

- **GitHub Actions** deploys the site on every push to `main` (and on any change to `scriptor.yaml`).
- Build step: `bun install && bun run build` inside `web/` → produces `web/out/`.
- Deploy step: upload `web/out/` to GitHub Pages using `actions/upload-pages-artifact` + `actions/deploy-pages`.
- Biome check runs in CI and fails the build on violations.
- Playwright E2E tests run in CI against the built static output (served locally during test run).

---

## Testing

- **Playwright E2E** — browser-level tests for key user flows:
  - Copy button on the install command block
  - Platform detection (Windows vs. non-Windows command displayed)
  - Platform navigation cards link to correct listing pages
  - Script listing pages display correct scripts per platform
  - Script detail page renders name, description, spec markdown, arch badge, dependencies
- Playwright tests live in `web/playwright/`.
- Tests run via `bun run test:e2e` (mapped to `playwright test`).

---

## Constraints & Non-Goals

- **Fully static** — no server-side rendering at request time.
- No user authentication, search/filtering, or dynamic API calls at runtime.
- No custom domain (uses default GitHub Pages URL).
- No component library dependency.

---

## Open Questions

_(none)_
