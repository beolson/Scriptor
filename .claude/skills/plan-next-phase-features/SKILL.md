---
name: plan-next-phase-features
description: Use when the user wants to define a new phase of product features through structured Q&A elicitation, before any implementation. Do NOT invoke automatically — only when user explicitly requests planning a new phase.
disable-model-invocation: true
---

# Plan Next Phase Features

## Overview

A Q&A elicitation session that builds a `FunctionalRequirements.md` document for the next product phase. No code is written. Requirements are discovered incrementally through prioritized questions, one at a time.

## Workflow

### Step 1 — Identify the Next Phase

- Scan `spec/` for existing `phase{N}` folders (e.g. `phase1`, `phase2`)
- The new phase number = highest existing N + 1
- Create `spec/phase{N}/` directory for the new phase

### Step 2 — Get the High-Level Description

Ask the user (via `AskUserQuestion` tool):
> "Please give me a high-level description of the features you want in this phase."

Write their answer as the opening **Summary** section of `spec/phase{N}/FunctionalRequirements.md`:

```markdown
# Phase {N} Functional Requirements

## Summary

{user's high-level description, lightly edited for clarity}
```

### Step 3 — Compile Initial Questions

After writing the summary, internally generate a list of outstanding questions about the requirements. For each question, assess:
- **Impact**: How much does this gap affect scope, architecture, or user experience?
- **Importance**: Is this a blocker or a detail that can be deferred?

Sort by impact × importance (highest first). Do NOT show this list to the user.

### Step 4 — Ask One Question

Use the `AskUserQuestion` tool to ask only the single highest-priority outstanding question.

### Step 5 — Update and Repeat

After each answer:
1. Update `FunctionalRequirements.md` with any new or clarified requirements discovered from the answer. Add requirements under logical sections (e.g. `## User Stories`, `## Constraints`, `## Out of Scope`).
2. Re-evaluate your question list: remove answered questions, add any new questions surfaced by the answer, re-sort by priority.
3. If meaningful questions remain, go to Step 4.
4. If requirements are sufficiently defined (no high-impact unknowns remain), proceed to Step 6.

### Step 6 — Finalize

Inform the user that elicitation is complete and the requirements document is ready at `spec/phase{N}/FunctionalRequirements.md`. Summarize the key decisions captured.

## Rules

- **One question at a time.** Always use the `AskUserQuestion` tool — never ask multiple questions in a text block.
- **No implementation.** Do not suggest code, architecture, or tooling choices. Only document requirements.
- **Update the document after every answer.** Never batch updates.
- **Respect existing phases.** Read `spec/phase*/FunctionalRequirements.md` from prior phases to avoid duplicating already-established requirements.
- **Scope boundaries matter.** If the user's answer implies something is out of scope for this phase, document it explicitly under `## Out of Scope`.

## FunctionalRequirements.md Structure

```markdown
# Phase {N} Functional Requirements

## Summary
{high-level overview}

## User Stories
- As a [role], I want to [action] so that [benefit].

## Functional Requirements
- FR-{N}-001: ...

## Constraints
- ...

## Out of Scope
- ...

## Open Questions
- (remove as answered)
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Asking multiple questions at once | Use `AskUserQuestion` — one question only |
| Writing requirements before getting summary | Always get summary first (Step 2) |
| Forgetting to re-prioritize after each answer | Re-sort question list every iteration |
| Drifting into implementation discussion | Redirect: "Let's stay focused on what, not how" |
| Creating the folder but not the file | Create both the directory and `FunctionalRequirements.md` |
