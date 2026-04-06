# Build All Epic Tasks

## Goal

Exhaust every pending task in the target epic's `Plan.md` by dispatching one subagent per task, sequentially, until none remain.

Tasks are built one at a time because each may depend on the output of the previous — running them in parallel would break that dependency chain. The subagent for each task follows the same `08_epic_build.md` instructions used for single-task builds.

## Prerequisites

The target epic's `Plan.md` must exist with at least one task with status `not started` or `in progress`.

## Workflow

### Step 1 — Load Single-Task Build Instructions

Read `.claude/skills/manage/steps/08_epic_build.md` in full. You will embed its content into each subagent prompt you dispatch below.

### Step 2 — Check for Remaining Tasks

Read the target epic's `Plan.md` (at `10_Specs/Epics/{NNN}-{name}/Plan.md`). Scan for any task block containing:

```
**Status:** not started
```

or

```
**Status:** in progress
```

If none found → **stop**. All tasks are complete. Report to the user with a summary of what was built.

### Step 3 — Dispatch One Subagent

Dispatch **one** subagent using this prompt (substitute the actual epic directory path):

```
You are implementing the next pending task for the epic at:
  10_Specs/Epics/{NNN}-{name}/

Follow these instructions exactly:

{full content of 08_epic_build.md}
```

Wait for the subagent to complete before continuing.

### Step 4 — Check Outcome

If the subagent reports a blocker, states it could not complete a task, or does not update the task status to `completed`, **stop immediately**. Report the blocker to the user with all available detail from the subagent's output — do not attempt to continue past a failed task.

### Step 5 — Repeat

Return to Step 2. Re-read `Plan.md` fresh — the subagent will have updated task statuses.

**Keep repeating Steps 2–5 until no pending tasks remain.**

## Rules

- One subagent at a time — tasks are sequentially dependent; the implementation of one informs the next
- Always re-read `Plan.md` after each subagent completes — never assume statuses from memory
- Stop at the first blocker and surface it to the user — don't skip tasks
- Let the subagent own all status updates in `Plan.md`; don't update them yourself

## Common Mistakes

| Mistake | Fix |
|---|---|
| Dispatching multiple subagents in parallel | Sequential only — each task may depend on the previous |
| Stopping after the first task completes | Keep looping until all tasks reach `completed` |
| Assuming Plan.md status without re-reading | Always re-read — the subagent modifies the file |
| Continuing past a failed or blocked task | Stop and report to the user immediately |
