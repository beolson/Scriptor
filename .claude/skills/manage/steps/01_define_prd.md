# Define PRD

## Goal

Create a Product Requirements Document at `10_Specs/Prd/{NNN}-{name}.md` that captures the high-level vision, scope, and use cases for a product.

## Prerequisites

None. This step is always available.

## Workflow

### Step 1 — Determine Target

Scan `10_Specs/Prd/` for existing PRD files matching `{NNN}-*.md`.

- If the orchestrator indicated a specific PRD to resume, target that file.
- If creating a new PRD, assign the next available NNN (highest existing + 1, or `001` if none exist).

### Step 2 — Initialize or Load

**New PRD:**
1. Create `10_Specs/Prd/{NNN}-placeholder.md` with this template (the filename will be updated in Step 4):

```yaml
---
status: Draft
created: {today's date}
---
```

```markdown
# TBD — Product Requirements

## Vision


## Goals


## User Personas


## High-Level Use Cases


## Scope Boundaries


## Out of Scope


## Success Metrics

```

**Resuming a Draft PRD:**
1. Read the existing file in full.
2. Identify which sections are empty or incomplete — these drive the elicitation.

### Step 3 — Elicitation

Follow the **Elicitation Process** (see `_elicitation.md`) to fill out all sections.

**The first question must always be:** Ask the user for a high-level description of the product — what it is, the problem it solves, and who it's for. This answer seeds all subsequent elicitation questions. Do NOT ask the user for a product name; the agent will derive one later.

Subsequent questions by section:

| Section | Example Seed Questions |
|---|---|
| Vision | (Derived from the initial description — refine as needed) |
| Goals | What are the top 3 measurable outcomes? |
| User Personas | Who are the primary users? What are their key needs? |
| High-Level Use Cases | What are the main things users will do with this product? |
| Scope Boundaries | What is explicitly included in v1? |
| Out of Scope | What is explicitly excluded or deferred? |
| Success Metrics | How will you measure success? |

### Step 4 — Finalize

When elicitation is complete:
1. Review the document for consistency.
2. Derive a concise product name from the gathered requirements. Use it to:
   a. Update the document heading from `# TBD — Product Requirements` to `# {Product Name} — Product Requirements`.
   b. Rename the file from `{NNN}-placeholder.md` to `{NNN}-{slug}.md` where `{slug}` is a lowercase, hyphen-separated version of the product name.
3. Update `status: Draft` to `status: Ready` in the YAML frontmatter.
4. Inform the user of the chosen name and that the PRD is ready.

## Rules

- **Keep it high-level** — no technical details, no implementation specifics, no architecture decisions.
- **Use cases describe user goals**, not system behavior. "User can search for products" not "System queries Elasticsearch index."
- **Read existing Ready PRDs** before starting to avoid overlap or contradiction.
- **One PRD per product** — if the user describes something that belongs in an existing PRD, suggest updating that one instead.
