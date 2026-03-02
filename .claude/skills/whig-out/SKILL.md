---
name: whig-out
description: Use when the user wants to automatically complete all remaining tasks in the current phase. Dispatches subagents sequentially to exhaust every "not started" task using the next-task skill.
---

# WhigOut

## Overview

Identifies the current phase, then dispatches subagents one at a time to complete every "not started" task using the `next-task` skill. Repeats until no "not started" tasks remain.

## Workflow

### Step 1 — Identify Current Phase

Scan `spec/` for directories matching the pattern `phase{N}`. The current phase = the highest N found.

```bash
ls spec/ | grep -E '^phase[0-9]+$' | sort -V | tail -1
```

All subsequent steps use `spec/phase{N}/tasks.md`.

### Step 2 — Check for Remaining Tasks

Read `spec/phase{N}/tasks.md`. Search for any task block containing:

```
**Status:** not started
```

If none found → **stop**. All tasks are complete. Report to the user.

### Step 3 — Dispatch One Subagent

Create **one** subagent with this prompt (substitute the actual phase path):

> Use the `next-task` skill to find and complete the next pending task. The tasks file for this phase is at `spec/phase{N}/tasks.md` — read that file first to find the first task with `**Status:** not started`.

Wait for the subagent to finish before continuing.

### Step 4 — Repeat

Return to Step 2. Re-read `spec/phase{N}/tasks.md` to check for remaining "not started" tasks.

**Keep repeating Steps 2–4 until no "not started" tasks remain.**

## Rules

- Dispatch **one subagent at a time** — tasks may have sequential dependencies
- Always re-read `spec/phase{N}/tasks.md` after each subagent completes — the subagent updates statuses
- If a subagent reports being blocked or fails to complete a task, stop and report to the user immediately
- Do not mark tasks complete yourself — the subagent owns that

## Common Mistakes

| Mistake | Fix |
|---|---|
| Dispatching multiple subagents in parallel | Tasks may depend on each other — always one at a time |
| Stopping after one task | Keep looping until all tasks are `completed` |
| Not re-reading tasks.md after each subagent | Always re-read — statuses change |
| Forgetting to pass the phase-specific path | `next-task` defaults to `spec/tasks.md`; explicitly tell the subagent to use `spec/phase{N}/tasks.md` |
