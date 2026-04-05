# Complete Epic

## Goal

Mark the epic as complete by updating its `status.yaml`.

## Prerequisites

All tasks in the epic's `Plan.md` must have status `completed`.

## Workflow

### Step 1 — Verify All Tasks Complete

Read `Plan.md` and confirm every task has `**Status:** completed`. If any tasks are not completed, inform the user and list the incomplete tasks. Do not proceed.

### Step 2 — Update Status

Update `status.yaml`:
- Set `status` to `Complete`
- Add `complete` to `completed_steps`

### Step 3 — Report

Inform the user that the epic is complete. Provide a brief summary:
- Epic name
- Number of tasks completed
- Key deliverables (from Plan.md implementation notes)
