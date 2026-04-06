# Define Epic Functional Requirements

## Goal

Create `10_Specs/Epics/{NNN}-{name}/Functional.md` that thoroughly documents the use cases, acceptance criteria, and workflows for a new epic.

## Prerequisites

At least one PRD in `Ready` state.

## Workflow

### Step 1 — Context

1. Read all PRDs with `status: Ready`.
2. If the orchestrator specified which PRD this epic relates to, note it. Otherwise, ask the user which PRD to reference.
3. Read any existing Ready ADRs for technology context.

### Step 2 — Determine Target

Scan `10_Specs/Epics/` for existing epic directories matching `{NNN}-*/`.

- If resuming an epic with a Draft Functional.md, target that directory.
- If creating a new epic, assign the next available NNN (highest existing + 1, or `001` if none exist).

### Step 3 — Initialize or Load

**New Epic:**
1. Create the directory `10_Specs/Epics/{NNN}-placeholder/` (the real name will be derived from elicitation and applied during finalization).
2. Create `status.yaml`:

```yaml
status: Draft
prd: {NNN}-{prd-name}
completed_steps: []
```

4. Create `Functional.md` with this template:

```yaml
---
status: Draft
created: {today's date}
prd: {NNN}-{prd-name}
---
```

```markdown
# {Epic Name} — Functional Requirements

## Overview

_Brief description of what this epic delivers and why._

## Use Cases

### UC-001: {Use Case Title}

**Actor:** {who}
**Trigger:** {what starts this}
**Preconditions:**
-

**Main Flow:**
1.
2.
3.

**Postconditions:**
-

**Alternative Flows:**
-

**Error Flows:**
-

## Acceptance Criteria

- [ ] AC-001:
- [ ] AC-002:

## Workflows

_Describe end-to-end workflows that span multiple use cases._

## Data Requirements

_What data does this epic need to create, read, update, or delete?_

## Edge Cases

-

## Out of Scope

_What is explicitly NOT included in this epic?_

## Open Questions

_Resolved during elicitation — remove when answered._
```

**Resuming a Draft:**
1. Read the existing `Functional.md` in full.
2. Read `status.yaml` to understand current state.
3. Identify incomplete sections.

### Step 4 — Elicitation

Follow the **Elicitation Process** (see `_elicitation.md`) to fill out all sections.

This must be **thorough and detailed** — unlike the high-level PRD.

**The first question must always be:** Ask the user to describe the epic's scope — what specific capability it delivers and who benefits. This answer seeds the epic name and all subsequent questions.

Subsequent seed questions:

| Section | Example Seed Questions |
|---|---|
| Overview | What specific capability does this epic deliver? |
| Use Cases | Walk me through the primary user workflow step by step. What triggers it? |
| Use Cases | What happens when something goes wrong? (error flows) |
| Use Cases | Are there alternative paths to accomplish the same goal? |
| Acceptance Criteria | What must be true for this epic to be considered done? |
| Workflows | Do any use cases chain together into a larger workflow? |
| Data | What data entities are involved? What are their key fields? |
| Edge Cases | What unusual inputs or states could occur? |
| Out of Scope | What related features are explicitly deferred? |

**Important:** Do not accept vague answers. If the user says "users can manage their account," ask what specific actions that includes (view profile, edit name, change password, delete account, etc.).

### Step 5 — Finalize

1. Remove the **Open Questions** section (all should be resolved).
2. Number all use cases (`UC-001`, `UC-002`, ...) and acceptance criteria (`AC-001`, `AC-002`, ...).
3. Review for internal consistency — do acceptance criteria cover all use cases?
4. Derive a concise epic name from the gathered requirements. Use it to:
   a. Update the document heading from `# {Epic Name} — Functional Requirements` to `# {Derived Name} — Functional Requirements`.
   b. Rename the epic directory from `{NNN}-placeholder` to `{NNN}-{slug}` (lowercase, hyphen-separated). Move all files into the renamed directory.
5. Update `Functional.md` frontmatter: `status: Draft` → `status: Ready`.
6. Update `status.yaml`: add `functional` to `completed_steps`.
7. Inform the user of the chosen epic name and that the functional spec is ready.

## Rules

- **Be thorough** — this is the foundation for all subsequent epic steps. Gaps here become bugs later.
- **Use specific language** — "The system displays a paginated list of up to 20 items" not "The system shows items."
- **Number everything** — UC-NNN, AC-NNN. These IDs are referenced in later steps.
- **Reference the PRD** — use cases should trace back to PRD goals and use cases.
- **Don't include technical details** — no mention of specific APIs, databases, or libraries. That's for TechRequirements.md.
