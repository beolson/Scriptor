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

### Step 3 — Commit and Push

Stage all changes in the working directory and create a commit:

1. Run `git status` to see what is staged/unstaged.
2. Stage all modified and new files: `git add -A`
3. Create a commit with a message summarizing the epic:
   ```
   feat: complete epic {NNN}-{name}

   {one-sentence summary of what was delivered}

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
4. Push the branch to the remote: `git push -u origin HEAD`

If the push fails (e.g., nothing to push, branch already up to date), note it and continue.

### Step 4 — Create Pull Request

Use the `gh` CLI to create a pull request targeting `main`:

```bash
gh pr create --title "feat: {epic name}" --body "$(cat <<'EOF'
## Summary

{3-5 bullet points summarizing the key deliverables from Plan.md}

## Acceptance Criteria

All {N} acceptance criteria verified:
{list each AC with a checkmark, e.g. - [x] AC-001: build completes}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL to the user.

### Step 5 — Report

Inform the user that the epic is complete. Provide a brief summary:
- Epic name
- Number of tasks completed
- Key deliverables (from Plan.md implementation notes)
- PR URL
