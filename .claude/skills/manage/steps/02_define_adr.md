# Define ADR

## Goal

Create an Architecture Decision Record at `10_Specs/ADR/{NNN}-{name}.md` that documents a technology choice or architectural pattern decision.

## Prerequisites

At least one PRD in `Ready` state.

## Workflow

### Step 1 — Context

1. Read all PRDs with `status: Ready` to understand the product landscape.
2. Read all existing ADRs (any status) to understand decisions already made.

### Step 2 — Determine Target

Scan `10_Specs/ADR/` for existing ADR files matching `{NNN}-*.md`.

- If resuming a draft ADR, target that file.
- If creating a new ADR, assign the next available NNN (highest existing + 1, or `001` if none exist).

### Step 3 — Initialize or Load

**New ADR:**
1. Ask the user what decision needs to be recorded.
2. Create `10_Specs/ADR/{NNN}-{name}.md` with this template:

```yaml
---
status: Draft
created: {today's date}
---
```

```markdown
# ADR-{NNN}: {Decision Title}

## Status

Proposed

## Context

_What is the issue that we're seeing that is motivating this decision?_

## Decision

_What is the change that we're proposing and/or doing?_

## Consequences

_What becomes easier or harder as a result of this decision?_

### Positive

-

### Negative

-

### Neutral

-

## Alternatives Considered

### {Alternative 1}

- **Description:**
- **Pros:**
- **Cons:**
- **Why rejected:**

```

**Resuming a Draft ADR:**
1. Read the existing file in full.
2. Identify incomplete sections.

### Step 4 — Elicitation

Follow the **Elicitation Process** (see `_elicitation.md`) to fill out all sections.

Seed questions:

| Section | Example Seed Questions |
|---|---|
| Context | What problem or constraint drives this decision? What has been tried? |
| Decision | What specific technology/pattern/approach are you choosing? |
| Consequences | What trade-offs does this introduce? What risks? |
| Alternatives | What other options were considered? Why were they rejected? |

### Step 5 — Finalize

When elicitation is complete:
1. Review for consistency with existing ADRs.
2. Update `status: Draft` to `status: Ready` in the YAML frontmatter.
3. Inform the user the ADR is ready.

## Rules

- **One decision per ADR** — if multiple decisions emerge, create separate ADRs.
- **Be specific** — name exact libraries, versions, patterns. "Use Hono for HTTP routing" not "Use a web framework."
- **Reference PRDs** — link back to the product requirement that motivates this decision.
- **Only Ready ADRs are authoritative** — Draft ADRs are proposals under discussion.
