---
name: h4h:BuildEpic
description: Use when the user wants to automatically complete all remaining tasks in an epic. Dispatches subagents sequentially to exhaust every "not started" task using the h4h-NextTaskInEpic skill.
disable-model-invocation: true
---

# BuildEpic

## Overview

Identifies the target epic, then dispatches subagents one at a time to complete every "not started" task using the `h4h-NextTaskInEpic` skill. Repeats until no "not started" tasks remain.

## Workflow

### Step 1 — Identify Target Epic

Scan `10_Specifications/Epics/` for subdirectories matching `NNN_*` that contain a `delivery.md` with at least one task status of `not started`. If exactly one such epic exists, target it automatically. If multiple match, use `AskUserQuestion` to ask the user which one to build.

All subsequent steps use `10_Specifications/Epics/{NNN}_{SLUG}/delivery.md`.

### Step 2 — Check for Remaining Tasks

Read the target epic's `delivery.md`. Search for any task block containing:

```
**Status:** not started
```

If none found → **stop**. All tasks are complete. Report to the user.

### Step 3 — Dispatch One Subagent

Create **one** subagent with this prompt (substitute the actual epic folder path):

> Use the `h4h-NextTaskInEpic` skill to find and complete the next pending task. The delivery file for this epic is at `10_Specifications/Epics/{NNN}_{SLUG}/delivery.md` — read that file first to find the first task with `**Status:** not started`.

Wait for the subagent to finish before continuing.

### Step 4 — Repeat

Return to Step 2. Re-read the epic's `delivery.md` to check for remaining "not started" tasks.

**Keep repeating Steps 2–4 until no "not started" tasks remain.**

## Rules

- Dispatch **one subagent at a time** — tasks may have sequential dependencies
- Always re-read `delivery.md` after each subagent completes — the subagent updates statuses
- If a subagent reports being blocked or fails to complete a task, stop and report to the user immediately
- Do not mark tasks complete yourself — the subagent owns that

## Common Mistakes

| Mistake | Fix |
|---|---|
| Dispatching multiple subagents in parallel | Tasks may depend on each other — always one at a time |
| Stopping after one task | Keep looping until all tasks are `completed` |
| Not re-reading delivery.md after each subagent | Always re-read — statuses change |
| Forgetting to pass the epic-specific path | Explicitly tell the subagent which `delivery.md` to use |
