# Define Epic Tech Requirements

## Goal

Create `10_Specs/Epics/{NNN}-{name}/TechRequirements.md` that specifies the technical approach for implementing the epic.

## Prerequisites

The target epic's `Research.md` must be in `Ready` state.

## Workflow

### Step 1 — Load Context

1. Read the epic's `Functional.md` in full.
2. Read the epic's `Research.md` in full.
3. Read the epic's `status.yaml`.
4. Read all ADRs with `status: Ready`.
5. Read project-level config files: `package.json`, `tsconfig.json` (if exists), `biome.json` (if exists).

### Step 2 — Initialize or Load

**New TechRequirements:**
Create `TechRequirements.md` with this template:

```yaml
---
status: Draft
created: {today's date}
---
```

```markdown
# {Epic Name} — Technical Requirements

## Tech Stack

| Category | Choice | Version | Notes |
|---|---|---|---|
| Runtime | | | |
| Language | | | |
| Framework | | | |
| Testing | | | |
| Linting | | | |

## Architecture

_How the new code is structured and where it lives in the project._

### New Modules

| Module | Location | Responsibility |
|---|---|---|
| | | |

### Modified Modules

| Module | Location | Changes |
|---|---|---|
| | | |

## API Contracts

_Interfaces, types, and function signatures that define module boundaries._

### {Interface/Type 1}

```typescript
// Define the contract
```

## Data Models

_New or modified data structures._

### {Model 1}


## Testing Strategy

### Unit Tests

- **Location:**
- **Framework:**
- **Naming:**
- **Coverage targets:**

### Integration Tests

- **Location:**
- **Framework:**
- **What to test:**

## Error Handling

_How errors are handled, logged, and surfaced._

## Performance Requirements

_Specific performance targets or constraints, if any._

## Constraints & Decisions

_Technical constraints from ADRs, Research, or the codebase._

-
```

**Resuming Draft TechRequirements:**
Read the existing `TechRequirements.md` and identify incomplete sections.

### Step 3 — Elicitation

Follow the **Elicitation Process** (see `_elicitation.md`) to fill out all sections.

Seed questions:

| Section | Example Seed Questions |
|---|---|
| Tech Stack | Are there any new libraries needed beyond what's in the project? |
| Architecture | Where should new code live? New package/workspace or existing? |
| Architecture | How does this integrate with the existing module structure from Research.md? |
| API Contracts | What are the key interfaces between modules? |
| Data Models | What new types/entities are needed? What fields? |
| Testing | Any specific testing requirements beyond the project defaults? |
| Error Handling | How should errors in this feature be surfaced to users? |
| Performance | Are there latency, throughput, or size constraints? |

**Important:** Reference the `Research.md` findings frequently. The technical approach should build on existing patterns identified there, not invent new ones unnecessarily.

### Step 4 — Finalize

1. Ensure the tech stack table is complete and specific (versions, not just names).
2. Verify all API contracts have TypeScript signatures.
3. Check that the architecture section addresses every use case from `Functional.md`.
4. Confirm alignment with Ready ADRs.
5. Update `TechRequirements.md` frontmatter: `status: Draft` → `status: Ready`.
6. Update `status.yaml`: add `tech` to `completed_steps`.
7. Inform the user the tech requirements are ready.

## Rules

- **Be specific** — name exact packages, versions, file paths. "Use Hono v4.x for routing" not "use a router."
- **Follow existing patterns** — the Research.md documents what patterns exist. Use them unless there's a strong reason not to (and document that reason).
- **ADRs are authoritative** — if a Ready ADR mandates a technology or pattern, the tech requirements must comply.
- **API contracts are contracts** — modules built against these interfaces should be able to work independently. Think about testability.
- **Don't over-specify** — define what's needed for this epic, not a general-purpose architecture.
