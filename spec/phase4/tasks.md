# Phase 4 — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---

## Task 1 — Rename source/ to tui/

**Status:** not started

**Description:**
Rename the `source/` directory to `tui/` and update every internal reference so the TUI project retains full functionality without behavioral change. This is the blocking prerequisite for all other Phase 4 work. References FR-4-002, FR-4-004.

- Rename `source/` → `tui/` at the filesystem level.
- Update all paths that reference `source/` inside `tui/` itself: `package.json` scripts (e.g. build output paths), `tsconfig.json`, any relative import paths that encode the directory name.
- Update `.github/` workflow files that reference `source/` (CI paths, working-directory fields, artifact paths).
- Update any root-level config files or docs that reference `source/`.
- The `tui/` package name in `package.json` becomes `tui` (or remains as-is if already set); scripts are unchanged at this step.

**TDD Approach:**
- **RED:** Before renaming, confirm that `bun test` passes inside `source/` (baseline). Then rename the directory. At this point any workflow or script referencing `source/` will be broken — `bun test` from the repo root (or from `tui/`) will fail if any script encodes the old path.
- **GREEN:** Fix every reference to `source/` so that `bun test` runs cleanly from `tui/` and `bun run build` in `tui/` produces the expected output.
- Cover: `bun test` full suite passes in `tui/`; `bun run build` in `tui/` produces a binary; `bun run lint` in `tui/` passes; no string `source/` remains in any tracked file outside of generated output or lock files.

---

## Task 2 — Root Monorepo Scaffolding

**Status:** not started

**Description:**
Create the Turborepo monorepo root: root `package.json` (workspace manifest), `turbo.json` (pipeline definitions), and Bun workspaces configuration. After this task `bun install` at the repo root installs both `tui/` and `web/` dependencies, and `turbo run build` can orchestrate both packages. References FR-4-001, FR-4-003, FR-4-013, FR-4-014.

- Create root `package.json` with `"workspaces": ["tui", "web"]`, `"private": true`, and `turbo` as a root devDependency. Include root aggregate scripts: `test:unit` (via `turbo run test:unit`) and `test:e2e` (via `turbo run test:e2e`).
- Create `turbo.json` defining pipeline tasks: `build`, `lint`, `format`, `typecheck`, `test:unit`, `test:e2e`. Set `test:e2e` with `"dependsOn": ["build"]`. Mark `build` as producing outputs (e.g. `dist/**`, `.next/**`).
- Ensure `bun install` at the repo root resolves both workspaces cleanly (no duplicate `node_modules` conflicts between the packages).
- No packages are added to `tui/` or `web/` beyond `turbo` at the root.

**TDD Approach:**
- **RED:** Before creating any root config, run `bun install` at the repo root — it will fail (no root `package.json`). Run `turbo run build` — it will fail (no `turbo.json`, `turbo` not installed).
- **GREEN:** Create root `package.json` and `turbo.json`. Run `bun install` at root — exits 0. Run `turbo run build` — both packages build successfully.
- Cover: `bun install` exits 0 at the repo root; `turbo run build` completes for both `tui` and `web`; `turbo run lint` completes for both; root `test:unit` and `test:e2e` scripts are present in root `package.json`.

---

## Task 3 — Root Biome Config Consolidation

**Status:** not started

**Description:**
Establish a root-level `biome.json` as the shared lint/format baseline, and migrate each project's existing Biome configuration to extend or override it. No lint rules are loosened or tightened. References FR-4-020, FR-4-021, FR-4-022.

- Create `biome.json` at the repo root containing the shared rules currently common to both projects (formatter settings, linter rules that apply everywhere).
- Update `tui/biome.json` to `"extends": ["../../biome.json"]` (or the appropriate Biome `extends` syntax) and retain only `tui`-specific overrides, if any.
- Update `web/biome.json` similarly, retaining only `web`-specific overrides.
- Verify the effective rule set for each project is unchanged: no new warnings or errors should appear compared to the pre-migration baseline.

**TDD Approach:**
- **RED:** Before the migration, capture the current lint output for each project (`bun run lint` in `tui/` and `web/` — both should exit 0 and produce the same diagnostics as today). After extracting rules to root and pointing projects at it, `bun run lint` in each project must still exit 0 with no new errors.
- **GREEN:** Create root `biome.json` and update per-project configs so that `bun run lint` exits 0 in both `tui/` and `web/`.
- Cover: `bun run lint` exits 0 in `tui/`; `bun run lint` exits 0 in `web/`; `turbo run lint` exits 0 for both; no lint rules added or removed (confirm by diffing diagnostics before/after).

---

## Task 4 — tui/ Package Script Alignment & typecheck

**Status:** not started

