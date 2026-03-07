# Phase 4 Tech Standards

_Living document. Updated via Q&A elicitation._

---

## Runtime & Language

| Concern | Decision |
|---|---|
| Language | TypeScript (strict mode) — inherited from Phase 1 |
| TUI Runtime / Package Manager | Bun — inherited from Phase 1 |
| Root (Monorepo) Package Manager | Bun workspaces |
| Web Runtime | Node.js (Next.js 16) |

> **Rule:** Bun is the package manager for the entire monorepo root and the `tui/` package. `bun install` at the root installs all workspace packages. The `web/` package is served by Next.js (Node) but installed via Bun.

---

## Key Libraries & Frameworks

| Library | Purpose |
|---|---|
| `turbo` | Monorepo task orchestration (Turborepo) — installed as root devDependency |
| `ink` | TUI rendering — inherited |
| `next` (v16) | Web framework — inherited |
| `tailwindcss` | Web styling — inherited |
| `playwright` | Web e2e tests — inherited |
| `@changesets/cli` | Versioning and changelog — moved to monorepo root |

---

## Tooling

| Concern | Tool |
|---|---|
| Monorepo orchestration | Turborepo (`turbo`) |
| TUI build | `bun build --compile` |
| TUI test | `bun test` |
| Web build | `next build` |
| Web e2e test | Playwright (`playwright test`) |
| Lint / Format | Biome (root baseline + per-project overrides) |
| Package manager | `bun install` (root and all packages) |

---

## Monorepo Structure

- Root `package.json` — workspace manifest with `workspaces: ["tui", "web"]`
- `turbo.json` — Turborepo pipeline definitions
- `biome.json` — shared lint/format baseline
- `tui/` — renamed from `source/`; retains all existing functionality
- `web/` — Next.js web project; unchanged beyond script name alignment
- `.changeset/` — moved from `tui/` to monorepo root

---

## Package Scripts (Both Projects)

Both `tui/` and `web/` expose: `dev`, `build`, `lint`, `format`, `typecheck`.

| Script | tui | web |
|---|---|---|
| `dev` | `bun run src/index.ts` | `next dev` |
| `build` | `bun build --compile` | `next build` |
| `lint` | `biome check .` | `biome check .` |
| `format` | `biome format --write .` | `biome format --write .` |
| `typecheck` | `tsc --noEmit` | `tsc --noEmit` |
| `test` | `bun test` (tui only) | — |
| `test:e2e` | — | `playwright test` (web only) |

Root aggregate scripts (via Turborepo):
- `test:unit` — runs unit tests across all packages (currently: `tui`)
- `test:e2e` — runs e2e tests across all packages (currently: `web`)

---

## CI Pipeline

- Trigger: push to `main` and all pull requests
- Orchestration: Turborepo (`turbo run build lint typecheck test:unit`)
- E2e tests run separately: `turbo run test:e2e` after the static site is built (requires build to complete first — `test:e2e` depends on `build` in `turbo.json`)
- `turbo.json` defines pipeline tasks: `build`, `lint`, `format`, `typecheck`, `test:unit`, `test:e2e`; `test:e2e` has `dependsOn: ["build"]`
- Setup: `oven-sh/setup-bun@v2` at root; Bun installs all workspace deps

---

## Release Pipeline

- Trigger: `push: tags: ['v*']` — fires on any `v*` tag push
- Main-branch check: first step in the job fetches `origin/main` (with `fetch-depth: 0`) then runs `git merge-base --is-ancestor HEAD origin/main` (or `git branch -r --contains HEAD | grep -q origin/main`); workflow exits early if the tag is not on main
- Note: combining `branches` and `tags` in a single `on.push` gives OR semantics, not AND — the in-job bash check is required
- Steps: build TUI cross-platform binaries → upload as GitHub Release assets → build web artifact → run Playwright e2e tests against artifact → deploy web to GitHub Pages
- Playwright e2e tests are re-run in release (same pattern as existing `deploy-web.yml`: download artifact, extract, run `bun run test:e2e`); lint/typecheck are not re-run
- Note: FR-4-054 says no tests in release, but the user has explicitly chosen to re-run e2e as a gate before deployment
- `deploy-web.yml` is removed; web deployment consolidated here
- Web deployment uses the same actions as the existing `deploy-web.yml`: `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`; output path: `web/out`
- `NEXT_PUBLIC_VERSION` injected from the git tag at web build time; fallback: `dev`

---

## APIs & External Services

| Service | Purpose |
|---|---|
| GitHub Pages | Web deployment (release only, not every push to main) |
| GitHub Releases | TUI binary distribution |

---

## Constraints & Non-Goals

- Bun is the package manager for the entire monorepo (root + tui); web installed via Bun but run by Next.js/Node.
- No new packages added beyond what Turborepo setup requires.
- No lint rules, TypeScript strictness, or behavioral changes.
- Web deployed only on versioned releases (not on every push to `main`).

---

## Open Questions

- (none yet)
