---
name: plan-delivery
description: Use when FunctionalRequirements.md and tech-standards.md exist for a phase and you need to create a task-by-task delivery plan. Do NOT invoke automatically — only when the user explicitly requests planning delivery tasks for a phase.
disable-model-invocation: true
---

# Plan Delivery

## Overview

Reads `FunctionalRequirements.md` and `tech-standards.md` for the current phase and produces an ordered `tasks.md` file that breaks the requirements into atomic, TDD-driven implementation tasks.

## Workflow

### Step 1 — Identify Current Phase

- Scan `spec/` for existing `phase{N}` directories
- The current phase = the highest-numbered N found
- All paths below use `spec/phase{N}/`

### Step 2 — Read Requirements

Load both documents before generating any tasks:

1. Read `spec/phase{N}/FunctionalRequirements.md`
2. Read `spec/phase{N}/tech-standards.md`

Do not proceed until both files have been read in full.

### Step 3 — Read Prior Art

If `spec/phase{N-1}/tasks.md` exists, read it. Use it as context for:

- Naming conventions and task granularity already established
- Module patterns and dependencies already resolved
- Ordering principles that worked in the previous phase

### Step 4 — Break Into Tasks

Decompose the requirements into ordered implementation tasks following the **Task Ordering Principles** and **TDD Rules** below.

Tasks must be atomic: completable in one session with one clear deliverable. If a task feels complex, split it.

### Step 5 — Write tasks.md

Write all tasks to `spec/phase{N}/tasks.md` using the **Task Format** below.

## Task Format

Each task uses this structure:

```markdown
## Task N — <Title>

**Status:** not started

**Description:**
<What to build and why. Reference specific functional requirements (e.g. FR-1-001).>

- <bullet: key thing to build or constraint to satisfy>
- <bullet: another key thing>

**TDD Approach:**
- **RED:** Write a failing test for `<what>` in `<file path>` before writing implementation code
- **GREEN:** Write the minimal implementation to make the test pass
- Cover: <comma-separated list of key behaviors to test>
```

After a task is implemented, `**TDD Approach:**` is replaced by `**Implementation Notes:**` with actual details. The skill only writes `**TDD Approach:**` sections.

## Task Ordering Principles

Order tasks so dependencies come first:

1. **Project scaffolding and tooling** — directory structure, package setup, build/lint/test scripts
2. **Core data types and interfaces** — shared types, contracts, constants
3. **Leaf-node services** — modules with no dependencies on other custom modules (parsers, validators, pure utilities)
4. **Dependent modules** — modules that import from leaf services
5. **Integration points** — where modules connect (coordinators, orchestrators)
6. **TUI / UI layers** — depend on business logic being complete
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
- Reference functional requirements by ID (e.g. `FR-1-001`) in descriptions
- Status values: `not started`, `in progress`, `completed`

## tasks.md Header

Begin the file with:

```markdown
# Phase {N} — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing a "Tests" task separate from implementation | Tests belong inside each task's TDD Approach section |
| Tasks too large | Split: one session, one deliverable |
| Forgetting to reference FRs | Include `FR-{N}-NNN` in descriptions |
| Ordering by feature area instead of dependency | Order by what each module imports, not by topic |
| Skipping Step 3 (prior art) | Prior phase tasks reveal naming conventions and pitfalls |
| Writing tasks before reading both requirement docs | Always read both docs fully before generating tasks |