**Description:**
Ensure `tui/package.json` exposes the full required script set and add the `typecheck` script. This task does not add new functionality — it only aligns script naming and adds the TypeScript type check command. References FR-4-010, FR-4-011, FR-4-012.

- Confirm or add the following scripts in `tui/package.json`: `dev`, `build`, `lint`, `format`, `typecheck`, `test`. Rename any script that uses a non-standard name (e.g. if `check` exists but `lint` does not, rename it to `lint`).
- Add `"typecheck": "tsc --noEmit"` if not present. Ensure `tui/tsconfig.json` is compatible with `--noEmit`.
- Ensure `typescript` is a devDependency of `tui/` (it likely already is).
- The `test` script runs `bun test` (FR-4-012). No test scripts are added or removed.

**TDD Approach:**
- **RED:** Run `bun run typecheck` in `tui/` — fails if the script doesn't exist yet. Run `turbo run typecheck` from root — fails because `tui` has no `typecheck` task for Turborepo to find.
- **GREEN:** Add `typecheck` script to `tui/package.json` and verify `bun run typecheck` exits 0 (no TypeScript errors).
- Cover: `bun run typecheck` exits 0 in `tui/`; `bun run lint` exits 0 in `tui/`; `bun run build` exits 0 in `tui/`; `bun test` full suite passes in `tui/`; all 5 required scripts are present in `tui/package.json`.

---

## Task 5 — web/ Package Script Alignment & typecheck

**Status:** not started

**Description:**
Ensure `web/package.json` exposes the full required script set and add the `typecheck` script. References FR-4-010, FR-4-011.

- Confirm or add the following scripts in `web/package.json`: `dev`, `build`, `lint`, `format`, `typecheck`. Rename any script that uses a non-standard name.
- Add `"typecheck": "tsc --noEmit"` if not present. Ensure `web/tsconfig.json` is compatible with `--noEmit` (Next.js projects typically already have a compatible tsconfig).
- The `test:e2e` script runs `playwright test` (FR-4-012). No test scripts are added or removed.
- After this task, `turbo run typecheck` exercises both packages end-to-end.

**TDD Approach:**
- **RED:** Run `bun run typecheck` in `web/` — fails if the script doesn't exist. Run `turbo run typecheck` from root — fails until both packages have the script.
- **GREEN:** Add `typecheck` script to `web/package.json` and verify `bun run typecheck` exits 0 (no TypeScript errors in the web project).
- Cover: `bun run typecheck` exits 0 in `web/`; `turbo run typecheck` exits 0 for both packages from root; `bun run build` exits 0 in `web/`; all 5 required scripts (`dev`, `build`, `lint`, `format`, `typecheck`) are present in `web/package.json`.

---

## Task 6 — Changeset Migration to Monorepo Root

**Status:** not started

**Description:**
Move the `.changeset/` directory and its configuration from `tui/` to the monorepo root, and add changeset scripts to the root `package.json`. References FR-4-030, FR-4-031.

- Move `tui/.changeset/` → `.changeset/` at the repo root. Update `.changeset/config.json` if it contains paths that referenced the old location (e.g. `baseBranch`, `changelog` paths).
- Add `@changesets/cli` as a root devDependency.
- Add `"changeset": "changeset"` and `"version": "changeset version"` scripts to the root `package.json`.
- Remove the old `changeset`/`version` scripts from `tui/package.json` if they existed there.
- Verify that `bun changeset status` runs from the repo root without error.

**TDD Approach:**
- **RED:** Before the move, confirm `bun changeset status` fails at the repo root (no `.changeset/` found). After installing `@changesets/cli` at root but before moving the directory, it will still fail to find the config.
- **GREEN:** Move `.changeset/` to root and update config. `bun changeset status` exits 0 at the repo root.
- Cover: `bun changeset status` exits 0 at the repo root; `bun run version` script is present and callable at root; no `.changeset/` remains inside `tui/`; `bun run lint` still passes in both packages (changeset config files are excluded from lint as appropriate).

---

## Task 7 — CI Pipeline Rework

**Status:** not started

**Description:**
Rewrite the CI GitHub Actions workflow to use Turborepo and cover both `tui` and `web`: build, lint, typecheck, and test. This replaces the existing per-project CI setup. References FR-4-040, FR-4-041, FR-4-042, FR-4-043, FR-4-044, FR-4-045.

- Consolidate CI into a single workflow file (e.g. `.github/workflows/ci.yml`). Trigger: `push` to `main` and all pull requests.
- Setup step: `oven-sh/setup-bun@v2` at repo root; run `bun install`.
- Core step: `turbo run build lint typecheck test:unit` — Turborepo orchestrates all packages.
- E2e step (separate, after build): `turbo run test:e2e`. This requires `web` to be built first — `turbo.json` already declares `test:e2e` depends on `build`, so Turborepo handles ordering. The web e2e step must use the same mechanism as the existing `deploy-web.yml` test job: build the static site (`next build`/`next export`), then run Playwright against the local output.
- Playwright setup: install browser binaries (`npx playwright install --with-deps`) in the e2e step.
- Remove or supersede any existing CI workflow that only covered `tui` or only covered `web`.

