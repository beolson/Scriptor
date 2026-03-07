# Phase 4 Functional Requirements

## Summary

Phase 4 is a pure cleanup phase. No new user-facing functionality is added; the application and website must behave identically before and after. The work covers four areas:

1. **Monorepo restructure** — Convert the repository to a Turborepo monorepo. The two projects are `tui` (currently `source/`) and `web`. The `source/` folder is renamed to `tui/`. All other folders (`.github/`, `spec/`, `dist/`, etc.) are left untouched.
2. **Package.json standardization** — Both `tui` and `web` align on a consistent set of npm script names. A `typecheck` script (using `tsc`) is added to each project.
3. **Biome config consolidation** — A root-level `biome.json` serves as the shared baseline. Each project may have its own `biome.json` for project-specific overrides only.
4. **CI and release pipeline rework** — The CI workflow covers both projects (build, lint, typecheck, test). A separate release workflow fires only when a changeset version bump lands on `main` (both the version tag and the `main` branch must be set). Changesets are moved from `tui/` to the monorepo root.

## Functional Requirements

### Monorepo Structure

- FR-4-001: The repository root becomes the Turborepo root, containing a root `package.json` (workspace manifest), `turbo.json`, and `pnpm-workspace.yaml` (or equivalent for Bun).
- FR-4-002: The `source/` directory is renamed to `tui/`. All internal references (imports, build scripts, CI paths, etc.) are updated accordingly.
- FR-4-003: The two workspace packages are `tui/` and `web/`. No other directories are restructured.
- FR-4-004: The renamed `tui/` package retains its existing functionality without behavioral change.

### Package.json Scripts (Both Projects)

- FR-4-010: Both `tui` and `web` expose the following scripts: `dev`, `build`, `lint`, `format`, `typecheck`. Each project exposes whatever test scripts are appropriate to its existing test suite — no tests are added or removed.
- FR-4-011: The `typecheck` script in each project runs `tsc --noEmit` (or equivalent) against that project's TypeScript configuration.
- FR-4-012: The `tui` project retains its existing `bun test` unit test suite. The `web` project retains its existing Playwright e2e test suite under `test:e2e`. No new test scripts are created at the project level.
- FR-4-013: The monorepo root `package.json` exposes two aggregate test scripts: `test:unit` (runs unit tests across all packages, currently only `tui`) and `test:e2e` (runs e2e tests across all packages, currently only `web`). These are orchestrated via Turborepo.
- FR-4-014: Script names are consistent across projects so Turborepo pipelines can target them by name.

### Biome Configuration

- FR-4-020: A `biome.json` at the repository root defines shared lint and format rules applicable to both projects.
- FR-4-021: Each project (`tui/`, `web/`) may contain its own `biome.json` that extends or overrides the root config for project-specific needs.
- FR-4-022: The existing per-project Biome configurations are migrated into this structure; no lint rules are loosened or tightened as a result.

### Changesets

- FR-4-030: The `.changeset/` directory and its configuration are moved from `tui/` to the monorepo root.
- FR-4-031: Changeset tooling (`changeset`, `version` scripts) is available at the root level.

### CI Pipeline

- FR-4-040: The CI workflow runs on every push to `main` and on every pull request.
- FR-4-041: CI covers both `tui` and `web`: build, lint, typecheck, and test for each project.
- FR-4-042: CI uses Turborepo to orchestrate the pipeline steps across packages.
- FR-4-043: CI runs unit tests (`test:unit`) for all packages that have them (currently: `tui` via `bun test`).
- FR-4-044: CI runs e2e tests (`test:e2e`) for all packages that have them (currently: `web` via Playwright).
- FR-4-045: The web e2e tests in CI use the same mechanism as the current `deploy-web.yml` test job (build the static site first, then run Playwright against it).

### Release Pipeline

- FR-4-050: A single release workflow handles both the TUI binary release and the web deployment simultaneously.
- FR-4-051: The release workflow triggers only when both conditions are true: (a) a version tag (`v*`) is pushed, and (b) that tag is on the `main` branch.
- FR-4-052: The release workflow builds the TUI cross-platform binaries and uploads them as GitHub Release assets (same targets as the current `release.yml`).
- FR-4-053: The release workflow deploys the web project as part of the same run as the TUI binary release.
- FR-4-054: The release workflow does not run lint, typecheck, or tests — those are CI's responsibility. It assumes CI has already passed.
- FR-4-055: The `deploy-web.yml` pipeline is removed; web deployment is consolidated into the unified release workflow.
- FR-4-056: The web is deployed to GitHub Pages only on versioned releases, not on every push to `main`. This intentionally changes the prior behavior where any push to `main` triggered a web deploy.

### Version Display on Web

- FR-4-060: The web project displays the current release version number so users can verify the deployed web version matches the installed TUI version.
- FR-4-061: The version value is injected at build time from the git tag (e.g. via a `NEXT_PUBLIC_VERSION` environment variable set in the release workflow).
- FR-4-062: The version is displayed in a minimal, unobtrusive location such as the page footer.
- FR-4-063: No version is shown in local development or CI builds where the tag is not set; a fallback such as `dev` or `unknown` is acceptable.

## Constraints

- The application and website must function identically after this phase.
- No packages are added or removed from either project beyond what is required for the Turborepo setup itself.
- Bun remains the package manager and runtime for the `tui` project.

## Out of Scope

- Adding new features to either the TUI or the web.
- Changing lint rules or TypeScript strictness settings.
- Releasing the `web` project (it is deployed, not released as a binary).

## Open Questions

_(none — requirements sufficiently defined)_
