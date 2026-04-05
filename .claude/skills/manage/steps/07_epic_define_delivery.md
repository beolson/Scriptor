# Define Epic Delivery Plan

## Goal

Create `10_Specs/Epics/{NNN}-{name}/Plan.md` that breaks the epic into ordered, atomic, TDD-driven implementation tasks.

## Prerequisites

The target epic's `TechRequirements.md` must be in `Ready` state.

## Workflow

### Step 1 — Load Context

1. Read the epic's `Functional.md` in full.
2. Read the epic's `TechRequirements.md` in full.
3. Read the epic's `Research.md` in full.
4. Read `Plan.md` from any other epic directories that have one — use these for:
   - Naming conventions and task granularity already established
   - Module patterns and dependencies already resolved
   - Ordering principles that worked in prior epics

Do not proceed until all available files have been read.

### Step 2 — Break Into Tasks

Decompose the requirements into ordered implementation tasks following the **Task Ordering Principles** and **TDD Rules** below.

Tasks must be atomic: completable in one session with one clear deliverable. If a task feels complex, split it.

### Step 3 — Write Plan.md

Write all tasks to `10_Specs/Epics/{NNN}-{name}/Plan.md`.

**Header:**

```yaml
---
status: Draft
created: {today's date}
---
```

```markdown
# {Epic Title} — Delivery Tasks

_TDD methodology: write failing tests first (red), then implement to make them pass (green). Tests are part of each task, not separate._

---
```

**Task Format:**

```markdown
## Task N — <Title>

**Status:** not started

**Description:**
<What to build and why. Reference specific functional requirements (e.g. UC-001, AC-001).>

- <bullet: key thing to build or constraint to satisfy>
- <bullet: another key thing>

**TDD Approach:**
- **RED:** Write a failing test for `<what>` in `<file path>` before writing implementation code
- **GREEN:** Write the minimal implementation to make the test pass
- Cover: <comma-separated list of key behaviors to test>
```

### Step 4 — Finalize

1. Review task ordering — dependencies must come before dependents.
2. Verify every use case (UC-NNN) and acceptance criterion (AC-NNN) from `Functional.md` is covered by at least one task.
3. Update `Plan.md` frontmatter: `status: Draft` → `status: Ready`.
4. Update `status.yaml`: status → `Ready`, add `delivery` to `completed_steps`.
5. Inform the user the delivery plan is ready.

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

- Tests are **part of each task**, never a separate task.
- Every task must include a `**TDD Approach:**` section.
- **RED:** the failing test must be written before any implementation code.
- **GREEN:** write the minimal implementation to make the test pass.
- A task is not complete until tests pass and linting passes.

After a task is implemented, `**TDD Approach:**` is replaced by `**Implementation Notes:**` with actual details. This step only writes `**TDD Approach:**` sections.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Writing a "Tests" task separate from implementation | Tests belong inside each task's TDD Approach section |
| Tasks too large | Split: one session, one deliverable |
| Forgetting to reference functional requirements | Include `UC-NNN` and `AC-NNN` in descriptions |
| Ordering by feature area instead of dependency | Order by what each module imports, not by topic |
| Skipping prior art review | Prior epic Plan files reveal naming conventions and pitfalls |
| Writing tasks before reading all requirement docs | Always read all docs fully before generating tasks |
| Creating pages before reusable UI components | Components must come first; pages compose them |