**TDD Approach:**
- **RED:** Before the rework, push a draft PR on the `Phase4` branch — the existing CI runs but does not cover both packages with Turborepo. Specifically, `turbo run build lint typecheck test:unit` does not appear in any workflow step.
- **GREEN:** Rewrite the CI workflow. The next PR push triggers CI that runs all four pipeline steps (`build`, `lint`, `typecheck`, `test:unit`) via Turborepo and a separate `test:e2e` step. All steps exit 0.
- Cover: CI triggers on push to `main` and on PRs; `turbo run build lint typecheck test:unit` passes in CI; `turbo run test:e2e` passes in CI; Playwright browsers are installed before the e2e step; a single `bun install` at root installs all workspace deps.

---

## Task 8 — Web Version Display

**Status:** not started

**Description:**
Add a minimal version display to the web project so users can verify the deployed web version matches the installed TUI version. The version is injected at build time from the git tag; a `dev` fallback is shown when no tag is set. References FR-4-060, FR-4-061, FR-4-062, FR-4-063.

- Add a `<VersionBadge>` (or equivalent minimal component) to the web project that reads `process.env.NEXT_PUBLIC_VERSION` and renders it in the page footer.
- When `NEXT_PUBLIC_VERSION` is not set (local dev, CI), render `dev` as the fallback.
- Place the version in the page footer in a minimal, unobtrusive style (e.g. small muted text: `v1.2.3` or `dev`).
- The component is added to the existing layout or footer component — no new pages or routes.

**TDD Approach:**
- **RED:** Write `web/src/components/VersionBadge.test.tsx` (or equivalent test file per the web project's test setup) with failing tests using the web project's test runner: (1) when `NEXT_PUBLIC_VERSION` is set to `"1.2.3"`, the component renders `v1.2.3`; (2) when `NEXT_PUBLIC_VERSION` is not set, the component renders `dev`; (3) the footer element containing the badge is present in the page layout.
- **GREEN:** Create `VersionBadge` component and add it to the footer to make all 3 tests pass.
- Cover: all 3 scenarios; `bun run typecheck` in `web/` still passes; `bun run lint` in `web/` passes; `bun run build` in `web/` passes with `NEXT_PUBLIC_VERSION=1.0.0` set and without it set.

---

## Task 9 — Release Pipeline Rework

**Status:** not started

**Description:**
Replace the existing TUI release workflow and `deploy-web.yml` with a single unified release workflow. The release fires only when a `v*` tag is pushed from the `main` branch. It builds TUI binaries, uploads them as GitHub Release assets, and deploys the web to GitHub Pages — all in one run. References FR-4-050, FR-4-051, FR-4-052, FR-4-053, FR-4-054, FR-4-055, FR-4-056.

- Create `.github/workflows/release.yml`. Trigger: `push: tags: ['v*']`.
- First step: main-branch check — fetch `origin/main` (`fetch-depth: 0`) then assert `git merge-base --is-ancestor HEAD origin/main`; exit early (non-zero) if the tag is not on `main`.
- TUI build step: cross-platform binary builds (same targets as the existing `release.yml`); upload as GitHub Release assets using the existing release action pattern.
- Web build step: `NEXT_PUBLIC_VERSION` is set from the git tag (`${{ github.ref_name }}`); run `bun run build` in `web/`; run Playwright e2e tests against the built output as a gate before deployment.
- Web deploy step: use `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` with output path `web/out`. Grant `pages: write` and `id-token: write` permissions.
- Remove `deploy-web.yml`. The release workflow must replace it entirely.
- Release workflow does not run lint or typecheck (those are CI's responsibility — FR-4-054).

**TDD Approach:**
- **RED:** Before the rework, push a `v*` tag on `main` — the existing workflows fire separately (TUI release fires, `deploy-web.yml` also fires independently). The new unified behavior (both in one workflow, with a main-branch gate) does not exist yet.
- **GREEN:** Create `release.yml`, remove `deploy-web.yml`. Push a test tag from `main` on the `Phase4` branch to validate structure (or validate via `act` dry-run or YAML linting). On the actual `main` merge: push a real `v*` tag — one workflow run handles both TUI release and web deploy.
- Cover: workflow file passes `actionlint` (or equivalent YAML schema check); the main-branch guard step is present and uses the correct `git merge-base` check; `NEXT_PUBLIC_VERSION` is set from `github.ref_name` in the web build step; `deploy-web.yml` is deleted; the release workflow triggers only on `v*` tags (not on branch pushes).

---
