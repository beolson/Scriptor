---
name: h4h:DefineEpicDelivery
description: Use when functional.md and technical.md exist for an epic and you need to create a task-by-task delivery plan. Writes delivery.md into the epic's folder under 10_Specifications/10.40_Epics/. Invoke when user says "plan delivery", "define delivery tasks", "create tasks", "break into tasks", or similar.
disable-model-invocation: true
---

# Define Delivery

## Overview

Reads `functional.md` and `technical.md` for the target epic and produces an ordered `delivery.md` file that breaks the requirements into atomic, TDD-driven implementation tasks.

## Workflow

### Step 1 — Determine Target Epic Folder

Scan `10_Specifications/10.40_Epics/` for subdirectories matching `10.40.NNN_*`. Identify which ones do not yet contain a `delivery.md`.

- If exactly one epic folder has no `delivery.md`, target it automatically and inform the user.
- If multiple epic folders have no `delivery.md`, use `AskUserQuestion` to ask the user which one to plan delivery for.
- If all epic folders already have a `delivery.md`, use `AskUserQuestion` to ask which one the user wants to update.

The target file is: `10_Specifications/10.40_Epics/10.40.{NNN}_{SLUG}/delivery.md`

### Step 2 — Read Requirements

Load all available requirement documents before generating any tasks:

1. Read `10_Specifications/10.40_Epics/10.40.{NNN}_{SLUG}/functional.md`
2. Read `10_Specifications/10.40_Epics/10.40.{NNN}_{SLUG}/technical.md`
3. If a `ux.md` exists in the same folder, read it too

Do not proceed until all available files have been read in full.

### Step 3 — Read Prior Art

Read `delivery.md` from any other epic folders that have one. Use it as context for:

- Naming conventions and task granularity already established
- Module patterns and dependencies already resolved
- Ordering principles that worked in prior epics

### Step 4 — Break Into Tasks

Decompose the requirements into ordered implementation tasks following the **Task Ordering Principles** and **TDD Rules** below.

Tasks must be atomic: completable in one session with one clear deliverable. If a task feels complex, split it.

### Step 5 — Write delivery.md

Write all tasks to `10_Specifications/10.40_Epics/10.40.{NNN}_{SLUG}/delivery.md` using the **Task Format** below.

## Task Format

Each task uses this structure:

```markdown
## Task N — <Title>

**Status:** not started

**Description:**
<What to build and why. Reference specific functional requirements (e.g. FR-001).>

- <bullet: key thing to build or constraint to satisfy>
- <bullet: another key thing>

**TDD Approach:**
- **RED:** Write a failing test for `<what>` in `<file path>` before writing implementation code
- **GREEN:** Write the minimal implementation to make the test pass
- Cover: <comma-separated list of key behaviors to test>
```

After a task is implemented, `**TDD Approach:**` is replaced by `**Implementation Notes:**` with actual details. This skill only writes `**TDD Approach:**` sections.

## Task Ordering Principles

Order tasks so dependencies come first:

1. **Project scaffolding and tooling** — directory structure, package setup, build/lint/test scripts
2. **Core data types and interfaces** — shared types, contracts, constants
3. **Leaf-node services** — modules with no dependencies on other custom modules (parsers, validators, pure utilities)
4. **Dependent modules** — modules that import from leaf services
5. **Integration points** — where modules connect (coordinators, orchestrators)
6. **TUI / UI layers** — depend on business logic being complete; within UI, create reusable components before pages that compose them
7. **CI/CD and release pipeline** — last, after everything else works

When two tasks are at the same dependency level, order by functional risk: higher-risk (more unknowns) first.

## TDD Rules

- Tests are **part of each task**, never a separate task
- Every task must include a `**TDD Approach:**` section
- **RED:** the failing test must be written before any implementation code
- **GREEN:** write the minimal implementation to make the test pass
- A task is not complete until tests pass and `bun run lint` passes

## Key Rules

- Tasks must be completable in one session
- Each task has one clear deliverable
- If a task is complex, split it into two tasks
- Reference functional requirements by ID (e.g. `FR-001`) in descriptions
- Status values: `not started`, `in progress`, `completed`

## delivery.md Header

Begin the file with:

```markdown
# {Epic Title} — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing a "Tests" task separate from implementation | Tests belong inside each task's TDD Approach section |
| Tasks too large | Split: one session, one deliverable |
| Forgetting to reference FRs | Include `FR-NNN` in descriptions |
| Ordering by feature area instead of dependency | Order by what each module imports, not by topic |
| Skipping Step 3 (prior art) | Prior epic delivery files reveal naming conventions and pitfalls |
| Writing tasks before reading both requirement docs | Always read all available docs (including ux.md) fully before generating tasks |
| Creating pages before reusable UI components | Components must come first; pages compose them |
