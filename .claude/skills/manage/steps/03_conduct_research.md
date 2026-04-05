# Conduct Research

## Goal

Research a technology, library, or approach and produce `10_Specs/Research/{NNN}-{name}/Outcome.md`. Optionally create a standalone demo.

## Prerequisites

At least one PRD in `Ready` state.

## Workflow

### Step 1 — Determine Target

Scan `10_Specs/Research/` for existing research directories matching `{NNN}-*/`.

- If resuming a draft, target that directory.
- If starting new research, assign the next available NNN (highest existing + 1, or `001` if none exist).

### Step 2 — Initialize or Load

**New Research:**
1. Ask the user what to research and why.
2. Create the directory `10_Specs/Research/{NNN}-{name}/`.
3. Create `Outcome.md` with this template:

```yaml
---
status: Draft
created: {today's date}
---
```

```markdown
# Research: {Topic}

## Objective

_What question are we trying to answer?_

## Findings

### {Finding 1}


## Evaluation

### Pros


### Cons


### Risks


## Recommendation


## Demo

_If a demo was created, describe how to run it._

## Sources

-
```

**Resuming Draft Research:**
1. Read `Outcome.md` in full.
2. Identify what's been covered and what remains.

### Step 3 — Research

1. **Use `WebSearch`** to find the latest and most up-to-date information. Do NOT rely solely on training data — libraries and tools change frequently.
2. Search for: official documentation, recent release notes, migration guides, community feedback, known issues.
3. Follow the **Elicitation Process** (see `_elicitation.md`) to refine the research direction with the user. Key questions:
   - What specific aspects matter most? (performance, DX, ecosystem, cost)
   - Are there constraints? (license, runtime, compatibility)
   - What would a successful outcome look like?

4. Document findings in `Outcome.md` as you go.

### Step 4 — Demo (Optional)

If the user wants a demo or one would be valuable:

1. Create all demo files **inside the research directory** (`10_Specs/Research/{NNN}-{name}/`).
2. The demo must be **fully isolated** from the rest of the project:
   - No imports from project source code.
   - Self-contained dependencies.
3. For TypeScript demos:
   - Include a `bunfig.toml` with:
     ```toml
     [install]
     auto = "force"
     ```
   - Include a `package.json` with required dependencies.
   - The demo should be runnable with `bun run {entry-file}` — no manual install step.
4. For Docker demos:
   - Include a `docker-compose.yml` (or `Dockerfile`).
   - Document how to start and stop in `Outcome.md`.
5. Update the **Demo** section of `Outcome.md` with instructions.

### Step 5 — Finalize

1. Ensure all findings are documented with sources.
2. Write a clear **Recommendation** section.
3. Update `status: Draft` to `status: Ready` in the YAML frontmatter.
4. Inform the user the research is complete.

## Rules

- **Always use WebSearch** — do not present training-data knowledge as current fact.
- **Cite sources** — include URLs in the Sources section.
- **Demos are standalone** — a fresh clone of the research directory must work without the rest of the project.
- **Stay focused** — research the specific topic requested, not adjacent topics.
- **Be honest about unknowns** — if information is conflicting or unclear, say so.
