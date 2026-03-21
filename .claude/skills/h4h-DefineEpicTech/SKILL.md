---
name: h4h:DefineEpicTech
description: Use when the user wants to define technical standards for an epic through structured Q&A elicitation, before any implementation. Writes technical.md into the epic's folder under 10_Specifications/10.40_Epics/. Invoke when user says "define tech standards", "define tech", "document tech choices", "tech elicitation", or similar.
disable-model-invocation: true
---

# Define Tech Standards

## Overview

A Q&A elicitation session that builds a `technical.md` document inside an existing epic folder. No code is written. Technical requirements are discovered incrementally through prioritized questions, one at a time, informed by reviewing the epic's `functional.md` and the existing source code.

## Workflow

### Step 1 — Determine Target Epic Folder

Scan `10_Specifications/10.40_Epics/` for subdirectories matching `10.40.NNN_*`. Identify which ones do not yet contain a `technical.md`.

- If exactly one epic folder has no `technical.md`, target it automatically and inform the user.
- If multiple epic folders have no `technical.md`, use `AskUserQuestion` to ask the user which one to populate.
- If all epic folders already have a `technical.md`, use `AskUserQuestion` to ask which one the user wants to update.

The target file is: `10_Specifications/10.40_Epics/10.40.{NNN}_{SLUG}/technical.md`

### Step 2 — Review Context

Before asking any questions:

1. Read `10_Specifications/10.40_Epics/10.40.{NNN}_{SLUG}/functional.md` to understand what is being built
2. Read any `technical.md` files from other epic folders to avoid re-establishing already-decided standards
3. Review source code files (e.g. `package.json`, `tsconfig.json`, config files, key modules) to understand the existing tech stack
4. If `technical.md` already exists in the target folder, read it — update it, don't replace it

### Step 3 — Compile Initial Questions

After reviewing context, internally generate a list of outstanding questions about the technology choices needed to build this epic. For each question, assess:

- **Impact**: How much does this gap affect architecture, tooling, or implementation decisions?
- **Importance**: Is this a blocker or a detail that can be deferred?

Sort by impact × importance (highest first). Do NOT show this list to the user.

### Step 4 — Ask One Question

Use the `AskUserQuestion` tool to ask only the single highest-priority outstanding question.

### Step 5 — Update and Repeat

After each answer:

1. Update `technical.md` with any new or clarified technical requirements. Add content under logical sections (see structure below).
2. Re-evaluate your question list: remove answered questions, add any new questions surfaced by the answer, re-sort by priority.
3. If meaningful questions remain, go to Step 4.
4. If tech requirements are sufficiently defined (no high-impact unknowns remain), proceed to Step 6.

### Step 6 — Finalize

Inform the user that elicitation is complete and the tech standards document is ready. Summarize the key technical decisions captured. State the full file path.

## Rules

- **One question at a time.** Always use the `AskUserQuestion` tool — never ask multiple questions in a text block.
- **No implementation.** Do not write code, scaffolding, or configuration files. Only document technical standards and decisions.
- **Update the document after every answer.** Never batch updates.
- **Read before writing.** Always review `functional.md`, other epics' `technical.md`, and the codebase before asking questions. Questions should reflect genuine unknowns, not things already established.
- **Respect prior epics.** Do not re-ask about technology choices already documented in other `technical.md` files unless the user explicitly wants to revisit them.
- **Scope to technology.** Focus on runtime, language, libraries, APIs, tooling, patterns, and constraints — not on features or user stories (those belong in `functional.md`).

## technical.md Structure

```markdown
# Technical Standards — {Epic Title}

## Runtime & Language
- Runtime: ...
- Language: ...
- Version constraints: ...

## Key Libraries & Frameworks
- ...

## Tooling
- Build: ...
- Test: ...
- Lint/Format: ...

## APIs & External Services
- ...

## Architecture Patterns
- ...

## Constraints & Non-Goals
- ...

## Open Questions
- (remove as answered)
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Asking multiple questions at once | Use `AskUserQuestion` — one question only |
| Skipping context review | Always read `functional.md`, other tech docs, and source code before asking (Step 2) |
| Asking about things already established | Read existing `technical.md` files and `package.json` first |
| Drifting into feature discussion | Redirect: "That's a functional requirement — let's focus on the technology choice" |
| Forgetting to re-prioritize after each answer | Re-sort question list every iteration |
| Treating all unknowns equally | Prioritize by architectural impact — some answers unlock many others |
