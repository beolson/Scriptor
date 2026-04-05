---
status: Ready
created: 2026-04-05
prd: 001-script-index
---

# Site Shell Bootstrap — Functional Requirements

## Overview

This epic delivers the foundational project skeleton for the Script Index static website. It establishes the development environment, toolchain, and project structure so that subsequent epics can build features on a consistent, validated base.

The shell includes: Next.js configured for static export, shadcn/ui component library, Tailwind CSS, and Vitest for unit testing. A companion standalone workspace (`scriptor-web-test`) provides Playwright end-to-end tests that run against the site's static build output.

The "user" of this epic is the developer: the outcome is a working project scaffold that passes its own baseline checks, from which feature development can begin.

## Use Cases

### UC-001: Developer Bootstraps the Project

**Actor:** Developer
**Trigger:** Developer clones the repository and wants to begin feature work
**Preconditions:**
- Repository has been cloned locally
- Node/Bun runtime is available

**Main Flow:**
1. Developer installs dependencies
2. Developer runs the development server
3. Next.js starts and serves the site locally
4. Developer can navigate to the site in a browser and see the shell

**Postconditions:**
- Local development server is running
- Site is accessible in the browser

**Alternative Flows:**
- None identified

**Error Flows:**
- Dependency installation fails — developer receives clear error output

---

### UC-002: Developer Runs the Build

**Actor:** Developer
**Trigger:** Developer wants to verify the project produces a valid static export
**Preconditions:**
- Dependencies installed

**Main Flow:**
1. Developer runs the build command
2. Next.js performs a static export
3. Build completes without errors
4. Output directory contains static HTML/CSS/JS files

**Postconditions:**
- Static output directory exists and is valid

**Alternative Flows:**
- None identified

**Error Flows:**
- Build fails due to configuration error — output includes actionable error message

---

### UC-003: Developer Runs Unit Tests

**Actor:** Developer
**Trigger:** Developer wants to verify the unit test harness is working
**Preconditions:**
- Dependencies installed

**Main Flow:**
1. Developer runs the unit test command
2. Vitest discovers and runs tests
3. All tests pass

**Postconditions:**
- Test run reports success with at least one passing test

**Alternative Flows:**
- None identified

**Error Flows:**
- Test runner misconfigured — error message identifies the problem

---

### UC-004: Developer Runs End-to-End Tests

**Actor:** Developer
**Trigger:** Developer wants to verify the Playwright end-to-end test harness is working
**Preconditions:**
- Dependencies installed in the `scriptor-web-test` workspace
- Static build output from `scriptor-web` exists

**Main Flow:**
1. Developer runs the end-to-end test command from the `scriptor-web-test` workspace
2. Playwright launches a browser and navigates to the locally served `scriptor-web` static build
3. All end-to-end tests pass

**Postconditions:**
- Playwright test run reports success with at least one passing test

**Alternative Flows:**
- None identified

**Error Flows:**
- Playwright misconfigured or build output absent — error message identifies the problem

## Acceptance Criteria

- [ ] AC-001: `bun run build` completes without errors and produces a non-empty static export output directory.
- [ ] AC-002: `bun run typecheck` completes without errors.
- [ ] AC-003: `bun run lint` (Biome) completes without errors or warnings.
- [ ] AC-004: At least one Vitest unit test exists and passes when the unit test command is run.
- [ ] AC-005: The home page (`/`) renders at least one shadcn/ui component visibly when the site is opened in a browser.
- [ ] AC-006: At least one Playwright end-to-end test exists and passes when the end-to-end test command is run against the static build output.

## Workflows

The typical developer verification workflow runs all checks in sequence:

1. Install dependencies
2. Run the build (UC-002) — validates static export
3. Run typecheck — validates TypeScript correctness
4. Run lint — validates code style and formatting
5. Run unit tests (UC-003) — validates unit test harness
6. Run end-to-end tests (UC-004) — validates browser-level behavior against the static build

All six steps must succeed for the scaffold to be considered complete.

## Data Requirements

This epic creates no runtime data. It produces configuration files, dependency manifests, and project structure only.

## Routes

| Route | Purpose |
|-------|---------|
| `/`   | Home page placeholder — validates the build and render pipeline. Must render at least one shadcn/ui component. No content required beyond confirming the page loads and the component is present. |

## Edge Cases

- The existing `web/` workspace will be deleted and replaced with a fresh scaffold. Any configuration, dependencies, or source files in the current `web/` directory are not preserved.

## Out of Scope

- Any user-facing features or content beyond the home page placeholder
- CI/CD pipeline configuration (may be a separate epic)
- Additional routes beyond `/`

_Note: Playwright end-to-end tests live in the standalone `scriptor-web-test` workspace (`20_Applications/scriptor-web-test`), not inside the site workspace itself._
