---
name: define-tech
description: Use when the user wants to define technical requirements for a product phase through structured Q&A elicitation, before any implementation. Do NOT invoke automatically — only when user explicitly requests defining tech standards for a phase.
disable-model-invocation: true
---

# Define Tech Standards

## Overview

A Q&A elicitation session that builds a `tech-standards.md` document for the current product phase. No code is written. Technical requirements are discovered incrementally through prioritized questions, one at a time, informed by reviewing existing source code and functional requirements.

## Workflow

### Step 1 — Identify the Current Phase

- Scan `spec/` for existing `phase{N}` folders (e.g. `phase1`, `phase2`)
- The current phase = the highest existing N
- The document to populate: `spec/phase{N}/tech-standards.md`

### Step 2 — Review Context

Before asking any questions:

1. Read `spec/phase{N}/FunctionalRequirements.md` to understand what is being built
2. Read any existing `spec/phase*/tech-standards.md` from prior phases to avoid re-establishing already-decided standards
3. Review source code files (e.g. `package.json`, `tsconfig.json`, config files, key modules) to understand the existing tech stack
4. Read the existing `spec/phase{N}/tech-standards.md` if it exists — update it, don't replace it

### Step 3 — Compile Initial Questions

After reviewing the context, internally generate a list of outstanding questions about the technology choices. For each question, assess:

- **Impact**: How much does this gap affect architecture, tooling, or implementation decisions?
- **Importance**: Is this a blocker or a detail that can be deferred?

Sort by impact × importance (highest first). Do NOT show this list to the user.

### Step 4 — Ask One Question

Use the `AskUserQuestion` tool to ask only the single highest-priority outstanding question.

### Step 5 — Update and Repeat

After each answer:

1. Update `spec/phase{N}/tech-standards.md` with any new or clarified technical requirements discovered from the answer. Add requirements under logical sections (see structure below).
2. Re-evaluate your question list: remove answered questions, add any new questions surfaced by the answer, re-sort by priority.
3. If meaningful questions remain, go to Step 4.
4. If tech requirements are sufficiently defined (no high-impact unknowns remain), proceed to Step 6.

### Step 6 — Finalize

Inform the user that elicitation is complete and the tech standards document is ready at `spec/phase{N}/tech-standards.md`. Summarize the key technical decisions captured.

## Rules

- **One question at a time.** Always use the `AskUserQuestion` tool — never ask multiple questions in a text block.
- **No implementation.** Do not write code, scaffolding, or configuration files. Only document technical standards and decisions.
- **Update the document after every answer.** Never batch updates.
- **Read before writing.** Always review the codebase and existing phase docs before asking questions. Questions should reflect genuine unknowns, not things already established.
- **Respect prior phases.** Do not re-ask about technology choices already documented in prior `tech-standards.md` files unless the user explicitly wants to revisit them.
- **Scope to technology.** Focus on runtime, language, libraries, APIs, tooling, patterns, and constraints — not on features or user stories (those belong in `FunctionalRequirements.md`).

## tech-standards.md Structure

```markdown
# Phase {N} Tech Standards

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
| Skipping codebase review | Always review source and prior phases before asking (Step 2) |
| Asking about things already established | Read existing tech-standards and package.json first |
| Drifting into feature discussion | Redirect: "That's a functional requirement — let's focus on the technology choice" |
| Forgetting to re-prioritize after each answer | Re-sort question list every iteration |
| Treating all unknowns equally | Prioritize by architectural impact — some answers unlock many others |
