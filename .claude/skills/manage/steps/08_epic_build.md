# Build Epic Tasks

## Goal

Implement the next pending task from `10_Specs/Epics/{NNN}-{name}/Plan.md`.

## Prerequisites

The target epic's `Plan.md` must exist with at least one task with status `not started` or `in progress`.

## Workflow

### Step 1 — Find the Task

Open the target epic's `Plan.md`. Scan from the top for the first task with status `not started` or `in progress`. Update its status to `in progress`.

### Step 2 — Understand the Task

- Read the task's **Description** carefully.
- If the status was already `in progress`, read the **Implementation Notes** and **Next Steps** sections to understand current progress before writing any code.
- Read the epic's `TechRequirements.md` for tech stack and architecture constraints.
- Read the epic's `Functional.md` for the referenced use cases and acceptance criteria.

### Step 3 — Implement the Task

- **Adhere strictly to the tech stack** in `TechRequirements.md`. Do not introduce libraries, tools, or patterns not listed there without explicit user permission.
- **Stay within scope** of the current task only. Do not implement features belonging to future tasks.
- **Follow functional requirements** from `Functional.md` as they apply to this task's scope.
- **Follow TDD**:
  1. Write the failing test first (RED).
  2. Write the minimal implementation to make the test pass (GREEN).
  3. Refactor if needed while keeping tests green.

### Step 4 — Update Implementation Notes

As you work, replace the task's `**TDD Approach:**` section with `**Implementation Notes:**`. Include:

- Sub-steps completed
- Files created, modified, or deleted with a brief description of each change
- Any decisions made during implementation and why

### Step 5 — Handle Blockers

If blocked or incomplete before stopping, add a `**Next Steps:**` section to the task describing:

- What remains to be done, OR
- What question needs to be answered by the user (word it so the question can be re-asked in a fresh session)

### Step 6 — Complete

Once the current task is complete:
1. Ensure all tests pass.
2. Ensure linting passes.
3. Update the task's status to `completed`.
4. **Stop after one task** — do not begin the next task.

## Rules

- **One task per invocation** — implement the current task and stop.
- **Strict tech stack adherence** — no unauthorized libraries or patterns.
- **TDD is mandatory** — failing test first, then implementation.
- **Update Plan.md continuously** — the document should reflect current state at all times.
- **Don't refactor beyond scope** — if you see opportunities to improve code outside the current task, note them but don't act.
