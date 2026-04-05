# Research Codebase & ADR

## Goal

Create `10_Specs/Epics/{NNN}-{name}/Research.md` documenting all relevant code paths, existing patterns, and integration points for the epic.

## Prerequisites

The target epic's `Functional.md` must be in `Ready` state.

## Workflow

### Step 1 — Load Context

1. Read the epic's `Functional.md` in full.
2. Read the epic's `status.yaml`.
3. Read all ADRs with `status: Ready` — these document technology decisions that apply.
4. Read any standalone research documents (`10_Specs/Research/*/Outcome.md` with `status: Ready`) that are relevant.

### Step 2 — Initialize or Load

**New Research:**
Create `Research.md` with this template:

```yaml
---
status: Draft
created: {today's date}
---
```

```markdown
# {Epic Name} — Codebase Research

## Summary

_High-level summary of findings._

## Related Code Paths

### {Area 1}

**Files:**
-

**Description:**


**Relevance to this epic:**


## Existing Patterns

_Patterns already in the codebase that this epic should follow._

### {Pattern 1}

**Where used:**
**How it works:**
**Apply to this epic:**


## Integration Points

_Where this epic's code will connect to existing code._

### {Integration 1}

**Module:**
**Interface:**
**Notes:**


## Dependencies

_External and internal dependencies this epic will rely on._

| Dependency | Type | Version | Purpose |
|---|---|---|---|
| | | | |

## Gaps & Risks

_What's missing or could go wrong._

-
```

**Resuming Draft Research:**
Read the existing `Research.md` and identify incomplete sections.

### Step 3 — Explore the Codebase

Systematically investigate the codebase using Glob, Grep, and Read tools:

1. **Map related modules** — For each use case in `Functional.md`, identify which existing files/modules are involved.
2. **Trace code paths** — Follow imports and function calls to understand how data flows through related areas.
3. **Identify patterns** — Look for recurring patterns in similar features:
   - File/folder naming conventions
   - Error handling approaches
   - Testing patterns (what test frameworks, where tests live, naming)
   - State management approaches
   - API patterns (routes, middleware, validation)
4. **Find integration points** — Where will new code connect to existing code? What interfaces exist?
5. **Check dependencies** — What packages are already in use that this epic can leverage?
6. **Note gaps** — What doesn't exist yet that this epic will need?

Document findings in `Research.md` as you go.

### Step 4 — Finalize

1. Write a clear **Summary** at the top.
2. Ensure every use case from `Functional.md` has at least one related code path or gap identified.
3. Update `Research.md` frontmatter: `status: Draft` → `status: Ready`.
4. Update `status.yaml`: add `research` to `completed_steps`.
5. Inform the user the codebase research is complete.

## Rules

- **Be thorough** — read actual file contents, don't guess from filenames.
- **Include file paths** — every reference should include the full path so developers can navigate directly.
- **Don't propose solutions** — this step documents what exists, not what to build. Solutions come in TechRequirements.md.
- **Note what's NOT there** — missing tests, missing types, missing validation are all important findings.
- **Respect ADR decisions** — if an ADR mandates a pattern, note it as a constraint.
