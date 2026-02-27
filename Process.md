# Scriptor Process Definition

> Status: Draft — being defined via Q&A elicitation

## Overview

This document defines the steps for brainstorming, research, and requirements processes. All outputs are stored in a `/specs/` folder at the root of the project.

---

## Startup Flow

When the agent starts, it:

1. Reads `/specs/current_state.md`

**If the file does not exist** → New project path:
  1. Ask the user to briefly describe the project:
     - Project overview
     - Scope
     - Any collaborating systems (integrations)
  2. Document this context in `/specs/product.md`
  3. Automatically prompt the user to create the first phase (see Creating a New Phase)

  > `product.md` can be updated at any time if the project scope or overview evolves, though the core essence of what is being built is expected to remain stable.

**If the file exists** → Existing project path:
  1. Check the phase document registry and tech requirements registry for any in-progress activities
  2. If one or more in-progress activities are found, present the list to the user and ask which (if any) they would like to resume — providing the path to each draft document
     - If the user selects one → resume that activity
     - If the user declines → proceed to Activity Selection; in-progress activities remain unchanged and will appear again at the next startup
  3. If no in-progress activities are found → proceed directly to Activity Selection

### Activity Selection

After startup (or after completing/abandoning an activity), the agent prompts the user to choose what to do next. The user can either:
- **State their intent in natural language** — the agent infers the activity type and proceeds, or
- **Choose from a menu** — the agent presents the available activity types: Brainstorm, Research, Feature Spec, Technical Requirements, or other phase actions (mark phase ready, start new phase, update product.md, etc.)

---

## State File: `/specs/current_state.md`

Format: Markdown

Tracks:
- **Current phase ID** — the active phase (e.g., `phase_0001`)
- **List of all phases** — history of all phases and their status (active, ready-for-implementation, implemented)
- **Phase document registry** — for each phase, a list of all activity documents (brainstorm, research, feature spec), their file path, and their status (in-progress, complete, abandoned)
- **Tech requirements registry** — a separate global list of all Technical Requirements documents, their file path, and their status (in-progress, complete, abandoned); not tied to any specific phase

---

## Phase Lifecycle

- Phases are numbered sequentially (e.g., `phase_0001`, `phase_0002`, ...).
- There is always exactly **one current phase** at a time — the active phase tracked in `current_state.md`.
- Each phase can contain **multiple activities** across all three activity types.
- Activities within a phase can be done in **any order** — no prescribed sequence.
- Phase content is stored in `/specs/{phase}/` (e.g., `/specs/phase_0001/`)

### Creating a New Phase

- The user initiates a new phase by requesting it (e.g., "start a new phase").
- The agent prompts the user for a short **name or goal description** for the phase.
- The agent then:
  1. Assigns the next sequential phase ID
  2. Creates the phase folder (`/specs/{phase}/`)
  3. Adds the phase to `current_state.md` as the active phase with the provided name/goal

### Activity Completion

- Activities are **explicitly declared complete by the user**.
- Upon completion, `current_state.md` is updated to mark that document as `complete` in the phase document registry.

### Activity Abandonment

- A user can explicitly abandon an in-progress activity.
- Upon abandonment, the document is marked `abandoned` in the phase document registry in `current_state.md`.
- Abandoned documents are **not** counted as incomplete when evaluating phase readiness — only `in-progress` documents block readiness.

### Phase Readiness

- The phase readiness check is **user-initiated** — the user explicitly requests it (e.g., "mark this phase ready").
- When triggered, the agent reviews the phase document registry in `current_state.md`:
  - If all documents are complete → mark the phase as `ready-for-implementation` in `current_state.md`.
  - If any documents are incomplete → inform the user and ask if they would like to continue working on one of them, or mark the phase ready anyway.

### Implementation Handoff

- A phase marked `ready-for-implementation` is a signal to a **separate implementation process** (outside this process).
- That external process is responsible for executing the phase and will update the phase status to `implemented` in `current_state.md` when complete.
- This process (Scriptor) does not manage the implementation phase itself.
- **Phases are locked once marked `ready-for-implementation`** — no new activity documents may be added. If a user attempts to add an activity to a locked phase, the agent informs them of the lock and suggests starting a new phase for the new work.

---

## Document Naming Convention

All activity documents follow this naming pattern:

```
{NNNN-YYYY-MM-DD}-{slug}.md
```

- `NNNN` — a zero-padded incrementing number, unique within a given phase/activity folder (e.g., within `/brainstorm/`, `/research/`, `/functional/`)
- `YYYY-MM-DD` — date the document was created
- `slug` — a short kebab-case label derived from the topic or title provided by the user

The counter is derived by scanning existing files in the target folder and incrementing from the highest number found.

Example: `0003-2026-02-27-auth-flow.md`

---

## User Activities

### Brainstorming
- Output location: `/specs/{phase}/brainstorm/`
- Format: Structured markdown template per session
- Template sections:
  1. **Problem / Goal** — what problem or opportunity is being explored
  2. **Ideas / Options** — list of ideas generated
  3. **Pros & Cons** — trade-offs for each idea
  4. **Next Steps / Outcomes** — actions or decisions resulting from the session

### Technology Research
- Output location: `/specs/{phase}/research/`
- Format: Structured markdown template per research topic
- Template sections:
  1. **Technology Overview** — what the technology is and what it does
  2. **Use Case Fit** — how well it fits the project's needs
  3. **Trade-offs / Risks** — pros, cons, and risks of adopting it
  4. **Recommendation** — final recommendation or decision outcome

### Feature Specification
- Output location: `/specs/{phase}/functional/`
- Format: User story format per feature
- Story structure: `As a [user], I want [goal], so that [benefit]`
- Additional fields per story:
  1. **Acceptance Criteria** — explicit conditions that must be true for the story to be done
  2. **Priority / Effort** — relative priority and complexity estimate
  3. **Edge Cases** — known edge cases or error scenarios
  4. **Out of Scope** — explicit statement of what this story does NOT cover

### Technical Requirements
- Stored outside phase folders: `/specs/tech/`
- Applies project-wide (not phase-specific)
- Covers:
  - **Non-functional requirements** — performance, scalability, availability, security constraints
  - **Architecture decisions** — system design, component structure, data flow
  - **Tech stack choices** — languages, frameworks, databases, services
  - **Integration / API contracts** — how the system interfaces with external systems

---

## Activity Authoring

When a new activity document is created, the agent **interviews the user** to populate it:
- The agent asks targeted questions for each section of the template, one section at a time
- Answers are used to fill in the document progressively
- After all sections are complete, the document enters the review loop

## Review Process

Each activity output goes through a review loop:
1. Output document is produced (via the interview process above)
2. User reviews it and provides feedback
3. Document is revised based on feedback
4. Loop repeats until the user is satisfied and explicitly marks the activity complete

This applies to all activity types: brainstorm, research, feature spec, and technical requirements.

---

## Open Questions

_(none outstanding)_
