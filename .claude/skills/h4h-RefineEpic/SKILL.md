---
name: h4h:RefineEpic
description: Apply a change, fix, or amendment to code built by an h4h epic. Use this skill when the user wants to modify, fix, or update something in an existing epic's implementation — bugs, behavioral changes, refactors, spec amendments, or any correction to delivered work. Triggers on any of: "fix X in the epic", "change how X works", "update the implementation", "the epic needs to change", "I need to amend X", "there's a bug in the epic code", "X isn't working right", "update X to do Y instead". Always use this skill when the user is requesting a change to code or behavior that traces back to an h4h epic.
---

# RefineEpic

Applies a targeted change or fix to an epic's implementation and keeps `functional.md`, `technical.md`, and `delivery.md` in sync with what was actually built.

---

## Workflow

### Step 1 — Identify the Epic

If the user specified an epic in their request (e.g., a number like `001`, or a name like `Startup_Repo_Config`), resolve it directly. Otherwise scan `10_Specifications/Epics/` for subdirectories matching `NNN_*`.

- If exactly one epic exists → target it automatically
- If multiple exist → use `AskUserQuestion` to ask which one

Read all three spec files for the target epic before doing anything else:
- `functional.md` — business requirements and acceptance criteria
- `technical.md` — tech stack, architecture patterns, constraints
- `delivery.md` — task history and implementation notes (what was actually built)

### Step 2 — Confirm the Change Request

If the user described the change in their invocation, restate your understanding back to them briefly. If they have not described what they want changed, use `AskUserQuestion`:

> "What would you like to change or fix in this epic? Please describe the problem or the outcome you want."

### Step 3 — Elicitation Q&A

Before planning, ask the questions that remain unclear given what the user said. Ask all of them in a single message — not one at a time. Only ask what you genuinely don't know; skip obvious ones.

Questions to consider:

- **Type**: Is this a bug fix, behavioral change, new capability, refactor, or test gap?
- **Bug specifics**: What is happening now vs. what should happen? Is there a repro case?
- **Acceptance criteria impact**: Does this change, add, or remove any acceptance criteria in `functional.md`?
- **Tech stack impact**: Does this require new libraries, new patterns, or changes to the architecture in `technical.md`?
- **Affected modules**: Which files, modules, or services are likely involved?
- **Test expectations**: Should new tests be added? Should existing tests be updated or removed?
- **Edge cases / constraints**: Are there boundary conditions or constraints the user has in mind?

Once you have enough clarity, confirm your understanding in a short summary before moving to planning.

### Step 4 — Draft the Plan

Write a concrete, numbered implementation plan. Present it to the user, then ask:

> "Does this plan look right? I'll proceed once you approve, or let me know what to adjust."

**Wait for explicit approval before writing any code.**

A good plan:
- Names every file, function, and behavior change explicitly — no ambiguity
- Includes a doc-update step for each change to functional requirements (`functional.md`) or tech patterns (`technical.md`). If neither doc needs updating, say so explicitly.
- Includes test additions or changes where appropriate
- Follows the tech stack in `technical.md` — if a new library is needed, a `technical.md` update step comes first
- Respects the injectable deps pattern used throughout the epic

### Step 5 — Execute the Plan

Work through each numbered step in order. For each step:

1. Make the code changes
2. Run `bun run lint && bun run format && bun run typecheck && bun run test:unit` and fix any issues before moving on
3. Update `functional.md` and `technical.md` exactly as the plan specifies

If you hit a blocker mid-execution, stop and report to the user with clear context: what was done, what remains, and what decision or information is needed.

### Step 6 — Update delivery.md

After all steps are complete, append a Change Record at the bottom of `delivery.md`:

```
---

## Change: <short title> (<YYYY-MM-DD>)

**Summary:** One-sentence description of what changed and why.

**Files modified:**
- `path/to/file.ts` — what changed

**Spec updates:**
- `functional.md` — what was updated (or "none")
- `technical.md` — what was updated (or "none")

**Tests added/modified:**
- `path/to/file.test.ts` — what changed (or "none")
```

---

## Rules

- Never skip elicitation — assumptions lead to wrong implementations
- Never start implementing before the user approves the plan
- Always update the docs — `functional.md` and `technical.md` must reflect reality after the change
- Always append the Change Record to `delivery.md`
- No new dependencies without a `technical.md` update step in the plan
- Run lint/typecheck/tests after each non-trivial code change; do not proceed past a failing check

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Guessing intent and skipping elicitation | Ask until scope and expected behavior are clear |
| Starting implementation before plan approval | Always get an explicit "yes" |
| Forgetting doc updates | Every behavior change touches `functional.md`; every tech change touches `technical.md` |
| Skipping the Change Record | Always append it to `delivery.md` when done |
| Introducing unlisted libraries | Add a `technical.md` update step first, confirm with user |
| Treating lint/typecheck/test failures as acceptable | Fix before moving to the next step |
