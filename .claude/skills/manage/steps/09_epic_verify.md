# Verify Epic

## Workflow

### Step 1 — Load Context

1. Read the epic's `Functional.md` — extract all `AC-NNN` acceptance criteria in order.
2. Read the epic's `Plan.md` — review implementation notes to understand how each AC was built and confirm all tasks are `completed`.
3. Check for an existing `Verification.md` in the epic directory:
   - If it exists, load it — you are resuming a prior verification session.
   - If it does not exist, create it now:

```markdown
# Verification

## Acceptance Criteria

| AC | Description | Status |
|----|-------------|--------|

## Issues
```

### Step 2 — Interactive Verification Loop

This is a human-assisted verification process. Work through each `AC-NNN` item **one at a time**. For each criterion:

1. **Present the criterion** — state the AC text clearly to the user.
2. **Provide implementation context** — based on the Plan.md implementation notes, tell the user:
   - What was built to satisfy this criterion and where (file paths, key components or functions)
   - What to look for or try in the running application to confirm it works
3. **Ask the user to verify it** via `AskUserQuestion`:
   > "AC-NNN: [criterion text]. Please verify this using the guidance above, then reply **pass** to confirm this criterion, or describe any issue you found."

4. **If the user confirms it passes** — append a row to the Acceptance Criteria table in `Verification.md`:
   ```
   | AC-NNN | [short description] | Verified |
   ```
   Then move on to the next AC.

5. **If an issue is found or a fix is requested:**
   - Append a new section under `## Issues` in `Verification.md`:
     ```markdown
     ### AC-NNN: [Short Description]

     **Issue:** [description of the issue]

     **Fix:** —
     ```
   - Implement the fix. Follow the same approach as `08_epic_build.md`:
     - Write a failing test first (if applicable), then the fix, then confirm tests pass
     - Update the relevant task's Implementation Notes in `Plan.md`
   - Update the `Verification.md` section: replace the `**Fix:** —` placeholder with a description of what was done, including file path and line number where relevant.
   - Re-present the updated implementation context, then ask the user to re-verify via `AskUserQuestion`:
     > "AC-NNN issue resolved. Please re-verify in the running application. Reply **pass** to move on, or describe the next issue."
   - If another issue is raised, append a second `### AC-NNN: [Short Description]` section (with a disambiguating suffix if needed, e.g. `AC-NNN: [Short Description] (2)`).
   - Repeat this loop — document, fix, re-verify — until the user replies **pass**.

6. **When the user confirms pass** — append a row to the Acceptance Criteria table in `Verification.md`:
   ```
   | AC-NNN | [short description] | Verified |
   ```

The user may raise issues at any point — not just in response to a prompt. If they say "actually, I noticed X is missing" between AC items, treat it the same way: add an issue section, fix it, update the fix, and continue.

### Step 3 — Verification Summary

After all AC-NNN items are checked, report:

- Total AC items verified
- How many passed cleanly on first check
- How many had issues (and whether all are resolved)
- Display the full `Verification.md` content

### Step 4 — Update status.yaml

Add `verify` to `completed_steps` in the epic's `status.yaml`.

### Step 5 — Offer Next Step

Ask the user via `AskUserQuestion`:

> "Verification is complete — [N] criteria checked, [N] issues found and resolved. Would you like to proceed to Epic Complete to finalize and close this epic?"

If yes, load and follow `10_epic_complete.md`.
