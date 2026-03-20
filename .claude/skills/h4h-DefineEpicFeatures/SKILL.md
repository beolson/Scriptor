---
name: h4h:DefineEpicFeatures
description: Use when the user wants to define the featureset for a new epic. Elicits requirements via Q&A and writes a structured epic document to 10_Specifications/10.40_Epics/. Invoke when user says "define epic", "create epic", "plan epic features", or similar.
disable-model-invocation: true
---

## Step 1 — Determine Next Epic Number

Scan `10_Specifications/10.40_Epics/` for files matching `10.40.NNN_*.md` (where NNN is a 3-digit zero-padded number). Find the highest NNN. The new epic number is highest + 1, or `001` if the folder is empty or has no matching files.

## Step 2 — Get High-Level Description

Use `AskUserQuestion` to ask: "Please give a high-level description of the epic you want to define."

From the answer, derive a SLUG: ~3 words, TitleCase, underscores between words (e.g. `GitHub_OAuth_Login`, `Script_Search_Filter`, `Update_Notifications`).

Create the file `10_Specifications/10.40_Epics/10.40.{NNN}_{SLUG}.md` with an initial **Summary** section based on the description.

Initial document structure:

```markdown
# {NNN} {Epic Title}

## Summary
{high-level overview derived from user description}

## Business Value

## User Stories

## Acceptance Criteria

## Constraints

## Out of Scope

## Open Questions
```

## Step 3 — Compile Initial Questions

Internally compile a prioritized list of questions needed to fill out the document sections: Business Value, User Stories, Acceptance Criteria, Constraints, Out of Scope. Prioritize by impact × importance — highest-impact unknowns first. Do NOT show this list to the user.

## Step 4 — Ask One Question at a Time

Use `AskUserQuestion` to ask the single highest-priority open question. Focus on requirements only — no implementation, architecture, or tooling choices.

## Step 5 — Update Document and Repeat

After each answer:
1. Update the epic document immediately (no batching answers).
2. Re-evaluate the question list — cross off answered items, re-sort by priority.
3. Loop back to Step 4 until no high-impact unknowns remain.

Rules:
- One question per `AskUserQuestion` call
- Update the file after every answer
- Explicitly document out-of-scope items when they arise
- Never ask about implementation details, architecture, or technology choices

## Step 6 — Finalize

When no high-impact unknowns remain:
1. Write the final version of the epic document with all sections populated.
2. Inform the user the epic is complete.
3. Summarize the key decisions captured.
4. State the file path created.
